const app = require('./app');
const config = require('./config/env');

const PORT = config.PORT || 3000;

app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`PathWise Backend Server running on port ${PORT}`);
  console.log(`Health Check: http://localhost:${PORT}/api/health`);
  console.log(`Optimize API: http://localhost:${PORT}/api/optimize`);
  console.log(`Python Path : ${config.PYTHON_PATH}`);
  console.log(`=========================================`);
});
