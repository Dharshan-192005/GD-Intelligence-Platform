const express = require('express');
const {
  createMeetingRoom,
  listMeetingRooms,
  getMeetingRoom,
  joinMeetingRoom,
  endMeetingRoom,
  createMeetingMessage
} = require('../controllers/meetingController');

const router = express.Router();

router.get('/rooms', listMeetingRooms);
router.post('/rooms', createMeetingRoom);
router.get('/rooms/:code', getMeetingRoom);
router.post('/rooms/:code/join', joinMeetingRoom);
router.post('/rooms/:code/end', endMeetingRoom);
router.post('/rooms/:code/messages', createMeetingMessage);

module.exports = router;
