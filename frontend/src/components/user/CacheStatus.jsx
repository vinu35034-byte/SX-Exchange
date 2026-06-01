import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useSession } from '../../contexts/SessionContext';
import { useCacheHealth } from '../../hooks/useCacheAwareData';
import { Button } from "@/components/ui/button";
import { 
  CheckCircle,
  AlertCircle,
  Clock,
  TrendingUp,
  Zap,
  Database,
  Wifi,
  WifiOff,
  RefreshCw,
  ArrowLeft,
  Activity,
  BarChart3,
  Globe
} from 'lucide-react';
import Menu from '../Menu';

const CacheStatus = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const { sessionStatus, heartbeat } = useSession(); // Removed sessionToken since we use session cookies
  const { data: cacheHealth, loading: healthLoading, refetch: refetchHealth } = useCacheHealth();
  
  const [performanceMetrics, setPerformanceMetrics] = useState({
    hitRate: 0,
    missRate: 0,
    totalRequests: 0,
    averageResponseTime: 0
  });

  // Mock performance data - in real app this would come from monitoring
  useEffect(() => {
    const updateMetrics = () => {
      setPerformanceMetrics({
        hitRate: Math.random() * 30 + 70, // 70-100%
        missRate: Math.random() * 30 + 0,  // 0-30%
        totalRequests: Math.floor(Math.random() * 1000) + 5000,
        averageResponseTime: Math.random() * 50 + 10 // 10-60ms
      });
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const cacheFeatures = [
    {
      title: 'Redis Caching System',
      description: 'High-performance in-memory cache with intelligent TTL management',
      status: 'active',
      metrics: {
        'Hit Rate': `${performanceMetrics.hitRate.toFixed(1)}%`,
        'Total Keys': cacheHealth?.stats?.totalKeys || 'N/A',
        'Memory Usage': cacheHealth?.stats?.memoryUsage || 'N/A'
      },
      icon: Database
    },
    {
      title: 'Session Management',
      description: 'Secure session handling with automatic refresh and heartbeat monitoring',
      status: sessionStatus === 'active' ? 'active' : 'warning',
      metrics: {
        'Session Status': sessionStatus === 'active' ? 'Connected' : 'Reconnecting',
        'Last Heartbeat': heartbeat ? new Date(heartbeat).toLocaleTimeString() : 'Never',
                'Session Active': sessionStatus === 'active' ? 'Yes' : 'No',
        'Token Valid': 'Cookie-based' // Changed from sessionToken check to indicate cookie-based auth
      },
      icon: Wifi
    },
    {
      title: 'Cache-Aware Data Fetching',
      description: 'Smart hooks that automatically manage cache states and data freshness',
      status: 'active',
      metrics: {
        'Components': '15+',
        'Avg Response': `${performanceMetrics.averageResponseTime.toFixed(0)}ms`,
        'Total Requests': performanceMetrics.totalRequests.toLocaleString()
      },
      icon: Zap
    },
    {
      title: 'Real-time Updates',
      description: 'WebSocket integration with cache synchronization for live data',
      status: 'active',
      metrics: {
        'Market Data': 'Live',
        'Price Updates': '5s interval',
        'Order Book': '2s interval'
      },
      icon: Activity
    },
    {
      title: 'Performance Optimization',
      description: 'Advanced caching strategies with background warmup and intelligent invalidation',
      status: 'active',
      metrics: {
        'Cache Hit Rate': `${performanceMetrics.hitRate.toFixed(1)}%`,
        'Miss Rate': `${performanceMetrics.missRate.toFixed(1)}%`,
        'Warmup Status': 'Active'
      },
      icon: TrendingUp
    },
    {
      title: 'Admin Cache Management',
      description: 'Comprehensive admin interface for cache monitoring and control',
      status: 'active',
      metrics: {
        'Health Status': cacheHealth?.status || 'Unknown',
        'Redis Connection': cacheHealth?.redis?.connected ? 'Connected' : 'Disconnected',
        'Uptime': cacheHealth?.uptime || 'N/A'
      },
      icon: BarChart3
    }
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'error': return 'text-red-500';
      default: return 'text-[#EAECEF]/60';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-5 h-5" />;
      case 'warning': return <AlertCircle className="w-5 h-5" />;
      case 'error': return <AlertCircle className="w-5 h-5" />;
      default: return <Clock className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen w-full max-w-md mx-auto relative overflow-hidden transition-colors duration-300 bg-[#181A20] text-[#EAECEF]">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-linear-to-br from-[#FCD535]/20 to-green-500/20 opacity-30"></div>
      <div className="absolute inset-0 bg-linear-to-b from-[#181A20] to-[#333A47]/50"></div>
      
      {/* Floating Tech Elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-4 w-16 h-16 bg-[#FCD535]/30 rounded-lg blur-lg animate-pulse"></div>
        <div className="absolute top-40 right-4 w-12 h-12 bg-green-500/30 rounded-full blur-lg animate-pulse delay-1000"></div>
        <div className="absolute bottom-60 left-4 w-20 h-20 bg-[#FCD535]/20 rounded-xl blur-lg animate-pulse delay-2000"></div>
      </div>

      {/* Main Content */}
      <div className="px-4 py-6 pb-24 relative z-10">
        {/* Header */}
        <div className="bg-[#333A47]/80 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-[#333A47]/20 shadow-lg">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="text-[#EAECEF]/60 hover:text-[#EAECEF] p-2 hover:bg-[#333A47]/50 rounded-xl transition-all duration-200"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-[#EAECEF]">Cache & Performance</h1>
              <p className="text-[#EAECEF]/60 text-sm">System optimization overview</p>
            </div>
            <button
              onClick={() => refetchHealth(true)}
              disabled={healthLoading}
              className="p-2 hover:bg-[#333A47]/50 rounded-xl transition-all duration-200 text-[#EAECEF]/60 hover:text-[#EAECEF] disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${healthLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Overall Status */}
        <div className="bg-[#333A47]/80 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-[#333A47]/20 shadow-lg">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#EAECEF]">System Status</h2>
              <p className="text-[#EAECEF]/60 text-sm">All systems operational</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#333A47]/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-4 h-4 text-[#FCD535]" />
                <span className="text-[#EAECEF]/60 text-sm">Network</span>
              </div>
              <p className="text-lg font-bold text-[#EAECEF]">
                {sessionStatus === 'active' ? 'Connected' : 'Reconnecting'}
              </p>
            </div>
            <div className="bg-[#333A47]/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-4 h-4 text-green-500" />
                <span className="text-[#EAECEF]/60 text-sm">Cache</span>
              </div>
              <p className="text-lg font-bold text-[#EAECEF]">
                {cacheHealth?.status || 'Healthy'}
              </p>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="bg-[#333A47]/80 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-[#333A47]/20 shadow-lg">
          <h3 className="text-lg font-semibold text-[#EAECEF] mb-4">Performance Metrics</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[#EAECEF]/60">Cache Hit Rate</span>
              <div className="flex items-center gap-2">
                <div className="w-20 h-2 bg-[#333A47] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 transition-all duration-500"
                    style={{ width: `${performanceMetrics.hitRate}%` }}
                  ></div>
                </div>
                <span className="text-[#EAECEF] font-medium w-12 text-right">
                  {performanceMetrics.hitRate.toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#EAECEF]/60">Response Time</span>
              <span className="text-[#EAECEF] font-medium">
                {performanceMetrics.averageResponseTime.toFixed(0)}ms
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#EAECEF]/60">Total Requests</span>
              <span className="text-[#EAECEF] font-medium">
                {performanceMetrics.totalRequests.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Feature Status Cards */}
        <div className="space-y-4">
          {cacheFeatures.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <div key={index} className="bg-[#333A47]/80 backdrop-blur-lg rounded-xl p-4 border border-[#333A47]/20 shadow-lg">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 ${
                    feature.status === 'active' ? 'bg-green-500/20' :
                    feature.status === 'warning' ? 'bg-yellow-500/20' :
                    'bg-red-500/20'
                  } rounded-xl flex items-center justify-center`}>
                    <IconComponent className={`w-6 h-6 ${getStatusColor(feature.status)}`} />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-[#EAECEF]">{feature.title}</h4>
                      <div className={getStatusColor(feature.status)}>
                        {getStatusIcon(feature.status)}
                      </div>
                    </div>
                    
                    <p className="text-[#EAECEF]/60 text-sm mb-3">{feature.description}</p>
                    
                    <div className="grid grid-cols-1 gap-2">
                      {Object.entries(feature.metrics).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-[#EAECEF]/50">{key}:</span>
                          <span className="text-[#EAECEF] font-medium">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Admin Actions */}
        <div className="bg-[#333A47]/80 backdrop-blur-lg rounded-2xl p-6 mt-6 border border-[#333A47]/20 shadow-lg">
          <h3 className="text-lg font-semibold text-[#EAECEF] mb-4">Quick Actions</h3>
          
          <div className="space-y-3">
            <Button
              onClick={() => navigate('/u/cache')}
              className="w-full bg-linear-to-r from-[#FCD535] to-green-500 text-black hover:from-[#E6C228] hover:to-green-600"
            >
              Open Admin Cache Manager
            </Button>
            
            <Button
              onClick={() => navigate('/dashboard')}
              variant="outline"
              className="w-full"
            >
              Return to Dashboard
            </Button>
          </div>
        </div>
      </div>

      <Menu />
    </div>
  );
};

export default CacheStatus;
