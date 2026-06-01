/**
 * Enhanced Cryptocurrency Logo Service
 * Provides reliable logo URLs using CoinGecko as the primary source
 * Distinguishes between regular cryptocurrencies and special tokens
 * Used across all components for consistent logo handling
 * Simplified to use only CoinGecko for better performance and reliability
 */

// Logo sources for regular cryptocurrencies (CoinGecko only)
const CRYPTO_LOGO_SOURCES = {
  // Primary and only - CoinGecko direct API (works without CORS)
  coingecko: {
    name: 'CoinGecko Direct',
    baseUrl: 'https://assets.coingecko.com/coins/images',
    format: (symbol) => {
      // Map common symbols to CoinGecko IDs
      const symbolMap = {
        'BTC': 'bitcoin/small/bitcoin.png',
        'ETH': 'ethereum/small/ethereum.png',
        'USDT': 'tether/small/tether.png',
        'BNB': 'binancecoin/small/binancecoin.png',
        'USDC': 'usd-coin/small/centre-usdc.png',
        'XRP': 'ripple/small/ripple.png',
        'ADA': 'cardano/small/cardano.png',
        'DOGE': 'dogecoin/small/dogecoin.png',
        'MATIC': 'polygon/small/polygon.png',
        'SOL': 'solana/small/solana.png',
        'DOT': '12171/small/polkadot-new-dot.png', // Updated DOT URL
        'LTC': 'litecoin/small/litecoin.png',
        'AVAX': 'avalanche-2/small/avalanche.png',
        'SHIB': 'shiba-inu/small/shiba-inu.png',
        'TRX': 'tron/small/tron.png',
        'LINK': 'chainlink/small/chainlink.png',
        'UNI': 'uniswap/small/uniswap.png',
        'ATOM': 'cosmos/small/cosmos.png',
        'ETC': 'ethereum-classic/small/ethereum_classic_logo.png',
        'XLM': 'stellar/small/stellar.png'
      };
      
      const coinPath = symbolMap[symbol.toUpperCase()];
      return coinPath ? `https://assets.coingecko.com/coins/images/${coinPath}` : null;
    }
  }
};

/**
 * Create a placeholder image using data URL (no external dependencies)
 * @param {string} size - Size like "40x40"
 * @param {string} bgColor - Background color hex (without #)
 * @param {string} textColor - Text color hex (without #)
 * @param {string} text - Text to display
 * @returns {string} Data URL for the placeholder image
 */
