// src/config/database.js
// This file handles database connections (MongoDB for testing, PostgreSQL for production)

const mongoose = require('mongoose');
const { Pool } = require('pg');

/**
 * PostgreSQL Connection Pool
 */
const pool = new Pool({
  host: process.env.PG_HOST,
  port: parseInt(process.env.PG_PORT) || 5432,
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

/**
 * Initialize PostgreSQL tables
 */
const initializePostgres = async () => {
  const client = await pool.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'employee' CHECK (role IN ('admin', 'manager', 'employee')),
        is_active BOOLEAN DEFAULT true,
        allowed_companies TEXT[] DEFAULT '{}',
        employee_id VARCHAR(255),
        department VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    console.log('✅ PostgreSQL tables initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing PostgreSQL tables:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Connect to Database
 */
const connectDatabase = async () => {
  const dbType = process.env.DB_TYPE || 'postgres';

  if (dbType === 'mongodb') {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI);
      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
      console.error(`❌ MongoDB Connection Error: ${error.message}`);
      process.exit(1);
    }
  } else {
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT NOW() as current_time, current_database() as db_name');
      client.release();

      console.log(`✅ PostgreSQL Connected: ${process.env.PG_HOST}`);
      console.log(`📊 Database Name: ${result.rows[0].db_name}`);

      await initializePostgres();
    } catch (error) {
      console.warn(`⚠️  PostgreSQL Connection Warning: ${error.message}`);
      console.warn(`⚠️  Database features (auth/users) will not work.`);
      console.warn(`⚠️  Update .env with valid PG_* credentials for final AWS deployment.\n`);
    }
  }
};

// Handle pool errors
pool.on('error', (err) => {
  console.error('❌ Unexpected PostgreSQL pool error:', err.message);
});

module.exports = { pool, connectDatabase };