const express = require("express");
const { pool } = require("../config/db");
const moment = require("moment");

const router = express.Router();

// Convert DD.MM.YYYY ➔ YYYY-MM-DD
function convertToSqlDate(input) {
  const [day, month, year] = input.split(".");
  return `${year}-${month}-${day}`;
}

// Find Available Guides
router.get("/", async (req, res) => {
  let { start, end, region, skip, take } = req.query;

  if (!start || !end || !region) {
    return res.status(400).json({ message: "Missing parameters" });
  }

  try {
    const parsedStart = convertToSqlDate(start);
    const parsedEnd = convertToSqlDate(end);
    take = parseInt(take) || 10;
    skip = parseInt(skip) || 0;

    const mainParams = [parsedStart, parsedEnd];
    const countParams = [parsedStart, parsedEnd];

    let baseFilter = `
      FROM users u
      LEFT JOIN profile_photos p ON u.id = p.user_id
      LEFT JOIN bookings b ON u.id = b.guide_id
      WHERE u.role = 'guide'
        AND u.id IN (
          SELECT DISTINCT a.guide_id
          FROM guide_availability a
          WHERE a.status = 'available' AND a.date BETWEEN ? AND ?
        )
    `;

    if (region !== "all") {
      baseFilter += " AND u.region = ?";
      mainParams.push(region);
      countParams.push(region);
    }

    const sql = `
      SELECT 
        u.id AS guide_id,
        u.username,
        u.name,
        u.surname,
        u.country,
        u.region,
        p.photo_data AS profile_picture,
        IFNULL(AVG(b.rate), -1) AS average_rating
      ${baseFilter}
      GROUP BY u.id
      LIMIT ? OFFSET ?
    `;
    mainParams.push(take, skip);

    const countSql = `
      SELECT COUNT(DISTINCT u.id) AS total
      ${baseFilter}
    `;

    const connection = await pool.getConnection();

    const guides = await connection.query(sql, mainParams);
    const countResult = await connection.query(countSql, countParams);
    const total = countResult[0]?.total || 0;

    const guideIds = guides.map((g) => g.guide_id);
    let bookingCounts = {};

    if (guideIds.length > 0) {
      const placeholders = guideIds.map(() => "?").join(",");
      const rows = await connection.query(
        `SELECT guide_id, COUNT(*) AS total_bookings
         FROM bookings
         WHERE guide_id IN (${placeholders})
         GROUP BY guide_id`,
        guideIds
      );
      bookingCounts = Object.fromEntries(
        rows.map((r) => [r.guide_id, r.total_bookings])
      );
    }

    connection.release();

    const guidesWithCounts = guides.map((g) => ({
      ...g,
      total_bookings: bookingCounts[g.guide_id] || 0,
    }));

    res.json({
      total_available_guides: total,
      guides: guidesWithCounts,
    });
  } catch (err) {
    console.error("AvailableGuides Error:", err.stack || err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
