require('dotenv').config()
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const cookieParser  = require('cookie-parser');
const path = require('path');
const http = require('http');
const helmet = require('helmet');

const connectDB = require('./config/db-optimized');
const { corsOriginValidator } = require('./config/cors');
const redisManager = require('./config/redis');
const { getSessionConfig, updateSessionActivity, sessionManager } = require('./config/session');
const { createLogger, requestLogger, errorLogger } = require('./utils/logger');
const { trackRequest } = require('./utils/requestTracker');
const performanceMonitor = require('./utils/performanceMonitor');
const cacheService = require('./utils/cacheService');
const cacheWarmupService = require('./utils/cacheWarmupService');
const botProtection = require('./middlewares/botProtection');
const productionRateLimit = require('./middlewares/productionRateLimit');
const security = require('./middlewares/securityMiddleware');
const { initializeSocketServer } = require('./socketServer');
const TradingEngine = require('./services/tradingEngine');
const realTimeMarketData = require('./services/realTimeMarketData');
const specialTokenSimulationService = require('./services/specialTokenSimulationService');
const stakingService = require('./services/stakingService');
const candleService = require('./services/candleService');

const userAuth = require('./routes/userAuth');
const otpAuth = require('./routes/otpAuth');
const adminAuth = require('./routes/adminAuth');
const userProfile = require('./routes/userProfile');
const favorites = require('./routes/favorites');
const deposits = require('./routes/deposits');
const adminDeposits = require('./routes/adminDeposits');
const withdrawals = require('./routes/withdrawals');
const adminWithdrawals = require('./routes/adminWithdrawals');
const adminTransactions = require('./routes/adminTransactions');
const notifications = require('./routes/notifications');
const adminNotifications = require('./routes/adminNotifications');
const trading = require('./routes/trading');
const market = require('./routes/market');
const candlesticks = require('./routes/candlesticks');
const adminTokens = require('./routes/adminTokens');
const adminSpecialTokens = require('./routes/adminSpecialTokens');
const adminTokenControls = require('./routes/adminTokenControls');
const adminDashboard = require('./routes/adminDashboard');
const referrals = require('./routes/referrals');
const rewards = require('./routes/rewards');
const kyc = require('./routes/kyc');
const monitoring = require('./routes/monitoring');
const sessionStatus = require('./routes/sessionStatus');
const cache = require('./routes/cache');
const logoProxy = require('./routes/logoProxy');
const adminDepositMonitoring = require('./routes/adminDepositMonitoring');
const adminFundManagement = require('./routes/adminFundManagement');
const adminUsers = require('./routes/adminUsers');
const telegramSupport = require('./routes/telegramSupport');
const adminTelegramSupport = require('./routes/adminTelegramSupport');
const staking = require('./routes/staking');
const adminStaking = require('./routes/adminStaking');
const health = require('./routes/health');
const copyTrading = require('./routes/copyTrading');
const demoTrading = require('./routes/demoTrading');
const adminBanners = require('./routes/adminBanners');
const blog = require('./routes/blog');
const adminBlog = require('./routes/adminBlog');

// Deposit monitoring service

const app = express();
const server = http.createServer(app);

// Initialize logger
const serverLogger = createLogger('server');

// Module-level variables for services that need to be accessed in multiple places
let io; // Socket.IO server instance

// Add global error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  serverLogger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  serverLogger.error('Unhandled Rejection', { reason: reason, promise: promise });
  process.exit(1);
});

// Trust proxy for production environments (Render, Heroku, etc.)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
  serverLogger.info('Production mode: Trust proxy enabled');
}

// Set server timeout for high-load scenarios
app.timeout = 120000; // 2 minutes (reduced from 5 min to limit Slowloris)
if (server) {
  server.timeout = 120000; // 2 minutes
  server.keepAliveTimeout = 60000; // 1 minute
  server.headersTimeout = 65000; // 65 seconds (should be greater than keepAliveTimeout)
  server.maxHeadersCount = 50; // SECURITY: limit header count to prevent header bomb DDoS
  server.requestTimeout = 30000; // SECURITY: 30s max to receive full request (anti-Slowloris)
}

// Configure CORS first (before all other middleware) to ensure credentials work properly
// Origins defined in config/cors.js (single source of truth)
app.use(cors({
  origin: corsOriginValidator,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Timestamp', 'x-timestamp'],
  exposedHeaders: [], // SECURITY: never expose Set-Cookie to JS
  maxAge: 86400 // 24 hours
}));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Request logging middleware
app.use(requestLogger('api'));

