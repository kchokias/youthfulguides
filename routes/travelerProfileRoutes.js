const express = require("express");
const { pool } = require("../config/db");

const router = express.Router();

// Traveler Profile Preview
router.get("/TravelerProfile/:id", async (req, res) => {
  const travelerId = req.params.id;

  if (!travelerId) {
    return res.status(400).json({ message: "Missing traveler ID" });
  }

  try {
    const connection = await pool.getConnection();

    const travelerQuery = `
      SELECT 
        u.id AS traveler_id,
        u.role,
        u.username,
        u.name,
        u.surname,
        u.email,
        u.country,
        u.region,
        p.photo_data AS profile_picture
      FROM users u
      LEFT JOIN profile_photos p ON u.id = p.user_id
      WHERE u.id = ? AND u.role = 'visitor'
    `;

    const travelerResult = await connection.query(travelerQuery, [travelerId]);

    connection.release();

    if (!Array.isArray(travelerResult) || travelerResult.length === 0) {
      return res.status(404).json({ message: "Traveler not found" });
    }

    res.json(travelerResult[0]);
  } catch (err) {
    console.error("TravelerProfile error:", err);
    res.status(500).json({ message: "Server error", error: err?.message });
  }
});

module.exports = router;
