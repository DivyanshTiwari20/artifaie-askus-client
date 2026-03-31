// src/models/notification.js
// Notification model for PostgreSQL

const { pool } = require('../config/database');

const Notification = {
  /**
   * Create a new notification
   */
  async create({ userId, title, message, type = 'task', relatedTaskId = null }) {
    const query = `
      INSERT INTO notifications (user_id, title, message, type, related_task_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [userId, title, message, type, relatedTaskId];
    const result = await pool.query(query, values);
    return this._format(result.rows[0]);
  },

  /**
   * Get notifications for a user based on role and mode
   */
  async findForUser(user, mode, limit = 50, offset = 0) {
    let query = `SELECT n.* FROM notifications n `;
    let values = [];
    let paramIndex = 1;

    if (user.role === 'admin' || user.role === 'manager') {
      query += ` LEFT JOIN users u ON n.user_id = u.id WHERE 1=1 `;
    } else {
      query += ` WHERE n.user_id = $1 `;
      values.push(user.id);
      paramIndex++;
    }

    if (mode === 'task') {
      query += ` AND n.type IN ('task', 'alert') `;
    } else if (mode === 'general') {
      query += ` AND n.type NOT IN ('task', 'alert') `;
    }

    if (user.role === 'admin') {
      query += ` AND (n.user_id = $${paramIndex} OR u.role IN ('manager', 'employee')) `;
      values.push(user.id);
      paramIndex++;
    } else if (user.role === 'manager') {
      query += ` AND (n.user_id = $${paramIndex} OR u.role = 'employee') `;
      values.push(user.id);
      paramIndex++;
    }

    query += ` ORDER BY n.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex+1}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);
    return result.rows.map(row => this._format(row));
  },

  /**
   * Mark a notification as read
   */
  async markAsRead(id, userId) {
    const query = `
      UPDATE notifications 
      SET is_read = true 
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [id, userId]);
    if (result.rows.length === 0) return null;
    return this._format(result.rows[0]);
  },

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId) {
    const query = `
      UPDATE notifications 
      SET is_read = true 
      WHERE user_id = $1 AND is_read = false
    `;
    await pool.query(query, [userId]);
    return true;
  },

  /**
   * Delete a notification
   */
  async delete(id, userId) {
    const query = `DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id`;
    const result = await pool.query(query, [id, userId]);
    return result.rows.length > 0;
  },

  /**
   * Get unread count for a user
   */
  async getUnreadCountForUser(user, mode) {
    let query = `SELECT COUNT(*) FROM notifications n `;
    let values = [];
    let paramIndex = 1;

    if (user.role === 'admin' || user.role === 'manager') {
      query += ` LEFT JOIN users u ON n.user_id = u.id WHERE n.is_read = false `;
    } else {
      query += ` WHERE n.user_id = $1 AND n.is_read = false `;
      values.push(user.id);
      paramIndex++;
    }

    if (mode === 'task') {
      query += ` AND n.type IN ('task', 'alert') `;
    } else if (mode === 'general') {
      query += ` AND n.type NOT IN ('task', 'alert') `;
    }

    if (user.role === 'admin') {
      query += ` AND (n.user_id = $${paramIndex} OR u.role IN ('manager', 'employee')) `;
      values.push(user.id);
    } else if (user.role === 'manager') {
      query += ` AND (n.user_id = $${paramIndex} OR u.role = 'employee') `;
      values.push(user.id);
    }

    const result = await pool.query(query, values);
    return parseInt(result.rows[0].count, 10);
  },

  /**
   * Format a notification row
   */
  _format(row) {
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      message: row.message,
      type: row.type,
      isRead: row.is_read,
      relatedTaskId: row.related_task_id,
      createdAt: row.created_at,
    };
  },
};

module.exports = Notification;
