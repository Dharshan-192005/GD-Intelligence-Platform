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
  targetIndustry: { type: String, default: 'General / Academic' },
  institution: { type: String, default: '' },
  location: { type: String, default: '' },
  speakingGoal: { type: String, default: '' },
  profilePhoto: { type: String, default: '' },
  notes: { type: String, default: '' },
  settings: {
    targetIndustry: { type: String, default: 'General / Academic' },
    preferredDuration: { type: String, default: '2 minutes' },
    voiceMode: { type: String, default: 'Balanced AI voices' },
    themePreference: { type: String, default: 'Professional light' },
    coachingIntensity: { type: String, default: 'Balanced' },
    requestMode: { type: String, default: 'Free-tier balanced' },
    interfaceDensity: { type: String, default: 'Comfortable' },
    animationMode: { type: String, default: 'Smooth animations' },
    sidebarMode: { type: String, default: 'Expanded sidebar' },
    focusMode: { type: String, default: 'Balanced workspace' },
    chatScrollMode: { type: String, default: 'Auto-scroll chat' },
    soundEffects: { type: String, default: 'On' }
  }
}, { timestamps: true });

module.exports = mongoose.model('UserProfile', UserProfileSchema);
