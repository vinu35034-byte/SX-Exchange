import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { Button } from "@/components/ui/button";
import { adminTheme } from '../../styles/adminTheme';
import { ApiUtils } from '../../services/api';
import toast from 'react-hot-toast';
import { 
  ArrowLeft,
  MessageCircle,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  Play,
  BarChart3,
  CreditCard,
  Banknote,
  Users,
  Shield,
  Wrench
} from "lucide-react";

const AdminTelegramSupport = () => {
  const navigate = useNavigate();
  const { admin } = useAdminAuth();
  const [supportTopics, setSupportTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState(null);
  const [rateLimitedUntil, setRateLimitedUntil] = useState(null);
  const [formData, setFormData] = useState({
    topic: '',
    title: '',
    description: '',
    telegramUsername: '',
    telegramUserId: '',
    priority: 1,
    icon: 'QuestionMarkCircleIcon',
    isActive: true
  });

  // Icon options for topics
  const iconOptions = [
    { value: 'QuestionMarkCircleIcon', label: 'Question Mark', icon: HelpCircle },
    { value: 'PlayCircleIcon', label: 'Play Circle', icon: Play },
    { value: 'ChartBarIcon', label: 'Chart Bar', icon: BarChart3 },
    { value: 'IdentificationIcon', label: 'Identification', icon: CreditCard },
    { value: 'BanknotesIcon', label: 'Banknotes', icon: Banknote },
    { value: 'UserGroupIcon', label: 'User Group', icon: Users },
    { value: 'ShieldCheckIcon', label: 'Shield Check', icon: Shield },
    { value: 'WrenchScrewdriverIcon', label: 'Wrench Screwdriver', icon: Wrench },
    { value: 'ChatBubbleLeftRightIcon', label: 'Chat Bubble', icon: MessageCircle }
  ];

  // Topic options
  const topicOptions = [
    { value: 'getting_started', label: 'Getting Started' },
    { value: 'trading_guide', label: 'Trading Guide' },
    { value: 'kyc_verification', label: 'KYC Verification' },
    { value: 'deposits_withdrawals', label: 'Deposits & Withdrawals' },
    { value: 'referral_program', label: 'Referral Program' },
    { value: 'security_practices', label: 'Security Best Practices' },
    { value: 'troubleshooting', label: 'Troubleshooting' },
    { value: 'general_support', label: 'General Support' }
  ];

  // Fetch support topics with rate limit handling
  const fetchSupportTopics = async () => {
    // Check if we're still rate limited
    if (rateLimitedUntil && Date.now() < rateLimitedUntil) {
      const remainingTime = Math.ceil((rateLimitedUntil - Date.now()) / 1000);
      toast.error(`Rate limited. Please wait ${remainingTime} seconds before trying again.`);
      return;
    }

    try {
      setLoading(true);
      const data = await ApiUtils.get('admin/telegram-support');
      setSupportTopics(data.data);
      setRateLimitedUntil(null); // Clear rate limit if successful
    } catch (error) {
      console.error('Error fetching support topics:', error);
      
      // Handle rate limiting specifically
      if (error.message.includes('Rate limit') || error.message.includes('429')) {
        const waitTime = 60000; // Wait 1 minute
        setRateLimitedUntil(Date.now() + waitTime);
        toast.error(`Rate limit exceeded. Please wait 1 minute before trying again.`);
      } else {
        toast.error('Failed to fetch support topics');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle form submission with rate limit handling
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check if we're still rate limited
    if (rateLimitedUntil && Date.now() < rateLimitedUntil) {
      const remainingTime = Math.ceil((rateLimitedUntil - Date.now()) / 1000);
      toast.error(`Rate limited. Please wait ${remainingTime} seconds before trying again.`);
      return;
    }
    
    const loadingToast = toast.loading(editingTopic ? 'Updating topic...' : 'Creating topic...');
    
    try {
      // Clean username (remove @ if present)
      const cleanFormData = {
        ...formData,
        telegramUsername: formData.telegramUsername.replace(/^@/, '')
      };
      
      if (editingTopic) {
        await ApiUtils.put(`admin/telegram-support/${editingTopic._id}`, cleanFormData);
        toast.success('Topic updated successfully!', { id: loadingToast });
      } else {
        await ApiUtils.post('admin/telegram-support', cleanFormData);
        toast.success('Topic created successfully!', { id: loadingToast });
      }
      
      resetForm();
      // Add a small delay before fetching to avoid rapid requests
      setTimeout(() => fetchSupportTopics(), 500);
    } catch (error) {
      console.error('Error saving topic:', error);
      
      // Handle rate limiting specifically
      if (error.message.includes('Rate limit') || error.message.includes('429')) {
        const waitTime = 60000; // Wait 1 minute
        setRateLimitedUntil(Date.now() + waitTime);
        toast.error('Rate limit exceeded. Please wait 1 minute before trying again.', { id: loadingToast });
      } else {
        toast.error(error.message || 'Failed to save topic', { id: loadingToast });
      }
    }
  };

  // Handle delete with rate limit handling
  const handleDelete = async (topic) => {
    if (!confirm(`Are you sure you want to delete "${topic.title}"?`)) return;
    
    // Check if we're still rate limited
    if (rateLimitedUntil && Date.now() < rateLimitedUntil) {
      const remainingTime = Math.ceil((rateLimitedUntil - Date.now()) / 1000);
      toast.error(`Rate limited. Please wait ${remainingTime} seconds before trying again.`);
      return;
    }
    
    const loadingToast = toast.loading('Deleting topic...');
    
    try {
      await ApiUtils.delete(`admin/telegram-support/${topic._id}`);
      toast.success('Topic deleted successfully!', { id: loadingToast });
      // Add a small delay before fetching to avoid rapid requests
      setTimeout(() => fetchSupportTopics(), 500);
    } catch (error) {
      console.error('Error deleting topic:', error);
      
      // Handle rate limiting specifically
      if (error.message.includes('Rate limit') || error.message.includes('429')) {
        const waitTime = 60000; // Wait 1 minute
        setRateLimitedUntil(Date.now() + waitTime);
        toast.error('Rate limit exceeded. Please wait 1 minute before trying again.', { id: loadingToast });
      } else {
        toast.error('Failed to delete topic', { id: loadingToast });
      }
    }
  };

  // Handle toggle status with rate limit handling
  const handleToggleStatus = async (topic) => {
    // Check if we're still rate limited
    if (rateLimitedUntil && Date.now() < rateLimitedUntil) {
      const remainingTime = Math.ceil((rateLimitedUntil - Date.now()) / 1000);
      toast.error(`Rate limited. Please wait ${remainingTime} seconds before trying again.`);
      return;
    }
    
    const loadingToast = toast.loading(`${topic.isActive ? 'Deactivating' : 'Activating'} topic...`);
    
    try {
      await ApiUtils.patch(`admin/telegram-support/${topic._id}/toggle`);
      toast.success(`Topic ${topic.isActive ? 'deactivated' : 'activated'} successfully!`, { id: loadingToast });
      // Add a small delay before fetching to avoid rapid requests
      setTimeout(() => fetchSupportTopics(), 500);
    } catch (error) {
      console.error('Error toggling topic status:', error);
      
      // Handle rate limiting specifically
      if (error.message.includes('Rate limit') || error.message.includes('429')) {
        const waitTime = 60000; // Wait 1 minute
        setRateLimitedUntil(Date.now() + waitTime);
        toast.error('Rate limit exceeded. Please wait 1 minute before trying again.', { id: loadingToast });
      } else {
        toast.error('Failed to toggle topic status', { id: loadingToast });
      }
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      topic: '',
      title: '',
      description: '',
      telegramUsername: '',
      telegramUserId: '',
      priority: 1,
      icon: 'QuestionMarkCircleIcon',
      isActive: true
    });
    setEditingTopic(null);
    setShowCreateModal(false);
    setShowEditModal(false);
  };

  // Handle edit
  const handleEdit = (topic) => {
    setFormData({
      topic: topic.topic,
      title: topic.title,
      description: topic.description,
      telegramUsername: topic.telegramUsername,
      telegramUserId: topic.telegramUserId || '',
      priority: topic.priority,
      icon: topic.icon,
      isActive: topic.isActive
    });
    setEditingTopic(topic);
    setShowEditModal(true);
  };

  // Get icon component
  const getIconComponent = (iconName) => {
    const iconOption = iconOptions.find(opt => opt.value === iconName);
    const IconComponent = iconOption ? iconOption.icon : HelpCircle;
    return <IconComponent className="w-5 h-5" />;
  };

  // Load data on mount with debouncing
  useEffect(() => {
    if (admin) {
      // Add a small delay to prevent multiple rapid calls
      const timeoutId = setTimeout(() => {
        fetchSupportTopics();
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [admin]);

  if (!admin) {
    return (
      <div className={`min-h-screen ${adminTheme.primary} flex items-center justify-center`}>
        <div className={`${adminTheme.textPrimary} text-center`}>
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className={`${adminTheme.textSecondary} mb-4`}>Admin access required</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${adminTheme.primary} ${adminTheme.textPrimary}`}>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button 
              onClick={() => navigate('/u/dashboard')}
              className={`${adminTheme.buttonSecondary} p-2`}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className={`text-3xl font-bold ${adminTheme.textPrimary} flex items-center gap-3`}>
                <MessageCircle className="w-8 h-8 text-blue-500" />
                Telegram Support Management
              </h1>
              <p className={`${adminTheme.textSecondary} mt-1`}>
                Manage help center topics and Telegram support contacts
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              onClick={fetchSupportTopics}
              className={`${adminTheme.buttonSecondary}`}
              disabled={loading || (rateLimitedUntil && Date.now() < rateLimitedUntil)}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {rateLimitedUntil && Date.now() < rateLimitedUntil 
                ? `Wait ${Math.ceil((rateLimitedUntil - Date.now()) / 1000)}s` 
                : 'Refresh'
              }
            </Button>
            
            <Button 
              onClick={() => setShowCreateModal(true)}
              className={`${adminTheme.buttonPrimary}`}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Topic
            </Button>
          </div>
        </div>

        {/* Rate Limit Warning */}
        {rateLimitedUntil && Date.now() < rateLimitedUntil && (
          <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-4 mb-6 bg-yellow-500/10 border-yellow-500/20`}>
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-500" />
              <div>
                <h3 className="font-semibold text-yellow-500">Rate Limited</h3>
                <p className={`${adminTheme.textSecondary} text-sm`}>
                  Too many requests. Please wait {Math.ceil((rateLimitedUntil - Date.now()) / 1000)} seconds before making more requests.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Support Topics List */}
        <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 ${adminTheme.shadow}`}>
          <h2 className={`text-xl font-bold ${adminTheme.textPrimary} mb-6`}>
            Support Topics ({supportTopics.length})
          </h2>
          
          {loading ? (
            <div className={`text-center py-8 ${adminTheme.textSecondary}`}>
              <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin" />
              <p>Loading support topics...</p>
            </div>
          ) : supportTopics.length === 0 ? (
            <div className={`text-center py-8 ${adminTheme.textSecondary}`}>
              <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No Support Topics</h3>
              <p className="mb-4">Create your first support topic to get started.</p>
              <Button 
                onClick={() => setShowCreateModal(true)}
                className={`${adminTheme.buttonPrimary}`}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create First Topic
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {supportTopics.map((topic) => (
                <div key={topic._id} className={`${adminTheme.surface} rounded-xl p-4 flex items-center justify-between`}>
                  <div className="flex items-center flex-1">
                    <div className="shrink-0 mr-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        topic.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {getIconComponent(topic.icon)}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className={`font-semibold ${adminTheme.textPrimary}`}>
                          {topic.title}
                        </h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          topic.isActive 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {topic.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-500`}>
                          Priority: {topic.priority}
                        </span>
                      </div>
                      <p className={`${adminTheme.textSecondary} text-sm mb-2`}>
                        {topic.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs">
                        <span className={`${adminTheme.textSecondary}`}>
                          Topic: <span className="font-mono">{topic.topic}</span>
                        </span>
                        <span className={`${adminTheme.textSecondary}`}>
                          Telegram: <span className="font-mono">@{topic.telegramUsername}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => window.open(`https://t.me/${topic.telegramUsername}`, '_blank')}
                      className={`${adminTheme.buttonSecondary} text-sm px-3 py-1`}
                      title="Open Telegram"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                    
                    <Button
                      onClick={() => handleToggleStatus(topic)}
                      className={`${adminTheme.buttonSecondary} text-sm px-3 py-1`}
                      title={topic.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {topic.isActive ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                    
                    <Button
                      onClick={() => handleEdit(topic)}
                      className={`${adminTheme.buttonSecondary} text-sm px-3 py-1`}
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    
                    <Button
                      onClick={() => handleDelete(topic)}
                      className={`${adminTheme.buttonSecondary} text-sm px-3 py-1 hover:bg-red-500/20 hover:text-red-400`}
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create/Edit Modal */}
        {(showCreateModal || showEditModal) && (
          <div className={`fixed inset-0 ${adminTheme.modalOverlay} flex items-center justify-center z-50 p-4`}>
            <div className={`${adminTheme.card} ${adminTheme.border} rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto ${adminTheme.shadow}`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className={`text-xl font-bold ${adminTheme.textPrimary}`}>
                  {editingTopic ? 'Edit Support Topic' : 'Create Support Topic'}
                </h3>
                <Button
                  onClick={resetForm}
                  className={`${adminTheme.buttonSecondary} p-2`}
                >
                  ×
                </Button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium ${adminTheme.textPrimary} mb-2`}>
                      Topic Type
                    </label>
                    <select
                      value={formData.topic}
                      onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                      className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 text-sm`}
                      required
                      disabled={!!editingTopic}
                    >
                      <option value="">Select topic type</option>
                      {topicOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium ${adminTheme.textPrimary} mb-2`}>
                      Icon
                    </label>
                    <select
                      value={formData.icon}
                      onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                      className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 text-sm`}
                    >
                      {iconOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className={`block text-sm font-medium ${adminTheme.textPrimary} mb-2`}>
                    Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 text-sm`}
                    required
                  />
                </div>
                
                <div>
                  <label className={`block text-sm font-medium ${adminTheme.textPrimary} mb-2`}>
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 text-sm`}
                    rows="3"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium ${adminTheme.textPrimary} mb-2`}>
                      Telegram Username
                    </label>
                    <input
                      type="text"
                      value={formData.telegramUsername}
                      onChange={(e) => setFormData({ ...formData, telegramUsername: e.target.value })}
                      className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 text-sm`}
                      placeholder="username (without @)"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium ${adminTheme.textPrimary} mb-2`}>
                      Telegram User ID (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.telegramUserId}
                      onChange={(e) => setFormData({ ...formData, telegramUserId: e.target.value })}
                      className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 text-sm`}
                      placeholder="123456789"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium ${adminTheme.textPrimary} mb-2`}>
                      Priority (1-10)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                      className={`w-full ${adminTheme.surface} ${adminTheme.border} rounded-lg px-3 py-2 text-sm`}
                      required
                    />
                  </div>
                  
                  <div className="flex items-center">
                    <label className={`flex items-center text-sm font-medium ${adminTheme.textPrimary}`}>
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="mr-2"
                      />
                      Active
                    </label>
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    onClick={resetForm}
                    className={`flex-1 ${adminTheme.buttonSecondary}`}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className={`flex-1 ${adminTheme.buttonPrimary}`}
                  >
                    {editingTopic ? 'Update Topic' : 'Create Topic'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTelegramSupport;
