import { io } from 'socket.io-client';

// Get WebSocket configuration from environment variables
const WS_CONFIG = {
  url: import.meta.env.VITE_WS_URL || 'http://localhost:5001',
  reconnectInterval: parseInt(import.meta.env.VITE_WS_RECONNECT_INTERVAL || '5000'),
  maxReconnectAttempts: parseInt(import.meta.env.VITE_WS_MAX_RECONNECT_ATTEMPTS || '10'),
  heartbeatInterval: parseInt(import.meta.env.VITE_WS_HEARTBEAT_INTERVAL || '30000'),
  timeout: parseInt(import.meta.env.VITE_API_REQUEST_TIMEOUT || '10000'),
  debugLogging: import.meta.env.VITE_ENABLE_DEBUG_LOGGING === 'true'
};

class WebSocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.subscribers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = WS_CONFIG.maxReconnectAttempts;
    this.reconnectDelay = WS_CONFIG.reconnectInterval;
    this.heartbeatTimer = null;
  }

  connect(token = null) {
    if (this.socket && this.connected) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      // Disconnect existing socket if any
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
      
      this.socket = io(WS_CONFIG.url, {
        // WebSocket first — avoids PM2 cluster sticky-session issue with HTTP polling.
        // Once the WS connection is established it stays on one worker permanently.
        // Polling is kept only as a fallback for very restrictive networks.
        transports: ['websocket', 'polling'],
        auth: {
          token: token
        },
        autoConnect: true,
        timeout: WS_CONFIG.timeout,
        forceNew: true,
        reconnection: true,
        reconnectionDelay: WS_CONFIG.reconnectInterval,
        reconnectionAttempts: WS_CONFIG.maxReconnectAttempts,
        randomizationFactor: 0.3
      });

      this.socket.on('connect', () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        if (WS_CONFIG.debugLogging) {
          console.log('WebSocket connected successfully');
        }
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        this.connected = false;
        this.stopHeartbeat();
        
        if (WS_CONFIG.debugLogging) {
          console.log('WebSocket disconnected:', reason);
        }
        
        if (reason === 'io server disconnect') {
          // Server disconnected, need to reconnect manually
          setTimeout(() => this.reconnect(), 2000);
        }
      });

      this.socket.on('connect_error', (error) => {
        console.warn('⚠️ WebSocket connection error:', error.message);
        this.connected = false;
        // Let Socket.IO's built-in reconnection handle retries (reconnection: true above).
        // Do NOT manually reconnect here — dual reconnection doubles traffic and can self-DDoS.
        this.reconnectAttempts++;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('❌ WebSocket max reconnection attempts reached');
          resolve(); // Don't block the app
        }
      });

      // Set up event listeners
      this.setupEventListeners();
      
      // Timeout fallback
      setTimeout(() => {
        if (!this.connected) {
          console.warn('⚠️ WebSocket connection timeout, continuing without real-time updates');
          resolve(); // Don't block the app if WebSocket fails
        }
      }, 10000);
    });
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.subscribers.clear();
    }
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket && this.connected) {
        this.socket.emit('ping');
        if (WS_CONFIG.debugLogging) {
          console.log('WebSocket heartbeat sent');
        }
      }
    }, WS_CONFIG.heartbeatInterval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (WS_CONFIG.debugLogging) {
        console.warn('⚠️ Max WebSocket reconnection attempts reached, continuing without real-time updates');
      }
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    if (WS_CONFIG.debugLogging) {
      console.log(`Attempting WebSocket reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    }
    
    setTimeout(() => {
      if (this.socket && !this.connected) {
        try {
          this.socket.connect();
        } catch (error) {
          console.warn('⚠️ WebSocket reconnection failed:', error.message);
        }
      }
    }, delay);
  }

  setupEventListeners() {
    if (!this.socket) return;

    // Order book updates
    this.socket.on('orderbook_update', (data) => {
      this.notifySubscribers('orderbook', data);
    });

    // Trade updates
    this.socket.on('trade_update', (data) => {
      this.notifySubscribers('trades', data);
    });

    // Price updates
    this.socket.on('price_update', (data) => {
      this.notifySubscribers('price', data);
    });

    // Special token price updates
    this.socket.on('specialTokenPriceUpdate', (data) => {
      this.notifySubscribers('special_token_price', data);
    });

    // Candle updates for live charts
    this.socket.on('candleUpdate', (data) => {
      this.notifySubscribers('candle_update', data);
    });

    // Order updates
    this.socket.on('order_update', (data) => {
      this.notifySubscribers('orders', data);
    });

    // Order placed confirmation
    this.socket.on('order_placed', (data) => {
      this.notifySubscribers('order_placed', data);
    });

    // Order errors
    this.socket.on('order_error', (data) => {
      this.notifySubscribers('order_error', data);
    });

    // Order cancelled confirmation
    this.socket.on('order_cancelled', (data) => {
      this.notifySubscribers('order_cancelled', data);
    });

    // General errors
    this.socket.on('error', (data) => {
      console.error('Socket error:', data);
      this.notifySubscribers('error', data);
    });

    // Ping/Pong for connection health
    this.socket.on('pong', (data) => {
      // Connection health check received
    });
  }

  // Subscription management
  subscribe(channel, pair, callback) {
    if (!this.connected || !this.socket) {
      return;
    }

    // Validate subscription data
    if (!channel || !pair) {
      console.error('Invalid subscription data: channel and pair are required', { channel, pair });
      return;
    }

    const subscriptionKey = `${channel}_${pair}`;
    
    if (!this.subscribers.has(subscriptionKey)) {
      this.subscribers.set(subscriptionKey, new Set());
      
      // Subscribe on server
      this.socket.emit('subscribe', { channel, pair });
    }

    // Add callback to subscribers
    this.subscribers.get(subscriptionKey).add(callback);
  }

  // Subscribe to general events that don't require pairs (like price updates, special tokens)
  subscribeToGeneral(eventType, callback) {
    if (!this.connected || !this.socket) {
      return;
    }

    const subscriptionKey = eventType;
    
    if (!this.subscribers.has(subscriptionKey)) {
      this.subscribers.set(subscriptionKey, new Set());
    }

    // Add callback to subscribers
    this.subscribers.get(subscriptionKey).add(callback);
  }

  unsubscribe(channel, pair, callback) {
    if (!this.connected || !this.socket) {
      return;
    }

    // Validate unsubscription data
    if (!channel || !pair) {
      console.error('Invalid unsubscription data: channel and pair are required', { channel, pair });
      return;
    }

    const subscriptionKey = `${channel}_${pair}`;
    const channelSubscribers = this.subscribers.get(subscriptionKey);
    
    if (channelSubscribers) {
      if (callback) {
        channelSubscribers.delete(callback);
      }
      
      // If no more subscribers, unsubscribe from server
      if (channelSubscribers.size === 0) {
        this.subscribers.delete(subscriptionKey);
        this.socket.emit('unsubscribe', { channel, pair });
        // Successfully unsubscribed
      }
    }
  }

  // Unsubscribe from general events
  unsubscribeFromGeneral(eventType, callback) {
    const subscriptionKey = eventType;
    const eventSubscribers = this.subscribers.get(subscriptionKey);
    
    if (eventSubscribers) {
      if (callback) {
        eventSubscribers.delete(callback);
      }
      
      // If no more subscribers, remove the subscription
      if (eventSubscribers.size === 0) {
        this.subscribers.delete(subscriptionKey);
      }
    }
  }

  notifySubscribers(type, data) {
    let subscriptionKey;
    
    if (type === 'orderbook' || type === 'trades' || type === 'price') {
      subscriptionKey = `${type}_${data.pair}`;
    } else {
      subscriptionKey = type;
    }

    const subscribers = this.subscribers.get(subscriptionKey);
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in subscriber callback:', error);
        }
      });
    }
  }

  // Trading actions
  placeOrder(orderData) {
    if (!this.connected || !this.socket) {
      throw new Error('WebSocket not connected');
    }

    this.socket.emit('place_order', orderData);
  }

  cancelOrder(orderId) {
    if (!this.connected || !this.socket) {
      throw new Error('WebSocket not connected');
    }

    this.socket.emit('cancel_order', { orderId });
  }

  // Connection health check
  ping() {
    if (this.connected && this.socket) {
      this.socket.emit('ping');
    }
  }

  // Get connection status
  isConnected() {
    return this.connected && this.socket?.connected;
  }

  // Get socket instance (for advanced usage)
  getSocket() {
    return this.socket;
  }
}

// Create singleton instance
const wsService = new WebSocketService();

export default wsService;
