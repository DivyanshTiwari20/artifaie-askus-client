// src/scripts/seedUsers.js
require('dotenv').config();
const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

const usersToSeed = [
  // Admins
  { name: 'Ashish Asthana', role: 'admin' },
  { name: 'Sharaf abbas Khan', role: 'admin' },
  { name: 'Abhishek Asthana', role: 'admin' },

  // Manager
  { name: 'Anshuman Asthana', role: 'manager' },

  // Employees
  { name: 'Tyron Dela Cruz Latayan', role: 'employee' },
  { name: 'Ashutosh Kumar Singh', role: 'employee' },
  { name: 'Gulzar Ahmed', role: 'employee' },
  { name: 'Abbas Raza', role: 'employee' },
  { name: 'Ms Bhavya Srivastava', role: 'employee' },
  { name: 'CA Amrish Pandey', role: 'employee' },
  { name: 'Adv Gaurav Pandey', role: 'employee' },
  { name: 'Himanshu Bajpai', role: 'employee' },
  { name: 'Shubrasnsh kumar', role: 'employee' },
  { name: 'Ms Mohani', role: 'employee' },
];

const seedUsers = async () => {
  try {
    console.log('🌱 Starting user seeding...');

    // Check if users already exist to avoid duplicates
    const checkQuery = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(checkQuery.rows[0].count) > 0) {
      console.log('⚠️ Users already exist in the database. Continuing to add missing ones...');
    }

    const salt = await bcrypt.genSalt(10);
    const defaultPassword = await bcrypt.hash('password123', salt);

    for (const user of usersToSeed) {
      // Generate dummy email from name
      const email = user.name.toLowerCase().replace(/[^a-z0-9]/g, '.') + '@artifaie.com';

      // Check if email already installed
      const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

      if (exists.rows.length === 0) {
        await pool.query(
          `INSERT INTO users (name, email, password, role, is_active)
           VALUES ($1, $2, $3, $4, $5)`,
          [user.name, email, defaultPassword, user.role, true]
        );
        console.log(`✅ Seeded ${user.role}: ${user.name} (${email})`);
      } else {
        console.log(`⏭️ Skipped (already exists): ${user.name}`);
      }
    }

    console.log('🎉 Seeding complete! You can log in with any of these emails and password: password123');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding users:', error);
    process.exit(1);
  }
};

seedUsers();
