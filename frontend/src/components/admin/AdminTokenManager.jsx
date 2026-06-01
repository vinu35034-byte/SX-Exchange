import React, { useState, useEffect, useCallback } from 'react';
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
  ChevronDownIcon,
  Cog6ToothIcon
} from "@heroicons/react/24/outline";

// Token Modal Component - moved outside to prevent re-creation
const TokenModal = ({ 
  showModal, 
  editingToken, 
  formData, 
  setFormData, 
  loading, 
  onSubmit, 
  onClose 
}) => {
  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto ${adminTheme.shadow}`}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className={`text-xl font-bold ${adminTheme.textPrimary}`}>
              {editingToken ? 'Edit Token' : 'Add New Token'}
            </h3>
            <button
              onClick={onClose}
              className={`${adminTheme.textSecondary} hover:text-white transition-colors`}
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
          
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Symbol *</label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                  className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                  placeholder="BTC, ETH, etc."
                  required
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                  placeholder="Bitcoin, Ethereum, etc."
                  required
                />
              </div>
            </div>
            
            <div>
              <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                rows="3"
                placeholder="Token description..."
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Website URL</label>
                <input
                  type="url"
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                  className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                  placeholder="https://example.com"
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Logo URL</label>
                <input
                  type="url"
                  value={formData.logoUrl}
                  onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                  className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                  placeholder="https://example.com/logo.png"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Contract Address</label>
                <input
                  type="text"
                  value={formData.contractAddress}
                  onChange={(e) => setFormData({ ...formData, contractAddress: e.target.value })}
                  className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                  placeholder="0x..."
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Network</label>
                <select
                  value={formData.network}
                  onChange={(e) => setFormData({ ...formData, network: e.target.value })}
                  className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                >
                  <option value="ETH">Ethereum</option>
                  <option value="BSC">Binance Smart Chain</option>
                  <option value="POLYGON">Polygon</option>
                  <option value="TRON">TRON</option>
                  <option value="NATIVE">Native</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Decimals</label>
                <input
                  type="number"
                  value={formData.decimals}
                  onChange={(e) => setFormData({ ...formData, decimals: parseInt(e.target.value) })}
                  className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                  min="0"
                  max="18"
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Price (USD)</label>
                <input
                  type="number"
                  step="0.00000001"
                  value={formData.priceUSD}
                  onChange={(e) => setFormData({ ...formData, priceUSD: parseFloat(e.target.value) })}
                  className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                  min="0"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isVisible}
                  onChange={(e) => setFormData({ ...formData, isVisible: e.target.checked })}
                  className={`rounded ${adminTheme.surface} ${adminTheme.border} text-[#FCD535] focus:ring-[#FCD535]`}
                />
                <span className={`${adminTheme.textSecondary}`}>Visible to users</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isTradingEnabled}
                  onChange={(e) => setFormData({ ...formData, isTradingEnabled: e.target.checked })}
                  className={`rounded ${adminTheme.surface} ${adminTheme.border} text-[#FCD535] focus:ring-[#FCD535]`}
                />
                <span className={`${adminTheme.textSecondary}`}>Trading enabled</span>
              </label>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                onClick={onClose}
                className={`flex-1 ${adminTheme.buttonSecondary}`}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className={`flex-1 ${adminTheme.buttonPrimary}`}
              >
                {loading ? 'Saving...' : (editingToken ? 'Update' : 'Add Token')}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const AdminTokenManager = () => {
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

  // Form state for adding/editing tokens
  const [formData, setFormData] = useState({
    symbol: '',
    name: '',
    description: '',
    websiteUrl: '',
    logoUrl: '',
    contractAddress: '',
    network: 'NATIVE',
    decimals: 18,
    priceUSD: 0,
    isVisible: true,
    isTradingEnabled: false,
    tradingPairs: []
  });

  useEffect(() => {
    fetchTokens();
  }, [statusFilter, searchTerm]);

  const fetchTokens = async () => {
    try {
      setLoading(true);
      const data = await ApiUtils.get(`admin/tokens/tokens?status=${statusFilter}&search=${searchTerm}&limit=20`);
      setTokens(data.data.tokens);
      setFilteredTokens(data.data.tokens);
      setPagination(data.data.pagination);
    } catch (error) {
      console.error('Error fetching tokens:', error);
      setMessage({ type: 'error', text: 'Failed to fetch tokens' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      symbol: '',
      name: '',
      description: '',
      websiteUrl: '',
      logoUrl: '',
      contractAddress: '',
      network: 'NATIVE',
      decimals: 18,
      priceUSD: 0,
      isVisible: true,
      isTradingEnabled: false,
      tradingPairs: []
    });
  };

  const handleModalClose = useCallback(() => {
    setShowAddModal(false);
    setEditingToken(null);
    resetForm();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.symbol || !formData.name) {
      setMessage({ type: 'error', text: 'Symbol and name are required' });
      return;
    }
    
    try {
      setLoading(true);
      
      const url = editingToken 
        ? `admin/tokens/tokens/${editingToken._id}`
        : 'admin/tokens/tokens';
      
      const method = editingToken ? 'PUT' : 'POST';
      
      let data;
      if (method === 'PUT') {
        data = await ApiUtils.put(url, formData);
      } else {
        data = await ApiUtils.post(url, formData);
      }
      
      setMessage({ 
        type: 'success', 
        text: editingToken ? 'Token updated successfully' : 'Token added successfully' 
      });
      
      setShowAddModal(false);
      setEditingToken(null);
      resetForm();
      fetchTokens();
      
    } catch (error) {
      console.error('Error saving token:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (tokenId) => {
    try {
      setLoading(true);
      await ApiUtils.post(`admin/tokens/tokens/${tokenId}/approve`);
      setMessage({ type: 'success', text: 'Token approved successfully' });
      fetchTokens();
    } catch (error) {
      console.error('Error approving token:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (tokenId) => {
    try {
      setLoading(true);
      await ApiUtils.post(`admin/tokens/tokens/${tokenId}/disable`);
      setMessage({ type: 'success', text: 'Token disabled successfully' });
      fetchTokens();
    } catch (error) {
      console.error('Error disabling token:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (tokenId) => {
    if (!window.confirm('Are you sure you want to delete this token? This action cannot be undone.')) {
      return;
    }
    
    try {
      setLoading(true);
      await ApiUtils.delete(`admin/tokens/tokens/${tokenId}`);
      setMessage({ type: 'success', text: 'Token deleted successfully' });
      fetchTokens();
    } catch (error) {
      console.error('Error deleting token:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (token) => {
    setEditingToken(token);
    setFormData({
      symbol: token.symbol,
      name: token.name,
      description: token.description || '',
      websiteUrl: token.websiteUrl || '',
      logoUrl: token.logoUrl || '',
      contractAddress: token.contractAddress || '',
      network: token.network || 'NATIVE',
      decimals: token.decimals || 18,
      priceUSD: token.priceUSD || 0,
      isVisible: token.isVisible,
      isTradingEnabled: token.isTradingEnabled,
      tradingPairs: token.tradingPairs || []
    });
    setShowAddModal(true);
  };

  const getStatusBadge = (token) => {
    if (token.status === 'active' && token.isTradingEnabled) {
      return <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">Active</span>;
    } else if (token.status === 'active' && !token.isTradingEnabled) {
      return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">Listed</span>;
    } else if (token.status === 'pending' || token.status === 'pending_review') {
      return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-500 text-xs rounded-full">Pending</span>;
    } else {
      return <span className="px-2 py-1 bg-gray-500/20 text-gray-400 text-xs rounded-full">Inactive</span>;
    }
  };

  const getNetworkDisplayName = (network) => {
    const networkNames = {
      'ETH': 'Ethereum',
      'BSC': 'Binance Smart Chain',
      'POLYGON': 'Polygon',
      'TRON': 'TRON',
      'NATIVE': 'Native'
    };
    return networkNames[network] || network;
  };

  if (!admin) {
    return (
      <div className="min-h-screen bg-[#181A20] flex items-center justify-center">
        <div className="text-white text-center">
          <ExclamationTriangleIcon className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-[#EAECEF]/60 mb-4">You must be logged in as an admin to access this page.</p>
          <Button onClick={() => navigate('/u/login')} className="bg-[#FCD535] hover:bg-[#E6C228]">
            Go to Admin Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${adminTheme.primary}`}>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 mb-6 ${adminTheme.shadow}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 ${adminTheme.accent} rounded-xl ${adminTheme.shadow}`}>
                <Cog6ToothIcon className="w-8 h-8 text-[#FCD535]" />
              </div>
              <div>
                <h1 className={`text-3xl font-bold ${adminTheme.textPrimary}`}>Token Management</h1>
                <p className={`${adminTheme.textSecondary} mt-1`}>Manage cryptocurrency tokens and trading pairs</p>
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
                Add Token
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
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg pl-10 pr-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
                  placeholder="Search tokens..."
                />
              </div>
            </div>
            
            <div>
              <label className={`block text-sm font-medium ${adminTheme.textSecondary} mb-2`}>Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 ${adminTheme.textPrimary} focus:outline-none focus:ring-2 focus:ring-[#FCD535]`}
              >
                <option value="all">All Tokens</option>
                <option value="active">Active</option>
                <option value="pending_review">Pending Review</option>
                <option value="inactive">Inactive</option>
              </select>
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
                  <th className={`text-left p-4 ${adminTheme.textSecondary} font-medium`}>Price</th>
                  <th className={`text-left p-4 ${adminTheme.textSecondary} font-medium`}>Network</th>
                  <th className={`text-left p-4 ${adminTheme.textSecondary} font-medium`}>Visibility</th>
                  <th className={`text-left p-4 ${adminTheme.textSecondary} font-medium`}>Trading</th>
                  <th className={`text-right p-4 ${adminTheme.textSecondary} font-medium`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center p-8">
                      <div className={`flex items-center justify-center gap-2 ${adminTheme.textSecondary}`}>
                        <div className="w-5 h-5 border border-gray-600 border-t-[#FCD535] rounded-full animate-spin"></div>
                        Loading tokens...
                      </div>
                    </td>
                  </tr>
                ) : filteredTokens.length === 0 ? (
                  <tr>
                    <td colSpan="7" className={`text-center p-8 ${adminTheme.textSecondary}`}>
                      No tokens found
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
                            <div className={`font-medium ${adminTheme.textPrimary}`}>{token.symbol}</div>
                            <div className={`text-sm ${adminTheme.textSecondary}`}>{token.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">{getStatusBadge(token)}</td>
                      <td className={`p-4 ${adminTheme.textPrimary}`}>${token.priceUSD?.toFixed(8) || '0'}</td>
                      <td className={`p-4 ${adminTheme.textPrimary}`}>{getNetworkDisplayName(token.network)}</td>
                      <td className="p-4">
                        {token.isVisible ? (
                          <EyeIcon className="w-5 h-5 text-green-400" />
                        ) : (
                          <EyeSlashIcon className={`w-5 h-5 ${adminTheme.textSecondary}`} />
                        )}
                      </td>
                      <td className="p-4">
                        {token.isTradingEnabled ? (
                          <CheckCircleIcon className="w-5 h-5 text-green-400" />
                        ) : (
                          <XMarkIcon className={`w-5 h-5 ${adminTheme.textSecondary}`} />
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(token)}
                            className={`p-1 ${adminTheme.textSecondary} hover:text-blue-500 transition-colors`}
                            title="Edit"
                          >
                            <PencilIcon className="w-5 h-5" />
                          </button>
                          
                          {(token.status === 'pending' || token.status === 'pending_review') && (
                            <button
                              onClick={() => handleApprove(token._id)}
                              className={`p-1 ${adminTheme.textSecondary} hover:text-green-400 transition-colors`}
                              title="Approve"
                            >
                              <CheckCircleIcon className="w-5 h-5" />
                            </button>
                          )}
                          
                          {token.isTradingEnabled && (
                            <button
                              onClick={() => handleDisable(token._id)}
                              className={`p-1 ${adminTheme.textSecondary} hover:text-yellow-400 transition-colors`}
                              title="Disable Trading"
                            >
                              <XMarkIcon className="w-5 h-5" />
                            </button>
                          )}
                          
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
                Page {pagination.current} of {pagination.pages} ({pagination.total} total tokens)
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      <TokenModal 
        showModal={showAddModal}
        editingToken={editingToken}
        formData={formData}
        setFormData={setFormData}
        loading={loading}
        onSubmit={handleSubmit}
        onClose={handleModalClose}
      />
    </div>
  );
};

export default AdminTokenManager;
