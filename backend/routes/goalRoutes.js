const express = require('express');
const router = express.Router();
const {
  createGoal,
  getMyGoals,
  getGoalById,
  updateGoal,
  deleteGoal,
  updateGoalStatus,
  updateProgress,
} = require('../controllers/goalController');
const { protect } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

router.route('/')
  .post(createGoal);

router.route('/my-goals')
  .get(getMyGoals);

router.route('/:id')
  .get(getGoalById)
  .put(updateGoal)
  .delete(deleteGoal);

router.patch('/:id/status', updateGoalStatus);
router.patch('/:id/progress', updateProgress);

module.exports = router;