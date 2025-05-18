const express = require("express");
const moment = require("moment");
const { pool } = require("../config/db");

const router = express.Router();

// Make a Booking Request
router.post("/Request", async (req, res) => {
  const { guide_id, traveler_id, date } = req.body;

  if (!guide_id || !traveler_id || !date) {
    return res.status(400).json({
      message: "Missing required fields",
      received: req.body,
    });
  }

  const isValidFormat = moment(date, "DD.MM.YYYY", true).isValid();
  if (!isValidFormat) {
    return res.status(400).json({
      message: "Invalid date format. Expected DD.MM.YYYY",
    });
  }

  const parsedDate = moment(date, "DD.MM.YYYY").format("YYYY-MM-DD");

  try {
    const connection = await pool.getConnection();

    const availabilityCheck = await connection.query(
      `SELECT * FROM guide_availability 
       WHERE guide_id = ? AND date = ? AND status = 'available'`,
      [guide_id, parsedDate]
    );

    if (!Array.isArray(availabilityCheck) || availabilityCheck.length === 0) {
      connection.release();
      return res
        .status(409)
        .json({ message: "Guide is not available on this date" });
    }

    const conflictQuery = `
      SELECT status FROM bookings 
      WHERE guide_id = ? AND booked_date = ? AND status IN ('pending', 'confirmed')
    `;

    const bookingConflicts = await connection.query(conflictQuery, [
      guide_id,
      parsedDate,
    ]);

    if (Array.isArray(bookingConflicts) && bookingConflicts.length > 0) {
      connection.release();

      const hasConfirmed = bookingConflicts.some(
        (b) => b.status === "confirmed"
      );
      const hasPending = bookingConflicts.some((b) => b.status === "pending");

      if (hasConfirmed) {
        return res.status(409).json({
          message: "Guide is already booked on this date",
        });
      }

      if (hasPending) {
        return res.status(409).json({
          message:
            "Another request is already pending for this date,please try again later",
        });
      }
    }

    const insertQuery = `
      INSERT INTO bookings (guide_id, traveler_id, booked_date, status, created_at)
      VALUES (?, ?, ?, 'pending', NOW())
    `;
    const result = await connection.query(insertQuery, [
      guide_id,
      traveler_id,
      parsedDate,
    ]);

    connection.release();

    res.status(201).json({
      message: "Booking request created",
      booking_id: result.insertId,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err?.message });
  }
});

// Accept a Booking
// Accept a Booking
router.post("/Accept", async (req, res) => {
  const { booking_id } = req.body;

  if (!booking_id) {
    return res.status(400).json({ message: "Missing booking ID" });
  }

  try {
    const connection = await pool.getConnection();

    // Get guide_id and booked_date
    const [booking] = await connection.query(
      "SELECT guide_id, booked_date FROM bookings WHERE id = ?",
      [booking_id]
    );

    if (!booking) {
      connection.release();
      return res.status(404).json({ message: "Booking not found" });
    }

    const { guide_id, booked_date } = booking;

    // Update booking status to confirmed
    await connection.query(
      "UPDATE bookings SET status = 'confirmed' WHERE id = ?",
      [booking_id]
    );

    // Update guide availability to booked
    await connection.query(
      `UPDATE guide_availability 
       SET status = 'booked' 
       WHERE guide_id = ? AND date = ?`,
      [guide_id, booked_date]
    );

    // Fetch traveler info to notify
    const [traveler] = await connection.query(
      `SELECT u.email, u.name, g.username AS guide_username
       FROM bookings b
       JOIN users u ON b.traveler_id = u.id
       JOIN users g ON b.guide_id = g.id
       WHERE b.id = ?`,
      [booking_id]
    );

    connection.release();

    // Send email if traveler found
    if (traveler) {
      const formattedDate = moment(booked_date).format("DD.MM.YYYY");

      const mailOptions = {
        from: `"Youthful Guides" <${process.env.EMAIL_USER}>`,
        to: traveler.email,
        subject: "Your Booking is Confirmed",
        html: `
          <p>Hello ${traveler.name},</p>
          <p>Your booking for <strong>${formattedDate}</strong> with guide <strong>${traveler.guide_username}</strong> has been confirmed.</p>
          <p>Log in to your account to see the details.</p>
          <br/>
          <p>— Youthful Guides Team</p>
        `,
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log("✅ Confirmation email sent to traveler:", traveler.email);
      } catch (err) {
        console.error("❌ Failed to send confirmation email:", err.message);
      }
    }

    res.status(200).json({
      message: "Booking confirmed and availability updated",
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err?.message });
  }
});

