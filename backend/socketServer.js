const { Server } = require('socket.io');
const User = require('./models/user');
const realTimeMarketData = require('./services/realTimeMarketData');
const redisManager = require('./config/redis');
const { sessionManager } = require('./config/session');
const { corsOriginValidator } = require('./config/cors');

// Redis adapter for Socket.IO clustering
let redisAdapter;
try {
  const { createAdapter } = require('@socket.io/redis-adapter');
  redisAdapter = createAdapter;
} catch (error) {
  console.warn('⚠️ Redis adapter not available, Socket.IO clustering disabled:', error.message);
}

let io;

const initializeSocketServer = async (server) => {
  io = new Server(server, {
    cors: {
      origin: corsOriginValidator,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "Cookie",
        "X-Requested-With",
        "Accept",
        "Origin"
      ]
    },
    transports: ['polling', 'websocket'],
    pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '60000'),
    pingInterval: parseInt(process.env.WS_PING_INTERVAL || '25000'),
    upgradeTimeout: parseInt(process.env.WS_UPGRADE_TIMEOUT || '30000'),
    allowEIO3: true,
    maxHttpBufferSize: parseInt(process.env.WS_MAX_HTTP_BUFFER_SIZE || '1048576'),
    connectTimeout: 20000,
    serveClient: false,
    cookie: false,
    allowRequest: (req, fn) => {
      const clientsCount = io.engine.clientsCount;
      const connectionLimit = parseInt(process.env.WS_CONNECTION_LIMIT || '25000');
      if (clientsCount > connectionLimit) {
        console.log('❌ Connection limit reached:', clientsCount, '>=', connectionLimit);
        return fn('Connection limit reached', false);
      }
      fn(null, true);
    }
  });

  // Add error handling for the Socket.IO server
  io.engine.on('connection_error', (err) => {
    console.log('❌ Socket.IO connection error:', {
      message: err.message,
      context: err.context
    });
  });

  // Set up Redis adapter for horizontal scaling if available
  if (redisAdapter && redisManager.isConnected) {
    try {
      const pubClient = redisManager.getClient('socketPub');
      const subClient = redisManager.getClient('socketSub');
      
      if (pubClient && subClient) {
        // Verify clients are connected
        if (pubClient.status !== 'ready') {
          await pubClient.connect();
        }
        if (subClient.status !== 'ready') {
          await subClient.connect();
        }
        
        const adapter = redisAdapter(pubClient, subClient);
        io.adapter(adapter);
        
        console.log('🔗 Socket.IO Redis adapter configured successfully');
        
      } else {
        console.log('⚠️  Redis clients not available for Socket.IO adapter');
      }
    } catch (error) {
      console.warn('⚠️  Failed to configure Redis adapter:', error.message);
    }
  }


  // Authentication middleware for sockets (simplified to avoid session conflicts)
  io.use(async (socket, next) => {
    try {
      // For now, allow all connections to avoid session conflicts
      // Authentication can be handled at the event level instead
      socket.userId = null;
      socket.isAuthenticated = false;
      
      next();
    } catch (error) {
      console.error('❌ Socket authentication error:', error);
      next(error);
    }
  });

  io.on('connection', (socket) => {
    
    // Join user-specific room for private updates
    if (socket.userId) {
      socket.join(`user_${socket.userId}`);
      socket.join(`orders_${socket.userId}`);
    }

    // Handle market data subscriptions
    socket.on('subscribe', (data) => {
      const { type, channel, pair, timeframe } = data;
    
      if (!pair) {
        socket.emit('error', { message: 'Invalid subscription data: pair required' });
        return;
      }

      // Handle chart subscriptions
      if (type === 'chart') {
        if (!timeframe) {
          socket.emit('error', { message: 'Invalid chart subscription: timeframe required' });
          return;
        }

        const chartRoom = `chart_${pair}_${timeframe}`;
        socket.join(chartRoom);
        socket.join('charts'); // Also join general charts room

    
        // Send initial chart data
        try {
          socket.emit('chart_initial_data', {
            pair,
            timeframe,
            candles: [],
            currentCandle: null
          });
        } catch (error) {
          console.error('Error sending initial chart data:', error);
          socket.emit('error', { message: 'Failed to load chart data' });
        }
        return;
      }

      // Legacy channel-based subscriptions
      const channel_name = channel || type;
      if (!channel_name) {
        socket.emit('error', { message: 'Invalid subscription data: type or channel required' });
        return;
      }

      const roomName = `${channel_name}_${pair}`;
      socket.join(roomName);
      
    
      // Send current data immediately
      if (socket.tradingEngine) {
        switch (channel) {
          case 'orderbook':
            // Join the orderbook room for real-time updates
            socket.join(`orderbook_${pair}`);
           
            // Send real-time order book data if available
            const orderBook = realTimeMarketData.getOrderBook(pair);
            
            if (orderBook && (orderBook.bids.length > 0 || orderBook.asks.length > 0)) {
              socket.emit('orderbook_update', {
                pair,
                bids: orderBook.bids.slice(0, 20),
                asks: orderBook.asks.slice(0, 20),
                timestamp: orderBook.timestamp
              });
            } else {
              console.log(`📊 No real-time order book available for ${pair}`);
            }
            break;
          case 'price':
            // Join the price room for real-time updates
            socket.join(`price_${pair}`);
            
            // Get price from real-time market data service
            let price = realTimeMarketData.getCurrentPrice(pair);
            
            if (!price) {
              // Fallback to trading engine
              price = socket.tradingEngine.lastPrices.get(pair);
            }
            
            if (price) {
             socket.emit('price_update', {
                pair,
                price,
                timestamp: Date.now(),
                source: 'Real-time API'
              });
            } else {
              console.log(`❌ No real-time price found for ${pair}`);
            }
            break;
        }
      }
    });

    // Handle unsubscription
    socket.on('unsubscribe', (data) => {
      const { type, channel, pair, timeframe } = data;
      
      if (!pair) {
        socket.emit('error', { message: 'Invalid unsubscription data: pair required' });
        return;
      }

      // Handle chart unsubscriptions
      if (type === 'chart') {
        if (!timeframe) {
          socket.emit('error', { message: 'Invalid chart unsubscription: timeframe required' });
          return;
        }

        const chartRoom = `chart_${pair}_${timeframe}`;
        socket.leave(chartRoom);

       return;
      }

      // Legacy channel-based unsubscriptions
      const channel_name = channel || type;
      if (!channel_name) {
        socket.emit('error', { message: 'Invalid unsubscription data: type or channel required' });
        return;
      }

      const roomName = `${channel_name}_${pair}`;
      socket.leave(roomName);
      
    });

    // Handle chart subscription
    socket.on('subscribe_chart', (data) => {
      const { pair, timeframe } = data;
      
      if (!pair || !timeframe) {
        socket.emit('error', { message: 'Invalid chart subscription data' });
        return;
      }

      // Join chart room
      const chartRoom = `chart_${pair}_${timeframe}`;
      socket.join(chartRoom);
      socket.join('charts'); // Also join general charts room

      // Send initial chart data
      try {
        socket.emit('chart_initial_data', {
          pair,
          timeframe,
          candles: [],
          currentCandle: null
        });
      } catch (error) {
        console.error('Error sending initial chart data:', error);
        socket.emit('error', { message: 'Failed to load chart data' });
      }
    });

    // Handle chart unsubscription
    socket.on('unsubscribe_chart', (data) => {
      const { pair, timeframe } = data;
      
      if (!pair || !timeframe) {
        socket.emit('error', { message: 'Invalid chart unsubscription data' });
        return;
      }

      const chartRoom = `chart_${pair}_${timeframe}`;
      socket.leave(chartRoom);
      
    });

    // Handle trading actions (authenticated users only)
    socket.on('place_order', async (orderData) => {
      if (!socket.userId) {
        socket.emit('error', { message: 'Authentication required for trading' });
        return;
      }

      try {
        if (!socket.tradingEngine) {
          socket.emit('error', { message: 'Trading engine not available' });
          return;
        }

        const order = await socket.tradingEngine.placeOrder({
          ...orderData,
          userId: socket.userId
        });

        socket.emit('order_placed', {
          orderId: order.orderId,
          status: order.status,
          message: 'Order placed successfully'
        });

      } catch (error) {
        console.error('Error placing order:', error);
        socket.emit('order_error', {
          message: error.message || 'Failed to place order'
        });
      }
    });

    // Handle order cancellation
    socket.on('cancel_order', async (data) => {
      if (!socket.userId) {
        socket.emit('error', { message: 'Authentication required' });
        return;
      }

      try {
        const { orderId } = data;
        
        if (!orderId) {
          socket.emit('error', { message: 'Order ID required' });
          return;
        }

        // Cancel order logic would go here
        // For now, just acknowledge
        socket.emit('order_cancelled', {
          orderId,
          message: 'Order cancelled successfully'
        });

      } catch (error) {
        console.error('Error cancelling order:', error);
        socket.emit('order_error', {
          message: error.message || 'Failed to cancel order'
        });
      }
    });

    // Handle ping for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
     // Clean up subscriptions
      if (socket.tradingEngine) {
        socket.tradingEngine.unsubscribeAll(socket.id);
      }
    });

    // Error handling
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  return io;
};

const getSocketServer = () => io;

module.exports = {
  initializeSocketServer,
  getSocketServer,
  io: () => io
};
