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
    const {
      name,
      phone,
      email,
      location,
      contactPerson,
      licenseNum,
      licenseExpire,
      groupEmployeeIds,
    } = req.body;

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
      groupEmployeeIds,
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
 * @access  Private (Admin & Manager only)
 */
router.get('/', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { limit, offset } = req.query;
    const clients = await Client.findAll({
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0,
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

/**
 * @route   GET /api/clients/:id
 * @desc    Get a single client by ID
 * @access  Private (Admin & Manager only)
 */
router.get('/:id', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    res.status(200).json({ success: true, data: client });
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch client' });
  }
});

/**
 * @route   PUT /api/clients/:id
 * @desc    Update a client
 * @access  Private (Admin & Manager only)
 */
router.put('/:id', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const client = await Client.update(req.params.id, req.body);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    res.status(200).json({ success: true, data: client, message: 'Client updated successfully' });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ success: false, message: 'Failed to update client' });
  }
});

/**
 * @route   DELETE /api/clients/:id
 * @desc    Delete a client
 * @access  Private (Admin & Manager only)
 */
router.delete('/:id', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const success = await Client.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    res.status(200).json({ success: true, message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ success: false, message: 'Failed to delete client' });
  }
});

module.exports = router;
