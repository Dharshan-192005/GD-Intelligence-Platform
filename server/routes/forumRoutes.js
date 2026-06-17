const express = require('express');
const {
  listForumPosts,
  createForumPost,
  voteForumPost,
  replyForumPost
} = require('../controllers/forumController');

const router = express.Router();

router.get('/posts', listForumPosts);
router.post('/posts', createForumPost);
router.post('/posts/:id/vote', voteForumPost);
router.post('/posts/:id/replies', replyForumPost);

module.exports = router;
