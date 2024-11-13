// Load environment variables from .env file
require('dotenv').config();

// Import required packages
const express = require('express');
const mariadb = require('mariadb');
const path = require('path');

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

// Define a basic route
app.get('/', (req, res) => {
  res.send('Welcome to YouthfulGuides.app!');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://youthfulguides.app:${PORT}`);
});
