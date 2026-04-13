// src/models/task.js
// Task model for PostgreSQL

const { pool } = require('../config/database');

const Task = {
  /**
   * Create a new task
   */
  async create({ title, description, category, priority, assignedTo, assignedBy, clientName, dueDate }) {
    const query = `
      INSERT INTO tasks (title, description, category, priority, assigned_to, assigned_by, client_name, due_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const values = [
      title,
      description || null,
      category || 'General',
      priority || 'medium',
      assignedTo,
      assignedBy,
      clientName || null,
      dueDate || null,
    ];
    const result = await pool.query(query, values);
    return this._format(result.rows[0]);
  },

  /**
   * Get all tasks (with optional filters)
   */
  async findAll({ assignedTo, status, limit = 50, offset = 0 } = {}) {
    let query = `
      SELECT t.*,
        assignee.name as assignee_name, assignee.email as assignee_email,
        assigner.name as assigner_name
      FROM tasks t
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      LEFT JOIN users assigner ON t.assigned_by = assigner.id
    `;
    const conditions = [];
    const values = [];

    if (assignedTo) {
      values.push(assignedTo);
      conditions.push(`t.assigned_to = $${values.length}`);
    }
    if (status) {
      values.push(status);
      conditions.push(`t.status = $${values.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY t.created_at DESC`;
    values.push(limit);
    query += ` LIMIT $${values.length}`;
    values.push(offset);
    query += ` OFFSET $${values.length}`;

    const result = await pool.query(query, values);
    return result.rows.map(row => this._format(row));
  },

  /**
   * Get a single task by ID
   */
  async findById(id) {
    const query = `
      SELECT t.*,
        assignee.name as assignee_name, assignee.email as assignee_email,
        assigner.name as assigner_name
      FROM tasks t
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      LEFT JOIN users assigner ON t.assigned_by = assigner.id
      WHERE t.id = $1
    `;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) return null;
    return this._format(result.rows[0]);
  },

  /**
   * Update task status
   */
  async updateStatus(id, status) {
    const completedAt = status === 'completed' ? 'NOW()' : 'NULL';
    const query = `
      UPDATE tasks
      SET status = $1, completed_at = ${completedAt}, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [status, id]);
    if (result.rows.length === 0) return null;
    return this._format(result.rows[0]);
  },

  /**
   * Update task details
   */
  async update(id, updateData) {
    const fields = [];
    const values = [];
    let paramCount = 0;

    const allowedFields = ['title', 'description', 'category', 'priority', 'client_name', 'due_date', 'status'];
    const fieldMap = {
      title: 'title',
      description: 'description',
      category: 'category',
      priority: 'priority',
      clientName: 'client_name',
      dueDate: 'due_date',
      status: 'status',
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (updateData[key] !== undefined) {
        paramCount++;
        fields.push(`${dbField} = $${paramCount}`);
        values.push(updateData[key]);
      }
    }

    if (fields.length === 0) return this.findById(id);

    fields.push('updated_at = NOW()');
    paramCount++;
    values.push(id);

    const query = `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);
    if (result.rows.length === 0) return null;
    return this._format(result.rows[0]);
  },

  /**
   * Delete a task
   */
  async delete(id) {
    const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING id', [id]);
    return result.rows.length > 0;
  },

  /**
   * Get task counts for a user (or globally if admin)
   */
  async getCountsForUser(userId, role) {
    let query = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        COUNT(*) as total
      FROM tasks
    `;
    let values = [];
    if (role === 'employee' || role === 'manager') {
      query += ` WHERE assigned_to = $1`;
      values.push(userId);
    }
    const result = await pool.query(query, values);
    return result.rows[0];
  },

  /**
   * Format a task row
   */
  _format(row) {
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      status: row.status,
      priority: row.priority,
      assignedTo: row.assigned_to,
      assignedToName: row.assignee_name || null,
      assignedToEmail: row.assignee_email || null,
      assignedBy: row.assigned_by,
      assignedByName: row.assigner_name || null,
      clientName: row.client_name,
      dueDate: row.due_date,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },
};

module.exports = Task;