// Initialize services
async function initializeServer() {
  try {
    // Database and Redis already connected in initializeMiddleware()
    // Just initialize remaining services
    
    // Initialize cache service if Redis is available
    if (redisManager.clients) {
      await cacheService.connect();
      serverLogger.info('✅ Cache service connected successfully');

      // Warm up cache with essential data
      setTimeout(async () => {
        try {
          await cacheWarmupService.warmupCache();
          serverLogger.info('✅ Cache warmup completed');
        } catch (warmupError) {
          serverLogger.warn('⚠️ Cache warmup failed', { error: warmupError.message });
        }
      }, 5000); // Wait 5 seconds for other services to be ready
    }

    // Initialize WebSocket server
    io = await initializeSocketServer(server);

    // Initialize trading engine after database
    const tradingEngine = new TradingEngine();
    tradingEngine.setSocketServer(io);

    // Initialize special token simulation service
    specialTokenSimulationService.initialize(io);

    // Initialize staking service
    stakingService.initialize();

    // Make trading engine available to socket connections
    io.on('connection', (socket) => {
      socket.tradingEngine = tradingEngine;
    });

    serverLogger.info('✅ All services initialized successfully');

  } catch (error) {
    serverLogger.error('❌ Failed to initialize server', { error: error.message });
    process.exit(1);
  }
}

app.use(express.json({ limit: '1mb' })); // SECURITY: cap JSON body size to prevent payload bombs
app.use(express.urlencoded({ extended: false, limit: '1mb' })); // SECURITY: cap URL-encoded body size
app.use(cookieParser());

// ─── SECURITY: Global protection middleware ───────────────────────────────
// Apply ALL security middleware (NoSQL sanitizer, HPP, XSS, path traversal, etc.)
security.applyAll().forEach(mw => app.use(mw));

// Add compression middleware for better performance
const compression = require('compression');
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024,
}));

// Add performance and cache headers
app.use((req, res, next) => {
  // Add performance headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    // SECURITY: X-XSS-Protection removed (deprecated, can cause vulnerabilities)
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });

  // Add specific cache headers for static assets
  if (req.path.includes('/uploads/') || req.path.includes('/public/')) {
    res.set('Cache-Control', 'public, max-age=86400'); // 24 hours for static assets
  }

  // Add rate limit headers for API responses
  if (req.path.startsWith('/api/')) {
    res.set('X-RateLimit-Policy', 'Enforced');
  }

  next();
});

