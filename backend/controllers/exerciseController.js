const Exercise = require('../models/Exercise');

// @desc  Get all exercises (global + user's own, or admin can filter by userId)
// @route GET /api/exercises
// @access Private
const getExercises = async (req, res) => {
  try {
    const { muscleGroup, equipment, category, difficulty, search, userId } = req.query;

    let filter = {};

    if (req.user.role === 'admin') {
      // Admin can optionally filter by a specific user
      if (userId) {
        filter = {
          $or: [{ isGlobal: true }, { createdBy: userId }],
        };
      }
      // If no userId, admin sees all exercises – no ownership filter
    } else {
      // Regular user sees global + their own
      filter = {
        $or: [{ isGlobal: true }, { createdBy: req.user._id }],
      };
    }

    if (muscleGroup) filter.muscleGroup = muscleGroup;
    if (equipment) filter.equipment = equipment;
    if (category) filter.category = category;
    if (difficulty) filter.difficulty = difficulty;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const exercises = await Exercise.find(filter)
      .populate('createdBy', 'name email')
      .sort({ isGlobal: -1, name: 1 });

    res.status(200).json({ success: true, count: exercises.length, data: exercises });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get single exercise
// @route GET /api/exercises/:id
// @access Private
const getExercise = async (req, res) => {
  try {
    const exercise = await Exercise.findOne({
      _id: req.params.id,
      $or: [{ isGlobal: true }, { createdBy: req.user._id }],
    }).populate('createdBy', 'name email');

    if (!exercise) {
      return res.status(404).json({ success: false, message: 'Exercise not found' });
    }
    res.status(200).json({ success: true, data: exercise });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Create exercise
// @route POST /api/exercises
// @access Private
const createExercise = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';

    if (isAdmin) {
      // Admin can create global OR assign to specific user
      if (req.body.targetUserId) {
        req.body.createdBy = req.body.targetUserId;
        req.body.isGlobal = false;
      } else if (req.body.isGlobal) {
        req.body.createdBy = req.user._id;
        req.body.isGlobal = true;
      } else {
        // Admin creates personal exercise
        req.body.createdBy = req.user._id;
        req.body.isGlobal = false;
      }
    } else {
      // Regular user always creates personal exercise
      req.body.createdBy = req.user._id;
      req.body.isGlobal = false;
    }

    const exercise = await Exercise.create(req.body);
    res.status(201).json({ success: true, data: exercise });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Update exercise
// @route PUT /api/exercises/:id
// @access Private
const updateExercise = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    let filter;

    // Determine access and assignment logic
    if (isAdmin) {
      // Admin can update any exercise
      filter = { _id: req.params.id };

      // Allow admin to reassign user
      if (req.body.targetUserId) {
        req.body.createdBy = req.body.targetUserId;
        req.body.isGlobal = false;
      } else if (req.body.isGlobal) {
        req.body.createdBy = req.user._id;
        req.body.isGlobal = true;
      } else {
        // if no target and not global, keep as personal (possibly admin's own)
        // we leave createdBy as is if not provided
      }
    } else {
      // Regular user can only update their own exercises
      filter = { _id: req.params.id, createdBy: req.user._id };

      // Force isGlobal false, ignore any targetUserId
      if (req.body.isGlobal !== undefined) req.body.isGlobal = false;
      delete req.body.createdBy;
      delete req.body.targetUserId;
    }

    const exercise = await Exercise.findOneAndUpdate(filter, req.body, {
      new: true,
      runValidators: true,
    });

    if (!exercise) {
      return res.status(404).json({ success: false, message: 'Exercise not found or not authorized' });
    }
    res.status(200).json({ success: true, data: exercise });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Delete exercise
// @route DELETE /api/exercises/:id
// @access Private
const deleteExercise = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';

    const filter = isAdmin
      ? { _id: req.params.id }
      : { _id: req.params.id, createdBy: req.user._id };

    const exercise = await Exercise.findOneAndDelete(filter);

    if (!exercise) {
      return res.status(404).json({ success: false, message: 'Exercise not found or not authorized' });
    }
    res.status(200).json({ success: true, message: 'Exercise deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get exercises grouped by muscle group (for workout builder)
// @route GET /api/exercises/by-muscle
// @access Private
const getByMuscle = async (req, res) => {
  try {
    const exercises = await Exercise.find({
      $or: [{ isGlobal: true }, { createdBy: req.user._id }],
    }).sort({ name: 1 });

    const grouped = exercises.reduce((acc, ex) => {
      const key = ex.muscleGroup;
      if (!acc[key]) acc[key] = [];
      acc[key].push(ex);
      return acc;
    }, {});

    res.status(200).json({ success: true, data: grouped });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Seed default global exercises (admin only)
// @route POST /api/exercises/seed
// @access Private/Admin
const seedExercises = async (req, res) => {
  try {
    const existing = await Exercise.countDocuments({ isGlobal: true });
    if (existing > 0) {
      return res.status(400).json({ success: false, message: `${existing} global exercises already exist` });
    }

    const defaults = [
      { name: 'Bench Press', muscleGroup: 'chest', equipment: 'barbell', category: 'strength', difficulty: 'intermediate', defaultSets: 4, defaultReps: 8, instructions: 'Lie on bench, grip bar slightly wider than shoulders, lower to chest, press up.', caloriesPerMinute: 8 },
      { name: 'Push Up', muscleGroup: 'chest', equipment: 'bodyweight', category: 'strength', difficulty: 'beginner', defaultSets: 3, defaultReps: 15, instructions: 'Place hands shoulder-width apart, lower chest to floor, push back up.', caloriesPerMinute: 7 },
      { name: 'Dumbbell Fly', muscleGroup: 'chest', equipment: 'dumbbell', category: 'strength', difficulty: 'beginner', defaultSets: 3, defaultReps: 12, instructions: 'Lie on bench, hold dumbbells above chest, lower out to sides, bring back together.', caloriesPerMinute: 6 },
      { name: 'Deadlift', muscleGroup: 'back', equipment: 'barbell', category: 'strength', difficulty: 'advanced', defaultSets: 4, defaultReps: 6, instructions: 'Stand over bar, hinge at hips, grip bar, drive through heels to stand upright.', caloriesPerMinute: 10 },
      { name: 'Pull Up', muscleGroup: 'back', equipment: 'pull-up bar', category: 'strength', difficulty: 'intermediate', defaultSets: 3, defaultReps: 8, instructions: 'Hang from bar, pull body up until chin clears bar, lower with control.', caloriesPerMinute: 8 },
      { name: 'Dumbbell Row', muscleGroup: 'back', equipment: 'dumbbell', category: 'strength', difficulty: 'beginner', defaultSets: 3, defaultReps: 12, instructions: 'Place knee on bench, pull dumbbell to hip, squeeze back, lower slowly.', caloriesPerMinute: 7 },
      { name: 'Overhead Press', muscleGroup: 'shoulders', equipment: 'barbell', category: 'strength', difficulty: 'intermediate', defaultSets: 4, defaultReps: 8, instructions: 'Hold bar at shoulder height, press overhead, lower back to shoulders.', caloriesPerMinute: 8 },
      { name: 'Lateral Raise', muscleGroup: 'shoulders', equipment: 'dumbbell', category: 'strength', difficulty: 'beginner', defaultSets: 3, defaultReps: 15, instructions: 'Hold dumbbells at sides, raise arms to shoulder height, lower slowly.', caloriesPerMinute: 5 },
      { name: 'Barbell Curl', muscleGroup: 'biceps', equipment: 'barbell', category: 'strength', difficulty: 'beginner', defaultSets: 3, defaultReps: 12, instructions: 'Hold bar with underhand grip, curl towards shoulders, lower with control.', caloriesPerMinute: 5 },
      { name: 'Dumbbell Curl', muscleGroup: 'biceps', equipment: 'dumbbell', category: 'strength', difficulty: 'beginner', defaultSets: 3, defaultReps: 12, instructions: 'Hold dumbbells, alternate curling to shoulder, lower with control.', caloriesPerMinute: 5 },
      { name: 'Tricep Dip', muscleGroup: 'triceps', equipment: 'bench', category: 'strength', difficulty: 'beginner', defaultSets: 3, defaultReps: 12, instructions: 'Place hands on bench, lower body by bending elbows, press back up.', caloriesPerMinute: 6 },
      { name: 'Skull Crusher', muscleGroup: 'triceps', equipment: 'barbell', category: 'strength', difficulty: 'intermediate', defaultSets: 3, defaultReps: 12, instructions: 'Lie on bench, hold bar above chest, lower to forehead, extend arms back up.', caloriesPerMinute: 6 },
      { name: 'Plank', muscleGroup: 'core', equipment: 'bodyweight', category: 'strength', difficulty: 'beginner', defaultSets: 3, defaultDurationSeconds: 60, instructions: 'Hold push-up position on forearms, keep body straight, engage core.', caloriesPerMinute: 4 },
      { name: 'Crunch', muscleGroup: 'core', equipment: 'bodyweight', category: 'strength', difficulty: 'beginner', defaultSets: 3, defaultReps: 20, instructions: 'Lie on back, hands behind head, curl shoulders off floor, lower slowly.', caloriesPerMinute: 5 },
      { name: 'Squat', muscleGroup: 'quadriceps', equipment: 'barbell', category: 'strength', difficulty: 'intermediate', defaultSets: 4, defaultReps: 8, instructions: 'Bar on upper back, feet shoulder-width, lower until thighs parallel, drive up.', caloriesPerMinute: 9 },
      { name: 'Leg Press', muscleGroup: 'quadriceps', equipment: 'cable machine', category: 'strength', difficulty: 'beginner', defaultSets: 4, defaultReps: 12, instructions: 'Sit in machine, feet on platform, push platform away, lower with control.', caloriesPerMinute: 7 },
      { name: 'Romanian Deadlift', muscleGroup: 'hamstrings', equipment: 'barbell', category: 'strength', difficulty: 'intermediate', defaultSets: 3, defaultReps: 10, instructions: 'Hold bar at hips, hinge forward keeping back straight, lower bar along legs.', caloriesPerMinute: 8 },
      { name: 'Leg Curl', muscleGroup: 'hamstrings', equipment: 'cable machine', category: 'strength', difficulty: 'beginner', defaultSets: 3, defaultReps: 12, instructions: 'Lie on machine, curl heels towards glutes, lower with control.', caloriesPerMinute: 5 },
      { name: 'Hip Thrust', muscleGroup: 'glutes', equipment: 'barbell', category: 'strength', difficulty: 'intermediate', defaultSets: 4, defaultReps: 10, instructions: 'Upper back on bench, bar across hips, drive hips up, squeeze glutes at top.', caloriesPerMinute: 7 },
      { name: 'Calf Raise', muscleGroup: 'calves', equipment: 'dumbbell', category: 'strength', difficulty: 'beginner', defaultSets: 4, defaultReps: 20, instructions: 'Stand on edge of step, raise onto toes, lower heels below step level.', caloriesPerMinute: 4 },
      { name: 'Running', muscleGroup: 'cardio', equipment: 'treadmill', category: 'cardio', difficulty: 'beginner', defaultDurationSeconds: 1800, instructions: 'Maintain steady pace, land midfoot, keep upright posture.', caloriesPerMinute: 12 },
      { name: 'Kettlebell Swing', muscleGroup: 'full body', equipment: 'kettlebell', category: 'strength', difficulty: 'intermediate', defaultSets: 4, defaultReps: 15, instructions: 'Hinge at hips, swing kettlebell between legs, drive hips forward to swing up.', caloriesPerMinute: 10 },
      { name: 'Burpee', muscleGroup: 'full body', equipment: 'bodyweight', category: 'plyometric', difficulty: 'intermediate', defaultSets: 3, defaultReps: 10, instructions: 'Squat down, jump feet back to plank, do push-up, jump feet forward, jump up.', caloriesPerMinute: 12 },
    ];

    const toInsert = defaults.map(ex => ({ ...ex, isGlobal: true, createdBy: req.user._id }));
    await Exercise.insertMany(toInsert);

    res.status(201).json({ success: true, message: `${toInsert.length} default exercises added`, count: toInsert.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getExercises, getExercise, createExercise, updateExercise, deleteExercise, getByMuscle, seedExercises };