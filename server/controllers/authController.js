const crypto = require('crypto');
const User = require('../models/User');
const { checkInMemoryMode } = require('../config/db');
const UserProfile = require('../models/UserProfile');
const AiPersona = require('../models/AiPersona');
const PrepState = require('../models/PrepState');
const UserProgress = require('../models/UserProgress');

const inMemoryUsers = [];
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || process.env.GEMINI_API_KEY || 'gd-platform-dev-secret';

const DEFAULT_SETTINGS = {
  targetIndustry: 'General / Academic',
  preferredDuration: '2 minutes',
  voiceMode: 'Balanced AI voices',
  themePreference: 'Professional light',
  coachingIntensity: 'Balanced',
  requestMode: 'Free-tier balanced',
  interfaceDensity: 'Comfortable',
  animationMode: 'Smooth animations',
  sidebarMode: 'Expanded sidebar',
  focusMode: 'Balanced workspace',
  chatScrollMode: 'Auto-scroll chat',
  soundEffects: 'On'
};

const DEFAULT_PERSONAS = [
  {
    name: 'Aarav',
    role: 'Aggressive Speaker',
    style: 'Fast, direct, challenging',
    color: '#f43f5e',
    desc: 'Challenges weak logic immediately and pushes others to justify every claim.',
    pressure: 90,
    prompt: 'You are an aggressive GD participant. Speak fast, challenge weak points, interrupt occasionally, and demand practical proof.',
    initialIntro: 'I want to challenge the basic assumption here before everyone agrees too quickly.',
    isActive: true,
    order: 0
  },
  {
    name: 'Nisha',
    role: 'Silent Observer',
    style: 'Brief, thoughtful, selective',
    color: '#64748b',
    desc: 'Speaks rarely but gives sharp summary points when the discussion loses direction.',
    pressure: 35,
    prompt: 'You are a silent observer. Speak less often, but when you speak, summarize clearly and add one thoughtful insight.',
    initialIntro: 'I have been listening, and I think one important angle is being missed.',
    isActive: true,
    order: 1
  },
  {
    name: 'Rohan',
    role: 'Dominant Leader',
    style: 'Confident, directive, organized',
    color: '#7c3aed',
    desc: 'Takes control of flow, assigns direction, and tries to lead the room.',
    pressure: 84,
    prompt: 'You are a dominant leader. Guide the discussion, organize points, and confidently push the group toward a conclusion.',
    initialIntro: 'Let me structure this discussion into causes, impact, and possible solutions.',
    isActive: true,
    order: 2
  },
  {
    name: 'Meera',
    role: 'Logical Thinker',
    style: 'Data-backed, structured, calm',
    color: '#06b6d4',
    desc: 'Asks for evidence, compares pros and cons, and prefers clear reasoning.',
    pressure: 76,
    prompt: 'You are a logical thinker. Use evidence, ask for data, compare tradeoffs, and keep the discussion structured.',
    initialIntro: 'From a logical perspective, we should separate opinion from measurable impact.',
    isActive: true,
    order: 3
  }
];

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => {
  const passwordHash = crypto
    .pbkdf2Sync(String(password), salt, 120000, 64, 'sha512')
    .toString('hex');

  return { passwordHash, passwordSalt: salt };
};

const publicUser = (user) => ({
  id: user._id || user.id,
  name: user.name,
  email: user.email
});

const base64Url = (value) => Buffer
  .from(value)
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '');

const signPayload = (payload) => crypto
  .createHmac('sha256', TOKEN_SECRET)
  .update(payload)
  .digest('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '');

const createToken = (user) => {
  const payload = base64Url(JSON.stringify({
    userId: String(user._id || user.id),
    email: user.email,
    exp: Date.now() + TOKEN_TTL_MS
  }));
  return `${payload}.${signPayload(payload)}`;
};

const initializeAccountData = async (user) => {
  const userId = user._id;
  await Promise.all([
    UserProfile.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: {
          userId,
          role: 'Student',
          goal: 'Placement GD preparation',
          experienceLevel: 'Beginner',
          targetIndustry: 'General / Academic',
          profilePhoto: '',
          settings: DEFAULT_SETTINGS
        }
      },
      { upsert: true, new: true }
    ),
    PrepState.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId, checklist: {}, activeDrill: 'Opening' } },
      { upsert: true, new: true }
    ),
    UserProgress.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId } },
      { upsert: true, new: true }
    )
  ]);

  const personaCount = await AiPersona.countDocuments({ userId });
  if (personaCount === 0) {
    await AiPersona.insertMany(DEFAULT_PERSONAS.map(persona => ({ ...persona, userId })));
  }
};

const verifyToken = (token) => {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature || signPayload(payload) !== signature) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    if (!decoded.userId || decoded.exp < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
};

const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Authentication required. Please sign in again.' });
  }

  req.user = { id: decoded.userId, email: decoded.email };
  return next();
};

const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const cleanEmail = normalizeEmail(email);

    if (!name || !cleanEmail || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    if (checkInMemoryMode()) {
      if (process.env.ALLOW_IN_MEMORY_AUTH !== 'true') {
        return res.status(503).json({
          error: 'MongoDB is not connected, so signup cannot be saved. Start MongoDB or fix MONGODB_URI, then restart the server.'
        });
      }

      if (inMemoryUsers.some(user => user.email === cleanEmail)) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }

      const credentials = hashPassword(password);
      const user = {
        id: Math.random().toString(36).substring(2, 10),
        name: String(name).trim(),
        email: cleanEmail,
        ...credentials,
        createdAt: new Date()
      };
      inMemoryUsers.push(user);
      return res.status(201).json({ user: publicUser(user), token: createToken(user) });
    }

    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const credentials = hashPassword(password);
    const user = await User.create({
      name: String(name).trim(),
      email: cleanEmail,
      ...credentials
    });
    await initializeAccountData(user);

    return res.status(201).json({ user: publicUser(user), token: createToken(user) });
  } catch (error) {
    console.error('Signup Error:', error);
    return res.status(500).json({ error: 'Could not create account.' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    if (checkInMemoryMode() && process.env.ALLOW_IN_MEMORY_AUTH !== 'true') {
      return res.status(503).json({
        error: 'MongoDB is not connected, so saved accounts cannot be loaded. Start MongoDB or fix MONGODB_URI, then restart the server.'
      });
    }

    const user = checkInMemoryMode()
      ? inMemoryUsers.find(item => item.email === cleanEmail)
      : await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const { passwordHash } = hashPassword(password, user.passwordSalt);
    if (passwordHash !== user.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    return res.json({ user: publicUser(user), token: createToken(user) });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ error: 'Could not sign in.' });
  }
};

module.exports = {
  signup,
  login,
  requireAuth
};
