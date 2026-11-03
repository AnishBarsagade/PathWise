const http = require('http');
const app = require('./app');
const config = require('./config/env');
const { initSocket } = require('./services/socketService');

const PORT = config.PORT || 3000;
const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`PathWise Backend Server running on port ${PORT}`);
  console.log(`Health Check: http://localhost:${PORT}/api/health`);
  console.log(`Optimize API: http://localhost:${PORT}/api/optimize`);
  console.log(`Tracking WS : Socket.IO initialized on port ${PORT}`);
  console.log(`Python Path : ${config.PYTHON_PATH}`);
  console.log(`=========================================`);
});

module.exports = server;
