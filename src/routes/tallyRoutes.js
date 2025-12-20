// src/routes/tallyRoutes.js
// This file defines Tally data fetching API endpoints

const express = require('express');
const router = express.Router();
const tallyService = require('../services/tallyServices');
const { protect, authorize } = require('../middleware/auth');

/**
 * @route   GET /api/tally/test
 * @desc    Test Tally connection
 * @access  Private/Admin
 */
router.get('/test', protect, authorize('admin'), async (req, res) => {
  try {
    console.log('🔍 Testing Tally connection...');
    
    const isConnected = await tallyService.testConnection();

    if (isConnected) {
      res.status(200).json({
        success: true,
        message: 'Successfully connected to Tally',
        tallyHost: tallyService.tallyHost,
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to connect to Tally',
        tallyHost: tallyService.tallyHost,
      });
    }
  } catch (error) {
    console.error('❌ Connection test error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/tally/companies
 * @desc    Get list of companies from Tally
 * @access  Private (All authenticated users)
 */
router.get('/companies', protect, async (req, res) => {
  try {
    console.log('📊 Fetching companies from Tally...');
    
    const companies = await tallyService.getCompanies();

    res.status(200).json({
      success: true,
      count: companies.length,
      data: companies,
    });
  } catch (error) {
    console.error('❌ Get companies error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/tally/trial-balance
 * @desc    Get Trial Balance report
 * @access  Private (Admin & Manager only)
 * @query   fromDate - Start date (YYYYMMDD format, optional)
 * @query   toDate - End date (YYYYMMDD format, optional)
 */
router.get('/trial-balance', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    console.log('📊 Fetching Trial Balance from Tally...');
    console.log(`   Period: ${fromDate || 'Default'} to ${toDate || 'Default'}`);

    const trialBalance = await tallyService.getTrialBalance(fromDate, toDate);

    res.status(200).json({
      success: true,
      data: trialBalance,
      filters: {
        fromDate: fromDate || 'Default (Apr 1, 2024)',
        toDate: toDate || 'Default (Mar 31, 2025)',
      },
    });
  } catch (error) {
    console.error('❌ Get trial balance error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/tally/ledgers
 * @desc    Get list of all ledgers
 * @access  Private (Admin & Manager only)
 */
router.get('/ledgers', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    console.log('📊 Fetching Ledgers from Tally...');

    const ledgers = await tallyService.getLedgers();

    res.status(200).json({
      success: true,
      count: ledgers.length,
      data: ledgers,
    });
  } catch (error) {
    console.error('❌ Get ledgers error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/tally/day-book
 * @desc    Get Day Book report
 * @access  Private (Admin & Manager only)
 * @query   fromDate - Start date (YYYYMMDD format, optional)
 * @query   toDate - End date (YYYYMMDD format, optional)
 */
router.get('/day-book', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    console.log('📊 Fetching Day Book from Tally...');
    console.log(`   Period: ${fromDate || 'Default'} to ${toDate || 'Default'}`);

    const dayBook = await tallyService.getDayBook(fromDate, toDate);

    res.status(200).json({
      success: true,
      data: dayBook,
      filters: {
        fromDate: fromDate || 'Default (Apr 1, 2024)',
        toDate: toDate || 'Default (Mar 31, 2025)',
      },
    });
  } catch (error) {
    console.error('❌ Get day book error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/tally/reports/summary
 * @desc    Get summary of available reports (for dashboard)
 * @access  Private (All authenticated users - role-based filtering)
 */
router.get('/reports/summary', protect, async (req, res) => {
  try {
    const userRole = req.user.role;

    // Define available reports based on user role
    const reportsAccess = {
      admin: [
        { name: 'Trial Balance', endpoint: '/api/tally/trial-balance', access: true },
        { name: 'Ledgers', endpoint: '/api/tally/ledgers', access: true },
        { name: 'Day Book', endpoint: '/api/tally/day-book', access: true },
        { name: 'Companies', endpoint: '/api/tally/companies', access: true },
      ],
      manager: [
        { name: 'Trial Balance', endpoint: '/api/tally/trial-balance', access: true },
        { name: 'Ledgers', endpoint: '/api/tally/ledgers', access: true },
        { name: 'Day Book', endpoint: '/api/tally/day-book', access: true },
        { name: 'Companies', endpoint: '/api/tally/companies', access: true },
      ],
      employee: [
        { name: 'Companies', endpoint: '/api/tally/companies', access: true },
        { name: 'Trial Balance', endpoint: '/api/tally/trial-balance', access: false },
        { name: 'Ledgers', endpoint: '/api/tally/ledgers', access: false },
        { name: 'Day Book', endpoint: '/api/tally/day-book', access: false },
      ],
    };

    res.status(200).json({
      success: true,
      role: userRole,
      availableReports: reportsAccess[userRole] || [],
    });
  } catch (error) {
    console.error('❌ Get reports summary error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;