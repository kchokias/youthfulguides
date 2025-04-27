// config/db.js

const mariadb = require("mariadb");

const pool = mariadb.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  connectionLimit: 10,
  supportBigNumbers: true,
  bigNumberStrings: true,
  multipleStatements: true,
});

pool
  .getConnection()
  .then((conn) => {
    console.log("Connected to the database successfully");
    conn.release();
  })
  .catch((err) => {
    console.error("Unable to connect to the database:", err);
  });

module.exports = { pool };