// Decline a Booking
router.post("/Decline", async (req, res) => {
  const { booking_id } = req.body;

  if (!booking_id) {
    return res.status(400).json({ message: "Missing booking ID" });
  }

  try {
    const connection = await pool.getConnection();

    const [booking] = await connection.query(
      `SELECT b.status, b.booked_date,
              t.email AS traveler_email, t.name AS traveler_name,
              g.username AS guide_username
       FROM bookings b
       JOIN users t ON b.traveler_id = t.id
       JOIN users g ON b.guide_id = g.id
       WHERE b.id = ?`,
      [booking_id]
    );

    if (!booking) {
      connection.release();
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.status !== "pending") {
      connection.release();
      return res
        .status(400)
        .json({ message: "Only pending bookings can be declined" });
    }

    // Update status to cancelled
    await connection.query(
      "UPDATE bookings SET status = 'cancelled' WHERE id = ?",
      [booking_id]
    );

    // Email the traveler
    const formattedDate = moment(booking.booked_date).format("DD.MM.YYYY");

    const mailOptions = {
      from: `"Youthful Guides" <${process.env.EMAIL_USER}>`,
      to: booking.traveler_email,
      subject: "Booking Request Declined",
      html: `
        <p>Hello ${booking.traveler_name},</p>
        <p>Unfortunately, your booking request for <strong>${formattedDate}</strong> was declined by guide <strong>${booking.guide_username}</strong>.</p>
        <p>You can search again to find another available guide for that date.</p>
        <br/>
        <p>— Youthful Guides Team</p>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(
        "📧 Decline notification sent to traveler:",
        booking.traveler_email
      );
    } catch (mailErr) {
      console.error("❌ Failed to send decline email:", mailErr.message);
    }

    connection.release();

    res
      .status(200)
      .json({ message: "Booking declined and marked as cancelled" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err?.message });
  }
});

// Guide Cancels a Booking
router.post("/Cancel", async (req, res) => {
  const { booking_id } = req.body;

  if (!booking_id) {
    return res.status(400).json({ message: "Missing booking ID" });
  }

  try {
    const connection = await pool.getConnection();

    const [booking] = await connection.query(
      `SELECT b.status, b.guide_id, b.booked_date,
              t.email AS traveler_email, t.name AS traveler_name,
              g.username AS guide_username
       FROM bookings b
       JOIN users t ON b.traveler_id = t.id
       JOIN users g ON b.guide_id = g.id
       WHERE b.id = ?`,
      [booking_id]
    );

    if (!booking) {
      connection.release();
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.status !== "confirmed") {
      connection.release();
      return res.status(400).json({
        message: "Only confirmed bookings can be cancelled by the guide",
      });
    }

    const { guide_id, booked_date } = booking;

    // Cancel the booking
    await connection.query(
      "UPDATE bookings SET status = 'cancelled' WHERE id = ?",
      [booking_id]
    );

    // Free the availability slot
    await connection.query(
      `UPDATE guide_availability 
       SET status = 'available' 
       WHERE guide_id = ? AND date = ?`,
      [guide_id, booked_date]
    );

    // Send email to traveler
    const formattedDate = moment(booked_date).format("DD.MM.YYYY");

    const mailOptions = {
      from: `"Youthful Guides" <${process.env.EMAIL_USER}>`,
      to: booking.traveler_email,
      subject: "Your Booking Was Cancelled",
      html: `
        <p>Hello ${booking.traveler_name},</p>
        <p>Your confirmed booking on <strong>${formattedDate}</strong> with guide <strong>${booking.guide_username}</strong> was cancelled.</p>
        <p>You can now search again and request another guide for that day.</p>
        <br/>
        <p>— Youthful Guides Team</p>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(
        "📧 Cancellation email sent to traveler:",
        booking.traveler_email
      );
    } catch (mailErr) {
      console.error("❌ Failed to send cancellation email:", mailErr.message);
    }

    connection.release();

    res.status(200).json({
      message: "Booking cancelled and availability restored",
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err?.message });
  }
});

