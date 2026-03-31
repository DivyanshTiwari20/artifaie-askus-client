// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/user');
const { protect, authorize, generateToken } = require('../middleware/auth');

// Register (temporarily open for first admin)
router.post('/register', async (req, res) => {
  try {
    let { name, email, password, role, department, employeeId } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password',
      });
    }

    // Sanitize input (lowercase + strip spaces)
    email = email.toLowerCase().replace(/\s+/g, '');
    password = password.toLowerCase().replace(/\s+/g, '');

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Create user in PostgreSQL
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'employee',
      department,
      employeeId,
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);

    // Handle PostgreSQL (23505) and MongoDB (11000) unique constraint violation
    if (error.code === '23505' || error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message,
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    // Sanitize input (lowercase + strip spaces)
    email = email.toLowerCase().replace(/\s+/g, '');
    password = password.toLowerCase().replace(/\s+/g, '');

    // Find user with password included
    const user = await User.findByEmail(email, true);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated',
      });
    }

    // Compare password using the User model's static method
    const isPasswordMatch = await User.comparePassword(password, user.password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const token = generateToken(user.id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message,
    });
  }
});

// Update Password
router.put('/update-password', protect, async (req, res) => {
  try {
    let { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both old and new password',
      });
    }

    // Sanitize inputs
    oldPassword = oldPassword.toLowerCase().replace(/\s+/g, '');
    newPassword = newPassword.toLowerCase().replace(/\s+/g, '');

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters (excluding spaces)',
      });
    }

    // Get user with password from Postgres
    const user = await User.findByEmail(req.user.email, true);

    // Check old password
    const isPasswordMatch = await User.comparePassword(oldPassword, user.password);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid current password',
      });
    }

    // Update password in Postgres (the model should hash it automatically if implemented, or we do it here)
    // Actually UserPostgres doesn't automatically hash in an update() typically.
    const { pool } = require('../config/database');
    const bcrypt = require('bcryptjs');
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.user.id]);

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating password',
    });
  }
});

// Update Push Token
router.put('/push-token', protect, async (req, res) => {
  try {
    const { pushToken } = req.body;
    const { pool } = require('../config/database');
    await pool.query('UPDATE users SET expo_push_token = $1 WHERE id = $2', [pushToken, req.user.id]);
    res.status(200).json({ success: true, message: 'Push token updated' });
  } catch (error) {
    console.error('Update push token error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get current user
router.get('/me', protect, async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: req.user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

// Get all users (Admin/Manager)
router.get('/users', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const users = await User.findAll();
    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});

module.exports = router;