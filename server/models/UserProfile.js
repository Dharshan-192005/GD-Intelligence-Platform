const mongoose = require('mongoose');

const UserProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  role: { type: String, default: 'Student' },
  goal: { type: String, default: 'Placement GD preparation' },
  experienceLevel: { type: String, default: 'Intermediate' },
  notes: { type: String, default: '' },
  settings: {
    targetIndustry: { type: String, default: 'General / Academic' },
    preferredDuration: { type: String, default: '2 minutes' },
    voiceMode: { type: String, default: 'Balanced AI voices' },
    themePreference: { type: String, default: 'Professional light' },
    coachingIntensity: { type: String, default: 'Balanced' },
    requestMode: { type: String, default: 'Free-tier balanced' }
  }
}, { timestamps: true });

module.exports = mongoose.model('UserProfile', UserProfileSchema);
