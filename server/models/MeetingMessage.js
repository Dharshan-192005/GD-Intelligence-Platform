const mongoose = require('mongoose');

const MeetingMessageSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MeetingRoom',
    index: true
  },
  roomCode: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  authorName: {
    type: String,
    default: 'Participant'
  },
  text: {
    type: String,
    required: true,
    maxlength: 1000
  },
  type: {
    type: String,
    enum: ['chat', 'system'],
    default: 'chat'
  }
}, { timestamps: true });

MeetingMessageSchema.index({ roomCode: 1, createdAt: 1 });

module.exports = mongoose.model('MeetingMessage', MeetingMessageSchema);
