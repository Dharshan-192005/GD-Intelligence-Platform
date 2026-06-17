const User = require('../models/User');
const UserProfile = require('../models/UserProfile');
const AiPersona = require('../models/AiPersona');
const PrepState = require('../models/PrepState');
const ResumeTopic = require('../models/ResumeTopic');
const UserProgress = require('../models/UserProgress');
const { checkInMemoryMode } = require('../config/db');

const memoryStore = {
  profiles: new Map(),
  personas: new Map(),
  prepStates: new Map(),
  resumeTopics: new Map(),
  progress: new Map()
};

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

const cleanPersona = (persona, order = 0) => ({
  name: String(persona.name || `AI ${order + 1}`).trim(),
  role: String(persona.role || 'AI Participant').trim(),
  style: String(persona.style || ''),
  color: String(persona.color || '#0f766e'),
  desc: String(persona.desc || ''),
  pressure: Math.max(0, Math.min(100, Number(persona.pressure ?? 60))),
  prompt: String(persona.prompt || ''),
  initialIntro: String(persona.initialIntro || ''),
  isActive: persona.isActive !== false,
  order
});

const getMemoryUserData = (userId) => {
  if (!memoryStore.profiles.has(userId)) {
    memoryStore.profiles.set(userId, {
      role: 'Student',
      goal: 'Placement GD preparation',
      experienceLevel: 'Intermediate',
      targetIndustry: 'General / Academic',
      institution: '',
      location: '',
      speakingGoal: '',
      profilePhoto: '',
      notes: '',
      settings: DEFAULT_SETTINGS
    });
  }
  if (!memoryStore.personas.has(userId)) memoryStore.personas.set(userId, DEFAULT_PERSONAS);
  if (!memoryStore.prepStates.has(userId)) memoryStore.prepStates.set(userId, { checklist: {}, speakingGoals: {}, weakAreas: [], activeDrill: 'Opening', practiceStreak: 0 });
  if (!memoryStore.resumeTopics.has(userId)) memoryStore.resumeTopics.set(userId, []);
  if (!memoryStore.progress.has(userId)) memoryStore.progress.set(userId, { averageScore: 0, completedSessions: 0, practiceStreak: 0, fillerWordTrend: [], confidenceTrend: [], weakPhraseHistory: [], badges: [] });

  return {
    profile: memoryStore.profiles.get(userId),
    aiPersonas: memoryStore.personas.get(userId),
    prepState: memoryStore.prepStates.get(userId),
    resumeTopics: memoryStore.resumeTopics.get(userId),
    progress: memoryStore.progress.get(userId)
  };
};

