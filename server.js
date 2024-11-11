const bcrypt = require('bcrypt');

// Sign-up endpoint
app.post('/api/signup', async (req, res) => {
    const { username, email, password } = req.body;
    let connection;
    try {
        connection = await getConnection();

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user into database
        const result = await connection.query(
            "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
            [username, email, hashedPassword]
        );

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error("Error during sign-up:", error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
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
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
});