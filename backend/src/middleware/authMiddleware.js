const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Express middleware that verifies a JWT from the Authorization header.
 * Attaches decoded user payload to req.user on success.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication token is required.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired authentication token.',
    });
  }
}

/**
 * Express middleware that optionally verifies a JWT if provided.
 * Does not block unauthenticated requests, but rejects invalid tokens.
 */
function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired authentication token.',
    });
  }
}

authMiddleware.authMiddleware = authMiddleware;
authMiddleware.optionalAuthMiddleware = optionalAuthMiddleware;

module.exports = authMiddleware;
