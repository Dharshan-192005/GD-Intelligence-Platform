const mongoose = require('mongoose');

const ResumeTopicSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sourceName: { type: String, default: 'Resume upload' },
  topics: [{ type: String }],
  industryContext: { type: String, default: 'General / Academic' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ResumeTopic', ResumeTopicSchema);