// Traveler Cancels a Booking
router.post("/Traveler/CancelBooking", async (req, res) => {
  const { booking_id, traveler_id } = req.body;

  if (!booking_id || !traveler_id) {
    return res
      .status(400)
      .json({ message: "Missing booking ID or traveler ID" });
  }

  try {
    const connection = await pool.getConnection();

    const [booking] = await connection.query(
      `SELECT b.status, b.guide_id, b.booked_date,
              t.username AS traveler_username,
              g.name AS guide_name, g.email AS guide_email
       FROM bookings b
       JOIN users t ON b.traveler_id = t.id
       JOIN users g ON b.guide_id = g.id
       WHERE b.id = ? AND b.traveler_id = ?`,
      [booking_id, traveler_id]
    );

    if (!booking) {
      connection.release();
      return res
        .status(404)
        .json({ message: "Booking not found or access denied" });
    }

    if (!["pending", "confirmed"].includes(booking.status)) {
      connection.release();
      return res.status(400).json({
        message: "Only pending or confirmed bookings can be cancelled",
      });
    }

    const {
      guide_id,
      booked_date,
      traveler_username,
      guide_name,
      guide_email,
    } = booking;

    // Cancel the booking
    await connection.query(
      "UPDATE bookings SET status = 'cancelled' WHERE id = ?",
      [booking_id]
    );

    // Update availability if previously confirmed
    if (booking.status === "confirmed") {
      await connection.query(
        `UPDATE guide_availability
         SET status = 'available'
         WHERE guide_id = ? AND date = ?`,
        [guide_id, booked_date]
      );
    }

    // Email the guide
    const formattedDate = moment(booked_date).format("DD.MM.YYYY");

    const mailOptions = {
      from: `"Youthful Guides" <${process.env.EMAIL_USER}>`,
      to: guide_email,
      subject: "Booking Cancelled by Traveler",
      html: `
        <p>Hello ${guide_name},</p>
        <p>The traveler <strong>${traveler_username}</strong> has cancelled their booking for <strong>${formattedDate}</strong>.</p>
        <p>You are now available for new bookings on that date (if it was confirmed).</p>
        <br/>
        <p>— Youthful Guides Team</p>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log("📧 Cancellation email sent to guide:", guide_email);
    } catch (mailErr) {
      console.error("❌ Failed to send cancellation email:", mailErr.message);
    }

    connection.release();

    res.status(200).json({ message: "Booking cancelled and guide notified" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err?.message });
  }
});

// Traveler Leaves a Review
router.post("/Traveler/LeaveReview", async (req, res) => {
  const { booking_id, traveler_id, rate, review } = req.body;

  if (!booking_id || !traveler_id || !rate) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  if (rate < 1 || rate > 5) {
    return res.status(400).json({ message: "Rate must be between 1 and 5" });
  }

  try {
    const connection = await pool.getConnection();

    // Check if booking exists and is completed
    const [booking] = await connection.query(
      `SELECT b.status, b.booked_date, g.email AS guide_email, g.name AS guide_name,
              t.username AS traveler_username
       FROM bookings b
       JOIN users g ON b.guide_id = g.id
       JOIN users t ON b.traveler_id = t.id
       WHERE b.id = ? AND b.traveler_id = ?`,
      [booking_id, traveler_id]
    );

    if (!booking) {
      connection.release();
      return res
        .status(404)
        .json({ message: "Booking not found or access denied" });
    }

    if (booking.status !== "completed") {
      connection.release();
      return res
        .status(400)
        .json({ message: "Only completed bookings can be reviewed" });
    }

    // Update booking with review and status
    await connection.query(
      `UPDATE bookings 
       SET rate = ?, review = ?, date_reviewed = NOW(), status = 'reviewed'
       WHERE id = ?`,
      [rate, review || null, booking_id]
    );

    // Email the guide
    const formattedDate = moment(booking.booked_date).format("DD.MM.YYYY");

    const mailOptions = {
      from: `"Youthful Guides" <${process.env.EMAIL_USER}>`,
      to: booking.guide_email,
      subject: "You Received a New Review",
      html: `
        <p>Hello ${booking.guide_name},</p>
        <p>You just received a new review from traveler <strong>${
          booking.traveler_username
        }</strong> for your tour on <strong>${formattedDate}</strong>.</p>
        <p><strong>Rating:</strong> ${rate} ⭐</p>
        <p><strong>Comment:</strong> ${review || "(No comment provided)"}</p>
        <p>Log in to your account to view all your reviews.</p>
        <br/>
        <p>— Youthful Guides Team</p>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log("📧 Review notification sent to guide:", booking.guide_email);
    } catch (mailErr) {
      console.error("❌ Failed to send review email:", mailErr.message);
    }

    connection.release();

    res.status(200).json({ message: "Review submitted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err?.message });
  }
});

// Traveler Views My Bookings
router.get("/TravelerBookings", async (req, res) => {
  const { traveler_id, start_date, end_date, pending, confirmed, completed } =
    req.query;

  if (!traveler_id) {
    return res.status(400).json({ message: "Missing traveler ID" });
  }

  try {
    const connection = await pool.getConnection();
    const filters = [`b.traveler_id = ?`];
    const params = [traveler_id];

    if (start_date && end_date) {
      if (
        !moment(start_date, "DD.MM.YYYY", true).isValid() ||
        !moment(end_date, "DD.MM.YYYY", true).isValid()
      ) {
        return res
          .status(400)
          .json({ message: "Invalid date format. Use DD.MM.YYYY" });
      }
      const start = moment(start_date, "DD.MM.YYYY").format("YYYY-MM-DD");
      const end = moment(end_date, "DD.MM.YYYY").format("YYYY-MM-DD");
      filters.push(`b.booked_date BETWEEN ? AND ?`);
      params.push(start, end);
    }

    const statusConditions = [];
    if (pending === "true") statusConditions.push(`b.status = 'pending'`);
    if (confirmed === "true") statusConditions.push(`b.status = 'confirmed'`);
    if (completed === "true")
      statusConditions.push(`b.status = 'completed' OR b.status = 'reviewed'`);

    if (statusConditions.length > 0) {
      filters.push(`(` + statusConditions.join(" OR ") + `)`);
    }

    const query = `
        SELECT 
          b.id AS booking_id,
          b.guide_id,
          u.username,
          u.name,
          u.surname,
          u.email,
          p.photo_data AS profile_picture,
          b.booked_date,
          b.status,
          b.rate,
          b.review
        FROM bookings b
        JOIN users u ON b.guide_id = u.id
        LEFT JOIN profile_photos p ON u.id = p.user_id
        WHERE ${filters.join(" AND ")}
        ORDER BY b.booked_date ASC
      `;

    const results = await connection.query(query, params);

    connection.release();

    const bookings = results.map((b) => ({
      ...b,
      booked_date: moment(b.booked_date).format("DD.MM.YYYY"),
    }));

    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err?.message });
  }
});

