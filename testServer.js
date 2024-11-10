// testServer.js
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Test server is running');
});

app.listen(PORT, () => {
    console.log(`Test server running on http://localhost:${PORT}`);
}).on('error', (error) => {
    console.error("Error starting test server:", error);
});