// src/models/session.js
// Session model for tracking active device logins

const { pool } = require('../config/database');

const Session = {
  /**
   * Create or update a session for a user + device
   */
  async upsert({ userId, sessionToken, deviceName, platform }) {
    // If the same session_token already exists, just update last_active
    const existing = await pool.query(
      'SELECT id FROM sessions WHERE session_token = $1',
      [sessionToken]
    );

    if (existing.rows.length > 0) {
      const result = await pool.query(
        `UPDATE sessions SET last_active = NOW(), device_name = $1, platform = $2
         WHERE session_token = $3 RETURNING *`,
        [deviceName || 'Unknown Device', platform || 'unknown', sessionToken]
      );
      return this._format(result.rows[0]);
    }

    const result = await pool.query(
      `INSERT INTO sessions (user_id, session_token, device_name, platform)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, sessionToken, deviceName || 'Unknown Device', platform || 'unknown']
    );
    return this._format(result.rows[0]);
  },

  /**
   * Get all sessions for a user
   */
  async findByUserId(userId) {
    const result = await pool.query(
      'SELECT * FROM sessions WHERE user_id = $1 ORDER BY last_active DESC',
      [userId]
    );
    return result.rows.map(row => this._format(row));
  },

  /**
   * Delete a specific session (remote logout)
   */
  async deleteById(id, userId) {
    const result = await pool.query(
      'DELETE FROM sessions WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );
    return result.rows.length > 0;
  },

  /**
   * Delete session by token (used on logout)
   */
  async deleteByToken(sessionToken) {
    await pool.query('DELETE FROM sessions WHERE session_token = $1', [sessionToken]);
  },

  /**
   * Touch last_active timestamp
   */
  async touch(sessionToken) {
    await pool.query(
      'UPDATE sessions SET last_active = NOW() WHERE session_token = $1',
      [sessionToken]
    );
  },

  /**
   * Format a session row
   */
  _format(row) {
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      sessionToken: row.session_token,
      deviceName: row.device_name,
      platform: row.platform,
      lastActive: row.last_active,
      createdAt: row.created_at,
    };
  },
};

module.exports = Session;
