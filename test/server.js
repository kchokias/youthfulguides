// server.js
const express = require('express');
const { getConnection } = require('./db');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON requests
app.use(express.json());

// Example endpoint: Get all users
app.get('/users', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const rows = await connection.query("SELECT * FROM users"); // Adjust based on your table
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// Example endpoint: Add a new user
app.post('/users', async (req, res) => {
    const { username, password } = req.body;
    let connection;
    try {
        connection = await getConnection();
        const result = await connection.query("INSERT INTO users (username, password) VALUES (?, ?)", [username, password]); // Adjust fields based on your table
        res.status(201).json({ id: result.insertId, username });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});