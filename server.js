// Load environment variables from .env file
require('dotenv').config();

// Import required packages
const express = require('express');
const mariadb = require('mariadb');
const path = require('path');
const fs = require('fs');

// Create a write stream for logging
const logFile = fs.createWriteStream(path.join(__dirname, 'server.log'), { flags: 'a' });

// Redirect console.log and console.error to both console and log file
const originalLog = console.log;
console.log = function (message) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - LOG: ${message}`;
  logFile.write(logMessage + "\n");
  originalLog(logMessage);
};

const originalError = console.error;
console.error = function (message) {
  const timestamp = new Date().toISOString();
  const errorMessage = `${timestamp} - ERROR: ${message}`;
  logFile.write(errorMessage + "\n");
  originalError(errorMessage);
};

// Create an instance of Express
const app = express();

// Database connection pool
const pool = mariadb.createPool({
  host: process.env.DB_HOST,      // Database host
  user: process.env.DB_USER,      // Database user
  password: process.env.DB_PASSWORD, // Database password
  database: process.env.DB_NAME,  // Database name
  port: process.env.DB_PORT       // Database port
});

// Test database connection
pool.getConnection()
  .then(conn => {
    console.log('Connected to the database successfully!');
    conn.release();
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });

// Middleware to parse incoming requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Define the /ping route for health checks
app.get('/ping', (req, res) => {
  console.log('Ping endpoint hit');
  res.send('Server is alive!');
});

// Define the /api/User/GetAllUsers route
app.get('/api/User/GetAllUsers', async (req, res) => {
  try {
    // Establish a connection to the database
    const connection = await pool.getConnection();
    console.log('Database connection established for GetAllUsers');

    // Query to fetch all users
    const users = await connection.query('SELECT id, username, email, role, created_at FROM user');
    connection.release(); // Release the connection back to the pool

    // Respond with the fetched users
    console.log('Fetched users:', users);
    res.json({ success: true, data: users });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

// Define a basic route
app.get('/', (req, res) => {
  res.send('Welcome to YouthfulGuides.app!');
});

// Catch-all route for undefined endpoints
app.use((req, res, next) => {
  console.log(`404 Error - Requested URL: ${req.originalUrl}`);
  res.status(404).send('Sorry, the requested resource was not found.');
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong! Please try again later.');
});

// Save the day from favico error 500
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://youthfulguides.app:${PORT}`);
});
