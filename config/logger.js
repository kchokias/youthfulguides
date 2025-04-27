// config/logger.js

const fs = require("fs");
const path = require("path");

const logFile = fs.createWriteStream(path.join(__dirname, "../server.log"), {
  flags: "a",
});

const originalLog = console.log;
console.log = function (message) {
  const logTimestamp = new Date().toISOString();
  const logMessage = `${logTimestamp} - LOG: ${message}`;
  logFile.write(logMessage + "\n");
  originalLog(logMessage);
};

const originalError = console.error;
console.error = function (message) {
  const errorTimestamp = new Date().toISOString();
  const errorMessage = `${errorTimestamp} - ERROR: ${message}`;
  logFile.write(errorMessage + "\n");
  originalError(errorMessage);
};
