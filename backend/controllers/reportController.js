const Report = require('../models/Report');
const { generateReportData } = require('../services/reportService');
const fs = require('fs');
const path = require('path');

// @desc    Generate report data (preview before saving)
// @route   POST /api/reports/generate
// @access  Private
const generateReport = async (req, res) => {
  try {
    console.log('\n========== GENERATE REPORT CALLED ==========');
    console.log('Request body:', req.body);
    console.log('User ID:', req.user?._id);

    // Validate user authentication
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    // Extract parameters from request body
    const { startDate, endDate, period } = req.body;

    // Validate inputs - accept either period OR date range
    let finalStartDate, finalEndDate;

    if (startDate && endDate) {
      // Use provided date range
      finalStartDate = new Date(startDate);
      finalEndDate = new Date(endDate);

      console.log('Using date range:');
      console.log('  Start:', finalStartDate);
      console.log('  End:', finalEndDate);

      if (isNaN(finalStartDate.getTime()) || isNaN(finalEndDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format. Use ISO 8601 format (e.g., 2026-05-03T00:00:00.000Z)',
        });
      }

      if (finalStartDate > finalEndDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date must be before end date',
        });
      }

      // Normalize the provided dates to include the entire days (inclusive)
      finalStartDate.setHours(0, 0, 0, 0);
      finalEndDate.setHours(23, 59, 59, 999);
    } else if (period && ['7D', '30D', '90D'].includes(period)) {
      // Calculate date range from period
      console.log('Using period:', period);
      const { getDateRange } = require('../services/reportService');
      const range = getDateRange(period);
      finalStartDate = range.startDate;
      finalEndDate = range.endDate;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Either provide startDate/endDate or a valid period (7D, 30D, 90D)',
      });
    }

    console.log('Calling generateReportData...');

    const reportDataRaw = await generateReportData(req.user._id, finalStartDate, finalEndDate);

    // Ensure workout data exists and provide defaults to avoid undefined values on frontend
    const workoutDefaults = {
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
      workoutsList: [],
      topExercises: [],
    };

    // Merge defaults with whatever the service returned (if any) so missing keys are filled
    const workoutDataRaw = reportDataRaw?.data?.workout || {};
    const workoutDataSafe = {
      ...workoutDefaults,
      ...workoutDataRaw,
      // Ensure split and topExercises have safe shapes
      split: (workoutDataRaw.split && typeof workoutDataRaw.split === 'object') ? workoutDataRaw.split : workoutDefaults.split,
      topExercises: Array.isArray(workoutDataRaw.topExercises) ? workoutDataRaw.topExercises : workoutDefaults.topExercises,
      total: typeof workoutDataRaw.total === 'number' ? workoutDataRaw.total : workoutDefaults.total,
      totalDuration: typeof workoutDataRaw.totalDuration === 'number' ? workoutDataRaw.totalDuration : workoutDefaults.totalDuration,
      completionRate: typeof workoutDataRaw.completionRate === 'number' ? workoutDataRaw.completionRate : workoutDefaults.completionRate,
    };

    console.log('Generated report data:', {
      period: reportDataRaw.period,
      hasWorkouts: !!reportDataRaw.data.workout,
      workoutTotal: workoutDataSafe.total,
      topExercises: workoutDataSafe.topExercises?.length || 0,
    });

    // Restructure response to match frontend expectations
    const responseData = {
      user: req.user._id,
      reportType: 'custom',
      dateRange: {
        startDate: finalStartDate,
        endDate: finalEndDate,
      },
      metrics: {
        goals: reportDataRaw.data.goals,
        weight: reportDataRaw.data.weight,
        workouts: workoutDataSafe,
        nutrition: reportDataRaw.data.nutrition,
      },
      summary: reportDataRaw.data.overview,
      images: reportDataRaw.data.images,
      generatedAt: new Date(),
    };

    console.log('Returning 200 response with generated data');
    console.log('Response structure:', {
      metrics: {
        goals: responseData.metrics.goals ? Object.keys(responseData.metrics.goals) : 'null',
        workouts: responseData.metrics.workouts ? Object.keys(responseData.metrics.workouts) : 'null',
        nutrition: responseData.metrics.nutrition ? Object.keys(responseData.metrics.nutrition) : 'null',
      }
    });
    console.log('Workouts in response:', responseData.metrics.workouts);
    console.log('========== GENERATE REPORT COMPLETE ==========\n');

    return res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('========== GENERATE REPORT ERROR ==========');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('========== END ERROR ==========\n');

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Save report
// @route   POST /api/reports
// @access  Private
const saveReport = async (req, res) => {
  try {
    const { reportName, startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required',
      });
    }

    const finalStartDate = new Date(startDate);
    const finalEndDate = new Date(endDate);
    finalStartDate.setHours(0, 0, 0, 0);
    finalEndDate.setHours(23, 59, 59, 999);

    // Auto-generate a name if none provided
    const autoName = reportName?.trim() ||
      `Progress Report ${finalStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${finalEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    // Regenerate fresh report data so the saved report always has full metrics
    const reportDataRaw = await generateReportData(req.user._id, finalStartDate, finalEndDate);

    const report = new Report({
      user: req.user._id,
      reportName: autoName,
      period: 'custom',
      startDate: finalStartDate,
      endDate: finalEndDate,
      data: reportDataRaw.data || {},
      generatedAt: new Date(),
    });

    await report.save();

    res.status(201).json({
      success: true,
      message: 'Report saved successfully',
      data: report,
    });
  } catch (error) {
    console.error('Error saving report:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Alias for saveReport to match route expectations
const createReport = saveReport;

// @desc    Get all reports for user
// @route   GET /api/reports
// @access  Private
const getReports = async (req, res) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 10;
    const skip = (page - 1) * limit;

    const reports = await Report.find({ user: req.user._id })
      .sort({ generatedAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Report.countDocuments({ user: req.user._id });

    res.status(200).json({
      success: true,
      count: reports.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: reports,
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single report by ID
// @route   GET /api/reports/:id
// @access  Private
const getReportById = async (req, res) => {
  try {
    const query = { _id: req.params.id };
    if (req.user.role !== 'admin') {
      query.user = req.user._id;
    }

    const report = await Report.findOne(query).populate('user', 'name email');

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found',
      });
    }

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete report
// @route   DELETE /api/reports/:id
// @access  Private
const deleteReport = async (req, res) => {
  try {
    const query = { _id: req.params.id };
    if (req.user.role !== 'admin') {
      query.user = req.user._id;
    }

    const report = await Report.findOneAndDelete(query);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found',
      });
    }

    // Delete PDF file if it exists
    if (report.pdfPath) {
      const filePath = path.join(__dirname, '..', report.pdfPath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Report deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Download/view report PDF
// @route   GET /api/reports/:id/download
// @access  Private
const downloadReport = async (req, res) => {
  try {
    const report = await Report.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found',
      });
    }

    if (!report.pdfPath) {
      return res.status(400).json({
        success: false,
        message: 'PDF not generated for this report yet',
      });
    }

    const filePath = path.join(__dirname, '..', report.pdfPath);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'PDF file not found',
      });
    }

    res.download(filePath, `${report.name}.pdf`);
  } catch (error) {
    console.error('Error downloading report:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all reports (admin)
// @route   GET /api/reports/admin
// @access  Private/Admin
const adminGetAllReports = async (req, res) => {
  try {
    const reports = await Report.find()
      .populate('user', 'name email fitnessLevel')
      .sort({ generatedAt: -1 });

    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Debug endpoint: return workouts count and a sample for the authenticated user
const getWorkoutsDebug = async (req, res) => {
  try {
    if (!req.user?._id) return res.status(401).json({ success: false, message: 'Not authenticated' });
    const mongoose = require('mongoose');
    const userId = req.user._id;

    // FIX: Use `new` keyword — mongoose.Types.ObjectId() without `new` throws TypeError in Mongoose 9
    const possibleObjectId = (typeof userId === 'string' && mongoose.Types.ObjectId.isValid(userId))
      ? new mongoose.Types.ObjectId(userId)
      : null;

    const orClauses = [];
    if (possibleObjectId) orClauses.push({ user: possibleObjectId });
    orClauses.push({ user: userId });

    const query = orClauses.length > 0 ? { $or: orClauses } : { user: userId };

    const count = await require('../models/Workout').countDocuments(query);
    const sample = await require('../models/Workout').findOne(query).lean();

    return res.status(200).json({ success: true, query, count, sample: sample ? { _id: sample._id, user: sample.user, userId: sample.userId, title: sample.title, createdAt: sample.createdAt } : null });
  } catch (error) {
    console.error('getWorkoutsDebug error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  generateReport,
  saveReport,
  createReport,
  getReports,
  getReportById,
  deleteReport,
  downloadReport,
  adminGetAllReports,
  getWorkoutsDebug,
};
