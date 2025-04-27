const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
require("dotenv").config();

const { pool } = require("./config/db");
require("./config/logger");

const userRoutes = require("./routes/userRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const availabilityRoutes = require("./routes/availabilityRoutes");
const mediaRoutes = require("./routes/mediaRoutes");
const generalRoutes = require("./routes/generalRoutes");
const availableGuidesRoutes = require("./routes/availableGuidesRoutes");

const app = express();

const allowedOrigins = ["http://localhost:4200", "https://youthfulguides.app"];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed for this domain"), false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(bodyParser.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/User", userRoutes);
app.use("/api/Bookings", bookingRoutes);
app.use("/api/Availability", availabilityRoutes);
app.use("/api/Guide", mediaRoutes);
app.use("/api/AvailableGuides", availableGuidesRoutes);

app.use("/", generalRoutes);

// Catch-all for 404
app.use((req, res, next) => {
  console.log(`404 Error - Requested URL: ${req.originalUrl}`);
  res.status(404).send("Sorry, the requested resource was not found.");
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something went wrong. Please try again later.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://youthfulguides.app:${PORT}`);
});
