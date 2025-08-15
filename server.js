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

// Service imports for connection checks
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const { Storage } = require('@google-cloud/storage');

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

// Initialize service clients for connection testing
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const claude = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY
});

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

// Service connection status
let serviceStatus = {
  gpt4: { connected: false, lastCheck: null, error: null },
  claude: { connected: false, lastCheck: null, error: null },
  googleCloud: { connected: false, lastCheck: null, error: null }
};

/**
 * Check GPT-4 connection
 */
async function checkGPT4Connection() {
  try {
    console.log('🤖 Testing GPT-4 connection...');
    
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: "Test connection" }],
      max_tokens: 5
    });
    
    serviceStatus.gpt4 = {
      connected: true,
      lastCheck: new Date().toISOString(),
      error: null,
      model: "gpt-4",
      status: "operational"
    };
    
    console.log('✅ GPT-4 connection successful');
    return true;
    
  } catch (error) {
    serviceStatus.gpt4 = {
      connected: false,
      lastCheck: new Date().toISOString(),
      error: error.message,
      status: "failed"
    };
    
    console.error('❌ GPT-4 connection failed:', error.message);
    return false;
  }
}

/**
 * Check Claude connection
 */
async function checkClaudeConnection() {
  try {
    console.log('🧠 Testing Claude connection...');
    
    const response = await claude.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 5,
      messages: [{ role: "user", content: "Test connection" }]
    });
    
    serviceStatus.claude = {
      connected: true,
      lastCheck: new Date().toISOString(),
      error: null,
      model: "claude-3-haiku-20240307",
      status: "operational"
    };
    
    console.log('✅ Claude connection successful');
    return true;
    
  } catch (error) {
    serviceStatus.claude = {
      connected: false,
      lastCheck: new Date().toISOString(),
      error: error.message,
      status: "failed"
    };
    
    console.error('❌ Claude connection failed:', error.message);
    return false;
  }
}

/**
 * Check Google Cloud Storage connection
 */
async function checkGoogleCloudConnection() {
  try {
    console.log('☁️ Testing Google Cloud Storage connection...');
    
    const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
    if (!bucketName) {
      throw new Error('GOOGLE_CLOUD_STORAGE_BUCKET not configured');
    }
    
    const bucket = storage.bucket(bucketName);
    const [exists] = await bucket.exists();
    
    if (!exists) {
      throw new Error(`Bucket ${bucketName} does not exist`);
    }
    
    // Test bucket access
    await bucket.getMetadata();
    
    serviceStatus.googleCloud = {
      connected: true,
      lastCheck: new Date().toISOString(),
      error: null,
      bucket: bucketName,
      status: "operational"
    };
    
    console.log(`✅ Google Cloud Storage connection successful (bucket: ${bucketName})`);
    return true;
    
  } catch (error) {
    serviceStatus.googleCloud = {
      connected: false,
      lastCheck: new Date().toISOString(),
      error: error.message,
      status: "failed"
    };
    
    console.error('❌ Google Cloud Storage connection failed:', error.message);
    return false;
  }
}

/**
 * Check all service connections
 */
async function checkAllServices() {
  console.log('🔍 Checking all service connections...');
  
  const checks = await Promise.allSettled([
    checkGPT4Connection(),
    checkClaudeConnection(),
    checkGoogleCloudConnection()
  ]);
  
  const allConnected = checks.every(check => 
    check.status === 'fulfilled' && check.value === true
  );
  
  console.log(`📊 Service Status Summary:`);
  console.log(`   GPT-4: ${serviceStatus.gpt4.connected ? '✅ Connected' : '❌ Failed'}`);
  console.log(`   Claude: ${serviceStatus.claude.connected ? '✅ Connected' : '❌ Failed'}`);
  console.log(`   Google Cloud: ${serviceStatus.googleCloud.connected ? '✅ Connected' : '❌ Failed'}`);
  
  if (allConnected) {
    console.log('🎉 All services operational - Ready for Arab League deployment!');
  } else {
    console.log('⚠️ Some services failed - Check configuration before launch');
  }
  
  return allConnected;
}

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

// Enhanced health check with service status
app.get('/health', (req, res) => {
  const overallStatus = serviceStatus.gpt4.connected && 
                       serviceStatus.claude.connected && 
                       serviceStatus.googleCloud.connected;
  
  res.json({
    status: overallStatus ? 'OK' : 'DEGRADED',
    service: 'TAHLEEL.ai MVP Backend',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '1.0.0',
    services: {
      gpt4: {
        status: serviceStatus.gpt4.connected ? 'connected' : 'disconnected',
        lastCheck: serviceStatus.gpt4.lastCheck,
        error: serviceStatus.gpt4.error
      },
      claude: {
        status: serviceStatus.claude.connected ? 'connected' : 'disconnected',
        lastCheck: serviceStatus.claude.lastCheck,
        error: serviceStatus.claude.error
      },
      googleCloud: {
        status: serviceStatus.googleCloud.connected ? 'connected' : 'disconnected',
        lastCheck: serviceStatus.googleCloud.lastCheck,
        error: serviceStatus.googleCloud.error
      }
    },
    arabLeagueReady: overallStatus,
    subscriptionTiers: ['$15K Regional', '$25K Global', '$45K Elite']
  });
});

