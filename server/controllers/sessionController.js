const Session = require('../models/Session');
const geminiService = require('../services/geminiService');
const { checkInMemoryMode } = require('../config/db');
const mongoose = require('mongoose');
const UserProgress = require('../models/UserProgress');

// In-memory data store fallback if MongoDB is not running
const inMemorySessions = [];

// Helper to generate a unique ID for in-memory sessions
const generateId = () => Math.random().toString(36).substring(2, 9);

const ownsSession = (session, userId) => {
  if (!session || !userId) return false;
  return String(session.userId || '') === String(userId);
};

const validateMongoId = (id, res) => {
  if (!checkInMemoryMode() && !mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: 'Invalid session id.' });
    return false;
  }
  return true;
};

const cleanSessionPersona = (persona = {}, index = 0) => ({
  name: String(persona.name || `AI ${index + 1}`).slice(0, 40),
  role: String(persona.role || 'AI Participant').slice(0, 60),
  color: /^#[0-9a-f]{6}$/i.test(persona.color || '') ? persona.color : '#0f766e',
  style: String(persona.style || 'Balanced and professional').slice(0, 140),
  pressure: Math.max(0, Math.min(100, Number(persona.pressure) || 60)),
  desc: String(persona.desc || '').slice(0, 240),
  initialIntro: String(persona.initialIntro || '').slice(0, 320),
  prompt: String(persona.prompt || '').slice(0, 900)
});

/**
 * Create a new GD session
 */
const createSession = async (req, res) => {
  try {
    const { topic, durationLimit, industryContext, numParticipants, aiPersonas } = req.body;
    
    if (!topic || !durationLimit) {
      return res.status(400).json({ error: 'Topic and duration limit are required.' });
    }

    const selectedPersonas = Array.isArray(aiPersonas)
      ? aiPersonas.slice(0, 6).map(cleanSessionPersona)
      : [];

    const sessionData = {
      userId: req.user?.id,
      topic,
      industryContext: industryContext || 'General/Academic',
      durationLimit,
      numParticipants: selectedPersonas.length || numParticipants || 4,
      aiPersonas: selectedPersonas,
      createdAt: new Date(),
      transcript: [],
      userMetrics: {
        speakingTime: 0,
        speakPercentage: 0,
        interruptionCount: 0,
        interruptedCount: 0,
        pacingWpm: 0,
        fillerWordCount: 0,
        bodyLanguageScore: 0
      },
      participationBreakdown: [],
      aiEvaluation: {
        leadershipScore: 0,
        confidenceScore: 0,
        effectivenessScore: 0,
        analysisSummary: '',
        strengths: [],
        weaknesses: [],
        actionableTips: [],
        topicRelevance: '',
        argumentDepth: '',
        suggestedPhrases: []
      },
      isCompleted: false
    };

    if (checkInMemoryMode()) {
      const newSession = { _id: generateId(), ...sessionData };
      inMemorySessions.push(newSession);
      console.log(`[InMemoryDB] Created session: ${newSession._id}`);
      return res.status(201).json(newSession);
    } else {
      const newSession = new Session(sessionData);
      await newSession.save();
      console.log(`[MongoDB] Created session: ${newSession._id}`);
      return res.status(201).json(newSession);
    }
  } catch (error) {
    console.error('Create Session Error:', error);
    return res.status(500).json({ error: 'Internal Server Error while creating session.' });
  }
};

/**
 * Get all completed sessions (history list)
 */
const getHistory = async (req, res) => {
  try {
    if (checkInMemoryMode()) {
      const completed = inMemorySessions
        .filter(s => s.isCompleted && ownsSession(s, req.user?.id))
        .sort((a, b) => b.createdAt - a.createdAt);
      return res.json(completed);
    } else {
      const completed = await Session.find({ isCompleted: true, userId: req.user.id })
        .sort({ createdAt: -1 })
        .select('topic durationLimit createdAt userMetrics aiEvaluation');
      return res.json(completed);
    }
  } catch (error) {
    console.error('Get History Error:', error);
    return res.status(500).json({ error: 'Internal Server Error while fetching history.' });
  }
};

/**
 * Get detailed session by ID
 */
const getSessionById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!validateMongoId(id, res)) return;

    if (checkInMemoryMode()) {
      const session = inMemorySessions.find(s => s._id === id);
      if (!session) return res.status(404).json({ error: 'Session not found.' });
      if (!ownsSession(session, req.user?.id)) return res.status(403).json({ error: 'Access denied.' });
      return res.json(session);
    } else {
      const session = await Session.findById(id);
      if (!session) return res.status(404).json({ error: 'Session not found.' });
      if (!ownsSession(session, req.user?.id)) return res.status(403).json({ error: 'Access denied.' });
      return res.json(session);
    }
  } catch (error) {
    console.error('Get Session Error:', error);
    return res.status(500).json({ error: 'Internal Server Error while retrieving session.' });
  }
};

/**
 * Generate dialogue response for an AI participant
 */
const getAIResponse = async (req, res) => {
  try {
    const { topic, transcript, speakerName, personaPrompt, industryContext } = req.body;
    
    if (!topic || !speakerName || !personaPrompt) {
      return res.status(400).json({ error: 'Missing required fields: topic, speakerName, personaPrompt.' });
    }

    const aiSpeech = await geminiService.generateParticipantResponse(
      topic,
      transcript || [],
      speakerName,
      personaPrompt,
      industryContext || 'General/Academic'
    );

    return res.json({ text: aiSpeech, rateLimit: geminiService.getRateLimitStatus() });
  } catch (error) {
    console.error('Generate AI Response Error:', error);
    return res.status(500).json({ error: 'Failed to generate AI response.' });
  }
};

