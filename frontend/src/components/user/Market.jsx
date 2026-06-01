import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTrading } from '../../contexts/TradingContext';
import { useSession } from '../../contexts/SessionContext';
import { Button } from "@/components/ui/button";
import { Search, X, ChevronLeft, ChevronRight, Star, MoreVertical, SlidersHorizontal } from 'lucide-react';
import { getCryptoLogoUrl, getCryptoFallbackUrls, getSpecialTokenPlaceholder, getRegularCryptoPlaceholder } from '../../utils/logoService';
import { market, ApiUtils } from '../../services/api';
import { useMarketData, useCacheAwareData } from '../../hooks/useCacheAwareData';
import wsService from '../../services/websocket';
import Menu from '../Menu';
import Spinner from '../common/Spinner';

const meshBg = { background: '#FFFFFF' };

const CHAINS = [
  { value: 'all',       label: 'All',    fullLabel: 'All Chains',      symbols: [] },
  { value: 'bitcoin',   label: 'BTC',    fullLabel: 'Bitcoin',         symbols: ['BTC', 'WBTC'] },
  { value: 'ethereum',  label: 'ETH',    fullLabel: 'Ethereum',        symbols: ['ETH', 'WETH'] },
  { value: 'bnb',       label: 'BNB',    fullLabel: 'BNB Chain',       symbols: ['BNB', 'CAKE'] },
  { value: 'solana',    label: 'SOL',    fullLabel: 'Solana',          symbols: ['SOL'] },
  { value: 'arbitrum',  label: 'ARB',    fullLabel: 'Arbitrum',        symbols: ['ARB'] },
  { value: 'polygon',   label: 'MATIC',  fullLabel: 'Polygon',         symbols: ['MATIC', 'POL'] },
  { value: 'avalanche', label: 'AVAX',   fullLabel: 'Avalanche',       symbols: ['AVAX'] },
  { value: 'optimism',  label: 'OP',     fullLabel: 'Optimism',        symbols: ['OP'] },
  { value: 'base',      label: 'BASE',   fullLabel: 'Base',            symbols: ['BASE'] },
  { value: 'ton',       label: 'TON',    fullLabel: 'TON',             symbols: ['TON'] },
  { value: 'xrp',       label: 'XRP',    fullLabel: 'XRP Ledger',      symbols: ['XRP'] },
  { value: 'cardano',   label: 'ADA',    fullLabel: 'Cardano',         symbols: ['ADA'] },
  { value: 'tron',      label: 'TRX',    fullLabel: 'TRON',            symbols: ['TRX'] },
  { value: 'polkadot',  label: 'DOT',    fullLabel: 'Polkadot',        symbols: ['DOT'] },
  { value: 'cosmos',    label: 'ATOM',   fullLabel: 'Cosmos',          symbols: ['ATOM'] },
  { value: 'near',      label: 'NEAR',   fullLabel: 'NEAR Protocol',   symbols: ['NEAR'] },
  { value: 'aptos',     label: 'APT',    fullLabel: 'Aptos',           symbols: ['APT'] },
  { value: 'sui',       label: 'SUI',    fullLabel: 'Sui',             symbols: ['SUI'] },
  { value: 'sei',       label: 'SEI',    fullLabel: 'Sei',             symbols: ['SEI'] },
  { value: 'injective', label: 'INJ',    fullLabel: 'Injective',       symbols: ['INJ'] },
  { value: 'fantom',    label: 'FTM',    fullLabel: 'Fantom',          symbols: ['FTM'] },
  { value: 'algorand',  label: 'ALGO',   fullLabel: 'Algorand',        symbols: ['ALGO'] },
  { value: 'hedera',    label: 'HBAR',   fullLabel: 'Hedera',          symbols: ['HBAR'] },
  { value: 'vechain',   label: 'VET',    fullLabel: 'VeChain',         symbols: ['VET', 'VTHO'] },
  { value: 'stellar',   label: 'XLM',    fullLabel: 'Stellar',         symbols: ['XLM'] },
  { value: 'tezos',     label: 'XTZ',    fullLabel: 'Tezos',           symbols: ['XTZ'] },
  { value: 'filecoin',  label: 'FIL',    fullLabel: 'Filecoin',        symbols: ['FIL'] },
  { value: 'zksync',    label: 'ZK',     fullLabel: 'zkSync Era',      symbols: ['ZK', 'ZKS'] },
  { value: 'starknet',  label: 'STRK',   fullLabel: 'Starknet',        symbols: ['STRK'] },
  { value: 'mantle',    label: 'MNT',    fullLabel: 'Mantle',          symbols: ['MNT'] },
  { value: 'osmosis',   label: 'OSMO',   fullLabel: 'Osmosis',         symbols: ['OSMO'] },
  { value: 'eos',       label: 'EOS',    fullLabel: 'EOS',             symbols: ['EOS'] },
  { value: 'theta',     label: 'THETA',  fullLabel: 'Theta Network',   symbols: ['THETA', 'TFUEL'] },
  { value: 'neo',       label: 'NEO',    fullLabel: 'NEO',             symbols: ['NEO', 'GAS'] },
  { value: 'waves',     label: 'WAVES',  fullLabel: 'Waves',           symbols: ['WAVES'] },
  { value: 'scroll',    label: 'SCR',    fullLabel: 'Scroll',          symbols: ['SCR'] },
  { value: 'iota',      label: 'IOTA',   fullLabel: 'IOTA',            symbols: ['IOTA', 'MIOTA'] },
  { value: 'blast',     label: 'BLAST',  fullLabel: 'Blast',           symbols: ['BLAST'] },
  { value: 'linea',     label: 'LINEA',  fullLabel: 'Linea',           symbols: ['LINEA'] },
];

