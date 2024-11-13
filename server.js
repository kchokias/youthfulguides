// Load environment variables from .env file
require('dotenv').config();

// Import required packages
const express = require('express');
const mariadb = require('mariadb');


// from this code we read the log to a file at server.log
const path = require('path');
const fs = require('fs');


// Create a write stream for the log file
const logFile = fs.createWriteStream(path.join(__dirname, 'server.log'), { flags: 'a' });

// Redirect console.log to log file AND console
const originalLog = console.log;
console.log = function (message) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - LOG: ${message}`;
  logFile.write(logMessage + "\n"); // Write to file
  originalLog(logMessage); // Print to console
};

// Redirect console.error to log file AND console
const originalError = console.error;
console.error = function (message) {
  const timestamp = new Date().toISOString();
  const errorMessage = `${timestamp} - ERROR: ${message}`;
  logFile.write(errorMessage + "\n"); // Write to file
  originalError(errorMessage); // Print to console
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
    conn.release(); // Release the connection back to the pool
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

// Define a basic route
app.get('/', (req, res) => {
  res.send('Welcome to YouthfulGuides.app!');
});

// Catch-all route for undefined endpoints
app.use((req, res, next) => {
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