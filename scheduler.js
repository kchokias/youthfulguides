const cron = require("node-cron");
const moment = require("moment");
const { pool } = require("./config/db");

async function runDailyScheduler() {
  const today = moment().format("YYYY-MM-DD");
  const connection = await pool.getConnection();

  try {
    const bookingUpdate = await connection.query(
      `UPDATE bookings 
       SET status = 'completed' 
       WHERE status = 'confirmed' AND booked_date < ?`,
      [today]
    );

    const availabilityUpdate = await connection.query(
      `UPDATE guide_availability 
       SET status = 'unavailable' 
       WHERE status = 'available' AND date < ?`,
      [today]
    );

    console.log(`[Scheduler] Ran for ${today}`);
    console.log(`[Scheduler] Bookings updated: ${bookingUpdate.affectedRows}`);
    console.log(
      `[Scheduler] Availability updated: ${availabilityUpdate.affectedRows}`
    );
  } catch (err) {
    console.error("[Scheduler] Error:", err.message);
  } finally {
    connection.release();
  }
}

// This schedules it daily at 01:00 (still useful)
cron.schedule("0 1 * * *", runDailyScheduler);

// Export the function for manual run
module.exports = runDailyScheduler;
