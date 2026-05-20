const mongoose = require('mongoose');

const TranscriptSchema = new mongoose.Schema({
  speaker: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  duration: {
    type: Number, // in seconds
    default: 0
  },
  isInterrupted: {
    type: Boolean,
    default: false
  }
});

const SessionSchema = new mongoose.Schema({
  topic: {
    type: String,
    required: true
  },
  industryContext: {
    type: String,
    default: 'General/Academic'
  },
  durationLimit: {
    type: Number, // in minutes
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  numParticipants: {
    type: Number,
    default: 4
  },
  transcript: [TranscriptSchema],
  
  // Real-time calculated speaking stats
  userMetrics: {
    speakingTime: { type: Number, default: 0 }, // in seconds
    speakPercentage: { type: Number, default: 0 },
    interruptionCount: { type: Number, default: 0 }, // number of times user interrupted others
    interruptedCount: { type: Number, default: 0 }, // number of times user got interrupted by others
    pacingWpm: { type: Number, default: 0 }, // Words per minute
    fillerWordCount: { type: Number, default: 0 }, // 'uh', 'um', 'like', etc.
    bodyLanguageScore: { type: Number, default: 0 } // 1-100 visual tracking
  },
  
  // Participant participation breakdown (for visual graphs)
  participationBreakdown: [
    {
      name: { type: String, required: true },
      speakingTime: { type: Number, default: 0 }, // in seconds
      percentage: { type: Number, default: 0 }
    }
  ],

  // Gemini AI performance diagnostic
  aiEvaluation: {
    leadershipScore: { type: Number, default: 0 }, // 1-100
    confidenceScore: { type: Number, default: 0 }, // 1-100
    effectivenessScore: { type: Number, default: 0 }, // 1-100
    analysisSummary: { type: String, default: '' },
    strengths: [{ type: String }],
    weaknesses: [{ type: String }],
    actionableTips: [{ type: String }],
    topicRelevance: { type: String, default: '' },
    argumentDepth: { type: String, default: '' },
    suggestedPhrases: [
      {
        original: { type: String },
        improved: { type: String },
        reason: { type: String }
      }
    ]
  },
  
  isCompleted: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('Session', SessionSchema);
