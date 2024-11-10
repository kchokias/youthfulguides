// db.js
const mariadb = require('mariadb');

const pool = mariadb.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    connectionLimit: 5,
});

async function getConnection() {
    try {
        const connection = await pool.getConnection();
        console.log("Connected to MariaDB");
        return connection;
    } catch (error) {
        console.error("Error connecting to MariaDB:", error);
        throw error;
    }
}

module.exports = { getConnection };