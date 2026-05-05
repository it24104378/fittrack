const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Exercise name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    muscleGroup: {
      type: String,
      required: [true, 'Muscle group is required'],
      enum: [
        'chest', 'back', 'shoulders', 'biceps', 'triceps',
        'forearms', 'core', 'glutes', 'quadriceps', 'hamstrings',
        'calves', 'full body', 'cardio',
      ],
    },
    category: {
      type: String,
      enum: ['strength', 'cardio', 'flexibility', 'balance', 'plyometric'],
      default: 'strength',
    },
    equipment: {
      type: String,
      enum: [
        'barbell', 'dumbbell', 'kettlebell', 'resistance band',
        'cable machine', 'bodyweight', 'pull-up bar',
        'bench', 'treadmill', 'rowing machine', 'other',
      ],
      default: 'bodyweight',
    },
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner',
    },
    instructions: {
      type: String,
      trim: true,
      maxlength: [1000, 'Instructions cannot exceed 1000 characters'],
    },
    defaultSets: { type: Number, default: 3 },
    defaultReps: { type: Number, default: 10 },
    defaultDurationSeconds: { type: Number },
    caloriesPerMinute: { type: Number, default: 5 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    isGlobal: {
      type: Boolean,
      default: false, // true = visible to all users (admin-created), false = personal
    },
  },
  { timestamps: true }
);

exerciseSchema.index({ muscleGroup: 1 });
exerciseSchema.index({ equipment: 1 });
exerciseSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Exercise', exerciseSchema);