// Initialize Redis and database FIRST, then set up all middleware and routes
async function setupServer() {
  try {
    // Connect to MongoDB first
    await connectDB();
    serverLogger.info('✅ Database connected successfully');

    // Connect to Redis before session configuration
    try {
      await redisManager.connect();
      serverLogger.info('✅ Redis connected successfully');
      sessionManager.initialize();
      serverLogger.info('✅ Session manager initialized with Redis');
    } catch (redisError) {
      serverLogger.warn('⚠️ Redis connection failed, continuing without Redis', { error: redisError.message });
      sessionManager.initialize();
      serverLogger.info('✅ Session manager initialized without Redis');
    }

    // NOW configure session middleware after Redis is connected
    // IMPORTANT: Create the session middleware ONCE so the same store instance
    // is reused across all requests. Calling session(getSessionConfig()) inside a
    // per-request wrapper creates a fresh MemoryStore on every request, making
    // sessions invisible to subsequent requests (instant logout after login).
    const sessionMiddleware = session(getSessionConfig());
    app.use((req, res, next) => {
      // Skip session middleware for Socket.IO paths
      if (req.path.startsWith('/socket.io/') || req.url.includes('/socket.io/')) {
        return next();
      }
      // Apply the shared session middleware instance for all other routes
      sessionMiddleware(req, res, next);
    });
    
    app.use((req, res, next) => {
      // Skip session activity updates for Socket.IO paths  
      if (req.path.startsWith('/socket.io/') || req.url.includes('/socket.io/')) {
        return next();
      }
      updateSessionActivity(req, res, next);
    });
    
    serverLogger.info('✅ Session management configured with Redis');

    // Continue with other middleware
    setupMiddlewareAndRoutes();
    
    // Initialize remaining services
    await initializeServer();

    // Use explicit PORT from environment; do not offset by pm_id in fork mode
    const port = parseInt(process.env.PORT || '5001');

    // Start the HTTP server after all setup is complete
    server.listen(port, async () => {
      serverLogger.info(`🚀 Server started on port ${port}`);
      serverLogger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      
      console.log(`Server is running on port ${port}`);

      // Start performance monitoring
      performanceMonitor.startMonitoring(30000); // Monitor every 30 seconds
      serverLogger.info('✅ Performance monitoring started');
      
      // Get active trading pairs from database
      try {
        const Coin = require('./models/coin');
        const coins = await Coin.find({ 
          status: 'active',
          isTradingEnabled: true,
          isVisible: true 
        }).lean();

        const tradingPairs = [];
        coins.forEach(coin => {
          if (coin.tradingPairs && coin.tradingPairs.length > 0) {
            coin.tradingPairs.forEach(tradingPair => {
              if (tradingPair.isActive) {
                tradingPairs.push({
                  symbol: `${coin.symbol}/${tradingPair.quoteAsset}`,
                  baseAsset: coin.symbol,
                  quoteAsset: tradingPair.quoteAsset
                });
              }
            });
          }
        });

        // Set the socket server instance in the market data service
        realTimeMarketData.setSocketServer(io);
        
        await realTimeMarketData.start(tradingPairs);
     
        // Initialize and start candle service
        candleService.setSocketServer(io);
        await candleService.initialize();
        
        // Start special token simulation service
       specialTokenSimulationService.start();

      } catch (error) {
        console.error('❌ Error starting services:', error);
        
        // Fallback to default pairs if database fails
        const defaultPairs = [
          { symbol: 'BTC/USDT', baseAsset: 'BTC', quoteAsset: 'USDT' },
          { symbol: 'ETH/USDT', baseAsset: 'ETH', quoteAsset: 'USDT' },
          { symbol: 'BNB/USDT', baseAsset: 'BNB', quoteAsset: 'USDT' },
          { symbol: 'SOL/USDT', baseAsset: 'SOL', quoteAsset: 'USDT' },
          { symbol: 'ADA/USDT', baseAsset: 'ADA', quoteAsset: 'USDT' },
          { symbol: 'DOT/USDT', baseAsset: 'DOT', quoteAsset: 'USDT' },
          { symbol: 'XRP/USDT', baseAsset: 'XRP', quoteAsset: 'USDT' },
          { symbol: 'DOGE/USDT', baseAsset: 'DOGE', quoteAsset: 'USDT' }
        ];

       await realTimeMarketData.start(defaultPairs);
        
        // Still start special token service even if regular market data fails
       specialTokenSimulationService.start();
      }
    });
  } catch (error) {
    serverLogger.error('❌ Failed to setup server', { error: error.message });
    process.exit(1);
  }
}

