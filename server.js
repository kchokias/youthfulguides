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
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
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
    const connection = await pool.getConnection();
    console.log('Database connection established for GetAllUsers');
    const users = await connection.query('SELECT id, username, email, role, created_at FROM user');
    connection.release();
    console.log('Fetched users:', users);
    res.json({ success: true, data: users });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

// Define the /api/User/GetUserByUserId route
app.get('/api/User/GetUserByUserId/:id', async (req, res) => {
  const userId = req.params.id;
  try {
    const connection = await pool.getConnection();
    console.log(`Database connection established for GetUserByUserId with ID: ${userId}`);
    const user = await connection.query('SELECT id, username, email, role, created_at FROM user WHERE id = ?', [userId]);
    connection.release();
    if (user.length === 0) {
      console.log(`User with ID: ${userId} not found`);
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    console.log(`Fetched user:`, user[0]);
    res.json({ success: true, data: user[0] });
  } catch (err) {
    console.error(`Error fetching user with ID: ${userId}`, err);
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
});

// Define the /api/User/CreateNewUser route
app.post('/api/User/CreateNewUser', async (req, res) => {
  const { username, email, password, role } = req.body;
  try {
    const connection = await pool.getConnection();
    console.log('Database connection established for CreateNewUser');
    const result = await connection.query(
      'INSERT INTO user (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, password, role]
    );
    connection.release();
    console.log(`New user created with ID: ${result.insertId}`);
    res.status(201).json({ success: true, message: 'User created successfully', userId: result.insertId });
  } catch (err) {
    console.error('Error creating new user:', err);
    res.status(500).json({ success: false, message: 'Failed to create user' });
  }
});

// Define the /api/User/UpdateUser route
app.put('/api/User/UpdateUser/:id', async (req, res) => {
  const userId = req.params.id;
  const { username, email, password, role } = req.body;
  try {
    const connection = await pool.getConnection();
    console.log(`Database connection established for UpdateUser with ID: ${userId}`);
    const result = await connection.query(
      'UPDATE user SET username = ?, email = ?, password = ?, role = ? WHERE id = ?',
      [username, email, password, role, userId]
    );
    connection.release();
    if (result.affectedRows === 0) {
      console.log(`User with ID: ${userId} not found`);
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    console.log(`User with ID: ${userId} updated successfully`);
    res.json({ success: true, message: 'User updated successfully' });
  } catch (err) {
    console.error(`Error updating user with ID: ${userId}`, err);
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
});

// Define the /api/User/DeleteUserById route
app.delete('/api/User/DeleteUserById/:id', async (req, res) => {
  const userId = req.params.id;
  try {
    const connection = await pool.getConnection();
    console.log(`Database connection established for DeleteUserById with ID: ${userId}`);
    const result = await connection.query('DELETE FROM user WHERE id = ?', [userId]);
    connection.release();
    if (result.affectedRows === 0) {
      console.log(`User with ID: ${userId} not found`);
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    console.log(`User with ID: ${userId} deleted successfully`);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    console.error(`Error deleting user with ID: ${userId}`, err);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
});

// Define the /api/User/GetAllBookings route
app.get('/api/User/GetAllBookings', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    console.log('Database connection established for GetAllBookings');
    const bookings = await connection.query(
      `SELECT b.id, b.guide_id, b.visitor_id, b.rate, b.review, b.created_at,
              g.username AS guide_username, v.username AS visitor_username
       FROM bookings b
       JOIN user g ON b.guide_id = g.id
       JOIN user v ON b.visitor_id = v.id`
    );
    connection.release();
    console.log('Fetched bookings:', bookings);
    res.json({ success: true, data: bookings });
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
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

// Save the day from favicon error 500
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://youthfulguides.app:${PORT}`);
});
