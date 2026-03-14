// src/models/user.js
// This file defines User model operations for PostgreSQL

const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

/**
 * User Model
 * Provides CRUD operations for the users table in PostgreSQL
 */
const User = {
  /**
   * Create a new user
   * @param {object} userData - { name, email, password, role, department, employeeId }
   * @returns {object} - Created user (without password)
   */
  async create(userData) {
    const { name, email, password, role, department, employeeId } = userData;

    // Hash password before storing
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const query = `
      INSERT INTO users (name, email, password, role, department, employee_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, email, role, is_active, allowed_companies, employee_id, department, created_at, updated_at
    `;
    const values = [
      name,
      email.toLowerCase().trim(),
      hashedPassword,
      role || 'employee',
      department || null,
      employeeId || null,
    ];

    const result = await pool.query(query, values);
    return this._formatUser(result.rows[0]);
  },

  /**
   * Find a user by email
   * @param {string} email
   * @param {boolean} includePassword - Whether to include password in result
   * @returns {object|null} - User object or null
   */
  async findByEmail(email, includePassword = false) {
    const fields = includePassword
      ? '*'
      : 'id, name, email, role, is_active, allowed_companies, employee_id, department, created_at, updated_at';

    const query = `SELECT ${fields} FROM users WHERE email = $1`;
    const result = await pool.query(query, [email.toLowerCase().trim()]);

    if (result.rows.length === 0) return null;
    return this._formatUser(result.rows[0]);
  },

  /**
   * Find a user by ID
   * @param {string} id - UUID
   * @param {boolean} includePassword - Whether to include password in result
   * @returns {object|null} - User object or null
   */
  async findById(id, includePassword = false) {
    const fields = includePassword
      ? '*'
      : 'id, name, email, role, is_active, allowed_companies, employee_id, department, created_at, updated_at';

    const query = `SELECT ${fields} FROM users WHERE id = $1`;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) return null;
    return this._formatUser(result.rows[0]);
  },

  /**
   * Find all users (without passwords)
   * @returns {Array} - List of users
   */
  async findAll() {
    const query = `
      SELECT id, name, email, role, is_active, allowed_companies, employee_id, department, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows.map((row) => this._formatUser(row));
  },

  /**
   * Compare entered password with hashed password
   * @param {string} enteredPassword - Plain text password
   * @param {string} hashedPassword - Hashed password from DB
   * @returns {boolean}
   */
  async comparePassword(enteredPassword, hashedPassword) {
    return await bcrypt.compare(enteredPassword, hashedPassword);
  },

  /**
   * Update a user by ID
   * @param {string} id - UUID
   * @param {object} updateData - Fields to update
   * @returns {object|null} - Updated user or null
   */
  async updateById(id, updateData) {
    const allowedFields = ['name', 'email', 'role', 'is_active', 'department', 'employee_id', 'allowed_companies'];
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updateData)) {
      // Convert camelCase to snake_case for DB columns
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(dbKey)) {
        setClauses.push(`${dbKey} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) return null;

    // Always update updated_at
    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE users
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, email, role, is_active, allowed_companies, employee_id, department, created_at, updated_at
    `;

    const result = await pool.query(query, values);
    if (result.rows.length === 0) return null;
    return this._formatUser(result.rows[0]);
  },

  /**
   * Format a database row into a consistent user object
   * Maps snake_case DB columns to camelCase JS properties
   * @private
   */
  _formatUser(row) {
    if (!row) return null;
    return {
      _id: row.id, // Keep _id for backwards compatibility with frontend
      id: row.id,
      name: row.name,
      email: row.email,
      password: row.password || undefined, // Only present if explicitly requested
      role: row.role,
      isActive: row.is_active,
      allowedCompanies: row.allowed_companies || [],
      employeeId: row.employee_id,
      department: row.department,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },
};

module.exports = User;