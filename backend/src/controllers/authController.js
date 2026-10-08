const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("../config/env");
const dbService = require("../services/dbService");

/**
 * POST /api/auth/signup
 * Creates a new Rider account.
 *
 * Public signup always creates a Rider.
 * Users cannot choose the Admin role during signup.
 */
async function signup(req, res, next) {
  try {
    const { name, email, password } = req.body || {};

    // Basic validation
    if (!name || !email || !password) {
      return res.status(400).json({
        error: "Validation Error",
        message: "Name, email and password are required.",
      });
    }

    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      return res.status(400).json({
        error: "Validation Error",
        message: "Name is required.",
      });
    }

    if (!normalizedEmail) {
      return res.status(400).json({
        error: "Validation Error",
        message: "Email is required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Validation Error",
        message: "Password must be at least 6 characters long.",
      });
    }

    // Check whether the email is already registered
    const existingUser = dbService.findUserByEmail(normalizedEmail);

    if (existingUser) {
      return res.status(409).json({
        error: "Registration Failed",
        message: "An account with this email already exists.",
      });
    }

    // Hash password before storing it
    const passwordHash = await bcrypt.hash(password, 10);

    // Always create public signup accounts as Riders
    const user = dbService.createUser({
      name: trimmedName,
      email: normalizedEmail,
      passwordHash,
      role: "rider",
    });

    return res.status(201).json({
      message: "Rider account created successfully.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    // Handle SQLite UNIQUE constraint safely
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({
        error: "Registration Failed",
        message: "An account with this email already exists.",
      });
    }

    next(error);
  }
}

/**
 * POST /api/auth/login
 * Authenticates a user and returns a JWT.
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        error: "Validation Error",
        message: "Email and password are required.",
      });
    }

    // Normalize email so login is case-insensitive
    const normalizedEmail = email.trim().toLowerCase();

    const user = dbService.findUserByEmail(normalizedEmail);

    if (!user) {
      return res.status(401).json({
        error: "Authentication Failed",
        message: "Invalid email or password.",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        error: "Authentication Failed",
        message: "Invalid email or password.",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      config.JWT_SECRET,
      {
        expiresIn: config.JWT_EXPIRES_IN,
      },
    );

    return res.status(200).json({
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/auth/me
 * Returns the authenticated user's information.
 * Requires valid JWT (enforced by authMiddleware).
 */
async function getMe(req, res, next) {
  try {
    const user = dbService.findUserById(req.user.id);

    if (!user) {
      return res.status(404).json({
        error: "Not Found",
        message: "User not found.",
      });
    }

    return res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.created_at,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  signup,
  login,
  getMe,
};
