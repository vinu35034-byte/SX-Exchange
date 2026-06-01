import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { ApiUtils } from '../../services/api';
import { adminTheme } from '../../styles/adminTheme';

const TokenTradingControls = () => {
  const { admin: user } = useAdminAuth();
  const [tokens, setTokens] = useState({ regularTokens: [], specialTokens: [] });
  const [loading, setLoading] = useState(true);
  const [selectedToken, setSelectedToken] = useState(null);
  const [editMode, setEditMode] = useState(false);

  const [formData, setFormData] = useState({
    buyEnabled: true,
    sellEnabled: true,
    sellPriceAdjustment: -1.0
  });

  useEffect(() => {
    fetchTokenControls();
  }, []);

  const fetchTokenControls = async () => {
    try {
      setLoading(true);
      const data = await ApiUtils.get('/admin/token-controls/controls');
      setTokens(data.data);
    } catch (error) {
      console.error('Error fetching token controls:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateControls = async (symbol, tokenType) => {
    try {
      const endpoint = tokenType === 'special' 
        ? `/admin/token-controls/special-tokens/${symbol}/controls`
        : `/admin/token-controls/coins/${symbol}/controls`;

      await ApiUtils.put(endpoint, formData);

      alert('Trading controls updated successfully!');
      await fetchTokenControls();
      setEditMode(false);
      setSelectedToken(null);
    } catch (error) {
      console.error('Error updating controls:', error);
      alert('Failed to update controls');
    }
  };

  const openEditModal = (token, tokenType) => {
    setSelectedToken({ ...token, type: tokenType });
    setFormData({
      buyEnabled: token.tradingControls?.buyEnabled ?? true,
      sellEnabled: token.tradingControls?.sellEnabled ?? true,
      sellPriceAdjustment: token.tradingControls?.sellPriceAdjustment ?? (tokenType === 'special' ? 0 : -1.0)
    });
    setEditMode(true);
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${adminTheme.primary} p-6`}>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="w-8 h-8 border-2 border-[#FCD535]/30 border-t-[#FCD535] rounded-full animate-spin"></div>
          <span className={`ml-3 text-lg ${adminTheme.textSecondary}`}>Loading token controls...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${adminTheme.primary} p-6`}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className={`${adminTheme.card} rounded-xl p-8 border ${adminTheme.borderAccent} ${adminTheme.shadow}`}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-3xl font-bold ${adminTheme.textPrimary} mb-2`}>
                Token Trading Controls
              </h1>
              <p className={`${adminTheme.textSecondary} text-lg`}>
                Manage trading permissions and price adjustments for all tokens
              </p>
            </div>
            <div className={`${adminTheme.accent} p-4 rounded-lg`}>
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className={`${adminTheme.card} rounded-xl p-6 border ${adminTheme.border} ${adminTheme.hover}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`${adminTheme.textMuted} text-sm font-medium`}>Regular Tokens</p>
                <p className={`${adminTheme.textPrimary} text-2xl font-bold`}>{tokens.regularTokens.length}</p>
              </div>
              <div className={`${adminTheme.infoBg} p-3 rounded-lg border`}>
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
          </div>
          <div className={`${adminTheme.card} rounded-xl p-6 border ${adminTheme.border} ${adminTheme.hover}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`${adminTheme.textMuted} text-sm font-medium`}>Special Tokens</p>
                <p className={`${adminTheme.textPrimary} text-2xl font-bold`}>{tokens.specialTokens.length}</p>
              </div>
              <div className={`${adminTheme.warningBg} p-3 rounded-lg border`}>
                <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
            </div>
          </div>
          <div className={`${adminTheme.card} rounded-xl p-6 border ${adminTheme.border} ${adminTheme.hover}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`${adminTheme.textMuted} text-sm font-medium`}>Buy Enabled</p>
                <p className={`${adminTheme.textPrimary} text-2xl font-bold`}>
                  {[...tokens.regularTokens, ...tokens.specialTokens].filter(t => t.tradingControls?.buyEnabled !== false).length}
                </p>
              </div>
              <div className={`${adminTheme.successBg} p-3 rounded-lg border`}>
                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
          <div className={`${adminTheme.card} rounded-xl p-6 border ${adminTheme.border} ${adminTheme.hover}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`${adminTheme.textMuted} text-sm font-medium`}>Sell Enabled</p>
                <p className={`${adminTheme.textPrimary} text-2xl font-bold`}>
                  {[...tokens.regularTokens, ...tokens.specialTokens].filter(t => t.tradingControls?.sellEnabled !== false).length}
                </p>
              </div>
              <div className={`${adminTheme.successBg} p-3 rounded-lg border`}>
                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Token Sections */}
        <div className="space-y-8">
          {/* Regular Tokens */}
          <div className={`${adminTheme.card} rounded-xl border ${adminTheme.borderAccent} ${adminTheme.shadow} overflow-hidden`}>
            <div className={`px-8 py-6 ${adminTheme.secondary} border-b ${adminTheme.border}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`${adminTheme.infoBg} p-2 rounded-lg border`}>
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <div>
                    <h2 className={`text-xl font-bold ${adminTheme.textPrimary}`}>Regular Tokens</h2>
                    <p className={`${adminTheme.textMuted} text-sm`}>Standard trading tokens with typical fee structures</p>
                  </div>
                </div>
                <div className={`${adminTheme.infoBg} px-3 py-1 rounded-full border text-sm text-blue-500 font-medium`}>
                  {tokens.regularTokens.length} tokens
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className={`${adminTheme.tableHeader}`}>
                  <tr>
                    <th className={`px-8 py-4 text-left text-xs font-semibold ${adminTheme.textSecondary} uppercase tracking-wider`}>Token</th>
                    <th className={`px-6 py-4 text-left text-xs font-semibold ${adminTheme.textSecondary} uppercase tracking-wider`}>Trading Status</th>
                    <th className={`px-6 py-4 text-left text-xs font-semibold ${adminTheme.textSecondary} uppercase tracking-wider`}>Sell Adjustment</th>
                    <th className={`px-6 py-4 text-right text-xs font-semibold ${adminTheme.textSecondary} uppercase tracking-wider`}>Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${adminTheme.border}`}>
                  {tokens.regularTokens.map((token) => (
                    <tr key={token.symbol} className={`${adminTheme.tableRow} group`}>
                      <td className="px-8 py-6">
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 ${adminTheme.accent} rounded-lg flex items-center justify-center`}>
                            <span className="text-white font-bold text-sm">{token.symbol.slice(0, 2)}</span>
                          </div>
                          <div>
                            <div className={`font-semibold ${adminTheme.textPrimary}`}>{token.symbol}</div>
                            <div className={`text-sm ${adminTheme.textMuted}`}>{token.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <div className="flex space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
                            token.tradingControls?.buyEnabled !== false ? adminTheme.successBg : adminTheme.dangerBg
                          }`}>
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Buy {token.tradingControls?.buyEnabled !== false ? 'ON' : 'OFF'}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
                            token.tradingControls?.sellEnabled !== false ? adminTheme.successBg : adminTheme.dangerBg
                          }`}>
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Sell {token.tradingControls?.sellEnabled !== false ? 'ON' : 'OFF'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <div className={`inline-flex items-center px-3 py-2 rounded-lg border ${
                          (token.tradingControls?.sellPriceAdjustment ?? -1.0) >= 0 
                            ? adminTheme.successBg 
                            : adminTheme.warningBg
                        }`}>
                          <span className="text-sm font-semibold">
                            {(token.tradingControls?.sellPriceAdjustment ?? -1.0) >= 0 ? '+' : ''}{token.tradingControls?.sellPriceAdjustment ?? -1.0}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-6 text-right">
                        <button
                          onClick={() => openEditModal(token, 'regular')}
                          className={`${adminTheme.buttonPrimary} px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200`}
                        >
                          <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit Controls
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Special Tokens */}
          <div className={`${adminTheme.card} rounded-xl border ${adminTheme.borderAccent} ${adminTheme.shadow} overflow-hidden`}>
            <div className={`px-8 py-6 ${adminTheme.secondary} border-b ${adminTheme.border}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`${adminTheme.warningBg} p-2 rounded-lg border`}>
                    <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className={`text-xl font-bold ${adminTheme.textPrimary}`}>Special Tokens</h2>
                    <p className={`${adminTheme.textMuted} text-sm`}>Premium tokens with special privileges and custom settings</p>
                  </div>
                </div>
                <div className={`${adminTheme.warningBg} px-3 py-1 rounded-full border text-sm text-yellow-500 font-medium`}>
                  {tokens.specialTokens.length} tokens
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className={`${adminTheme.tableHeader}`}>
                  <tr>
                    <th className={`px-8 py-4 text-left text-xs font-semibold ${adminTheme.textSecondary} uppercase tracking-wider`}>Token</th>
                    <th className={`px-6 py-4 text-left text-xs font-semibold ${adminTheme.textSecondary} uppercase tracking-wider`}>Trading Status</th>
                    <th className={`px-6 py-4 text-left text-xs font-semibold ${adminTheme.textSecondary} uppercase tracking-wider`}>Sell Adjustment</th>
                    <th className={`px-6 py-4 text-right text-xs font-semibold ${adminTheme.textSecondary} uppercase tracking-wider`}>Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${adminTheme.border}`}>
                  {tokens.specialTokens.map((token) => (
                    <tr key={token.symbol} className={`${adminTheme.tableRow} group`}>
                      <td className="px-8 py-6">
                        <div className="flex items-center space-x-3">
                          <div className="relative">
                            <div className="w-10 h-10 bg-linear-to-br from-yellow-500 to-green-500 rounded-lg flex items-center justify-center">
                              <span className="text-white font-bold text-sm">{token.symbol.slice(0, 2)}</span>
                            </div>
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-linear-to-r from-[#FCD535] to-green-500 rounded-full flex items-center justify-center">
                              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                          <div>
                            <div className={`font-semibold ${adminTheme.textPrimary} flex items-center`}>
                              {token.symbol}
                              <span className="ml-2 px-2 py-0.5 bg-linear-to-r from-yellow-500/20 to-green-500/20 text-yellow-500 text-xs rounded-full border border-yellow-500/30">
                                SPECIAL
                              </span>
                            </div>
                            <div className={`text-sm ${adminTheme.textMuted}`}>{token.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <div className="flex space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
                            token.tradingControls?.buyEnabled !== false ? adminTheme.successBg : adminTheme.dangerBg
                          }`}>
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Buy {token.tradingControls?.buyEnabled !== false ? 'ON' : 'OFF'}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
                            token.tradingControls?.sellEnabled !== false ? adminTheme.successBg : adminTheme.dangerBg
                          }`}>
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Sell {token.tradingControls?.sellEnabled !== false ? 'ON' : 'OFF'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <div className={`inline-flex items-center px-3 py-2 rounded-lg border ${
                          (token.tradingControls?.sellPriceAdjustment ?? 0) >= 0 
                            ? adminTheme.successBg 
                            : adminTheme.warningBg
                        }`}>
                          <span className="text-sm font-semibold">
                            {(token.tradingControls?.sellPriceAdjustment ?? 0) >= 0 ? '+' : ''}{token.tradingControls?.sellPriceAdjustment ?? 0}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-6 text-right">
                        <button
                          onClick={() => openEditModal(token, 'special')}
                          className={`${adminTheme.buttonPrimary} px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200`}
                        >
                          <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit Controls
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editMode && selectedToken && (
        <div className={`fixed inset-0 ${adminTheme.modalOverlay} flex items-center justify-center z-50`}>
          <div className={`${adminTheme.modalContent} rounded-xl p-8 w-full max-w-lg border ${adminTheme.borderAccent} ${adminTheme.shadowLg}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-xl font-bold ${adminTheme.textPrimary}`}>
                Edit Trading Controls
              </h3>
              <div className={`${adminTheme.accent} p-2 rounded-lg`}>
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
            </div>

            <div className={`${adminTheme.infoBg} rounded-lg p-4 mb-6 border`}>
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 ${selectedToken.type === 'special' ? 'bg-linear-to-br from-yellow-500 to-green-500' : adminTheme.accent} rounded-lg flex items-center justify-center`}>
                  <span className="text-white font-bold text-sm">{selectedToken.symbol.slice(0, 2)}</span>
                </div>
                <div>
                  <p className={`font-semibold ${adminTheme.textPrimary}`}>{selectedToken.symbol}</p>
                  <p className={`text-sm ${adminTheme.textMuted}`}>{selectedToken.name}</p>
                </div>
                {selectedToken.type === 'special' && (
                  <span className="ml-auto px-2 py-1 bg-linear-to-r from-yellow-500/20 to-green-500/20 text-yellow-500 text-xs rounded-full border border-yellow-500/30">
                    SPECIAL
                  </span>
                )}
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className={`${adminTheme.surface} rounded-lg p-4 border ${adminTheme.border}`}>
                  <label className={`flex items-center space-x-3 ${adminTheme.textSecondary}`}>
                    <input
                      type="checkbox"
                      checked={formData.buyEnabled}
                      onChange={(e) => setFormData({ ...formData, buyEnabled: e.target.checked })}
                      className="w-4 h-4 rounded border-[#333A47] bg-[#252A33] text-[#FCD535] focus:ring-[#FCD535] focus:ring-offset-[#181A20]"
                    />
                    <span className="font-medium">Enable Buying</span>
                  </label>
                </div>
                
                <div className={`${adminTheme.surface} rounded-lg p-4 border ${adminTheme.border}`}>
                  <label className={`flex items-center space-x-3 ${adminTheme.textSecondary}`}>
                    <input
                      type="checkbox"
                      checked={formData.sellEnabled}
                      onChange={(e) => setFormData({ ...formData, sellEnabled: e.target.checked })}
                      className="w-4 h-4 rounded border-[#333A47] bg-[#252A33] text-[#FCD535] focus:ring-[#FCD535] focus:ring-offset-[#181A20]"
                    />
                    <span className="font-medium">Enable Selling</span>
                  </label>
                </div>
              </div>
              
              <div>
                <label className={`block text-sm font-semibold ${adminTheme.textSecondary} mb-3`}>
                  Sell Price Adjustment (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.sellPriceAdjustment}
                  onChange={(e) => setFormData({ ...formData, sellPriceAdjustment: parseFloat(e.target.value) })}
                  className={`w-full rounded-lg px-4 py-3 ${adminTheme.input} text-lg font-medium`}
                  placeholder="Enter percentage"
                />
                <div className={`text-xs ${adminTheme.textMuted} mt-3 space-y-2 p-3 ${adminTheme.surface} rounded-lg border ${adminTheme.border}`}>
                  <p className="font-semibold">How it works (SELL ONLY - Buy is always at market price):</p>
                  <p>• <span className="text-emerald-400 font-semibold">Positive (+10%)</span> = User gets <strong>bonus</strong> - sells for 110% of their <strong>purchase price</strong></p>
                  <p>• <span className="text-red-400 font-semibold">Negative (-5%)</span> = User pays <strong>fee</strong> - sells for 95% of their <strong>purchase price</strong></p>
                  <p>• <span className={adminTheme.textMuted}>Zero (0%)</span> = Sells at exact <strong>purchase price</strong></p>
                  <p className="text-blue-500 italic">💡 Based on the price they bought at, not current market price</p>
                </div>
                {selectedToken.type === 'special' && (
                  <div className={`mt-3 p-3 ${adminTheme.infoBg} rounded-lg text-xs border`}>
                    <strong>Special Token:</strong> You can set any value. Regular tokens typically use negative values as trading fees.
                  </div>
                )}
                {selectedToken.type === 'regular' && (
                  <div className={`mt-3 p-3 ${adminTheme.warningBg} rounded-lg text-xs border`}>
                    <strong>Regular Token:</strong> Typically set negative values (like -1%) as trading fees.
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-8">
              <button
                onClick={() => setEditMode(false)}
                className={`px-6 py-3 ${adminTheme.buttonSecondary} rounded-lg transition-colors font-medium`}
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateControls(selectedToken.symbol, selectedToken.type)}
                className={`px-6 py-3 ${adminTheme.buttonPrimary} rounded-lg transition-colors font-medium`}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenTradingControls;
