// GET /api/admin/stats  — dashboard overview numbers
// FIXED: counts users where role is 'user' OR role field doesn't exist
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
