const mongoose = require('mongoose');

const MeetingParticipantSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  name: {
    type: String,
    default: 'Participant'
  },
  email: {
    type: String,
    default: ''
  },
  joinedAt: {
    type: Date,
    default: Date.now
  },
  leftAt: {
    type: Date
  }
}, { _id: false });

const MeetingRoomSchema = new mongoose.Schema({
  hostUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  hostName: {
    type: String,
    default: 'Host'
  },
  code: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 120
  },
  topic: {
    type: String,
    required: true,
    maxlength: 220
  },
  durationMinutes: {
    type: Number,
    default: 20
  },
  status: {
    type: String,
    enum: ['waiting', 'live', 'ended'],
    default: 'waiting'
  },
  participants: [MeetingParticipantSchema],
  endedAt: {
    type: Date
  }
}, { timestamps: true });

MeetingRoomSchema.index({ createdAt: -1 });

module.exports = mongoose.model('MeetingRoom', MeetingRoomSchema);