const createPlaceholderDataUrl = (size, bgColor, textColor, text) => {
  const [width, height] = size.split('x').map(Number);
  const radius = Math.min(width, height) * 0.15; // Rounded corners
  
  // Create SVG placeholder with professional styling
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#${bgColor};stop-opacity:1" />
          <stop offset="100%" style="stop-color:#${bgColor}dd;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" rx="${radius}" ry="${radius}" fill="url(#grad)" stroke="#${bgColor}aa" stroke-width="1"/>
      <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" 
            font-family="Arial, Helvetica, sans-serif" font-size="${Math.min(width, height) * 0.35}" 
            font-weight="600" fill="#${textColor}" letter-spacing="0.5px">${text}</text>
    </svg>
  `;
  
  // Convert to data URL
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

// Logo sources for special tokens (backend uploads only)
const SPECIAL_TOKEN_LOGO_SOURCES = {
  // Primary - Backend uploads with cache busting
  backend: {
    name: 'Backend Upload',
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001',
    format: (logoPath) => {
      if (!logoPath) return null;
      const timestamp = Date.now();
      const cacheBuster = `?v=${timestamp}&t=special`;
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
      return `${baseUrl}${logoPath}${cacheBuster}`;
    }
  }
};

/**
 * Get logo URL for special tokens (admin uploaded tokens)
 * @param {Object} tokenData - Special token data object
 * @param {string} tokenData.symbol - Token symbol
 * @param {string} tokenData.name - Token name
 * @param {string} tokenData.logoUrl - Backend logo path
 * @returns {string} Logo URL with fallback chain
 */
export const getSpecialTokenLogoUrl = (tokenData) => {
  const { symbol, name, logoUrl } = tokenData;
  
  // If token has a logoUrl, try to use it
  if (logoUrl) {
    if (logoUrl.startsWith('http')) {
      // External URL - use as is
      return logoUrl;
    } else if (logoUrl.startsWith('/')) {
      // Backend path - format with cache busting
      return SPECIAL_TOKEN_LOGO_SOURCES.backend.format(logoUrl);
    }
  }
  
  // Fallback to branded placeholder
  return getSpecialTokenPlaceholder(symbol, name);
};

/**
 * Get fallback URLs for special tokens
 * @param {Object} tokenData - Special token data object
 * @returns {Array<string>} Array of fallback URLs
 */
export const getSpecialTokenFallbackUrls = (tokenData) => {
  const { symbol, name, logoUrl } = tokenData;
  const fallbacks = [];
  
  // Try backend uploaded logo first
  if (logoUrl && logoUrl.startsWith('/')) {
    fallbacks.push(SPECIAL_TOKEN_LOGO_SOURCES.backend.format(logoUrl));
  }
  
  // Add special token placeholders (never use regular crypto logos)
  fallbacks.push(getSpecialTokenPlaceholder(symbol, name, 'primary'));
  fallbacks.push(getSpecialTokenPlaceholder(symbol, name, 'secondary'));
  fallbacks.push(getSpecialTokenPlaceholder(symbol, name, 'tertiary'));
  
  return fallbacks;
};

/**
 * Get cryptocurrency logo URL for regular tokens
 * @param {string} symbol - Cryptocurrency symbol (e.g., 'BTC', 'ETH')
 * @param {Object} options - Additional options
 * @param {string} options.pair - Trading pair info (optional)
 * @param {Array} options.tradingPairs - Trading pairs data (optional)
 * @returns {string} Logo URL
 */
export const getCryptoLogoUrl = (symbol, options = {}) => {
  // Handle undefined or null symbol
  if (!symbol || typeof symbol !== 'string') {
    console.warn('getCryptoLogoUrl: Invalid symbol provided:', symbol);
    return getRegularCryptoPlaceholder('TOKEN');
  }

  const { pair, tradingPairs } = options;
  
  // First priority: Check if logo URL is provided in trading pairs data
  if (pair && tradingPairs && tradingPairs.length > 0) {
    const pairInfo = tradingPairs.find(p => p.symbol === pair);
    if (pairInfo && pairInfo.baseLogoUrl) {
      return pairInfo.baseLogoUrl;
    }
  }

  // Use backend logo proxy to get official cryptocurrency logos
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
  return `${baseUrl}/api/v1/logos/proxy/coingecko/${symbol.toLowerCase()}`;
};

/**
 * Get logo URL for a specific source through backend proxy
 * @param {string} symbol - Cryptocurrency symbol
 * @param {string} sourceName - Source name ('coingecko', 'jsdelivr', 'cryptologos', 'coinmarketcap')
 * @returns {string|null} Logo URL or null if source not found
 */
export const getCryptoLogoUrlFromSource = (symbol, sourceName) => {
  const validSources = ['coingecko', 'jsdelivr', 'cryptologos', 'coinmarketcap'];
  
  if (!validSources.includes(sourceName)) {
    console.warn(`Invalid logo source: ${sourceName}. Valid sources: ${validSources.join(', ')}`);
    return getRegularCryptoPlaceholder(symbol);
  }

  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
  return `${baseUrl}/api/v1/logos/proxy/${sourceName}/${symbol.toLowerCase()}`;
};

/**
 * Get array of fallback logo URLs for regular cryptocurrencies
 * @param {string} symbol - Cryptocurrency symbol
 * @returns {Array<string>} Array of logo URLs in order of preference
 */
export const getCryptoFallbackUrls = (symbol) => {
  const fallbackUrls = [];
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
  const symbolLower = symbol.toLowerCase();
  
  // Try multiple sources through the backend proxy
  fallbackUrls.push(`${baseUrl}/api/v1/logos/proxy/coingecko/${symbolLower}`);
  fallbackUrls.push(`${baseUrl}/api/v1/logos/proxy/jsdelivr/${symbolLower}`);
  fallbackUrls.push(`${baseUrl}/api/v1/logos/proxy/cryptologos/${symbolLower}`);
  
  // Add branded placeholders as final fallbacks
  fallbackUrls.push(getRegularCryptoPlaceholder(symbol, 'primary'));
  fallbackUrls.push(getRegularCryptoPlaceholder(symbol, 'secondary'));
  
  return fallbackUrls;
};

/**
 * Get special token placeholder (branded for special tokens)
 * @param {string} symbol - Token symbol
 * @param {string} name - Token name (optional)
 * @param {string} variant - Placeholder variant (primary, secondary, tertiary)
 * @returns {string} Placeholder URL
 */
export const getSpecialTokenPlaceholder = (symbol, name = '', variant = 'primary') => {
  const variants = {
    primary: {
      bg: '10B981',    // Green
      text: 'ffffff',  // White
      size: '40x40'
    },
    secondary: {
      bg: '059669',    // Darker green
      text: 'ffffff',  // White  
      size: '32x32'
    },
    tertiary: {
      bg: '047857',    // Even darker green
      text: 'ffffff',  // White
      size: '40x40'
    }
  };
  
  const config = variants[variant] || variants.primary;
  const displayText = symbol.toUpperCase().slice(0, 3);
  
  // Use data URL instead of external service for better reliability
  return createPlaceholderDataUrl(config.size, config.bg, config.text, displayText);
};

/**
 * Get regular crypto placeholder (branded for cryptocurrencies)
 * @param {string} symbol - Cryptocurrency symbol
 * @param {string} variant - Placeholder variant (primary, secondary)
 * @returns {string} Placeholder URL
 */
export const getRegularCryptoPlaceholder = (symbol, variant = 'primary') => {
  // Handle undefined or invalid symbol
  if (!symbol || typeof symbol !== 'string') {
    symbol = 'TOKEN';
  }

  // Get color based on symbol for more visual variety
  const getSymbolColor = (sym) => {
    const colors = {
      'BTC': { bg: 'F7931A', text: 'ffffff' }, // Bitcoin orange
      'ETH': { bg: '627EEA', text: 'ffffff' }, // Ethereum blue
      'USDT': { bg: '26A17B', text: 'ffffff' }, // Tether green
      'BNB': { bg: 'F3BA2F', text: '000000' }, // Binance yellow
      'USDC': { bg: '2775CA', text: 'ffffff' }, // USD Coin blue
      'XRP': { bg: '23292F', text: 'ffffff' }, // Ripple black
      'ADA': { bg: '3468c0', text: 'ffffff' }, // Cardano blue
      'DOGE': { bg: 'C2A633', text: 'ffffff' }, // Dogecoin gold
      'MATIC': { bg: '8247E5', text: 'ffffff' }, // Polygon purple
      'SOL': { bg: '9945FF', text: 'ffffff' }, // Solana purple
      'DOT': { bg: 'E6007A', text: 'ffffff' }, // Polkadot pink
      'LTC': { bg: 'BFBBBB', text: '000000' }, // Litecoin silver
      'AVAX': { bg: 'E84142', text: 'ffffff' }, // Avalanche red
      'SHIB': { bg: 'FFA409', text: '000000' }, // Shiba orange
      'TRX': { bg: 'FF060A', text: 'ffffff' }, // Tron red
      'LINK': { bg: '375BD2', text: 'ffffff' }, // Chainlink blue
      'UNI': { bg: 'FF007A', text: 'ffffff' }, // Uniswap pink
      'ATOM': { bg: '2E3148', text: 'ffffff' }, // Cosmos dark
      'ETC': { bg: '3AB83A', text: 'ffffff' }, // Ethereum Classic green
      'XLM': { bg: '14B6E7', text: 'ffffff' }  // Stellar light blue
    };
    
    return colors[sym.toUpperCase()] || { bg: '6366f1', text: 'ffffff' }; // Default purple
  };

  const symbolColor = getSymbolColor(symbol);
  
  const variants = {
    primary: {
      ...symbolColor,
      size: '40x40'
    },
    secondary: {
      bg: '4f46e5',    // Darker purple fallback
      text: 'ffffff',  // White
      size: '32x32'
    }
  };
  
  const config = variants[variant] || variants.primary;
  const displayText = symbol.toUpperCase().slice(0, 3);
  
  // Use data URL instead of external service for better reliability
  return createPlaceholderDataUrl(config.size, config.bg, config.text, displayText);
};

/**
 * Main logo service function - automatically detects token type
 * @param {string|Object} tokenData - Symbol string for crypto, or token object for special tokens
 * @param {Object} options - Additional options
 * @returns {string} Logo URL
 */
export const getLogoUrl = (tokenData, options = {}) => {
  // If it's a string, treat as regular cryptocurrency
  if (typeof tokenData === 'string') {
    return getCryptoLogoUrl(tokenData, options);
  }
  
  // If it's an object with isSpecial or has special token properties
  if (tokenData && typeof tokenData === 'object') {
    if (tokenData.isSpecial || tokenData.logoUrl || tokenData.currentPrice !== undefined) {
      return getSpecialTokenLogoUrl(tokenData);
    }
    
    // Otherwise treat symbol as regular crypto
    return getCryptoLogoUrl(tokenData.symbol || tokenData, options);
  }
  
  // Fallback
  return getRegularCryptoPlaceholder('?');
};

/**
 * Get fallback URLs - automatically detects token type
 * @param {string|Object} tokenData - Symbol string for crypto, or token object for special tokens
 * @returns {Array<string>} Array of fallback URLs
 */
export const getLogoFallbackUrls = (tokenData) => {
  // If it's a string, treat as regular cryptocurrency
  if (typeof tokenData === 'string') {
    return getCryptoFallbackUrls(tokenData);
  }
  
  // If it's an object with isSpecial or has special token properties
  if (tokenData && typeof tokenData === 'object') {
    if (tokenData.isSpecial || tokenData.logoUrl || tokenData.currentPrice !== undefined) {
      return getSpecialTokenFallbackUrls(tokenData);
    }
    
    // Otherwise treat symbol as regular crypto
    return getCryptoFallbackUrls(tokenData.symbol || tokenData);
  }
  
  // Fallback
  return [getRegularCryptoPlaceholder('?')];
};

/**
 * Auto-fetch logo for a cryptocurrency symbol (compatibility function)
 * @param {string} symbol - Cryptocurrency symbol
 * @returns {Promise<string>} Promise that resolves to logo URL
 */
export const autoFetchLogo = async (symbol) => {
  return getCryptoLogoUrl(symbol);
};

/**
 * Batch fetch logos for multiple symbols (compatibility function)
 * @param {Array<string>} symbols - Array of cryptocurrency symbols
 * @returns {Promise<Object>} Promise that resolves to object with symbol-URL mappings
 */
export const batchFetchLogos = async (symbols) => {
  const results = {};
  
  symbols.forEach(symbol => {
    results[symbol] = getCryptoLogoUrl(symbol);
  });
  
  return results;
};

/**
 * Legacy function - kept for backward compatibility
 * @param {string} symbol - Cryptocurrency symbol
 * @returns {string} Default icon URL
 */
export const getDefaultCryptoIcon = (symbol) => {
  return getRegularCryptoPlaceholder(symbol);
};

/**
 * Preload logo images for better UX
 * @param {Array} tokens - Array of tokens (strings for crypto, objects for special tokens)
 * @param {Object} options - Preload options
 */
export const preloadLogos = (tokens, options = {}) => {
  tokens.forEach(token => {
    const logoUrl = getLogoUrl(token, options);
    
    // Create image element to trigger preload
    const img = new Image();
    img.src = logoUrl;
    
    // Optional: Add to cache or perform other preload actions
    img.onload = () => {
      // Logo preloaded successfully
    };
    
    img.onerror = () => {
      const identifier = typeof token === 'string' ? token : token.symbol || 'unknown';
      console.warn(`Failed to preload logo for ${identifier}`);
    };
  });
};

/**
 * Legacy function - kept for backward compatibility
 */
export const preloadCryptoLogos = preloadLogos;

/**
 * Get all available logo sources
 * @returns {Object} Available logo sources
 */
export const getAvailableLogoSources = () => {
  return {
    crypto: Object.keys(CRYPTO_LOGO_SOURCES).map(key => ({
      key,
      name: CRYPTO_LOGO_SOURCES[key].name,
      baseUrl: CRYPTO_LOGO_SOURCES[key].baseUrl
    })),
    specialToken: Object.keys(SPECIAL_TOKEN_LOGO_SOURCES).map(key => ({
      key,
      name: SPECIAL_TOKEN_LOGO_SOURCES[key].name,
      baseUrl: SPECIAL_TOKEN_LOGO_SOURCES[key].baseUrl
    }))
  };
};

/**
 * Clear logo cache (if implemented)
 */
export const clearLogoCache = () => {
  // Implementation depends on caching strategy
};

/**
 * Test logo source availability
 * @param {string} sourceName - Source name to test
 * @param {string} testSymbol - Symbol to test with (default: 'btc')
 * @returns {Promise<boolean>} Promise that resolves to true if source is available
 */
export const testLogoSource = async (sourceName, testSymbol = 'btc') => {
  const source = CRYPTO_LOGO_SOURCES[sourceName];
  if (!source) {
    return false;
  }

  try {
    const testUrl = source.format(testSymbol);
    const response = await fetch(testUrl, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.warn(`Logo source ${sourceName} test failed:`, error);
    return false;
  }
};

/**
 * Get logo statistics
 * @returns {Object} Logo service statistics
 */
export const getLogoStats = () => {
  return {
    cryptoSources: 4, // coingecko, jsdelivr, cryptologos, coinmarketcap
    specialTokenSources: Object.keys(SPECIAL_TOKEN_LOGO_SOURCES).length,
    sources: getAvailableLogoSources(),
    placeholderTypes: ['crypto', 'special-token'],
    placeholderMethod: 'data-url-branded', // Using branded data URLs as fallback
    corsProxyEnabled: true, // Using backend proxy to bypass CORS
    externalSourcesBlocked: false, // Accessible through backend proxy
    proxyEndpoint: '/api/v1/logos/proxy'
  };
};

// Export default for backward compatibility
export default {
  // Main functions
  getLogoUrl,
  getLogoFallbackUrls,
  
  // Specific functions
  getCryptoLogoUrl,
  getCryptoFallbackUrls,
  getSpecialTokenLogoUrl,
  getSpecialTokenFallbackUrls,
  
  // Placeholders
  getRegularCryptoPlaceholder,
  getSpecialTokenPlaceholder,
  
  // Legacy compatibility
  getCryptoLogoUrlFromSource,
  getDefaultCryptoIcon,
  preloadCryptoLogos,
  preloadLogos,
  autoFetchLogo,
  batchFetchLogos,
  
  // Utilities
  getAvailableLogoSources,
  clearLogoCache,
  testLogoSource,
  getLogoStats
};
