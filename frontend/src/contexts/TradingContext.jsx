import React, { createContext, useContext, useReducer, useEffect, useMemo, useCallback, useRef } from 'react';
import wsService from '../services/websocket';
import { useUserAuth } from './UserAuthContext';
import { ApiUtils } from '../services/api';

// Get configuration from environment variables
const TRADING_CONFIG = {
  debounceDelay: 0, // Remove debouncing for instant loading
  cacheTimeout: parseInt(import.meta.env.VITE_CACHE_TTL_SHORT || '5000'),
  priceUpdateInterval: parseInt(import.meta.env.VITE_CACHE_TTL_MEDIUM || '30000'),
  debugLogging: import.meta.env.VITE_ENABLE_DEBUG_LOGGING === 'true',
  performanceMonitoring: import.meta.env.VITE_ENABLE_PERFORMANCE_MONITORING === 'true'
};

const TradingContext = createContext();

// Trading state reducer
const tradingReducer = (state, action) => {
  switch (action.type) {
    case 'SET_CURRENT_PAIR':
      return {
        ...state,
        currentPair: action.payload
      };

    case 'SET_ORDER_BOOK':
      return {
        ...state,
        orderBooks: {
          ...state.orderBooks,
          [action.payload.pair]: {
            bids: action.payload.bids,
            asks: action.payload.asks,
            timestamp: action.payload.timestamp
          }
        }
      };

    case 'SET_RECENT_TRADES':
      return {
        ...state,
        recentTrades: {
          ...state.recentTrades,
          [action.payload.pair]: action.payload.trades
        }
      };

    case 'ADD_TRADE':
      const currentTrades = state.recentTrades[action.payload.pair] || [];
      return {
        ...state,
        recentTrades: {
          ...state.recentTrades,
          [action.payload.pair]: [
            ...action.payload.trades,
            ...currentTrades
          ].slice(0, 100) // Keep only last 100 trades
        }
      };

    case 'SET_PRICE':
      return {
        ...state,
        prices: {
          ...state.prices,
          [action.payload.pair]: action.payload.price
        }
      };

    case 'SET_PRICES':
      return {
        ...state,
        prices: {
          ...state.prices,
          ...action.payload
        }
      };

    case 'SET_TICKERS':
      return {
        ...state,
        tickers: action.payload
      };

    case 'SET_USER_ORDERS':
      return {
        ...state,
        userOrders: action.payload
      };

    case 'ADD_USER_ORDER':
      return {
        ...state,
        userOrders: [action.payload, ...state.userOrders]
      };

    case 'UPDATE_USER_ORDER':
      return {
        ...state,
        userOrders: state.userOrders.map(order =>
          order.orderId === action.payload.orderId
            ? { ...order, ...action.payload }
            : order
        )
      };

    case 'REMOVE_USER_ORDER':
      return {
        ...state,
        userOrders: state.userOrders.filter(order => order.orderId !== action.payload)
      };

    case 'SET_TRADING_PAIRS':
      return {
        ...state,
        tradingPairs: action.payload
      };

    case 'UPDATE_REAL_TIME_PRICE':
      try {
     
        const currentPriceHistory = state.priceHistory[`${action.payload.pair}_1m`] || [];
        const updatedHistory = updateLatestCandle(
          currentPriceHistory,
          action.payload.price,
          action.payload.timestamp,
          '1m' // Default to 1m for real-time updates
        );

        // Update tickers data with new price - safely handle undefined data
        const updatedTickers = {
          ...state.tickers,
          data: (state.tickers.data && Array.isArray(state.tickers.data)) 
            ? state.tickers.data.map(ticker => {
                if (ticker.pair === action.payload.pair) {
                  const oldPrice = ticker.lastPrice || ticker.openPrice;
                  const priceChange = action.payload.price - oldPrice;
                  const priceChangePercent = oldPrice ? (priceChange / oldPrice) * 100 : 0;
                  
                  return {
                    ...ticker,
                    lastPrice: action.payload.price,
                    priceChange,
                    priceChangePercent
                  };
                }
                return ticker;
              })
            : state.tickers.data || []
        };

        const newState = {
          ...state,
          prices: {
            ...state.prices,
            [action.payload.pair]: action.payload.price
          },
          tickers: updatedTickers,
          // Also update the latest candle in price history
          priceHistory: {
            ...state.priceHistory,
            [`${action.payload.pair}_1m`]: updatedHistory
          }
        };
        
        // console.log('📊 Updated price history for', action.payload.pair, '- candles:', updatedHistory.length);
        return newState;
      } catch (error) {
        return {
          ...state,
          prices: {
            ...state.prices,
            [action.payload.pair]: action.payload.price
          }
        };
      }

    case 'SET_LOADING':
      return {
        ...state,
        loading: {
          ...state.loading,
          [action.payload.key]: action.payload.value
        }
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      };

    case 'SET_PRICE_HISTORY':
      return {
        ...state,
        priceHistory: {
          ...state.priceHistory,
          [`${action.payload.pair}_${action.payload.timeframe || '1m'}`]: action.payload.data
        }
      };

    case 'SET_CONNECTION_STATUS':
      return {
        ...state,
        isConnected: action.payload
      };

    default:
      return state;
  }
};