function setupMiddlewareAndRoutes() {
  // Performance monitoring middleware
  app.use(performanceMonitor.trackRequest.bind(performanceMonitor));
  app.use(trackRequest);

  // Serve static files from uploads directory with auth check for sensitive files
  app.use('/uploads', (req, res, next) => {
    // SECURITY: Block access to KYC documents without authentication
    if (req.path.includes('/kyc/')) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  }, express.static(path.join(__dirname, 'uploads')));

  // Serve static files from public directory
  app.use(express.static(path.join(__dirname, 'public')));

  // Apply bot protection to all routes except Socket.IO paths and health checks
  app.use((req, res, next) => {
    // Skip bot protection entirely for Socket.IO requests
    if (req.path.startsWith('/socket.io/') || req.url.includes('/socket.io/')) {
      return next();
    }
    // Skip bot protection for health check endpoints (needed for load balancers)
    if (req.path === '/api/v1/health' || req.path.startsWith('/api/v1/health/')) {
      return next();
    }
    // Apply bot protection for all other routes
    botProtection(req, res, next);
  });

  // Apply production rate limiter to all API routes
  app.use('/api/v1/user', productionRateLimit.authLimiter, userAuth);  // Auth operations
  app.use('/api/v1/otp', productionRateLimit.authLimiter, otpAuth);  // OTP authentication operations
  app.use('/api/v1/user', productionRateLimit.generalLimiter, userProfile);  // Profile operations
  app.use('/api/v1/user', productionRateLimit.generalLimiter, favorites);  // Favorites operations
  app.use('/api/v1/deposits', productionRateLimit.generalLimiter, deposits);
  app.use('/api/v1/withdrawals', productionRateLimit.generalLimiter, withdrawals);
  app.use('/api/v1/notifications', productionRateLimit.generalLimiter, notifications);
  app.use('/api/v1/referrals', productionRateLimit.generalLimiter, referrals);  // Referral operations
  app.use('/api/v1/rewards', productionRateLimit.generalLimiter, rewards);  // VIP Reward operations
  app.use('/api/v1/copy-trading', productionRateLimit.generalLimiter, copyTrading);  // Copy trading operations
  app.use('/api/v1/kyc', productionRateLimit.generalLimiter, kyc);  // KYC operations
  app.use('/api/v1/staking', productionRateLimit.generalLimiter, staking);  // Staking operations
  app.use('/api/staking', productionRateLimit.generalLimiter, staking);  // Staking operations for frontend compatibility
  app.use('/api/v1/trading', productionRateLimit.tradingLimiter, trading);  // High-volume trading
  app.use('/api/v1/market', productionRateLimit.marketDataLimiter, market);  // High-volume market data
  app.use('/api/v1/candlesticks', productionRateLimit.marketDataLimiter, candlesticks);  // Candlestick data with caching
  app.use('/api/v1/logos', productionRateLimit.marketDataLimiter, logoProxy);  // Logo proxy service
  app.use('/api/v1/admin', productionRateLimit.authLimiter, adminAuth);  // Admin auth
  app.use('/api/admin', productionRateLimit.authLimiter, adminAuth);  // Admin auth for frontend compatibility
  app.use('/api/v1/admin/deposits', productionRateLimit.generalLimiter, adminDeposits);
  app.use('/api/v1/admin/withdrawals', productionRateLimit.generalLimiter, adminWithdrawals);
  app.use('/api/v1/admin/transactions', productionRateLimit.generalLimiter, adminTransactions);
  app.use('/api/v1/admin/notifications', productionRateLimit.generalLimiter, adminNotifications);
  app.use('/api/v1/admin/tokens', productionRateLimit.generalLimiter, adminTokens);
  app.use('/api/v1/admin/special-tokens', productionRateLimit.generalLimiter, adminSpecialTokens);
  app.use('/api/v1/admin/token-controls', productionRateLimit.generalLimiter, adminTokenControls);
  app.use('/api/v1/admin/deposit-monitoring', productionRateLimit.generalLimiter, adminDepositMonitoring);
  app.use('/api/v1/admin/fund-management', productionRateLimit.generalLimiter, adminFundManagement);
  app.use('/api/v1/admin/users', productionRateLimit.generalLimiter, adminUsers);
  app.use('/api/admin/users', productionRateLimit.generalLimiter, adminUsers); // Added for frontend compatibility
  app.use('/api/v1/admin/staking', productionRateLimit.generalLimiter, adminStaking);
  app.use('/api/admin/staking', productionRateLimit.generalLimiter, adminStaking); // Added for frontend compatibility
  app.use('/api/v1/admin/telegram-support', productionRateLimit.generalLimiter, adminTelegramSupport);
  app.use('/api/v1/admin/banners', productionRateLimit.generalLimiter, adminBanners);  // Banner management
  app.use('/api/v1/admin/blog', productionRateLimit.generalLimiter, adminBlog);        // Blog management
  app.use('/api/v1/blog', productionRateLimit.generalLimiter, blog);                   // Public blog
  app.use('/api/v1/admin/dashboard', productionRateLimit.generalLimiter, adminDashboard);  // Admin dashboard stats
  app.use('/api/v1/admin/cache', productionRateLimit.generalLimiter, cache);  // Cache management

  // Demo trading routes
  app.use('/api/v1/demo-trading', productionRateLimit.generalLimiter, demoTrading);

  // User routes
  app.use('/api/v1/telegram-support', productionRateLimit.generalLimiter, telegramSupport);

  // Monitoring routes (protected)
  app.use('/api/v1/monitoring', productionRateLimit.generalLimiter, monitoring);

  // Health check routes (no rate limiting for load balancers)
  app.use('/api/v1/health', health);

  // Session management routes 
  app.use('/api/v1/session', productionRateLimit.generalLimiter, sessionStatus);

  // Error logging middleware
  app.use(errorLogger('api'));

  // Global error handler
  app.use((err, req, res, next) => {
    serverLogger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      userId: req.user?.id,
      ip: req.ip
    });

    // Only send response if headers haven't been sent already
    if (!res.headersSent) {
      if (process.env.NODE_ENV === 'production') {
        res.status(500).json({ 
          success: false, 
          error: 'Internal server error' 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          error: err.message,
          stack: err.stack 
        });
      }
    }
  });
}

// Start server setup
setupServer();

// Server startup is now handled inside setupServer() after all middleware is configured
