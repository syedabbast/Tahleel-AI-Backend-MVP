const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Route imports
const uploadRoutes = require('./routes/upload');
const analysisRoutes = require('./routes/analysis');
const resultsRoutes = require('./routes/results');

// Middleware imports
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const server = createServer(app);

// Socket.io setup for real-time progress updates
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Make io available to routes
app.set('io', io);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/upload', uploadRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/results', resultsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'TAHLEEL.ai MVP Backend',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'TAHLEEL.ai MVP Backend - AI Football Tactical Analysis',
    company: 'Auwire Technologies',
    owner: 'Syed',
    target: 'Arab League Teams',
    subscription: '$15K-$45K monthly',
    endpoints: {
      upload: '/api/upload',
      analysis: '/api/analysis',
      results: '/api/results',
      health: '/health'
    }
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
  
  socket.on('join-analysis', (analysisId) => {
    socket.join(`analysis-${analysisId}`);
    console.log(`📊 Client joined analysis room: ${analysisId}`);
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `${req.method} ${req.originalUrl} not found`,
    availableRoutes: ['/api/upload', '/api/analysis', '/api/results', '/health']
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 TAHLEEL.ai MVP Backend running on port ${PORT}`);
  console.log(`🎯 Target: Arab League Teams ($15K-$45K subscriptions)`);
  console.log(`⚡ Real-time processing with Socket.io enabled`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
