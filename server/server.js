require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');
const {
  createSession,
  getHistory,
  getSessionById,
  getAIResponse,
  completeSession
} = require('./controllers/sessionController');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend connectivity
app.use(cors({
  origin: '*', // Allow all origins for local development and subagent browser tests
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body-parsing middleware
app.use(express.json());

// Initialize Database Connection
connectDB();

// Global health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    database: require('./config/db').checkInMemoryMode() ? 'in-memory (demo)' : 'mongodb'
  });
});

// Group Discussion Sessions API Routes
app.post('/api/sessions', createSession);
app.get('/api/sessions/history', getHistory);
app.post('/api/sessions/generate-response', getAIResponse);
app.get('/api/sessions/:id', getSessionById);
app.post('/api/sessions/:id/complete', completeSession);

// 404 Route handler
app.use((req, res, next) => {
  res.status(404).json({ error: `Route not found: ${req.originalUrl}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Global Error:', err.message);
  res.status(500).json({ error: 'Internal Server Error. Please inspect server logs.' });
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 Group Discussion Intelligence Server started on port ${PORT}`);
  console.log(`📌 Health check available at: http://localhost:${PORT}/api/health`);
  console.log(`===================================================`);
});
