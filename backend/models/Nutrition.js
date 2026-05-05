const mongoose = require('mongoose');

// Sub-schema for individual food items in a meal
const foodItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Food item name is required'],
      trim: true,
    },
    calories: {
      type: Number,
      required: [true, 'Calories are required'],
      min: [0, 'Calories cannot be negative'],
    },
    protein: {
      type: Number,
      default: 0,
      min: 0,
    },
    carbs: {
      type: Number,
      default: 0,
      min: 0,
    },
    fat: {
      type: Number,
      default: 0,
      min: 0,
    },
    quantity: {
      type: Number,
      default: 1,
      min: [1, 'Quantity must be at least 1'],
    },
    unit: {
      type: String,
      default: 'serving',
      trim: true,
    },
  },
  { _id: false }  // No separate ID for sub-documents
);

// Sub-schema for nutrition
const nutritionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',              // Reference to User model
      required: [true, 'User is required'],
    },
    date: {
      type: Date,
      default: Date.now,
    },
    mealType: {
      type: String,
      enum: ['Breakfast', 'Lunch', 'Dinner', 'Snack'],
      required: [true, 'Meal type is required'],
    },
    items: {
      type: [foodItemSchema],
      validate: {
        validator: (arr) => arr.length > 0,
        message: 'At least one food item is required',
      },
    },
    totalCalories: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
    image: {
      type: String,             // Image URL, uploaded via Member 6's Multer setup
    },
  },
  { timestamps: true }          // Adds createdAt and updatedAt
);


const Nutrition = mongoose.model('Nutrition', nutritionSchema);
module.exports = Nutrition;