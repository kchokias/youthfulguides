const express = require("express");
const { pool } = require("../config/db");

const router = express.Router();

// Get all reviews for a guide
router.get("/GuideReviews/:guideId", async (req, res) => {
  const guideId = req.params.guideId;

  if (!guideId) {
    return res.status(400).json({ message: "Missing guide ID" });
  }

  try {
    const connection = await pool.getConnection();

    const reviewsQuery = `
      SELECT 
        b.traveler_id AS user_id,
        u.username,
        b.rate,
        b.review AS comment,
        b.date_reviewed AS reviewed_at
      FROM bookings b
      JOIN users u ON b.traveler_id = u.id
      WHERE b.guide_id = ?
        AND (b.status = 'completed' OR b.status = 'reviewed')
        AND b.rate IS NOT NULL
      ORDER BY b.date_reviewed DESC
    `;

    const reviews = await connection.query(reviewsQuery, [guideId]);

    connection.release();

    res.json({
      guide_id: guideId,
      reviews: reviews,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err?.message });
  }
});

module.exports = router;
