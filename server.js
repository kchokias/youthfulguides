// Load environment variables from .env file
//require('dotenv').config();

const express = require("express");
const cors = require("cors"); // Import CORS
const mariadb = require("mariadb");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs"); // Use bcryptjs instead of bcrypt
const moment = require("moment");
const app = express(); // Create an instance of Express
const allowedOrigins = ["http://localhost:4200", "https://youthfulguides.app"]; // Enable CORS with specific frontend origins
const bodyParser = require("body-parser");
app.use(bodyParser.json({ limit: "50mb" })); // Allow large Base64 uploads
//DB_URL=`1234`
//DB_URL=`4567`

//const dbUrl = env.("DB_URL")

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed for this domain"), false);
      }
    },
    credentials: true, // ✅ Allow cookies, auth headers
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // ✅ Allowed methods
    allowedHeaders: ["Content-Type", "Authorization"], // ✅ Allowed headers
  })
);

// Handle preflight requests properly
app.options("*", (req, res) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.sendStatus(200);
  }
  res.sendStatus(403); // If origin is not allowed
});

// Create a write stream for logging
const logFile = fs.createWriteStream(path.join(__dirname, "server.log"), {
  flags: "a",
});

// Redirect console.log and console.error to both console and log file
const originalLog = console.log;
console.log = function (message) {
  const logTimestamp = new Date().toISOString(); // Renamed 'timestamp' to 'logTimestamp'
  const logMessage = `${logTimestamp} - LOG: ${message}`;
  logFile.write(logMessage + "\n");
  originalLog(logMessage);
};

const originalError = console.error;
console.error = function (message) {
  const errorTimestamp = new Date().toISOString(); // Renamed 'timestamp' to 'errorTimestamp'
  const errorMessage = `${errorTimestamp} - ERROR: ${message}`;
  logFile.write(errorMessage + "\n");
  originalError(errorMessage);
};

//database connection pool
const pool = mariadb.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  connectionLimit: 10,
  supportBigNumbers: true,
  bigNumberStrings: true,
  multipleStatements: true,
});

// Test database connection
pool
  .getConnection()
  .then((conn) => {
    console.log("Connected to the database successfully!");
    conn.release();
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err);
  });

// Middleware to parse incoming requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, "public")));

// Define the /ping route for health checks
app.get("/ping", (req, res) => {
  console.log("Ping endpoint hit");
  res.send("Server is alive!");
});

const jwt = require("jsonwebtoken");

app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.sendStatus(200);
});

app.post("/api/User/Login", async (req, res) => {
  const { email, password } = req.body;

  console.log(`Login attempt with email: ${email}`);

  try {
    const connection = await pool.getConnection();
    console.log("Database connection established for Login");

    // Fetch user details (including the hashed password)
    const user = await connection.query(
      "SELECT id, username, email, role, password FROM users WHERE email = ?",
      [email]
    );

    connection.release();

    console.log("Query result:", user);

    if (user.length === 0) {
      console.log("Invalid credentials: No user found");
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    const userData = user[0];

    console.log("User found:", userData);

    // Compare provided password with hashed password
    const isMatch = await bcrypt.compare(password, userData.password);
    if (!isMatch) {
      console.log("Invalid credentials: Incorrect password");
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password" });
    }

    // Create a token
    const token = jwt.sign(
      {
        userId: userData.id,
        username: userData.username,
        role: userData.role,
      },
      process.env.JWT_SECRET || "default-secret", // Use a secure secret from your .env file
      { expiresIn: "150h" } // Token expires in 150 hours (TODO change back to 25h if needed)
    );

    console.log(
      `User logged in successfully, token generated for user ID: ${userData.id}`
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

// Middleware: Verify Admin Role
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next(); // Proceed if user is admin
  } else {
    res
      .status(403)
      .json({ success: false, message: "Access denied: Admins only" });
  }
};

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Extract token from the Authorization header

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Access token is missing" });
  }

  jwt.verify(token, process.env.JWT_SECRET || "default-secret", (err, user) => {
    if (err) {
      return res
        .status(403)
        .json({ success: false, message: "Invalid or expired token" });
    }
    req.user = user; // Attach user data to the request object
    next(); // Proceed to the next middleware or route handler
  });
};

// GetAllUsers (Protected sensitive API with admin access)
app.get(
  "/api/User/GetAllUsers",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const connection = await pool.getConnection();
      console.log("Database connection established for GetAllUsers");
      const users = await connection.query(
        "SELECT id, username, email, role, created_at FROM users"
      );
      connection.release();
      res.json({ success: true, data: users });
    } catch (err) {
      console.error("Error fetching users:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch users" });
    }
  }
);

