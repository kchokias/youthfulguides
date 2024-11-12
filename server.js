// server.js

const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const { getConnection } = require('./db'); // Assuming db.js handles MariaDB connections
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Test database connection
async function testDatabaseConnection() {
    try {
        const connection = await getConnection();
        console.log("Database connection successful!");
        connection.release(); // Release the connection after testing
    } catch (error) {
        console.error("Database connection failed:", error);
    }
}

testDatabaseConnection(); // Run the test when the server starts

// Middleware to parse JSON requests
app.use(express.json());

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Email validation helper function
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// API endpoint to fetch users
app.get('/api/users', async (req, res) => {
    let connection;
    try {
        connection = await getConnection();
        const rows = await connection.query("SELECT * FROM users");

        if (rows.length === 0) {
            return res.status(404).json({ message: "No users found" });
        }
        res.json(rows);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Failed to fetch users" });
    } finally {
        if (connection) connection.release();
    }
});

// API endpoint for signup
app.post('/api/signup', async (req, res) => {
    const { username, email, password } = req.body;

    // Validate email, username, and password
    if (!isValidEmail(email)) {
        return res.status(400).json({ message: "Invalid email format" });
    }
    if (!username || typeof username !== 'string') {
        return res.status(400).json({ message: "Invalid username" });
    }
    if (!password || typeof password !== 'string') {
        return res.status(400).json({ message: "Invalid password" });
    }

    let connection;
    try {
        connection = await getConnection();

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user into the database
        await connection.query(
            "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
            [username, email, hashedPassword]
        );

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error("Error during sign-up:", error);
        res.status(500).json({ error: "Failed to register user" });
    } finally {
        if (connection) connection.release();
    }
});

// API endpoint for login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    // Validate email and password
    if (!isValidEmail(email)) {
        return res.status(400).json({ message: "Invalid email format" });
    }
    if (!password || typeof password !== 'string') {
        return res.status(400).json({ message: "Invalid password" });
    }

    let connection;
    try {
        connection = await getConnection();

        // Retrieve user by email
        const rows = await connection.query("SELECT * FROM users WHERE email = ?", [email]);
        const user = rows[0];

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Compare passwords
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ message: "Invalid password" });
        }

        res.json({ message: 'Login successful', user: { id: user.id, username: user.username, email: user.email } });
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({ error: "Failed to log in" });
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