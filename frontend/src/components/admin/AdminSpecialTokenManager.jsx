import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { ApiUtils } from '../../services/api';
import { Button } from "@/components/ui/button";
import { adminTheme } from '../../styles/adminTheme';
import { 
  ArrowLeftIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  PlayIcon,
  PauseIcon,
  ChartBarIcon
} from "@heroicons/react/24/outline";

const AdminSpecialTokenManager = () => {
  const navigate = useNavigate();
  const { admin } = useAdminAuth();
  const [loading, setLoading] = useState(false);
  const [tokens, setTokens] = useState([]);
  const [filteredTokens, setFilteredTokens] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingToken, setEditingToken] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });
  const [message, setMessage] = useState({ type: '', text: '' });

  // Form state for adding/editing special tokens
  const [formData, setFormData] = useState({
    symbol: '',
    name: '',
    priceMin: '',
    priceMax: '',
    currentPrice: '',
    logoUrl: '',
    logoFile: null,
    simulationType: 'target_based',
    simulationInterval: 30,
    volatility: 0.02,
    trendDirection: 'neutral',
    amplitude: 0.1,
    frequency: 1,
    targetPercentage: 10,
    targetTimeframe: 3600,
    description: 'This is a simulated token for demonstration purposes.',
    tooltip: 'Simulated token with demo price movements',
    badgeText: 'SPECIAL',
    badgeColor: '#10B981',
    backgroundColor: '#065F46',
    isActive: true,
    showInMarket: true,
    marketPriority: 0
  });

  useEffect(() => {
    fetchTokens();
  }, [statusFilter]);

  // Debounce search term to prevent API call on every keystroke
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchTokens();
    }, 500);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm]);

  const fetchTokens = async () => {
    try {
      setLoading(true);
      const data = await ApiUtils.get(`/admin/special-tokens/special-tokens?status=${statusFilter}&search=${searchTerm}&limit=20`);
      setTokens(data.data.tokens);
      setFilteredTokens(data.data.tokens);
      setPagination(data.data.pagination);
    } catch (error) {
      console.error('Error fetching special tokens:', error);
      
      // More detailed error handling
      let errorMessage = 'Failed to fetch special tokens';
      if (error.message.includes('non-JSON response')) {
        errorMessage = 'Server returned an unexpected response. Please check if you are logged in as an admin.';
      } else if (error.message.includes('401') || error.message.includes('403')) {
        errorMessage = 'Access denied. Please ensure you are logged in as an admin.';
      } else if (error.message.includes('429')) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  // Create stable input handlers using refs to prevent focus loss
  const inputHandlers = useRef({});
  
  const getInputHandler = (field, transform) => {
    const key = `${field}_${transform || 'default'}`;
    if (!inputHandlers.current[key]) {
      inputHandlers.current[key] = (e) => {
        let value = e.target.value;
        
        // Handle different input types
        if (e.target.type === 'checkbox') {
          value = e.target.checked;
        } else if (e.target.type === 'file') {
          value = e.target.files[0];
        } else if (field === 'symbol') {
          value = value.toUpperCase();
        } else if (transform === 'number') {
          value = parseFloat(value) || 0;
        } else if (transform === 'int') {
          value = parseInt(value) || 0;
        }
        
        setFormData(prev => ({ ...prev, [field]: value }));
      };
    }
    return inputHandlers.current[key];
  };

  const getFilterHandler = (field) => {
    const key = `filter_${field}`;
    if (!inputHandlers.current[key]) {
      inputHandlers.current[key] = (e) => {
        const value = e.target.value;
        if (field === 'search') {
          setSearchTerm(value);
        } else if (field === 'status') {
          setStatusFilter(value);
        }
      };
    }
    return inputHandlers.current[key];
  };

  const resetForm = () => {
    setFormData({
      symbol: '',
      name: '',
      priceMin: '',
      priceMax: '',
      currentPrice: '',
      logoUrl: '',
      logoFile: null,
      simulationType: 'target_based',
      simulationInterval: 30,
      volatility: 0.02,
      trendDirection: 'neutral',
      amplitude: 0.1,
      frequency: 1,
      targetPercentage: 10,
      targetTimeframe: 3600,
      description: 'This is a simulated token for demonstration purposes.',
      tooltip: 'Simulated token with demo price movements',
      badgeText: 'SPECIAL',
      badgeColor: '#10B981',
      backgroundColor: '#065F46',
      isActive: true,
      showInMarket: true,
      marketPriority: 0
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.symbol || !formData.name || !formData.priceMin || !formData.priceMax) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }

    const priceMin = parseFloat(formData.priceMin);
    const priceMax = parseFloat(formData.priceMax);

    if (priceMin >= priceMax) {
      setMessage({ type: 'error', text: 'Minimum price must be less than maximum price' });
      return;
    }

    // Set current price to middle of range if not specified
    let currentPrice = parseFloat(formData.currentPrice);
    if (!currentPrice || currentPrice < priceMin || currentPrice > priceMax) {
      currentPrice = (priceMin + priceMax) / 2;
    }

    try {
      setLoading(true);
      
      const formDataToSend = new FormData();
      Object.keys(formData).forEach(key => {
        if (key === 'logoFile' && formData[key]) {
          formDataToSend.append('logo', formData[key]);
        } else if (key === 'currentPrice') {
          formDataToSend.append(key, currentPrice.toString());
        } else if (key !== 'logoFile') {
          formDataToSend.append(key, formData[key]);
        }
      });

      // Use the correct API base URL
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1';
      const url = editingToken 
        ? `${API_BASE_URL}/admin/special-tokens/special-tokens/${editingToken._id}`
        : `${API_BASE_URL}/admin/special-tokens/special-tokens`;
      
      const method = editingToken ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        credentials: 'include',
        body: formDataToSend
      });

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Server returned non-JSON response: ${response.status} ${response.statusText}. Response: ${text.substring(0, 100)}...`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save special token');
      }

      setMessage({ 
        type: 'success', 
        text: editingToken ? 'Special token updated successfully' : 'Special token created successfully' 
      });
      
      setShowAddModal(false);
      setEditingToken(null);
      resetForm();
      fetchTokens();

    } catch (error) {
      console.error('Error saving special token:', error);
      
      // More detailed error handling
      let errorMessage = 'Failed to save special token';
      if (error.message.includes('non-JSON response')) {
        errorMessage = 'Server returned an unexpected response. Please check if you are logged in as an admin.';
      } else if (error.message.includes('401') || error.message.includes('403')) {
        errorMessage = 'Access denied. Please ensure you are logged in as an admin.';
      } else if (error.message.includes('404')) {
        errorMessage = 'API endpoint not found. Please check if the backend server is running.';
      } else if (error.message.includes('429')) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (token) => {
    setEditingToken(token);
    
    // Handle legacy simulation types that might not be in our enum
    let simulationType = token.simulationConfig.type;
    const validTypes = ['random_walk', 'sinusoidal', 'trend', 'target_based'];
    if (!validTypes.includes(simulationType)) {
      console.warn(`Invalid simulation type '${simulationType}' for token ${token.symbol}, defaulting to 'target_based'`);
      simulationType = 'target_based';
    }
    
    setFormData({
      symbol: token.symbol,
      name: token.name,
      priceMin: token.priceRange.min.toString(),
      priceMax: token.priceRange.max.toString(),
      currentPrice: token.currentPrice.toString(),
      logoUrl: token.logoUrl,
      logoFile: null,
      simulationType: simulationType,
      simulationInterval: token.simulationConfig.interval,
      volatility: token.simulationConfig.volatility,
      trendDirection: token.simulationConfig.trendDirection,
      amplitude: token.simulationConfig.amplitude,
      frequency: token.simulationConfig.frequency,
      targetPercentage: token.simulationConfig.targetPercentage || 10,
      targetTimeframe: token.simulationConfig.targetTimeframe || 3600,
      description: token.description,
      tooltip: token.tooltip,
      badgeText: token.badge.text,
      badgeColor: token.badge.color,
      backgroundColor: token.badge.backgroundColor,
      isActive: token.isActive,
      showInMarket: token.showInMarket,
      marketPriority: token.marketPriority
    });
    setShowAddModal(true);
  };

  const handleDelete = async (tokenId) => {
    if (!confirm('Are you sure you want to delete this special token?')) return;

    try {
      await ApiUtils.delete(`/admin/special-tokens/special-tokens/${tokenId}`);
      setMessage({ type: 'success', text: 'Special token deleted successfully' });
      fetchTokens();

    } catch (error) {
      console.error('Error deleting special token:', error);
      setMessage({ type: 'error', text: 'Failed to delete special token' });
    }
  };

  const handleToggleStatus = async (tokenId) => {
    try {
      const data = await ApiUtils.patch(`/admin/special-tokens/special-tokens/${tokenId}/toggle`);
      setMessage({ type: 'success', text: data.message });
      fetchTokens();

    } catch (error) {
      console.error('Error toggling token status:', error);
      setMessage({ type: 'error', text: 'Failed to toggle token status' });
    }
  };

  const handleSimulate = async (tokenId) => {
    try {
      const data = await ApiUtils.post(`/admin/special-tokens/special-tokens/${tokenId}/simulate`);
      setMessage({ type: 'success', text: 'Price simulation executed successfully' });
      fetchTokens();

    } catch (error) {
      console.error('Error simulating price update:', error);
      setMessage({ type: 'error', text: 'Failed to simulate price update' });
    }
  };

  const getStatusBadge = (token) => {
    if (token.isActive) {
      return <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">Active</span>;
    } else {
      return <span className="px-2 py-1 bg-gray-500/20 text-gray-400 text-xs rounded-full">Inactive</span>;
    }
  };

  const formatPrice = (price) => {
    return price < 1 ? price.toFixed(6) : price.toFixed(2);
  };

  if (!admin) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-2">Access Denied</h1>
          <p className="text-gray-400">You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${adminTheme.background} ${adminTheme.textPrimary}`}>
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 mb-6 ${adminTheme.shadow}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 ${adminTheme.accent} rounded-xl ${adminTheme.shadow}`}>
                <SparklesIcon className="w-8 h-8 text-[#FCD535]" />
              </div>
              <div>
                <h1 className={`text-3xl font-bold ${adminTheme.textPrimary}`}>Special Token Management</h1>
                <p className={`${adminTheme.textSecondary} mt-1`}>Create and manage simulated tokens with live price movements</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => navigate('/u/dashboard')}
                className={adminTheme.buttonSecondary}
              >
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
              <Button
                onClick={() => setShowAddModal(true)}
                className={adminTheme.buttonPrimary}
              >
                <PlusIcon className="w-5 h-5 mr-2" />
                Add Special Token
              </Button>
            </div>
          </div>
        </div>

        {/* Message */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-xl border ${
            message.type === 'success' 
              ? `${adminTheme.successBg} text-green-400` 
              : `${adminTheme.dangerBg} text-red-400`
          }`}>
            {message.text}
          </div>
        )}

        {/* Filters */}
        <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 mb-6 ${adminTheme.shadow}`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Search</label>
              <div className="relative">
                <MagnifyingGlassIcon className={`w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 ${adminTheme.textSecondary}`} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={getFilterHandler('search')}
                  className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg pl-10 pr-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                  placeholder="Search special tokens..."
                />
              </div>
            </div>
            
            <div>
              <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Status</label>
              <select
                value={statusFilter}
                onChange={getFilterHandler('status')}
                className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
              >
                <option value="all">All Tokens</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div className="flex items-end">
              <div className={`text-sm ${adminTheme.textSecondary}`}>
                <div>Total tokens: {pagination.total}</div>
                <div>Showing page {pagination.current} of {pagination.pages}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tokens Table */}
        <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl ${adminTheme.shadow} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`${adminTheme.surface}`}>
                <tr>
                  <th className={`text-left p-4 ${adminTheme.textSecondary} font-medium`}>Token</th>
                  <th className={`text-left p-4 ${adminTheme.textSecondary} font-medium`}>Status</th>
                  <th className={`text-left p-4 ${adminTheme.textSecondary} font-medium`}>Current Price</th>
                  <th className={`text-left p-4 ${adminTheme.textSecondary} font-medium`}>Price Range</th>
                  <th className={`text-left p-4 ${adminTheme.textSecondary} font-medium`}>Simulation</th>
                  <th className={`text-left p-4 ${adminTheme.textSecondary} font-medium`}>Last Update</th>
                  <th className={`text-right p-4 ${adminTheme.textSecondary} font-medium`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center p-8">
                      <div className={`flex items-center justify-center gap-2 ${adminTheme.textSecondary}`}>
                        <div className="w-5 h-5 border border-gray-600 border-t-[#FCD535] rounded-full animate-spin"></div>
                        Loading special tokens...
                      </div>
                    </td>
                  </tr>
                ) : filteredTokens.length === 0 ? (
                  <tr>
                    <td colSpan="7" className={`text-center p-8 ${adminTheme.textSecondary}`}>
                      No special tokens found
                    </td>
                  </tr>
                ) : (
                  filteredTokens.map((token) => (
                    <tr key={token._id} className={`${adminTheme.border} border-t ${adminTheme.hover} transition-colors`}>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {token.logoUrl ? (
                            <img src={token.logoUrl} alt={token.symbol} className="w-8 h-8 rounded-full" />
                          ) : (
                            <div className="w-8 h-8 bg-[#FCD535]/10 rounded-full flex items-center justify-center text-xs font-medium text-[#FCD535]">
                              {token.symbol.slice(0, 2)}
                            </div>
                          )}
                          <div>
                            <div className={`font-medium ${adminTheme.textPrimary} flex items-center gap-2`}>
                              {token.symbol}
                              <span 
                                className="px-2 py-1 text-xs rounded-full"
                                style={{ 
                                  color: token.badge.color, 
                                  backgroundColor: token.badge.backgroundColor 
                                }}
                              >
                                {token.badge.text}
                              </span>
                            </div>
                            <div className={`text-sm ${adminTheme.textSecondary}`}>{token.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">{getStatusBadge(token)}</td>
                      <td className={`p-4 ${adminTheme.textPrimary} font-mono`}>${formatPrice(token.currentPrice)}</td>
                      <td className={`p-4 ${adminTheme.textSecondary} text-sm`}>
                        ${formatPrice(token.priceRange.min)} - ${formatPrice(token.priceRange.max)}
                      </td>
                      <td className="p-4">
                        <div className={`text-sm ${adminTheme.textSecondary}`}>
                          <div className="capitalize">{token.simulationConfig.type.replace('_', ' ')}</div>
                          <div>{token.simulationConfig.interval}s intervals</div>
                        </div>
                      </td>
                      <td className={`p-4 ${adminTheme.textSecondary} text-sm`}>
                        {token.lastSimulationUpdate ? new Date(token.lastSimulationUpdate).toLocaleString() : 'Never'}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleSimulate(token._id)}
                            className={`p-1 ${adminTheme.textSecondary} hover:text-blue-500 transition-colors`}
                            title="Simulate Price Update"
                          >
                            <PlayIcon className="w-5 h-5" />
                          </button>
                          
                          <button
                            onClick={() => handleEdit(token)}
                            className={`p-1 ${adminTheme.textSecondary} hover:text-[#FCD535] transition-colors`}
                            title="Edit"
                          >
                            <PencilIcon className="w-5 h-5" />
                          </button>
                          
                          <button
                            onClick={() => handleToggleStatus(token._id)}
                            className={`p-1 ${adminTheme.textSecondary} hover:text-yellow-400 transition-colors`}
                            title={token.isActive ? "Deactivate" : "Activate"}
                          >
                            {token.isActive ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                          </button>
                          
                          <button
                            onClick={() => handleDelete(token._id)}
                            className={`p-1 ${adminTheme.textSecondary} hover:text-red-400 transition-colors`}
                            title="Delete"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className={`mt-6 ${adminTheme.card} ${adminTheme.border} rounded-2xl p-4 ${adminTheme.shadow}`}>
            <div className="flex justify-center">
              <div className={`${adminTheme.textSecondary} text-sm`}>
                Page {pagination.current} of {pagination.pages} ({pagination.total} total special tokens)
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto ${adminTheme.shadow}`}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className={`text-2xl font-bold ${adminTheme.textPrimary}`}>
                  {editingToken ? 'Edit Special Token' : 'Add Special Token'}
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingToken(null);
                    resetForm();
                  }}
                  className={`${adminTheme.textSecondary} hover:${adminTheme.textPrimary}`}
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Symbol *</label>
                    <input
                      type="text"
                      value={formData.symbol}
                      onChange={getInputHandler('symbol')}
                      className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                      placeholder="DEMO"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={getInputHandler('name')}
                      className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                      placeholder="Demo Token"
                      required
                    />
                  </div>
                </div>

                {/* Price Range */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Min Price (USD) *</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={formData.priceMin}
                      onChange={getInputHandler('priceMin')}
                      className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                      min="0"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Max Price (USD) *</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={formData.priceMax}
                      onChange={getInputHandler('priceMax')}
                      className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                      min="0"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                      Current Price (USD)
                      <span className="text-xs text-gray-400 ml-2">(Leave empty to auto-calculate)</span>
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      value={formData.currentPrice}
                      onChange={getInputHandler('currentPrice')}
                      className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                      min="0"
                      placeholder="Will use middle of range"
                    />
                  </div>
                </div>

                {/* Logo */}
                <div>
                  <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                    Upload Logo <span className="text-xs text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={getInputHandler('logoFile')}
                    className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535] file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-sm file:bg-[#FCD535]/20 file:text-[#FCD535]`}
                  />
                  <p className="text-xs text-gray-500 mt-1">Will use default logo if none provided</p>
                </div>

                {/* Simulation Configuration */}
                <div className="space-y-4">
                  <h3 className={`text-lg font-semibold ${adminTheme.textPrimary}`}>Simulation Configuration</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Simulation Type</label>
                      <select
                        value={formData.simulationType}
                        onChange={getInputHandler('simulationType')}
                        className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                      >
                        <option value="target_based">Target Based (Recommended)</option>
                        <option value="random_walk">Random Walk</option>
                        <option value="sinusoidal">Sinusoidal</option>
                        <option value="trend">Trend</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Simulation Interval (seconds)</label>
                      <input
                        type="number"
                        min="5"
                        max="300"
                        value={formData.simulationInterval}
                        onChange={getInputHandler('simulationInterval', 'int')}
                        className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Volatility</label>
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        max="1"
                        value={formData.volatility}
                        onChange={getInputHandler('volatility', 'number')}
                        className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                      />
                    </div>
                    
                    {formData.simulationType === 'trend' && (
                      <div>
                        <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Trend Direction</label>
                        <select
                          value={formData.trendDirection}
                          onChange={getInputHandler('trendDirection')}
                          className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                        >
                          <option value="up">Upward</option>
                          <option value="down">Downward</option>
                          <option value="neutral">Neutral</option>
                        </select>
                      </div>
                    )}
                    
                    {formData.simulationType === 'sinusoidal' && (
                      <>
                        <div>
                          <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Amplitude</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max="1"
                            value={formData.amplitude}
                            onChange={getInputHandler('amplitude', 'number')}
                            className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                          />
                        </div>
                        
                        <div>
                          <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Frequency</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="10"
                            value={formData.frequency}
                            onChange={getInputHandler('frequency', 'number')}
                            className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                          />
                        </div>
                      </>
                    )}
                    
                    {formData.simulationType === 'target_based' && (
                      <>
                        <div>
                          <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                            Target Percentage Change
                            <span className="text-xs text-gray-400 ml-2">(e.g., 10 for +10%, -5 for -5%)</span>
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="-50"
                            max="100"
                            value={formData.targetPercentage}
                            onChange={getInputHandler('targetPercentage', 'number')}
                            className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                          />
                        </div>
                        
                        <div>
                          <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>
                            Target Timeframe
                            <span className="text-xs text-gray-400 ml-2">(time to reach target)</span>
                          </label>
                          <select
                            value={formData.targetTimeframe}
                            onChange={getInputHandler('targetTimeframe', 'int')}
                            className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                          >
                            <option value="300">5 minutes</option>
                            <option value="600">10 minutes</option>
                            <option value="1800">30 minutes</option>
                            <option value="3600">1 hour</option>
                            <option value="7200">2 hours</option>
                            <option value="21600">6 hours</option>
                            <option value="43200">12 hours</option>
                            <option value="86400">24 hours</option>
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                  
                  {formData.simulationType === 'target_based' && (
                    <div className={`p-4 ${adminTheme.surface} rounded-lg border border-blue-500/20`}>
                      <h4 className={`text-sm font-semibold ${adminTheme.textPrimary} mb-2`}>
                        💡 Target-Based Simulation Info
                      </h4>
                      <p className={`text-xs ${adminTheme.textSecondary}`}>
                        This creates realistic trading movements towards your target. For example:
                        <br />• Set <strong>+10%</strong> target in <strong>1 hour</strong> = price will gradually increase by 10% over 1 hour
                        <br />• Set <strong>-5%</strong> target in <strong>30 minutes</strong> = price will gradually decrease by 5% over 30 minutes
                        <br />• Charts will show natural candlestick patterns with support/resistance levels
                      </p>
                    </div>
                  )}
                </div>

                {/* Badge Configuration */}
                <div className="space-y-4">
                  <h3 className={`text-lg font-semibold ${adminTheme.textPrimary}`}>Badge Configuration</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Badge Text</label>
                      <input
                        type="text"
                        value={formData.badgeText}
                        onChange={getInputHandler('badgeText')}
                        className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                        placeholder="SPECIAL"
                      />
                    </div>
                    
                    <div>
                      <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Badge Color</label>
                      <input
                        type="color"
                        value={formData.badgeColor}
                        onChange={getInputHandler('badgeColor')}
                        className={`w-full h-10 ${adminTheme.surface} ${adminTheme.border} rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                      />
                    </div>
                    
                    <div>
                      <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Background Color</label>
                      <input
                        type="color"
                        value={formData.backgroundColor}
                        onChange={getInputHandler('backgroundColor')}
                        className={`w-full h-10 ${adminTheme.surface} ${adminTheme.border} rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                      />
                    </div>
                  </div>
                </div>

                {/* Description and Settings */}
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Description</label>
                    <textarea
                      value={formData.description}
                      onChange={getInputHandler('description')}
                      className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                      rows="3"
                      placeholder="This is a simulated token for demonstration purposes."
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Tooltip</label>
                      <input
                        type="text"
                        value={formData.tooltip}
                        onChange={getInputHandler('tooltip')}
                        className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                        placeholder="Simulated token with demo price movements"
                      />
                    </div>
                    
                    <div>
                      <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Market Priority</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.marketPriority}
                        onChange={getInputHandler('marketPriority', 'int')}
                        className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Toggle Settings */}
                <div className="space-y-4">
                  <h3 className={`text-lg font-semibold ${adminTheme.textPrimary}`}>Settings</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={getInputHandler('isActive')}
                        className="w-5 h-5 text-[#FCD535] bg-transparent border border-gray-600 rounded focus:ring-[#FCD535] focus:ring-2"
                      />
                      <label className={`text-sm font-medium ${adminTheme.textSecondary}`}>Active</label>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={formData.showInMarket}
                        onChange={getInputHandler('showInMarket')}
                        className="w-5 h-5 text-[#FCD535] bg-transparent border border-gray-600 rounded focus:ring-[#FCD535] focus:ring-2"
                      />
                      <label className={`text-sm font-medium ${adminTheme.textSecondary}`}>Show in Market</label>
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingToken(null);
                      resetForm();
                    }}
                    className={`flex-1 ${adminTheme.buttonSecondary}`}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className={`flex-1 ${adminTheme.buttonPrimary}`}
                  >
                    {loading ? 'Saving...' : (editingToken ? 'Update Token' : 'Create Token')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSpecialTokenManager;
