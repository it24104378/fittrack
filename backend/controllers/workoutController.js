const Workout = require('../models/Workout');

// @desc  Get all workouts for logged-in user
// @route GET /api/workouts
// @access Private
const getWorkouts = async (req, res) => {
  try {
    const { status, category, page = 1, limit = 10 } = req.query;
    const filter = { user: req.user._id };
    if (status) filter.status = status;
    if (category) filter.category = category;

    const skip = (page - 1) * limit;
    const workouts = await Workout.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Workout.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: workouts.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: workouts,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get single workout
// @route GET /api/workouts/:id
// @access Private
const getWorkout = async (req, res) => {
  try {
    const workout = await Workout.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!workout) {
      return res.status(404).json({ success: false, message: 'Workout not found' });
    }
    res.status(200).json({ success: true, data: workout });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Create workout
// @route POST /api/workouts
// @access Private
const createWorkout = async (req, res) => {
  try {
    // Normalize incoming fields to match schema
    const body = { ...req.body };
    if (body.duration && !body.durationMinutes) body.durationMinutes = body.duration;
    if (body.durationMin && !body.durationMinutes) body.durationMinutes = body.durationMin;
    if (body.minutes && !body.durationMinutes) body.durationMinutes = body.minutes;
    if (body.calories && !body.caloriesBurned) body.caloriesBurned = body.calories;
    if (body.caloriesEstimate && !body.caloriesBurned) body.caloriesBurned = body.caloriesEstimate;
    if (body.addedExercises && !body.exercises) body.exercises = body.addedExercises;
    if (body.workoutExercises && !body.exercises) body.exercises = body.workoutExercises;
    if (body.scheduledAt && !body.scheduledDate) body.scheduledDate = body.scheduledAt;
    if (body.completedAt && !body.completedDate) body.completedDate = body.completedAt;
    if (body.isCompleted && !body.status) body.status = body.isCompleted === true ? 'completed' : body.status;

    body.user = req.user._id;
    const workout = await Workout.create(body);
    res.status(201).json({ success: true, data: workout });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Update workout
// @route PUT /api/workouts/:id
// @access Private
const updateWorkout = async (req, res) => {
  try {
    // Normalize incoming fields
    const body = { ...req.body };
    if (body.duration && !body.durationMinutes) body.durationMinutes = body.duration;
    if (body.durationMin && !body.durationMinutes) body.durationMinutes = body.durationMin;
    if (body.minutes && !body.durationMinutes) body.durationMinutes = body.minutes;
    if (body.calories && !body.caloriesBurned) body.caloriesBurned = body.calories;
    if (body.caloriesEstimate && !body.caloriesBurned) body.caloriesBurned = body.caloriesEstimate;
    if (body.addedExercises && !body.exercises) body.exercises = body.addedExercises;
    if (body.workoutExercises && !body.exercises) body.exercises = body.workoutExercises;
    if (body.scheduledAt && !body.scheduledDate) body.scheduledDate = body.scheduledAt;
    if (body.completedAt && !body.completedDate) body.completedDate = body.completedAt;
    if (body.isCompleted && !body.status) body.status = body.isCompleted === true ? 'completed' : body.status;

    const workout = await Workout.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      body,
      { new: true, runValidators: true }
    );
    if (!workout) {
      return res.status(404).json({ success: false, message: 'Workout not found' });
    }
    res.status(200).json({ success: true, data: workout });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Delete workout
// @route DELETE /api/workouts/:id
// @access Private
const deleteWorkout = async (req, res) => {
  try {
    const workout = await Workout.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!workout) {
      return res.status(404).json({ success: false, message: 'Workout not found' });
    }
    res.status(200).json({ success: true, message: 'Workout deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Mark workout as completed
// @route PATCH /api/workouts/:id/complete
// @access Private
const completeWorkout = async (req, res) => {
  try {
    const workout = await Workout.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { status: 'completed', completedDate: new Date(), ...req.body },
      { new: true }
    );
    if (!workout) {
      return res.status(404).json({ success: false, message: 'Workout not found' });
    }
    res.status(200).json({ success: true, data: workout });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── ADMIN FUNCTIONS ────────────────────────────────────────

// @desc    Create workout for any user (admin)
// @route   POST /api/workouts/admin
// @access  Private/Admin
const adminCreateWorkout = async (req, res) => {
  try {
    const { userId, ...workoutData } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    // Normalize incoming fields for admin path too
    if (workoutData.duration && !workoutData.durationMinutes) workoutData.durationMinutes = workoutData.duration;
    if (workoutData.durationMin && !workoutData.durationMinutes) workoutData.durationMinutes = workoutData.durationMin;
    if (workoutData.minutes && !workoutData.durationMinutes) workoutData.durationMinutes = workoutData.minutes;
    if (workoutData.calories && !workoutData.caloriesBurned) workoutData.caloriesBurned = workoutData.calories;
    if (workoutData.caloriesEstimate && !workoutData.caloriesBurned) workoutData.caloriesBurned = workoutData.caloriesEstimate;
    if (workoutData.addedExercises && !workoutData.exercises) workoutData.exercises = workoutData.addedExercises;
    if (workoutData.workoutExercises && !workoutData.exercises) workoutData.exercises = workoutData.workoutExercises;
    if (workoutData.scheduledAt && !workoutData.scheduledDate) workoutData.scheduledDate = workoutData.scheduledAt;
    if (workoutData.completedAt && !workoutData.completedDate) workoutData.completedDate = workoutData.completedAt;
    if (workoutData.isCompleted && !workoutData.status) workoutData.status = workoutData.isCompleted === true ? 'completed' : workoutData.status;

    workoutData.user = userId;
    const workout = await Workout.create(workoutData);
    res.status(201).json({ success: true, data: workout });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update any workout (admin)
// @route   PUT /api/workouts/admin/:id
// @access  Private/Admin
const adminUpdateWorkout = async (req, res) => {
  try {
    // Normalize incoming fields
    const body = { ...req.body };
    if (body.duration && !body.durationMinutes) body.durationMinutes = body.duration;
    if (body.durationMin && !body.durationMinutes) body.durationMinutes = body.durationMin;
    if (body.minutes && !body.durationMinutes) body.durationMinutes = body.minutes;
    if (body.calories && !body.caloriesBurned) body.caloriesBurned = body.calories;
    if (body.caloriesEstimate && !body.caloriesBurned) body.caloriesBurned = body.caloriesEstimate;
    if (body.addedExercises && !body.exercises) body.exercises = body.addedExercises;
    if (body.workoutExercises && !body.exercises) body.exercises = body.workoutExercises;
    if (body.scheduledAt && !body.scheduledDate) body.scheduledDate = body.scheduledAt;
    if (body.completedAt && !body.completedDate) body.completedDate = body.completedAt;
    if (body.isCompleted && !body.status) body.status = body.isCompleted === true ? 'completed' : body.status;

    const workout = await Workout.findByIdAndUpdate(
      req.params.id,
      body,
      { new: true, runValidators: true }
    );
    if (!workout) {
      return res.status(404).json({ success: false, message: 'Workout not found' });
    }
    res.status(200).json({ success: true, data: workout });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getWorkouts,
  getWorkout,
  createWorkout,
  updateWorkout,
  deleteWorkout,
  completeWorkout,
  adminCreateWorkout,
  adminUpdateWorkout,
};



//module.exports = { getWorkouts, getWorkout, createWorkout, updateWorkout, deleteWorkout, completeWorkout };
