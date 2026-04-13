// src/routes/taskRoutes.js
// Routes for task management

const express = require('express');
const router = express.Router();
const Task = require('../models/task');
const TaskUpdate = require('../models/taskUpdate');
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

    // Log initial task creation as an update entry
    await TaskUpdate.create({
      taskId: task.id,
      userId: req.user.id,
      userName: req.user.name,
      title: 'Task Created',
      description: `Task "${title}" was created and assigned`,
      status: status || 'pending',
      previousStatus: null,
    });

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
 * @access  Private (Admins see all unless filtered, Managers/Employees only see theirs)
 */
router.get('/', protect, async (req, res) => {
  try {
    let { assignedTo, status, limit, offset } = req.query;

    // Security: Employees and Managers can only view their own tasks
    if (req.user.role === 'employee' || req.user.role === 'manager') {
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
 * @route   GET /api/tasks/user/counts
 * @desc    Get aggregate counts of tasks for the logged in user
 * @access  Private
 */
router.get('/user/counts', protect, async (req, res) => {
  try {
    const counts = await Task.getCountsForUser(req.user.id, req.user.role);
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
 * @route   GET /api/tasks/:id
 * @desc    Get a single task by ID (includes update history)
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

    // Include update history in task detail
    const updates = await TaskUpdate.findByTaskId(req.params.id);

    res.status(200).json({
      success: true,
      data: {
        ...task,
        updates,
      },
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
 * @route   GET /api/tasks/:id/updates
 * @desc    Get all status updates for a task
 * @access  Private
 */
router.get('/:id/updates', protect, async (req, res) => {
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

    const updates = await TaskUpdate.findByTaskId(req.params.id);

    res.status(200).json({
      success: true,
      count: updates.length,
      data: updates,
    });
  } catch (error) {
    console.error('Error fetching task updates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch task updates',
    });
  }
});

/**
 * @route   POST /api/tasks/:id/updates
 * @desc    Add a status update to a task (employee progress log)
 * @access  Private
 */
router.post('/:id/updates', protect, async (req, res) => {
  try {
    const { title, description, status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required',
      });
    }

    const allowedStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${allowedStatuses.join(', ')}`,
      });
    }

    let task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    // Security: Employees can only update their own tasks
    if (req.user.role === 'employee' && task.assignedTo !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this task',
      });
    }

    const previousStatus = task.status;

    // Create the update log entry
    const update = await TaskUpdate.create({
      taskId: req.params.id,
      userId: req.user.id,
      userName: req.user.name,
      title: title || null,
      description: description || null,
      status,
      previousStatus,
    });

    // Also update the task's actual status
    task = await Task.updateStatus(req.params.id, status);

    // Notify the assigner (admin/manager) about this update — skip if updater IS the assigner
    if (task.assignedBy && task.assignedBy !== req.user.id) {
      const statusInfo = previousStatus !== status
        ? ` (status: ${previousStatus} → ${status})`
        : '';
      await Notification.create({
        userId: task.assignedBy,
        title: 'Task Update',
        message: `${req.user.name} posted an update on "${task.title}"${statusInfo}${title ? `: ${title}` : ''}`,
        type: 'alert',
        relatedTaskId: task.id,
      });
    }

    // Notify the assigned employee about this update — skip if updater IS the assignee
    if (task.assignedTo && task.assignedTo !== req.user.id) {
      const statusInfo = previousStatus !== status
        ? ` (status: ${previousStatus} → ${status})`
        : '';
      await Notification.create({
        userId: task.assignedTo,
        title: 'Task Update',
        message: `${req.user.name} posted an update on "${task.title}"${statusInfo}${title ? `: ${title}` : ''}`,
        type: 'alert',
        relatedTaskId: task.id,
      });
    }

    res.status(201).json({
      success: true,
      data: { task, update },
      message: 'Task update logged successfully',
    });
  } catch (error) {
    console.error('Error creating task update:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create task update',
    });
  }
});

/**
 * @route   PUT /api/tasks/:id/status
 * @desc    Update task status (e.g. mark completed) — also logs to update history
 * @access  Private
 */
router.put('/:id/status', protect, async (req, res) => {
  try {
    const { status, updateTitle, updateDescription } = req.body;
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

    // Log this status change in the update history
    if (prevStatus !== status) {
      await TaskUpdate.create({
        taskId: task.id,
        userId: req.user.id,
        userName: req.user.name,
        title: updateTitle || `Status changed to ${status}`,
        description: updateDescription || null,
        status,
        previousStatus: prevStatus,
      });
    }

    // Notify the assigner about status change — skip if the updater IS the assigner
    if (prevStatus !== status && task.assignedBy && task.assignedBy !== req.user.id) {
      const statusLabel = status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
      await Notification.create({
        userId: task.assignedBy,
        title: `Task ${statusLabel}`,
        message: `${req.user.name} changed "${task.title}" from ${prevStatus.replace('_', ' ')} to ${status.replace('_', ' ')}.`,
        type: 'alert',
        relatedTaskId: task.id,
      });
    }

    // Notify the assigned employee about status change — skip if the updater IS the assignee
    if (prevStatus !== status && task.assignedTo && task.assignedTo !== req.user.id) {
      const statusLabel = status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
      await Notification.create({
        userId: task.assignedTo,
        title: `Task ${statusLabel}`,
        message: `${req.user.name} changed "${task.title}" from ${prevStatus.replace('_', ' ')} to ${status.replace('_', ' ')}.`,
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

    if (req.body.status !== undefined) {
      const allowedStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
      if (!allowedStatuses.includes(req.body.status)) {
        return res.status(400).json({
          success: false,
          message: 'Status must be one of: pending, in_progress, completed, cancelled',
        });
      }
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
