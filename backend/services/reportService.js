const Progress = require('../models/Progress');
const Workout = require('../models/Workout');
const Nutrition = require('../models/Nutrition');
const Goal = require('../models/Goal');

// Calculate date range based on period
const getDateRange = (period) => {
  try {
    const endDate = new Date();
    const startDate = new Date();

    if (period === '7D') {
      startDate.setDate(endDate.getDate() - 7);
    } else if (period === '30D') {
      startDate.setDate(endDate.getDate() - 30);
    } else if (period === '90D') {
      startDate.setDate(endDate.getDate() - 90);
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    console.log(`Date range for ${period}:`, {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    return { startDate, endDate };
  } catch (error) {
    console.error('Error in getDateRange:', error);
    throw error;
  }
};

// Get streak (consecutive days with completed workouts)
const calculateStreak = async (userId) => {
  const workouts = await Workout.find({
    user: userId,
    status: 'completed',
  }).sort({ completedDate: -1 });

  if (workouts.length === 0) return 0;

  let streak = 1;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 1; i < workouts.length; i++) {
    const prevDate = new Date(workouts[i - 1].completedDate);
    const currDate = new Date(workouts[i].completedDate);
    prevDate.setHours(0, 0, 0, 0);
    currDate.setHours(0, 0, 0, 0);

    const diffTime = Math.abs(prevDate - currDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
};

// Generate overview data
const generateOverview = async (userId, startDate, endDate) => {
  const streak = await calculateStreak(userId);

  const workouts = await Workout.find({
    user: userId,
    completedDate: { $gte: startDate, $lte: endDate },
  });

  const caloriesBurned = workouts.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);

  const progressEntries = await Progress.find({
    user: userId,
    date: { $gte: startDate, $lte: endDate },
  }).sort({ date: 1 });

  let weightChange = 0;
  if (progressEntries.length >= 2) {
    const firstWeight = progressEntries[0].weight;
    const lastWeight = progressEntries[progressEntries.length - 1].weight;
    weightChange = Number((lastWeight - firstWeight).toFixed(1));
  }

  const goals = await Goal.find({
    userId,
    deadline: { $gte: startDate, $lte: endDate },
  });

  const goalsAchieved = goals.filter((g) => g.status === 'Achieved').length;

  const completionRate =
    workouts.length > 0
      ? Math.round((workouts.filter((w) => w.status === 'completed').length / workouts.length) * 100)
      : 0;

  return {
    streak,
    caloriesBurned,
    weightChange,
    weightChangePercent: progressEntries.length > 0 && progressEntries[0].weight > 0
      ? Number((((weightChange) / progressEntries[0].weight) * 100).toFixed(1))
      : 0,
    goalsDone: goalsAchieved,
    goalsTotal: goals.length,
    completionRate,
    totalDays: progressEntries.length,
    activityDays: workouts.length,
  };
};

// Generate weight data
const generateWeight = async (userId, startDate, endDate) => {
  const progressEntries = await Progress.find({
    user: userId,
    date: { $gte: startDate, $lte: endDate },
  }).sort({ date: 1 });

  if (progressEntries.length === 0) {
    return {
      weightTrendData: [],
      bestWeight: 0,
      worstWeight: 0,
      averageWeight: 0,
      totalChange: 0,
      changePercentage: 0,
    };
  }

  const weights = progressEntries.map((p) => p.weight);
  const bestWeight = Math.min(...weights);
  const worstWeight = Math.max(...weights);
  const averageWeight = Number((weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1));

  const weightTrendData = progressEntries.map((p) => ({
    date: p.date,
    weight: p.weight,
  }));

  const totalChange = progressEntries.length > 1
    ? Number((progressEntries[progressEntries.length - 1].weight - progressEntries[0].weight).toFixed(1))
    : 0;

  const changePercentage = progressEntries.length > 0 && progressEntries[0].weight > 0
    ? Number(((totalChange / progressEntries[0].weight) * 100).toFixed(1))
    : 0;

  return {
    weightTrendData,
    bestWeight,
    worstWeight,
    averageWeight,
    totalChange,
    changePercentage,
  };
};

// Generate workout data
const generateWorkout = async (userId, startDate, endDate) => {
  console.log('\n[generateWorkout] START - Querying workouts...');
  console.log(`[generateWorkout] User: ${userId}`);
  console.log(`[generateWorkout] Note: workout metrics are calculated across ALL workouts for the user (date range ignored)`);

  try {
    // Build the query using the correct `user` field (matches Workout schema)
    const mongoose = require('mongoose');
    // FIX: Use `new` keyword — mongoose.Types.ObjectId() without `new` throws TypeError in Mongoose 9
    const possibleObjectId = (typeof userId === 'string' && mongoose.Types.ObjectId.isValid(userId))
      ? new mongoose.Types.ObjectId(userId)
      : null;

    // Primary query: match by ObjectId or raw value of the `user` field
    const orClauses = [];
    if (possibleObjectId) orClauses.push({ user: possibleObjectId });
    orClauses.push({ user: userId });

    const query = orClauses.length > 0 ? { $or: orClauses } : { user: userId };
    console.log('[generateWorkout] Query for workouts:', JSON.stringify(query));

    // Fetch all workouts for metrics calculation
    let workouts = await Workout.find(query).lean();
    // Fallback: if query returned nothing, try a broad read and filter in-memory by user id string
    if ((!workouts || workouts.length === 0)) {
      try {
        const all = await Workout.find({}).lean();
        const uidStr = String(userId);
        const filtered = all.filter((w) => {
          try {
            return w.user && String(w.user) === uidStr || w.userId && String(w.userId) === uidStr;
          } catch (e) {
            return false;
          }
        });
        if (filtered && filtered.length > 0) {
          console.log('[generateWorkout] Fallback: matched workouts after in-memory filter', filtered.length);
          workouts = filtered;
        }
      } catch (fbErr) {
        console.log('[generateWorkout] Fallback in-memory filter failed:', fbErr.message);
      }
    }

    console.log(`[generateWorkout] ✅ Found ${workouts.length} workouts (sample ids: ${workouts.slice(0,5).map(w => w._id).join(', ')})`);

    if (!workouts || workouts.length === 0) {
      console.log('[generateWorkout] ⚠️  NO WORKOUTS FOUND - Returning empty data');
      return {
        total: 0,
        totalDuration: 0,
        completionRate: 0,
        split: {
          strength: 0,
          cardio: 0,
          flexibility: 0,
          hiit: 0,
          yoga: 0,
          sports: 0,
          custom: 0,
        },
        topExercises: [],
        workoutsList: [],
      };
    }

    // Normalization helper
    const normalizeWorkout = (w) => {
      const duration = w.durationMinutes ?? w.duration ?? w.durationMin ?? w.minutes ?? 0;
      const calories = w.caloriesBurned ?? w.calories ?? w.caloriesEstimate ?? 0;
      const exercises = Array.isArray(w.exercises)
        ? w.exercises
        : Array.isArray(w.addedExercises)
          ? w.addedExercises
          : Array.isArray(w.workoutExercises)
            ? w.workoutExercises
            : [];

      let status = '';
      if (typeof w.status === 'string') status = w.status.toLowerCase();
      else if (w.isCompleted === true || w.completed === true) status = 'completed';
      else if (w.isPlanned === true || w.scheduled === true) status = 'planned';

      const scheduledDate = w.scheduledDate ?? w.scheduledAt ?? w.startTime ?? w.date ?? null;
      const completedDate = w.completedDate ?? w.completedAt ?? w.finishedAt ?? w.dateCompleted ?? null;

      return {
        ...w,
        durationMinutes: Number(duration) || 0,
        caloriesBurned: Number(calories) || 0,
        exercises,
        status,
        scheduledDate,
        completedDate,
      };
    };

    // Apply normalization
    const normalizedWorkoutsList = workouts.map(normalizeWorkout);

    // Log summary of normalized workouts
    normalizedWorkoutsList.forEach((w, idx) => {
      console.log(`[generateWorkout] Workout ${idx + 1}:`, {
        title: w.title,
        category: w.category,
        status: w.status,
        scheduledDate: w.scheduledDate ? new Date(w.scheduledDate).toISOString() : null,
        completedDate: w.completedDate ? new Date(w.completedDate).toISOString() : null,
        durationMinutes: w.durationMinutes,
        caloriesBurned: w.caloriesBurned,
        exercisesCount: w.exercises?.length || 0,
      });
    });

    // Metrics
    const completedWorkouts = normalizedWorkoutsList.filter((w) => w.status === 'completed');
    const plannedWorkouts = normalizedWorkoutsList.filter((w) => w.status === 'planned' || w.status === 'scheduled' || w.status === 'todo');

    const totalDuration = normalizedWorkoutsList.reduce((sum, w) => sum + (Number(w.durationMinutes) || 0), 0);
    const completionRate = normalizedWorkoutsList.length > 0
      ? Math.round((completedWorkouts.length / normalizedWorkoutsList.length) * 100)
      : 0;

    const split = {
      strength: 0,
      cardio: 0,
      flexibility: 0,
      hiit: 0,
      yoga: 0,
      sports: 0,
      custom: 0,
    };

    normalizedWorkoutsList.forEach((w) => {
      if (w.category && split[w.category] !== undefined) split[w.category]++;
    });

    const totalWorkouts = normalizedWorkoutsList.length;
    const splitPercent = {};
    Object.keys(split).forEach((key) => {
      splitPercent[key] = totalWorkouts > 0 ? Math.round((split[key] / totalWorkouts) * 100) : 0;
    });

    // Top exercises
    const exerciseMap = {};
    const exerciseIds = new Set();

    normalizedWorkoutsList.forEach((w) => {
      if (w.exercises && Array.isArray(w.exercises) && w.exercises.length > 0) {
        w.exercises.forEach((ex) => {
          if (ex.name) {
            if (!exerciseMap[ex.name]) {
              exerciseMap[ex.name] = {
                name: ex.name,
                muscleGroup: 'Unknown',
                count: 0,
                personalRecords: [],
                exerciseId: ex.exerciseId,
              };
            }
            exerciseMap[ex.name].count++;
            if (ex.reps && ex.sets) {
              exerciseMap[ex.name].personalRecords.push({
                value: ex.reps,
                unit: 'reps',
                date: w.completedDate || w.scheduledDate,
              });
            }
          }
          if (ex.exerciseId) exerciseIds.add(ex.exerciseId);
        });
      }
    });

    if (exerciseIds.size > 0) {
      try {
        const Exercise = require('../models/Exercise');
        const exerciseDetails = await Exercise.find({ _id: { $in: Array.from(exerciseIds) } }).lean();
        const exerciseGroupMap = {};
        exerciseDetails.forEach((ex) => { exerciseGroupMap[ex._id.toString()] = ex.muscleGroup; });
        Object.keys(exerciseMap).forEach((name) => {
          const exData = exerciseMap[name];
          if (exData.exerciseId && exerciseGroupMap[exData.exerciseId.toString()]) {
            exData.muscleGroup = exerciseGroupMap[exData.exerciseId.toString()];
          }
        });
      } catch (err) {
        console.log('[generateWorkout] ⚠️  Could not fetch exercise details:', err.message);
      }
    }

    const topExercises = Object.values(exerciseMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((ex) => ({ name: ex.name, muscleGroup: ex.muscleGroup, count: ex.count, personalRecords: ex.personalRecords.slice(0, 3) }));

    console.log(`[generateWorkout] 📊 Top exercises (${topExercises.length}):`, topExercises.map(e => `${e.name} (${e.count}x)`).join(', '));

    // Build workoutsList for per-workout listing (return full user workouts to match /api/workouts)
    let workoutsList = [];
    try {
      // Probe and debug info
      try {
        console.log('[generateWorkout][DEBUG] userId type:', typeof userId, 'userId value:', userId);
        console.log('[generateWorkout][DEBUG] query used for workouts probe:', JSON.stringify(query));
        const sampleCount = await Workout.countDocuments(query);
        console.log('[generateWorkout][DEBUG] countDocuments for query:', sampleCount);
        const sampleOne = await Workout.findOne(query).lean();
        console.log('[generateWorkout][DEBUG] sample workout (findOne):', sampleOne ? { _id: sampleOne._id, title: sampleOne.title } : null);
      } catch (dbgErr) {
        console.log('[generateWorkout][DEBUG] error while probing workouts:', dbgErr.message);
      }

      const rawAll = await Workout.find(query).sort({ createdAt: -1 }).lean();
      console.log(`[generateWorkout] workoutsList DB returned ${rawAll.length} items (sample ids: ${rawAll.slice(0,5).map(w => w._id).join(', ')}) (date filter ignored to match /api/workouts)`);

      workoutsList = rawAll.map((w) => {
        const nw = normalizeWorkout(w);
        return {
          _id: nw._id,
          title: nw.title,
          status: nw.status || 'planned',
          category: nw.category || 'custom',
          durationMinutes: Number(nw.durationMinutes) || 0,
          caloriesBurned: Number(nw.caloriesBurned) || 0,
          scheduledDate: nw.scheduledDate ?? null,
          completedDate: nw.completedDate ?? null,
          exercisesCount: Array.isArray(nw.exercises) ? nw.exercises.length : 0,
          createdAt: nw.createdAt || null,
          updatedAt: nw.updatedAt || null,
        };
      });
    } catch (err) {
      console.error('[generateWorkout] ❌ workoutsList DB query failed:', err.message);
      workoutsList = [];
    }

    const result = {
      total: normalizedWorkoutsList.length,
      totalDuration,
      completionRate,
      split: splitPercent,
      topExercises,
      workoutsList,
    };

    console.log('[generateWorkout] ✅ COMPLETE - Returning:', result);
    console.log('[generateWorkout] END\n');

    return result;
  } catch (error) {
    console.error('[generateWorkout] ❌ ERROR:', error.message);
    console.error('[generateWorkout] Stack:', error.stack);
    throw error;
  }
};

// Generate nutrition data
const generateNutrition = async (userId, startDate, endDate) => {
  const meals = await Nutrition.find({
    user: userId,
    date: { $gte: startDate, $lte: endDate },
  }).sort({ date: 1 });

  if (meals.length === 0) {
    return {
      totalCalories: 0,
      avgDailyCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      mealsByType: {
        breakfast: 0,
        lunch: 0,
        dinner: 0,
        snacks: 0,
      },
      calorieEntries: [],
    };
  }

  // FIX: Nutrition model stores total in `totalCalories` and macros inside `items[]` sub-docs
  const totalCalories = meals.reduce((sum, m) => sum + (m.totalCalories || 0), 0);
  const totalProtein = meals.reduce((sum, m) =>
    sum + (m.items || []).reduce((s, item) => s + (item.protein || 0), 0), 0);
  const totalCarbs = meals.reduce((sum, m) =>
    sum + (m.items || []).reduce((s, item) => s + (item.carbs || 0), 0), 0);
  const totalFat = meals.reduce((sum, m) =>
    sum + (m.items || []).reduce((s, item) => s + (item.fat || 0), 0), 0);

  const uniqueDays = new Set(meals.map((m) => m.date.toISOString().split('T')[0])).size;
  const avgDailyCalories = uniqueDays > 0 ? Math.round(totalCalories / uniqueDays) : 0;

  // FIX: Nutrition model enum uses Title Case ('Breakfast', 'Lunch', 'Dinner', 'Snack')
  //      Compare case-insensitively; 'Snack' (singular) maps to 'snacks' key
  const mealsByType = {
    breakfast: meals.filter((m) => m.mealType?.toLowerCase() === 'breakfast').length,
    lunch: meals.filter((m) => m.mealType?.toLowerCase() === 'lunch').length,
    dinner: meals.filter((m) => m.mealType?.toLowerCase() === 'dinner').length,
    snacks: meals.filter((m) => ['snack', 'snacks'].includes(m.mealType?.toLowerCase())).length,
  };

  const calorieEntries = meals.map((m) => ({
    date: m.date,
    calories: m.totalCalories || 0, // FIX: use correct field name
    mealType: m.mealType,
  }));

  return {
    totalCalories,
    avgDailyCalories,
    totalProtein,
    totalCarbs,
    totalFat,
    mealsByType,
    calorieEntries,
  };
};

// Generate goals data
const generateGoals = async (userId, startDate, endDate) => {
  // FIX: Don't filter by deadline date range — that excluded goals with future deadlines.
  //      Show all goals for the user so the Goals tab is always populated.
  const goals = await Goal.find({ userId });

  const goalsList = goals.map((g) => ({
    _id: g._id,
    goalType: g.goalType,
    targetValue: g.targetValue,
    currentValue: g.currentValue,
    unit: g.unit,
    deadline: g.deadline,
    status: g.status,
    progress: g.targetValue > 0 ? Math.round((g.currentValue / g.targetValue) * 100) : 0,
  }));

  const activeGoals = goalsList.filter((g) => g.status === 'In Progress');
  const completedGoals = goalsList.filter((g) => g.status === 'Achieved');
  const failedGoals = goalsList.filter((g) => g.status === 'Failed');

  const stats = {
    totalActiveGoals: activeGoals.length,
    achievedGoals: completedGoals.length,
    onTrackGoals: activeGoals.filter((g) => g.progress >= 50).length,
    offTrackGoals: activeGoals.filter((g) => g.progress < 50).length,
  };

  return {
    goalsList,
    ...stats,
  };
};

// Generate images data with before/after
const generateImages = async (userId, startDate, endDate) => {
  // FIX: Progress model stores the image path in field `image`, NOT `imageUrl`
  const progressImages = await Progress.find({
    user: userId,
    date: { $gte: startDate, $lte: endDate },
    image: { $exists: true, $ne: null },
  }).sort({ date: -1 });

  // Map `image` (DB field) → `imageUrl` (frontend-expected key)
  const imagesList = progressImages.map((p) => ({
    imageUrl: p.image,
    date: p.date,
    weight: p.weight,
  }));

  // Oldest entry = "before", newest entry = "after"
  const beforeImage = progressImages.length > 0 ? progressImages[progressImages.length - 1] : null;
  const afterImage = progressImages.length > 0 ? progressImages[0] : null;

  return {
    imagesList,
    beforeImage: beforeImage ? {
      imageUrl: beforeImage.image,
      date: beforeImage.date,
    } : null,
    afterImage: afterImage ? {
      imageUrl: afterImage.image,
      date: afterImage.date,
    } : null,
  };
};

// Main function to generate all report data
const generateReportData = async (userId, startDate, endDate) => {
  console.log('\n========== GENERATE REPORT DATA CALLED ==========');
  console.log('User:', userId);
  console.log('Date range:', startDate.toISOString(), 'to', endDate.toISOString());

  try {
    const overview = await generateOverview(userId, startDate, endDate);
    const weight = await generateWeight(userId, startDate, endDate);
    const workout = await generateWorkout(userId, startDate, endDate);
    const nutrition = await generateNutrition(userId, startDate, endDate);
    const goals = await generateGoals(userId, startDate, endDate);
    const images = await generateImages(userId, startDate, endDate);

    const reportData = {
      period: 'custom',
      data: {
        overview,
        weight,
        workout,
        nutrition,
        goals,
        images,
      },
    };

    console.log('========== REPORT DATA GENERATED SUCCESSFULLY ==========\n');
    return reportData;
  } catch (error) {
    console.error('Error generating report data:', error);
    throw error;
  }
};

module.exports = {
  getDateRange,
  calculateStreak,
  generateReportData,
  generateOverview,
  generateWeight,
  generateWorkout,
  generateNutrition,
  generateGoals,
  generateImages,
};
