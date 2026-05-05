const express = require('express');
const router = express.Router();
const {
  getExercises, getExercise, createExercise,
  updateExercise, deleteExercise, getByMuscle, seedExercises,
} = require('../controllers/exerciseController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/by-muscle', getByMuscle);
router.post('/seed', adminOnly, seedExercises);

router.route('/').get(getExercises).post(createExercise);
router.route('/:id').get(getExercise).put(updateExercise).delete(deleteExercise);

module.exports = router;
