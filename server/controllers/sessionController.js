const Session = require('../models/Session');
const geminiService = require('../services/geminiService');
const { checkInMemoryMode } = require('../config/db');
const mongoose = require('mongoose');

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

/**
 * Create a new GD session
 */
const createSession = async (req, res) => {
  try {
    const { topic, durationLimit, industryContext, numParticipants } = req.body;
    
    if (!topic || !durationLimit) {
      return res.status(400).json({ error: 'Topic and duration limit are required.' });
    }

    const sessionData = {
      userId: req.user?.id,
      topic,
      industryContext: industryContext || 'General/Academic',
      durationLimit,
      numParticipants: numParticipants || 4,
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

/**
 * Complete session, save transcript, and run Gemini analytics
 */
const completeSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { transcript, userMetrics, participationBreakdown } = req.body;
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
  completeSession,
  moderateGD
};
