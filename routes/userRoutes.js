const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const moment = require("moment");
const { pool } = require("../config/db");
const { transporter } = require("../config/mailer");
const { authenticateToken, isAdmin } = require("../middlewares/authMiddleware");

const router = express.Router();

// Login
router.post("/Login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const connection = await pool.getConnection();
    const user = await connection.query(
      "SELECT id, username, email, role, password FROM users WHERE email = ?",
      [email]
    );
    connection.release();

    if (user.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    const userData = user[0];
    const isMatch = await bcrypt.compare(password, userData.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    const token = jwt.sign(
      {
        userId: userData.id,
        username: userData.username,
        role: userData.role,
      },
      process.env.JWT_SECRET || "default-secret",
      { expiresIn: "150h" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: userData.id,
        username: userData.username,
        role: userData.role,
      },
    });
  } catch (err) {
    console.error("Error during login:", err);
    res.status(500).json({ success: false, message: "Failed to login" });
  }
});

// Get User ID from Token
router.get("/GetUserIdFromToken", authenticateToken, (req, res) => {
  try {
    const { userId } = req.user;
    res.json({ success: true, userId });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Failed to retrieve user ID" });
  }
});

// Create New User
router.post("/CreateNewUser", async (req, res) => {
  const { name, surname, username, email, password, role, region, country } =
    req.body;
  if (!name || !surname || !username || !email || !password || !role) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields" });
  }

  const connection = await pool.getConnection();
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await connection.query(
      `INSERT INTO users (name, surname, username, email, password, role, region, country)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        surname,
        username,
        email,
        hashedPassword,
        role,
        region || null,
        country || null,
      ]
    );

    const newUserId = result.insertId;

    if (role.toLowerCase() === "guide") {
      const values = [];
      let date = moment("2025-01-01");

      while (date.isSameOrBefore("2025-12-31")) {
        values.push([newUserId, date.format("YYYY-MM-DD"), "unavailable"]);
        date.add(1, "day");
      }

      const placeholders = values.map(() => "(?, ?, ?)").join(", ");
      const flatValues = values.flat();

      const sql = `INSERT IGNORE INTO guide_availability (guide_id, date, status) VALUES ${placeholders}`;
      await connection.query(sql, flatValues);
    }

    res.status(201).json({
      success: true,
      message: "User created successfully",
      userId: newUserId,
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ success: false, message: "Email already exists" });
    }
    res.status(500).json({
      success: false,
      message: "Failed to create user",
      error: err.message,
    });
  } finally {
    connection.release();
  }
});
// Get User By User ID
router.get("/GetUserByUserId/:id", async (req, res) => {
  const userId = req.params.id;

  try {
    const connection = await pool.getConnection();
    const user = await connection.query(
      `SELECT id, name, surname, username, email, role, region, country, created_at 
       FROM users WHERE id = ?`,
      [userId]
    );
    connection.release();

    if (user.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({ success: true, data: user[0] });
  } catch (err) {
    console.error(`Error fetching user with ID: ${userId}`, err);
    res.status(500).json({ success: false, message: "Failed to fetch user" });
  }
});

// Update User
router.put("/UpdateUser/:id", async (req, res) => {
  const userId = req.params.id;
  const { name, surname, password, region, country } = req.body;
  try {
    const connection = await pool.getConnection();

    const userExists = await connection.query(
      "SELECT id FROM users WHERE id = ?",
      [userId]
    );
    if (userExists.length === 0) {
      connection.release();
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    let updateFields = [];
    let values = [];

    if (name) {
      updateFields.push("name = ?");
      values.push(name);
    }
    if (surname) {
      updateFields.push("surname = ?");
      values.push(surname);
    }
    if (region) {
      updateFields.push("region = ?");
      values.push(region);
    }
    if (country) {
      updateFields.push("country = ?");
      values.push(country);
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.push("password = ?");
      values.push(hashedPassword);
    }

    if (updateFields.length === 0) {
      connection.release();
      return res
        .status(400)
        .json({ success: false, message: "No fields provided for update" });
    }

    const query = `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`;
    values.push(userId);

    const result = await connection.query(query, values);
    connection.release();

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({ success: true, message: "User updated successfully" });
  } catch (err) {
    console.error(`Error updating user with ID: ${userId}`, err);
    res.status(500).json({ success: false, message: "Failed to update user" });
  }
});

// Delete User
router.delete("/DeleteUserById/:id", async (req, res) => {
  const userId = req.params.id;
  try {
    const connection = await pool.getConnection();
    const result = await connection.query("DELETE FROM users WHERE id = ?", [
      userId,
    ]);
    connection.release();
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    console.error(`Error deleting user with ID: ${userId}`, err);
    res.status(500).json({ success: false, message: "Failed to delete user" });
  }
});

// Forgot Password
router.post("/ForgotPassword", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "Email is required" });
  }
  try {
    const connection = await pool.getConnection();
    const result = await connection.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );
    if (!result || result.length === 0) {
      connection.release();
      return res.status(200).json({
        success: true,
        message: "If this email exists, a reset link will be sent.",
      });
    }
    const userId = result[0].id;
    const token = crypto.randomBytes(32).toString("hex");
    await connection.query(
      "INSERT INTO password_resets (user_id, token) VALUES (?, ?)",
      [userId, token]
    );
    connection.release();

    const resetLink = `https://youthfulguides.app/#/reset-password/${token}`;
    const mailOptions = {
      from: `"Youthful Guides" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Reset Your Password",
      html: `
        <h3>Hello</h3>
        <p>We received a request to reset your password.</p>
        <p><a href="${resetLink}">Click here to reset it</a></p>
        <p>If you didn’t request this, just ignore this email.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({
      success: true,
      message: "If this email exists, a reset link has been sent.",
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Reset Password
router.post("/ResetPassword", async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res
      .status(400)
      .json({ success: false, message: "Token and new password are required" });
  }
  try {
    const connection = await pool.getConnection();
    const result = await connection.query(
      "SELECT user_id, created_at FROM password_resets WHERE token = ?",
      [token]
    );
    if (!result || result.length === 0) {
      connection.release();
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired token" });
    }
    const { user_id, created_at } = result[0];
    const now = new Date();
    const created = new Date(created_at);
    const diff = now - created;
    if (diff > 3600000) {
      await connection.query("DELETE FROM password_resets WHERE token = ?", [
        token,
      ]);
      connection.release();
      return res
        .status(400)
        .json({ success: false, message: "Token has expired" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await connection.query("UPDATE users SET password = ? WHERE id = ?", [
      hashedPassword,
      user_id,
    ]);
    await connection.query("DELETE FROM password_resets WHERE token = ?", [
      token,
    ]);
    connection.release();

    res
      .status(200)
      .json({ success: true, message: "Password has been reset successfully" });
  } catch (err) {
    console.error("ResetPassword error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Upload Profile Photo
router.post("/UploadProfilePhoto", authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { photoData } = req.body;
  if (!photoData) {
    return res
      .status(400)
      .json({ success: false, message: "No image provided" });
  }
  try {
    const connection = await pool.getConnection();
    const existingPhoto = await connection.query(
      "SELECT id FROM profile_photos WHERE user_id = ?",
      [userId]
    );

    if (existingPhoto.length > 0) {
      await connection.query(
        "UPDATE profile_photos SET photo_data = ?, created_at = CURRENT_TIMESTAMP WHERE user_id = ?",
        [photoData, userId]
      );
    } else {
      await connection.query(
        "INSERT INTO profile_photos (user_id, photo_data) VALUES (?, ?)",
        [userId, photoData]
      );
    }

    connection.release();
    res
      .status(201)
      .json({ success: true, message: "Profile photo saved successfully" });
  } catch (err) {
    console.error("Error uploading profile photo:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to upload profile photo" });
  }
});

// Get Profile Photo
router.get("/GetProfilePhoto/:userId", async (req, res) => {
  const userId = req.params.userId;
  try {
    const connection = await pool.getConnection();
    const result = await connection.query(
      "SELECT photo_data FROM profile_photos WHERE user_id = ?",
      [userId]
    );
    connection.release();

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No profile photo found for this user",
      });
    }

    res.json({ success: true, photoData: result[0].photo_data });
  } catch (err) {
    console.error("Error retrieving profile photo:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to retrieve profile photo" });
  }
});

module.exports = router;
