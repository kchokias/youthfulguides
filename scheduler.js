const cron = require("node-cron");
const moment = require("moment");
const { pool } = require("./config/db");

// Run every day at 01:00 AM server time
cron.schedule("0 1 * * *", async () => {
  const today = moment().format("YYYY-MM-DD");
  const connection = await pool.getConnection();

  try {
    // ✅ Step 1: Mark confirmed bookings in the past as completed
    const bookingUpdate = await connection.query(
      `UPDATE bookings 
       SET status = 'completed' 
       WHERE status = 'confirmed' AND booked_date < ?`,
      [today]
    );

    // ✅ Step 2: Mark past available guide dates as unavailable
    const availabilityUpdate = await connection.query(
      `UPDATE guide_availability 
       SET status = 'unavailable' 
       WHERE status = 'available' AND date < ?`,
      [today]
    );

    console.log(`[Scheduler] Status update ran for ${today}`);
    console.log(`[Scheduler] Bookings updated: ${bookingUpdate.affectedRows}`);
    console.log(
      `[Scheduler] Availability updated: ${availabilityUpdate.affectedRows}`
    );
  } catch (err) {
    console.error("[Scheduler] Error during scheduled task:", err.message);
  } finally {
    connection.release();
  }
});
