const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PROJECT_ROOT = path.resolve(__dirname, '../../../');
const VENV_PATH_1 = path.resolve(PROJECT_ROOT, '.venv/Scripts/python.exe');
const VENV_PATH_2 = path.resolve(PROJECT_ROOT, '../.venv/Scripts/python.exe');

const config = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  PYTHON_PATH: process.env.PYTHON_PATH || 'python',
  JWT_SECRET: process.env.JWT_SECRET || 'pathwise-dev-secret-key-2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  PROJECT_ROOT,
};

module.exports = config;
