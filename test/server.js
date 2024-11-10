const express = require('express');
const { getConnection } = require('./db');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON
app.use(express.json());

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Example API endpoint (adjust as needed)
app.get('/api/users', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const rows = await connection.query("SELECT * FROM users"); // Adjust query based on your table
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});