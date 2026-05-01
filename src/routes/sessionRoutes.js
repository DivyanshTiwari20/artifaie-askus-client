// src/routes/sessionRoutes.js
const express = require('express');
const router = express.Router();
const Session = require('../models/session');
const { protect } = require('../middleware/auth');

/**
 * GET /api/sessions - Get all active sessions for the logged-in user
 */
router.get('/', protect, async (req, res) => {
  try {
    const sessions = await Session.findByUserId(req.user.id);
    res.json({ success: true, data: sessions, count: sessions.length });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * DELETE /api/sessions/:id - Log out a specific session (remote logout)
 */
router.delete('/:id', protect, async (req, res) => {
  try {
    const deleted = await Session.deleteById(req.params.id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    res.json({ success: true, message: 'Session logged out successfully' });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
