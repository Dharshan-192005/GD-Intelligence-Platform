const crypto = require('crypto');
const User = require('../models/User');
const { checkInMemoryMode } = require('../config/db');

const inMemoryUsers = [];
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || process.env.GEMINI_API_KEY || 'gd-platform-dev-secret';

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
