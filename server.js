// server.js

const express = require('express');
const path = require('path');
const { getConnection } = require('./db'); // Assuming db.js handles MariaDB connections
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON requests
app.use(express.json());

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Example API endpoint to fetch users
app.get('/api/users', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const rows = await connection.query("SELECT * FROM users"); // Adjust query as needed
        res.json(rows);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// Start the server with error handling
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
}).on('error', (error) => {
    console.error("Error starting server:", error);
});