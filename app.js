require('dotenv').config(); // Load environment variables from .env file 
const express = require('express');  
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet'); // Security middleware to set HTTP headers hide the Technology.
const morgan = require('morgan'); // Logging middleware for HTTP requests data.
const compression = require('compression'); // Middleware to compress response bodies.
const rateLimit = require('express-rate-limit'); // Middleware to limit repeated requests per IP.
const logger = require('./src/utils/logger'); // Custom logger using writable stream.
const cors = require('cors');
const path = require('path');

const app = express(); 
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// Security and general middleware
app.use(cors(corsOptions));
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', { stream: logger.stream }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limiting with different limits for different endpoints
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// General rate limit
app.use(createRateLimit(15 * 60 * 1000, 100, 'Too many requests, please try again later'));

// Stricter rate limit for auth endpoints
app.use('/api/*/auth', createRateLimit(15 * 60 * 1000, 10, 'Too many authentication attempts'));

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`User connected: ${socket.id}`);
  
  socket.on('join_conversation', (conversationId) => {
    socket.join(`conversation_${conversationId}`);
    logger.info(`User ${socket.id} joined conversation ${conversationId}`);
  });

  socket.on('leave_conversation', (conversationId) => {
    socket.leave(`conversation_${conversationId}`);
    logger.info(`User ${socket.id} left conversation ${conversationId}`);
  });

  socket.on('typing', (data) => {
    socket.to(`conversation_${data.conversationId}`).emit('user_typing', {
      userId: data.userId,
      isTyping: data.isTyping
    });
  });

  socket.on('disconnect', () => {
    logger.info(`User disconnected: ${socket.id}`);
  });
});

// Make io available to routes
app.set('io', io);

// API routes with versioning
['v1'].forEach(v => app.use(`/api/${v}`, require(`./src/routes/${v}/index`)));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Endpoint not found',
    path: req.path 
  });
});

// Error handling middleware
app.use(require('./src/middleware/errorHandler').errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Server running at: http://localhost:${PORT}/api/`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = { app, server, io }; 
