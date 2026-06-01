import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom"
import { Toaster } from 'react-hot-toast'
import { UserAuthProvider } from "./contexts/UserAuthContext"
import { AdminAuthProvider } from "./contexts/AdminAuthContext"
import { ThemeProvider } from "./contexts/ThemeContext"
import { NotificationProvider } from "./contexts/NotificationContext"
import { TradingProvider } from "./contexts/TradingContext"
import { UserProfileProvider } from "./contexts/UserProfileContext"
import { SessionProvider } from "./contexts/SessionContext"
import UserProtectedRoute from "./components/UserProtectedRoute"
import AdminProtectedRoute from "./components/AdminProtectedRoute"
import Home from "./components/Home"
import Market from "./components/user/Market"
import HexLogo from "./components/common/HexLogo"
import Trade from "./components/user/Trade"
import DemoTrade from "./components/user/DemoTrade"
import Asset from "./components/user/Asset"
import Transactions from "./components/user/Transactions"
import Deposit from "./components/user/Deposit"
import DepositHistoryPageWrapper from "./components/user/DepositHistoryPageWrapper"
import Withdraw from "./components/user/Withdraw"
import WithdrawalHistoryPageWrapper from "./components/user/WithdrawalHistoryPageWrapper"
import Settings from "./components/user/Settings"
import Profile from "./components/user/Profile"
import Referrals from "./components/user/Referrals"
import Rewards from "./components/Rewards"
import CopyTrading from "./components/user/CopyTrading"
import KYC from "./components/user/KYC"
import SignIn from "./components/user/SignIn"
import SignUp from "./components/user/SignUp"
import ResetPassword from "./components/user/ResetPassword"
import CacheStatus from "./components/user/CacheStatus"
import AdminLogin from "./components/admin/AdminLogin"
import AdminDashboard from "./components/admin/AdminDashboard"
import AdminDeposits from "./components/admin/AdminDeposits"
import AdminTransactions from "./components/admin/AdminTransactions"
import AdminAllTransactions from "./components/admin/AdminAllTransactions"
import AdminWithdrawals from "./components/admin/AdminWithdrawals"
import AdminTokenManager from "./components/admin/AdminTokenManager"
import AdminSpecialTokenManager from "./components/admin/AdminSpecialTokenManager"
import AdminReferralManager from "./components/admin/AdminReferralManager"
import AdminVIPManager from "./components/admin/AdminVIPManager"
import AdminKYCManager from "./components/admin/AdminKYCManager"
import AdminFundManager from "./components/admin/AdminFundManager"
import AdminUserManager from "./components/admin/AdminUserManager"
import AdminTelegramSupport from "./components/admin/AdminTelegramSupport"
import AdminNotificationManager from "./components/admin/AdminNotificationManager"
import AdminBannerManager from "./components/admin/AdminBannerManager"
import AdminCacheManager from "./components/admin/AdminCacheManager"
import AdminStakingManagement from "./components/admin/AdminStakingManagement"
import AdminCopyTradingManager from "./components/admin/AdminCopyTradingManager"
import TokenTradingControls from "./components/admin/TokenTradingControls"
import Staking from "./components/Staking"
import EditProfile from "./components/user/EditProfile"
import Preferences from "./components/user/Preferences"
import Security from "./components/user/Security"
import Help from "./components/user/Help"
import About from "./components/About"
import Terms from "./components/Terms"
import AML from "./components/AML"
import Blog from "./components/Blog"
import BlogPost from "./components/BlogPost"
import Careers from "./components/Careers"
import Affiliates from "./components/Affiliates"
import AdminBlogManager from "./components/admin/AdminBlogManager"
import { useEffect } from "react"
import { showToast } from "./utils/toast"
import { User } from "lucide-react"

