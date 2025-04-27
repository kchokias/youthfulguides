const express = require("express");

const router = express.Router();

// Ping endpoint (Health Check)
router.get("/ping", (req, res) => {
  console.log("Ping endpoint hit");
  res.send("Server is alive");
});

// Health Debug Info
router.get("/api/debug/health", (req, res) => {
  res.json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    pid: process.pid,
  });
});

// Default Home Page
router.get("/", (req, res) => {
  res.send("Welcome to YouthfulGuides.app!");
});

// Favicon Handling (to avoid error 500 on favicon request)
router.get("/favicon.ico", (req, res) => res.status(204).end());

module.exports = router;
