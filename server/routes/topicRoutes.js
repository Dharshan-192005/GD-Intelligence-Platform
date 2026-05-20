const express = require('express');
const router = express.Router();
const multer = require('multer');
const { generateTopicsFromResume } = require('../controllers/topicController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

router.post('/from-resume', upload.single('resume'), generateTopicsFromResume);

module.exports = router;
