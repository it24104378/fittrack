const Progress = require('../models/Progress');

// ─── USER FUNCTIONS ────────────────────────────────────────

// @desc    Add new progress entry
// @route   POST /api/progress
// @access  Private
const addProgress = async (req, res) => {
  try {
    req.body.user = req.user._id;
    if (req.file) req.body.image = req.file.path; // multer adds file info

    const progress = await Progress.create(req.body);

    res.status(201).json({ success: true, data: progress });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all progress entries for logged-in user
// @route   GET /api/progress
// @access  Private
const getMyProgress = async (req, res) => {
  try {
    const progress = await Progress.find({ user: req.user._id })
      .sort({ date: -1 });

    res.status(200).json({ success: true, count: progress.length, data: progress });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single progress entry
// @route   GET /api/progress/:id
// @access  Private (owner)
const getProgressById = async (req, res) => {
  try {
    const progress = await Progress.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!progress) {
      return res.status(404).json({ success: false, message: 'Progress entry not found' });
    }

    res.status(200).json({ success: true, data: progress });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update progress entry
// @route   PUT /api/progress/:id
// @access  Private (owner)
const updateProgress = async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (req.file) updateData.image = req.file.path;

    const progress = await Progress.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updateData,
      { new: true, runValidators: true }
    );

    if (!progress) {
      return res.status(404).json({ success: false, message: 'Progress entry not found' });
    }

    res.status(200).json({ success: true, data: progress });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete progress entry
// @route   DELETE /api/progress/:id
// @access  Private (owner)
const deleteProgress = async (req, res) => {
  try {
    const progress = await Progress.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!progress) {
      return res.status(404).json({ success: false, message: 'Progress entry not found' });
    }

    res.status(200).json({ success: true, message: 'Progress entry deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── ADMIN FUNCTIONS ──────────────────────────────────────

// @desc    Get all progress entries for any user (admin)
// @route   GET /api/progress/admin/all
// @access  Private/Admin
const adminGetAllProgress = async (req, res) => {
  try {
    const { userId } = req.query;
    const filter = {};
    if (userId) filter.user = userId;

    const progress = await Progress.find(filter)
      .populate('user', 'name email')
      .sort({ date: -1 });

    res.status(200).json({ success: true, count: progress.length, data: progress });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add progress for a specific user (admin)
// @route   POST /api/progress/admin
// @access  Private/Admin
const adminAddProgress = async (req, res) => {
  try {
    const { userId, weight, calories, date, notes, chest, waist, hips } = req.body;
    if (!userId || !weight || !calories) {
      return res.status(400).json({ success: false, message: 'User ID, weight and calories are required' });
    }

    const progressData = { user: userId, weight, calories, date, notes, chest, waist, hips };
    if (req.file) progressData.image = req.file.path;

    const progress = await Progress.create(progressData);

    res.status(201).json({ success: true, data: progress });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update any progress entry (admin)
// @route   PUT /api/progress/admin/:id
// @access  Private/Admin
const adminUpdateProgress = async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (req.file) updateData.image = req.file.path;

    const progress = await Progress.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!progress) {
      return res.status(404).json({ success: false, message: 'Progress entry not found' });
    }

    res.status(200).json({ success: true, data: progress });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete any progress entry (admin)
// @route   DELETE /api/progress/admin/:id
// @access  Private/Admin
const adminDeleteProgress = async (req, res) => {
  try {
    const progress = await Progress.findByIdAndDelete(req.params.id);
    if (!progress) {
      return res.status(404).json({ success: false, message: 'Progress entry not found' });
    }
    res.status(200).json({ success: true, message: 'Progress entry deleted' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  addProgress,
  getMyProgress,
  getProgressById,
  updateProgress,
  deleteProgress,
  adminGetAllProgress,
  adminAddProgress,
  adminUpdateProgress,
  adminDeleteProgress,
};