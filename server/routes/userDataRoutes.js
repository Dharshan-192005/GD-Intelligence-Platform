const express = require('express');
const {
  getUserData,
  updateProfile,
  updateSettings,
  updatePersonas,
  updatePrepState,
  addResumeTopics
} = require('../controllers/userDataController');

const router = express.Router();

router.get('/', getUserData);
router.put('/profile', updateProfile);
router.put('/settings', updateSettings);
router.put('/ai-personas', updatePersonas);
router.put('/prep-state', updatePrepState);
router.post('/resume-topics', addResumeTopics);

module.exports = router;
