const mongoose = require('mongoose');

const AiPersonaSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: { type: String, required: true, trim: true },
  role: { type: String, required: true, trim: true },
  style: { type: String, default: '' },
  color: { type: String, default: '#0f766e' },
  desc: { type: String, default: '' },
  pressure: { type: Number, default: 60, min: 0, max: 100 },
  prompt: { type: String, default: '' },
  initialIntro: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
}, { timestamps: true });

AiPersonaSchema.index({ userId: 1, order: 1 });

module.exports = mongoose.model('AiPersona', AiPersonaSchema);