// Guide Views My Bookings
router.get("/GuideBookings", async (req, res) => {
  const { guide_id, start_date, end_date, pending, confirmed, completed } =
    req.query;

  if (!guide_id) {
    return res.status(400).json({ message: "Missing guide ID" });
  }

  try {
    const connection = await pool.getConnection();
    const filters = [`b.guide_id = ?`];
    const params = [guide_id];

    if (start_date && end_date) {
      if (
        !moment(start_date, "DD.MM.YYYY", true).isValid() ||
        !moment(end_date, "DD.MM.YYYY", true).isValid()
      ) {
        return res
          .status(400)
          .json({ message: "Invalid date format. Use DD.MM.YYYY" });
      }
      const start = moment(start_date, "DD.MM.YYYY").format("YYYY-MM-DD");
      const end = moment(end_date, "DD.MM.YYYY").format("YYYY-MM-DD");
      filters.push(`b.booked_date BETWEEN ? AND ?`);
      params.push(start, end);
    }

    const statusConditions = [];
    if (pending === "true") statusConditions.push(`b.status = 'pending'`);
    if (confirmed === "true") statusConditions.push(`b.status = 'confirmed'`);
    if (completed === "true") statusConditions.push(`b.status = 'completed'`);

    if (statusConditions.length > 0) {
      filters.push(`(` + statusConditions.join(" OR ") + `)`);
    }

    const query = `
        SELECT 
          b.id AS booking_id,
          u.username,
          u.name,
          u.surname,
          u.email,
          p.photo_data AS profile_picture,
          b.booked_date,
          b.status,
          b.rate,
          b.review
        FROM bookings b
        JOIN users u ON b.traveler_id = u.id
        LEFT JOIN profile_photos p ON u.id = p.user_id
        WHERE ${filters.join(" AND ")}
        ORDER BY b.booked_date ASC
      `;

    const results = await connection.query(query, params);

    connection.release();

    const bookings = results.map((b) => ({
      ...b,
      booked_date: moment(b.booked_date).format("DD.MM.YYYY"),
    }));

    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err?.message });
  }
});

module.exports = router;