const Market = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useUserAuth();
  const { isDarkMode } = useTheme();
  const { sessionStatus } = useSession();
  const { tickers, tradingPairs, prices, loading, fetchMarketTickers, fetchTradingPairs } = useTrading();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeUnifiedTab, setActiveUnifiedTab] = useState('all');
  const [chainFilter, setChainFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [specialTokenPrices, setSpecialTokenPrices] = useState({});
  const [logoCache, setLogoCache] = useState({});
  const [stableSpecialTokenPercentages, setStableSpecialTokenPercentages] = useState({});
  const [showChainDropdown, setShowChainDropdown] = useState(false);
  const [favorites, setFavorites] = useState([]);

  // Add effect to update special token percentages every 1.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setStableSpecialTokenPercentages(prev => {
        const updated = { ...prev };

        // Update each existing token with a new random percentage (3% to 6% - smaller range)
        Object.keys(updated).forEach(symbol => {
          updated[symbol] = 3 + Math.random() * 3; // Random between 3% to 6%
        });

        return updated;
      });
    }, 1500); // Update every 1.5 seconds

    return () => clearInterval(interval);
  }, []);

  // Listen for logo updates
  useEffect(() => {
    const handleLogoLoaded = (event) => {
      const { symbol, dataUrl } = event.detail;
      setLogoCache(prev => ({
        ...prev,
        [symbol]: dataUrl
      }));
    };

    window.addEventListener('logoLoaded', handleLogoLoaded);
    return () => window.removeEventListener('logoLoaded', handleLogoLoaded);
  }, []);

  // Use cache-aware data fetching for market data
  const {
    data: marketTickers,
    loading: tickersLoading,
    error: tickersError,
    refetch: refetchTickers,
    cacheStatus: tickersCacheStatus,
    isStale: tickersStale
  } = useMarketData();

  const {
    data: specialTokens,
    loading: specialTokensLoading,
    error: specialTokensError,
    refetch: refetchSpecialTokens,
    cacheStatus: specialTokensCacheStatus
  } = useCacheAwareData('/market/special-tokens', {
    cacheTimeout: 60000, // 1 minute cache for special tokens
    refetchInterval: 120000 // Refresh every 2 minutes
  });

  // Add state for fallback special tokens data
  const [fallbackSpecialTokens, setFallbackSpecialTokens] = useState(null);

  // Fallback API call for special tokens if cache-aware hook fails
  useEffect(() => {
    const fetchSpecialTokensFallback = async () => {
      try {
        // Use our enhanced API service with rate limiting
        const response = await ApiUtils.get('/market/special-tokens');

        if (response.data) {
          setFallbackSpecialTokens(response.data);
        }
      } catch (error) {
        // Silently handle rate limiting errors
        if (error.message?.includes('429') || error.message?.includes('rate limit')) {
          console.warn('Special tokens API rate limited, using cached data');
          return;
        }
        console.error('Fallback special tokens fetch error:', error);
      }
    };

    // Only fetch fallback if we don't have primary data and not currently loading
    if (!specialTokens && !specialTokensLoading) {
      // Fetch immediately without any delay
      fetchSpecialTokensFallback();
    }
  }, [specialTokens, specialTokensLoading]);

  const {
    data: tradingPairsData,
    loading: pairsLoading,
    refetch: refetchPairs
  } = useCacheAwareData('/trading/pairs', {
    cacheTimeout: 300000, // 5 minute cache for trading pairs
  });

  const isLoading = tickersLoading || specialTokensLoading || pairsLoading;

  // WebSocket subscription for real-time price updates
  useEffect(() => {
    const handlePriceUpdate = (data) => {
      // Handle special token price updates
      if (data.type === 'special_token_price' && data.symbol) {
        setSpecialTokenPrices(prev => ({
          ...prev,
          [data.symbol]: {
            price: data.price,
            change: data.change,
            changePercent: data.changePercent,
            timestamp: data.timestamp
          }
        }));
      }
    };

    // Subscribe to price updates
    wsService.subscribeToGeneral('price', handlePriceUpdate);
    wsService.subscribeToGeneral('special_token_price', handlePriceUpdate);

    // Initialize WebSocket connection
    wsService.connect().catch(err => {
      console.warn('WebSocket connection failed:', err);
    });

    return () => {
      wsService.unsubscribeFromGeneral('price', handlePriceUpdate);
      wsService.unsubscribeFromGeneral('special_token_price', handlePriceUpdate);
    };
  }, []);

  // Refresh market data - initial fetch only (prevent rate limiting)
  useEffect(() => {
    // Cache-aware hooks handle data fetching automatically
    // This effect is now primarily for WebSocket management

    // Initialize WebSocket connection for real-time updates
    wsService.connect().catch(err => {
      console.warn('WebSocket connection failed:', err);
    });

  }, []); // Empty dependency array to only run once

  // Manual refresh function
  const handleRefreshData = async () => {
    try {
      const refreshPromises = [
        refetchTickers(true),
        refetchSpecialTokens(true),
        refetchPairs(true)
      ];

      // Also try fallback special tokens fetch
      const fallbackFetch = async () => {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/market/special-tokens`, {
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            setFallbackSpecialTokens(data);
          }
        } catch (error) {
          console.error('Manual refresh special tokens error:', error);
        }
      };

      refreshPromises.push(fallbackFetch());
      await Promise.all(refreshPromises);
    } catch (error) {
      console.error('Error refreshing market data:', error);
    }
  };

  // Fetch favorites from backend on mount
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

  const toggleFavorite = async (symbol, e) => {
    e.stopPropagation();
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

  // Close chain dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showChainDropdown && !event.target.closest('.chain-dropdown-btn')) {
        setShowChainDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showChainDropdown]);

  // Transform tickers data for display
  const getMarketData = () => {
    let marketItems = [];

    // Use cache-aware market data (useMarketData returns array directly, TradingContext wraps as {data: [...]})
    const currentTickers = Array.isArray(marketTickers) ? marketTickers : (marketTickers?.data || (Array.isArray(tickers) ? tickers : tickers?.data));
    const currentPairs = tradingPairsData || tradingPairs;
    // Fix special tokens data access - handle the API response structure properly
    let currentSpecialTokens = [];

    // Use primary data source first, then fallback - improved logic
    const specialTokensSource = specialTokens || fallbackSpecialTokens;

    if (specialTokensSource) {
      if (Array.isArray(specialTokensSource)) {
        currentSpecialTokens = specialTokensSource;
      } else if (specialTokensSource.success && Array.isArray(specialTokensSource.data)) {
        currentSpecialTokens = specialTokensSource.data;
      } else if (Array.isArray(specialTokensSource.data)) {
        currentSpecialTokens = specialTokensSource.data;
      }
    }

    // Additional check: if primary source is null but fallback has data, use fallback
    if (!currentSpecialTokens.length && fallbackSpecialTokens) {
      if (Array.isArray(fallbackSpecialTokens)) {
        currentSpecialTokens = fallbackSpecialTokens;
      } else if (fallbackSpecialTokens.success && Array.isArray(fallbackSpecialTokens.data)) {
        currentSpecialTokens = fallbackSpecialTokens.data;
      } else if (Array.isArray(fallbackSpecialTokens.data)) {
        currentSpecialTokens = fallbackSpecialTokens.data;
      }
    }



    // Add regular tickers if available
    if (currentTickers && Array.isArray(currentTickers)) {
      const regularTickers = currentTickers
        .filter(ticker => {
          const [baseSymbol] = ticker.pair.split('/');

          // First check if the ticker itself is marked as special
          if (ticker.isSpecial === true) {
            return false;
          }

          // Exclude tickers that are special tokens - more robust check
          const isSpecialToken = currentSpecialTokens && Array.isArray(currentSpecialTokens)
            ? currentSpecialTokens.some(st => st.symbol === baseSymbol.toUpperCase())
            : false;

          // Also exclude if the symbol matches any known special token symbols
          const knownSpecialTokens = ['DT', 'SPECIAL', 'TEST', 'DEMO']; // Add known special token symbols
          const isKnownSpecial = knownSpecialTokens.includes(baseSymbol.toUpperCase());

          return !isSpecialToken && !isKnownSpecial;
        })
        .map(ticker => {
        const [baseSymbol, quoteSymbol] = ticker.pair.split('/');
        const pairInfo = currentPairs?.find?.(p => p.symbol === ticker.pair);

        // Use real-time price if available
        const currentPrice = prices[ticker.pair] || ticker.lastPrice;
        const priceChange = currentPrice - ticker.openPrice;
        const priceChangePercent = ticker.openPrice > 0 ?
          ((currentPrice - ticker.openPrice) / ticker.openPrice) * 100 : 0;

        try {
          const result = {
            symbol: baseSymbol,
            name: pairInfo?.baseName || baseSymbol,
            pair: ticker.pair,
            price: `$${currentPrice?.toFixed(6) || '0.000000'}`,
            change: `${priceChangePercent >= 0 ? '+' : ''}${priceChangePercent?.toFixed(2) || '0.00'}%`,
            changeValue: `${priceChangePercent >= 0 ? '+' : ''}$${priceChange?.toFixed(6) || '0.000000'}`,
            isPositive: (priceChangePercent || 0) >= 0,
            volume: `$${(ticker.volume24h || 0).toFixed(2)}`,
            marketCap: 'N/A',
            isSpecial: ticker.isSpecial || false,
            specialData: ticker.specialTokenData || null,
            logoUrl: (() => {
              try {
                // Check if this is a special token first
                if (ticker.isSpecial && ticker.specialTokenData && ticker.specialTokenData.logoUrl) {
                  const logoUrl = ticker.specialTokenData.logoUrl;
                  return logoUrl.startsWith('http')
                    ? logoUrl
                    : `${import.meta.env.VITE_API_BASE_URL}${logoUrl}`;
                }
                // Otherwise use regular crypto logo service
                return getCryptoLogoUrl(baseSymbol, {
                  pair: ticker.pair,
                  tradingPairs: currentPairs
                });
              } catch (logoError) {
                console.warn('Logo service error for', baseSymbol, ':', logoError);
                // Use appropriate placeholder based on token type
                return ticker.isSpecial
                  ? getSpecialTokenPlaceholder(baseSymbol, ticker.specialTokenData?.name || baseSymbol)
                  : getRegularCryptoPlaceholder(baseSymbol);
              }
            })(),
            fallbackUrls: (() => {
              try {
                if (ticker.isSpecial && ticker.specialTokenData) {
                  const fallbacks = [];
                  if (ticker.specialTokenData.logoUrl) {
                    const url = ticker.specialTokenData.logoUrl.startsWith('http')
                      ? ticker.specialTokenData.logoUrl
                      : `${import.meta.env.VITE_API_BASE_URL}${ticker.specialTokenData.logoUrl}`;
                    fallbacks.push(url);
                  }
                  fallbacks.push(getSpecialTokenPlaceholder(baseSymbol, ticker.specialTokenData.name, 'primary'));
                  fallbacks.push(getSpecialTokenPlaceholder(baseSymbol, ticker.specialTokenData.name, 'secondary'));
                  return fallbacks;
                }
                return getCryptoFallbackUrls(baseSymbol);
              } catch (fallbackError) {
                return ticker.isSpecial
                  ? [getSpecialTokenPlaceholder(baseSymbol, ticker.specialTokenData?.name || baseSymbol)]
                  : [getRegularCryptoPlaceholder(baseSymbol)];
              }
            })(),
            icon: baseSymbol.charAt(0)
          };

          return result;
        } catch (error) {
          console.error('Error processing ticker data:', error);
          return {
            symbol: baseSymbol,
            name: baseSymbol,
            pair: ticker.pair,
            price: '$0.000000',
            change: '+0.00%',
            changeValue: '+$0.000000',
            isPositive: true,
            volume: '$0.00',
            marketCap: 'N/A',
            isSpecial: ticker.isSpecial || false,
            specialData: ticker.specialTokenData || null,
            logoUrl: ticker.isSpecial
              ? getSpecialTokenPlaceholder(baseSymbol, ticker.specialTokenData?.name || baseSymbol)
              : getRegularCryptoPlaceholder(baseSymbol),
            fallbackUrls: ticker.isSpecial
              ? [getSpecialTokenPlaceholder(baseSymbol, ticker.specialTokenData?.name || baseSymbol)]
              : [getRegularCryptoPlaceholder(baseSymbol)],
            icon: baseSymbol.charAt(0)
          };
        }
      });

      marketItems = [...marketItems, ...regularTickers];
    }

    // Add special tokens
    if (currentSpecialTokens && Array.isArray(currentSpecialTokens)) {
      const activeTokens = currentSpecialTokens.filter(token => {
        // If isActive/showInMarket are undefined, default to true
        const isActive = token.isActive !== false; // true if undefined or true
        const showInMarket = token.showInMarket !== false; // true if undefined or true

        return isActive && showInMarket;
      });

      const specialTokenItems = activeTokens.map(token => {
        // Use real-time price if available
        let currentPrice = token.currentPrice;
          let priceChangePercent = 0;
          let priceChange = 0;

          if (specialTokenPrices[token.symbol]) {
            const realtimeData = specialTokenPrices[token.symbol];
            currentPrice = realtimeData.price;
            // For special tokens, ignore backend percentage and use our controlled stable percentage
            // priceChangePercent = realtimeData.changePercent || 0;
            // priceChange = realtimeData.change || 0;
          }

          // For special tokens, ensure percentage changes are always positive and realistic (3% to 6% range)
          // Always use stable percentage for special tokens - ignore backend data completely for percentage
          if (!stableSpecialTokenPercentages[token.symbol]) {
            // Initialize with a random percentage between +3% to +6%
            const initialPercent = 3 + Math.random() * 3; // Random between 3% to 6%

            // Store this percentage to keep it stable
            setStableSpecialTokenPercentages(prev => ({
              ...prev,
              [token.symbol]: initialPercent
            }));

            priceChangePercent = initialPercent;
          } else {
            // Always use the existing stable percentage
            priceChangePercent = stableSpecialTokenPercentages[token.symbol];
          }

          // Recalculate price change based on clamped percentage
          if (currentPrice && priceChangePercent !== 0) {
            priceChange = (currentPrice * priceChangePercent) / (100 + priceChangePercent);
          }

          const result = {
            symbol: token.symbol,
            name: token.name,
            pair: `${token.symbol}/USDT`,
            price: `$${currentPrice?.toFixed(6) || '0.000000'}`,
            change: `${priceChangePercent >= 0 ? '+' : ''}${priceChangePercent?.toFixed(2) || '0.00'}%`,
            changeValue: `${priceChangePercent >= 0 ? '+' : ''}$${priceChange?.toFixed(6) || '0.000000'}`,
            isPositive: (priceChangePercent || 0) >= 0,
            volume: '$0.00', // Special tokens don't have real volume
            marketCap: 'N/A',
            isSpecial: true,
            specialData: null,
            logoUrl: (() => {
              // Use the same logic as Trade.jsx for consistency
              if (token.logoUrl) {
                return token.logoUrl.startsWith('http')
                  ? token.logoUrl
                  : `${import.meta.env.VITE_API_BASE_URL}${token.logoUrl}`;
              }
              // Fallback to placeholder
              return getSpecialTokenPlaceholder(token.symbol, token.name);
            })(),
            fallbackUrls: (() => {
              const fallbacks = [];
              // Add the primary logo URL (same as logoUrl above)
              if (token.logoUrl) {
                const url = token.logoUrl.startsWith('http')
                  ? token.logoUrl
                  : `${import.meta.env.VITE_API_BASE_URL}${token.logoUrl}`;
                fallbacks.push(url);
              }
              // Add placeholder fallbacks (no external crypto logos for special tokens)
              fallbacks.push(getSpecialTokenPlaceholder(token.symbol, token.name, 'primary'));
              fallbacks.push(getSpecialTokenPlaceholder(token.symbol, token.name, 'secondary'));
              fallbacks.push(getSpecialTokenPlaceholder(token.symbol, token.name, 'tertiary'));
              return fallbacks;
            })(),
            icon: token.symbol.charAt(0)
          };

          return result;
        });

      marketItems = [...marketItems, ...specialTokenItems];
    }

    return marketItems;
  };

  const marketData = getMarketData();

  // Use fallback data if no real data is available (due to rate limiting or API issues)
  const displayData = marketData.length > 0 ? marketData : [];

  // Calculate real-time market stats from actual data
  const getMarketStats = () => {
    const dataToUse = displayData;

    if (!dataToUse.length) {
      return {
        totalMarketCap: '$2.85T', // Fallback
        totalVolume: '$89.2B',    // Fallback
        topGainer: { symbol: 'MATIC', change: '+3.7%' },
        topLoser: { symbol: 'DOT', change: '-1.2%' }
      };
    }

    const gainers = dataToUse.filter(item => item.isPositive);
    const losers = dataToUse.filter(item => !item.isPositive);

    const topGainer = gainers.length > 0
      ? gainers.reduce((max, item) => {
          const maxChange = parseFloat(max.change.replace(/[+%]/g, ''));
          const itemChange = parseFloat(item.change.replace(/[+%]/g, ''));
          return itemChange > maxChange ? item : max;
        })
      : { symbol: 'N/A', change: '0%' };

    const topLoser = losers.length > 0
      ? losers.reduce((min, item) => {
          const minChange = parseFloat(min.change.replace(/[+%-]/g, ''));
          const itemChange = parseFloat(item.change.replace(/[+%-]/g, ''));
          return itemChange > minChange ? item : min;
        })
      : { symbol: 'N/A', change: '0%' };

    // Calculate total volume from real data
    const totalVolumeValue = dataToUse.reduce((total, item) => {
      const volume = parseFloat(item.volume.replace(/[$,BMK]/g, ''));
      const multiplier = item.volume.includes('B') ? 1e9 : item.volume.includes('M') ? 1e6 : item.volume.includes('K') ? 1e3 : 1;
      return total + (isNaN(volume) ? 0 : volume * multiplier);
    }, 0);

    return {
      totalMarketCap: '$2.85T', // Keep static for now
      totalVolume: `$${(totalVolumeValue / 1e9).toFixed(2)}B`,
      topGainer,
      topLoser
    };
  };

  const marketStats = getMarketStats();

  const filteredData = displayData.filter(crypto => {
    // Favorites tab — show only starred coins
    if (activeUnifiedTab === 'favorites') return favorites.includes(crypto.symbol);

    // Apply search filter
    const matchesSearch = crypto.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      crypto.symbol.toLowerCase().includes(searchTerm.toLowerCase());

    // Apply chain filter
    let matchesChain = true;
    if (chainFilter !== 'all') {
      const chainDef = CHAINS.find(c => c.value === chainFilter);
      matchesChain = chainDef?.symbols?.includes(crypto.symbol) || false;
    }

    if (activeUnifiedTab === 'gainers') {
      return matchesSearch && matchesChain && crypto.isPositive;
    } else if (activeUnifiedTab === 'losers') {
      return matchesSearch && matchesChain && !crypto.isPositive;
    } else if (activeUnifiedTab === 'hot') {
      const hotCoins = [...displayData]
        .sort((a, b) => parseFloat(b.volume.replace(/[$,BMK]/g, '')) - parseFloat(a.volume.replace(/[$,BMK]/g, '')))
        .slice(0, 20);
      return matchesSearch && matchesChain && hotCoins.includes(crypto);
    } else if (activeUnifiedTab === 'volume') {
      const sorted = [...displayData]
        .sort((a, b) => parseFloat(b.volume.replace(/[$,BMK]/g, '')) - parseFloat(a.volume.replace(/[$,BMK]/g, '')))
        .slice(0, 20);
      return matchesSearch && matchesChain && sorted.includes(crypto);
    } else if (activeUnifiedTab === 'new') {
      return matchesSearch && matchesChain && crypto.isSpecial;
    }

    return matchesSearch && matchesChain;
  });

  const getSpecialTokens = () => {
    // Get all special tokens and sort by newest first
    const specialTokensData = [...displayData].filter(item => item.isSpecial);

    // If we have the raw special tokens data with createdAt, use that for sorting
    const currentSpecialTokens = specialTokens || fallbackSpecialTokens;
    let tokensSource = [];

    if (currentSpecialTokens) {
      if (Array.isArray(currentSpecialTokens)) {
        tokensSource = currentSpecialTokens;
      } else if (currentSpecialTokens.success && Array.isArray(currentSpecialTokens.data)) {
        tokensSource = currentSpecialTokens.data;
      } else if (Array.isArray(currentSpecialTokens.data)) {
        tokensSource = currentSpecialTokens.data;
      }
    }

    // Sort by createdAt date (newest first)
    if (tokensSource.length > 0) {
      const sortedTokens = [...specialTokensData].sort((a, b) => {
        const tokenA = tokensSource.find(t => t.symbol === a.symbol);
        const tokenB = tokensSource.find(t => t.symbol === b.symbol);

        if (tokenA?.createdAt && tokenB?.createdAt) {
          return new Date(tokenB.createdAt) - new Date(tokenA.createdAt);
        }

        return 0;
      });

      return sortedTokens;
    }

    // Fallback: just return special tokens
    return specialTokensData;
  };

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = filteredData.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeUnifiedTab, chainFilter]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderCoinCard = (crypto, index) => (
    <div
      key={`${crypto.symbol}-${index}`}
      onClick={() => {
        if (isAuthenticated()) {
          navigate(`/trade?pair=${encodeURIComponent(crypto.pair)}`, {
            state: {
              selectedPair: crypto.pair,
              symbol: crypto.symbol
            }
          });
        } else {
          navigate('/signin', {
            state: {
              from: `/trade?pair=${encodeURIComponent(crypto.pair)}`,
              selectedPair: crypto.pair,
              symbol: crypto.symbol
            }
          });
        }
      }}
      className="cursor-pointer py-3 hover:bg-[#F0F5FF]/60 transition-all duration-200 border-b border-[#0052FF]/15 last:border-b-0"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={crypto.logoUrl}
              alt={crypto.name}
              className="w-10 h-10 rounded-full object-cover"
              onLoad={(e) => {
                e.target.style.display = 'block';
                e.target.nextElementSibling.style.display = 'none';
              }}
              onError={(e) => {
                if (crypto.isSpecial) {
                  const fallbackUrls = crypto.fallbackUrls || [];
                  const currentIndex = parseInt(e.target.dataset.fallbackIndex || '0');
                  const nextIndex = currentIndex + 1;

                  if (nextIndex < fallbackUrls.length) {
                    e.target.dataset.fallbackIndex = nextIndex.toString();
                    e.target.src = fallbackUrls[nextIndex];
                  } else {
                    e.target.style.display = 'none';
                    e.target.nextElementSibling.style.display = 'flex';
                  }
                } else {
                  const fallbackUrls = crypto.fallbackUrls || getCryptoFallbackUrls(crypto.symbol);
                  const currentIndex = parseInt(e.target.dataset.fallbackIndex || '0');
                  const nextIndex = currentIndex + 1;

                  if (nextIndex < fallbackUrls.length) {
                    e.target.dataset.fallbackIndex = nextIndex.toString();
                    e.target.src = fallbackUrls[nextIndex];
                  } else {
                    e.target.style.display = 'none';
                    e.target.nextElementSibling.style.display = 'flex';
                  }
                }
              }}
            />
            <div
              className="w-10 h-10 bg-[#0052FF]/12 rounded-full items-center justify-center hidden"
              style={{ display: 'none' }}
            >
              <span className="text-[#0052FF] font-bold">
                {crypto.icon}
              </span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-[#111111] text-sm">{crypto.symbol}</h4>
            </div>
            <p className="text-[#888888] text-xs">{crypto.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="font-semibold text-[#111111] text-sm">{crypto.price}</p>
            <p className={`text-xs font-semibold ${
              crypto.isPositive ? 'text-green-400' : 'text-red-400'
            }`}>
              {crypto.change}
            </p>
          </div>
          <button
            onClick={(e) => toggleFavorite(crypto.symbol, e)}
            className="p-1 shrink-0"
          >
            <Star className={`w-4 h-4 transition-colors duration-200 ${
              favorites.includes(crypto.symbol)
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-[#CCCCCC]'
            }`} />
          </button>
        </div>
      </div>
    </div>
  );

 return (
    <div className="min-h-screen relative overflow-hidden" style={meshBg}>
      {/* Decorative border circles */}
      {/* Main Content */}
      <div className="relative z-10 w-full max-w-md mx-auto px-4 pt-6 pb-24">
        {/* Search + 3-dot */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#AAAAAA] pointer-events-none" />
            <input
              type="text"
              placeholder={t('market.searchCoin')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-9 py-3 bg-[#F4F4F4] rounded-2xl text-sm text-[#111111] placeholder-[#AAAAAA] focus:outline-none focus:ring-2 focus:ring-[#0052FF]/20 border-0"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#888888]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button className="w-11 h-11 shrink-0 flex items-center justify-center bg-[#F4F4F4] rounded-2xl text-[#555555] hover:bg-[#E8EEFF] hover:text-[#0052FF] transition-all duration-200">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>

        {/* Unified filter row — All | Favorites | Market | New | Hot | Gainers | Losers | Volume */}
        <div className="flex overflow-x-auto scrollbar-hide border-b border-[#E5E5E5] mb-4">
          {[
            { value: 'all',       label: t('market.all') },
            { value: 'favorites', label: t('market.favorites') },
            { value: 'market',    label: t('market.market') },
            { value: 'new',       label: t('market.tabNew') },
            { value: 'hot',       label: t('market.tabHot') },
            { value: 'gainers',   label: t('market.tabGainers') },
            { value: 'losers',    label: t('market.tabLosers') },
            { value: 'volume',    label: t('market.tabVolume') },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setActiveUnifiedTab(opt.value)}
              className={`relative shrink-0 pb-2.5 pt-1 px-0.5 mr-4 text-sm font-semibold transition-colors duration-200 ${
                activeUnifiedTab === opt.value ? 'text-[#0052FF]' : 'text-[#888888]'
              }`}
            >
              {opt.label}
              <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full bg-[#0052FF] transition-all duration-300 ${
                activeUnifiedTab === opt.value ? 'w-full opacity-100' : 'w-0 opacity-0'
              }`} />
            </button>
          ))}
        </div>

        {/* Chain Filters + dropdown — hidden on favorites */}
        {activeUnifiedTab !== 'favorites' && (
          <div className="relative flex items-center gap-2 mb-5">
            <div className="flex-1 flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {CHAINS.slice(0, 10).map((chain) => (
                <button
                  key={chain.value}
                  onClick={() => setChainFilter(chain.value)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg font-semibold text-xs transition-all duration-200 ${
                    chainFilter === chain.value
                      ? 'text-white'
                      : 'bg-[#F4F4F4] text-[#555555] hover:text-[#0052FF]'
                  }`}
                  style={chainFilter === chain.value ? { background: 'linear-gradient(135deg, #0052FF 0%, #0041CC 100%)' } : {}}
                >
                  {chain.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowChainDropdown(prev => !prev)}
              className="chain-dropdown-btn shrink-0 w-9 h-9 flex items-center justify-center bg-[#F4F4F4] rounded-xl text-[#555555] hover:bg-[#E8EEFF] hover:text-[#0052FF] transition-all duration-200"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            {showChainDropdown && (
              <div className="chain-dropdown-btn absolute right-0 top-full mt-2 w-56 bg-white border border-[#E5E5E5] shadow-xl rounded-2xl py-2 z-50 max-h-72 overflow-y-auto">
                <p className="px-4 py-1.5 text-xs font-semibold text-[#888888] uppercase tracking-wider sticky top-0 bg-white">
                  {t('market.selectChain')} ({CHAINS.length - 1})
                </p>
                {CHAINS.map((chain) => (
                  <button
                    key={chain.value}
                    onClick={() => { setChainFilter(chain.value); setShowChainDropdown(false); }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-[#F0F5FF] transition-colors ${
                      chainFilter === chain.value ? 'text-[#0052FF] font-semibold' : 'text-[#111111]'
                    }`}
                  >
                    <span>{chain.fullLabel}</span>
                    {chainFilter === chain.value && <div className="w-2 h-2 rounded-full bg-[#0052FF] shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {isLoading && <Spinner />}

        {/* ── FAVORITES TAB ── */}
        {!isLoading && activeUnifiedTab === 'favorites' && (
          <>
            {/* Favorites list */}
            {currentData.length === 0 ? (
              <div className="text-center py-10">
                <div className="backdrop-blur-xl bg-white/70 border border-[#0052FF]/15 rounded-xl p-8">
                  <div className="flex flex-col items-center gap-3">
                    <Star className="w-10 h-10 text-[#DDDDDD]" />
                    <p className="text-[#555555] font-semibold">{t('market.noFavoritesYet')}</p>
                    {displayData.length > 0 && (() => {
                      const suggested = [...displayData]
                        .sort((a, b) => parseFloat(b.volume.replace(/[$,BMK]/g, '')) - parseFloat(a.volume.replace(/[$,BMK]/g, '')))
                        .slice(0, 8);
                      return (
                        <div className="w-full mt-4 text-left">
                          <p className="text-xs font-semibold text-[#888888] mb-3">{t('market.suggestedForYou')}</p>
                          <div className="flex flex-wrap gap-2 justify-center">
                            {suggested.map(coin => (
                              <button
                                key={coin.symbol}
                                onClick={(e) => toggleFavorite(coin.symbol, e)}
                                className="flex items-center gap-2 px-3 py-2 bg-[#F0F5FF] rounded-xl border border-[#0052FF]/15 hover:bg-[#E8EEFF] transition-colors"
                              >
                                <img src={coin.logoUrl} alt={coin.symbol} className="w-5 h-5 rounded-full" onError={e => { e.target.style.display = 'none'; }} />
                                <span className="text-sm font-semibold text-[#111111]">{coin.symbol}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {currentData.map((crypto, index) => renderCoinCard(crypto, index))}
              </div>
            )}
          </>
        )}

        {/* ── MARKET / FILTER TABS ── */}
        {!isLoading && activeUnifiedTab !== 'favorites' && (
          <>
            {/* Market list */}
            {currentData.length === 0 ? (
              <div className="text-center py-10">
                <div className="backdrop-blur-xl bg-white/70 border border-[#0052FF]/15 rounded-xl p-8">
                  <p className="text-[#555555]">
                    {tickersError || specialTokensError ? t('market.marketDataUnavailable')
                      : marketData.length === 0 ? t('market.noMarketData')
                      : t('market.noMatch')}
                  </p>
                  {(tickersError || specialTokensError) && (
                    <button
                      onClick={handleRefreshData}
                      className="mt-4 px-6 py-2 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
                      style={{ background: 'linear-gradient(135deg, #0052FF 0%, #0041CC 40%, #0052FF 100%)' }}
                    >
                      {t('market.retry')}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                {currentData.map((crypto, index) => renderCoinCard(crypto, index))}
              </div>
            )}
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 mb-4">
            <div className="relative">
              <div className="relative backdrop-blur-xl bg-white/70 border border-[#0052FF]/15 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed text-[#111111] hover:text-[#0052FF] hover:bg-[#F0F5FF]/60"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    <span>{t('market.previous')}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {[...Array(totalPages)].map((_, i) => {
                      const page = i + 1;
                      // Show first, last, current, and pages around current
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={page}
                            onClick={() => handlePageChange(page)}
                            className={`w-10 h-10 rounded-lg font-bold text-sm transition-all duration-300 ${
                              currentPage === page
                                ? 'text-white shadow-lg'
                                : 'text-[#555555] hover:text-[#111111] hover:bg-[#F0F5FF]/60'
                            }`}
                            style={currentPage === page ? { background: 'linear-gradient(135deg, #0052FF 0%, #0041CC 40%, #0052FF 100%)' } : {}}
                          >
                            {page}
                          </button>
                        );
                      } else if (
                        page === currentPage - 2 ||
                        page === currentPage + 2
                      ) {
                        return (
                          <span key={page} className="text-[#888888] px-1">
                            ...
                          </span>
                        );
                      }
                      return null;
                    })}
                  </div>

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed text-[#111111] hover:text-[#0052FF] hover:bg-[#F0F5FF]/60"
                  >
                    <span>{t('market.next')}</span>
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                <div className="mt-3 text-center">
                  <p className="text-[#555555] text-sm">
                    {t('common.pageOf', { current: currentPage, total: totalPages })}
                    {' • '}
                    {t('common.showing', { start: startIndex + 1, end: Math.min(endIndex, filteredData.length), total: filteredData.length })} {t('market.coins')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Menu />

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
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
          scroll-behavior: smooth;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        /* Ensure smooth horizontal scrolling on touch devices */
        .overflow-x-auto {
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x mandatory;
          touch-action: pan-x;
        }
        .snap-x {
          scroll-snap-type: x mandatory;
        }
        .snap-mandatory {
          scroll-snap-type: x mandatory;
        }
        .snap-start {
          scroll-snap-align: start;
        }
      `}</style>
    </div>
  );
};

export default Market;
