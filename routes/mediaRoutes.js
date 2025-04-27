const express = require("express");
const { pool } = require("../config/db");
const { authenticateToken } = require("../middlewares/authMiddleware");

const router = express.Router();

// Upload Media for Guide
router.post("/UploadMedia", authenticateToken, async (req, res) => {
  const { guideId, mediaData } = req.body;

  if (!guideId || !Array.isArray(mediaData) || mediaData.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields or empty media array",
    });
  }

  try {
    const connection = await pool.getConnection();

    const processedMedia = mediaData
      .map((media) => {
        if (typeof media !== "string" || !media.startsWith("data:image/")) {
          return null;
        }
        return media;
      })
      .filter(Boolean);

    if (processedMedia.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid images provided",
      });
    }

    const placeholders = processedMedia.map(() => "(?, ?)").join(", ");
    const values = processedMedia.flatMap((media) => [guideId, media]);

    await connection.query("START TRANSACTION");

    const insertQuery = `INSERT INTO media (guide_id, media_data) VALUES ${placeholders}`;
    await connection.query(insertQuery, values);

    await connection.query("COMMIT");

    connection.release();

    return res.status(201).json({
      success: true,
      message: "Media uploaded successfully",
      uploadedCount: processedMedia.length,
    });
  } catch (err) {
    console.error("Error uploading media:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to upload media",
      error: err.message,
    });
  }
});

// Get All Media for Guide
router.get("/GetAllMedia/:guideId", async (req, res) => {
  const guideId = req.params.guideId;

  try {
    const connection = await pool.getConnection();

    const result = await connection.query(
      `SELECT id, media_data, created_at FROM media WHERE guide_id = ? ORDER BY created_at DESC`,
      [guideId]
    );

    connection.release();

    if (result.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No media found for this guide" });
    }

    const formattedMedia = result.map((media) => ({
      id: media.id,
      created_at: media.created_at,
      media_data: Buffer.isBuffer(media.media_data)
        ? `data:image/jpeg;base64,${media.media_data.toString("base64")}`
        : media.media_data,
    }));

    res.json({ success: true, data: formattedMedia });
  } catch (err) {
    console.error("Error retrieving media:", err);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve media",
      error: err.message,
    });
  }
});

// Delete Media for Guide
router.delete("/DeleteMedia/:mediaId", authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const mediaId = req.params.mediaId;

  try {
    const connection = await pool.getConnection();

    const media = await connection.query(
      `SELECT guide_id FROM media WHERE id = ?`,
      [mediaId]
    );

    if (media.length === 0) {
      connection.release();
      return res
        .status(404)
        .json({ success: false, message: "Media not found" });
    }

    if (media[0].guide_id !== userId) {
      connection.release();
      return res.status(403).json({
        success: false,
        message: "Access denied: You can only delete your own media",
      });
    }

    const result = await connection.query(`DELETE FROM media WHERE id = ?`, [
      mediaId,
    ]);

    connection.release();

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Failed to delete media" });
    }

    res.json({ success: true, message: "Media deleted successfully" });
  } catch (err) {
    console.error("Error deleting media:", err);
    res.status(500).json({ success: false, message: "Failed to delete media" });
  }
});

module.exports = router;
