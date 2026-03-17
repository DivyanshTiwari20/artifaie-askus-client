// src/models/userMongo.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['admin', 'manager', 'employee'],
    default: 'employee',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  allowedCompanies: {
    type: [String],
    default: [],
  },
  employeeId: String,
  department: String,
}, {
  timestamps: true,
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Map findByEmail etc to maintain same interface as Postgres model
userSchema.statics.findByEmail = function(email, includePassword = false) {
  const query = this.findOne({ email });
  if (!includePassword) {
    query.select('-password');
  }
  return query;
};

userSchema.statics.findByIdWithSelection = function(id, includePassword = false) {
  const query = this.findById(id);
  if (!includePassword) {
    query.select('-password');
  }
  return query;
};

module.exports = mongoose.model('User', userSchema);
