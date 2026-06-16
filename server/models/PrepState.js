const mongoose = require('mongoose');

const PrepStateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  checklist: {
    type: Map,
    of: Boolean,
    default: {}
  },
  speakingGoals: {
    completePoints: { type: Number, default: 2 },
    examples: { type: Number, default: 1 },
    oneWordReplies: { type: Number, default: 0 },
    speakerReferences: { type: Number, default: 1 }
  },
  weakAreas: [{ type: String }],
  activeDrill: { type: String, default: 'Opening' },
  practiceStreak: { type: Number, default: 0 },
  lastPracticedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('PrepState', PrepStateSchema);
