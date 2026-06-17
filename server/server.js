require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB, getDatabaseStatus } = require('./config/db');
const {
  createSession,
  getHistory,
  getSessionById,
  getAIResponse,
  getLiveAnalysis,
  getAIStatus,
  runMiniGdTurn,
  completeSession,
  moderateGD
} = require('./controllers/sessionController');
const { signup, login, requireAuth } = require('./controllers/authController');

const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

// Enable CORS for frontend connectivity
app.use(cors({
  origin: '*', // Allow all origins for local development and subagent browser tests
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body-parsing middleware
app.use(express.json());

// Global health check endpoint
app.get('/api/health', (req, res) => {
  const database = getDatabaseStatus();
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    database: database.mode,
    persistentStorage: database.isPersistent,
    databaseError: database.lastConnectionError || null
  });
});

// Group Discussion Sessions API Routes
const topicRoutes = require('./routes/topicRoutes');
const userDataRoutes = require('./routes/userDataRoutes');
const forumRoutes = require('./routes/forumRoutes');
const meetingRoutes = require('./routes/meetingRoutes');

app.post('/api/auth/signup', signup);
app.post('/api/auth/login', login);

app.use('/api/topics', requireAuth, topicRoutes);
app.use('/api/user-data', requireAuth, userDataRoutes);
app.use('/api/forum', requireAuth, forumRoutes);
app.use('/api/meetings', requireAuth, meetingRoutes);

app.post('/api/sessions', requireAuth, createSession);
app.get('/api/sessions/history', requireAuth, getHistory);
app.post('/api/sessions/moderate', requireAuth, moderateGD);
app.post('/api/sessions/generate-response', requireAuth, getAIResponse);
app.post('/api/sessions/live-analysis', requireAuth, getLiveAnalysis);
app.post('/api/sessions/mini-gd-turn', requireAuth, runMiniGdTurn);
app.get('/api/sessions/ai/status', requireAuth, getAIStatus);
app.get('/api/sessions/:id', requireAuth, getSessionById);
app.post('/api/sessions/:id/complete', requireAuth, completeSession);

// 404 Route handler
app.use((req, res, next) => {
  res.status(404).json({ error: `Route not found: ${req.originalUrl}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Global Error:', err.message);
  res.status(500).json({ error: 'Internal Server Error. Please inspect server logs.' });
});

// Socket.io integration
const meetingParticipants = new Map();

const getRoomParticipants = (roomCode) => Array.from(meetingParticipants.get(roomCode)?.values() || []);

const removeSocketFromMeetings = (socket) => {
  meetingParticipants.forEach((participants, roomCode) => {
    const participant = participants.get(socket.id);
    if (!participant) return;

    participants.delete(socket.id);
    socket.to(roomCode).emit('meeting:participant-left', {
      socketId: socket.id,
      participant
    });
    io.to(roomCode).emit('meeting:participants', getRoomParticipants(roomCode));

    if (participants.size === 0) {
      meetingParticipants.delete(roomCode);
    }
  });
};

io.on('connection', (socket) => {
  console.log(`[Socket] User connected: ${socket.id}`);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`[Socket] User ${socket.id} joined room ${roomId}`);
  });

  socket.on('send-message', (data) => {
    socket.to(data.roomId).emit('receive-message', data.message);
  });

  socket.on('sync-state', (data) => {
    socket.to(data.roomId).emit('sync-state', data.state);
  });

  socket.on('meeting:join', ({ roomCode, user }) => {
    const code = String(roomCode || '').trim().toUpperCase();
    if (!code) return;

    socket.join(code);
    const participant = {
      socketId: socket.id,
      name: user?.name || 'Participant',
      email: user?.email || '',
      profilePhoto: user?.profilePhoto || '',
      micOn: user?.micOn !== false,
      cameraOn: user?.cameraOn !== false,
      joinedAt: new Date()
    };

    if (!meetingParticipants.has(code)) {
      meetingParticipants.set(code, new Map());
    }

    meetingParticipants.get(code).set(socket.id, participant);
    socket.emit('meeting:participants', getRoomParticipants(code));
    socket.to(code).emit('meeting:participant-joined', participant);
    io.to(code).emit('meeting:participants', getRoomParticipants(code));
  });

  socket.on('meeting:chat', ({ roomCode, message }) => {
    const code = String(roomCode || '').trim().toUpperCase();
    if (!code || !message) return;
    socket.to(code).emit('meeting:chat', message);
  });

  socket.on('meeting:signal', ({ roomCode, targetSocketId, signal }) => {
    const code = String(roomCode || '').trim().toUpperCase();
    if (!code || !targetSocketId || !signal) return;
    io.to(targetSocketId).emit('meeting:signal', {
      roomCode: code,
      fromSocketId: socket.id,
      signal
    });
  });

  socket.on('meeting:media-state', ({ roomCode, micOn, cameraOn }) => {
    const code = String(roomCode || '').trim().toUpperCase();
    const participants = meetingParticipants.get(code);
    const participant = participants?.get(socket.id);
    if (!participant) return;

    participant.micOn = micOn;
    participant.cameraOn = cameraOn;
    participants.set(socket.id, participant);
    io.to(code).emit('meeting:participants', getRoomParticipants(code));
  });

  socket.on('meeting:leave', ({ roomCode }) => {
    const code = String(roomCode || '').trim().toUpperCase();
    if (code) socket.leave(code);
    removeSocketFromMeetings(socket);
  });

  socket.on('disconnect', () => {
    removeSocketFromMeetings(socket);
    console.log(`[Socket] User disconnected: ${socket.id}`);
  });
});

// Start Express Server after database mode is known.
const startServer = async () => {
  await connectDB();

  server.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 Group Discussion Intelligence Server started on port ${PORT}`);
  console.log(`📌 Health check available at: http://localhost:${PORT}/api/health`);
  console.log(`===================================================`);
  });
};

startServer();
