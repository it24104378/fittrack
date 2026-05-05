const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

const userPayload = (user, token) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  age: user.age,
  weight: user.weight,
  height: user.height,
  fitnessLevel: user.fitnessLevel,
  ...(token && { token }),
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, age, gender, weight, height, fitnessLevel } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }
    const user = await User.create({ name, email, password, age, gender, weight, height, fitnessLevel, role: 'user' });
    res.status(201).json({ success: true, data: userPayload(user, generateToken(user._id)) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    res.status(200).json({ success: true, data: userPayload(user, generateToken(user._id)) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  res.status(200).json({ success: true, data: req.user });
});

// PUT /api/auth/profile
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, age, weight, height, fitnessLevel, gender } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, age, weight, height, fitnessLevel, gender },
      { new: true, runValidators: true }
    );
    res.status(200).json({ success: true, data: userPayload(user, null) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/auth/change-password
router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.matchPassword(currentPassword))) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    user.password = newPassword;
    await user.save();
    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/auth/profile
router.delete('/profile', protect, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user._id);
    res.status(200).json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/auth/seed-admin
router.post('/seed-admin', async (req, res) => {
  try {
    const exists = await User.findOne({ role: 'admin' });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Admin already exists' });
    }
    const admin = await User.create({ name: 'Admin', email: 'admin@fittrack.com', password: 'Admin@1234', role: 'admin' });
    res.status(201).json({ success: true, message: 'Admin created', data: { email: admin.email } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── ADMIN ROUTES ──────────────────────────────────────────────────────────────

// GET /api/auth/admin/users
router.get('/admin/users', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find({
      role: { $in: ['user', null, undefined] },
      _id: { $ne: req.user._id },
    }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/auth/admin/users/:id
router.get('/admin/users/:id', protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/auth/admin/users/:id
router.put('/admin/users/:id', protect, adminOnly, async (req, res) => {
  try {
    const { name, email, age, weight, height, fitnessLevel, gender } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, age, weight, height, fitnessLevel, gender },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/auth/admin/users/:id
router.delete('/admin/users/:id', protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    await require('../models/Workout').deleteMany({ user: req.params.id });
    res.status(200).json({ success: true, message: 'User and their data deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/auth/admin/workouts
router.get('/admin/workouts', protect, adminOnly, async (req, res) => {
  try {
    const { userId } = req.query;
    const filter = userId ? { user: userId } : {};
    const workouts = await require('../models/Workout')
      .find(filter)
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: workouts.length, data: workouts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/auth/admin/workouts/:id
router.delete('/admin/workouts/:id', protect, adminOnly, async (req, res) => {
  try {
    const workout = await require('../models/Workout').findByIdAndDelete(req.params.id);
    if (!workout) return res.status(404).json({ success: false, message: 'Workout not found' });
    res.status(200).json({ success: true, message: 'Workout deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/auth/admin/stats  ← FIXED: counts users with no role field too
router.get('/admin/stats', protect, adminOnly, async (req, res) => {
  try {
    const Workout = require('../models/Workout');
    const totalUsers = await User.countDocuments({
      role: { $in: ['user', null, undefined] },
      _id: { $ne: req.user._id },
    });
    const totalWorkouts = await Workout.countDocuments();
    const completedWorkouts = await Workout.countDocuments({ status: 'completed' });
    const plannedWorkouts = await Workout.countDocuments({ status: 'planned' });
    res.status(200).json({
      success: true,
      data: { totalUsers, totalWorkouts, completedWorkouts, plannedWorkouts },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
