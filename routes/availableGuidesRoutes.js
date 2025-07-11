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
  let { start, end, country, skip, take } = req.query;

  if (!start || !end || !country) {
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

    if (country !== "all") {
      baseFilter += " AND u.country = ?";
      mainParams.push(country);
      countParams.push(country);
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
    let reviewCounts = {};

    if (guideIds.length > 0) {
      const placeholders = guideIds.map(() => "?").join(",");
      const rows = await connection.query(
        `SELECT guide_id, COUNT(rate) AS total_reviews
         FROM bookings
         WHERE guide_id IN (${placeholders}) AND rate IS NOT NULL
         GROUP BY guide_id`,
        guideIds
      );
      reviewCounts = Object.fromEntries(
        rows.map((r) => [r.guide_id, r.total_reviews])
      );
    }

    connection.release();

    const guidesWithCounts = guides.map((g) => ({
      ...g,
      total_reviews: reviewCounts[g.guide_id] || 0,
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
