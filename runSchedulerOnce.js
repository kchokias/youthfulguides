const { pool } = require("./config/db");
const moment = require("moment");

(async () => {
  try {
    const connection = await pool.getConnection();

    // 1️⃣ Update past confirmed bookings to completed
    const updateBookings = await connection.query(
      `UPDATE bookings 
       SET status = 'completed'
       WHERE status = 'confirmed' AND booked_date < CURDATE()`
    );

    // 2️⃣ Update past available dates to unavailable
    const updateAvailability = await connection.query(
      `UPDATE guide_availability 
       SET status = 'unavailable'
       WHERE status = 'available' AND date < CURDATE()`
    );

    console.log("✅ Bookings updated:", updateBookings.affectedRows);
    console.log("✅ Availability updated:", updateAvailability.affectedRows);

    connection.release();
  } catch (err) {
    console.error("❌ Error running scheduler manually:", err.message);
  } finally {
    process.exit(); // Clean exit
  }
})();
