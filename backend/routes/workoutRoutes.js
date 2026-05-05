const express = require('express');
const router = express.Router();
const {
  getWorkouts, getWorkout, createWorkout,
  updateWorkout, deleteWorkout, completeWorkout,
  adminCreateWorkout, adminUpdateWorkout,
} = require('../controllers/workoutController');
const { protect, adminOnly } = require('../middleware/authMiddleware');   // ← added adminOnly

router.use(protect);

// ─────────── USER ROUTES ───────────
router.route('/')
  .get(getWorkouts)
  .post(createWorkout);

router.route('/:id')
  .get(getWorkout)
  .put(updateWorkout)
  .delete(deleteWorkout);

router.patch('/:id/complete', completeWorkout);

// ─────────── ADMIN ROUTES ───────────
router.post('/admin', adminOnly, adminCreateWorkout);
router.put('/admin/:id', adminOnly, adminUpdateWorkout);

module.exports = router;