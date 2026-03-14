// src/config/database.js
// This file handles PostgreSQL (AWS RDS) database connection

const { Pool } = require('pg');

/**
 * PostgreSQL Connection Pool
 * Uses connection details from .env file
 */
const pool = new Pool({
  host: process.env.PG_HOST,
  port: parseInt(process.env.PG_PORT) || 5432,
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of connections in the pool
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 10000, // Timeout after 10 seconds if unable to connect
});

/**
 * Initialize database - create tables if they don't exist
 */
const initializeDatabase = async () => {
  const client = await pool.connect();
  try {
    // Create UUID extension if not available
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Create users table
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

    // Create index on email for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
    `);

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database tables:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Connect to PostgreSQL database and initialize tables
 */
const connectDatabase = async () => {
  try {
    // Test the connection
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, current_database() as db_name');
    client.release();

    console.log(`✅ PostgreSQL Connected: ${process.env.PG_HOST}`);
    console.log(`📊 Database Name: ${result.rows[0].db_name}`);
    console.log(`🕐 Server Time: ${result.rows[0].current_time}`);

    // Initialize tables
    await initializeDatabase();
  } catch (error) {
    console.warn(`⚠️  PostgreSQL Connection Warning: ${error.message}`);
    console.warn(`⚠️  Database features (auth/users) will not work.`);
    console.warn(`⚠️  Tally API routes will still function normally.`);
    console.warn(`⚠️  Update .env with valid PG_* credentials when ready.\n`);
  }
};

// Handle pool errors
pool.on('error', (err) => {
  console.error('❌ Unexpected PostgreSQL pool error:', err.message);
});

// Export pool for use in models and the connect function
module.exports = { pool, connectDatabase };