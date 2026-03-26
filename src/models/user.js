// src/models/user.js
// This file acts as a wrapper for PostgreSQL user implementation
const UserPostgres = require('./userPostgres');

/**
 * Unified User Model Wrapper
 */
const User = {
  async create(userData) {
    return UserPostgres.create(userData);
  },

  async findByEmail(email, includePassword = false) {
    return UserPostgres.findByEmail(email, includePassword);
  },

  async findById(id, includePassword = false) {
    return UserPostgres.findById(id, includePassword);
  },

  async findAll() {
    return UserPostgres.findAll();
  },

  async comparePassword(enteredPassword, hashedPassword) {
    const bcrypt = require('bcryptjs');
    return await bcrypt.compare(enteredPassword, hashedPassword);
  }
};

module.exports = User;