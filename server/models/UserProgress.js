const mongoose = require('mongoose');

const UserProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  averageScore: { type: Number, default: 0 },
  completedSessions: { type: Number, default: 0 },
  practiceStreak: { type: Number, default: 0 },
  fillerWordTrend: [{ date: Date, count: Number }],
  confidenceTrend: [{ date: Date, score: Number }],
  weakPhraseHistory: [{ type: String }],
  badges: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('UserProgress', UserProgressSchema);