const getUserData = async (req, res) => {
  try {
    const userId = req.user.id;

    if (checkInMemoryMode()) {
      return res.json(getMemoryUserData(userId));
    }

    const [profile, personas, prepState, resumeTopics, progress] = await Promise.all([
      UserProfile.findOneAndUpdate(
        { userId },
        { $setOnInsert: { userId, settings: DEFAULT_SETTINGS } },
        { upsert: true, new: true }
      ).lean(),
      AiPersona.find({ userId, isActive: true }).sort({ order: 1, createdAt: 1 }).lean(),
      PrepState.findOneAndUpdate(
        { userId },
        { $setOnInsert: { userId, checklist: {}, activeDrill: 'Opening' } },
        { upsert: true, new: true }
      ).lean(),
      ResumeTopic.find({ userId }).sort({ createdAt: -1 }).limit(10).lean(),
      UserProgress.findOneAndUpdate(
        { userId },
        { $setOnInsert: { userId } },
        { upsert: true, new: true }
      ).lean()
    ]);

    let aiPersonas = personas;
    if (aiPersonas.length === 0) {
      aiPersonas = await AiPersona.insertMany(DEFAULT_PERSONAS.map((persona) => ({ ...persona, userId })));
    }

    return res.json({
      profile: profile ? { ...profile, settings: { ...DEFAULT_SETTINGS, ...(profile.settings || {}) } } : profile,
      aiPersonas,
      prepState,
      resumeTopics,
      progress
    });
  } catch (error) {
    console.error('Get User Data Error:', error);
    return res.status(500).json({ error: 'Could not load user data.' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email, role, goal, experienceLevel, targetIndustry, institution, location, speakingGoal, profilePhoto, notes } = req.body;
    const cleanProfilePhoto = String(profilePhoto || '');
    if (cleanProfilePhoto && (!cleanProfilePhoto.startsWith('data:image/') || cleanProfilePhoto.length > 750000)) {
      return res.status(400).json({ error: 'Profile photo must be a valid image under 750KB.' });
    }

    if (checkInMemoryMode()) {
      const current = getMemoryUserData(userId).profile;
      const profile = { ...current, role, goal, experienceLevel, targetIndustry, institution, location, speakingGoal, profilePhoto: cleanProfilePhoto, notes };
      memoryStore.profiles.set(userId, profile);
      return res.json({ profile });
    }

    if (name || email) {
      const update = {};
      if (name) update.name = String(name).trim();
      if (email) update.email = String(email).trim().toLowerCase();
      await User.findByIdAndUpdate(userId, { $set: update }, { new: true });
    }

    const profile = await UserProfile.findOneAndUpdate(
      { userId },
      { $set: { role, goal, experienceLevel, targetIndustry, institution, location, speakingGoal, profilePhoto: cleanProfilePhoto, notes } },
      { upsert: true, new: true }
    );

    return res.json({ profile });
  } catch (error) {
    console.error('Update Profile Error:', error);
    return res.status(500).json({ error: 'Could not save profile.' });
  }
};

const updateSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const settings = { ...DEFAULT_SETTINGS, ...(req.body.settings || req.body || {}) };

    if (checkInMemoryMode()) {
      const current = getMemoryUserData(userId).profile;
      const profile = { ...current, settings };
      memoryStore.profiles.set(userId, profile);
      return res.json({ settings });
    }

    const profile = await UserProfile.findOneAndUpdate(
      { userId },
      { $set: { settings } },
      { upsert: true, new: true }
    );

    return res.json({ settings: profile.settings });
  } catch (error) {
    console.error('Update Settings Error:', error);
    return res.status(500).json({ error: 'Could not save settings.' });
  }
};

const updatePersonas = async (req, res) => {
  try {
    const userId = req.user.id;
    const personas = Array.isArray(req.body.personas) ? req.body.personas.map(cleanPersona) : [];
    if (personas.length === 0) return res.status(400).json({ error: 'At least one AI persona is required.' });

    if (checkInMemoryMode()) {
      memoryStore.personas.set(userId, personas);
      return res.json({ aiPersonas: personas });
    }

    await AiPersona.deleteMany({ userId });
    const aiPersonas = await AiPersona.insertMany(personas.map((persona) => ({ ...persona, userId })));
    return res.json({ aiPersonas });
  } catch (error) {
    console.error('Update Personas Error:', error);
    return res.status(500).json({ error: 'Could not save AI personas.' });
  }
};

const updatePrepState = async (req, res) => {
  try {
    const userId = req.user.id;
    const prepState = req.body.prepState || req.body || {};

    if (checkInMemoryMode()) {
      memoryStore.prepStates.set(userId, prepState);
      return res.json({ prepState });
    }

    const saved = await PrepState.findOneAndUpdate(
      { userId },
      { $set: prepState },
      { upsert: true, new: true }
    );

    return res.json({ prepState: saved });
  } catch (error) {
    console.error('Update Prep State Error:', error);
    return res.status(500).json({ error: 'Could not save prep state.' });
  }
};

const addResumeTopics = async (req, res) => {
  try {
    const userId = req.user.id;
    const topics = Array.isArray(req.body.topics) ? req.body.topics : [];
    if (topics.length === 0) return res.status(400).json({ error: 'Topics are required.' });

    const item = {
      sourceName: req.body.sourceName || 'Resume upload',
      topics,
      industryContext: req.body.industryContext || 'General / Academic',
      createdAt: new Date()
    };

    if (checkInMemoryMode()) {
      const current = getMemoryUserData(userId).resumeTopics;
      const resumeTopics = [item, ...current].slice(0, 10);
      memoryStore.resumeTopics.set(userId, resumeTopics);
      return res.status(201).json(item);
    }

    const saved = await ResumeTopic.create({ ...item, userId });
    return res.status(201).json(saved);
  } catch (error) {
    console.error('Add Resume Topics Error:', error);
    return res.status(500).json({ error: 'Could not save resume topics.' });
  }
};

module.exports = {
  getUserData,
  updateProfile,
  updateSettings,
  updatePersonas,
  updatePrepState,
  addResumeTopics
};
