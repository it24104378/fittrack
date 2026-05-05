const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
  addMeal,
  getMeals,
  getMealById,
  updateMeal,
  deleteMeal,
  getDailySummary,
  adminGetAllMeals,
  adminGetMealById,
  adminAddMeal,
  adminUpdateMeal,
  adminDeleteMeal,
} = require('../controllers/nutritionController');

// Aggregation before dynamic routes
router.get('/summary', protect, getDailySummary);

// ─── USER ROUTES ───────────────────────────────────────
router.route('/')
  .get(protect, getMeals)
  .post(protect, addMeal);

router.route('/:id')
  .get(protect, getMealById)
  .put(protect, updateMeal)
  .delete(protect, deleteMeal);

// ─── ADMIN ROUTES ──────────────────────────────────────
// Static admin paths must be before dynamic ones
router.get('/admin/all', protect, adminOnly, adminGetAllMeals);
router.get('/admin/:id', protect, adminOnly, adminGetMealById);
router.post('/admin', protect, adminOnly, adminAddMeal);
router.put('/admin/:id', protect, adminOnly, adminUpdateMeal);
router.delete('/admin/:id', protect, adminOnly, adminDeleteMeal);

module.exports = router;