const express = require("express");
const moment = require("moment");
const { pool } = require("../config/db");

const router = express.Router();

// Update Guide Availability
router.post("/Update", async (req, res) => {
  const { guide_id, start_date, end_date, status } = req.body;

  if (!guide_id || !start_date || !end_date || !status) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  const validStatuses = ["available", "unavailable", "booked"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status" });
  }

  const start = moment(start_date, "DD.MM.YYYY", true);
  const end = moment(end_date, "DD.MM.YYYY", true);

  if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
    return res.status(400).json({
      success: false,
      message: "Invalid date range (use format DD.MM.YYYY)",
    });
  }

  const connection = await pool.getConnection();

  try {
    const bookedRows = await connection.query(
      `SELECT date FROM guide_availability
       WHERE guide_id = ? AND status = 'booked'
       AND date BETWEEN ? AND ?`,
      [guide_id, start.format("YYYY-MM-DD"), end.format("YYYY-MM-DD")]
    );

    if (bookedRows.length > 0) {
      const bookedDates = bookedRows.map((row) =>
        moment(row.date).format("DD.MM.YYYY")
      );

      return res.status(409).json({
        success: false,
        message: "Some dates are already booked and cannot be updated.",
        bookedDates,
      });
    }

    const values = [];
    let current = moment(start);

    while (current.isSameOrBefore(end)) {
      values.push([guide_id, current.format("YYYY-MM-DD"), status]);
      current.add(1, "day");
    }

    const placeholders = values.map(() => "(?, ?, ?)").join(", ");
    const flatValues = values.flat();

    const sql = `
      INSERT INTO guide_availability (guide_id, date, status)
      VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE status = VALUES(status)
    `;

    await connection.query(sql, flatValues);

    res.status(200).json({
      success: true,
      message: "Availability updated successfully",
      daysUpdated: values.length,
    });
  } catch (err) {
    console.error("Error updating availability:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message || "Unknown error",
    });
  } finally {
    connection.release();
  }
});

// Get Guide Availability
router.get("/Guide/:guide_id", async (req, res) => {
  const guideId = req.params.guide_id;

  if (!guideId) {
    return res.status(400).json({
      success: false,
      message: "Guide ID is required",
    });
  }

  try {
    const connection = await pool.getConnection();

    const rows = await connection.query(
      `SELECT date, status
       FROM guide_availability
       WHERE guide_id = ? AND status IN ('available', 'booked')
       ORDER BY date ASC`,
      [guideId]
    );

    connection.release();

    const availableDates = [];
    const bookedDates = [];

    rows.forEach((row) => {
      if (row.status === "available")
        availableDates.push(moment(row.date).format("DD.MM.YYYY"));
      else if (row.status === "booked")
        bookedDates.push(moment(row.date).format("DD.MM.YYYY"));
    });

    res.status(200).json({
      success: true,
      availableDates,
      bookedDates,
    });
  } catch (err) {
    console.error("Error fetching guide availability:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message || "Unknown error",
    });
  }
});

module.exports = router;
