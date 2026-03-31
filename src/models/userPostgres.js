// src/models/userPostgres.js
// This file defines User model operations for PostgreSQL

const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

/**
 * User Model (Postgres)
 */
const UserPostgres = {
  async create(userData) {
    const { name, email, password, role, department, employeeId } = userData;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const query = `
      INSERT INTO users (name, email, password, role, department, employee_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, email, role, is_active, allowed_companies, employee_id, department, created_at, updated_at
    `;
    const values = [name, email.toLowerCase().trim(), hashedPassword, role || 'employee', department || null, employeeId || null];

    const result = await pool.query(query, values);
    return this._formatUser(result.rows[0]);
  },

  async findByEmail(email, includePassword = false) {
    const fields = includePassword ? '*' : 'id, name, email, role, is_active, allowed_companies, employee_id, department, expo_push_token, created_at, updated_at';
    const query = `SELECT ${fields} FROM users WHERE email = $1`;
    const result = await pool.query(query, [email.toLowerCase().trim()]);
    if (result.rows.length === 0) return null;
    return this._formatUser(result.rows[0]);
  },

  async findById(id, includePassword = false) {
    const fields = includePassword ? '*' : 'id, name, email, role, is_active, allowed_companies, employee_id, department, expo_push_token, created_at, updated_at';
    const query = `SELECT ${fields} FROM users WHERE id = $1`;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) return null;
    return this._formatUser(result.rows[0]);
  },

  async findAll() {
    const query = `
      SELECT u.id, u.name, u.email, u.role, u.is_active, u.allowed_companies, u.employee_id, u.department, u.expo_push_token, u.created_at, u.updated_at,
             COUNT(t.id) as tasks_assigned,
             COUNT(t.id) FILTER (WHERE t.status = 'completed') as tasks_completed
      FROM users u
      LEFT JOIN tasks t ON u.id = t.assigned_to
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows.map(row => this._formatUser(row));
  },

  async comparePassword(enteredPassword, hashedPassword) {
    return await bcrypt.compare(enteredPassword, hashedPassword);
  },

  _formatUser(row) {
    if (!row) return null;
    return {
      _id: row.id,
      id: row.id,
      name: row.name,
      email: row.email,
      password: row.password || undefined,
      role: row.role,
      isActive: row.is_active,
      allowedCompanies: row.allowed_companies || [],
      employeeId: row.employee_id,
      department: row.department,
      tasksAssigned: row.tasks_assigned ? parseInt(row.tasks_assigned, 10) : 0,
      tasksCompleted: row.tasks_completed ? parseInt(row.tasks_completed, 10) : 0,
      expoPushToken: row.expo_push_token,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
};

module.exports = UserPostgres;
