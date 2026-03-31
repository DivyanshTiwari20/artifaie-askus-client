// src/routes/clientRoutes.js
// Routes for client management

const express = require('express');
const router = express.Router();
const Client = require('../models/client');
const { protect, authorize } = require('../middleware/auth');

/**
 * @route   POST /api/clients
 * @desc    Create a new client
 * @access  Private (Admin & Manager only)
 */
router.post('/', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { name, phone, email, location, contactPerson, licenseNum, licenseExpire } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required',
      });
    }

    const client = await Client.create({
      name,
      phone,
      email,
      location,
      contactPerson,
      licenseNum,
      licenseExpire,
    });

    res.status(201).json({
      success: true,
      data: client,
      message: 'Client created successfully',
    });
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create client',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/clients
 * @desc    Get all clients
 * @access  Private
 */
router.get('/', protect, async (req, res) => {
  try {
    const { limit, offset } = req.query;
    const clients = await Client.findAll({
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
    });

    res.status(200).json({
      success: true,
      count: clients.length,
      data: clients,
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch clients',
    });
  }
});

module.exports = router;
