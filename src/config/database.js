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

    // Users table
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
        phone VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');

    // Tasks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title VARCHAR(500) NOT NULL,
        description TEXT,
        category VARCHAR(100) DEFAULT 'General',
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
        priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
        assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
        assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
        client_name VARCHAR(255),
        due_date TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)');

    // Notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'task' CHECK (type IN ('task', 'announcement', 'reminder', 'alert')),
        is_read BOOLEAN DEFAULT false,
        related_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)');

    console.log('✅ PostgreSQL tables initialized successfully (users, tasks, notifications)');
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
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, current_database() as db_name');
    client.release();

    console.log(`✅ PostgreSQL Connected: ${process.env.PG_HOST}`);
    console.log(`📊 Database Name: ${result.rows[0].db_name}`);

    await initializePostgres();
  } catch (error) {
    console.error(`❌ PostgreSQL Connection Error: ${error.message}`);
    console.error(`⚠️  Database features (auth/users) will not work until PG_* credentials are fixed.`);
    // In production, we might want to exit, but for now we'll just log
    // process.exit(1);
  }
};

// Handle pool errors
pool.on('error', (err) => {
  console.error('❌ Unexpected PostgreSQL pool error:', err.message);
});

module.exports = { pool, connectDatabase };