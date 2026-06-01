import React, { useState, useEffect } from 'react';
import { ApiUtils } from '../../services/api';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useNavigate } from 'react-router-dom';

const AdminCacheManager = () => {
  const { admin, logoutAdmin } = useAdminAuth();
  const navigate = useNavigate();
  const [cacheInfo, setCacheInfo] = useState(null);
  const [warmupStats, setWarmupStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Helper function to handle authentication errors
  const handleAuthError = async (err) => {
    console.error('Authentication error:', err);
    setError('Admin session expired. Redirecting to login...');
    try {
      if (logoutAdmin) await logoutAdmin();
    } catch (logoutError) {
      console.warn('Logout error during session expiry:', logoutError.message);
    }
    setTimeout(() => navigate('/u/login'), 1000);
  };

  // Helper function to check if error is authentication related
  const isAuthError = (err) => {
    const authErrorMessages = [
      'session expired',
      'Unauthorized', 
      'not authenticated',
      'SESSION_REQUIRED',
      'SESSION_EXPIRED',
      'Admin session expired'
    ];
    return authErrorMessages.some(msg => err.message.includes(msg));
  };

  // Fetch cache information
  const fetchCacheInfo = async () => {
    if (!admin) {
      setError('Admin authentication required');
      return;
    }
    
    try {
      setError(null);
      const response = await ApiUtils.get('/admin/cache/info');
      
      if (response.success) {
        setCacheInfo(response.data.cache);
        setWarmupStats(response.data.warmup);
      } else {
        throw new Error(response.message || 'Failed to fetch cache info');
      }
    } catch (err) {
      // Handle authentication errors more specifically
      if (isAuthError(err)) {
        await handleAuthError(err);
      } else {
        setError(err.message);
      }
      console.error('Cache info fetch failed:', err);
    }
  };

  // Cache warmup
  const handleWarmup = async (specificTasks = null) => {
    if (!admin) {
      setError('Admin authentication required');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const response = await ApiUtils.post('/admin/cache/warmup', specificTasks ? { tasks: specificTasks } : {});
      
      if (response.success) {
        setSuccess(`Cache warmup completed: ${response.data.tasksSuccessful}/${response.data.tasksTotal} tasks successful`);
        await fetchCacheInfo(); // Refresh info
      } else {
        throw new Error(response.message || 'Cache warmup failed');
      }
    } catch (err) {
      // Handle authentication errors
      if (isAuthError(err)) {
        await handleAuthError(err);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Clear cache
  const handleClear = async (pattern = null) => {
    if (!admin) {
      setError('Admin authentication required');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const response = await ApiUtils.post('/admin/cache/clear', pattern ? { pattern } : {});
      
      if (response.success) {
        setSuccess(`Cache cleared: ${response.data.cleared} keys`);
        await fetchCacheInfo(); // Refresh info
      } else {
        throw new Error(response.message || 'Cache clear failed');
      }
    } catch (err) {
      // Handle authentication errors
      if (isAuthError(err)) {
        await handleAuthError(err);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Refresh cache
  const handleRefresh = async () => {
    if (!admin) {
      setError('Admin authentication required');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const response = await ApiUtils.post('/admin/cache/refresh');
      
      if (response.success) {
        setSuccess(`Cache refreshed: ${response.data.tasksSuccessful}/${response.data.tasksTotal} tasks successful`);
        await fetchCacheInfo(); // Refresh info
      } else {
        throw new Error(response.message || 'Cache refresh failed');
      }
    } catch (err) {
      // Handle authentication errors
      if (isAuthError(err)) {
        await handleAuthError(err);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Check cache health
  const checkHealth = async () => {
    if (!admin) {
      setError('Admin authentication required');
      return;
    }
    
    try {
      setError(null);
      const response = await ApiUtils.get('/admin/cache/health');
      
      if (response.success) {
        setSuccess(`Cache health: ${response.healthy ? 'Healthy' : 'Unhealthy'}`);
      } else {
        throw new Error(response.message || 'Health check failed');
      }
    } catch (err) {
      // Handle authentication errors
      if (isAuthError(err)) {
        await handleAuthError(err);
      } else {
        setError(err.message);
      }
    }
  };

  // Toggle auto refresh
  const toggleAutoRefresh = () => {
    if (autoRefresh) {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
      setAutoRefresh(false);
    } else {
      const interval = setInterval(fetchCacheInfo, 30000); // Refresh every 30 seconds
      setRefreshInterval(interval);
      setAutoRefresh(true);
    }
  };

  // Initialize
  useEffect(() => {
    if (admin) {
      fetchCacheInfo();
    }
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [admin]);

  // Auto-redirect if admin becomes null (logged out)
  useEffect(() => {
    if (admin === false) { // Explicitly false means checked and not authenticated
      navigate('/u/login');
    }
  }, [admin, navigate]);

  // Format bytes
  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format duration
  const formatDuration = (ms) => {
    if (!ms) return '0ms';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="admin-cache-manager p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {!admin ? (
        <div className="text-center py-8">
          <div className="text-red-600 dark:text-red-400 mb-4">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h3 className="text-lg font-semibold mb-2">Admin Authentication Required</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Please log in as an administrator to access cache management.</p>
            <button
              onClick={() => navigate('/u/login')}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
            >
              Go to Admin Login
            </button>
          </div>
        </div>
      ) : (
        <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
          Cache Management
        </h2>
        
        <div className="flex space-x-2">
          <button
            onClick={toggleAutoRefresh}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              autoRefresh
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-600 dark:hover:bg-gray-700 dark:text-gray-200'
            }`}
          >
            {autoRefresh ? 'Auto-Refresh ON' : 'Auto-Refresh OFF'}
          </button>
          
          <button
            onClick={fetchCacheInfo}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            Refresh Info
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className={`mb-4 p-4 border rounded-lg ${
          error.includes('session expired') || error.includes('authentication') 
            ? 'bg-yellow-100 border-yellow-300 text-yellow-700' 
            : 'bg-red-100 border-red-300 text-red-700'
        }`}>
          <strong>{error.includes('session expired') ? 'Session Expired:' : 'Error:'}</strong> {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-4 bg-green-100 border border-green-300 text-green-700 rounded-lg">
          <strong>Success:</strong> {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cache Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            Cache Information
          </h3>
          
          {cacheInfo ? (
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Status:</span>
                  <span className={`font-medium ${
                    cacheInfo.connected ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {cacheInfo.connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Keys:</span>
                  <span className="font-medium text-gray-800 dark:text-white">
                    {cacheInfo.dbSize || 0}
                  </span>
                </div>
                
                {cacheInfo.info && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Memory Used:</span>
                      <span className="font-medium text-gray-800 dark:text-white">
                        {formatBytes(parseInt(cacheInfo.info.used_memory || 0))}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">Uptime:</span>
                      <span className="font-medium text-gray-800 dark:text-white">
                        {cacheInfo.info.uptime_in_seconds ? 
                          `${Math.floor(cacheInfo.info.uptime_in_seconds / 3600)}h ${Math.floor((cacheInfo.info.uptime_in_seconds % 3600) / 60)}m` :
                          'N/A'
                        }
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <p className="text-gray-500 dark:text-gray-400">Loading cache information...</p>
            </div>
          )}
        </div>

        {/* Warmup Statistics */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            Warmup Statistics
          </h3>
          
          {warmupStats ? (
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Status:</span>
                  <span className={`font-medium ${
                    warmupStats.isWarming ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {warmupStats.isWarming ? 'In Progress' : 'Idle'}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-300">Total Tasks:</span>
                  <span className="font-medium text-gray-800 dark:text-white">
                    {warmupStats.totalTasks}
                  </span>
                </div>
                
                {warmupStats.tasks && warmupStats.tasks.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Task Status:
                    </h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {warmupStats.tasks.map((task, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-300">
                            {task.name}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400">
                            {task.runCount > 0 ? 
                              `${formatDuration(task.avgDuration)} avg` : 
                              'Not run'
                            }
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <p className="text-gray-500 dark:text-gray-400">Loading warmup statistics...</p>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => handleWarmup()}
          disabled={loading}
          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Warmup Cache'}
        </button>
        
        <button
          onClick={() => handleClear()}
          disabled={loading}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Clear All'}
        </button>
        
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Refresh Cache'}
        </button>
        
        <button
          onClick={checkHealth}
          disabled={loading}
          className="px-4 py-2 bg-[#FCD535] hover:bg-[#E6C228] text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          Health Check
        </button>
      </div>

      {/* Pattern Clear */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Clear Specific Pattern:
        </h4>
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="e.g. market:*, vip:*, user:*"
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
            onKeyPress={(e) => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                handleClear(e.target.value.trim());
                e.target.value = '';
              }
            }}
          />
          <button
            onClick={(e) => {
              const input = e.target.previousElementSibling;
              if (input.value.trim()) {
                handleClear(input.value.trim());
                input.value = '';
              }
            }}
            disabled={loading}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            Clear Pattern
          </button>
        </div>
      </div>
        </>
      )}
    </div>
  );
};

export default AdminCacheManager;
