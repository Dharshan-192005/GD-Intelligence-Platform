const ForumPost = require('../models/ForumPost');
const User = require('../models/User');
const UserProfile = require('../models/UserProfile');
const { checkInMemoryMode } = require('../config/db');

const memoryForumPosts = [];

const cleanTags = (tags) => (
  String(tags || '')
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean)
    .slice(0, 5)
);

const getAuthorName = async (userId) => {
  if (!userId || checkInMemoryMode()) return 'Community Member';
  const user = await User.findById(userId).select('name').lean();
  return user?.name || 'Community Member';
};

const getAuthorProfile = async (userId) => {
  if (!userId || checkInMemoryMode()) return { authorName: 'Community Member', authorPhoto: '' };
  const [user, profile] = await Promise.all([
    User.findById(userId).select('name').lean(),
    UserProfile.findOne({ userId }).select('profilePhoto').lean()
  ]);
  return {
    authorName: user?.name || 'Community Member',
    authorPhoto: profile?.profilePhoto || ''
  };
};

const attachAuthorPhotos = async (posts) => {
  const ids = [...new Set(posts.flatMap(post => [
    post.userId,
    ...(post.replies || []).map(reply => reply.userId)
  ]).filter(Boolean).map(String))];
  if (ids.length === 0) return posts;

  const profiles = await UserProfile.find({ userId: { $in: ids } }).select('userId profilePhoto').lean();
  const photoByUser = new Map(profiles.map(profile => [String(profile.userId), profile.profilePhoto || '']));

  return posts.map(post => ({
    ...post,
    authorPhoto: post.authorPhoto || photoByUser.get(String(post.userId)) || '',
    replies: (post.replies || []).map(reply => ({
      ...reply,
      authorPhoto: reply.authorPhoto || photoByUser.get(String(reply.userId)) || ''
    }))
  }));
};

const withViewerVote = (post, userId) => {
  const likedBy = post.likedBy || [];
  const dislikedBy = post.dislikedBy || [];
  const isLiked = Boolean(userId && likedBy.some(id => String(id) === String(userId)));
  const isDisliked = Boolean(userId && dislikedBy.some(id => String(id) === String(userId)));
  return {
    ...post,
    votes: likedBy.length,
    dislikes: dislikedBy.length,
    isLiked,
    isDisliked
  };
};

const listForumPosts = async (req, res) => {
  try {
    const category = req.query.category;
    const viewerId = req.user?.id;

    if (checkInMemoryMode()) {
      const posts = memoryForumPosts
        .filter(post => !category || category === 'All' || post.category === category)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(post => withViewerVote(post, viewerId));
      return res.json(posts);
    }

    const query = category && category !== 'All' ? { category } : {};
    const posts = await ForumPost.find(query).sort({ createdAt: -1 }).limit(50).lean();
    const postsWithPhotos = await attachAuthorPhotos(posts);
    return res.json(postsWithPhotos.map(post => withViewerVote(post, viewerId)));
  } catch (error) {
    console.error('List Forum Posts Error:', error);
    return res.status(500).json({ error: 'Could not load community posts.' });
  }
};

