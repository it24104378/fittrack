const Nutrition = require('../models/Nutrition');

// ─── USER FUNCTIONS ────────────────────────────────────────

// @desc    Add a new meal log
// @route   POST /api/nutrition
// @access  Private
const addMeal = async (req, res) => {
  try {
    const { date, mealType, items, notes } = req.body;

    if (!mealType || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Meal type and at least one food item are required',
      });
    }

    const totalCalories = items.reduce(
      (sum, item) => sum + (item.calories * item.quantity),
      0
    );

    const meal = new Nutrition({
      user: req.user._id,
      date,
      mealType,
      items,
      notes,
      totalCalories,
    });

    const savedMeal = await meal.save();

    res.status(201).json({
      success: true,
      message: 'Meal logged successfully',
      data: savedMeal,
    });
  } catch (error) {
    console.error('Error adding meal:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get all meal logs for logged-in user
// @route   GET /api/nutrition
// @access  Private
const getMeals = async (req, res) => {
  try {
    const meals = await Nutrition.find({ user: req.user._id })
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      count: meals.length,
      data: meals,
    });
  } catch (error) {
    console.error('Error fetching meals:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get a single meal log by ID
// @route   GET /api/nutrition/:id
// @access  Private
const getMealById = async (req, res) => {
  try {
    const meal = await Nutrition.findById(req.params.id);

    if (!meal) {
      return res.status(404).json({
        success: false,
        message: 'Meal not found',
      });
    }

    if (meal.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this meal',
      });
    }

    res.status(200).json({ success: true, data: meal });
  } catch (error) {
    console.error('Error fetching meal:', error.message);
    res.status(400).json({ success: false, message: 'Invalid meal ID' });
  }
};

// @desc    Update a meal log
// @route   PUT /api/nutrition/:id
// @access  Private
const updateMeal = async (req, res) => {
  try {
    const meal = await Nutrition.findById(req.params.id);

    if (!meal) {
      return res.status(404).json({
        success: false,
        message: 'Meal not found',
      });
    }

    if (meal.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this meal',
      });
    }

    const updatedMeal = await Nutrition.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Meal updated successfully',
      data: updatedMeal,
    });
  } catch (error) {
    console.error('Error updating meal:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete a meal log
// @route   DELETE /api/nutrition/:id
// @access  Private
const deleteMeal = async (req, res) => {
  try {
    const meal = await Nutrition.findById(req.params.id);

    if (!meal) {
      return res.status(404).json({
        success: false,
        message: 'Meal not found',
      });
    }

    if (meal.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this meal',
      });
    }

    await Nutrition.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Meal deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting meal:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get daily calorie summary for logged-in user
// @route   GET /api/nutrition/summary
// @access  Private
const getDailySummary = async (req, res) => {
  try {
    const summary = await Nutrition.aggregate([
      { $match: { user: req.user._id } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$date' },
          },
          totalCalories: { $sum: '$totalCalories' },
          mealCount: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          totalCalories: 1,
          mealCount: 1,
        },
      },
    ]);

    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    console.error('Error getting summary:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── ADMIN‑ONLY FUNCTIONS ─────────────────────────────────

// @desc    Get all meals (admin – any user)
// @route   GET /api/nutrition/admin/all
// @access  Private/Admin
const adminGetAllMeals = async (req, res) => {
  try {
    const { userId } = req.query; // optional filter by user
    const filter = {};
    if (userId) filter.user = userId;

    const meals = await Nutrition.find(filter)
      .populate('user', 'name email')
      .sort({ date: -1 });

    res.status(200).json({ success: true, count: meals.length, data: meals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single meal by ID (admin)
// @route   GET /api/nutrition/admin/:id
// @access  Private/Admin
const adminGetMealById = async (req, res) => {
  try {
    const meal = await Nutrition.findById(req.params.id).populate('user', 'name email');
    if (!meal) {
      return res.status(404).json({ success: false, message: 'Meal not found' });
    }
    res.status(200).json({ success: true, data: meal });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Invalid meal ID' });
  }
};

// @desc    Add a meal for a specific user (admin)
// @route   POST /api/nutrition/admin
// @access  Private/Admin
const adminAddMeal = async (req, res) => {
  try {
    const { userId, date, mealType, items, notes } = req.body;
    if (!userId || !mealType || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'User ID, meal type and at least one food item are required',
      });
    }

    const totalCalories = items.reduce(
      (sum, item) => sum + item.calories * item.quantity, 0
    );

    const meal = await Nutrition.create({
      user: userId,
      date: date || Date.now(),
      mealType,
      items,
      notes,
      totalCalories,
    });

    res.status(201).json({ success: true, data: meal });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update any meal (admin)
// @route   PUT /api/nutrition/admin/:id
// @access  Private/Admin
const adminUpdateMeal = async (req, res) => {
  try {
    const meal = await Nutrition.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!meal) {
      return res.status(404).json({ success: false, message: 'Meal not found' });
    }
    res.status(200).json({ success: true, data: meal });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete any meal (admin)
// @route   DELETE /api/nutrition/admin/:id
// @access  Private/Admin
const adminDeleteMeal = async (req, res) => {
  try {
    const meal = await Nutrition.findByIdAndDelete(req.params.id);
    if (!meal) {
      return res.status(404).json({ success: false, message: 'Meal not found' });
    }
    res.status(200).json({ success: true, message: 'Meal deleted' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
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
};