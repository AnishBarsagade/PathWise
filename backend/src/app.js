const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const apiRoutes = require('./routes/api');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Configure CORS
const allowedOrigins = [
  config.CORS_ORIGIN,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive for local dev but origin-aware
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());

// API Routes
app.use('/api', apiRoutes);

// Root fallback / info
app.get('/', (req, res) => {
  res.json({
    message: 'PathWise Route Optimization API is running.',
    endpoints: {
      health: 'GET /api/health',
      optimize: 'POST /api/optimize',
    },
  });
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;
