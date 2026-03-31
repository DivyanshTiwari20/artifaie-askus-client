// src/models/client.js
// Client model for PostgreSQL

const { pool } = require('../config/database');

const Client = {
  async create({ name, phone, email, location, contactPerson, licenseNum, licenseExpire }) {
    const query = `
      INSERT INTO clients (name, phone, email, location, contact_person, license_num, license_expire)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [
      name,
      phone || null,
      email || null,
      location || null,
      contactPerson || null,
      licenseNum || null,
      licenseExpire || null,
    ];
    const result = await pool.query(query, values);
    return this._format(result.rows[0]);
  },

  async findAll({ limit = 50, offset = 0 } = {}) {
    let query = `SELECT * FROM clients ORDER BY created_at DESC LIMIT $1 OFFSET $2`;
    const result = await pool.query(query, [limit, offset]);
    return result.rows.map(row => this._format(row));
  },

  async findById(id) {
    const query = `SELECT * FROM clients WHERE id = $1`;
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) return null;
    return this._format(result.rows[0]);
  },

  async update(id, updateData) {
    const fields = [];
    const values = [];
    let paramCount = 0;
    const fieldMap = {
      name: 'name',
      phone: 'phone',
      email: 'email',
      location: 'location',
      contactPerson: 'contact_person',
      licenseNum: 'license_num',
      licenseExpire: 'license_expire',
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
    const query = `UPDATE clients SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);
    if (result.rows.length === 0) return null;
    return this._format(result.rows[0]);
  },

  async delete(id) {
    const result = await pool.query('DELETE FROM clients WHERE id = $1 RETURNING id', [id]);
    return result.rows.length > 0;
  },

  _format(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      location: row.location,
      contactPerson: row.contact_person,
      licenseNum: row.license_num,
      licenseExpire: row.license_expire,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },
};

module.exports = Client;
