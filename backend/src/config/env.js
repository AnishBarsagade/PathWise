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
  PROJECT_ROOT,
};

module.exports = config;
