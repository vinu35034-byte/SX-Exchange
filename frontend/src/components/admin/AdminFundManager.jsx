import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { Button } from "@/components/ui/button";
import { adminTheme } from '../../styles/adminTheme';
import toast from 'react-hot-toast';
import { 
  ArrowLeftIcon,
  BanknotesIcon,
  EyeIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  FireIcon,
  WalletIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
  ChartBarIcon
} from "@heroicons/react/24/outline";

const AdminFundManager = () => {
  const navigate = useNavigate();
  const { admin } = useAdminAuth();
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [sweepResults, setSweepResults] = useState(null);
  const [masterWallet, setMasterWallet] = useState('');
  const [minSweepAmount, setMinSweepAmount] = useState(1);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [balanceData, setBalanceData] = useState(null);
  const [gasAmount, setGasAmount] = useState('0.002');
  const [bulkGasAmount, setBulkGasAmount] = useState('0.001'); // Separate amount for bulk operations
  const [targetAddress, setTargetAddress] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [balanceFilter, setBalanceFilter] = useState('all'); // 'all', 'with-funds', 'sweepable', 'empty'

  // Load preview data on component mount
  useEffect(() => {
    loadSweepPreview();
    loadMasterWalletInfo();
  }, []);

  const loadSweepPreview = async () => {
    try {
      const { ApiUtils } = await import('../../services/api');
      const data = await ApiUtils.get('/admin/fund-management/preview');
      // Extract the preview data from the response
      setPreviewData(data.preview || data);
    } catch (error) {
      console.error('Error loading sweep preview:', error);
      toast.error('Failed to load sweep preview');
    }
  };

  const loadMasterWalletInfo = async () => {
    try {
      const { ApiUtils } = await import('../../services/api');
      const data = await ApiUtils.get('/admin/fund-management/master-wallet');
      setMasterWallet(data.address);
      setBalanceData(data);
    } catch (error) {
      console.error('Error loading master wallet info:', error);
    }
  };

  const handleSweepPreview = async () => {
    setLoading(true);
    try {
      const { ApiUtils } = await import('../../services/api');
      const data = await ApiUtils.get(`/admin/fund-management/preview?minAmount=${minSweepAmount}`);
      // Extract the preview data from the response
      const previewData = data.preview || data;
      setPreviewData(previewData);
      toast.success(`Found ${previewData.sweepableAddresses} addresses with ${previewData.totalSweepable.toFixed(2)} USDT`);
    } catch (error) {
      console.error('Error getting sweep preview:', error);
      toast.error('Failed to load sweep preview');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSweep = async () => {
    if (!masterWallet) {
      toast.error('Master wallet address not configured');
      return;
    }

    setLoading(true);
    setShowConfirmDialog(false);
    
    const sweepToastId = toast.loading(`Sweeping funds to master wallet...`);
    
    try {
      const { ApiUtils } = await import('../../services/api');
      const data = await ApiUtils.post('/admin/fund-management/sweep-all', {
        masterWalletAddress: masterWallet,
        minSweepAmount
      });
      
      setSweepResults(data);
      toast.success(`✅ Sweep completed! ${data.summary.successCount} successful, ${data.summary.totalSwept.toFixed(2)} USDT collected`, {
        id: sweepToastId,
        duration: 4000
      });
      
      // Refresh preview data
      await loadSweepPreview();
      await loadMasterWalletInfo();
    } catch (error) {
      console.error('Error during sweep:', error);
      toast.error(error.message || 'Sweep operation failed', { id: sweepToastId });
    } finally {
      setLoading(false);
    }
  };

  const handleSweepSingleAddress = async (address) => {
    setLoading(true);
    const sweepToastId = toast.loading(`Sweeping ${address}...`);
    
    try {
      const { ApiUtils } = await import('../../services/api');
      const data = await ApiUtils.post('/admin/fund-management/sweep-address', {
        address,
        masterWalletAddress: masterWallet
      });
      
      toast.success(`✅ Swept ${data.amount} USDT from ${address}`, {
        id: sweepToastId,
        duration: 3000
      });
      
      // Refresh data
      await loadSweepPreview();
      await loadMasterWalletInfo();
    } catch (error) {
      console.error('Error sweeping address:', error);
      toast.error(error.message || 'Sweep failed', { id: sweepToastId });
    } finally {
      setLoading(false);
    }
  };

  const handleFundGas = async () => {
    if (!targetAddress) {
      toast.error('Please enter target address');
      return;
    }

    setLoading(true);
    const gasToastId = toast.loading(`Funding ${targetAddress} with ${gasAmount} BNB...`);
    
    try {
      const { ApiUtils } = await import('../../services/api');
      const data = await ApiUtils.post('/admin/fund-management/fund-gas', {
        address: targetAddress,
        amount: gasAmount
      });
      
      toast.success(`✅ Funded ${targetAddress} with ${gasAmount} BNB`, {
        id: gasToastId,
        duration: 3000
      });
      setTargetAddress('');
      await loadMasterWalletInfo();
    } catch (error) {
      console.error('Error funding gas:', error);
      toast.error(error.message || 'Gas funding failed', { id: gasToastId });
    } finally {
      setLoading(false);
    }
  };

  // Fund gas for individual address
  const handleFundAddressGas = async (address, amount = bulkGasAmount) => {
    setLoading(true);
    const gasToastId = toast.loading(`Funding ${formatAddress(address)} with ${amount} BNB...`);
    
    try {
      const { ApiUtils } = await import('../../services/api');
      const data = await ApiUtils.post('/admin/fund-management/fund-gas', {
        address: address,
        amount: amount
      });
      
      toast.success(`✅ Funded ${formatAddress(address)} with ${amount} BNB`, {
        id: gasToastId,
        duration: 3000
      });
      await loadMasterWalletInfo();
      await loadSweepPreview(); // Refresh the preview to show updated gas balances
    } catch (error) {
      console.error('Error funding address gas:', error);
      toast.error(error.message || 'Gas funding failed', { id: gasToastId });
    } finally {
      setLoading(false);
    }
  };

  // Bulk fund gas for multiple addresses
  const handleBulkFundGas = async (addresses, amount = bulkGasAmount) => {
    if (!addresses || addresses.length === 0) {
      toast.error('No addresses to fund');
      return;
    }

    setLoading(true);
    const bulkToastId = toast.loading(`Funding ${addresses.length} addresses with ${amount} BNB each...`);
    
    try {
      const { ApiUtils } = await import('../../services/api');
      
      // Use the new bulk funding endpoint
      const result = await ApiUtils.post('/admin/fund-management/bulk-fund-gas', {
        addresses: addresses,
        amount: amount
      });
      
      if (result.successCount > 0) {
        toast.success(`✅ Funded ${result.successCount}/${result.totalProcessed} addresses successfully${result.failCount > 0 ? `, ${result.failCount} failed` : ''}`, {
          id: bulkToastId,
          duration: 5000
        });
      } else {
        toast.error(`❌ Failed to fund all ${result.failCount} addresses`, { id: bulkToastId });
      }
      
      await loadMasterWalletInfo();
      await loadSweepPreview();
    } catch (error) {
      console.error('Error in bulk gas funding:', error);
      toast.error(error.message || 'Bulk gas funding failed', { id: bulkToastId });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Filter addresses based on search and balance filter
  const getFilteredAddresses = () => {
    if (!previewData?.details) return [];
    
    let filtered = previewData.details;
    
    // Apply search filter
    if (searchFilter.trim()) {
      const search = searchFilter.toLowerCase();
      filtered = filtered.filter(detail => 
        detail.address.toLowerCase().includes(search) ||
        detail.user.toLowerCase().includes(search)
      );
    }
    
    // Apply balance filter
    switch (balanceFilter) {
      case 'with-funds':
        filtered = filtered.filter(detail => detail.balance > 0);
        break;
      case 'sweepable':
        filtered = filtered.filter(detail => detail.sweepable);
        break;
      case 'empty':
        filtered = filtered.filter(detail => detail.balance === 0);
        break;
      default:
        // 'all' - no additional filtering
        break;
    }
    
    return filtered;
  };

  if (!admin) {
    return (
      <div className={`min-h-screen ${adminTheme.primary} flex items-center justify-center`}>
        <div className={`${adminTheme.textPrimary} text-center`}>
          <ExclamationTriangleIcon className="w-16 h-16 mx-auto mb-4 text-amber-400" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className={`${adminTheme.textSecondary} mb-4`}>Admin access required</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${adminTheme.primary} ${adminTheme.textPrimary}`}>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button 
              onClick={() => navigate('/u/dashboard')}
              className={`${adminTheme.buttonSecondary} p-2`}
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </Button>
            <div>
              <h1 className={`text-3xl font-bold ${adminTheme.textPrimary} flex items-center gap-3`}>
                <BanknotesIcon className="w-8 h-8 text-green-400" />
                Fund Management
              </h1>
              <p className={`${adminTheme.textSecondary} mt-1`}>
                Manage and sweep user deposit funds to master wallet
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              onClick={loadSweepPreview}
              className={`${adminTheme.buttonSecondary}`}
              disabled={loading}
            >
              <ArrowPathIcon className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            
            {/* Test buttons for debugging */}
            <Button 
              onClick={async () => {
                try {
                  const { ApiUtils } = await import('../../services/api');
                  const data = await ApiUtils.get('/admin/fund-management/preview');
                  toast.success('Check console for API response');
                } catch (error) {
                  console.error('API Error:', error);
                  toast.error('API call failed - check console');
                }
              }}
              className={`${adminTheme.buttonSecondary} bg-blue-600`}
              disabled={loading}
            >
              Test API
            </Button>
          </div>
        </div>

        {/* Master Wallet Status */}
        {balanceData && (
          <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 mb-8 ${adminTheme.shadow}`}>
            <h2 className={`text-xl font-bold ${adminTheme.textPrimary} mb-6 flex items-center gap-3`}>
              <WalletIcon className="w-6 h-6 text-[#FCD535]" />
              Master Wallet Status
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className={`${adminTheme.surface} rounded-xl p-4`}>
                <h3 className={`font-semibold ${adminTheme.textPrimary} mb-2`}>Address</h3>
                <div className="flex items-center gap-2">
                  <span className={`${adminTheme.textSecondary} font-mono text-sm`}>
                    {formatAddress(balanceData.address)}
                  </span>
                  <button 
                    onClick={() => copyToClipboard(balanceData.address)}
                    className="text-[#FCD535] hover:text-[#E6C228]"
                  >
                    <DocumentDuplicateIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className={`${adminTheme.surface} rounded-xl p-4`}>
                <h3 className={`font-semibold ${adminTheme.textPrimary} mb-2`}>USDT Balance</h3>
                <p className="text-2xl font-bold text-green-400">
                  {balanceData.usdtBalance} USDT
                </p>
              </div>
              
              <div className={`${adminTheme.surface} rounded-xl p-4`}>
                <h3 className={`font-semibold ${adminTheme.textPrimary} mb-2`}>BNB Balance</h3>
                <p className="text-2xl font-bold text-yellow-400">
                  {balanceData.bnbBalance} BNB
                </p>
              </div>
              
              <div className={`${adminTheme.surface} rounded-xl p-4`}>
                <h3 className={`font-semibold ${adminTheme.textPrimary} mb-2`}>Status</h3>
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="w-5 h-5 text-green-400" />
                  <span className="text-green-400 font-semibold">Active</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sweep Overview */}
        {previewData && (
          <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 mb-8 ${adminTheme.shadow}`}>
            <h2 className={`text-xl font-bold ${adminTheme.textPrimary} mb-6 flex items-center gap-3`}>
              <ChartBarIcon className="w-6 h-6 text-blue-500" />
              Sweep Overview
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <div className={`${adminTheme.surface} rounded-xl p-4`}>
                <h3 className={`font-semibold ${adminTheme.textPrimary} mb-2`}>Total Addresses</h3>
                <p className="text-2xl font-bold text-blue-500">
                  {previewData.totalAddresses}
                </p>
              </div>
              
              <div className={`${adminTheme.surface} rounded-xl p-4`}>
                <h3 className={`font-semibold ${adminTheme.textPrimary} mb-2`}>Sweepable</h3>
                <p className="text-2xl font-bold text-green-400">
                  {previewData.sweepableAddresses}
                </p>
              </div>
              
              <div className={`${adminTheme.surface} rounded-xl p-4`}>
                <h3 className={`font-semibold ${adminTheme.textPrimary} mb-2`}>Total USDT</h3>
                <p className="text-2xl font-bold text-[#FCD535]">
                  {previewData.totalSweepable.toFixed(2)}
                </p>
              </div>
              
              <div className={`${adminTheme.surface} rounded-xl p-4`}>
                <h3 className={`font-semibold ${adminTheme.textPrimary} mb-2`}>Min Amount</h3>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={minSweepAmount}
                    onChange={(e) => setMinSweepAmount(parseFloat(e.target.value) || 1)}
                    className={`${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 w-20 text-sm`}
                    min="0.01"
                    step="0.01"
                  />
                  <span className={`${adminTheme.textSecondary} text-sm`}>USDT</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button 
                onClick={handleSweepPreview}
                className={`${adminTheme.buttonSecondary}`}
                disabled={loading}
              >
                <EyeIcon className="w-4 h-4 mr-2" />
                Update Preview
              </Button>
              
              {/* Always show sweep button for testing */}
              <Button 
                onClick={() => setShowConfirmDialog(true)}
                className={`${adminTheme.buttonPrimary} bg-linear-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700`}
                disabled={loading || !masterWallet}
              >
                <FireIcon className="w-4 h-4 mr-2" />
                Sweep All Funds ({previewData?.totalSweepable?.toFixed(2) || '0.00'} USDT)
              </Button>
              
              {/* Bulk Gas Funding Buttons */}
              <div className="flex gap-2">
                <Button 
                  onClick={() => handleBulkFundGas(getFilteredAddresses().map(addr => addr.address))}
                  className={`${adminTheme.buttonSecondary} bg-linear-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700`}
                  disabled={loading || getFilteredAddresses().length === 0}
                  title={`Fund all filtered addresses with ${bulkGasAmount} BNB each`}
                >
                  <FireIcon className="w-4 h-4 mr-2" />
                  Fund All Gas ({getFilteredAddresses().length}) × {bulkGasAmount}
                </Button>
                
                <Button 
                  onClick={() => handleBulkFundGas(getFilteredAddresses().filter(addr => addr.balance > 0).map(addr => addr.address))}
                  className={`${adminTheme.buttonSecondary} bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700`}
                  disabled={loading || getFilteredAddresses().filter(addr => addr.balance > 0).length === 0}
                  title={`Fund only addresses with USDT balance with ${bulkGasAmount} BNB each`}
                >
                  <FireIcon className="w-4 h-4 mr-2" />
                  Fund With-Funds ({getFilteredAddresses().filter(addr => addr.balance > 0).length}) × {bulkGasAmount}
                </Button>
              </div>
              
              {/* Debug info */}
              <div className={`text-xs ${adminTheme.textSecondary} ml-4`}>
                <p>Debug: Sweepable: {previewData?.sweepableAddresses || 0}</p>
                <p>Master: {masterWallet ? 'Set' : 'Not set'}</p>
                <p>Loading: {loading ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </div>
        )}

        {/* All Addresses and Funds */}
        {previewData && (
          <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 mb-8 ${adminTheme.shadow}`}>
            <h2 className={`text-xl font-bold ${adminTheme.textPrimary} mb-6 flex items-center gap-3`}>
              <WalletIcon className="w-6 h-6 text-blue-500" />
              All User Addresses & Funds
              <span className={`text-sm font-normal ${adminTheme.textSecondary}`}>
                ({previewData.totalAddresses || 0} total addresses)
              </span>
            </h2>
            
            {previewData.totalAddresses === 0 ? (
              <div className={`text-center py-12 ${adminTheme.textSecondary}`}>
                <WalletIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Deposit Addresses Found</h3>
                <p className="mb-4">No users have generated deposit addresses yet.</p>
                <p className="text-sm">Users need to visit their deposit page to generate addresses for fund management.</p>
              </div>
            ) : (
              <>
                {/* Search and Filter Controls */}
                <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium ${adminTheme.textPrimary} mb-2`}>
                      Search by Address or User
                    </label>
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Enter address or username..."
                      className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-[#FCD535] focus:border-[#FCD535]`}
                    />
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium ${adminTheme.textPrimary} mb-2`}>
                      Filter by Balance
                    </label>
                    <select
                      value={balanceFilter}
                      onChange={(e) => setBalanceFilter(e.target.value)}
                      className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-[#FCD535] focus:border-[#FCD535]`}
                    >
                      <option value="all">All Addresses</option>
                      <option value="with-funds">With Funds Only</option>
                      <option value="sweepable">Sweepable Only</option>
                      <option value="empty">Empty Addresses</option>
                    </select>
                  </div>
                </div>
                
                {previewData.details && previewData.details.length > 0 ? (
                  <>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {getFilteredAddresses().map((detail, index) => (
                        <div key={index} className={`${adminTheme.surface} rounded-xl p-4 flex items-center justify-between hover:bg-opacity-80 transition-all`}>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className={`font-mono text-sm ${adminTheme.textPrimary} font-semibold`}>
                                {detail.address}
                              </span>
                              <button 
                                onClick={() => copyToClipboard(detail.address)}
                                className="text-[#FCD535] hover:text-[#E6C228] transition-colors"
                                title="Copy address"
                              >
                                <DocumentDuplicateIcon className="w-4 h-4" />
                              </button>
                              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                detail.sweepable 
                                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                  : detail.balance > 0 
                                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                    : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                              }`}>
                                {detail.sweepable ? 'Sweepable' : detail.balance > 0 ? 'Below minimum' : 'Empty'}
                              </span>
                            </div>
                            <div className="flex items-center gap-6 text-sm">
                              <span className={`${adminTheme.textSecondary}`}>
                                User: <span className={`${adminTheme.textPrimary} font-semibold`}>{detail.user}</span>
                              </span>
                              <span className={`${adminTheme.textSecondary}`}>
                                Balance: <span className={`font-bold ${
                                  detail.balance > 0 ? 'text-green-400' : 'text-gray-400'
                                }`}>{detail.balance || 0} USDT</span>
                              </span>
                              {detail.error && (
                                <span className="text-red-400 text-xs">
                                  Error: {detail.error}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {/* Gas Funding Button */}
                            <Button 
                              onClick={() => handleFundAddressGas(detail.address)}
                              className={`${adminTheme.buttonSecondary} bg-linear-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-sm px-3 py-1`}
                              disabled={loading}
                              title={`Fund address with ${bulkGasAmount} BNB for gas`}
                            >
                              <FireIcon className="w-4 h-4 mr-1" />
                              Gas ({bulkGasAmount})
                            </Button>
                            
                            {/* Sweep Button */}
                            {detail.balance > 0 && (
                              <Button 
                                onClick={() => handleSweepSingleAddress(detail.address)}
                                className={`${
                                  detail.sweepable 
                                    ? `${adminTheme.buttonPrimary} bg-linear-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700` 
                                    : `${adminTheme.buttonSecondary} opacity-75`
                                } text-sm px-3 py-1`}
                                disabled={loading}
                                title={detail.sweepable ? 'Sweep funds' : 'Amount below minimum threshold'}
                              >
                                <CurrencyDollarIcon className="w-4 h-4 mr-1" />
                                Sweep
                              </Button>
                            )}
                            
                            {detail.balance === 0 && (
                              <span className={`text-xs px-3 py-1 rounded-lg ${adminTheme.textSecondary} bg-gray-500/10`}>
                                No funds
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      
                      {getFilteredAddresses().length === 0 && (
                        <div className={`text-center py-8 ${adminTheme.textSecondary}`}>
                          <WalletIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>No addresses match your current filters</p>
                          <p className="text-sm mt-1">Try adjusting your search or filter criteria</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Summary Stats */}
                    <div className={`mt-6 pt-4 border-t ${adminTheme.border}`}>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold text-blue-500">{getFilteredAddresses().length}</p>
                          <p className={`text-xs ${adminTheme.textSecondary}`}>Filtered Results</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-green-400">
                            {getFilteredAddresses().filter(d => d.balance > 0).length}
                          </p>
                          <p className={`text-xs ${adminTheme.textSecondary}`}>With Funds</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-[#FCD535]">
                            {getFilteredAddresses().reduce((sum, d) => sum + (d.balance || 0), 0).toFixed(2)}
                          </p>
                          <p className={`text-xs ${adminTheme.textSecondary}`}>Total USDT</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-emerald-400">
                            {getFilteredAddresses().filter(d => d.sweepable).length}
                          </p>
                          <p className={`text-xs ${adminTheme.textSecondary}`}>Ready to Sweep</p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className={`text-center py-8 ${adminTheme.textSecondary}`}>
                    <ClockIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Loading address details...</p>
                    <p className="text-sm mt-1">Checking balances on blockchain...</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Gas Funding Section */}
        <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 mb-8 ${adminTheme.shadow}`}>
          <h2 className={`text-xl font-bold ${adminTheme.textPrimary} mb-6 flex items-center gap-3`}>
            <FireIcon className="w-6 h-6 text-orange-400" />
            Gas Funding Configuration
          </h2>
          
          {/* Manual Gas Funding */}
          <div className="mb-6">
            <h3 className={`text-lg font-semibold ${adminTheme.textPrimary} mb-4`}>Manual Single Address</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className={`block text-sm font-medium ${adminTheme.textPrimary} mb-2`}>
                  Target Address
                </label>
                <input
                  type="text"
                  value={targetAddress}
                  onChange={(e) => setTargetAddress(e.target.value)}
                  placeholder="0x..."
                  className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 text-sm`}
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium ${adminTheme.textPrimary} mb-2`}>
                  BNB Amount
                </label>
                <input
                  type="number"
                  value={gasAmount}
                  onChange={(e) => setGasAmount(e.target.value)}
                  step="0.001"
                  min="0.001"
                  className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 text-sm`}
                />
              </div>
              
              <Button 
                onClick={handleFundGas}
                className={`${adminTheme.buttonPrimary}`}
                disabled={loading || !targetAddress}
              >
                <FireIcon className="w-4 h-4 mr-2" />
                Fund Gas
              </Button>
            </div>
          </div>

          {/* Bulk Gas Funding Configuration */}
          <div className={`pt-6 border-t ${adminTheme.border}`}>
            <h3 className={`text-lg font-semibold ${adminTheme.textPrimary} mb-4`}>Bulk Operations Amount</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className={`block text-sm font-medium ${adminTheme.textPrimary} mb-2`}>
                  Bulk Gas Amount (BNB)
                </label>
                <input
                  type="number"
                  value={bulkGasAmount}
                  onChange={(e) => setBulkGasAmount(e.target.value)}
                  step="0.0001"
                  min="0.0001"
                  className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 text-sm`}
                />
              </div>
              
              <div className="grid grid-cols-1 gap-2">
                <Button 
                  onClick={() => setBulkGasAmount('0.0005')}
                  className={`${adminTheme.buttonSecondary} text-xs py-1`}
                >
                  Ultra Low (0.0005)
                </Button>
                <Button 
                  onClick={() => setBulkGasAmount('0.001')}
                  className={`${adminTheme.buttonSecondary} text-xs py-1`}
                >
                  Low (0.001)
                </Button>
              </div>
              
              <div className="grid grid-cols-1 gap-2">
                <Button 
                  onClick={() => setBulkGasAmount('0.002')}
                  className={`${adminTheme.buttonSecondary} text-xs py-1`}
                >
                  Normal (0.002)
                </Button>
                <Button 
                  onClick={() => setBulkGasAmount('0.005')}
                  className={`${adminTheme.buttonSecondary} text-xs py-1`}
                >
                  High (0.005)
                </Button>
              </div>

              <div className={`${adminTheme.surface} rounded-lg p-3`}>
                <div className="text-center">
                  <p className="text-xs text-amber-400 mb-1">Cost Preview</p>
                  <p className="text-sm font-bold text-white">
                    {getFilteredAddresses().length} × {bulkGasAmount} = {(getFilteredAddresses().length * parseFloat(bulkGasAmount || 0)).toFixed(4)} BNB
                  </p>
                  <p className="text-xs text-gray-400">
                    ~${((getFilteredAddresses().length * parseFloat(bulkGasAmount || 0)) * 600).toFixed(2)} USD
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sweep Results */}
        {sweepResults && (
          <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 ${adminTheme.shadow}`}>
            <h2 className={`text-xl font-bold ${adminTheme.textPrimary} mb-6 flex items-center gap-3`}>
              <CheckCircleIcon className="w-6 h-6 text-green-400" />
              Sweep Results
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className={`${adminTheme.surface} rounded-xl p-4 text-center`}>
                <p className="text-2xl font-bold text-green-400">{sweepResults.summary.successCount}</p>
                <p className={`${adminTheme.textSecondary} text-sm`}>Successful</p>
              </div>
              <div className={`${adminTheme.surface} rounded-xl p-4 text-center`}>
                <p className="text-2xl font-bold text-red-400">{sweepResults.summary.errorCount}</p>
                <p className={`${adminTheme.textSecondary} text-sm`}>Failed</p>
              </div>
              <div className={`${adminTheme.surface} rounded-xl p-4 text-center`}>
                <p className="text-2xl font-bold text-[#FCD535]">{sweepResults.summary.totalSwept.toFixed(2)}</p>
                <p className={`${adminTheme.textSecondary} text-sm`}>USDT Collected</p>
              </div>
              <div className={`${adminTheme.surface} rounded-xl p-4 text-center`}>
                <p className="text-2xl font-bold text-blue-500">{sweepResults.summary.totalAddresses}</p>
                <p className={`${adminTheme.textSecondary} text-sm`}>Total Processed</p>
              </div>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {sweepResults.results.map((result, index) => (
                <div key={index} className={`${adminTheme.surface} rounded-lg p-3 flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      result.status === 'success' ? 'bg-green-400' :
                      result.status === 'failed' ? 'bg-red-400' :
                      result.status === 'skipped' ? 'bg-yellow-400' : 'bg-gray-400'
                    }`} />
                    <span className={`font-mono text-sm ${adminTheme.textPrimary}`}>
                      {formatAddress(result.address)}
                    </span>
                    <span className={`text-sm ${adminTheme.textSecondary}`}>
                      ({result.user})
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm">
                    {result.amount && (
                      <span className="text-green-400 font-semibold">
                        {result.amount} USDT
                      </span>
                    )}
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      result.status === 'success' ? 'bg-green-500/20 text-green-400' :
                      result.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                      result.status === 'skipped' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {result.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confirmation Dialog */}
        {showConfirmDialog && (
          <div className={`fixed inset-0 ${adminTheme.modalOverlay} flex items-center justify-center z-50`}>
            <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 max-w-md w-full mx-4 ${adminTheme.shadow}`}>
              <div className="text-center mb-6">
                <ExclamationTriangleIcon className="w-16 h-16 mx-auto mb-4 text-amber-400" />
                <h3 className={`text-xl font-bold ${adminTheme.textPrimary} mb-2`}>
                  Confirm Bulk Sweep
                </h3>
                <p className={`${adminTheme.textSecondary}`}>
                  This will sweep {previewData?.totalSweepable.toFixed(2)} USDT from {previewData?.sweepableAddresses} addresses to the master wallet.
                </p>
                <p className={`${adminTheme.textSecondary} mt-2 font-semibold`}>
                  This action cannot be undone.
                </p>
              </div>
              
              <div className="flex gap-3">
                <Button 
                  onClick={() => setShowConfirmDialog(false)}
                  className={`flex-1 ${adminTheme.buttonSecondary}`}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleConfirmSweep}
                  className={`flex-1 ${adminTheme.buttonPrimary} bg-linear-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700`}
                  disabled={loading}
                >
                  Confirm Sweep
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminFundManager;
