const jwt = require('jsonwebtoken');

const testToken = jwt.sign({ userId: 1 }, 'test-secret', { expiresIn: '1h' });
console.log('Test Token:', testToken);