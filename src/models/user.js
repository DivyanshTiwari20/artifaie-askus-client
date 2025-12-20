// src/models/User.js
// This file defines the User schema for MongoDB

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Schema
 * Defines structure of user documents in MongoDB
 */
const userSchema = new mongoose.Schema(
  {
    // User's full name
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
    },

    // Email - must be unique
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email',
      ],
    },

    // Password - will be hashed before saving
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: 6,
      select: false, // Don't return password by default in queries
    },

    // User role: admin, manager, or employee
    role: {
      type: String,
      enum: ['admin', 'manager', 'employee'],
      default: 'employee',
    },

    // Account status
    isActive: {
      type: Boolean,
      default: true,
    },

    // Which Tally companies this user can access (optional)
    allowedCompanies: {
      type: [String],
      default: [],
    },

    // Employee-specific data (optional)
    employeeId: {
      type: String,
      sparse: true, // Allows multiple null values
    },

    // Department (optional)
    department: {
      type: String,
    },
  },
  {
    // Automatically add createdAt and updatedAt timestamps
    timestamps: true,
  }
);

/**
 * Hash password before saving to database
 * This runs automatically before user.save()
 */
userSchema.pre('save', async function () {
  // Only hash password if it's modified or new
  if (!this.isModified('password')) {
    return;
  }

  // Generate salt and hash password
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Method to compare entered password with hashed password
 * @param {string} enteredPassword - Password entered by user
 * @returns {boolean} - True if passwords match
 */
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

/**
 * Method to get user info without sensitive data
 * @returns {object} - User object without password
 */
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  return user;
};

// Create and export User model
const User = mongoose.model('User', userSchema);

module.exports = User;