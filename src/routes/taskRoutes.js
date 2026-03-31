// src/routes/taskRoutes.js
// Routes for task management

const express = require('express');
const router = express.Router();
const Task = require('../models/task');
const Notification = require('../models/notification');
const User = require('../models/user');
const { protect, authorize } = require('../middleware/auth');

/**
 * @route   POST /api/tasks
 * @desc    Create a new task and notify the assignee
 * @access  Private (Admin & Manager only)
 */
router.post('/', protect, async (req, res) => {
  try {
    let { title, description, category, priority, assignedTo, clientName, dueDate, status } = req.body;

    if (req.user.role === 'employee') {
      assignedTo = req.user.id;
    }

    if (!title || !assignedTo) {
      return res.status(400).json({
        success: false,
        message: 'Title and assignedTo are required',
      });
    }

    // Verify assignee exists
    const assignee = await User.findById(assignedTo);
    if (!assignee) {
      return res.status(404).json({
        success: false,
        message: 'Assigned user not found',
      });
    }

    const task = await Task.create({
      title,
      description,
      category,
      priority,
      assignedTo,
      assignedBy: req.user.id,
      clientName,
      dueDate,
    });

    if (status) {
      await Task.updateStatus(task.id, status);
      task.status = status;
    }

    if (req.user.role === 'employee') {
      await Notification.create({
        userId: req.user.id,
        title: 'New Task Logged',
        message: `You logged a new task: "${title}"`,
        type: 'task',
        relatedTaskId: task.id,
      });
    } else {
      // Notify assignee
      await Notification.create({
        userId: assignedTo,
        title: 'New Task Assigned',
        message: `${req.user.name} assigned you a new ${priority || 'normal'} priority task: "${title}"`,
        type: 'task',
        relatedTaskId: task.id,
      });

      // Notify assigner (admin/manager)
      if (req.user.id !== assignedTo) {
        await Notification.create({
          userId: req.user.id,
          title: 'Task Assigned Successfully',
          message: `You assigned a new ${priority || 'normal'} priority task to ${assignee.name}: "${title}"`,
          type: 'task',
          relatedTaskId: task.id,
        });
      }
    }

    res.status(201).json({
      success: true,
      data: task,
      message: 'Task created and assigned successfully',
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create task',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/tasks
 * @desc    Get tasks (filter by assignedTo, status)
 * @access  Private (Admins/Managers see all unless filtered, Employees only see theirs)
 */
router.get('/', protect, async (req, res) => {
  try {
    let { assignedTo, status, limit, offset } = req.query;

    // Security: Employees can only view their own tasks
    if (req.user.role === 'employee') {
      assignedTo = req.user.id;
    }

    const tasks = await Task.findAll({
      assignedTo,
      status,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
    });

    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks,
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks',
    });
  }
});

/**
 * @route   GET /api/tasks/:id
 * @desc    Get a single task by ID
 * @access  Private
 */
router.get('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    // Security: Employees can only view their own tasks
    if (req.user.role === 'employee' && task.assignedTo !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this task',
      });
    }

    res.status(200).json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch task',
    });
  }
});

/**
 * @route   PUT /api/tasks/:id/status
 * @desc    Update task status (e.g. mark completed)
 * @access  Private
 */
router.put('/:id/status', protect, async (req, res) => {
  try {
    const { status } = req.body;
    let task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    // Security: Admins/Managers can update any, Employee can only update assigned ones
    if (req.user.role === 'employee' && task.assignedTo !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this task',
      });
    }

    // List of allowed statuses based on the PostgreSQL ENUM
    const allowedStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${allowedStatuses.join(', ')}`,
      });
    }

    const prevStatus = task.status;
    task = await Task.updateStatus(req.params.id, status);

    // If an employee completes/cancels a task, notify the assigner
    if (req.user.role === 'employee' && prevStatus !== status && ['completed', 'cancelled'].includes(status) && task.assignedBy) {
      await Notification.create({
        userId: task.assignedBy,
        title: `Task ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        message: `${req.user.name} has marked the task "${task.title}" as ${status}.`,
        type: 'alert',
        relatedTaskId: task.id,
      });
    }

    res.status(200).json({
      success: true,
      data: task,
      message: `Task marked as ${status}`,
    });
  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update task status',
    });
  }
});

/**
 * @route   GET /api/tasks/user/counts
 * @desc    Get aggregate counts of tasks for the logged in user
 * @access  Private
 */
router.get('/user/counts', protect, async (req, res) => {
  try {
    const counts = await Task.getCountsForUser(req.user.id);
    res.status(200).json({
      success: true,
      data: counts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch task counts',
    });
  }
});

/**
 * @route   PUT /api/tasks/:id
 * @desc    Update task details (title, description, priority, etc.)
 * @access  Private
 */
router.put('/:id', protect, async (req, res) => {
  try {
    let task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Security: Employees can only update their own tasks
    if (req.user.role === 'employee' && task.assignedTo !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this task' });
    }

    task = await Task.update(req.params.id, req.body);
    res.status(200).json({ success: true, data: task, message: 'Task updated successfully' });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ success: false, message: 'Failed to update task' });
  }
});

/**
 * @route   DELETE /api/tasks/:id
 * @desc    Delete a task
 * @access  Private
 */
router.delete('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Security: Employees can only delete their own tasks
    if (req.user.role === 'employee' && task.assignedTo !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this task' });
    }

    await Task.delete(req.params.id);
    res.status(200).json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ success: false, message: 'Failed to delete task' });
  }
});

module.exports = router;
