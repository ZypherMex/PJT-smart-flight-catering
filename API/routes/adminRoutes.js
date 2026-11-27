const express = require('express');
const multer = require('multer');
const c = require('../controllers/adminController');
const { requireCrew } = require('../middleware/crewAuth');

const router = express.Router();

// Photos are decoded and re-encoded by imageService, so memory storage is enough;
// the size cap stops a huge upload from filling server memory.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

// Express 4 does not catch rejected promises, so async handlers are wrapped.
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

// Everything under /api/admin is staff-only.
router.use('/admin', requireCrew);

router.get('/admin/meta', c.getMeta);

router.get('/admin/meals', c.listMealsHandler);
router.post('/admin/meals', c.createMealHandler);
router.put('/admin/meals/:id', c.updateMealHandler);
router.delete('/admin/meals/:id', wrap(c.deleteMealHandler));
router.post('/admin/meals/:id/image', upload.single('image'), wrap(c.uploadMealImageHandler));
router.delete('/admin/meals/:id/image', wrap(c.removeMealImageHandler));

router.get('/admin/conditions', c.listConditionsHandler);
router.post('/admin/conditions', c.createConditionHandler);
router.put('/admin/conditions/:id', c.updateConditionHandler);
router.delete('/admin/conditions/:id', c.deleteConditionHandler);

router.post('/admin/tags', c.createTagHandler);
router.delete('/admin/tags/:tag', c.deleteTagHandler);

module.exports = router;
