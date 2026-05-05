const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    reportName: {
      type: String,
      required: [true, 'Report name is required'],
      trim: true,
    },
    period: {
      type: String,
      enum: ['7D', '30D', '90D', 'custom'],
      default: 'custom',
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    data: {
      overview: { type: mongoose.Schema.Types.Mixed, default: {} },
      weight: { type: mongoose.Schema.Types.Mixed, default: {} },
      workout: { type: mongoose.Schema.Types.Mixed, default: {} },
      nutrition: { type: mongoose.Schema.Types.Mixed, default: {} },
      goals: { type: mongoose.Schema.Types.Mixed, default: {} },
      images: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    pdfPath: {
      type: String,
      default: null,
    },
    fileSizeKB: {
      type: Number,
      default: 0,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

reportSchema.index({ user: 1, createdAt: -1 });
reportSchema.index({ user: 1, period: 1 });

module.exports = mongoose.model('Report', reportSchema);

