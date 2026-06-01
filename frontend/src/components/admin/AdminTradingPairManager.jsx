/**
 * Admin Trading Pair Management with Auto Logo Fetching
 * Example implementation showing how to use logoService for admin operations
 */

import React, { useState, useEffect } from 'react';
// Removed useSession import since we no longer use sessionToken
import { adminTheme } from '../../styles/adminTheme';
import { ApiUtils } from '../../services/api';
import { autoFetchLogo, batchFetchLogos, getCryptoLogoUrl } from '../utils/logoService';

const AdminTradingPairManager = () => {
  // Removed sessionToken since we use session cookies for authentication
  const [newPair, setNewPair] = useState({
    baseSymbol: '',
    quoteSymbol: 'USDT',
    baseName: '',
    quoteName: 'Tether USD',
    baseLogoUrl: '',
    quoteLogoUrl: ''
  });
  const [isAutoFetching, setIsAutoFetching] = useState(false);
  const [tradingPairs, setTradingPairs] = useState([]);

  // Auto-fetch logo when base symbol changes
  useEffect(() => {
    const fetchLogo = async () => {
      if (newPair.baseSymbol && newPair.baseSymbol.length >= 2) {
        setIsAutoFetching(true);
        try {
          const logoUrl = await autoFetchLogo(newPair.baseSymbol);
          setNewPair(prev => ({
            ...prev,
            baseLogoUrl: logoUrl
          }));
        } catch (error) {
          console.error('Error fetching logo:', error);
        } finally {
          setIsAutoFetching(false);
        }
      }
    };

    const debounceTimer = setTimeout(fetchLogo, 500); // Debounce API calls
    return () => clearTimeout(debounceTimer);
  }, [newPair.baseSymbol]);

  // Batch import multiple pairs with auto logo fetching
  const handleBatchImport = async (symbolList) => {
    const symbols = symbolList.split(',').map(s => s.trim().toUpperCase());
    
    try {
      setIsAutoFetching(true);
      const logoResults = await batchFetchLogos(symbols);
      
      const newPairs = symbols.map(symbol => ({
        baseSymbol: symbol,
        quoteSymbol: 'USDT',
        baseName: symbol,
        quoteName: 'Tether USD',
        baseLogoUrl: logoResults[symbol],
        quoteLogoUrl: getCryptoLogoUrl('USDT'),
        isActive: true
      }));
      
      // Send to backend API
      await ApiUtils.post('admin/trading-pairs/batch', { pairs: newPairs });
      
      // Refresh trading pairs list
      fetchTradingPairs();
      
    } catch (error) {
      console.error('Batch import error:', error);
    } finally {
      setIsAutoFetching(false);
    }
  };

  // Add single trading pair
  const handleAddPair = async () => {
    try {
      // Auto-fetch logo if not set
      if (!newPair.baseLogoUrl && newPair.baseSymbol) {
        setIsAutoFetching(true);
        newPair.baseLogoUrl = await autoFetchLogo(newPair.baseSymbol);
      }

      const response = await ApiUtils.post('admin/trading-pairs', newPair);

      if (response) {
        // Reset form and refresh list
        setNewPair({
          baseSymbol: '',
          quoteSymbol: 'USDT',
          baseName: '',
          quoteName: 'Tether USD',
          baseLogoUrl: '',
          quoteLogoUrl: ''
        });
        fetchTradingPairs();
      }
    } catch (error) {
      console.error('Error adding trading pair:', error);
    } finally {
      setIsAutoFetching(false);
    }
  };

  // Refresh logo for existing pair
  const handleRefreshLogo = async (pairId, symbol) => {
    try {
      setIsAutoFetching(true);
      const newLogoUrl = await autoFetchLogo(symbol);
      
      await ApiUtils.put(`admin/trading-pairs/${pairId}/logo`, { logoUrl: newLogoUrl });
      
      fetchTradingPairs();
    } catch (error) {
      console.error('Error refreshing logo:', error);
    } finally {
      setIsAutoFetching(false);
    }
  };

  const fetchTradingPairs = async () => {
    try {
      const data = await ApiUtils.get('admin/trading-pairs');
      setTradingPairs(data.pairs || []);
    } catch (error) {
      console.error('Error fetching trading pairs:', error);
    }
  };

  useEffect(() => {
    fetchTradingPairs();
  }, []);

  return (
    <div className="p-6 bg-background text-primary">
      <h2 className="text-2xl font-bold mb-6">Trading Pair Management</h2>
      
      {/* Single Pair Form */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Add New Trading Pair</h3>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">Base Symbol</label>
            <input
              type="text"
              value={newPair.baseSymbol}
              onChange={(e) => setNewPair(prev => ({
                ...prev,
                baseSymbol: e.target.value.toUpperCase()
              }))}
              className="w-full p-3 bg-background border border-border rounded-lg"
              placeholder="BTC, ETH, etc."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Base Name</label>
            <input
              type="text"
              value={newPair.baseName}
              onChange={(e) => setNewPair(prev => ({
                ...prev,
                baseName: e.target.value
              }))}
              className="w-full p-3 bg-background border border-border rounded-lg"
              placeholder="Bitcoin, Ethereum, etc."
            />
          </div>
        </div>

        {/* Logo Preview */}
        {newPair.baseSymbol && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Logo Preview</label>
            <div className="flex items-center gap-3">
              <img
                src={newPair.baseLogoUrl || getCryptoLogoUrl(newPair.baseSymbol)}
                alt={newPair.baseSymbol}
                className="w-10 h-10 rounded-full"
                onError={(e) => {
                  e.target.src = getCryptoLogoUrl(newPair.baseSymbol);
                }}
              />
              <div>
                <p className="text-sm text-secondary">
                  {isAutoFetching ? 'Fetching logo...' : 'Logo auto-detected'}
                </p>
                <p className="text-xs text-muted">{newPair.baseLogoUrl}</p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleAddPair}
          disabled={!newPair.baseSymbol || !newPair.baseName || isAutoFetching}
          className="bg-brand-primary text-white px-4 py-2 rounded-lg hover:bg-brand-primary/80 disabled:opacity-50"
        >
          {isAutoFetching ? 'Adding...' : 'Add Trading Pair'}
        </button>
      </div>

      {/* Batch Import */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Batch Import</h3>
        <p className="text-sm text-secondary mb-3">
          Enter comma-separated symbols (e.g., BTC,ETH,ADA,DOT)
        </p>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="BTC,ETH,ADA,DOT"
            className="flex-1 p-3 bg-background border border-border rounded-lg"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleBatchImport(e.target.value);
                e.target.value = '';
              }
            }}
          />
          <button
            onClick={(e) => {
              const input = e.target.previousElementSibling;
              handleBatchImport(input.value);
              input.value = '';
            }}
            disabled={isAutoFetching}
            className="bg-brand-accent text-white px-6 py-3 rounded-lg hover:bg-brand-accent/80 disabled:opacity-50"
          >
            {isAutoFetching ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>

      {/* Existing Pairs List */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Existing Trading Pairs</h3>
        
        <div className="space-y-3">
          {tradingPairs.map((pair) => (
            <div key={pair.id} className="flex items-center justify-between p-3 bg-background rounded-lg">
              <div className="flex items-center gap-3">
                <img
                  src={pair.baseLogoUrl || getCryptoLogoUrl(pair.baseSymbol)}
                  alt={pair.baseSymbol}
                  className="w-8 h-8 rounded-full"
                />
                <div>
                  <p className="font-medium">{pair.symbol}</p>
                  <p className="text-sm text-secondary">{pair.baseName}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRefreshLogo(pair.id, pair.baseSymbol)}
                  className="text-brand-primary hover:text-brand-primary/80 text-sm"
                  disabled={isAutoFetching}
                >
                  Refresh Logo
                </button>
                <span className={`px-2 py-1 text-xs rounded ${
                  pair.isActive 
                    ? 'bg-brand-success/20 text-brand-success' 
                    : 'bg-brand-danger/20 text-brand-danger'
                }`}>
                  {pair.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminTradingPairManager;
