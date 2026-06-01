const express = require('express');
const router = express.Router();
const axios = require('axios');
const { createLogger } = require('../utils/logger');

const logger = createLogger('logo-proxy');

// Image proxy endpoint — CORS handled by the global cors() middleware in server.js
router.get('/proxy/:source/:symbol', async (req, res) => {
  try {
    const { source, symbol } = req.params;
    
    // Define source URL mappings
    const sources = {
      coingecko: (symbol) => {
        const coinIdMap = {
          'btc': '1/small/bitcoin.png',
          'eth': '279/small/ethereum.png',
          'usdt': '325/small/Tether.png',
          'bnb': '825/small/bnb-icon2_2x.png',
          'usdc': '6319/small/USD_Coin_icon.png',
          'xrp': '44/small/xrp-symbol-white-128.png',
          'ada': '975/small/cardano.png',
          'doge': '5/small/dogecoin.png',
          'matic': '4713/small/matic-token-icon.png',
          'sol': '4128/small/solana.png',
          'dot': '12171/small/polkadot.png',
          'avax': '12559/small/Avalanche_Circle_RedWhite_Trans.png',
          'shib': '11939/small/shiba.png',
          'trx': '1094/small/tron-logo.png',
          'dai': '9956/small/Badge_Dai.png',
          'link': '877/small/chainlink-new-logo.png',
          'uni': '12504/small/uniswap-uni.png',
          'ltc': '2/small/litecoin.png',
          'bch': '780/small/bitcoin-cash-circle.png',
          'etc': '453/small/ethereum-classic-logo.png',
          'xlm': '100/small/Stellar_symbol_black_RGB.png',
          'algo': '4380/small/download.png',
          'vet': '1167/small/VeChain-Logo-768x725.png',
          'icp': '14495/small/Internet_Computer_logo.png',
          'theta': '2538/small/theta-token-logo.png',
          'fil': '12817/small/filecoin.png',
          'atom': '1481/small/cosmos_hub.png',
          'xtz': '976/small/Tezos-logo.png',
          'dt': '1/small/bitcoin.png' // fallback for unknown tokens
        };
        const coinPath = coinIdMap[symbol.toLowerCase()] || `1/small/${symbol.toLowerCase()}.png`;
        return `https://assets.coingecko.com/coins/images/${coinPath}`;
      },
      coinmarketcap: (symbol) => `https://s2.coinmarketcap.com/static/img/coins/64x64/${symbol.toLowerCase()}.png`,
      cryptologos: (symbol) => `https://cryptologos.cc/logos/${symbol.toLowerCase()}-${symbol.toLowerCase()}-logo.png`,
      jsdelivr: (symbol) => `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/128/color/${symbol.toLowerCase()}.png`
    };

    if (!sources[source]) {
      return res.status(400).json({ error: 'Invalid source' });
    }

    const imageUrl = sources[source](symbol);
    
    logger.info('Proxying logo request', {
      source,
      symbol,
      imageUrl,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    // Fetch the image with proper headers
    const response = await axios.get(imageUrl, {
      responseType: 'stream',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
      }
    });

    // Set appropriate headers for the proxied image
    res.set({
      'Content-Type': response.headers['content-type'] || 'image/png',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'Cross-Origin-Resource-Policy': 'cross-origin'
    });

    // Pipe the image data to the response
    response.data.pipe(res);

  } catch (error) {
    logger.error('Logo proxy error', {
      error: error.message,
      source: req.params.source,
      symbol: req.params.symbol,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // For tokens that might be custom/special tokens, return a 404 with helpful info
    // instead of crashing. This helps identify when frontend should use special token logic
    res.status(404).json({ 
      error: 'Image not found',
      message: `Could not fetch logo for ${req.params.symbol} from ${req.params.source}`,
      suggestion: 'This token might be a custom/special token that should use its own logo URL instead of external crypto databases'
    });
  }
});

// Health check for the proxy service
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'logo-proxy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