app.get("/api/User/GetUserIdFromToken", authenticateToken, (req, res) => {
  try {
    // The authenticateToken middleware already decodes the token
    const { userId } = req.user; // Extract userId from the decoded token

    console.log(`User ID retrieved from token: ${userId}`);
    res.json({ success: true, userId });
  } catch (err) {
    console.error("Error retrieving user ID from token:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to retrieve user ID" });
  }
});

// Define the /api/User/GetUserByUserId route
app.get(
  "/api/User/GetUserByUserId/:id",
  authenticateToken,
  async (req, res) => {
    const userId = req.params.id;

    // Only allow users to access their own data OR admins
    if (req.user.userId !== parseInt(userId) && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    try {
      const connection = await pool.getConnection();
      console.log(
        `Database connection established for GetUserByUserId with ID: ${userId}`
      );

      // Fetch all user fields
      const user = await connection.query(
        `SELECT id, name, surname, username, email, role, region, country, created_at 
       FROM users WHERE id = ?`,
        [userId]
      );

      connection.release();

      if (user.length === 0) {
        console.log(`User with ID: ${userId} not found`);
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      console.log(`Fetched user:`, user[0]);
      res.json({ success: true, data: user[0] }); // Return all user data
    } catch (err) {
      console.error(`Error fetching user with ID: ${userId}`, err);
      res.status(500).json({ success: false, message: "Failed to fetch user" });
    }
  }
);

app.post("/api/User/CreateNewUser", async (req, res) => {
  const { name, surname, username, email, password, role, region, country } =
    req.body;

  if (!name || !surname || !username || !email || !password || !role) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields" });
  }

  const connection = await pool.getConnection();
  try {
    console.log("🟢 DB connected for CreateNewUser");

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert new user
    const result = await connection.query(
      `INSERT INTO users (name, surname, username, email, password, role, region, country) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, surname, username, email, hashedPassword, role, region, country]
    );

    const newUserId = result.insertId;
    console.log(`✅ User created with ID: ${newUserId}, role: ${role}`);

    // If role is guide, insert availability for 2025
    if (role.toLowerCase() === "guide") {
      console.log("📅 Inserting 2025 availability...");

      const values = [];
      const startDate = new Date("2025-01-01");

      for (let i = 0; i < 365; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const formatted = d.toISOString().split("T")[0]; // YYYY-MM-DD
        values.push([newUserId, formatted, "unavailable"]);
      }

      try {
        await connection.query(
          "INSERT IGNORE INTO guide_availability (guide_id, date, status) VALUES ?",
          [values]
        );
        console.log("✅ 2025 availability inserted for guide.");
      } catch (availabilityErr) {
        console.error(
          "❌ Error inserting guide availability:",
          availabilityErr.message,
          availabilityErr.stack
        );
      }
    }

    res.status(201).json({
      success: true,
      message: "User created successfully",
      userId: newUserId,
    });
  } catch (err) {
    console.error("❌ Error creating user:", err.message, err.stack);

    if (err.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ success: false, message: "Email already exists" });
    }

    res.status(500).json({ success: false, message: "Failed to create user" });
  } finally {
    connection.release();
  }
});

// Define the /api/User/UpdateUser route
app.put("/api/User/UpdateUser/:id", async (req, res) => {
  const userId = req.params.id;
  const { name, surname, password, region, country } = req.body; // Allowed updates

  try {
    const connection = await pool.getConnection();
    console.log(
      `Database connection established for UpdateUser with ID: ${userId}`
    );

    // Check if the user exists
    const userExists = await connection.query(
      "SELECT id FROM users WHERE id = ?",
      [userId]
    );
    if (userExists.length === 0) {
      connection.release();
      console.log(`User with ID: ${userId} not found`);
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Prepare fields for update (only update provided values)
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
      console.log(`Hashing password for user ID: ${userId}`);
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.push("password = ?");
      values.push(hashedPassword);
    }

    // If no fields to update, return an error
    if (updateFields.length === 0) {
      connection.release();
      return res
        .status(400)
        .json({ success: false, message: "No fields provided for update" });
    }

    // Build the query dynamically
    const query = `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`;
    values.push(userId);

    // Execute the update query
    const result = await connection.query(query, values);
    connection.release();

    if (result.affectedRows === 0) {
      console.log(`User with ID: ${userId} not found`);
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    console.log(`User with ID: ${userId} updated successfully`);
    res.json({ success: true, message: "User updated successfully" });
  } catch (err) {
    console.error(`Error updating user with ID: ${userId}`, err);
    res.status(500).json({ success: false, message: "Failed to update user" });
  }
});

// Define the /api/User/DeleteUserById route
app.delete("/api/User/DeleteUserById/:id", async (req, res) => {
  const userId = req.params.id;
  try {
    const connection = await pool.getConnection();
    console.log(
      `Database connection established for DeleteUserById with ID: ${userId}`
    );
    const result = await connection.query("DELETE FROM users WHERE id = ?", [
      userId,
    ]);
    connection.release();
    if (result.affectedRows === 0) {
      console.log(`User with ID: ${userId} not found`);
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    console.log(`User with ID: ${userId} deleted successfully`);
    res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    console.error(`Error deleting user with ID: ${userId}`, err);
    res.status(500).json({ success: false, message: "Failed to delete user" });
  }
});

//Availablity API
//
//
//

app.post("/api/Availability/Update", async (req, res) => {
  const { guide_id, start_date, end_date, status } = req.body;

  // Validate input
  if (!guide_id || !start_date || !end_date || !status) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  const validStatuses = ["available", "unavailable", "booked"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status" });
  }

  try {
    const connection = await pool.getConnection();

    const start = moment(start_date);
    const end = moment(end_date);
    if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid date range" });
    }

    const values = [];
    while (start.isSameOrBefore(end)) {
      values.push([guide_id, start.format("YYYY-MM-DD"), status]);
      start.add(1, "day");
    }

    // Batch insert with ON DUPLICATE KEY UPDATE
    await connection.query(
      `
      INSERT INTO guide_availability (guide_id, date, status)
      VALUES ?
      ON DUPLICATE KEY UPDATE status = VALUES(status)
      `,
      [values]
    );

    connection.release();
    res.status(200).json({
      success: true,
      message: "Availability updated successfully",
      daysUpdated: values.length,
    });
  } catch (err) {
    console.error("Error updating availability:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/api/Availability/Available/:guide_id", async (req, res) => {
  const guideId = req.params.guide_id;

  if (!guideId) {
    return res
      .status(400)
      .json({ success: false, message: "Guide ID is required" });
  }

  try {
    const connection = await pool.getConnection();

    const [rows] = await connection.query(
      "SELECT date FROM guide_availability WHERE guide_id = ? AND status = 'available' ORDER BY date ASC",
      [guideId]
    );

    connection.release();

    res.status(200).json({
      success: true,
      availableDates: rows.map((row) => row.date),
    });
  } catch (err) {
    console.error("Error fetching available dates:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Define the /api/User/GetAllBookings route
//
//
//

app.get("/api/User/GetAllBookings", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    console.log("Database connection established for GetAllBookings");
    const bookings = await connection.query(
      `SELECT b.id, b.guide_id, b.visitor_id, b.rate, b.review, b.created_at,
              g.username AS guide_username, v.username AS visitor_username
       FROM bookings b
       JOIN users g ON b.guide_id = g.id
       JOIN users v ON b.visitor_id = v.id`
    );
    connection.release();
    console.log("Fetched bookings:", bookings);
    res.json({ success: true, data: bookings });
  } catch (err) {
    console.error("Error fetching bookings:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch bookings" });
  }
});

// Define the /api/User/CreateNewBooking route
app.post("/api/User/CreateNewBooking", async (req, res) => {
  const { guide_id, visitor_id, rate, review } = req.body;

  // Validate input
  if (!guide_id || !visitor_id || rate < 1 || rate > 10) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid input data" });
  }

  try {
    const connection = await pool.getConnection();
    console.log("Database connection established for CreateNewBooking");

    // Ensure guide_id has role 'guide' and visitor_id has role 'visitor'
    const guide = await connection.query(
      "SELECT role FROM users WHERE id = ? AND role = ?",
      [guide_id, "guide"]
    );
    const visitor = await connection.query(
      "SELECT role FROM users WHERE id = ? AND role = ?",
      [visitor_id, "visitor"]
    );

    if (!guide.length || !visitor.length) {
      connection.release();
      return res
        .status(400)
        .json({ success: false, message: "Invalid guide or visitor ID" });
    }

    const result = await connection.query(
      "INSERT INTO bookings (guide_id, visitor_id, rate, review) VALUES (?, ?, ?, ?)",
      [guide_id, visitor_id, rate, review]
    );
    connection.release();
    console.log(`New booking created with ID: ${result.insertId}`);
    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      bookingId: result.insertId,
    });
  } catch (err) {
    console.error("Error creating booking:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to create booking" });
  }
});

// Define the /api/User/UpdateBooking route
app.put("/api/User/UpdateBooking/:id", async (req, res) => {
  const bookingId = req.params.id;
  const { rate, review } = req.body;

  // Validate input
  if (rate < 1 || rate > 10 || !review) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid input data" });
  }

  try {
    const connection = await pool.getConnection();
    console.log(
      `Database connection established for UpdateBooking with ID: ${bookingId}`
    );

    const result = await connection.query(
      "UPDATE bookings SET rate = ?, review = ? WHERE id = ?",
      [rate, review, bookingId]
    );
    connection.release();

    if (result.affectedRows === 0) {
      console.log(`Booking with ID: ${bookingId} not found`);
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    console.log(`Booking with ID: ${bookingId} updated successfully`);
    res.json({ success: true, message: "Booking updated successfully" });
  } catch (err) {
    console.error(`Error updating booking with ID: ${bookingId}`, err);
    res
      .status(500)
      .json({ success: false, message: "Failed to update booking" });
  }
});

// Define POST Media API for Guide (Multiple Media Upload)
app.post("/api/Guide/UploadMedia", authenticateToken, async (req, res) => {
  const { guideId, mediaData } = req.body; // Expecting an array of mediaData

  if (!guideId || !Array.isArray(mediaData) || mediaData.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields or empty media array",
    });
  }

  try {
    const connection = await pool.getConnection();
    console.log(
      `✅ Database connection established for UploadMedia for Guide ID: ${guideId}`
    );

    // 🔍 Ensure each entry is a valid Base64 string and NOT an object
    const processedMedia = mediaData
      .map((media, index) => {
        if (typeof media !== "string" || !media.startsWith("data:image/")) {
          console.warn(`⚠️ Invalid media format at index ${index}:`, media);
          return null; // Filter out invalid entries
        }
        return media;
      })
      .filter(Boolean); // Remove null entries

    if (processedMedia.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid images provided",
      });
    }

    // Generate placeholders for each (guide_id, media_data) pair
    const placeholders = processedMedia.map(() => "(?, ?)").join(", ");

    // Flatten values for bulk insert
    const values = processedMedia.flatMap((media) => [guideId, media]);

    // ✅ Start transaction
    await connection.query("START TRANSACTION");

    // ✅ Insert media
    const insertQuery = `INSERT INTO media (guide_id, media_data) VALUES ${placeholders}`;
    await connection.query(insertQuery, values);

    // ✅ Commit transaction
    await connection.query("COMMIT");

    connection.release();
    console.log(`✅ Media uploaded successfully for Guide ID: ${guideId}`);

    return res.status(201).json({
      success: true,
      message: "Media uploaded successfully",
      uploadedCount: processedMedia.length,
    });
  } catch (err) {
    console.error("❌ Error uploading media:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to upload media",
      error: err.message,
    });
  }
});

// Define Get All Media API for Guide
app.get("/api/Guide/GetAllMedia/:guideId", async (req, res) => {
  const guideId = req.params.guideId;

  try {
    const connection = await pool.getConnection();
    console.log(
      `Database connection established for GetAllMedia for Guide ID: ${guideId}`
    );

    // Fetch all media related to the guide
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

    // Convert Buffer data to Base64 format
    const formattedMedia = result.map((media) => ({
      id: media.id,
      created_at: media.created_at,
      media_data: Buffer.isBuffer(media.media_data)
        ? `data:image/jpeg;base64,${media.media_data.toString("base64")}`
        : media.media_data, // If already Base64, return as is
    }));

    res.json({ success: true, data: formattedMedia });
  } catch (err) {
    console.error("❌ Error retrieving media:", err);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve media",
      error: err.message,
    });
  }
});

app.delete(
  "/api/Guide/DeleteMedia/:mediaId",
  authenticateToken,
  async (req, res) => {
    const userId = req.user.userId; // Extract user ID from token
    const mediaId = req.params.mediaId; // Get media ID from request params

    try {
      const connection = await pool.getConnection();
      console.log(
        `Database connection established for DeleteMedia with Media ID: ${mediaId}`
      );

      // Check if the media exists and belongs to the logged-in user
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

      // Ensure the logged-in user is the owner of the media
      if (media[0].guide_id !== userId) {
        connection.release();
        return res.status(403).json({
          success: false,
          message: "Access denied: You can only delete your own media",
        });
      }

      // Delete the media
      const result = await connection.query(`DELETE FROM media WHERE id = ?`, [
        mediaId,
      ]);

      connection.release();

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Failed to delete media" });
      }

      console.log(`Media deleted successfully with ID: ${mediaId}`);
      res.json({ success: true, message: "Media deleted successfully" });
    } catch (err) {
      console.error("Error deleting media:", err);
      res
        .status(500)
        .json({ success: false, message: "Failed to delete media" });
    }
  }
);

app.post(
  "/api/User/UploadProfilePhoto",
  authenticateToken,
  async (req, res) => {
    const userId = req.user.userId; // Extract user ID from the token
    const { photoData } = req.body; // Base64-encoded image

    if (!photoData) {
      return res
        .status(400)
        .json({ success: false, message: "No image provided" });
    }

    try {
      const connection = await pool.getConnection();
      console.log(
        `Database connection established for UploadProfilePhoto for User ID: ${userId}`
      );

      // Check if user already has a profile photo
      const existingPhoto = await connection.query(
        `SELECT id FROM profile_photos WHERE user_id = ?`,
        [userId]
      );

      if (existingPhoto.length > 0) {
        // Update existing profile photo
        await connection.query(
          `UPDATE profile_photos SET photo_data = ?, created_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
          [photoData, userId]
        );
        console.log(`Profile photo updated for User ID: ${userId}`);
      } else {
        // Insert new profile photo
        await connection.query(
          `INSERT INTO profile_photos (user_id, photo_data) VALUES (?, ?)`,
          [userId, photoData]
        );
        console.log(`Profile photo uploaded for User ID: ${userId}`);
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
  }
);

app.get("/api/User/GetProfilePhoto/:userId", async (req, res) => {
  const userId = req.params.userId;

  try {
    const connection = await pool.getConnection();
    console.log(
      `Database connection established for GetProfilePhoto for User ID: ${userId}`
    );

    // Fetch the user's profile photo
    const result = await connection.query(
      `SELECT photo_data FROM profile_photos WHERE user_id = ?`,
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

// Define a basic route
app.get("/", (req, res) => {
  res.send("Welcome to YouthfulGuides.app!");
});

// Catch-all route for undefined endpoints
app.use((req, res, next) => {
  console.log(`404 Error - Requested URL: ${req.originalUrl}`);
  res.status(404).send("Sorry, the requested resource was not found.");
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something went wrong! Please try again later.");
});

// Save the day from favicon error 500
app.get("/favicon.ico", (req, res) => res.status(204).end());

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://youthfulguides.app:${PORT}`);
});

//Container {
//  Handlers
//  Repositories
//  Services
// Clients
//}