function App() {
  useEffect(() => {
    // Listen for session expiry events
    const handleSessionExpired = () => {
      // Clear any cached data
      localStorage.removeItem('sessionId');
      
      // Only redirect if not already on signin page to prevent infinite redirects
      if (window.location.pathname !== '/signin') {
        // Use navigate instead of window.location.href for better React Router integration
        window.location.href = '/signin';
      }
    };

    // Listen for banned account events
    const handleAccountBanned = (event) => {
      const { reason, bannedAt } = event.detail || {};
      
      // Clear any cached data
      localStorage.removeItem('sessionId');
      
      // Show ban message using toast with enhanced styling
      showToast.error(
        `Account Banned: ${reason || 'Not specified'}. Please contact support for assistance.`,
        {
          duration: 5000, // Longer duration for important message
          style: {
            maxWidth: '500px',
            fontSize: '15px',
            fontWeight: '600',
          }
        }
      );
      
      // Redirect to signin page after a short delay to allow toast to be seen
      setTimeout(() => {
        if (window.location.pathname !== '/signin') {
          window.location.href = '/signin';
        }
      }, 1500);
    };

    // Listen for inactive account events
    const handleAccountInactive = () => {
      // Clear any cached data
      localStorage.removeItem('sessionId');
      
      // Show inactive message using toast
      showToast.warning(
        'Your account is inactive. Please contact support for assistance.',
        {
          duration: 4000,
          style: {
            maxWidth: '450px',
            fontSize: '15px',
            fontWeight: '600',
          }
        }
      );
      
      // Redirect to signin page after a short delay
      setTimeout(() => {
        if (window.location.pathname !== '/signin') {
          window.location.href = '/signin';
        }
      }, 1500);
    };

    window.addEventListener('sessionExpired', handleSessionExpired);
    window.addEventListener('accountBanned', handleAccountBanned);
    window.addEventListener('accountInactive', handleAccountInactive);
    
    return () => {
      window.removeEventListener('sessionExpired', handleSessionExpired);
      window.removeEventListener('accountBanned', handleAccountBanned);
      window.removeEventListener('accountInactive', handleAccountInactive);
    };
  }, []);

  return (
    <Router>
      <SessionProvider>
        <ThemeProvider>
          <UserAuthProvider>
            <AdminAuthProvider>
              <NotificationProvider>
                <TradingProvider>
                  <UserProfileProvider>
                      <div className="min-h-screen bg-bg-primary text-primary transition-colors duration-300">
                        <Routes>
                          {/* Public Routes */}
                          <Route path="/" element={<Home />} />
                          <Route path="/market" element={<Market />} />
                          <Route path="/signin" element={<SignIn />} />
                          <Route path="/signup" element={<SignUp />} />
                          <Route path="/reset-password" element={<ResetPassword />} />
                          <Route path="/help" element={<Help />} />
                          <Route path="/about" element={<About />} />
                          <Route path="/terms" element={<Terms />} />
                          <Route path="/aml" element={<AML />} />
                          <Route path="/blog" element={<Blog />} />
                          <Route path="/blog/:slug" element={<BlogPost />} />
                          <Route path="/careers" element={<Careers />} />
                          <Route path="/affiliates" element={<Affiliates />} />
                          <Route path="/logo" element={<HexLogo />} />

                          {/* Cache Status */}
                          <Route path="/cache-status" element={
                            <UserProtectedRoute>
                              <CacheStatus />
                            </UserProtectedRoute>
                          } />

                          {/* User Routes - Protected */}
                          <Route path="/trade" element={
                            <UserProtectedRoute>
                              <Trade />
                            </UserProtectedRoute>
                          } />
                          <Route path="/demo-trade" element={
                            <UserProtectedRoute>
                              <DemoTrade />
                            </UserProtectedRoute>
                          } />
                          <Route path="/asset" element={
                            <UserProtectedRoute>
                              <Asset />
                            </UserProtectedRoute>
                          } />
                          <Route path="/assets" element={
                            <UserProtectedRoute>
                              <Asset />
                            </UserProtectedRoute>
                          } />
                          <Route path="/transactions" element={
                            <UserProtectedRoute>
                              <Transactions />
                            </UserProtectedRoute>
                          } />
                          <Route path="/deposit" element={
                            <UserProtectedRoute>
                              <Deposit />
                            </UserProtectedRoute>
                          } />
                          <Route path="/deposit-history" element={
                            <UserProtectedRoute>
                              <DepositHistoryPageWrapper />
                            </UserProtectedRoute>
                          } />
                          <Route path="/withdraw" element={
                            <UserProtectedRoute>
                              <Withdraw />
                            </UserProtectedRoute>
                          } />
                          <Route path="/withdrawal-history" element={
                            <UserProtectedRoute>
                              <WithdrawalHistoryPageWrapper />
                            </UserProtectedRoute>
                          } />
                          <Route path="/settings" element={
                            <UserProtectedRoute>
                              <Settings />
                            </UserProtectedRoute>
                          } />
                          <Route path="/profile" element={
                            <UserProtectedRoute>
                              <Profile />
                            </UserProtectedRoute>
                          } />
                          <Route path="/profile/edit" element={
                            <UserProtectedRoute>
                              <EditProfile />
                            </UserProtectedRoute>
                          } />
                          <Route path="/preferences" element={
                            <UserProtectedRoute>
                              <Preferences />
                            </UserProtectedRoute>
                          } />
                          <Route path="/referrals" element={
                            <UserProtectedRoute>
                              <Referrals />
                            </UserProtectedRoute>
                          } />
                          <Route path="/rewards" element={
                            <UserProtectedRoute>
                              <Rewards />
                            </UserProtectedRoute>
                          } />
                          <Route path="/copy-trading" element={
                            <UserProtectedRoute>
                              <CopyTrading />
                            </UserProtectedRoute>
                          } />
                          <Route path="/staking" element={
                            <UserProtectedRoute>
                              <Staking />
                            </UserProtectedRoute>
                          } />
                         
                          <Route path="/kyc" element={
                            <UserProtectedRoute>
                              <KYC />
                            </UserProtectedRoute>
                          } />
                          <Route path="/security" element={
                            <UserProtectedRoute>
                              <Security />
                            </UserProtectedRoute>
                          } />
                          <Route path="/edit-profile" element={
                            <UserProtectedRoute>
                              <EditProfile />
                            </UserProtectedRoute>
                          } />
                          
                          
                          {/* Admin Routes - using /u prefix as requested */}
                          <Route path="/u/login" element={<AdminLogin />} />
                          <Route path="/u/dashboard" element={
                            <AdminProtectedRoute>
                              <AdminDashboard />
                            </AdminProtectedRoute>
                          } />
                          <Route path="/u/deposits" element={
                            <AdminProtectedRoute>
                              <AdminDeposits />
                            </AdminProtectedRoute>
                          } />
                          <Route path="/u/transactions" element={
                            <AdminProtectedRoute>
                              <AdminTransactions />
                            </AdminProtectedRoute>
                          } />
                          <Route path="/u/all-transactions" element={
                            <AdminProtectedRoute>
                              <AdminAllTransactions />
                            </AdminProtectedRoute>
                          } />
                          <Route path="/u/withdrawals" element={
                            <AdminProtectedRoute>
                              <AdminWithdrawals />
                            </AdminProtectedRoute>
                          } />
                          <Route path="/u/tokens" element={
                            <AdminProtectedRoute>
                              <AdminTokenManager />
                            </AdminProtectedRoute>
                          } />
                          <Route path="/u/special-tokens" element={
                            <AdminProtectedRoute>
                              <AdminSpecialTokenManager />
                            </AdminProtectedRoute>
                          } />
                          <Route path="/u/referrals" element={
                            <AdminProtectedRoute>
                              <AdminReferralManager />
                            </AdminProtectedRoute>
                          } />
                          <Route path="/u/copy-trading" element={
                            <AdminProtectedRoute>
                              <AdminCopyTradingManager />
                            </AdminProtectedRoute>
                          } />
                          <Route path="/u/vip" element={
                            <AdminProtectedRoute>
                              <AdminVIPManager />
                            </AdminProtectedRoute>
                          } />
                          <Route path="/u/kyc" element={
                            <AdminProtectedRoute>
                              <AdminKYCManager />
                            </AdminProtectedRoute>
                          } />
                          <Route path="/u/notifications" element={
                            <AdminProtectedRoute>
                              <AdminNotificationManager />
                            </AdminProtectedRoute>
                          } />
                          <Route path="/u/cache" element={
                            <AdminProtectedRoute>
                              <AdminCacheManager />
                            </AdminProtectedRoute>
                          } />
                          <Route path="/u/trading-controls" element={
                            <AdminProtectedRoute>
                              <TokenTradingControls />
                            </AdminProtectedRoute>
                          } />
                          <Route path="/u/fund-management" element={
                            <AdminProtectedRoute>
                              <AdminFundManager />
                            </AdminProtectedRoute>
                          } />
                          <Route path="/u/users" element={
                            <AdminProtectedRoute>
                              <AdminUserManager />
                            </AdminProtectedRoute>
                          } />
                          <Route path="/u/telegram-support" element={
                            <AdminProtectedRoute>
                              <AdminTelegramSupport />
                            </AdminProtectedRoute>
                          } />
                          <Route path="/u/staking" element={
                            <AdminProtectedRoute>
                              <AdminStakingManagement />
                            </AdminProtectedRoute>
                          } />
                          <Route path="/u/banners" element={
                            <AdminProtectedRoute>
                              <AdminBannerManager />
                            </AdminProtectedRoute>
                          } />
                          <Route path="/u/blog" element={
                            <AdminProtectedRoute>
                              <AdminBlogManager />
                            </AdminProtectedRoute>
                          } />
                          <Route path="/u/*" element={<Navigate to="/u/dashboard" replace />} />
                          
                          {/* Fallback */}
                          <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                      </div>
                      
                      {/* Toast notifications with enhanced styling */}
                      <Toaster
                        position="top-center"
                        gutter={10}
                        containerStyle={{
                          top: '50%',
                          bottom: 'auto',
                          transform: 'translateY(-50%)',
                          zIndex: 9999,
                        }}
                        toastOptions={{
                          style: {
                            borderRadius: '18px',
                            padding: '12px 16px',
                            fontSize: '13.5px',
                            fontWeight: '600',
                            color: '#0A0A0A',
                            background: '#ffffff',
                            border: '1.5px solid rgba(0,82,255,0.15)',
                            boxShadow: '0 8px 30px rgba(0,82,255,0.10), 0 2px 8px rgba(0,0,0,0.07)',
                            maxWidth: '360px',
                            minWidth: '240px',
                          },
                          success: {
                            duration: 1500,
                            iconTheme: { primary: '#00C853', secondary: '#ffffff' },
                          },
                          error: {
                            duration: 2500,
                            iconTheme: { primary: '#FF3B30', secondary: '#ffffff' },
                          },
                          loading: {
                            duration: Infinity,
                            iconTheme: { primary: '#0052FF', secondary: '#ffffff' },
                          },
                        }}
                      />
                    </UserProfileProvider>
                  </TradingProvider>
                </NotificationProvider>
              </AdminAuthProvider>
            </UserAuthProvider>
          </ThemeProvider>
        </SessionProvider>
      </Router>
    )
}

export default App
