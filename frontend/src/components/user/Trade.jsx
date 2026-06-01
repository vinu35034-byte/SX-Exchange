import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { useUserProfile } from '../../contexts/UserProfileContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTrading } from '../../contexts/TradingContext';
import { useSession } from '../../contexts/SessionContext';
import { Button } from "@/components/ui/button";
import { 
  ExclamationTriangleIcon,
  XCircleIcon
} from "@heroicons/react/24/outline";
import { ChartLine, ChevronDown, AlignJustify, MoreVertical, Star, BarChart2, Wallet, ArrowDownLeft, ArrowUpRight, Users, Gamepad2 } from 'lucide-react';
import { MdOutlineCandlestickChart } from 'react-icons/md';
import { getCryptoLogoUrl, getCryptoFallbackUrls } from '../../utils/logoService';
import Spinner from '../common/Spinner';
import { showToast } from '../../utils/toast';
import { useOrderBook, useCandlestickData, useTradeHistory, useUserBalance } from '../../hooks/useCacheAwareData';
import { ApiUtils } from '../../services/api';
import CandlestickChart from '../charts/CandlestickChart';
import Menu from '../Menu';

const meshBg = { background: '#FFFFFF' };

const Trade = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useUserAuth();
  const { refreshProfile } = useUserProfile();
  const { isDarkMode } = useTheme();
  const { sessionStatus } = useSession();
  const {
    currentPair,
    setCurrentPair,
    orderBooks,
    prices,
    error,
    placeOrder,
    clearError,
    isConnected,
    currentPrice,
    tickers,
    priceHistory,
    allPriceHistory,
    getPriceHistory,
    fetchPriceHistory
  } = useTrading();

  // Simulated real-time price updates (updates every second)
  const [simulatedRealTimePrice, setSimulatedRealTimePrice] = useState(null);
  const [lastPriceUpdate, setLastPriceUpdate] = useState(Date.now());
  const [simulatedBalanceUpdate, setSimulatedBalanceUpdate] = useState(Date.now());

  // Simulate balance updates every 3 seconds to show real-time functionality
  useEffect(() => {
    const interval = setInterval(() => {
      setSimulatedBalanceUpdate(Date.now());
    }, 3000); // Update every 3 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Real-time data hooks optimized for 20k+ users with 1-second updates
  // Note: Using simulated real-time data since API endpoints are not available
  const {
    data: realTimeTradingData,
    loading: tradingDataLoading,
    error: tradingDataError,
    lastUpdate: tradingLastUpdate,
    refresh: refreshTradingData,
    currentPrice: realTimeCurrentPrice,
    currentTicker: realTimeCurrentTicker,
    orderBook: realTimeOrderBook,
    recentTrades: realTimeRecentTrades
  } = { 
    data: {}, 
    loading: false, 
    error: null, 
    lastUpdate: Date.now(),
    refresh: () => Promise.resolve(),
    currentPrice: null,
    currentTicker: null,
    orderBook: { bids: [], asks: [] },
    recentTrades: []
  }; // Disabled to prevent 404 errors

  const {
    data: realTimeUserData,
    loading: userDataLoading,
    error: userDataError,
    lastUpdate: userLastUpdate,
    refresh: refreshUserData,
    balances: realTimeBalances,
    orders: realTimeOrders,
    getBalance: getRealTimeBalance
  } = { 
    data: {}, 
    loading: false, 
    error: null, 
    lastUpdate: Date.now(),
    refresh: () => Promise.resolve(),
    balances: {},
    orders: [],
    getBalance: () => ({ available: 0, locked: 0, total: 0 })
  }; // Disabled to prevent 404 errors

  const {
    data: realTimeMarketData,
    loading: marketDataLoading,
    error: marketDataError,
    lastUpdate: marketLastUpdate,
    refresh: refreshMarketData,
    prices: realTimePrices,
    tickers: realTimeTickers
  } = { 
    data: {}, 
    loading: false, 
    error: null, 
    lastUpdate: Date.now(),
    refresh: () => Promise.resolve(),
    prices: {},
    tickers: {}
  }; // Disabled to prevent 404 errors

  // State declarations - moved to top to prevent initialization order issues
  const [selectedTimeframe, setSelectedTimeframe] = useState('1m');
  const [availableTokens, setAvailableTokens] = useState([]);
  const [tokensLoaded, setTokensLoaded] = useState(false);
  const [userBuyPrices, setUserBuyPrices] = useState({}); // Store user's buy prices by token symbol
  
  // Component initialization state to prevent rapid API calls on mount
  const [isInitialized, setIsInitialized] = useState(false);
  const [rateLimitWarning, setRateLimitWarning] = useState(false);
  
  // Loading state for navigation from Market.jsx
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // Initialize component with delay to prevent rapid API calls
  useEffect(() => {
    const initTimeout = setTimeout(() => {
      setIsInitialized(true);
    }, 100);
    
    return () => clearTimeout(initTimeout);
  }, []);

  // Page loading simulation for smooth navigation experience
  useEffect(() => {
    let progressInterval;
    
    // Start loading progress
    const startLoading = () => {
      setLoadingProgress(0);
      progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 15;
        });
      }, 150);
    };

    // Complete loading when component is ready
    const completeLoading = () => {
      if (progressInterval) clearInterval(progressInterval);
      setLoadingProgress(100);
      setTimeout(() => {
        setIsPageLoading(false);
      }, 300);
    };

    // Start loading immediately
    startLoading();
    
    // Complete loading when tokens are loaded and component is initialized
    if (isInitialized && tokensLoaded) {
      completeLoading();
    }

    return () => {
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [isInitialized, tokensLoaded]);

  // Order book fetching disabled — using simulated/real-time data instead
  useOrderBook(currentPair, { enabled: false });

  const { 
    data: candlestickData, 
    loading: candlestickLoading,
    refetch: refetchCandlestick
  } = useCandlestickData(currentPair, selectedTimeframe);

  const { 
    data: tradeHistoryData, 
    loading: tradeHistoryLoading,
    refetch: refetchTradeHistory
  } = useTradeHistory(currentPair);

  const { 
    data: balanceData, 
    loading: balanceLoading,
    refetch: refetchBalance,
    cacheStatus: balanceCacheStatus
  } = useUserBalance();

  const [tradeTab, setTradeTab] = useState('spot');
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [orderType, setOrderType] = useState('limit');
  const [orderSide, setOrderSide] = useState('buy');
  const [orderAmount, setOrderAmount] = useState('');
  const [orderPrice, setOrderPrice] = useState('');
  const [orderPercentage, setOrderPercentage] = useState(0);
  const [amountInputType, setAmountInputType] = useState('token'); // 'token' or 'usdt'
  const [mobileActiveTab, setMobileActiveTab] = useState('trade'); // Start with trade tab
  const [showChart, setShowChart] = useState(false); // State to toggle chart view
  const [activeTab, setActiveTab] = useState('trading'); // State for active tab (trading/analysis)
  const [showOrderTypeDropdown, setShowOrderTypeDropdown] = useState(false);
  const [showAmountTypeDropdown, setShowAmountTypeDropdown] = useState(false);
  const [specialTokens, setSpecialTokens] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [chartDataCache, setChartDataCache] = useState({}); // Cache for chart data
  
  // Enhanced chart data validation to prevent "Value is null" errors
  // This complements our backend validation in candleService.js
  // 3-Layer Validation: Backend → API Transform → Chart Component
  const setValidatedChartData = useCallback((data) => {
    if (!data || !Array.isArray(data)) {
      console.warn('🚨 Chart: Invalid data format, using empty array');
      setChartData([]);
      return;
    }

    // Filter out any null/invalid data points
    const validData = data.filter(candle => {
      if (!candle || typeof candle !== 'object') return false;
      
      // Check all required OHLC fields
      const requiredFields = ['time', 'open', 'high', 'low', 'close'];
      return requiredFields.every(field => {
        const value = candle[field];
        return value !== null && 
               value !== undefined && 
               !isNaN(value) && 
               isFinite(value) &&
               (field === 'time' || value > 0); // prices must be positive
      });
    });

    if (validData.length !== data.length) {
      console.warn(`🚨 Chart: Filtered out ${data.length - validData.length} invalid candles`);
    }

    setChartData(validData);
  }, []);
  const [logoLoading, setLogoLoading] = useState(true);
  const [favorites, setFavorites] = useState([]);

  // Fetch favorites from backend on mount (same as Market.jsx)
  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        const res = await ApiUtils.get('/user/favorites');
        if (res?.favorites) setFavorites(res.favorites);
      } catch {
        // Not authenticated or network error — leave favorites empty
      }
    };
    fetchFavorites();
  }, []);

  const toggleFavorite = async (symbol) => {
    // Optimistic update
    setFavorites(prev =>
      prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
    );
    try {
      const res = await ApiUtils.post('/user/favorites/toggle', { symbol });
      if (res?.favorites) setFavorites(res.favorites);
    } catch {
      // Revert on error
      setFavorites(prev =>
        prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
      );
    }
  };

  const [logoError, setLogoError] = useState(false);
  const [userBalances, setUserBalances] = useState({});
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [userOrders, setUserOrders] = useState([]);

  // Demo trading
  const [isDemoMode, setIsDemoMode] = useState(() => localStorage.getItem('tradeDemo') === 'true');
  const [demoBalances, setDemoBalances] = useState({});
  const [demoStats, setDemoStats] = useState(null);

  const [portfolioTab, setPortfolioTab] = useState('opens'); // 'opens' | 'holdings'
  const [obTab, setObTab] = useState('book'); // 'book' | 'depth'
  const [chartTab, setChartTab] = useState('price'); // 'price' | 'info'
  const [orderBookVariation, setOrderBookVariation] = useState(0); // For dynamic order book updates
  
  // Performance optimization refs with enhanced rate limiting
  const chartDataRequestRef = useRef(null);
  const lastFetchTime = useRef({});
  const requestCache = useRef(new Map());
  const abortControllers = useRef(new Map());
  const globalRateLimit = useRef({ requests: 0, resetTime: Date.now() + 60000 }); // 60 second window

  // Get special token data if current pair is a special token - memoized
  const getCurrentSpecialToken = useCallback(() => {
    if (!currentPair || !specialTokens.length) {
      return null;
    }
    const baseSymbol = currentPair.split('/')[0];
    const found = specialTokens.find(token => token.symbol === baseSymbol);
    return found;
  }, [currentPair, specialTokens]);

  const currentSpecialToken = useMemo(() => getCurrentSpecialToken(), [getCurrentSpecialToken]);

  // Get price change data for the current pair - prioritize real-time data
  const currentPairTicker = (() => {
    // First priority: Real-time ticker data (updates every second)
    if (realTimeCurrentTicker) {
      return realTimeCurrentTicker;
    }
    
    // Second priority: Real-time tickers from market data
    if (currentPair && realTimeTickers && realTimeTickers[currentPair]) {
      return realTimeTickers[currentPair];
    }
    
    // Third priority: Context tickers
    if (currentPair && prices[currentPair] && tickers && tickers.data && Array.isArray(tickers.data)) {
      return tickers.data.find(t => t.pair === currentPair);
    }
    return null;
  })();

  // Get the base price (without simulation) for the selected pair
  const basePairPrice = useMemo(() => {
    // First priority: For special tokens, use their currentPrice directly
    if (currentSpecialToken && currentSpecialToken.currentPrice) {
      return currentSpecialToken.currentPrice;
    }
    
    // Second priority: Use context prices (WebSocket)
    if (currentPair && prices[currentPair]) {
      return prices[currentPair];
    }
    
    // Third priority: Use ticker data
    if (currentPairTicker && currentPairTicker.lastPrice) {
      return currentPairTicker.lastPrice;
    }
    
    // Fallback: Return 0 if no real data available
    return 0;
  }, [currentSpecialToken, currentPair, prices, currentPairTicker]);

  // Get the current price for the selected pair - prioritize real-time data for live updates
  const currentPairPrice = useMemo(() => {
    // First priority: Simulated real-time price (updates every second)
    if (simulatedRealTimePrice && simulatedRealTimePrice > 0) {
      return simulatedRealTimePrice;
    }
    
    // Second priority: Use the base price
    return basePairPrice;
  }, [simulatedRealTimePrice, basePairPrice]);

  // Create realistic price fluctuations every second
  useEffect(() => {
    if (!basePairPrice || basePairPrice === 0) return;
    
    const interval = setInterval(() => {
      const basePrice = basePairPrice;
      // Small random fluctuation (±0.1%)
      const fluctuation = (Math.random() - 0.5) * 0.002; // 0.2% max change
      const newPrice = basePrice * (1 + fluctuation);
      
      setSimulatedRealTimePrice(newPrice);
      setLastPriceUpdate(Date.now());
    }, 1000); // Update every second
    
    return () => clearInterval(interval);
  }, [basePairPrice]);

  // Update order book variation for dynamic special token order books
  useEffect(() => {
    const interval = setInterval(() => {
      // Update order book variation every 3-5 seconds for realistic changes
      setOrderBookVariation(prev => prev + 1);
    }, Math.random() * 2000 + 3000); // Random interval between 3-5 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Global rate limiting helper
  const checkRateLimit = useCallback(() => {
    const now = Date.now();
    
    // Reset counter every minute
    if (now > globalRateLimit.current.resetTime) {
      globalRateLimit.current.requests = 0;
      globalRateLimit.current.resetTime = now + 60000;
      setRateLimitWarning(false); // Clear warning when window resets
    }
    
    // Allow max 30 requests per minute to prevent 429 errors
    if (globalRateLimit.current.requests >= 30) {
      console.warn('Rate limit reached, delaying request...');
      setRateLimitWarning(true);
      
      // Auto-clear warning after 5 seconds
      setTimeout(() => setRateLimitWarning(false), 5000);
      
      return false;
    }
    
    globalRateLimit.current.requests++;
    return true;
  }, []);

  // Get user's average buy price for a specific token from their purchase history
  const fetchUserBuyPrice = useCallback(async (tokenSymbol) => {
    try {
      // TODO: Implement backend endpoint /trading/user-transactions
      // For now, temporarily disable the API call to prevent 404 errors
      // Once the backend endpoint is implemented, uncomment the code below
      
      /* 
      const response = await ApiUtils.get(`/trading/user-transactions?symbol=${tokenSymbol}&type=buy`);
      
      if (response.success && response.data && response.data.length > 0) {
        // Calculate weighted average buy price
        let totalValue = 0;
        let totalAmount = 0;
        
        response.data.forEach(transaction => {
          if (transaction.type === 'buy' || transaction.side === 'buy') {
            totalValue += transaction.amount * transaction.price;
            totalAmount += transaction.amount;
          }
        });
        
        if (totalAmount > 0) {
          const averageBuyPrice = totalValue / totalAmount;
          // Cache the buy price
          setUserBuyPrices(prev => ({
            ...prev,
            [tokenSymbol]: averageBuyPrice
          }));
          return averageBuyPrice;
        }
      }
      */
      
      // Temporarily use current market price until backend endpoint is ready
      // Cache the current price so we don't keep fetching
      setUserBuyPrices(prev => ({
        ...prev,
        [tokenSymbol]: currentPairPrice
      }));
      
      return currentPairPrice;
    } catch (error) {
      // Silently handle errors and use current market price
      return currentPairPrice;
    }
  }, [currentPairPrice]);

  // Fetch user's buy price when trading pair changes
  useEffect(() => {
    if (currentPair && user) {
      const [baseCurrency] = currentPair.split('/');
      // Only fetch if we don't already have the buy price cached
      if (!userBuyPrices[baseCurrency]) {
        fetchUserBuyPrice(baseCurrency);
      }
    }
  }, [currentPair, user, userBuyPrices, fetchUserBuyPrice]);

  // Manual refresh function for all trading data with simulated real-time updates
  const handleRefreshTradingData = async () => {
    try {
      // Force refresh all available data sources
      await Promise.all([
        refetchCandlestick(true),
        refetchTradeHistory(true),
        refetchBalance(true),
        fetchUserBalances(),
        fetchSpecialTokens()
      ]);
      
      // Trigger simulated real-time updates
      setSimulatedBalanceUpdate(Date.now());
      setLastPriceUpdate(Date.now());
      
      // Show success feedback
      showToast.success('Trading data refreshed successfully');
    } catch (error) {
      showToast.error('Failed to refresh some data');
    }
  };

  // Generate realistic candlestick data for special tokens with controlled price movements
  const generateSimpleCandlestickData = useCallback((currentPrice, timeframe = selectedTimeframe) => {
    if (!currentPrice || currentPrice === 0) {
      return [];
    }

    // Ensure currentPrice is a reasonable number
    const safeCurrentPrice = Math.max(0.01, Math.min(10000, parseFloat(currentPrice)));

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
    const dataPoints = 500; // Generate more data points for better charts
    
    // Initialize price tracking for realistic movement
    let lastPrice = safeCurrentPrice; // Use the safe price
    let trend = 0; // -1 to 1, determines overall trend direction
    let momentum = 0; // -1 to 1, determines short-term momentum
    
    // Special token configuration for more stable prices
    const maxVariation = 0.008; // Max 0.8% per candle (much lower than before)
    const trendStrength = 0.3; // How strong trends are
    const momentumDecay = 0.85; // How quickly momentum fades
    const meanReversion = 0.15; // How strongly price reverts to starting price
    
    for (let i = dataPoints - 1; i >= 0; i--) {
      const time = Math.floor((now.getTime() - (i * intervalMs)) / 1000); // Unix timestamp
      
      // Occasionally change trend (every 20-50 candles)
      if (i > 0 && Math.random() < 0.03) {
        trend = (Math.random() - 0.5) * 2; // New random trend between -1 and 1
      }
      
      // Calculate mean reversion force (pulls price back to starting point)
      const distanceFromStart = (lastPrice - safeCurrentPrice) / safeCurrentPrice;
      const reversionForce = -distanceFromStart * meanReversion;
      
      // Calculate momentum change
      const randomChange = (Math.random() - 0.5) * 2; // -1 to 1
      const trendInfluence = trend * trendStrength;
      const newMomentum = momentum * momentumDecay + (randomChange * 0.3 + trendInfluence * 0.7) * 0.2;
      momentum = Math.max(-1, Math.min(1, newMomentum));
      
      // Calculate price change with much smaller variations
      const priceChangePercent = (momentum + reversionForce) * maxVariation;
      const priceChange = lastPrice * priceChangePercent;
      
      // Calculate OHLC for this candle
      const open = lastPrice;
      const close = open + priceChange;
      
      // Small intraday variations (within candle movements)
      const intradayVariation = Math.abs(priceChange) * 0.5 + lastPrice * 0.002; // Very small wick variations
      const wickHigh = Math.max(open, close) + Math.random() * intradayVariation;
      const wickLow = Math.min(open, close) - Math.random() * intradayVariation;
      
      const high = Math.max(open, close, wickHigh);
      const low = Math.min(open, close, wickLow);
      
      // Generate realistic volume (higher volume during price movements)
      const baseVolume = 100000 + Math.random() * 200000; // 100k-300k base
      const volatilityMultiplier = 1 + Math.abs(priceChangePercent) * 50; // Higher volume during moves
      const volume = Math.floor(baseVolume * volatilityMultiplier);
      
      data.push({
        time: time,
        open: parseFloat(open.toFixed(6)),
        high: parseFloat(high.toFixed(6)),
        low: parseFloat(low.toFixed(6)),
        close: parseFloat(close.toFixed(6)),
        volume: volume
      });
      
      // Update last price for next iteration
      lastPrice = close;
    }
    
    // Ensure the last candle close price matches the current price approximately
    if (data.length > 0) {
      const lastCandle = data[data.length - 1];
      const priceDiff = safeCurrentPrice - lastCandle.close;
      const adjustment = priceDiff * 0.8; // Gentle adjustment
      
      lastCandle.close = parseFloat((lastCandle.close + adjustment).toFixed(6));
      lastCandle.high = Math.max(lastCandle.open, lastCandle.close, lastCandle.high);
      lastCandle.low = Math.min(lastCandle.open, lastCandle.close, lastCandle.low);
    }

    return data;
  }, [selectedTimeframe]); // Memoize with selectedTimeframe dependency

  // Fetch user orders with real-time updates and deduplication
  const fetchUserOrders = useCallback(async () => {
    // Don't fetch if user is not authenticated - handle both id formats
    const userId = user?.id || user?._id;
    if (!user || !userId) return;
    
    const cacheKey = `userOrders_${userId}`;
    const now = Date.now();
    
    // Check if we have a recent request in flight
    if (requestCache.current.has(cacheKey)) {
      const { timestamp, promise } = requestCache.current.get(cacheKey);
      if (now - timestamp < 15000) { // 15 second deduplication for orders
        return promise;
      }
    }
    
    const fetchPromise = (async () => {
      try {
        // Check global rate limit before making request
        if (!checkRateLimit()) {
          // If rate limited, return early without fetching
          requestCache.current.delete(cacheKey);
          return;
        }
        
        const controller = new AbortController();
        abortControllers.current.set(cacheKey, controller);
        
        // Add delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 400));
        
        const response = await ApiUtils.get('/trading/orders?limit=10');
        
        if (response.success && response.data && response.data.orders) {
          setUserOrders(response.data.orders);
        }
        
        // Clean up
        abortControllers.current.delete(cacheKey);
        requestCache.current.delete(cacheKey);
        
      } catch (error) {
        if (error.name !== 'AbortError') {
          // Check if it's an authentication error
          if (error.response?.status === 401 || error.message?.includes('Unauthorized')) {
            // Silently handle auth errors - user needs to log in
          } else {
            console.warn('Error fetching user orders:', error.message);
          }
        }
        requestCache.current.delete(cacheKey);
      }
    })();
    
    requestCache.current.set(cacheKey, { timestamp: now, promise: fetchPromise });
    return fetchPromise;
  }, [user, checkRateLimit]);

  // Get user orders - prioritize real-time data
  const userOrdersToDisplay = useMemo(() => {
    // First priority: Real-time orders (updates every second)
    if (realTimeOrders && realTimeOrders.length > 0) {
      return realTimeOrders;
    }
    
    // Second priority: Cached orders
    return userOrders;
  }, [realTimeOrders, userOrders]);

  // Fetch user balances with caching and deduplication
  const fetchUserBalances = useCallback(async () => {
    
    if (!user) {
      return;
    }
    
    const userId = user.id || user._id;
    if (!userId) {
      return;
    }
    
    const cacheKey = `userBalances_${userId}`;
    const now = Date.now();
    
    // Check cache first - reduce cache time to 5 seconds for debugging
    if (lastFetchTime.current[cacheKey] && now - lastFetchTime.current[cacheKey] < 5000) {
      return; // Don't fetch if we fetched within last 5 seconds
    }
    
    // Check if we have a recent request in flight
    if (requestCache.current.has(cacheKey)) {
      const { timestamp, promise } = requestCache.current.get(cacheKey);
      if (now - timestamp < 10000) { // 10 second deduplication
        return promise;
      }
    }
    
    const fetchPromise = (async () => {
      try {
        // Check global rate limit before making request
        if (!checkRateLimit()) {
          // If rate limited, return early without fetching
          requestCache.current.delete(cacheKey);
          return;
        }
        
        const controller = new AbortController();
        abortControllers.current.set(cacheKey, controller);
        
        // Add delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const response = await ApiUtils.get('/trading/balances');
        
        
        if (response.success && response.data) {
          setUserBalances(response.data);
          lastFetchTime.current[cacheKey] = now;
        }
        
        // Clean up
        abortControllers.current.delete(cacheKey);
        requestCache.current.delete(cacheKey);
        
        } catch (error) {
        if (error.name !== 'AbortError') {
          // Check if it's an authentication error
          if (error.response?.status === 401 || error.message?.includes('Unauthorized')) {
            // Silently handle auth errors - user needs to log in
          } else {
            console.warn('🔍 Error fetching user balances:', error.message);
          }
        }
        requestCache.current.delete(cacheKey);
      }
    })();
    
    requestCache.current.set(cacheKey, { timestamp: now, promise: fetchPromise });
    return fetchPromise;
  }, [user]);

  // Fetch demo balances from backend
  const fetchDemoBalances = useCallback(async () => {
    try {
      const res = await ApiUtils.get('/demo-trading/balances');
      if (res.success && res.data) setDemoBalances(res.data);
    } catch (e) {
      console.warn('Could not fetch demo balances:', e.message);
    }
  }, []);

  const fetchDemoStats = useCallback(async () => {
    try {
      const res = await ApiUtils.get('/demo-trading/stats');
      if (res.success && res.data) setDemoStats(res.data);
    } catch (e) {
      console.warn('Could not fetch demo stats:', e.message);
    }
  }, []);

  // Get available balance for a currency - prioritize real-time data
  const getAvailableBalance = useCallback((currency) => {
    // Demo mode: use demo balances
    if (isDemoMode) {
      return demoBalances[currency]?.available || 0;
    }
    // First priority: Real-time balance data (updates every second)
    if (realTimeBalances && realTimeBalances[currency]) {
      return realTimeBalances[currency].available || 0;
    }

    // Second priority: Cached balance data
    const balance = userBalances[currency]?.available || 0;
    return balance;
  }, [isDemoMode, demoBalances, realTimeBalances, userBalances]);

  // Fetch special tokens to check if current pair is a special token
  const fetchSpecialTokens = useCallback(async () => {
    const cacheKey = 'specialTokens';
    const now = Date.now();
    
    // Check cache first (cache for 10 minutes)
    if (lastFetchTime.current[cacheKey] && now - lastFetchTime.current[cacheKey] < 600000) {
      // Use cached data if available
      const cachedTokens = JSON.parse(localStorage.getItem('specialTokensCache') || '[]');
      if (cachedTokens.length > 0) {
        setSpecialTokens(cachedTokens);
        return;
      }
    }
    
    // Check if we have a recent request in flight
    if (requestCache.current.has(cacheKey)) {
      const { timestamp, promise } = requestCache.current.get(cacheKey);
      if (now - timestamp < 10000) { // 10 second deduplication
        return promise;
      }
    }
    
    const fetchPromise = (async () => {
      try {
        // Check global rate limit before making request
        if (!checkRateLimit()) {
          // If rate limited, use cached data or wait
          const cachedTokens = JSON.parse(localStorage.getItem('specialTokensCache') || '[]');
          if (cachedTokens.length > 0) {
            setSpecialTokens(cachedTokens);
            return;
          }
          // Wait 2 seconds before retrying if no cached data
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        const controller = new AbortController();
        abortControllers.current.set(cacheKey, controller);
        
        // Add delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const response = await ApiUtils.get('/market/special-tokens');
        
        if (response.success && response.data) {
          const tokens = response.data;
          
          // Cache the data
          localStorage.setItem('specialTokensCache', JSON.stringify(tokens));
          lastFetchTime.current[cacheKey] = now;
          
          setSpecialTokens(tokens);
        }
        
        // Clean up
        abortControllers.current.delete(cacheKey);
        requestCache.current.delete(cacheKey);
        
      } catch (error) {
        if (error.name !== 'AbortError') {
          // Silently handle special tokens fetch errors - users may access unavailable endpoints
        }
        requestCache.current.delete(cacheKey);
      }
    })();
    
    requestCache.current.set(cacheKey, { timestamp: now, promise: fetchPromise });
    return fetchPromise;
  }, []);

  // Check if trading is enabled for the current token (both special and regular tokens)
  const isTradingEnabled = useCallback((side) => {
    if (currentSpecialToken) {
      // Special token controls
      if (side === 'buy') {
        return currentSpecialToken.tradingControls?.buyEnabled !== false; // Default to true if not specified
      } else if (side === 'sell') {
        return currentSpecialToken.tradingControls?.sellEnabled !== false; // Default to true if not specified
      }
    } else {
      // Regular token controls - check if token has trading controls
      const [baseCurrency] = currentPair?.split('/') || [];
      const regularToken = availableTokens.find(token => token.symbol === baseCurrency);
      
      if (regularToken && regularToken.tradingControls) {
        if (side === 'buy') {
          return regularToken.tradingControls.buyEnabled !== false; // Default to true if not specified
        } else if (side === 'sell') {
          return regularToken.tradingControls.sellEnabled !== false; // Default to true if not specified
        }
      }
    }
    
    return true; // Default to enabled if no specific controls
  }, [currentSpecialToken, currentPair, availableTokens]);

  // Get sell price adjustment from either special token or regular token
  const getSellPriceAdjustment = useCallback(() => {
    if (currentSpecialToken) {
      return currentSpecialToken.tradingControls?.sellPriceAdjustment ?? 0;
    } else {
      // Check regular token
      const [baseCurrency] = currentPair?.split('/') || [];
      const regularToken = availableTokens.find(token => token.symbol === baseCurrency);
      
      if (regularToken && regularToken.tradingControls) {
        return regularToken.tradingControls.sellPriceAdjustment ?? 0;
      }
    }
    
    return 0; // Default to 0% if no adjustment configured
  }, [currentSpecialToken, currentPair, availableTokens]);

  // Get cached user buy price or current market price as fallback
  const getUserBuyPrice = useCallback((tokenSymbol) => {
    return userBuyPrices[tokenSymbol] || currentPairPrice;
  }, [userBuyPrices, currentPairPrice]);

  // Get maximum tradeable amount
  const getMaxTradeAmount = useCallback(() => {
    if (!currentPair || !currentPairPrice) return 0;
    
    const [baseCurrency, quoteCurrency] = currentPair.split('/');
    
    if (orderSide === 'buy') {
      // For buying, check USDT balance and divide by price
      const usdtBalance = getAvailableBalance(quoteCurrency);
      const price = orderType === 'limit' ? parseFloat(orderPrice) || currentPairPrice : currentPairPrice;
      
      if (amountInputType === 'usdt') {
        // If user wants to input USDT amount, max is the USDT balance
        return usdtBalance;
      } else {
        // If user wants to input token amount, max is USDT balance divided by price
        return usdtBalance / price;
      }
    } else {
      // For selling, check base currency balance (always in tokens)
      return getAvailableBalance(baseCurrency);
    }
  }, [currentPair, currentPairPrice, orderSide, orderType, orderPrice, getAvailableBalance, amountInputType]);

  // Convert between token amount and USDT amount
  const convertAmount = useCallback((amount, fromType, toType) => {
    if (!currentPairPrice || !amount || fromType === toType) return amount;
    
    let price;
    
    if (orderSide === 'sell') {
      // For selling: use user's actual buy price + admin-configured sell adjustment
      // Get sell adjustment from special token or regular coin settings
      const sellAdjustmentPercent = getSellPriceAdjustment(); // This is already in percentage form (10 = 10%)
      const sellAdjustmentDecimal = sellAdjustmentPercent / 100; // Convert to decimal (10 -> 0.10)
      
      // Get user's actual buy price or fallback to current market price
      const [baseCurrency] = currentPair.split('/');
      const buyPrice = getUserBuyPrice(baseCurrency);
      
      price = buyPrice * (1 + sellAdjustmentDecimal);
    } else {
      // For buying: use current market price or limit price
      price = orderType === 'limit' ? parseFloat(orderPrice) || currentPairPrice : currentPairPrice;
    }
    
    if (fromType === 'token' && toType === 'usdt') {
      return amount * price; // Token amount × price = USDT amount
    } else if (fromType === 'usdt' && toType === 'token') {
      return amount / price; // USDT amount ÷ price = Token amount
    }
    
    return amount;
  }, [currentPairPrice, orderType, orderPrice, orderSide, currentSpecialToken]);

  // Get the actual token amount for order placement
  const getTokenAmount = useCallback(() => {
    if (!orderAmount) return 0;
    
    const amount = parseFloat(orderAmount);
    if (amountInputType === 'usdt' && orderSide === 'buy') {
      // Convert USDT amount to token amount
      return convertAmount(amount, 'usdt', 'token');
    }
    
    // Otherwise, it's already in token amount
    return amount;
  }, [orderAmount, amountInputType, orderSide, convertAmount]);

  // Get the USDT value for display
  const getUSDTValue = useCallback(() => {
    if (!orderAmount) return 0;
    
    const amount = parseFloat(orderAmount);
    if (amountInputType === 'token') {
      // Convert token amount to USDT
      return convertAmount(amount, 'token', 'usdt');
    }
    
    // Otherwise, it's already in USDT
    return amount;
  }, [orderAmount, amountInputType, convertAmount]);

  // Get current order book data from trading context - prioritize real-time data
  const currentOrderBook = useMemo(() => {
    // First priority: Real-time order book (updates every second)
    if (realTimeOrderBook && (realTimeOrderBook.bids?.length > 0 || realTimeOrderBook.asks?.length > 0)) {
      return realTimeOrderBook;
    }
    
    // Second priority: Context order books
    return orderBooks[currentPair] || { bids: [], asks: [] };
  }, [realTimeOrderBook, orderBooks, currentPair]);

  // Generate simulated orderbook for any token when real data is not available - memoized
  const generateSimulatedOrderbook = useCallback((price, isSpecialToken = false, timeVariation = 0) => {
    if (!price || price <= 0) {
      return { bids: [], asks: [] };
    }

    let currentPrice, minPrice, maxPrice;
    
    if (isSpecialToken) {
      // For special tokens, use their specific price range
      currentPrice = price;
      minPrice = currentPrice * 0.8; // 20% below current
      maxPrice = currentPrice * 1.2; // 20% above current
    } else {
      // For regular cryptocurrencies, use the current market price
      currentPrice = price;
      minPrice = currentPrice * 0.95; // 5% below current
      maxPrice = currentPrice * 1.05; // 5% above current
    }
    
    // Use deterministic random generation with time variation for dynamic updates
    const baseSeed = Math.floor(currentPrice * 1000);
    const timeSeed = timeVariation; // Add time-based variation
    const seededRandom = (index) => {
      const x = Math.sin((baseSeed + timeSeed + index)) * 10000;
      return x - Math.floor(x);
    };
    
    // Generate asks (sell orders) - prices above current price
    const asks = [];
    const askStep = (maxPrice - currentPrice) / 25; // 25 levels
    for (let i = 1; i <= 25; i++) {
      const orderPrice = currentPrice + (askStep * i);
      // Add some variation to amounts based on time
      const baseAmount = isSpecialToken ? 
        seededRandom(i) * 1000 + 100 : // Special tokens: 100-1100 
        seededRandom(i) * 50 + 5; // Regular tokens: 5-55
      
      // Add small random variation (±10%) to make it more realistic
      const variation = (seededRandom(i + 100) - 0.5) * 0.2; // ±10%
      const amount = Math.max(baseAmount * (1 + variation), isSpecialToken ? 50 : 1);
      
      asks.push({
        price: orderPrice,
        amount: amount
      });
    }

    // Generate bids (buy orders) - prices below current price  
    const bids = [];
    const bidStep = (currentPrice - minPrice) / 25; // 25 levels
    for (let i = 1; i <= 25; i++) {
      const orderPrice = currentPrice - (bidStep * i);
      // Add some variation to amounts based on time
      const baseAmount = isSpecialToken ? 
        seededRandom(i + 10) * 1000 + 100 : // Special tokens: 100-1100 
        seededRandom(i + 10) * 50 + 5; // Regular tokens: 5-55
      
      // Add small random variation (±10%) to make it more realistic
      const variation = (seededRandom(i + 110) - 0.5) * 0.2; // ±10%
      const amount = Math.max(baseAmount * (1 + variation), isSpecialToken ? 50 : 1);
      
      bids.push({
        price: orderPrice,
        amount: amount
      });
    }

    return { bids, asks };
  }, []);

  // Generate simulated orderbook for special tokens - memoized
  const generateSpecialTokenOrderbook = useCallback((token) => {
    if (!token || !token.currentPrice) {
      return { bids: [], asks: [] };
    }
    const result = generateSimulatedOrderbook(token.currentPrice, true, orderBookVariation);
    return result;
  }, [generateSimulatedOrderbook, orderBookVariation]);

  // Get orderbook data - use generated data for special tokens, real data for regular tokens - memoized
  const getOrderBookData = useCallback(() => {
    if (currentSpecialToken) {
      // For special tokens, generate simulated orderbook with time variation
      return generateSpecialTokenOrderbook(currentSpecialToken);
    } else if (currentOrderBook && 
               currentOrderBook.bids && 
               currentOrderBook.asks && 
               (currentOrderBook.bids.length > 0 || currentOrderBook.asks.length > 0)) {
      // For regular tokens with real orderbook data, use it
      return currentOrderBook;
    } else if (currentPairPrice > 0) {
      // For regular tokens without real orderbook data, generate simulated data with time variation
      // Use a stable price to prevent constant re-generation but add time variation for realism
      const stablePrice = Math.round(currentPairPrice * 100) / 100; // Round to 2 decimals
      return generateSimulatedOrderbook(stablePrice, false, orderBookVariation);
    } else {
      // No data available
      return { bids: [], asks: [] };
    }
  }, [currentSpecialToken, currentOrderBook, currentPairPrice, generateSpecialTokenOrderbook, generateSimulatedOrderbook, currentPair, orderBookVariation]);

  // Memoize the display order book to prevent constant re-calculations
  const displayOrderBook = useMemo(() => {
    try {
      return getOrderBookData();
    } catch (error) {
      console.warn('Error generating order book data:', error);
      return { bids: [], asks: [] };
    }
  }, [getOrderBookData]);
  
  // Check if we have orderbook data to display (works for both real and simulated) - memoized
  const hasDisplayOrderBookData = useMemo(() => {
    const hasData = displayOrderBook && 
      Array.isArray(displayOrderBook.bids) && 
      Array.isArray(displayOrderBook.asks) && 
      (displayOrderBook.bids.length > 0 || displayOrderBook.asks.length > 0);
    
    return hasData;
  }, [displayOrderBook, currentPair, currentSpecialToken]);

  // Fetch special tokens on component mount with throttling
  useEffect(() => {
    if (!isInitialized) return;
    
    let timeoutId;
    
    // Throttle the initial fetch to prevent rapid calls
    timeoutId = setTimeout(() => {
      fetchSpecialTokens();
    }, 100);
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isInitialized]); // Only run when component is initialized

  // Fetch user balances when user changes with throttling
  useEffect(() => {
    
    // Only fetch if user is properly authenticated and component is initialized
    // Handle both user.id and user._id for compatibility
    const userId = user?.id || user?._id;
    if (!user || !userId || !isInitialized) {
      return;
    }
    
    let timeoutId;
    
    // Throttle the fetch to prevent rapid calls
    timeoutId = setTimeout(() => {
      fetchUserBalances();
      fetchUserOrders();
    }, 200);
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user, isInitialized]); // Add isInitialized to dependencies

  // Persist demo mode + load demo data when it changes
  useEffect(() => {
    localStorage.setItem('tradeDemo', isDemoMode ? 'true' : 'false');
    if (isDemoMode) {
      fetchDemoBalances();
      fetchDemoStats();
    }
  }, [isDemoMode]);

  // Also fetch when currentPair changes to ensure we have data with throttling
  useEffect(() => {
    if (!currentPair || specialTokens.length > 0) return;
    
    let timeoutId;
    
    // Throttle the fetch to prevent rapid calls when switching pairs
    timeoutId = setTimeout(() => {
      fetchSpecialTokens();
    }, 300);
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [currentPair]); // Remove fetchSpecialTokens from dependencies

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showOrderTypeDropdown && !event.target.closest('.order-type-dropdown')) {
        setShowOrderTypeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showOrderTypeDropdown]);

  // Fetch available tokens from database with improved caching and rate limiting
  useEffect(() => {
    if (!isInitialized) return;
    
    const fetchAvailableTokens = async () => {
      const cacheKey = 'availableTokens';
      const now = Date.now();
      
      // Check cache first (cache for 10 minutes)
      if (lastFetchTime.current[cacheKey] && now - lastFetchTime.current[cacheKey] < 600000) {
        // Use cached data if available
        const cachedTokens = JSON.parse(localStorage.getItem('availableTokensCache') || '[]');
        if (cachedTokens.length > 0) {
          setAvailableTokens(cachedTokens);
          setTokensLoaded(true);
          return;
        }
      }
      
      // Check if we have a recent request in flight
      if (requestCache.current.has(cacheKey)) {
        const { timestamp, promise } = requestCache.current.get(cacheKey);
        if (now - timestamp < 10000) { // 10 second deduplication
          return promise;
        }
      }

      const fetchPromise = (async () => {
        try {
          setTokensLoaded(false);
          
        // Check global rate limit before making request
        if (!checkRateLimit()) {
          // If rate limited, use cached data or wait
          const cachedTokens = JSON.parse(localStorage.getItem('availableTokensCache') || '[]');
          if (cachedTokens.length > 0) {
            setAvailableTokens(cachedTokens);
            setTokensLoaded(true);
            return;
          }
          // Wait 2 seconds before retrying if no cached data
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        const controller = new AbortController();
        abortControllers.current.set(cacheKey, controller);
        
        // Add delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));          // Fetch all available tokens (regular + special) from single endpoint
          const allTokensResponse = await ApiUtils.get('/market/all-tokens');
          let allTokens = [];
          
          if (allTokensResponse.data && allTokensResponse.data.success && allTokensResponse.data.data) {
            allTokens = allTokensResponse.data.data.map(token => ({
              symbol: token.symbol,
              name: token.name,
              type: token.isSpecial ? 'special' : 'regular',
              tradingControls: token.tradingControls // Include trading controls for both special and regular tokens
            }));
          }
          
          // Always include USDT as a quote currency if not already present
          const hasUSDT = allTokens.some(token => token.symbol === 'USDT');
          if (!hasUSDT) {
            allTokens.push({ symbol: 'USDT', type: 'stable' });
          }
          
          // Cache the data
          localStorage.setItem('availableTokensCache', JSON.stringify(allTokens));
          lastFetchTime.current[cacheKey] = now;
          
          setAvailableTokens(allTokens);
          setTokensLoaded(true);
          
          // Clean up
          abortControllers.current.delete(cacheKey);
          requestCache.current.delete(cacheKey);
          
        } catch (error) {
          // Silently handle token fetch errors - users may try unavailable pairs
          // Fallback to basic tokens if API fails - include more tokens to prevent validation issues
          const fallbackTokens = [
            { symbol: 'USDT', type: 'stable' },
            { symbol: 'BTC', type: 'regular' },
            { symbol: 'ETH', type: 'regular' },
            { symbol: 'ADA', type: 'regular' },
            { symbol: 'SOL', type: 'regular' },
            { symbol: 'DOT', type: 'regular' },
            { symbol: 'MATIC', type: 'regular' },
            { symbol: 'AVAX', type: 'regular' },
            { symbol: 'LINK', type: 'regular' },
            { symbol: 'UNI', type: 'regular' }
          ];
          setAvailableTokens(fallbackTokens);
          setTokensLoaded(true);
          requestCache.current.delete(cacheKey);
        }
      })();
      
      requestCache.current.set(cacheKey, { timestamp: now, promise: fetchPromise });
      return fetchPromise;
    };

    fetchAvailableTokens();
  }, [isInitialized]);

  // Get trading pair from URL params or location state (from market page)
  useEffect(() => {
    // Don't validate until component is initialized, tokens are loaded and we have meaningful token data
    if (!isInitialized || !tokensLoaded || !availableTokens.length) return;
    
    const pairFromUrl = searchParams.get('pair');
    const pairFromState = location.state?.selectedPair;
    
    // Validate trading pair against available tokens in database
    const validateTradingPair = (pair) => {
      if (!pair || typeof pair !== 'string') return false;
      
      const [base, quote] = pair.split('/');
      
      // Check if pair has valid format
      if (!base || !quote) return false;
      
      // Prevent same currency pairs (like USDT/USDT)
      if (base.toUpperCase() === quote.toUpperCase()) return false;
      
      // Additional validation: ensure it's not an invalid or nonsensical pair
      if (base.length < 2 || quote.length < 2) return false;
      
      // If we only have fallback tokens (less than 10), be more lenient
      if (availableTokens.length < 10) {
        // Allow any reasonable trading pair format
        return true;
      }
      
      // Check if both base and quote currencies exist in our database
      const baseExists = availableTokens.some(token => 
        token.symbol.toUpperCase() === base.toUpperCase()
      );
      const quoteExists = availableTokens.some(token => 
        token.symbol.toUpperCase() === quote.toUpperCase()
      );
      
      // If we can't find the tokens but the format looks valid, allow it
      // This handles cases where special tokens haven't loaded yet
      if (!baseExists || !quoteExists) {
        // Check against common trading pairs and special token patterns
        const isCommonPair = quote === 'USDT' && base.length >= 2 && base.length <= 10;
        return isCommonPair;
      }
      
      return true;
    };
    
    if (pairFromUrl && validateTradingPair(pairFromUrl)) {
      setCurrentPair(pairFromUrl);
    } else if (pairFromState && validateTradingPair(pairFromState)) {
      setCurrentPair(pairFromState);
    } else if (pairFromUrl && !validateTradingPair(pairFromUrl)) {
      // Only redirect if we have sufficient token data and the pair is clearly invalid
      // Also check if enough time has passed to prevent premature redirects
      if (availableTokens.length >= 10 && isInitialized) {
        // If invalid pair in URL, redirect to valid default
        // Find a valid default pair from available tokens
        const btcExists = availableTokens.some(token => token.symbol === 'BTC');
        const usdtExists = availableTokens.some(token => token.symbol === 'USDT');
        
        if (btcExists && usdtExists) {
          navigate('/trade?pair=BTC/USDT', { replace: true });
        } else {
          // Find any valid pair from available tokens
          const validPair = findValidDefaultPair();
          if (validPair) {
            navigate(`/trade?pair=${validPair}`, { replace: true });
          } else {
            navigate('/market', { replace: true }); // Redirect to market if no valid pairs
          }
        }
      } else {
        // If we don't have enough token data or component isn't ready, set the pair anyway and let it load
        setCurrentPair(pairFromUrl);
      }
    } else {
      // If no pair specified in URL or state, try to set a reasonable default
      // But only if we have loaded tokens and don't have a current pair set
      if (!currentPair && availableTokens.length > 0) {
        const defaultPair = findValidDefaultPair();
        if (defaultPair) {
          setCurrentPair(defaultPair);
        } else {
          // If we can't find a default pair, set BTC/USDT as fallback
          setCurrentPair('BTC/USDT');
        }
      }
    }
  }, [searchParams, location.state, setCurrentPair, navigate, tokensLoaded, availableTokens, isInitialized]);

  // Helper function to find a valid default trading pair
  const findValidDefaultPair = () => {
    if (availableTokens.length < 2) return null;
    
    // Try to find a pair with USDT as quote
    const usdtToken = availableTokens.find(token => token.symbol === 'USDT');
    if (usdtToken) {
      const otherToken = availableTokens.find(token => 
        token.symbol !== 'USDT' && 
        (token.type === 'regular' || token.type === 'special')
      );
      if (otherToken) {
        return `${otherToken.symbol}/USDT`;
      }
    }
    
    // Fallback: create any valid pair from available tokens
    for (let i = 0; i < availableTokens.length; i++) {
      for (let j = i + 1; j < availableTokens.length; j++) {
        const base = availableTokens[i];
        const quote = availableTokens[j];
        if (base.symbol !== quote.symbol) {
          return `${base.symbol}/${quote.symbol}`;
        }
      }
    }
    
    return null;
  };

  // Memoize price display to prevent unnecessary re-renders
  const priceDisplayData = useMemo(() => {
    if (!currentPairTicker) return null;
    
    return {
      priceChangePercent: currentPairTicker.priceChangePercent || 0,
      priceChange: currentPairTicker.priceChange || 0,
      isPositive: (currentPairTicker.priceChangePercent || 0) >= 0
    };
  }, [currentPairTicker?.priceChangePercent, currentPairTicker?.priceChange]);

  // 24h stats derived from chart data or ticker
  const stats24h = useMemo(() => {
    const src = chartData && chartData.length > 0 ? chartData.slice(-24) : [];
    return {
      high:    src.length > 0 ? Math.max(...src.map(d => d.high))  : (currentPairTicker?.highPrice  || 0),
      low:     src.length > 0 ? Math.min(...src.map(d => d.low))   : (currentPairTicker?.lowPrice   || 0),
      volCoin: src.length > 0 ? src.reduce((s, d) => s + (d.volume || 0), 0) : (currentPairTicker?.volume       || 0),
      volUsdt: src.length > 0 ? src.reduce((s, d) => s + (d.volume || 0) * (d.close || currentPairPrice), 0) : (currentPairTicker?.quoteVolume || 0),
    };
  }, [chartData, currentPairTicker, currentPairPrice]);

  // Only show order book if we have real data - check that arrays exist and have content
  const hasOrderBookData = currentOrderBook && 
    Array.isArray(currentOrderBook.bids) && 
    Array.isArray(currentOrderBook.asks) && 
    (currentOrderBook.bids.length > 0 || currentOrderBook.asks.length > 0);

  // Clear form when switching pairs
  useEffect(() => {
    setOrderAmount('');
    setOrderPrice('');
    setOrderPercentage(0);
    setAmountInputType('token'); // Reset to default
    // Clear chart data cache when switching pairs
    setChartDataCache({});
  }, [currentPair]);

  // Reset amount input type when switching from buy to sell
  useEffect(() => {
    // For sell orders, always use token amount (can't sell USDT amount worth of tokens)
    if (orderSide === 'sell') {
      setAmountInputType('token');
      // For sells, default to market order for instant execution
      setOrderType('market');
    } else {
      // For buys, also default to market order (no limit orders)
      setOrderType('market');
    }
  }, [orderSide]);



  // Auto-fill price for limit orders when price changes AND pair changes
  useEffect(() => {
    if (currentPairPrice && orderType === 'limit') {
      setOrderPrice(currentPairPrice.toString());
    }
  }, [currentPairPrice, orderType, currentPair]); // Added currentPair to dependencies

  // Enhanced chart data fetching with full historical data support and optimized caching
  useEffect(() => {
    if (!currentPair) return;

    // Clear any pending request
    if (chartDataRequestRef.current) {
      clearTimeout(chartDataRequestRef.current);
    }

    // Immediate fetch without debounce for faster loading when coming from Market.jsx
    const fetchChartData = async () => {
      // For all tokens, implement advanced caching and request deduplication
      const apiCacheKey = `chartData_${currentPair}_${selectedTimeframe}`;
      
      // Check if we have a recent request in flight
      if (requestCache.current.has(apiCacheKey)) {
        const { timestamp, promise } = requestCache.current.get(apiCacheKey);
        if (Date.now() - timestamp < 5000) { // 5 second deduplication
          const cachedResult = await promise;
          if (cachedResult) {
            setValidatedChartData(cachedResult);
          }
          return;
        }
      }
      
      const fetchPromise = (async () => {
        try {
          // Abort any existing request for this cache key
          if (abortControllers.current.has(apiCacheKey)) {
            abortControllers.current.get(apiCacheKey).abort();
          }
          
          const controller = new AbortController();
          abortControllers.current.set(apiCacheKey, controller);
          
          // Check localStorage cache first with shorter cache times for high-frequency trading
          const localCacheKey = `chartData_${currentPair}_${selectedTimeframe}`;
          const cachedData = localStorage.getItem(localCacheKey);
          const cacheTimestamp = localStorage.getItem(`${localCacheKey}_timestamp`);
          const now = Date.now();
          const cacheAge = now - (parseInt(cacheTimestamp) || 0);
          
          // Aggressive caching for high-volume scenarios
          const maxCacheAge = selectedTimeframe === '1m' ? 30000 : // 30 seconds for 1m
                              selectedTimeframe === '5m' ? 150000 : // 2.5 minutes for 5m
                              selectedTimeframe === '1h' ? 900000 : // 15 minutes for 1h
                              1800000; // 30 minutes for daily

          // Use cached data if fresh enough
          if (cachedData && cacheAge < maxCacheAge) {
            const parsedData = JSON.parse(cachedData);
            setChartData(parsedData);
            
            // Clean up
            abortControllers.current.delete(apiCacheKey);
            requestCache.current.delete(apiCacheKey);
            
            return parsedData;
          }

          // Fetch fresh data with optimized parameters
          const binanceInterval = selectedTimeframe === '1m'  ? '1m'  :
                                 selectedTimeframe === '5m'  ? '5m'  :
                                 selectedTimeframe === '15m' ? '15m' :
                                 selectedTimeframe === '1h'  ? '1h'  :
                                 selectedTimeframe === '4h'  ? '4h'  :
                                 selectedTimeframe === '1d'  ? '1d'  : '1m';

          // Fetch 3 months of data for better historical analysis
          const dataLimit = selectedTimeframe === '1m' ? 4320 :   // 3 days for 1m (4320 minutes)
                           selectedTimeframe === '5m' ? 2592 :    // 9 days for 5m (2592 * 5 = 12960 minutes)
                           selectedTimeframe === '1h' ? 2160 :    // 3 months for 1h (2160 hours = 90 days)
                           selectedTimeframe === '1d' ? 90 : 500; // 3 months for 1d (90 days)

          // Use backend API with compression and caching
          const response = await fetch(`/api/v1/candlesticks/klines/${currentPair.replace('/', '')}?interval=${binanceInterval}&limit=${dataLimit}`, {
            method: 'GET',
            signal: controller.signal,
            headers: {
              'Accept-Encoding': 'gzip, deflate, br',
              'Cache-Control': 'max-age=60' // Browser cache for 1 minute
            }
          });
          
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              const formattedData = result.data;

              // Cache with timestamp
              localStorage.setItem(localCacheKey, JSON.stringify(formattedData));
              localStorage.setItem(`${localCacheKey}_timestamp`, now.toString());
              
              setChartData(formattedData);
              
              // Clean up
              abortControllers.current.delete(apiCacheKey);
              requestCache.current.delete(apiCacheKey);
              
              return formattedData;
            }
          }

          // Fallback with timeout and compression
          const binanceApiUrl = import.meta.env.VITE_BINANCE_API_URL || 'https://api.binance.com/api/v3';
          const binanceResponse = await fetch(`${binanceApiUrl}/klines?symbol=${currentPair.replace('/', '')}&interval=${binanceInterval}&limit=100`, {
            signal: controller.signal,
            headers: {
              'Accept-Encoding': 'gzip, deflate'
            }
          });
          
          if (binanceResponse.ok) {
            const binanceData = await binanceResponse.json();
            const formattedData = binanceData.map(candle => ({
              time: Math.floor(candle[0] / 1000),
              open: parseFloat(candle[1]),
              high: parseFloat(candle[2]),
              low: parseFloat(candle[3]),
              close: parseFloat(candle[4]),
              volume: parseFloat(candle[5])
            }));
            
            // Cache the data
            localStorage.setItem(localCacheKey, JSON.stringify(formattedData));
            localStorage.setItem(`${localCacheKey}_timestamp`, now.toString());
            
            setChartData(formattedData);
            
            // Clean up
            abortControllers.current.delete(apiCacheKey);
            requestCache.current.delete(apiCacheKey);
            
            return formattedData;
          } else {
            // Silently handle chart data API failures
            
            // Use context fallback
            const existingData = getPriceHistory(currentPair, selectedTimeframe);
            if (existingData && existingData.length > 0) {
              setChartData(existingData);
              return existingData;
            }
            
            return null;
          }
        } catch (error) {
          if (error.name !== 'AbortError') {
            // Silently handle chart data fetch errors
          }
          
          // Clean up on error
          abortControllers.current.delete(apiCacheKey);
          requestCache.current.delete(apiCacheKey);
          
          // Fallback to cached or context data
          const existingData = getPriceHistory(currentPair, selectedTimeframe);
          if (existingData && existingData.length > 0) {
            setChartData(existingData);
            return existingData;
          }
          
          return null;
          }
        })();
        
        // Store the promise in cache for deduplication
        requestCache.current.set(apiCacheKey, {
          timestamp: Date.now(),
          promise: fetchPromise
        });
        
        const result = await fetchPromise;
        if (result) {
          setChartData(result);
        }
    };

    // Execute immediately without delay
    fetchChartData();

    return () => {
      if (chartDataRequestRef.current) {
        clearTimeout(chartDataRequestRef.current);
      }
    };
  }, [currentPair, selectedTimeframe, specialTokens, generateSimpleCandlestickData, getPriceHistory, candlestickData, candlestickLoading, currentPairPrice]);

  // Clear chart data when switching pairs or timeframes to prevent showing wrong data
  useEffect(() => {
    setChartData([]);
  }, [currentPair, selectedTimeframe]);

  // Trigger chart data fetch when special tokens are loaded or updated
  useEffect(() => {
    if (specialTokens.length > 0 && currentPair) {
      const isSpecialToken = specialTokens.some(token => `${token.symbol}/USDT` === currentPair);
      
      // If we're dealing with a special token and have no chart data, trigger a fetch
      if (isSpecialToken && chartData.length === 0) {
        // The main useEffect will handle the actual fetching
      }
    }
  }, [specialTokens, currentPair, chartData.length]);

  // Trigger chart data fetch when chart is opened
  useEffect(() => {
    if (showChart && currentPair && chartData.length === 0) {
      // The main fetchChartData useEffect will be triggered by dependency changes
    }
  }, [showChart, currentPair, chartData.length]);

  // Enhanced initial data load with full historical support
  useEffect(() => {
    if (currentPair && chartData.length === 0) {
      
      const isSpecialToken = specialTokens.some(token => `${token.symbol}/USDT` === currentPair);
      
      if (!isSpecialToken) {
        // For real cryptocurrencies, fetch full historical data immediately
        
        const loadHistoricalData = async () => {
          try {
            // Check cache first
            const cacheKey = `chartData_${currentPair}_${selectedTimeframe}`;
            const cachedData = localStorage.getItem(cacheKey);
            
            if (cachedData) {
              const parsedData = JSON.parse(cachedData);
              setChartData(parsedData);
            }

            // Get Binance interval
            const binanceInterval = selectedTimeframe === '1m'  ? '1m'  :
                                   selectedTimeframe === '5m'  ? '5m'  :
                                   selectedTimeframe === '15m' ? '15m' :
                                   selectedTimeframe === '1h'  ? '1h'  :
                                   selectedTimeframe === '4h'  ? '4h'  :
                                   selectedTimeframe === '1d'  ? '1d'  : '1m';

            // Fetch comprehensive historical data (up to 150 candles) from backend first
            const response = await fetch(`/api/v1/candlesticks/klines/${currentPair.replace('/', '')}?interval=${binanceInterval}&limit=150`);
            
            if (response.ok) {
              const result = await response.json();
              if (result.success && result.data) {
                const formattedData = result.data;

                
                // Cache for future page loads
                localStorage.setItem(cacheKey, JSON.stringify(formattedData));
                localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
                
                setChartData(formattedData);
                return;
              }
            }

            // Fallback to direct Binance API
            const binanceApiUrl = import.meta.env.VITE_BINANCE_API_URL || 'https://api.binance.com/api/v3';
            const binanceResponse = await fetch(`${binanceApiUrl}/klines?symbol=${currentPair.replace('/', '')}&interval=${binanceInterval}&limit=150`);
            
            if (binanceResponse.ok) {
              const binanceData = await binanceResponse.json();
              const formattedData = binanceData.map(candle => ({
                time: Math.floor(candle[0] / 1000),
                open: parseFloat(candle[1]),
                high: parseFloat(candle[2]),
                low: parseFloat(candle[3]),
                close: parseFloat(candle[4]),
                volume: parseFloat(candle[5])
              }));

              
              // Cache for future page loads
              localStorage.setItem(cacheKey, JSON.stringify(formattedData));
              localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
              
              setChartData(formattedData);
            }
          } catch (error) {
            // Silently handle initial historical data fetch failures
            // Fallback to context if available
            const contextData = getPriceHistory(currentPair, selectedTimeframe);
            if (contextData && contextData.length > 0) {
              setChartData(contextData);
            }
          }
        };

        loadHistoricalData();
      }
    }
  }, [currentPair, chartData.length, selectedTimeframe, specialTokens, getPriceHistory]);

  // Update chart data when real-time price history changes - preserve historical data for 1m
  useEffect(() => {
    if (!currentPair) return;
    
    const isSpecialToken = specialTokens.some(token => `${token.symbol}/USDT` === currentPair);
    
    // Only update for real cryptocurrencies, not special tokens
    if (!isSpecialToken) {
      const realTimeChartData = getPriceHistory(currentPair, selectedTimeframe);
      
      // For 1m timeframe, don't override with real-time data if we have less than 50 candles
      // This prevents the single candle issue while allowing other timeframes to update normally
      if (selectedTimeframe === '1m') {
        // Only update if we get substantial data (more than 50 candles) or if we have no existing data
        if (realTimeChartData && realTimeChartData.length > 50) {
          setChartData(realTimeChartData);
        } else if (!chartData || chartData.length === 0) {
          // Only set if we have no existing data
          setChartData(realTimeChartData || []);
        } else {
          // Keep existing historical data for 1m timeframe
        }
      } else {
        // For other timeframes (5m, 1h, 1d), update normally
        if (realTimeChartData && realTimeChartData.length > 0) {
          setChartData(realTimeChartData);
        } else {
          // Don't clear existing data immediately, only if we really have no data
          if (!chartData || chartData.length === 0) {
            setChartData([]);
          }
        }
      }
    }
  }, [allPriceHistory, currentPair, selectedTimeframe, specialTokens, getPriceHistory]);

  // Handle candlestick data from the hook for all tokens (including special tokens)
  useEffect(() => {
    if (!currentPair || !candlestickData) return;

    // Use real candlestick data for all tokens when available
    if (candlestickData.length > 0) {
      setChartData(candlestickData);
    }
  }, [candlestickData, currentPair]);

  // Live candle updates via WebSocket for special tokens
  useEffect(() => {
    if (!currentPair) return;

    const isSpecialToken = specialTokens.some(token => `${token.symbol}/USDT` === currentPair);
    if (!isSpecialToken) return;

    // Import WebSocket service dynamically to avoid circular imports
    import('../../services/websocket').then(({ default: websocketService }) => {
      const handleCandleUpdate = (candleData) => {
        
        // Check if this candle update is for the current pair and timeframe
        if (candleData.pair === currentPair && candleData.timeframe === selectedTimeframe) {
          // Validate candle data before processing
          if (!candleData || 
              candleData.open === null || candleData.open === undefined ||
              candleData.high === null || candleData.high === undefined ||
              candleData.low === null || candleData.low === undefined ||
              candleData.close === null || candleData.close === undefined ||
              isNaN(candleData.open) || isNaN(candleData.high) || isNaN(candleData.low) || isNaN(candleData.close)) {
            console.warn('🚨 WebSocket: Invalid candle data received, skipping update:', candleData);
            return;
          }

          setChartData(prevData => {
            const newData = [...prevData];
            const candleTime = candleData.time;
            
            // Find if we already have this candle
            const existingIndex = newData.findIndex(candle => candle.time === candleTime);
            
            const newCandle = {
              time: candleTime,
              open: candleData.open,
              high: candleData.high,
              low: candleData.low,
              close: candleData.close,
              volume: candleData.volume
            };
            
           
            if (existingIndex >= 0) {
              // Update existing candle
              newData[existingIndex] = newCandle;
            } else {
              // Add new candle and maintain chronological order
              newData.push(newCandle);
              newData.sort((a, b) => a.time - b.time);
              
              // Keep only last 500 candles to prevent memory issues
              if (newData.length > 500) {
                newData.splice(0, newData.length - 500);
              }
            }
            
            return newData;
          });
        }
      };

      // Subscribe to candle updates - use the correct event name and general subscription
      websocketService.subscribeToGeneral('candleUpdate', handleCandleUpdate);

      // Subscribe to special token price updates for real-time price changes
      const handleSpecialTokenPriceUpdate = (data) => {
        if (data.tokens && Array.isArray(data.tokens)) {
          data.tokens.forEach(token => {
            // Check if this update is for the current pair
            const tokenPair = `${token.symbol}/USDT`;
            if (tokenPair === currentPair && currentSpecialToken) {
              // Update the current price in context and local state immediately
              setCurrentPairPrice(token.currentPrice);
              
              // Force a small UI update to trigger re-render
              setLastPriceUpdate(Date.now());
            }
          });
        }
      };

      websocketService.subscribeToGeneral('specialTokenPriceUpdate', handleSpecialTokenPriceUpdate);

      // Cleanup function
      return () => {
        // For general subscriptions, we need to use a different cleanup
        if (websocketService.socket) {
          websocketService.socket.off('candleUpdate', handleCandleUpdate);
          websocketService.socket.off('specialTokenPriceUpdate', handleSpecialTokenPriceUpdate);
        }
      };
    }).catch(error => {
      console.warn('Failed to set up live candle updates:', error);
    });
  }, [currentPair, selectedTimeframe, specialTokens]);

  // Memory and performance cleanup effect
  useEffect(() => {
    return () => {
      // Cancel all pending requests when component unmounts
      abortControllers.current.forEach(controller => {
        controller.abort();
      });
      abortControllers.current.clear();
      requestCache.current.clear();
      
      // Clear timeouts
      if (chartDataRequestRef.current) {
        clearTimeout(chartDataRequestRef.current);
      }
    };
  }, []);

  const handlePlaceOrder = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Check if current token has trading restrictions FIRST - before any other validations
    const [baseCurrency] = currentPair.split('/');
    
    // Use the existing isTradingEnabled function for consistent validation
    if (!isTradingEnabled(orderSide)) {
      const tokenName = currentSpecialToken?.name || currentSpecialToken?.symbol || baseCurrency;
      const action = orderSide === 'buy' ? 'Buy' : 'Sell';
      showToast.error(`${action} is currently disabled for ${tokenName}`);
      return;
    }

    try {
      setLoadingOrder(true);
      clearError();
      
      if (!orderAmount || (!orderPrice && orderType === 'limit')) {
        if (!orderAmount) {
          showToast.warning('Please enter an amount to trade');
        } else if (!orderPrice && orderType === 'limit') {
          showToast.warning('Please set a price for your limit order');
        }
        return;
      }

      // Get the actual token amount for the order
      const tokenAmount = getTokenAmount();
      const usdtValue = getUSDTValue();
      
      if (tokenAmount <= 0) {
        showToast.warning('Please enter a valid trading amount');
        return;
      }

      // Check if user has sufficient balance
      const [baseCurrency, quoteCurrency] = currentPair.split('/');
      let requiredCurrency, requiredAmount;
      
      if (orderSide === 'buy') {
        requiredCurrency = quoteCurrency; // USDT
        // For buy orders, use the exact USDT value the user intended to spend
        requiredAmount = usdtValue; // Use the calculated USDT value directly
      } else {
        requiredCurrency = baseCurrency; // The token being sold
        requiredAmount = tokenAmount; // Token amount required
      }

      const availableBalance = getAvailableBalance(requiredCurrency);
      
      // Add tolerance for floating-point precision issues (1e-6 = 0.000001)
      const tolerance = 1e-6;
      const hasInsufficientBalance = (availableBalance + tolerance) < requiredAmount;
      
      if (hasInsufficientBalance) {
        const action = orderSide === 'buy' ? 'buy' : 'sell';
        showToast.error(`Insufficient ${requiredCurrency} balance to ${action}. You need ${requiredAmount.toFixed(5)} ${requiredCurrency} but only have ${availableBalance.toFixed(5)} available.`);
        return;
      }

      // Send the correct data format to backend
      const orderData = {
        pair: currentPair,
        side: orderSide,
        type: orderType,
        amount: tokenAmount, // Token amount to trade
        usdtValue: usdtValue, // Exact USDT value for the trade (what should be deducted for buys)
        price: orderType === 'limit' ? parseFloat(orderPrice) : currentPairPrice, // Always send current market price
        marketPrice: currentPairPrice, // Send the real-time market price from frontend
        // Additional field to clarify the user's intention
        userInputType: amountInputType, // 'token' or 'usdt'
        userInputAmount: parseFloat(orderAmount) // Original amount the user entered
      };
      
      // Try to refresh session before trading if session status is problematic
      if (sessionStatus === 'unauthenticated' && user) {
        
        // Try a quick session check first
        try {
          const authCheck = await ApiUtils.get('/user/me');
        } catch (authError) {
          showToast.error('Session expired. Please log in again.');
          // Optionally redirect to login or trigger re-auth
          return;
        }
      }

      // Route to demo or real endpoint
      const endpoint = isDemoMode ? '/demo-trading/orders' : '/trading/orders';
      const response = await ApiUtils.post(endpoint, orderData);

      if (response.success) {
        const tokenName = currentPair.split('/')[0];
        const orderAction = orderSide === 'buy' ? 'purchased' : 'sold';
        const isSpecialToken = specialTokens.some(token => token.symbol === tokenName);

        const displayTokenAmount = response.data?.amount || tokenAmount;
        const displayUSDTValue = response.data?.total || response.data?.usdtReceived || getUSDTValue();
        const actualValueMessage = orderSide === 'sell' && response.data?.usdtReceived
          ? `$${formatNumber(response.data.usdtReceived)}`
          : `$${formatNumber(displayUSDTValue)}`;

        if (isDemoMode) {
          const pl = response.data?.profitLoss;
          const plMsg = pl != null && orderSide === 'sell'
            ? ` · P/L: ${pl >= 0 ? '+' : ''}$${pl.toFixed(2)}`
            : '';
          showToast.success(`[DEMO] ${orderAction.charAt(0).toUpperCase() + orderAction.slice(1)} ${formatNumber(displayTokenAmount)} ${tokenName} for ${actualValueMessage}${plMsg}`);
        } else if (isSpecialToken) {
          showToast.success(`🎉 Successfully ${orderAction} ${formatNumber(displayTokenAmount)} ${tokenName} for ${actualValueMessage}! Your trade is complete.`);
        } else {
          showToast.success(`✅ Order executed! You've successfully ${orderAction} ${formatNumber(displayTokenAmount)} ${tokenName} for ${actualValueMessage}.`);
        }

        // Reset form
        setOrderAmount('');
        setAmountInputType('token');
        if (orderType === 'limit') setOrderPrice(currentPairPrice.toString());
        setOrderPercentage(0);

        if (isDemoMode) {
          // Refresh demo balances + stats
          await fetchDemoBalances();
          fetchDemoStats();
        } else {
          // Refresh real balances
          Promise.all([fetchUserBalances(), refreshProfile()]).catch(() => {});
          setTimeout(async () => {
            try { await Promise.all([fetchUserBalances(), refreshProfile(), fetchUserOrders()]); } catch (e) { /* ignore */ }
          }, 2000);
        }
      } else {
        let errorMessage = response.error || 'Failed to place order';
        if (errorMessage.includes('disabled')) {
          const action = orderSide === 'buy' ? 'Buy' : 'Sell';
          showToast.error(`${action} is disabled for ${currentPair.split('/')[0]}`);
        } else if (errorMessage.includes('Insufficient')) {
          showToast.error(`💰 ${errorMessage}`);
        } else {
          showToast.error(errorMessage);
        }
      }

    } catch (error) {
      // Silently handle order placement errors, user will see toast notification
      showToast.error('Something went wrong while placing your order. Please try again.');
    } finally {
      setLoadingOrder(false);
    }
  };

  const handlePercentageClick = (percentage) => {
    setOrderPercentage(percentage);
    
    const maxAmount = getMaxTradeAmount();
    if (maxAmount > 0) {
      const calculatedAmount = (maxAmount * percentage / 100);
      setOrderAmount(calculatedAmount.toFixed(2));
    }
  };

  const formatNumber = (num, decimals = 2) => {
    if (!num || num === 0 || isNaN(num)) return '0.00';
    
    // Always use exactly 2 decimal places for trading amounts
    return parseFloat(num).toFixed(2);
  };

  const formatPrice = (price) => {
    if (!price || price === 0 || isNaN(price)) return '0.00';
    
    // Format larger numbers appropriately
    if (price >= 10000) {
      return Math.round(price).toLocaleString(); // Show as 50,000
    } else if (price >= 1000) {
      return price.toFixed(0); // Show as 3000
    } else {
      return parseFloat(price).toFixed(2); // Show as 105.50
    }
  };

  return (
    <>
    <div className="min-h-screen w-full relative overflow-hidden" style={meshBg}>

      {/* Loading Screen */}
      {isPageLoading && <Spinner />}

      {/* Only show main content when fully loaded */}
      {!isPageLoading && isInitialized && tokensLoaded && (
        <div className="max-w-md mx-auto relative z-10">
          {/* Header Section */}
          <div className="px-4 py-6 relative z-10">
        <header className="mb-6">
          {/* Navigation tabs row */}
          <div className="flex items-center mb-6">
            <div className="flex items-center flex-1">
              {[
                { key: 'spot',    label: t('trade.spotTab')    || 'Spot' },
                { key: 'trade',   label: t('trade.tradeTab')   || 'Trade' },
                { key: 'convert', label: t('trade.convertTab') || 'Convert' },
                { key: 'alpha',   label: t('trade.alphaTab')   || 'Alpha' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setTradeTab(tab.key)}
                  className={`py-1 mr-6 text-sm font-semibold transition-colors duration-200 ${
                    tradeTab === tab.key ? 'text-[#0052FF]' : 'text-[#888888]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button className="flex items-center text-[#555555] hover:text-[#0052FF] transition-colors">
              <AlignJustify className="w-5 h-5" />
            </button>
          </div>

          {/* Trading Pair Info */}
          <div className="mb-6">
            {/* Row 1: Pair name + icons */}
            <div className="flex items-center justify-between mb-3">
              <button
                className="flex items-center gap-1.5 group"
                onClick={() => navigate('/market')}
              >
                <h2 className="text-xl font-bold text-[#111111] group-hover:text-[#0052FF] transition-colors">
                  {currentPair || 'BTC/USDT'}
                </h2>
                <ChevronDown className="w-4 h-4 text-[#555555] group-hover:text-[#0052FF] transition-colors" />
              </button>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowChart(prev => !prev)}
                  className={`md:hidden transition-colors ${showChart ? 'text-[#0052FF]' : 'text-[#555555] hover:text-[#0052FF]'}`}
                >
                  <MdOutlineCandlestickChart className="w-6 h-6" />
                </button>
                <button
                  onClick={() => currentPair && toggleFavorite(currentPair.split('/')[0])}
                  className="transition-colors"
                >
                  <Star className={`w-5 h-5 transition-colors duration-200 ${
                    favorites.includes(currentPair?.split('/')[0])
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-[#CCCCCC]'
                  }`} />
                </button>
                <button
                  onClick={() => setShowRightPanel(true)}
                  className="text-[#555555] hover:text-[#0052FF] transition-colors"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>
            {/* Row 2: Price + 24h change */}
            <div className="flex items-baseline gap-3">
              <span className={`text-2xl font-bold transition-all duration-200 ${
                Date.now() - lastPriceUpdate < 2000 ? 'text-[#0052FF]' : 'text-[#111111]'
              }`}>
                ${formatPrice(currentPairPrice)}
              </span>
              {priceDisplayData && (
                <span className={`text-sm font-semibold ${priceDisplayData.isPositive ? 'text-green-500' : 'text-red-500'}`}>
                  {priceDisplayData.isPositive ? '+' : ''}{priceDisplayData.priceChangePercent?.toFixed(2) || '0.00'}%
                </span>
              )}
              {priceDisplayData && (
                <span className="text-xs text-[#888888]">{t('trade.24hLabel')}</span>
              )}
            </div>
          </div>
        </header>
        </div>

        {/* Main Content */}
      <div className="relative z-10 pb-24">

        {/* ── Demo Mode Banner ─────────────────────────────────────────── */}
        {isDemoMode && (
          <div className="flex items-center justify-between px-4 py-2 bg-[#0052FF]">
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-white shrink-0" />
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-white tracking-wide">DEMO</span>
                <span className="text-xs text-white/70">
                  ${(demoBalances?.USDT?.available ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT
                </span>
                {demoStats?.totalTrades > 0 && (
                  <>
                    <span className="text-white/40 text-xs">·</span>
                    <span className="text-xs text-white/70">{demoStats.totalTrades} trades</span>
                    <span className="text-white/40 text-xs">·</span>
                    <span className={`text-xs font-semibold ${demoStats.totalProfitLoss >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                      {demoStats.totalProfitLoss >= 0 ? '+' : ''}${demoStats.totalProfitLoss.toFixed(2)}
                    </span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={() => setIsDemoMode(false)}
              className="text-xs font-semibold text-[#0052FF] bg-white hover:bg-[#F0F5FF] px-3 py-1 rounded-full transition-colors shrink-0"
            >
              Exit Demo
            </button>
          </div>
        )}

        {/* Error Display matching Market.jsx style but keeping original structure */}
        {error && (
          <div className="mb-6 bg-red-500/40 border border-red-500/50 p-4">
            <div className="relative z-10 flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-red-500">{t('common.error')}</h3>
                <p className="text-sm text-red-500/80">{error}</p>
              </div>
              <Button
                onClick={clearError}
                variant="ghost"
                size="sm"
                className="w-8 h-8 text-red-500 hover:bg-red-500/10 rounded-lg"
              >
                <XCircleIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
        {/* Trading Section */}
        <div className="grid grid-cols-2 gap-1 px-2">
            {/* Left Column - Buy/Sell Order Form */}
            <div className="p-4">
              {/* Buy/Sell Toggle */}
              <div className="flex mb-3">
                <div className={`flex-1 rounded-l-full overflow-hidden relative ${orderSide === 'buy' ? 'z-10' : 'z-0'}`}>
                  <button
                    onClick={() => setOrderSide('buy')}
                    style={{
                      clipPath: orderSide === 'buy'
                        ? 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)'
                        : 'polygon(0 0, 100% 0, calc(100% - 12px) 50%, 100% 100%, 0 100%)'
                    }}
                    className={`w-full py-1 font-bold text-sm transition-all duration-200 ${
                      orderSide === 'buy'
                        ? 'bg-green-800 text-white'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {t('trade.buy')}
                  </button>
                </div>
                <div className={`flex-1 rounded-r-full overflow-hidden relative -ml-3 ${orderSide === 'sell' ? 'z-10' : 'z-0'}`}>
                  <button
                    onClick={() => setOrderSide('sell')}
                    style={{
                      clipPath: orderSide === 'sell'
                        ? 'polygon(12px 0, 100% 0, 100% 100%, 12px 100%, 0 50%)'
                        : 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 12px 50%)'
                    }}
                    className={`w-full py-1 font-bold text-sm transition-all duration-200 ${
                      orderSide === 'sell'
                        ? 'bg-red-800 text-white'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {t('trade.sell')}
                  </button>
                </div>
              </div>

              {/* Order Type Dropdown */}
              <div className="relative mb-3 z-50">
                <button
                  onClick={() => setShowOrderTypeDropdown(prev => !prev)}
                  className="w-full flex items-center justify-between px-3 py-1.5 bg-[#F5F5F5] rounded-lg text-sm font-medium text-[#111111] border border-[#E8E8E8]"
                >
                  <span>
                    {orderType === 'market' ? 'Market'
                      : orderType === 'limit' ? 'Limit'
                      : orderType === 'stop-limit' ? 'Stop Limit'
                      : 'Stop Market'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-[#888888] transition-transform duration-200 ${showOrderTypeDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showOrderTypeDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-[#F0F0F0] z-20 overflow-hidden">
                    {[
                      { key: 'market', label: 'Market' },
                      { key: 'limit', label: 'Limit' },
                      { key: 'stop-limit', label: 'Stop Limit' },
                      { key: 'stop-market', label: 'Stop Market' },
                    ].map((type) => (
                      <button
                        key={type.key}
                        onClick={() => { setOrderType(type.key); setShowOrderTypeDropdown(false); }}
                        className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                          orderType === type.key
                            ? 'bg-[#F0F5FF] text-[#0052FF] font-semibold'
                            : 'text-[#111111] hover:bg-[#F5F5F5]'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Price Input (limit / stop orders) */}
              {(orderType === 'limit' || orderType === 'stop-limit' || orderType === 'stop-market') && (
                <div className="mb-3">
                  <label className="block text-xs text-[#888888] mb-1">{t('trade.price')}</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={orderPrice}
                      onChange={(e) => setOrderPrice(e.target.value)}
                      placeholder={formatPrice(currentPairPrice)}
                      className="w-full bg-[#F9F9F9] rounded-lg px-3 py-2 pr-14 text-sm text-[#111111] placeholder-[#AAAAAA] focus:outline-none focus:ring-2 focus:ring-[#0052FF]/30 border border-[#E8E8E8] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#888888] font-medium">USDT</span>
                  </div>
                </div>
              )}

              {/* Amount Input */}
              <div className="mb-3 relative z-30">
                <label className="block text-xs text-[#888888] mb-1">Total</label>
                <div className="flex items-center bg-[#F5F5F5] rounded-lg border border-[#E8E8E8]">
                  <input
                    type="number"
                    value={orderAmount}
                    onChange={(e) => setOrderAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-3/5 min-w-0 bg-transparent px-2 text-sm font-light text-[#111111] placeholder-[#AAAAAA] focus:outline-none font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  {orderSide === 'buy' ? (
                    <div className="relative w-2/5 border-l border-[#E8E8E8]">
                      <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); setShowAmountTypeDropdown(v => !v); }}
                        className="w-full flex items-center justify-center px-2 py-2 text-sm font-medium text-[#111111] transition-colors"
                      >
                        <span>{amountInputType === 'token' ? currentPair.split('/')[0] : 'USDT'}</span>
                        <ChevronDown className={`w-4 h-4 text-[#888888] transition-transform duration-200 ${showAmountTypeDropdown ? 'rotate-180' : ''}`} />
                      </button>
                      {showAmountTypeDropdown && (
                        <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-[#F0F0F0] z-50 overflow-hidden">
                          {[
                            { key: 'token', label: currentPair.split('/')[0] },
                            { key: 'usdt',  label: 'USDT' },
                          ].map(opt => (
                            <button
                              key={opt.key}
                              type="button"
                              onMouseDown={(e) => { e.preventDefault(); setAmountInputType(opt.key); setShowAmountTypeDropdown(false); }}
                              className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                                amountInputType === opt.key ? 'bg-[#F0F5FF] text-[#0052FF] font-semibold' : 'text-[#111111] hover:bg-[#F5F5F5]'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="shrink-0 px-3 py-2 text-sm font-medium text-[#888888] border-l border-[#E8E8E8]">
                      {currentPair.split('/')[0]}
                    </span>
                  )}
                </div>
                {orderAmount && orderSide === 'buy' && currentPairPrice > 0 && (
                  <div className="mt-1 text-xs text-[#888888]">
                    {amountInputType === 'token'
                      ? `≈ ${getUSDTValue().toFixed(2)} USDT`
                      : `≈ ${getTokenAmount().toFixed(2)} ${currentPair.split('/')[0]}`}
                  </div>
                )}
              </div>


              {/* Percentage Stepper */}
              <div className="mb-4">
                {/* Track + dots row */}
                <div className="relative flex items-center justify-between h-5">
                  {/* Gray track — inset by half-dot (5px) on each side */}
                  <div className="absolute h-0.5 bg-[#E8E8E8] rounded-full" style={{ left: 5, right: 5 }} />
                  {/* Colored fill */}
                  <div
                    className={`absolute h-0.5 rounded-full transition-all duration-150 ${orderSide === 'buy' ? 'bg-green-800' : 'bg-red-800'}`}
                    style={{ left: 5, width: `calc(${orderPercentage}% - 10px * ${orderPercentage} / 100)` }}
                  />
                  {/* Transparent draggable range input — handles any value 0-100 */}
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={orderPercentage}
                    onChange={(e) => handlePercentageClick(Number(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 appearance-none"
                  />
                  {/* Dot markers — z-20 so they sit above the range input for click snapping */}
                  {[0, 25, 50, 75, 100].map((tick) => {
                    const filled  = orderPercentage >= tick;
                    const current = orderPercentage === tick;
                    const color   = orderSide === 'buy' ? '#166534' : '#991b1b';
                    return (
                      <button
                        key={tick}
                        onClick={(e) => { e.stopPropagation(); handlePercentageClick(tick); }}
                        className="relative z-20 flex items-center justify-center transition-all duration-150 pointer-events-auto"
                        style={{ width: current ? 14 : 10, height: current ? 14 : 10 }}
                      >
                        <div
                          className="rounded-full transition-all duration-150"
                          style={{
                            width:  current ? 14 : 10,
                            height: current ? 14 : 10,
                            background: filled ? color : '#fff',
                            border: `2px solid ${filled ? color : '#D1D5DB'}`,
                            boxShadow: current ? `0 0 0 3px ${orderSide === 'buy' ? '#bbf7d0' : '#fecaca'}` : 'none',
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
                {/* Selected % label */}
                <div className="relative h-4 mt-0.5">
                  <span
                    className={`absolute text-[11px] font-bold transition-all duration-300 ${
                      orderSide === 'buy' ? 'text-green-800' : 'text-red-800'
                    }`}
                    style={{
                      left: orderPercentage === 0 ? '0%' : orderPercentage === 100 ? '100%' : `${orderPercentage}%`,
                      transform: orderPercentage === 0 ? 'translateX(0)' : orderPercentage === 100 ? 'translateX(-100%)' : 'translateX(-50%)',
                    }}
                  >
                    {orderPercentage}%
                  </span>
                </div>
              </div>

              {/* Available Balance */}
              <div className="text-xs text-[#888888] mb-4">
                <div className="flex justify-between items-center mb-1">
                  <span>{t('withdraw.available').replace(':', '')}</span>
                  <span className="font-mono text-[#555555]">
                    {(() => {
                      if (!currentPair) return '-- --';
                      const [baseCurrency, quoteCurrency] = currentPair.split('/');
                      
                      if (orderSide === 'buy') {
                        // For buying, always show USDT balance (what user needs to spend)
                        const usdtBalance = getAvailableBalance(quoteCurrency);
                        return `${usdtBalance.toFixed(2)} ${quoteCurrency}`;
                      } else {
                        // For selling, show the token balance
                        const tokenBalance = getAvailableBalance(baseCurrency);
                        return `${tokenBalance.toFixed(5)} ${baseCurrency}`;
                      }
                    })()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{t('withdraw.maxAmount')}</span>
                  <span className="font-mono text-[#555555]">
                    {(() => {
                      const maxAmount = getMaxTradeAmount();
                      const currency = orderSide === 'buy' && amountInputType === 'usdt' ? 'USDT' : currentPair.split('/')[0];
                      const decimals = orderSide === 'buy' && amountInputType === 'usdt' ? 2 : 6;
                      return `${maxAmount.toFixed(decimals)} ${currency}`;
                    })()}
                  </span>
                </div>
              </div>

              {/* Place Order Button */}
              <Button
                onClick={user ? handlePlaceOrder : () => navigate('/login')}
                disabled={
                  user && (
                    loadingOrder || 
                    !orderAmount || 
                    (orderType === 'limit' && !orderPrice)
                  )
                }
                className={`w-full py-3 font-bold text-sm transition-colors ${
                  !user
                    ? 'bg-[#0052FF]/10 hover:bg-[#0052FF]/20 text-[#111111]'
                    : orderSide === 'buy'
                      ? 'bg-green-800 text-white hover:bg-green-600'
                      : 'bg-red-800 text-white hover:bg-red-600'
                } ${loadingOrder ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loadingOrder ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border border-white border-t-transparent animate-spin"></div>
                    {t('common.loading')}
                  </div>
                ) : !user ? t('common.login')
                    : `${orderSide === 'buy' ? t('trade.buy') : t('trade.sell')} ${currentPair.split('/')[0]}`}
              </Button>
            </div>

            {/* Right Column - Order Book */}
            <div className="p-2">
              <div className="flex justify-between text-[10px] font-semibold text-[#AAAAAA] uppercase tracking-wide mb-2 px-1">
                <span>Price</span><span>Qty</span>
              </div>
              {hasDisplayOrderBookData ? (
                <>
                  <div className="space-y-px mb-1">
                    {(() => {
                      const asks = displayOrderBook.asks?.slice(0, 6).reverse() || [];
                      const maxAmt = Math.max(...asks.map(a => a.amount), 1);
                      return asks.map((ask, i) => (
                        <div key={i} className="relative h-5 flex items-center justify-between px-1 overflow-hidden rounded-sm">
                          <div className="absolute inset-y-0 right-0 bg-red-500/10 transition-all duration-300" style={{ width: `${(ask.amount / maxAmt) * 100}%` }} />
                          <span className="relative text-[11px] font-mono font-semibold text-red-500">{formatPrice(ask.price)}</span>
                          <span className="relative text-[11px] font-mono text-[#999999]">{formatNumber(ask.amount, 2)}</span>
                        </div>
                      ));
                    })()}
                  </div>
                  <div className="flex items-center justify-between px-2 py-1.5 my-1 bg-[#F5F5F5] rounded-lg">
                    <span className="text-xs font-bold font-mono text-[#111111]">${formatPrice(currentSpecialToken?.currentPrice || currentPairPrice)}</span>
                    {priceDisplayData && (
                      <span className={`text-[10px] font-semibold ${priceDisplayData.isPositive ? 'text-green-500' : 'text-red-500'}`}>
                        {priceDisplayData.isPositive ? '+' : ''}{priceDisplayData.priceChangePercent?.toFixed(2)}%
                      </span>
                    )}
                  </div>
                  <div className="space-y-px mt-1">
                    {(() => {
                      const bids = displayOrderBook.bids?.slice(0, 6) || [];
                      const maxAmt = Math.max(...bids.map(b => b.amount), 1);
                      return bids.map((bid, i) => (
                        <div key={i} className="relative h-5 flex items-center justify-between px-1 overflow-hidden rounded-sm">
                          <div className="absolute inset-y-0 right-0 bg-green-500/10 transition-all duration-300" style={{ width: `${(bid.amount / maxAmt) * 100}%` }} />
                          <span className="relative text-[11px] font-mono font-semibold text-green-600">{formatPrice(bid.price)}</span>
                          <span className="relative text-[11px] font-mono text-[#999999]">{formatNumber(bid.amount, 2)}</span>
                        </div>
                      ));
                    })()}
                  </div>
                  {/* Bid/Ask percentage bar */}
                  {(() => {
                    const bidTotal = displayOrderBook.bids?.slice(0, 25).reduce((s, b) => s + b.amount, 0) || 0;
                    const askTotal = displayOrderBook.asks?.slice(0, 25).reduce((s, a) => s + a.amount, 0) || 0;
                    const total = bidTotal + askTotal || 1;
                    const bidPct = Math.round((bidTotal / total) * 100);
                    const askPct = 100 - bidPct;
                    return (
                      <div className="flex items-center gap-2 px-1 pt-2 pb-1">
                        <span className="text-[10px] font-semibold text-green-600 w-7 shrink-0">{bidPct}%</span>
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden flex">
                          <div className="bg-green-500 h-full transition-all duration-300" style={{ width: `${bidPct}%` }} />
                          <div className="bg-red-500 h-full flex-1" />
                        </div>
                        <span className="text-[10px] font-semibold text-red-500 w-7 shrink-0 text-right">{askPct}%</span>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-[11px] text-[#AAAAAA]">{t('trade.noOrderBookData')}</p>
                </div>
              )}
            </div>
          </div>

        {/* Opens / Holdings */}
        <div className="mt-6 px-4">
          {/* Tab Bar */}
          <div className="flex border-b border-[#E5E5E5] mb-4">
            {[
              { key: 'opens',    label: 'Opens' },
              { key: 'holdings', label: 'Holdings' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setPortfolioTab(tab.key)}
                className={`relative pb-2.5 pt-1 mr-6 text-sm font-semibold transition-colors duration-200 ${
                  portfolioTab === tab.key ? 'text-[#0052FF]' : 'text-[#888888]'
                }`}
              >
                {tab.label}
                <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full bg-[#0052FF] transition-all duration-300 ${
                  portfolioTab === tab.key ? 'w-full opacity-100' : 'w-0 opacity-0'
                }`} />
              </button>
            ))}
          </div>

          {/* Opens */}
          {portfolioTab === 'opens' && (() => {
            const openOrders = userOrdersToDisplay.filter(o => o.status === 'pending' || o.status === 'open');
            if (openOrders.length === 0) {
              return (
                <div className="text-center py-10">
                  <div className="w-12 h-12 bg-[#F0F5FF] rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <ChartLine className="w-6 h-6 text-[#0052FF]" />
                  </div>
                  <p className="text-sm font-semibold text-[#111111] mb-1">No open orders</p>
                  <p className="text-xs text-[#888888]">Orders you place will appear here until filled</p>
                </div>
              );
            }
            return (
              <div className="space-y-2">
                {openOrders.map(order => (
                  <div key={order.orderId} className="flex items-center justify-between bg-[#F9F9F9] rounded-xl px-4 py-3 border border-[#EEEEEE]">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${order.side === 'buy' ? 'bg-green-600' : 'bg-red-500'}`}>
                        {order.side === 'buy' ? 'B' : 'S'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#111111]">{order.pair}</p>
                        <p className="text-xs text-[#888888]">
                          {order.orderType || 'Limit'} · {order.amount} @ ${order.price ? formatPrice(order.price) : 'Market'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-[#0052FF] bg-[#EEF3FF] px-2 py-0.5 rounded-full">Waiting</p>
                      <p className="text-xs text-[#AAAAAA] mt-1">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Holdings */}
          {portfolioTab === 'holdings' && (() => {
            // Build holdings list: demo mode uses demoStats/demoBalances, real mode uses live balances
            let holdings = [];
            if (isDemoMode) {
              // Prefer demoStats.holdings (has purchasePrice + unrealizedPnl from backend)
              if (demoStats?.holdings?.length > 0) {
                holdings = demoStats.holdings.map(h => ({
                  currency: h.currency,
                  total: h.amount,
                  avgPrice: h.purchasePrice || 0,
                  currentPrice: h.price || 0,
                  currentValue: h.value || 0,
                  pnl: h.unrealizedPnl ?? null,
                  pnlPct: h.purchasePrice > 0 && h.value > 0
                    ? ((h.value - h.amount * h.purchasePrice) / (h.amount * h.purchasePrice)) * 100
                    : null,
                }));
              } else {
                // Fallback: derive from demoBalances
                holdings = Object.entries(demoBalances)
                  .filter(([c, d]) => c !== 'USDT' && (d?.available || 0) > 0)
                  .map(([currency, data]) => ({
                    currency,
                    total: data.available || 0,
                    avgPrice: 0,
                    currentPrice: prices?.[`${currency}/USDT`] || 0,
                    currentValue: (data.available || 0) * (prices?.[`${currency}/USDT`] || 0),
                    pnl: null, pnlPct: null,
                  }));
              }
            } else {
              const effectiveBalances = realTimeBalances && Object.keys(realTimeBalances).length > 0
                ? realTimeBalances : userBalances;
              holdings = Object.entries(effectiveBalances)
                .filter(([c, d]) => c !== 'USDT' && ((d?.available || 0) + (d?.locked || 0)) > 0)
                .map(([currency, data]) => {
                  const total = (data?.available || 0) + (data?.locked || 0);
                  const avgPrice = data?.averagePrice || 0;
                  const cp = prices?.[`${currency}/USDT`] || 0;
                  const currentValue = total * cp;
                  const costBasis = total * avgPrice;
                  const pnl = avgPrice > 0 && cp > 0 ? currentValue - costBasis : null;
                  const pnlPct = pnl !== null && costBasis > 0 ? (pnl / costBasis) * 100 : null;
                  return { currency, total, avgPrice, currentPrice: cp, currentValue, pnl, pnlPct };
                });
            }

            if (holdings.length === 0) {
              return (
                <div className="text-center py-10">
                  <div className="w-12 h-12 bg-[#F0F5FF] rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Star className="w-6 h-6 text-[#0052FF]" />
                  </div>
                  <p className="text-sm font-semibold text-[#111111] mb-1">No holdings yet</p>
                  <p className="text-xs text-[#888888]">
                    {isDemoMode ? 'Buy a coin in demo mode to see holdings here' : 'Assets you own will show here after a trade is filled'}
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-2">
                {holdings.map(({ currency, total, avgPrice, currentPrice: cp, currentValue, pnl, pnlPct }) => {
                  const specialToken = specialTokens.find(t => t.symbol === currency);
                  const logoUrl = specialToken?.logoUrl
                    ? (specialToken.logoUrl.startsWith('http')
                        ? specialToken.logoUrl
                        : `${import.meta.env.VITE_API_BASE_URL}${specialToken.logoUrl}`)
                    : getCryptoLogoUrl(currency);
                  const fallbackUrls = getCryptoFallbackUrls(currency);

                  return (
                    <div key={currency} className="flex items-center justify-between bg-[#F9F9F9] rounded-xl px-4 py-3 border border-[#EEEEEE]">
                      <div className="flex items-center gap-3">
                        {/* Coin logo — same pattern as Market.jsx */}
                        <div className="relative w-8 h-8 shrink-0">
                          <img
                            src={logoUrl}
                            alt={currency}
                            className="w-8 h-8 rounded-full object-cover"
                            onError={(e) => {
                              const idx = parseInt(e.target.dataset.fallbackIndex || '0');
                              const next = idx + 1;
                              if (next < fallbackUrls.length) {
                                e.target.dataset.fallbackIndex = next.toString();
                                e.target.src = fallbackUrls[next];
                              } else {
                                e.target.style.display = 'none';
                                e.target.nextElementSibling.style.display = 'flex';
                              }
                            }}
                          />
                          <div
                            className="w-8 h-8 bg-[#EEF3FF] rounded-full items-center justify-center text-xs font-bold text-[#0052FF]"
                            style={{ display: 'none' }}
                          >
                            {currency.slice(0, 2)}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#111111]">{currency}</p>
                          <p className="text-xs text-[#888888]">
                            {total.toFixed(6)} · Avg ${avgPrice > 0 ? formatPrice(avgPrice) : '—'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[#111111]">
                          {cp > 0 ? `$${formatPrice(currentValue)}` : '—'}
                        </p>
                        {pnl !== null && (
                          <p className={`text-xs font-medium ${pnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {pnl >= 0 ? '+' : ''}{pnlPct?.toFixed(2)}%
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Bottom Navigation Menu */}
      <Menu />
        
      
      {/* CSS Animations */}
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        .animation-delay-1000 {
          animation-delay: 1s;
        }
        .animation-delay-3000 {
          animation-delay: 3s;
        }
      `}</style>
        </div>
      )}
    </div>

    {/* Bottom Sheet Panel */}
    {showRightPanel && (
      <div className="fixed inset-0 z-100 flex flex-col justify-end">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowRightPanel(false)} />
        <div className="relative bg-white rounded-t-3xl shadow-2xl w-full">
          <div className="flex flex-col px-5 pt-5 pb-10">
            {/* Handle */}
            <div className="w-10 h-1 bg-[#E0E0E0] rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-4">
              <span className="text-base font-bold text-[#111111]">Quick Access</span>
              <button onClick={() => setShowRightPanel(false)} className="text-[#888888] hover:text-[#111111] transition-colors">
                <XCircleIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Market',       path: '/market',        icon: BarChart2,     color: 'text-[#0052FF]' },
                { label: 'Assets',       path: '/user/assets',   icon: Wallet,        color: 'text-[#0052FF]' },
                { label: 'Deposit',      path: '/deposit',       icon: ArrowDownLeft, color: 'text-green-500' },
                { label: 'Send',         path: '/withdraw',      icon: ArrowUpRight,  color: 'text-red-400'   },
                { label: 'Copy Trading', path: '/copy-trading',  icon: Users,         color: 'text-[#0052FF]' },
              ].map(({ label, path, icon: Icon, color }) => (
                <button
                  key={path}
                  onClick={() => { setShowRightPanel(false); navigate(path); }}
                  className="flex flex-col items-center justify-center gap-2 bg-[#F4F8FF] hover:bg-[#EBF2FF] transition-colors rounded-2xl py-4"
                >
                  <Icon className={`w-5 h-5 ${color}`} />
                  <span className="text-xs font-semibold text-[#111111]">{label}</span>
                </button>
              ))}
              {/* Demo Trading — activates demo mode in-page */}
              <button
                onClick={() => { setShowRightPanel(false); setIsDemoMode(true); }}
                className={`flex flex-col items-center justify-center gap-2 transition-colors rounded-2xl py-4 ${
                  isDemoMode ? 'bg-[#0052FF] ring-2 ring-[#0052FF]' : 'bg-[#F4F8FF] hover:bg-[#EBF2FF]'
                }`}
              >
                <Gamepad2 className={`w-5 h-5 ${isDemoMode ? 'text-white' : 'text-[#0052FF]'}`} />
                <span className={`text-xs font-semibold ${isDemoMode ? 'text-white' : 'text-[#111111]'}`}>Demo</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Full-Screen Chart Panel — mobile only, slides in from left */}
    <div
      className={`md:hidden fixed inset-0 z-50 bg-white flex flex-col transition-transform duration-300 ${
        showChart ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 pt-10 pb-3 border-b border-[#F0F0F0]">
        <button onClick={() => setShowChart(false)} className="flex items-center gap-1 text-[#555555]">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="text-base font-bold text-[#111111]">{currentPair || 'BTC/USDT'}</span>
        <button
          onClick={() => currentPair && toggleFavorite(currentPair.split('/')[0])}
          className="transition-colors"
        >
          <Star className={`w-5 h-5 transition-colors duration-200 ${
            favorites.includes(currentPair?.split('/')[0])
              ? 'fill-yellow-400 text-yellow-400'
              : 'text-[#CCCCCC]'
          }`} />
        </button>
      </div>

      {/* Price / Info Tabs */}
      <div className="flex gap-4 px-4 border-b border-[#F5F5F5]">
        {[{ key: 'price', label: 'Price' }, { key: 'info', label: 'Info' }].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setChartTab(key)}
            className={`py-2 text-[11px] font-semibold transition-colors duration-200 ${
              chartTab === key ? 'text-[#0052FF] border-b-2 border-[#0052FF]' : 'text-[#AAAAAA]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Price Row */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#F5F5F5]">
        <div>
          <p className="text-xl font-bold font-mono text-[#111111]">${formatPrice(currentPairPrice)}</p>
          {priceDisplayData && (
            <p className={`text-xs font-semibold mt-0.5 ${priceDisplayData.isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {priceDisplayData.isPositive ? '+' : ''}{priceDisplayData.priceChangePercent?.toFixed(2)}%
            </p>
          )}
        </div>
        <div className="flex gap-4 text-right">
          <div>
            <p className="text-[10px] text-[#AAAAAA]">24h High</p>
            <p className="text-xs font-semibold font-mono text-[#111111]">{stats24h.high > 0 ? `$${formatPrice(stats24h.high)}` : '—'}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#AAAAAA]">24h Low</p>
            <p className="text-xs font-semibold font-mono text-[#111111]">{stats24h.low > 0 ? `$${formatPrice(stats24h.low)}` : '—'}</p>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pb-24">
        {/* Timeframe Row (Price tab only) */}
        {chartTab === 'price' && (
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#F5F5F5]">
            {['1m', '5m', '15m', '1h', '4h', '1d'].map(tf => (
              <button
                key={tf}
                onClick={() => setSelectedTimeframe(tf)}
                className={`relative flex-1 py-1.5 text-[11px] font-semibold transition-all duration-200 ${
                  selectedTimeframe === tf ? 'text-[#0052FF]' : 'text-[#AAAAAA]'
                }`}
              >
                {tf}
                {selectedTimeframe === tf && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-[#0052FF] rounded-full" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Info tab content */}
        {chartTab === 'info' && (
          <div className="px-4 py-4 space-y-4">
            {/* 24h Stats */}
            <div>
              <p className="text-[10px] font-semibold text-[#AAAAAA] uppercase tracking-wide mb-2">24h Statistics</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '24h High', value: stats24h.high > 0 ? `$${formatPrice(stats24h.high)}` : '—', color: 'text-green-600' },
                  { label: '24h Low',  value: stats24h.low  > 0 ? `$${formatPrice(stats24h.low)}`  : '—', color: 'text-red-500' },
                  { label: 'Vol (USDT)', value: stats24h.volUsdt > 0 ? formatNumber(stats24h.volUsdt, 0) : '—', color: 'text-[#111111]' },
                  { label: `Vol (${currentPair?.split('/')[0] || '—'})`, value: stats24h.volCoin > 0 ? formatNumber(stats24h.volCoin, 2) : '—', color: 'text-[#111111]' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-[#F8F8F8] rounded-xl px-3 py-3">
                    <p className="text-[10px] text-[#AAAAAA] mb-1">{label}</p>
                    <p className={`text-sm font-bold font-mono ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Spread */}
            {hasDisplayOrderBookData && (() => {
              const bestAsk = displayOrderBook.asks?.[0]?.price;
              const bestBid = displayOrderBook.bids?.[0]?.price;
              if (!bestAsk || !bestBid) return null;
              const spread = bestAsk - bestBid;
              const spreadPct = ((spread / bestBid) * 100).toFixed(3);
              return (
                <div>
                  <p className="text-[10px] font-semibold text-[#AAAAAA] uppercase tracking-wide mb-2">Market</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Best Bid',  value: `$${formatPrice(bestBid)}`,  color: 'text-green-600' },
                      { label: 'Spread',    value: `${spreadPct}%`,             color: 'text-[#555555]' },
                      { label: 'Best Ask',  value: `$${formatPrice(bestAsk)}`,  color: 'text-red-500'   },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-[#F8F8F8] rounded-xl px-2 py-3 text-center">
                        <p className="text-[9px] text-[#AAAAAA] mb-1">{label}</p>
                        <p className={`text-xs font-bold font-mono ${color}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Pair */}
            <div>
              <p className="text-[10px] font-semibold text-[#AAAAAA] uppercase tracking-wide mb-2">Pair</p>
              <div className="bg-[#F8F8F8] rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-bold text-[#111111]">{currentPair || '—'}</span>
                <span className="text-[10px] text-[#AAAAAA] bg-white px-2 py-0.5 rounded-md border border-[#E5E5E5]">
                  {currentPair?.split('/')[1] || 'USDT'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Chart + Order Book (Price tab only) */}
        {chartTab === 'price' && <>
        <div>
          {(() => {
            try {
              if (!chartData || !Array.isArray(chartData)) {
                return (
                  <div className="h-72 flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin w-8 h-8 border-2 border-[#0052FF] border-t-transparent rounded-full mx-auto mb-3" />
                      <p className="text-sm text-[#888888]">Loading chart…</p>
                    </div>
                  </div>
                );
              }
              const hasNullValues = chartData.some(c =>
                !c || c.open == null || c.high == null || c.low == null || c.close == null ||
                isNaN(c.open) || isNaN(c.high) || isNaN(c.low) || isNaN(c.close)
              );
              if (hasNullValues) {
                return (
                  <div className="h-72 flex items-center justify-center">
                    <button onClick={() => { setValidatedChartData([]); if (refetchCandlestick) refetchCandlestick(true); }}
                      className="px-4 py-2 bg-[#0052FF] text-white rounded-xl text-sm font-semibold">
                      Refresh
                    </button>
                  </div>
                );
              }
              return (
                <CandlestickChart
                  pair={currentPair}
                  isDarkMode={isDarkMode}
                  data={chartData}
                  selectedTimeframe={selectedTimeframe}
                  currentPrice={currentPairPrice}
                  isConnected={isConnected}
                  height="auto"
                />
              );
            } catch (e) {
              return (
                <div className="h-72 flex items-center justify-center">
                  <button onClick={() => window.location.reload()} className="px-4 py-2 bg-[#0052FF] text-white rounded-xl text-sm font-semibold">
                    Reload
                  </button>
                </div>
              );
            }
          })()}
        </div>

        {/* Order Book - Tabbed Design */}
        <div className="mt-4">
          {/* Tabs */}
          <div className="flex gap-4 px-4 border-b border-[#F0F0F0]">
            {['book', 'depth'].map(tab => (
              <button
                key={tab}
                onClick={() => setObTab(tab)}
                className={`py-2 text-[11px] font-semibold capitalize transition-colors ${obTab === tab ? 'text-[#0052FF] border-b-2 border-[#0052FF]' : 'text-[#AAAAAA]'}`}
              >
                {tab === 'book' ? 'Order Book' : 'Depth'}
              </button>
            ))}
          </div>

          {hasDisplayOrderBookData ? (
            <>
              {/* Bid/Ask percentage bar */}
              {(() => {
                const bidTotal = displayOrderBook.bids?.slice(0, 20).reduce((s, b) => s + b.amount, 0) || 0;
                const askTotal = displayOrderBook.asks?.slice(0, 20).reduce((s, a) => s + a.amount, 0) || 0;
                const total = bidTotal + askTotal || 1;
                const bidPct = Math.round((bidTotal / total) * 100);
                const askPct = 100 - bidPct;
                return (
                  <div className="flex items-center gap-2 px-3 py-1.5">
                    <span className="text-[10px] font-semibold text-green-600 w-7 shrink-0">{bidPct}%</span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden flex">
                      <div className="bg-green-500 h-full transition-all duration-300" style={{ width: `${bidPct}%` }} />
                      <div className="bg-red-500 h-full flex-1" />
                    </div>
                    <span className="text-[10px] font-semibold text-red-500 w-7 shrink-0 text-right">{askPct}%</span>
                  </div>
                );
              })()}

              {/* Column headers */}
              <div className="flex px-1 pb-0.5">
                <div className="flex-1 flex justify-between px-1.5">
                  <span className="text-[9px] font-semibold text-[#AAAAAA] uppercase tracking-wide">Price</span>
                  <span className="text-[9px] font-semibold text-[#AAAAAA] uppercase tracking-wide">Qty</span>
                </div>
                <div className="w-px bg-[#F0F0F0]" />
                <div className="flex-1 flex justify-between px-1.5">
                  <span className="text-[9px] font-semibold text-[#AAAAAA] uppercase tracking-wide">Qty</span>
                  <span className="text-[9px] font-semibold text-[#AAAAAA] uppercase tracking-wide">Price</span>
                </div>
              </div>

              {/* Two-column data */}
              <div className="flex px-1 pb-1">
                {obTab === 'book' ? (
                  <>
                    {/* Bids — left, green */}
                    <div className="flex-1 space-y-px">
                      {(() => {
                        const bids = displayOrderBook.bids?.slice(0, 20) || [];
                        const maxAmt = Math.max(...bids.map(b => b.amount), 1);
                        return bids.map((bid, i) => (
                          <div key={i} className="relative h-5 flex items-center justify-between px-1 overflow-hidden rounded-sm">
                            <div className="absolute inset-y-0 left-0 bg-green-500/10" style={{ width: `${(bid.amount / maxAmt) * 100}%` }} />
                            <span className="relative text-[10px] font-mono font-semibold text-green-600">{formatPrice(bid.price)}</span>
                            <span className="relative text-[10px] font-mono text-[#999999]">{formatNumber(bid.amount, 2)}</span>
                          </div>
                        ));
                      })()}
                    </div>
                    <div className="w-px bg-[#F0F0F0] mx-0.5" />
                    {/* Asks — right, red */}
                    <div className="flex-1 space-y-px">
                      {(() => {
                        const asks = displayOrderBook.asks?.slice(0, 20) || [];
                        const maxAmt = Math.max(...asks.map(a => a.amount), 1);
                        return asks.map((ask, i) => (
                          <div key={i} className="relative h-5 flex items-center justify-between px-1 overflow-hidden rounded-sm">
                            <div className="absolute inset-y-0 right-0 bg-red-500/10" style={{ width: `${(ask.amount / maxAmt) * 100}%` }} />
                            <span className="relative text-[10px] font-mono text-[#999999]">{formatNumber(ask.amount, 2)}</span>
                            <span className="relative text-[10px] font-mono font-semibold text-red-500">{formatPrice(ask.price)}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Cumulative bids — left, green */}
                    <div className="flex-1 space-y-px">
                      {(() => {
                        const bids = displayOrderBook.bids?.slice(0, 20) || [];
                        let cum = 0;
                        const cumBids = bids.map(b => { cum += b.amount; return { ...b, cumAmount: cum }; });
                        const maxCum = cumBids[cumBids.length - 1]?.cumAmount || 1;
                        return cumBids.map((bid, i) => (
                          <div key={i} className="relative h-5 flex items-center justify-between px-1 overflow-hidden rounded-sm">
                            <div className="absolute inset-y-0 left-0 bg-green-500/15" style={{ width: `${(bid.cumAmount / maxCum) * 100}%` }} />
                            <span className="relative text-[10px] font-mono font-semibold text-green-600">{formatPrice(bid.price)}</span>
                            <span className="relative text-[10px] font-mono text-[#999999]">{formatNumber(bid.cumAmount, 2)}</span>
                          </div>
                        ));
                      })()}
                    </div>
                    <div className="w-px bg-[#F0F0F0] mx-0.5" />
                    {/* Cumulative asks — right, red */}
                    <div className="flex-1 space-y-px">
                      {(() => {
                        const asks = displayOrderBook.asks?.slice(0, 20) || [];
                        let cum = 0;
                        const cumAsks = asks.map(a => { cum += a.amount; return { ...a, cumAmount: cum }; });
                        const maxCum = cumAsks[cumAsks.length - 1]?.cumAmount || 1;
                        return cumAsks.map((ask, i) => (
                          <div key={i} className="relative h-5 flex items-center justify-between px-1 overflow-hidden rounded-sm">
                            <div className="absolute inset-y-0 right-0 bg-red-500/15" style={{ width: `${(ask.cumAmount / maxCum) * 100}%` }} />
                            <span className="relative text-[10px] font-mono text-[#999999]">{formatNumber(ask.cumAmount, 2)}</span>
                            <span className="relative text-[10px] font-mono font-semibold text-red-500">{formatPrice(ask.price)}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </>
                )}
              </div>

              {/* Current price row */}
              <div className="flex items-center justify-between px-3 py-1.5 mx-1 mb-2 bg-[#F5F5F5] rounded-lg">
                <span className="text-xs font-bold font-mono text-[#111111]">${formatPrice(currentPairPrice)}</span>
                {priceDisplayData && (
                  <span className={`text-[10px] font-semibold ${priceDisplayData.isPositive ? 'text-green-500' : 'text-red-500'}`}>
                    {priceDisplayData.isPositive ? '+' : ''}{priceDisplayData.priceChangePercent?.toFixed(2)}%
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="text-[11px] text-[#AAAAAA] text-center py-6">{t('trade.noOrderBookData')}</p>
          )}
        </div>
        </>}
      </div>

      {/* Bottom Buy / Sell Bar */}
      <div className="absolute bottom-0 left-0 right-0 flex gap-3 px-4 pb-8 pt-3 bg-white border-t border-[#F0F0F0]">
        <button
          onClick={() => { setShowChart(false); setOrderSide('buy'); }}
          className="flex-1 py-3 rounded-xl bg-green-700 text-white text-sm font-bold"
        >
          {t('trade.buy')}
        </button>
        <button
          onClick={() => { setShowChart(false); setOrderSide('sell'); }}
          className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-bold"
        >
          {t('trade.sell')}
        </button>
      </div>
    </div>
    </>
  );
};

export default Trade;
