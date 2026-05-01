// src/routes/notificationRoutes.js
// Routes for app notifications

const express = require('express');
const router = express.Router();
const Notification = require('../models/notification');
const { protect } = require('../middleware/auth');

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications for logged in user
 * @access  Private
 */
router.get('/', protect, async (req, res) => {
  try {
    const { limit, offset, mode, dateFilter } = req.query;
    const notifications = await Notification.findForUser(
      req.user,
      mode,
      parseInt(limit) || 50,
      parseInt(offset) || 0,
      dateFilter
    );

    const unreadCount = await Notification.getUnreadCountForUser(req.user, mode);

    res.status(200).json({
      success: true,
      count: notifications.length,
      unreadCount,
      data: notifications,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
    });
  }
});

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark a single notification as read
 * @access  Private
 */
router.put('/:id/read', protect, async (req, res) => {
  try {
    const notification = await Notification.markAsRead(req.params.id, req.user.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or not owned by user',
      });
    }

    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification',
    });
  }
});

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Mark all notifications as read for logged in user
 * @access  Private
 */
router.put('/read-all', protect, async (req, res) => {
  try {
    await Notification.markAllAsRead(req.user.id);

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notifications',
    });
  }
});

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification
 * @access  Private
 */
router.delete('/:id', protect, async (req, res) => {
  try {
    const success = await Notification.delete(req.params.id, req.user.id);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or not owned by user',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
    });
  }
});

module.exports = router;