// Initial state
const initialState = {
  currentPair: 'BTC/USDT',
  orderBooks: {},
  recentTrades: {},
  prices: {},
  priceHistory: {},
  tickers: { success: false, data: [] },
  userOrders: [],
  tradingPairs: [],
  isConnected: false,
  loading: {
    orderBook: false,
    trades: false,
    orders: false,
    tickers: false,
    priceHistory: false
  },
  error: null
};

export const TradingProvider = ({ children }) => {
  const [state, dispatch] = useReducer(tradingReducer, initialState);
  const { user, token } = useUserAuth();
  
  // Move debounce ref to top level to avoid hook violation
  const debounceOrderRefresh = useRef(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const initializeConnection = async () => {
      try {
        await wsService.connect(token);
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: true });
      } catch (error) {
        dispatch({ type: 'SET_CONNECTION_STATUS', payload: false });
        // Don't set error state - just continue without WebSocket
      }
    };

    // Initialize connection immediately without delay
    initializeConnection();

    // Check connection status periodically (less frequent to reduce noise)
    const connectionChecker = setInterval(() => {
      const connected = wsService.isConnected();
      dispatch({ type: 'SET_CONNECTION_STATUS', payload: connected });
      if (!connected && wsService.reconnectAttempts < wsService.maxReconnectAttempts) {
        initializeConnection();
      }
    }, 10000); // Check every 10 seconds instead of 5

    return () => {
      clearInterval(connectionChecker);
      wsService.disconnect();
    };
  }, [token]);

  // Subscribe to market data for current pair (detailed data) - disabled orderbook subscription
  useEffect(() => {
    if (!state.isConnected || !state.currentPair) {
      return;
    }

    const handleOrderBookUpdate = (data) => {
      dispatch({ type: 'SET_ORDER_BOOK', payload: data });
    };

    const handleTradeUpdate = (data) => {
      dispatch({ type: 'ADD_TRADE', payload: data });
    };

    // Subscribe to detailed market data for current pair only
    // Disable orderbook subscription since we're generating order book data locally
    // wsService.subscribe('orderbook', state.currentPair, handleOrderBookUpdate);
    wsService.subscribe('trades', state.currentPair, handleTradeUpdate);

    return () => {
      // wsService.unsubscribe('orderbook', state.currentPair, handleOrderBookUpdate);
      wsService.unsubscribe('trades', state.currentPair, handleTradeUpdate);
    };
  }, [state.currentPair, state.isConnected]);

  // Subscribe to user order updates
  useEffect(() => {
    if (!wsService.isConnected() || !user) return;

    const handleOrderUpdate = (data) => {
      dispatch({ type: 'UPDATE_USER_ORDER', payload: data });
    };

    // Use the top-level debounce ref
    const handleOrderPlaced = (data) => {
      // Clear any pending refresh
      if (debounceOrderRefresh.current) {
        clearTimeout(debounceOrderRefresh.current);
      }
      
      // Add the new order immediately for instant UI feedback
      dispatch({ type: 'ADD_USER_ORDER', payload: data });
      
      // Refresh immediately without debounce
      fetchUserOrders();
    };

    const handleOrderError = (data) => {
     dispatch({ type: 'SET_ERROR', payload: data.message });
    };

    const handleOrderCancelled = (data) => {
      dispatch({ type: 'REMOVE_USER_ORDER', payload: data.orderId });
    };

    // Subscribe to order updates - use current pair or default
    const orderPair = state.currentPair || 'BTC/USDT';
    wsService.subscribe('orders', orderPair, handleOrderUpdate);
    wsService.subscribe('order_placed', orderPair, handleOrderPlaced);
    wsService.subscribe('order_error', orderPair, handleOrderError);
    wsService.subscribe('order_cancelled', orderPair, handleOrderCancelled);

    return () => {
      // Clear any pending order refresh
      if (debounceOrderRefresh.current) {
        clearTimeout(debounceOrderRefresh.current);
      }
      
      wsService.unsubscribe('orders', orderPair, handleOrderUpdate);
      wsService.unsubscribe('order_placed', orderPair, handleOrderPlaced);
      wsService.unsubscribe('order_error', orderPair, handleOrderError);
      wsService.unsubscribe('order_cancelled', orderPair, handleOrderCancelled);
    };
  }, [state.currentPair, user]); // Add currentPair as dependency

  // Initialize default trading pairs FIRST - with debouncing to prevent multiple calls
  useEffect(() => {
    let timeoutId;
    
    const initializeTradingPairs = async () => {
      try {
        // Remove delay for instant loading
        
        // First try to fetch from database
       const response = await ApiUtils.get('/market/pairs');
        
        if (response.data && response.data.success && response.data.data && response.data.data.length > 0) {
          dispatch({ type: 'SET_TRADING_PAIRS', payload: response.data.data });
        } else {
          throw new Error('No pairs from database');
        }
      } catch (error) {
       // Fallback to default pairs
        const defaultPairs = [
          'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 
          'ADA/USDT', 'DOT/USDT', 'XRP/USDT', 'DOGE/USDT'
        ];
        
       dispatch({ 
          type: 'SET_TRADING_PAIRS', 
          payload: defaultPairs.map(symbol => ({ 
            symbol, 
            baseAsset: symbol.split('/')[0], 
            quoteAsset: symbol.split('/')[1] 
          }))
        });
      }
    };

    // Initialize trading pairs immediately without debounce
    initializeTradingPairs();
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []); // Empty dependency array - only run once

  // WebSocket connection effect
  useEffect(() => {
   if (state.isConnected) {
      // WebSocket connected - ready for subscriptions
    }
  }, [state.isConnected]);

  // Subscribe to price updates for all available pairs
  useEffect(() => {
    if (!state.isConnected || !state.tradingPairs || state.tradingPairs.length === 0) {
      return;
    }
    const handlePriceUpdate = (data) => {
      dispatch({ 
        type: 'UPDATE_REAL_TIME_PRICE', 
        payload: {
          pair: data.pair,
          price: data.price,
          timestamp: data.timestamp || Date.now()
        }
      });
    };

    // Subscribe to price updates for all trading pairs
    const subscriptions = [];
    state.tradingPairs.forEach(pair => {
      const pairSymbol = pair.symbol || pair;
      wsService.subscribe('price', pairSymbol, handlePriceUpdate);
      subscriptions.push(pairSymbol);
    });

    return () => {
      subscriptions.forEach(pairSymbol => {
        wsService.unsubscribe('price', pairSymbol, handlePriceUpdate);
      });
    };
  }, [state.isConnected, state.tradingPairs, state.tradingPairs?.length]); // Added length dependency

  // Fetch initial data with debouncing to prevent rate limiting
  useEffect(() => {
    let isMounted = true;
    let timeoutId;
    
    const fetchInitialData = async () => {
      // Remove delay for instant loading
      
      if (!isMounted) return;
      
      try {
        // Fetch market tickers first
        await fetchMarketTickers();
        
        // If user is authenticated, fetch orders after a delay
        if (user) {
          setTimeout(() => {
            if (isMounted) {
              fetchUserOrders();
            }
          }, 500);
        }
      } catch (error) {
        console.error('Error fetching initial market data:', error);
      }
    };

    // Fetch initial data immediately
    fetchInitialData();
    
    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [user]); // Only depend on user, not all changing state

  // Fetch initial order book, trades for current pair (with smart fetching to avoid 404s)
  useEffect(() => {
    if (state.currentPair) {
      // Add a small delay to prevent rate limiting in development
      const timeoutId = setTimeout(() => {
        // Only fetch order book for pairs that likely have order book data
        // Skip order book for regular crypto pairs that don't have real-time order book data
        // Special tokens will generate their own order book in the frontend
        
        // For now, skip order book fetching to avoid 404 errors
        // fetchOrderBook(state.currentPair);
        
        // Still fetch recent trades as this should work for all pairs
        fetchRecentTrades(state.currentPair);
        
        // Skip price history fetching since it's not implemented yet
        // ['1m', '5m', '15m', '1h'].forEach((timeframe, index) => {
        //   setTimeout(() => {
        //     fetchPriceHistory(state.currentPair, timeframe);
        //   }, index * 200); // Stagger requests
        // });
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [state.currentPair]);

  // Periodic price updates as fallback to WebSocket
  useEffect(() => {
    // Only start periodic updates if WebSocket is not connected
    const isWsConnected = state.isConnected;
    if (isWsConnected) return;
    
    const updatePrices = async () => {
      try {
        const response = await ApiUtils.get('/market/prices');
        if (response.data.success) {
          const prices = response.data.data;
          Object.entries(prices).forEach(([pair, price]) => {
            dispatch({
              type: 'UPDATE_REAL_TIME_PRICE',
              payload: {
                pair,
                price,
                timestamp: Date.now()
              }
            });
          });
        }
      } catch (error) {
        // Silent fail for rate limited requests
        if (error.message?.includes('slow down') || error.message?.includes('429')) {
          console.warn('Price updates rate limited');
          return;
        }
        console.error('Error fetching periodic price updates:', error);
      }
    };

    // Delay initial update to spread load
    const initialTimeout = setTimeout(updatePrices, 3000);
    
    // Update every 30 seconds instead of 10 seconds to reduce API calls
    const priceInterval = setInterval(updatePrices, 30000);
    
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(priceInterval);
    };
  }, [state.isConnected]);

  // Special token price simulation effect - with much more aggressive caching
  useEffect(() => {
    let specialTokensCache = [];
    let lastFetchTime = 0;
    const CACHE_DURATION = 300000; // Cache for 5 minutes (increased from 1 minute)
    
    const simulateSpecialTokenPrices = async () => {
      try {
        const now = Date.now();
        
        // Only fetch special tokens if cache is expired and we're not rate limited
        if (now - lastFetchTime > CACHE_DURATION || specialTokensCache.length === 0) {
          try {
            const specialTokenResponse = await ApiUtils.get('/market/special-tokens');
            if (specialTokenResponse.data && specialTokenResponse.data.success && specialTokenResponse.data.data) {
              specialTokensCache = specialTokenResponse.data.data;
              lastFetchTime = now;
            }
          } catch (error) {
            // If rate limited or error, just use existing cache
            if (error.message?.includes('slow down') || error.message?.includes('429')) {
              console.warn('Special token fetch rate limited, using cache');
              return;
            }
          }
        }
        
        // Simulate price changes using cached data
        specialTokensCache.forEach(token => {
          const pair = `${token.symbol}/USDT`;
          const currentPrice = state.prices[pair] || token.currentPrice;
          
          // Very small price fluctuations (0.1% to 0.3%)
          const fluctuationPercent = (Math.random() - 0.5) * 0.006; // -0.3% to +0.3%
          const newPrice = currentPrice * (1 + fluctuationPercent);
          
          // Update price in state
          dispatch({
            type: 'UPDATE_REAL_TIME_PRICE',
            payload: {
              pair: pair,
              price: newPrice,
              timestamp: Date.now()
            }
          });
        });
      } catch (error) {
        // Silent fail for special token simulation
        console.warn('Special token simulation failed:', error.message);
      }
    };

    // Much less frequent updates to reduce API load - every 30 seconds
    const specialTokenInterval = setInterval(simulateSpecialTokenPrices, 30000);

    // Delay initial call to spread out API requests
    const initialTimeout = setTimeout(simulateSpecialTokenPrices, 5000);

    return () => {
      clearInterval(specialTokenInterval);
      clearTimeout(initialTimeout);
    };
  }, []); // Remove state.prices dependency to prevent feedback loop

  // API functions
  const fetchTradingPairs = async () => {
    try {
      const response = await ApiUtils.get('/market/pairs');
      
      if (response.data && response.data.success && response.data.data) {
        dispatch({ type: 'SET_TRADING_PAIRS', payload: response.data.data });
      } else {
        // Set empty pairs on failure
        dispatch({ type: 'SET_TRADING_PAIRS', payload: [] });
      }
    } catch (error) {
      dispatch({ type: 'SET_TRADING_PAIRS', payload: [] });
    }
  };

  const generateFallbackPairs = () => {
    const fallbackPairs = [
      { symbol: 'BTC/USDT', baseAsset: 'BTC', quoteAsset: 'USDT', baseName: 'Bitcoin' },
      { symbol: 'ETH/USDT', baseAsset: 'ETH', quoteAsset: 'USDT', baseName: 'Ethereum' },
      { symbol: 'BNB/USDT', baseAsset: 'BNB', quoteAsset: 'USDT', baseName: 'BNB' },
      { symbol: 'ADA/USDT', baseAsset: 'ADA', quoteAsset: 'USDT', baseName: 'Cardano' },
      { symbol: 'SOL/USDT', baseAsset: 'SOL', quoteAsset: 'USDT', baseName: 'Solana' }
    ];
    dispatch({ type: 'SET_TRADING_PAIRS', payload: fallbackPairs });
  };

  const fetchMarketTickers = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: { key: 'tickers', value: true } });
      const response = await ApiUtils.get('/market/tickers');
      
      let tickersData = null;
      let isSuccess = false;
      
      // Handle different response formats
      if (Array.isArray(response.data)) {
        // Direct array response
        tickersData = response.data;
        isSuccess = true;
      } else if (response.data && response.data.success && Array.isArray(response.data.data)) {
        // Wrapped response with success flag
        tickersData = response.data.data;
        isSuccess = true;
      }
      
      if (isSuccess && tickersData && tickersData.length > 0) {
        // Dispatch as wrapped format for consistency
        dispatch({ 
          type: 'SET_TICKERS', 
          payload: { success: true, data: tickersData }
        });
        
        // Extract prices from tickers and populate the prices state
        const pricesMap = {};
        tickersData.forEach(ticker => {
          if (ticker.pair && ticker.lastPrice) {
            pricesMap[ticker.pair] = ticker.lastPrice;
          }
        });
        
        dispatch({ type: 'SET_PRICES', payload: pricesMap });
      } else {
        console.error('Invalid tickers response:', response.data);
        dispatch({ 
          type: 'SET_TICKERS', 
          payload: { success: false, data: [] }
        });
      }
      
      dispatch({ type: 'SET_LOADING', payload: { key: 'tickers', value: false } });
    } catch (error) {
      console.error('Error fetching market tickers:', error);
      dispatch({ 
        type: 'SET_TICKERS', 
        payload: { success: false, data: [] }
      });
      dispatch({ type: 'SET_LOADING', payload: { key: 'tickers', value: false } });
    }
  };

  const fetchOrderBook = async (pair) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: { key: 'orderBook', value: true } });
      const response = await ApiUtils.get(`/market/orderbook/${encodeURIComponent(pair)}`);
      
      if (response.data && response.data.data && response.data.success) {
        // Only set order book if we have actual data
        const orderBookData = response.data.data;
        if ((orderBookData.bids && orderBookData.bids.length > 0) || 
            (orderBookData.asks && orderBookData.asks.length > 0)) {
          dispatch({ 
            type: 'SET_ORDER_BOOK', 
            payload: { 
              pair, 
              bids: orderBookData.bids || [], 
              asks: orderBookData.asks || [],
              timestamp: Date.now()
            } 
          });
        }
      }
    } catch (error) {
      // Check if this is a special token or orderbook not available
      if (error.response?.status === 404 || 
          error.message?.includes('Order book not available') ||
          error.message?.includes('real-time order book data not implemented')) {
        // Don't show error for special tokens or unavailable orderbooks, just skip
        dispatch({ type: 'SET_LOADING', payload: { key: 'orderBook', value: false } });
        return;
      }
      
      console.error('Error fetching order book:', error);
      // Don't set empty order book on error - just leave it undefined
      if (error.message?.includes('slow down')) {
        // Rate limited - set error but don't crash
        dispatch({ type: 'SET_ERROR', payload: 'Market data loading - please wait...' });
        // Clear error after a delay
        setTimeout(() => {
          dispatch({ type: 'CLEAR_ERROR' });
        }, 3000);
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { key: 'orderBook', value: false } });
    }
  };

  const fetchRecentTrades = async (pair) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: { key: 'trades', value: true } });
      const response = await ApiUtils.get(`/market/trades/${encodeURIComponent(pair)}?limit=50`);
      
      if (response.data && response.data.data) {
        dispatch({ 
          type: 'SET_RECENT_TRADES', 
          payload: { pair, trades: response.data.data || [] } 
        });
      }
    } catch (error) {
      console.error('Error fetching recent trades:', error);
      if (error.message?.includes('slow down')) {
        // Rate limited - silently ignore for trades
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { key: 'trades', value: false } });
    }
  };

  // Debounced and cached user orders fetching
  const userOrdersCache = useRef({
    data: null,
    timestamp: 0,
    ttl: 5000 // Cache for 5 seconds
  });

  const fetchUserOrders = useCallback(async () => {
    if (!user) return;
    
    // Check cache first
    const now = Date.now();
    if (userOrdersCache.current.data && 
        now - userOrdersCache.current.timestamp < userOrdersCache.current.ttl) {
      dispatch({ type: 'SET_USER_ORDERS', payload: userOrdersCache.current.data });
      return;
    }
    
    try {
      dispatch({ type: 'SET_LOADING', payload: { key: 'orders', value: true } });
      const response = await ApiUtils.get('/trading/orders?limit=100');
      const orders = response.data.orders || [];
      
      // Update cache
      userOrdersCache.current = {
        data: orders,
        timestamp: now,
        ttl: 5000
      };
      
      dispatch({ type: 'SET_USER_ORDERS', payload: orders });
    } catch (error) {
      console.error('Error fetching user orders:', error);
      if (error.message?.includes('slow down')) {
        // Rate limited - use cached data if available
        if (userOrdersCache.current.data) {
          dispatch({ type: 'SET_USER_ORDERS', payload: userOrdersCache.current.data });
        }
      }
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { key: 'orders', value: false } });
    }
  }, [user]);

  // Enhanced price history fetching with direct Binance API integration and special token support
  const priceHistoryRequests = useRef(new Map());

  // Generate realistic chart data for special tokens
  const generateSpecialTokenChartData = (currentPrice, timeframe = '1m', dataPoints = 500) => {
    if (!currentPrice || currentPrice === 0) {
      return [];
    }

    const data = [];
    const now = new Date();
    
    // Get interval based on timeframe
    const getIntervalMs = (tf) => {
      switch(tf) {
        case '1m': return 60 * 1000;      // 1 minute
        case '5m': return 5 * 60 * 1000;  // 5 minutes
        case '1h': return 60 * 60 * 1000; // 1 hour
        case '1d': return 24 * 60 * 60 * 1000; // 1 day
        default: return 60 * 1000;
      }
    };
    
    const intervalMs = getIntervalMs(timeframe);
    
    // Initialize price tracking for realistic movement
    let lastPrice = currentPrice;
    let trend = 0; // -1 to 1, determines overall trend direction
    let momentum = 0; // -1 to 1, determines short-term momentum
    
    // Special token configuration for stable prices
    const maxVariation = 0.005; // Max 0.5% per candle (very conservative)
    const trendStrength = 0.2; // Weak trends
    const momentumDecay = 0.9; // Slow momentum decay
    const meanReversion = 0.3; // Strong mean reversion
    
    for (let i = dataPoints - 1; i >= 0; i--) {
      const time = Math.floor((now.getTime() - (i * intervalMs)) / 1000);
      
      // Occasionally change trend (every 30-80 candles)
      if (i > 0 && Math.random() < 0.02) {
        trend = (Math.random() - 0.5) * 2;
      }
      
      // Mean reversion force
      const distanceFromStart = (lastPrice - currentPrice) / currentPrice;
      const reversionForce = -distanceFromStart * meanReversion;
      
      // Calculate momentum
      const randomChange = (Math.random() - 0.5) * 2;
      const trendInfluence = trend * trendStrength;
      const newMomentum = momentum * momentumDecay + (randomChange * 0.3 + trendInfluence * 0.7) * 0.15;
      momentum = Math.max(-1, Math.min(1, newMomentum));
      
      // Price change with very small variations
      const priceChangePercent = (momentum + reversionForce) * maxVariation;
      const priceChange = lastPrice * priceChangePercent;
      
      // OHLC calculation
      const open = lastPrice;
      const close = open + priceChange;
      
      const intradayVariation = Math.abs(priceChange) * 0.3 + lastPrice * 0.001;
      const wickHigh = Math.max(open, close) + Math.random() * intradayVariation;
      const wickLow = Math.min(open, close) - Math.random() * intradayVariation;
      
      const high = Math.max(open, close, wickHigh);
      const low = Math.min(open, close, wickLow);
      
      // Volume
      const baseVolume = 50000 + Math.random() * 100000;
      const volatilityMultiplier = 1 + Math.abs(priceChangePercent) * 30;
      const volume = Math.floor(baseVolume * volatilityMultiplier);
      
      data.push({
        time: time,
        open: parseFloat(open.toFixed(6)),
        high: parseFloat(high.toFixed(6)),
        low: parseFloat(low.toFixed(6)),
        close: parseFloat(close.toFixed(6)),
        volume: volume
      });
      
      lastPrice = close;
    }
    
    return data;
  };

  const fetchPriceHistory = async (pair, interval = '1m') => {
    const key = `${pair}_${interval}`;
    
    // Clear any existing timeout for this key
    if (priceHistoryRequests.current.has(key)) {
      clearTimeout(priceHistoryRequests.current.get(key));
    }
    
    // Set a new timeout to debounce the request
    const timeoutId = setTimeout(async () => {
      try {
        dispatch({ type: 'SET_LOADING', payload: { key: 'priceHistory', value: true } });
        
        // Check if this is a special token pair
        const baseSymbol = pair.split('/')[0];
        
        // Cache for special token data to reduce API calls
        const specialTokenCacheKey = 'specialTokens';
        let specialTokens = [];
        
        // Try to get from sessionStorage cache first for special tokens
        const cachedSpecialTokens = sessionStorage.getItem(specialTokenCacheKey);
        const cacheTimestamp = sessionStorage.getItem(`${specialTokenCacheKey}_timestamp`);
        const now = Date.now();
        
        if (cachedSpecialTokens && cacheTimestamp && (now - parseInt(cacheTimestamp)) < 60000) {
          // Use cached data if less than 1 minute old
          specialTokens = JSON.parse(cachedSpecialTokens);
        } else {
          // Fetch fresh data and cache it
          try {
            const specialTokenResponse = await ApiUtils.get('/market/special-tokens');
            if (specialTokenResponse.data && specialTokenResponse.data.success && specialTokenResponse.data.data) {
              specialTokens = specialTokenResponse.data.data;
              sessionStorage.setItem(specialTokenCacheKey, JSON.stringify(specialTokens));
              sessionStorage.setItem(`${specialTokenCacheKey}_timestamp`, now.toString());
            }
          } catch (specialTokenError) {
            // Not a special token, proceeding with regular API calls
          }
        }
        
        // Check if this pair is a special token
        const specialToken = specialTokens.find(token => token.symbol === baseSymbol);
        if (specialToken) {
          const chartData = generateSpecialTokenChartData(specialToken.currentPrice, interval, 500);
          
          // Store in state
          dispatch({
            type: 'SET_PRICE_HISTORY',
            payload: {
              pair,
              timeframe: interval,
              data: chartData
            }
          });
          
          return chartData;
        }
        
        // Try backend API first (which has caching)
        try {
          const response = await ApiUtils.get(`/market/klines/${encodeURIComponent(pair)}?interval=${interval}&limit=500`);
          
          if (response.data && response.data.success && response.data.data) {
            const priceHistoryData = response.data.data;
            
            // Store in state
            dispatch({
              type: 'SET_PRICE_HISTORY',
              payload: {
                pair,
                timeframe: interval,
                data: priceHistoryData
              }
            });
            
            return priceHistoryData;
          }
        } catch (backendError) {
          console.warn('⚠️ Backend API failed, trying direct Binance API:', backendError.message);
        }

        // Fallback to direct Binance API
        
        const binanceSymbol = pair.replace('/', '').toUpperCase();
        const binanceInterval = interval; // intervals are compatible
        
        const binanceResponse = await fetch(
          `https://ApiUtils.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${binanceInterval}&limit=500`,
          { timeout: 10000 }
        );
        
        if (binanceResponse.ok) {
          const binanceData = await binanceResponse.json();
          const formattedData = binanceData.map(candle => ({
            time: Math.floor(candle[0] / 1000), // Convert ms to seconds
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            volume: parseFloat(candle[5])
          }));

          // Store in state
          dispatch({
            type: 'SET_PRICE_HISTORY',
            payload: {
              pair,
              timeframe: interval,
              data: formattedData
            }
          });

          return formattedData;
        } else {
          throw new Error(`Binance API returned ${binanceResponse.status}`);
        }
        
      } catch (error) {
        console.error('❌ TradingContext: Error fetching price history from all sources:', error);
        return [];
      } finally {
        dispatch({ type: 'SET_LOADING', payload: { key: 'priceHistory', value: false } });
        priceHistoryRequests.current.delete(key);
      }
    }, 500); // Increased debounce to reduce API calls

    // Store the timeout
    priceHistoryRequests.current.set(key, timeoutId);
  };

  // Trading actions
  const placeOrder = useCallback(async (orderData) => {
    try {
      dispatch({ type: 'CLEAR_ERROR' });
      
      if (wsService.isConnected()) {
        // Use WebSocket for real-time order placement
        wsService.placeOrder(orderData);
      } else {
        // Fallback to REST API
        const response = await ApiUtils.post('/trading/orders', orderData);
        dispatch({ type: 'ADD_USER_ORDER', payload: response.data });
      }
    } catch (error) {
      console.error('Error placing order:', error);
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  }, []);

  const cancelOrder = useCallback(async (orderId) => {
    try {
      dispatch({ type: 'CLEAR_ERROR' });
      
      if (wsService.isConnected()) {
        // Use WebSocket for real-time order cancellation
        wsService.cancelOrder(orderId);
      } else {
        // Fallback to REST API
        await ApiUtils.delete(`/trading/orders/${orderId}`);
        dispatch({ type: 'REMOVE_USER_ORDER', payload: orderId });
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
      dispatch({ type: 'SET_ERROR', payload: error.message });
      throw error;
    }
  }, []);

  const setCurrentPair = useCallback((pair) => {
    // Validate trading pair before setting it
    if (!pair || typeof pair !== 'string') {
      return;
    }
    
    const [base, quote] = pair.split('/');
    
    // Check if pair has valid format and prevent same currency pairs
    if (!base || !quote || base.toUpperCase() === quote.toUpperCase()) {
      return;
    }
    
    dispatch({ type: 'SET_CURRENT_PAIR', payload: pair });
    
    // Try to set the current price from tickers if not already in prices
    if (!state.prices[pair] && state.tickers.data && Array.isArray(state.tickers.data)) {
      const ticker = state.tickers.data.find(t => t.pair === pair);
      if (ticker && ticker.lastPrice) {
        dispatch({ 
          type: 'SET_PRICE', 
          payload: { pair, price: ticker.lastPrice } 
        });
      }
    }
  }, [state.prices, state.tickers.data]);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const value = useMemo(() => ({
    // State
    ...state,
    
    // Actions
    placeOrder,
    cancelOrder,
    setCurrentPair,
    clearError,
    fetchUserOrders,
    fetchMarketTickers,
    fetchTradingPairs,
    fetchPriceHistory,
    fetchOrderBook,
    fetchRecentTrades,
    
    // Current price convenience getter - use real API data with ticker fallback
    currentPrice: (() => {
      // First check prices state
      if (state.prices[state.currentPair]) {
        return state.prices[state.currentPair];
      }
      
      // Fallback to ticker data
      if (state.tickers.data && Array.isArray(state.tickers.data)) {
        const ticker = state.tickers.data.find(t => t.pair === state.currentPair);
        if (ticker && ticker.lastPrice) {
          return ticker.lastPrice;
        }
      }
      
      return 0;
    })(),
    
    // Price history getter function
    getPriceHistory: (pair = state.currentPair, timeframe = '1m') => {
      const key = `${pair}_${timeframe}`;
      return state.priceHistory[key] || [];
    },
    
    // Price history for current pair (default 1m)
    priceHistory: state.priceHistory[`${state.currentPair}_1m`] || [],
    
    // Full price history state for all pairs and timeframes
    allPriceHistory: state.priceHistory,
    
    // WebSocket status
    isConnected: state.isConnected,
  }), [state, placeOrder, cancelOrder, setCurrentPair, clearError, fetchUserOrders, fetchMarketTickers, fetchTradingPairs, fetchPriceHistory]);

  return (
    <TradingContext.Provider value={value}>
      {children}
    </TradingContext.Provider>
  );
};

export const useTrading = () => {
  const context = useContext(TradingContext);
  if (!context) {
    // In development, provide a default context to handle HMR issues
    if (import.meta.env.DEV) {
      return {
        currentPair: 'BTC/USDT',
        setCurrentPair: () => {},
        orderBooks: {},
        recentTrades: {},
        prices: {},
        priceHistory: {},
        tickers: [],
        userOrders: [],
        tradingPairs: [{ symbol: 'BTC/USDT', baseAsset: 'BTC', quoteAsset: 'USDT' }],
        loading: { orderBook: false, trades: false, orders: false, tickers: false, priceHistory: false },
        error: null,
        placeOrder: () => Promise.resolve(),
        cancelOrder: () => Promise.resolve(),
        clearError: () => {},
        isConnected: false,
        fetchOrderBook: () => Promise.resolve(),
        fetchRecentTrades: () => Promise.resolve(),
        fetchUserOrders: () => Promise.resolve(),
        fetchMarketTickers: () => Promise.resolve(),
        fetchTradingPairs: () => Promise.resolve(),
        fetchPriceHistory: () => Promise.resolve(),
        currentPrice: 0
      };
    }
    throw new Error('useTrading must be used within a TradingProvider');
  }
  return context;
};

// Helper function to update the latest candle with new price
const updateLatestCandle = (priceHistory, newPrice, timestamp, timeframe = '1m') => {
  // Ensure we have a valid array
  if (!Array.isArray(priceHistory)) {
    console.warn('Price history is not an array, creating new one:', priceHistory);
    priceHistory = [];
  }

  // Get time interval in milliseconds based on timeframe
  const getTimeInterval = (tf) => {
    switch(tf) {
      case '1s': return 1000;      // 1 second
      case '1m': return 60000;     // 1 minute
      case '5m': return 300000;    // 5 minutes
      case '1h': return 3600000;   // 1 hour
      case '1d': return 86400000;  // 1 day
      default: return 60000;       // default to 1 minute
    }
  };

  const intervalMs = getTimeInterval(timeframe);
  const currentInterval = Math.floor(timestamp / intervalMs) * intervalMs;

  if (!priceHistory || priceHistory.length === 0) {
    // Create initial candle
    return [{
      timestamp: currentInterval,
      time: currentInterval,
      open: newPrice,
      high: newPrice,
      low: newPrice,
      close: newPrice,
      volume: Math.random() * 10 + 1
    }];
  }

  const history = [...priceHistory];
  const lastCandle = history[history.length - 1];

  // Handle both timestamp and time properties for compatibility
  const lastCandleTime = lastCandle.timestamp || lastCandle.time;

  if (lastCandleTime === currentInterval) {
    // Update current candle
    lastCandle.close = newPrice;
    lastCandle.high = Math.max(lastCandle.high || newPrice, newPrice);
    lastCandle.low = Math.min(lastCandle.low || newPrice, newPrice);
    lastCandle.volume = (lastCandle.volume || 0) + Math.random() * 2;
    // Update both timestamp formats
    lastCandle.timestamp = currentInterval;
    lastCandle.time = currentInterval;
  } else {
    // Create new candle
    const newCandle = {
      timestamp: currentInterval,
      time: currentInterval,
      open: newPrice,
      high: newPrice,
      low: newPrice,
      close: newPrice,
      volume: Math.random() * 10 + 1
    };
    
    history.push(newCandle);
    
    // Keep only last 100 candles
    if (history.length > 100) {
      history.shift();
    }
  }

  return history;
};
