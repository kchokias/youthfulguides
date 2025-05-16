const express = require("express");
const { pool } = require("../config/db");

const router = express.Router();

// Guide Profile Preview
router.get("/GuideProfile/:id", async (req, res) => {
  const guideId = req.params.id;

  if (!guideId) {
    return res.status(400).json({ message: "Missing guide ID" });
  }

  try {
    const connection = await pool.getConnection();

    const guideQuery = `
      SELECT 
        u.id AS guide_id,
        u.username,
        u.name,
        u.surname,
        u.country,
        u.region,
        u.description,
        p.photo_data AS profile_picture,
        IFNULL(AVG(b.rate), -1) AS average_rating
      FROM users u
      JOIN profile_photos p ON u.id = p.user_id
      LEFT JOIN bookings b ON u.id = b.guide_id
      WHERE u.id = ? AND u.role = 'guide'
      GROUP BY u.id
    `;
    const guideResult = await connection.query(guideQuery, [guideId]);

    const bookingCountResult = await connection.query(
      "SELECT COUNT(*) AS total_bookings FROM bookings WHERE guide_id = ?",
      [guideId]
    );

    const mediaResult = await connection.query(
      "SELECT id, media_data, created_at FROM media WHERE guide_id = ? ORDER BY created_at DESC LIMIT 7",
      [guideId]
    );

    connection.release();

    const guide =
      Array.isArray(guideResult) && guideResult.length > 0
        ? guideResult[0]
        : null;

    if (!guide) {
      return res.status(404).json({ message: "Guide not found" });
    }

    guide.total_bookings = bookingCountResult?.[0]?.total_bookings || 0;
    guide.media = Array.isArray(mediaResult) ? mediaResult : [];

    res.json(guide);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err?.message });
  }
});

module.exports = router;
