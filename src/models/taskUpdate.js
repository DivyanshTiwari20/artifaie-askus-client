// src/models/taskUpdate.js
// TaskUpdate model for storing status update history

const { pool } = require('../config/database');

const TaskUpdate = {
  /**
   * Create a new task update entry
   */
  async create({ taskId, userId, userName, title, description, status, previousStatus }) {
    const query = `
      INSERT INTO task_updates (task_id, user_id, user_name, title, description, status, previous_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [
      taskId,
      userId,
      userName || null,
      title || null,
      description || null,
      status,
      previousStatus || null,
    ];
    const result = await pool.query(query, values);
    return this._format(result.rows[0]);
  },

  /**
   * Get all updates for a specific task (newest first)
   */
  async findByTaskId(taskId) {
    const query = `
      SELECT tu.*, u.name as updater_name
      FROM task_updates tu
      LEFT JOIN users u ON tu.user_id = u.id
      WHERE tu.task_id = $1
      ORDER BY tu.created_at DESC
    `;
    const result = await pool.query(query, [taskId]);
    return result.rows.map(row => this._format(row));
  },

  /**
   * Format a task update row
   */
  _format(row) {
    if (!row) return null;
    return {
      id: row.id,
      taskId: row.task_id,
      userId: row.user_id,
      userName: row.updater_name || row.user_name || 'Unknown',
      title: row.title,
      description: row.description,
      status: row.status,
      previousStatus: row.previous_status,
      createdAt: row.created_at,
    };
  },
};

module.exports = TaskUpdate;
