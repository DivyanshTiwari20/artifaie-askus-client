// src/models/user.js
// This file acts as a bridge between MongoDB and PostgreSQL implementations

const UserMongo = require('./userMongo');
const UserPostgres = require('./userPostgres');

const dbType = process.env.DB_TYPE || 'postgres';

/**
 * Unified User Model Wrapper
 * Maps common methods to the appropriate database implementation
 */
const User = {
  async create(userData) {
    if (dbType === 'mongodb') {
      const user = await UserMongo.create(userData);
      return this._formatMongoUser(user);
    }
    return UserPostgres.create(userData);
  },

  async findByEmail(email, includePassword = false) {
    if (dbType === 'mongodb') {
      const user = await UserMongo.findByEmail(email, includePassword);
      return this._formatMongoUser(user);
    }
    return UserPostgres.findByEmail(email, includePassword);
  },

  async findById(id, includePassword = false) {
    if (dbType === 'mongodb') {
      const user = await UserMongo.findByIdWithSelection(id, includePassword);
      return this._formatMongoUser(user);
    }
    return UserPostgres.findById(id, includePassword);
  },

  async findAll() {
    if (dbType === 'mongodb') {
      const users = await UserMongo.find().select('-password');
      return users.map(u => this._formatMongoUser(u));
    }
    return UserPostgres.findAll();
  },

  async comparePassword(enteredPassword, hashedPassword) {
    // Both use bcrypt.compare under the hood
    const bcrypt = require('bcryptjs');
    return await bcrypt.compare(enteredPassword, hashedPassword);
  },

  /**
   * Helper to format Mongo document to match Postgres output structure
   */
  _formatMongoUser(user) {
    if (!user) return null;
    const u = user.toObject ? user.toObject() : user;
    return {
      id: u._id.toString(),
      _id: u._id.toString(),
      name: u.name,
      email: u.email,
      password: u.password,
      role: u.role,
      isActive: u.isActive,
      allowedCompanies: u.allowedCompanies || [],
      employeeId: u.employeeId,
      department: u.department,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt
    };
  }
};

module.exports = User;