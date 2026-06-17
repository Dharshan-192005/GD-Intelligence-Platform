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

app.post('/api/auth/signup', signup);
app.post('/api/auth/login', login);

app.use('/api/topics', requireAuth, topicRoutes);
app.use('/api/user-data', requireAuth, userDataRoutes);
app.use('/api/forum', requireAuth, forumRoutes);

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

  socket.on('disconnect', () => {
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
