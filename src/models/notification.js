// src/models/notification.js
// Notification model for PostgreSQL

const { pool } = require('../config/database');
const axios = require('axios');

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
    const notificationRecord = result.rows[0];

    // Try sending an Expo Push Notification
    try {
      const userRes = await pool.query('SELECT expo_push_token FROM users WHERE id = $1', [userId]);
      const pushToken = userRes.rows[0]?.expo_push_token;
      
      if (pushToken && (pushToken.startsWith('ExponentPushToken') || pushToken.startsWith('ExpoPushToken'))) {
        axios.post('https://exp.host/--/api/v2/push/send', {
          to: pushToken,
          title: title,
          body: message,
          data: { relatedTaskId, type, notificationId: notificationRecord.id },
          sound: 'default'
        }, {
          headers: {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json'
          }
        }).catch(err => console.error('Error sending push:', err.message));
      }
    } catch (pushErr) {
      console.error('Failed to get push token:', pushErr.message);
    }

    return this._format(notificationRecord);
  },

  /**
   * Get notifications for a user based on role and mode
   */
  async findForUser(user, mode, limit = 50, offset = 0) {
    let query = `SELECT * FROM notifications WHERE user_id = $1 `;
    let values = [user.id];
    let paramIndex = 2;

    if (mode === 'task') {
      query += ` AND type IN ('task', 'alert') `;
    } else if (mode === 'general') {
      query += ` AND type NOT IN ('task', 'alert') `;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex+1}`;
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
    let query = `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false `;
    let values = [user.id];

    if (mode === 'task') {
      query += ` AND type IN ('task', 'alert') `;
    } else if (mode === 'general') {
      query += ` AND type NOT IN ('task', 'alert') `;
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
