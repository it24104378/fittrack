const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
  addProgress,
  getMyProgress,
  getProgressById,
  updateProgress,
  deleteProgress,
  adminGetAllProgress,
  adminAddProgress,
  adminUpdateProgress,
  adminDeleteProgress,
} = require('../controllers/progressController');

// ─── USER ROUTES ────────────────────────────────────
router.use(protect); // all progress routes protected

router.get('/', getMyProgress);                            // GET /api/progress
router.post('/', upload.single('image'), addProgress);     // POST /api/progress
router.get('/:id', getProgressById);
router.put('/:id', upload.single('image'), updateProgress);
router.delete('/:id', deleteProgress);

// ─── ADMIN ROUTES ───────────────────────────────────
router.get('/admin/all', adminOnly, adminGetAllProgress);
router.post('/admin', adminOnly, upload.single('image'), adminAddProgress);
router.put('/admin/:id', adminOnly, upload.single('image'), adminUpdateProgress);
router.delete('/admin/:id', adminOnly, adminDeleteProgress);

module.exports = router;