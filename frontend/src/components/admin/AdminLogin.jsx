import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { adminTheme } from '../../styles/adminTheme';
import { 
  EyeIcon, 
  EyeSlashIcon,
  EnvelopeIcon,
  LockClosedIcon,
  ShieldCheckIcon
} from "@heroicons/react/24/outline";
import { useAdminAuth } from '../../contexts/AdminAuthContext';

const AdminLogin = () => {
  const navigate = useNavigate();
  const { loginAdmin } = useAdminAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'email' ? value.trim() : value
    }));
    if (error) setError(''); // Clear error when user types
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!formData.email || !formData.password) {
      setError('Please fill in all fields');
      return;
    }

    if (loading) return; // Prevent double-submit

    setLoading(true);
    setError('');

    try {
      await loginAdmin(formData);
      navigate('/u/dashboard'); // Redirect to admin dashboard using /u route
    } catch (error) {
      setError(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className={`min-h-screen ${adminTheme.primary} ${adminTheme.textPrimary} relative overflow-hidden`}>
      {/* Enhanced Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-linear-to-br from-[#181A20]/80 via-[#1F2128] to-[#252A33]/80"></div>
        
        {/* Animated Orbs */}
        <div className="absolute top-20 left-10 w-32 h-32 bg-[#FCD535]/10 rounded-full blur-2xl animate-pulse"></div>
        <div className="absolute top-1/3 right-20 w-24 h-24 bg-green-500/15 rounded-full blur-xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-1/4 left-1/4 w-40 h-40 bg-[#FCD535]/8 rounded-full blur-3xl animate-pulse delay-2000"></div>
        <div className="absolute top-1/2 right-1/3 w-20 h-20 bg-[#FCD535]/12 rounded-full blur-xl animate-pulse delay-500"></div>
        <div className="absolute bottom-20 right-10 w-28 h-28 bg-green-500/10 rounded-full blur-2xl animate-pulse delay-1500"></div>
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="grid grid-cols-12 gap-4 h-full">
            {Array.from({ length: 144 }, (_, i) => (
              <div key={i} className="border border-[#FCD535]/20"></div>
            ))}
          </div>
        </div>
        
        {/* Floating Particles */}
        <div className="absolute top-1/4 left-1/2 w-2 h-2 bg-[#FCD535]/30 rounded-full animate-float"></div>
        <div className="absolute top-3/4 left-1/4 w-1 h-1 bg-green-500/40 rounded-full animate-float delay-700"></div>
        <div className="absolute top-1/2 right-1/4 w-1.5 h-1.5 bg-[#FCD535]/35 rounded-full animate-float delay-1200"></div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(252, 213, 53, 0.3); }
          50% { box-shadow: 0 0 30px rgba(252, 213, 53, 0.5); }
        }
        .animate-glow {
          animation: glow 2s ease-in-out infinite;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slideIn {
          animation: slideIn 0.6s ease-out;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.8s ease-out;
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .animate-shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          background-size: 200% 100%;
          animation: shimmer 2s infinite;
        }
      `}</style>

      {/* Main Container */}
      <div className="flex items-center justify-center min-h-screen p-4 relative z-10">
        <div className="w-full max-w-md mx-auto">
          {/* Header Section */}
          <div className="text-center mb-8 animate-fadeInUp">
            
            
            <h1 className="text-4xl md:text-5xl font-black bg-linear-to-r from-[#FCD535] via-green-500 to-[#FCD535] bg-clip-text text-transparent mb-3">
              Admin Portal
            </h1>
            <p className={`${adminTheme.textSecondary} text-lg font-medium mb-2`}>
              Secure Management Access
            </p>
            <div className="w-24 h-1 bg-linear-to-r from-[#FCD535] to-green-500 mx-auto rounded-full"></div>
          </div>

        {/* Error Message */}
        {error && (
          <div className={`mb-6 p-4 bg-red-950/50 border border-red-500/30 rounded-3xl backdrop-blur-sm animate-slideIn`}>
            <p className="text-red-400 text-sm text-center font-medium">{error}</p>
          </div>
        )}

        {/* Login Form Card */}
        <form onSubmit={handleSubmit} className={`${adminTheme.card} ${adminTheme.border} rounded-3xl p-8 relative overflow-hidden animate-slideIn backdrop-blur-md shadow-2xl`}>
          {/* Card Background Effects */}
          <div className="absolute inset-0 bg-linear-to-br from-[#FCD535]/5 via-transparent to-green-500/5"></div>
          <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-[#FCD535] via-green-500 to-[#FCD535]"></div>
          
          <div className="relative z-10 space-y-6">
            {/* Email Field */}
            <div className="space-y-3">
              <label className={`text-sm font-bold ${adminTheme.textPrimary} block uppercase tracking-wide`}>
                Admin Email
              </label>
              <div className="relative group">
                <div className="absolute inset-0 bg-linear-to-r from-[#FCD535]/20 to-green-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <EnvelopeIcon className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 ${adminTheme.textSecondary} z-10`} />
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  className={`relative w-full ${adminTheme.surface} ${adminTheme.border} rounded-2xl pl-12 pr-4 py-4 ${adminTheme.textPrimary} placeholder-[#EAECEF]/40 focus:outline-none focus:ring-2 focus:ring-[#FCD535]/50 focus:border-[#FCD535]/50 transition-all duration-300 disabled:opacity-50 backdrop-blur-sm`}
                  placeholder="Enter your admin email address"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-3">
              <label className={`text-sm font-bold ${adminTheme.textPrimary} block uppercase tracking-wide`}>
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-0 bg-linear-to-r from-[#FCD535]/20 to-green-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <LockClosedIcon className={`absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 ${adminTheme.textSecondary} z-10`} />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  className={`relative w-full ${adminTheme.surface} ${adminTheme.border} rounded-2xl pl-12 pr-12 py-4 ${adminTheme.textPrimary} placeholder-[#EAECEF]/40 focus:outline-none focus:ring-2 focus:ring-[#FCD535]/50 focus:border-[#FCD535]/50 transition-all duration-300 disabled:opacity-50 backdrop-blur-sm`}
                  placeholder="Enter your secure password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  className={`absolute right-4 top-1/2 transform -translate-y-1/2 ${adminTheme.textSecondary} hover:text-[#FCD535] transition-colors duration-200 disabled:opacity-50 z-10`}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="w-5 h-5" />
                  ) : (
                    <EyeIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <div className="pt-4">
              <Button 
                type="submit"
                disabled={loading}
                className={`w-full bg-linear-to-r from-[#FCD535] via-green-500 to-[#FCD535] hover:from-[#E6C228] hover:via-green-600 hover:to-[#E6C228] text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-2xl transition-all duration-500 hover:shadow-[#FCD535]/50 active:scale-95 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="absolute inset-0 bg-linear-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                <span className="flex items-center justify-center gap-3 relative z-10">
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border border-white/30 border-t-white rounded-full animate-spin"></div>
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <ShieldCheckIcon className="w-5 h-5" />
                      Access Admin Portal
                    </>
                  )}
                </span>
              </Button>
            </div>
          </div>
        </form>
        <div className="text-center mt-8">
          <p className={`${adminTheme.textSecondary} text-sm mb-4 font-medium`}>
            Need help accessing your account?
          </p>
          <div className="flex items-center justify-center gap-4">
            <button 
              onClick={() => navigate('/')}
              className="text-[#FCD535] hover:text-[#E6C228] font-semibold text-sm transition-colors duration-200 flex items-center gap-2"
            >
              ← Back to Home
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
