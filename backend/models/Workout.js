const mongoose = require('mongoose');

const workoutSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Workout title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    category: {
      type: String,
      enum: ['strength', 'cardio', 'flexibility', 'hiit', 'yoga', 'sports', 'custom'],
      default: 'custom',
    },
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner',
    },
    durationMinutes: {
      type: Number,
      required: [true, 'Duration is required'],
      min: [1, 'Duration must be at least 1 minute'],
    },
    exercises: [
      {
        exerciseId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Exercise',
        },
        name: { type: String, required: true },
        sets: { type: Number, default: 1 },
        reps: { type: Number },
        durationSeconds: { type: Number },
        restSeconds: { type: Number, default: 60 },
        notes: { type: String },
      },
    ],
    caloriesBurned: {
      type: Number,
      default: 0,
    },
    scheduledDate: {
      type: Date,
    },
    completedDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['planned', 'in_progress', 'completed', 'skipped'],
      default: 'planned',
    },
    goalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Goal',
    },
    tags: [{ type: String, trim: true }],
    isTemplate: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

workoutSchema.index({ user: 1, status: 1 });
workoutSchema.index({ user: 1, scheduledDate: 1 });

module.exports = mongoose.model('Workout', workoutSchema);