const createForumPost = async (req, res) => {
  try {
    const body = String(req.body.body || '').trim();
    const generatedTitle = body.split(/\s+/).slice(0, 10).join(' ');
    const title = String(req.body.title || generatedTitle || 'Community question').trim();
    const category = req.body.category || 'GD Doubt';
    const tags = cleanTags(req.body.tags);

    if (!body) {
      return res.status(400).json({ error: 'Post details are required.' });
    }

    const { authorName, authorPhoto } = await getAuthorProfile(req.user?.id);
    const post = {
      userId: req.user?.id,
      authorName,
      authorPhoto,
      title: title.slice(0, 140),
      body: body.slice(0, 2000),
      category,
      tags,
      votes: 0,
      likedBy: [],
      dislikedBy: [],
      replies: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (checkInMemoryMode()) {
      const saved = { ...post, _id: Math.random().toString(36).slice(2, 11) };
      memoryForumPosts.unshift(saved);
      return res.status(201).json(saved);
    }

    const saved = await ForumPost.create(post);
    return res.status(201).json(saved);
  } catch (error) {
    console.error('Create Forum Post Error:', error);
    return res.status(500).json({ error: 'Could not create community post.' });
  }
};

const voteForumPost = async (req, res) => {
  try {
    const viewerId = req.user?.id;
    if (!viewerId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (checkInMemoryMode()) {
      const post = memoryForumPosts.find(item => String(item._id) === String(req.params.id));
      if (!post) return res.status(404).json({ error: 'Post not found.' });
      const reaction = req.body.reaction === 'dislike' ? 'dislike' : 'like';
      post.likedBy = post.likedBy || [];
      post.dislikedBy = post.dislikedBy || [];
      const hasLiked = post.likedBy.some(id => String(id) === String(viewerId));
      const hasDisliked = post.dislikedBy.some(id => String(id) === String(viewerId));
      if (reaction === 'like') {
        post.likedBy = hasLiked ? post.likedBy.filter(id => String(id) !== String(viewerId)) : [...post.likedBy, viewerId];
        post.dislikedBy = hasDisliked ? post.dislikedBy.filter(id => String(id) !== String(viewerId)) : post.dislikedBy;
      } else {
        post.dislikedBy = hasDisliked ? post.dislikedBy.filter(id => String(id) !== String(viewerId)) : [...post.dislikedBy, viewerId];
        post.likedBy = hasLiked ? post.likedBy.filter(id => String(id) !== String(viewerId)) : post.likedBy;
      }
      post.votes = post.likedBy.length;
      return res.json(withViewerVote(post, viewerId));
    }

    const post = await ForumPost.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const reaction = req.body.reaction === 'dislike' ? 'dislike' : 'like';
    const hasLiked = post.likedBy.some(id => String(id) === String(viewerId));
    const hasDisliked = (post.dislikedBy || []).some(id => String(id) === String(viewerId));
    if (reaction === 'like') {
      if (hasLiked) {
        post.likedBy = post.likedBy.filter(id => String(id) !== String(viewerId));
      } else {
        post.likedBy.push(viewerId);
      }
      post.dislikedBy = (post.dislikedBy || []).filter(id => String(id) !== String(viewerId));
    } else {
      if (hasDisliked) {
        post.dislikedBy = post.dislikedBy.filter(id => String(id) !== String(viewerId));
      } else {
        post.dislikedBy = [...(post.dislikedBy || []), viewerId];
      }
      post.likedBy = post.likedBy.filter(id => String(id) !== String(viewerId));
    }
    post.votes = post.likedBy.length;
    await post.save();

    const updated = post.toObject();
    return res.json(withViewerVote(updated, viewerId));
  } catch (error) {
    console.error('Vote Forum Post Error:', error);
    return res.status(500).json({ error: 'Could not vote on community post.' });
  }
};

const replyForumPost = async (req, res) => {
  try {
    const viewerId = req.user?.id;
    const text = String(req.body.text || '').trim();

    if (!viewerId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!text) {
      return res.status(400).json({ error: 'Comment text is required.' });
    }

    const { authorName, authorPhoto } = await getAuthorProfile(viewerId);
    const reply = {
      userId: viewerId,
      authorName,
      authorPhoto,
      text: text.slice(0, 1000),
      createdAt: new Date()
    };

    if (checkInMemoryMode()) {
      const post = memoryForumPosts.find(item => String(item._id) === String(req.params.id));
      if (!post) return res.status(404).json({ error: 'Post not found.' });
      post.replies = [...(post.replies || []), { ...reply, _id: Math.random().toString(36).slice(2, 11) }];
      post.updatedAt = new Date();
      return res.status(201).json(withViewerVote(post, viewerId));
    }

    const post = await ForumPost.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    post.replies.push(reply);
    await post.save();
    return res.status(201).json(withViewerVote(post.toObject(), viewerId));
  } catch (error) {
    console.error('Reply Forum Post Error:', error);
    return res.status(500).json({ error: 'Could not add comment.' });
  }
};

module.exports = {
  listForumPosts,
  createForumPost,
  voteForumPost,
  replyForumPost
};
