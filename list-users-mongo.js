require('dotenv').config();
const mongoose = require('mongoose');

// User schema from src/models/userMongo.js
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: { type: String, select: true },
  role: String,
  isActive: Boolean,
  allowedCompanies: [String],
  employeeId: String,
  department: String,
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function listUsers() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected!');

    const users = await User.find({}).select('+password');
    console.log('Total users found:', users.length);
    
    users.forEach(u => {
      console.log(`Name: ${u.name}, Email: ${u.email}, Password (hashed): ${u.password}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

listUsers();