// Service status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    services: serviceStatus,
    overall: {
      operational: serviceStatus.gpt4.connected && 
                   serviceStatus.claude.connected && 
                   serviceStatus.googleCloud.connected,
      arabLeagueReady: serviceStatus.gpt4.connected && 
                       serviceStatus.claude.connected && 
                       serviceStatus.googleCloud.connected
    }
  });
});

// Manual service check endpoint
app.post('/api/check-services', async (req, res) => {
  try {
    console.log('🔄 Manual service check requested...');
    const allConnected = await checkAllServices();
    
    res.json({
      success: true,
      message: 'Service check completed',
      allConnected: allConnected,
      services: serviceStatus,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Service check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Service check failed',
      message: error.message
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  const operational = serviceStatus.gpt4.connected && 
                     serviceStatus.claude.connected && 
                     serviceStatus.googleCloud.connected;
  
  res.json({
    message: 'TAHLEEL.ai MVP Backend - AI Football Tactical Analysis',
    company: 'Auwire Technologies',
    owner: 'Syed',
    target: 'Arab League Teams',
    subscription: '$15K-$45K monthly',
    status: operational ? 'Operational' : 'Service Issues Detected',
    arabLeagueReady: operational,
    endpoints: {
      upload: '/api/upload',
      analysis: '/api/analysis',
      results: '/api/results',
      health: '/health',
      status: '/api/status',
      checkServices: 'POST /api/check-services'
    },
    services: {
      gpt4: serviceStatus.gpt4.connected ? '✅ Connected' : '❌ Disconnected',
      claude: serviceStatus.claude.connected ? '✅ Connected' : '❌ Disconnected',
      googleCloud: serviceStatus.googleCloud.connected ? '✅ Connected' : '❌ Disconnected'
    }
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  
  // Send current service status to client
  socket.emit('service-status', serviceStatus);
  
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
  
  socket.on('join-analysis', (analysisId) => {
    socket.join(`analysis-${analysisId}`);
    console.log(`📊 Client joined analysis room: ${analysisId}`);
  });
  
  // Handle service check requests
  socket.on('check-services', async () => {
    console.log(`🔍 Client requested service check: ${socket.id}`);
    await checkAllServices();
    socket.emit('service-status', serviceStatus);
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `${req.method} ${req.originalUrl} not found`,
    availableRoutes: ['/api/upload', '/api/analysis', '/api/results', '/health', '/api/status']
  });
});

const PORT = process.env.PORT || 5000;

// Startup service checks
async function startServer() {
  console.log('🚀 Starting TAHLEEL.ai Backend...');
  
  // Check all services on startup
  await checkAllServices();
  
  // Set up periodic service checks (every 5 minutes)
  setInterval(async () => {
    console.log('🔄 Periodic service check...');
    await checkAllServices();
    
    // Broadcast service status to all connected clients
    io.emit('service-status', serviceStatus);
  }, 5 * 60 * 1000); // 5 minutes
  
  server.listen(PORT, async () => {
    console.log(`🚀 TAHLEEL.ai MVP Backend running on port ${PORT}`);

try {
    const gcsConnected = await gcsService.testConnection();
    if (gcsConnected) {
      console.log('✅ Google Cloud Storage: READY FOR ARAB LEAGUE');
    } else {
      console.error('❌ Google Cloud Storage: CONNECTION FAILED');
      console.error('🚨 CRITICAL: Video uploads will not work!');
    }
  } catch (error) {
    console.error('❌ GCS Test Error:', error.message);
    console.log(`🎯 Target: Arab League Teams ($15K-$45K subscriptions)`);
    console.log(`⚡ Real-time processing with Socket.io enabled`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`📡 Service status: http://localhost:${PORT}/api/status`);
    
    const operational = serviceStatus.gpt4.connected && 
                       serviceStatus.claude.connected && 
                       serviceStatus.googleCloud.connected;
    
    if (operational) {
      console.log('🎉 All services operational - READY FOR ARAB LEAGUE LAUNCH! 🏆');
    } else {
      console.log('⚠️ Service issues detected - Check configuration before deployment');
    }
  });
}

// Start the server
startServer().catch(error => {
  console.error('🚨 Server startup failed:', error);
  process.exit(1);
});

module.exports = app;