/**
 * Lightweight live coaching for the current GD transcript.
 * The Gemini service queues these calls so the free-tier RPM limit is respected.
 */
const getLiveAnalysis = async (req, res) => {
  try {
    const { topic, transcript, userMetrics } = req.body;

    if (!topic || !Array.isArray(transcript)) {
      return res.status(400).json({ error: 'Topic and transcript array are required.' });
    }

    const analysis = await geminiService.analyzeLiveTurn(topic, transcript, userMetrics || {});
    return res.json(analysis);
  } catch (error) {
    console.error('Live Analysis Error:', error);
    return res.status(500).json({ error: 'Failed to generate live analysis.' });
  }
};

const getAIStatus = (req, res) => {
  return res.json(geminiService.getRateLimitStatus());
};

const runMiniGdTurn = async (req, res) => {
  try {
    const { topic, transcript, userText, member, industryContext } = req.body;

    if (!topic || !userText) {
      return res.status(400).json({ error: 'Topic and user response are required.' });
    }

    const result = await geminiService.runMiniGdTurn({
      topic,
      transcript: transcript || [],
      userText,
      member: member || {},
      industryContext
    });

    return res.json({ ...result, rateLimit: geminiService.getRateLimitStatus() });
  } catch (error) {
    console.error('Mini GD Turn Error:', error);
    return res.status(500).json({ error: 'Failed to run mini GD turn.' });
  }
};

/**
 * Complete session, save transcript, and run Gemini analytics
 */
const completeSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { transcript, userMetrics, participationBreakdown, roundNotes } = req.body;
    if (!validateMongoId(id, res)) return;

    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required to complete session.' });
    }

    // Attempt to load current session details (to fetch topic)
    let session = null;
    if (checkInMemoryMode()) {
      session = inMemorySessions.find(s => s._id === id);
    } else {
      session = await Session.findById(id);
    }

    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }
    if (!ownsSession(session, req.user?.id)) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Call Gemini API to run the qualitative coaching report
    console.log(`Running communication diagnostics on Session ${id} Topic: "${session.topic}"...`);
    const aiEvaluation = await geminiService.analyzeGDSession(
      session.topic,
      transcript,
      userMetrics || { speakingTime: 0, speakPercentage: 0, interruptionCount: 0, interruptedCount: 0, pacingWpm: 0, fillerWordCount: 0, bodyLanguageScore: 0 }
    );

    // Prepare update parameters
    const updateData = {
      transcript,
      userMetrics: userMetrics || session.userMetrics,
      participationBreakdown: participationBreakdown || [],
      roundNotes: roundNotes || session.roundNotes || '',
      aiEvaluation,
      isCompleted: true
    };

    if (checkInMemoryMode()) {
      // Find the session and update it
      const idx = inMemorySessions.findIndex(s => s._id === id);
      const updatedSession = { ...inMemorySessions[idx], ...updateData };
      inMemorySessions[idx] = updatedSession;
      console.log(`[InMemoryDB] Saved completed session: ${id}`);
      return res.json(updatedSession);
    } else {
      const updatedSession = await Session.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true }
      );
      console.log(`[MongoDB] Saved completed session: ${id}`);
      const averageScore = Math.round((
        (aiEvaluation.leadershipScore || 0) +
        (aiEvaluation.confidenceScore || 0) +
        (aiEvaluation.effectivenessScore || 0)
      ) / 3);
      await UserProgress.findOneAndUpdate(
        { userId: req.user.id },
        {
          $inc: { completedSessions: 1 },
          $set: { averageScore },
          $push: {
            fillerWordTrend: { date: new Date(), count: userMetrics?.fillerWordCount || 0 },
            confidenceTrend: { date: new Date(), score: aiEvaluation.confidenceScore || 0 },
            weakPhraseHistory: { $each: (aiEvaluation.suggestedPhrases || []).map(item => item.original).filter(Boolean).slice(0, 5) }
          }
        },
        { upsert: true, new: true }
      );
      return res.json(updatedSession);
    }
  } catch (error) {
    console.error('Complete Session Error:', error);
    return res.status(500).json({ error: 'Internal Server Error while analyzing and completing session.' });
  }
};

/**
 * Moderate the GD session to check for off-topic discussions
 */
const moderateGD = async (req, res) => {
  try {
    const { topic, transcript } = req.body;
    
    if (!topic || !transcript || !Array.isArray(transcript)) {
      return res.status(400).json({ error: 'Topic and transcript array are required.' });
    }

    const intervention = await geminiService.moderateDiscussion(topic, transcript);
    
    return res.json({ intervention, rateLimit: geminiService.getRateLimitStatus() });
  } catch (error) {
    console.error('Moderation Error:', error);
    // On error, return null intervention to keep discussion going
    return res.json({ intervention: null });
  }
};

module.exports = {
  createSession,
  getHistory,
  getSessionById,
  getAIResponse,
  getLiveAnalysis,
  getAIStatus,
  runMiniGdTurn,
  completeSession,
  moderateGD
};
