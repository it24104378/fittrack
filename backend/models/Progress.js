const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    date: {
      type: Date,
      default: Date.now,
    },
    weight: {
      type: Number,
      required: [true, 'Weight is required'],
    },
    calories: {
      type: Number,
      required: [true, 'Calories are required'],
    },
    chest: Number,
    waist: Number,
    hips: Number,
    notes: String,
    image: String, // file path from multer
  },
  { timestamps: true }
);

progressSchema.index({ user: 1, date: -1 });

module.exports = mongoose.model('Progress', progressSchema);