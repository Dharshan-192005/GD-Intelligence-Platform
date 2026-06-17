const mongoose = require('mongoose');

const ForumReplySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  authorName: {
    type: String,
    default: 'Community Member'
  },
  authorPhoto: {
    type: String,
    default: ''
  },
  text: {
    type: String,
    required: true,
    maxlength: 1000
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const ForumPostSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  authorName: {
    type: String,
    default: 'Community Member'
  },
  authorPhoto: {
    type: String,
    default: ''
  },
  title: {
    type: String,
    required: true,
    maxlength: 140
  },
  body: {
    type: String,
    required: true,
    maxlength: 2000
  },
  category: {
    type: String,
    enum: ['GD Doubt', 'Topic Request', 'Feature Suggestion', 'Practice Tip'],
    default: 'GD Doubt'
  },
  tags: [{ type: String, maxlength: 30 }],
  votes: {
    type: Number,
    default: 0
  },
  likedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  dislikedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  replies: [ForumReplySchema]
}, { timestamps: true });

ForumPostSchema.index({ createdAt: -1 });
ForumPostSchema.index({ category: 1, createdAt: -1 });

module.exports = mongoose.model('ForumPost', ForumPostSchema);
