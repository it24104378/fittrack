const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
  generateReport,
  createReport,
  getReports,
  getReportById,
  deleteReport,
  downloadReport,
  adminGetAllReports,
} = require('../controllers/reportController');

// ─── USER ROUTES ────────────────────────────────────
router.use(protect); // All report routes protected

// Generate report preview (no save)
router.post('/generate', generateReport);

// CRUD operations
router.route('/')
  .post(createReport)
  .get(getReports);

router.route('/:id')
  .get(getReportById)
  .delete(deleteReport);

// Download PDF
router.get('/:id/download', downloadReport);

// ─── ADMIN ROUTES ───────────────────────────────────
router.get('/admin/all', adminOnly, adminGetAllReports);

module.exports = router;

