// Load environment variables from .env file
//require('dotenv').config();

const express = require("express");
const cors = require("cors"); // Import CORS
const mariadb = require("mariadb");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs"); // Use bcryptjs instead of bcrypt
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

// Database connection pool
const pool = mariadb.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  connectionLimit: 10,
  typeCast: function (field, next) {
    if (field.type === "BLOB") {
      return field.buffer(); // Ensure BLOBs are returned as Buffers
    }
    return next();
  },
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

  // Validate required fields
  if (!name || !surname || !username || !email || !password || !role) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields" });
  }

  try {
    const connection = await pool.getConnection();
    console.log("Database connection established for CreateNewUser");

    // Hash the password before storing using bcryptjs
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await connection.query(
      `INSERT INTO users (name, surname, username, email, password, role, region, country) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, surname, username, email, hashedPassword, role, region, country] // Store hashed password
    );

    connection.release();
    console.log(`New user created with ID: ${result.insertId}`);

    res.status(201).json({
      success: true,
      message: "User created successfully",
      userId: result.insertId,
    });
  } catch (err) {
    console.error("Error creating new user:", err);

    // Handle duplicate email error
    if (err.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ success: false, message: "Email already exists" });
    }

    res.status(500).json({ success: false, message: "Failed to create user" });
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

// Define the /api/User/GetAllBookings route
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

//Define post Media api for guide
app.post("/api/Guide/UploadMedia", authenticateToken, async (req, res) => {
  const { guideId, mediaData } = req.body;

  if (!guideId || !mediaData) {
    return res
      .status(400)
      .json({ success: false, message: "Missing required fields" });
  }

  try {
    const connection = await pool.getConnection();
    console.log(
      `Database connection established for UploadMedia for Guide ID: ${guideId}`
    );

    // Insert media into the database
    await connection.query(
      `INSERT INTO media (guide_id, media_data) VALUES (?, ?)`,
      [guideId, mediaData]
    );

    connection.release();
    console.log(`Media uploaded successfully for Guide ID: ${guideId}`);

    res
      .status(201)
      .json({ success: true, message: "Media uploaded successfully" });
  } catch (err) {
    console.error("Error uploading media:", err);
    res.status(500).json({ success: false, message: "Failed to upload media" });
  }
});

//Define Get all Media api for guide
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

    res.json({ success: true, data: result });
  } catch (err) {
    console.error("Error retrieving media:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to retrieve media" });
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
    const userId = req.user.userId;
    let { photoData } = req.body;

    if (!photoData) {
      return res
        .status(400)
        .json({ success: false, message: "No image provided" });
    }

    try {
      // Ensure Base64 data is clean
      const base64Data = photoData.split(",")[1]; // Extract actual Base64 content
      const imageBuffer = Buffer.from(base64Data, "base64");

      if (imageBuffer.length === 0) {
        throw new Error("Empty buffer detected");
      }

      const connection = await pool.getConnection();
      console.log(
        `Database connection established for UploadProfilePhoto for User ID: ${userId}`
      );

      // SQL query to insert or update profile photo
      const query = `
        INSERT INTO profile_photos (user_id, photo_data, created_at) 
        VALUES (?, ?, CURRENT_TIMESTAMP) 
        ON DUPLICATE KEY UPDATE photo_data = VALUES(photo_data), created_at = CURRENT_TIMESTAMP;
      `;

      await connection.query(query, [userId, imageBuffer]);

      console.log(`Profile photo saved/updated for User ID: ${userId}`);

      connection.release();

      res
        .status(201)
        .json({ success: true, message: "Profile photo saved successfully" });
    } catch (err) {
      console.error("Error uploading profile photo:", err);
      res.status(500).json({
        success: false,
        message: "Failed to upload profile photo",
        error: err.message,
      });
    }
  }
);

app.get("/api/User/GetProfilePhoto/:userId", async (req, res) => {
  const userId = req.params.userId;

  try {
    const connection = await pool.getConnection();
    console.log(`Fetching profile photo for User ID: ${userId}`);

    // Fetch all columns from the database
    const [rows] = await connection.query(
      `SELECT id, user_id, created_at, photo_data FROM profile_photos WHERE user_id = ?`,
      [userId]
    );

    console.log("✅ Full Database Response:", rows); // Log full database response
    connection.release();

    if (!rows || rows.length === 0) {
      console.warn(`No profile photo found for User ID: ${userId}`);
      return res.status(404).json({
        success: false,
        message: "No profile photo found for this user",
      });
    }

    const result = rows[0];
    console.log("✅ Full Row Data:", result);

    if (!result || !result.photo_data) {
      console.warn(`Photo data is undefined or NULL for User ID: ${userId}`);
      return res.status(500).json({
        success: false,
        message: "Profile photo exists but data is missing",
      });
    }

    // Ensure `photo_data` is a Buffer
    if (!Buffer.isBuffer(result.photo_data)) {
      console.error("❌ Retrieved data is not a Buffer:", result.photo_data);
      return res.status(500).json({
        success: false,
        message: "Corrupted image data",
      });
    }

    console.log(
      `✅ Successfully retrieved image. Buffer size: ${result.photo_data.length} bytes`
    );

    // Convert Buffer to Base64
    const base64Image = result.photo_data.toString("base64");

    // Construct Base64 string
    const imageType = "image/jpeg";
    const base64Response = `data:${imageType};base64,${base64Image}`;

    res.json({
      success: true,
      photoData: base64Response,
    });
  } catch (err) {
    console.error("❌ Error retrieving profile photo:", err);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve profile photo",
      error: err.message,
    });
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
