const MeetingRoom = require('../models/MeetingRoom');
const MeetingMessage = require('../models/MeetingMessage');
const User = require('../models/User');

const createCode = () => `GD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const getUserName = async (req, fallback = 'Participant') => {
  try {
    const user = await User.findById(req.user.id).select('name email');
    return user?.name || fallback;
  } catch {
    return fallback;
  }
};

const createMeetingRoom = async (req, res) => {
  try {
    const title = String(req.body.title || 'Live GD Meeting').trim();
    const topic = String(req.body.topic || '').trim();
    const durationMinutes = Number(req.body.durationMinutes) || 20;

    if (!topic) {
      return res.status(400).json({ error: 'Meeting topic is required.' });
    }

    let code = createCode();
    while (await MeetingRoom.exists({ code })) {
      code = createCode();
    }

    const hostName = await getUserName(req, req.body.hostName || 'Host');
    const room = await MeetingRoom.create({
      hostUserId: req.user.id,
      hostName,
      code,
      title,
      topic,
      durationMinutes,
      participants: [{
        userId: req.user.id,
        name: hostName,
        email: req.user.email
      }]
    });

    await MeetingMessage.create({
      roomId: room._id,
      roomCode: room.code,
      userId: req.user.id,
      authorName: 'System',
      text: `${hostName} created the meeting room.`,
      type: 'system'
    });

    return res.status(201).json(room);
  } catch (error) {
    console.error('Create meeting room error:', error);
    return res.status(500).json({ error: 'Could not create meeting room.' });
  }
};

const listMeetingRooms = async (req, res) => {
  try {
    const rooms = await MeetingRoom
      .find({
        $or: [
          { hostUserId: req.user.id },
          { 'participants.userId': req.user.id }
        ]
      })
      .sort({ updatedAt: -1 })
      .limit(20);

    return res.json(rooms);
  } catch (error) {
    console.error('List meeting rooms error:', error);
    return res.status(500).json({ error: 'Could not load meeting rooms.' });
  }
};

const getMeetingRoom = async (req, res) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    const room = await MeetingRoom.findOne({ code });

    if (!room) {
      return res.status(404).json({ error: 'Meeting room not found.' });
    }

    const messages = await MeetingMessage.find({ roomCode: code }).sort({ createdAt: 1 }).limit(100);
    return res.json({ room, messages });
  } catch (error) {
    console.error('Get meeting room error:', error);
    return res.status(500).json({ error: 'Could not load meeting room.' });
  }
};

const joinMeetingRoom = async (req, res) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    const room = await MeetingRoom.findOne({ code });

    if (!room) {
      return res.status(404).json({ error: 'Meeting room not found.' });
    }

    if (room.status === 'ended') {
      return res.status(409).json({ error: 'This meeting has already ended.' });
    }

    const name = await getUserName(req, req.body.name || 'Participant');
    const existing = room.participants.find(item => String(item.userId) === String(req.user.id));

    if (existing) {
      existing.leftAt = undefined;
      existing.name = name;
    } else {
      room.participants.push({
        userId: req.user.id,
        name,
        email: req.user.email
      });
    }

    room.status = 'live';
    await room.save();

    await MeetingMessage.create({
      roomId: room._id,
      roomCode: room.code,
      userId: req.user.id,
      authorName: 'System',
      text: `${name} joined the meeting.`,
      type: 'system'
    });

    return res.json(room);
  } catch (error) {
    console.error('Join meeting room error:', error);
    return res.status(500).json({ error: 'Could not join meeting room.' });
  }
};

const endMeetingRoom = async (req, res) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    const room = await MeetingRoom.findOne({ code });

    if (!room) {
      return res.status(404).json({ error: 'Meeting room not found.' });
    }

    if (String(room.hostUserId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Only the host can end this meeting.' });
    }

    room.status = 'ended';
    room.endedAt = new Date();
    await room.save();

    await MeetingMessage.create({
      roomId: room._id,
      roomCode: room.code,
      userId: req.user.id,
      authorName: 'System',
      text: 'The host ended the meeting.',
      type: 'system'
    });

    return res.json(room);
  } catch (error) {
    console.error('End meeting room error:', error);
    return res.status(500).json({ error: 'Could not end meeting room.' });
  }
};

const createMeetingMessage = async (req, res) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    const text = String(req.body.text || '').trim();

    if (!text) {
      return res.status(400).json({ error: 'Message text is required.' });
    }

    const room = await MeetingRoom.findOne({ code });
    if (!room) {
      return res.status(404).json({ error: 'Meeting room not found.' });
    }

    const authorName = await getUserName(req, req.body.authorName || 'Participant');
    const message = await MeetingMessage.create({
      roomId: room._id,
      roomCode: room.code,
      userId: req.user.id,
      authorName,
      text
    });

    return res.status(201).json(message);
  } catch (error) {
    console.error('Create meeting message error:', error);
    return res.status(500).json({ error: 'Could not save meeting message.' });
  }
};

module.exports = {
  createMeetingRoom,
  listMeetingRooms,
  getMeetingRoom,
  joinMeetingRoom,
  endMeetingRoom,
  createMeetingMessage
};
