// src/server.js
// Main server file - Entry point of the application

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { connectDatabase } = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const tallyRoutes = require('./routes/tallyRoutes');

// Initialize Express app
const app = express();

// Connect to PostgreSQL database
connectDatabase();

// ============================================
// MIDDLEWARE
// ============================================

// Enable CORS for React Native app
app.use(
  cors({
    origin: '*', // In production, specify your mobile app's origin
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  })
);

// Parse JSON request bodies
app.use(express.json());

// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true }));

// Log all requests (for debugging)
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`);
  next();
});

// ============================================
// ROUTES
// ============================================

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Tally Mobile App Backend API',
    version: '1.0.0',
    database: process.env.DB_TYPE === 'mongodb' ? 'MongoDB (Local/Atlas)' : 'PostgreSQL (AWS RDS)',
    endpoints: {
      health: '/health',
      auth: '/api/auth/*',
      tally: '/api/tally/*',
    },
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// Authentication routes
app.use('/api/auth', authRoutes);

// Tally data routes
app.use('/api/tally', tallyRoutes);

// 404 handler - Route not found
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0'; // Bind to all interfaces for AWS

app.listen(PORT, HOST, () => {
  console.log('\n🚀 ========================================');
  console.log(`   Tally Backend Server Started`);
  console.log('   ========================================');
  console.log(`   📍 Server: http://${HOST}:${PORT}`);
  console.log(`   🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   🗄️  Database: ${process.env.DB_TYPE === 'mongodb' ? 'MongoDB (Testing)' : 'PostgreSQL (AWS RDS)'}`);
  console.log(`   📊 Tally Host: ${process.env.TALLY_HOST || 'Not configured'}`);
  console.log('   ========================================\n');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err.message);
  // Close server and exit process
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  process.exit(1);
});

module.exports = app;