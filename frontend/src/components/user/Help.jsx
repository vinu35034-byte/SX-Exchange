import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiUtils } from '../../services/api';
import {
  ArrowLeft, RefreshCw, Search, ChevronDown,
  HelpCircle, Play, BarChart3, CreditCard, Banknote,
  Users, Shield, Settings, MessageSquare, ExternalLink,
  AlertTriangle, MessageCircle
} from 'lucide-react';
import Menu from '../Menu';
import toast from 'react-hot-toast';

const iconMap = {
  QuestionMarkCircleIcon:    HelpCircle,
  PlayCircleIcon:            Play,
  ChartBarIcon:              BarChart3,
  IdentificationIcon:        CreditCard,
  BanknotesIcon:             Banknote,
  UserGroupIcon:             Users,
  ShieldCheckIcon:           Shield,
  WrenchScrewdriverIcon:     Settings,
  ChatBubbleLeftRightIcon:   MessageSquare,
};

const Help = () => {
  const navigate   = useNavigate();
  const { t }      = useTranslation();

  const [supportTopics, setSupportTopics] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [openFAQ, setOpenFAQ]             = useState({});
  const [search, setSearch]               = useState('');

  const fetchSupportTopics = async () => {
    try {
      const data = await ApiUtils.get('/telegram-support/active');
      setSupportTopics(data.data);
    } catch (error) {
      console.error('Error fetching support topics:', error);
      toast.error(t('help.failedToConnectSupport'));
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSupportTopics();
    setRefreshing(false);
    toast.success(t('help.supportTopicsRefreshed'));
  };

  const handleTopicClick = (topic) => {
    if (!topic.telegramUsername) {
      toast.error(t('help.supportContactNotAvailable'));
      return;
    }
    const loadingToast = toast.loading(t('help.openingTelegramChat', { title: topic.title }));
    try {
      window.open(`https://t.me/${topic.telegramUsername}`, '_blank', 'noopener,noreferrer');
      toast.success(t('help.telegramChatOpened', { title: topic.title }), { id: loadingToast, duration: 3000 });
    } catch {
      toast.error(t('help.failedToOpenTelegram'), { id: loadingToast });
    }
  };

  useEffect(() => { fetchSupportTopics(); }, []);

  const faqs = [
    { id: 1,  q: t('help.faq1_q'),  a: t('help.faq1_a')  },
    { id: 2,  q: t('help.faq2_q'),  a: t('help.faq2_a')  },
    { id: 3,  q: t('help.faq3_q'),  a: t('help.faq3_a')  },
    { id: 4,  q: t('help.faq4_q'),  a: t('help.faq4_a')  },
    { id: 5,  q: t('help.faq5_q'),  a: t('help.faq5_a')  },
    { id: 6,  q: t('help.faq6_q'),  a: t('help.faq6_a')  },
    { id: 7,  q: t('help.faq7_q'),  a: t('help.faq7_a')  },
    { id: 8,  q: t('help.faq8_q'),  a: t('help.faq8_a')  },
    { id: 9,  q: t('help.faq9_q'),  a: t('help.faq9_a')  },
    { id: 10, q: t('help.faq10_q'), a: t('help.faq10_a') },
    { id: 11, q: t('help.faq11_q'), a: t('help.faq11_a') },
    { id: 12, q: t('help.faq12_q'), a: t('help.faq12_a') },
  ];

  const filteredFaqs = search.trim()
    ? faqs.filter(f => f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase()))
    : faqs;

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-24">

      {/* Blue hero header */}
      <div className="bg-linear-to-br from-[#0052FF] to-[#0041CC]">
        <div className="w-full max-w-md mx-auto px-4 pt-6 pb-8">

          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/25 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-white font-bold text-lg">{t('help.helpCenter')}</h1>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/25 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Subtitle */}
          <p className="text-white/70 text-sm text-center mb-5">{t('help.getInstantSupport')}</p>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#888888]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('help.searchFaqs')}
              className="w-full bg-white rounded-xl pl-10 pr-4 py-3 text-sm text-[#111111] placeholder-[#AAAAAA] focus:outline-none focus:ring-2 focus:ring-white/30"
            />
          </div>

        </div>
      </div>

      {/* Content */}
      <div className="w-full max-w-md mx-auto px-4 -mt-4">

        {/* FAQ Section */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider px-1 mb-2">
            {t('help.frequentlyAskedQuestions')}
          </p>
          {filteredFaqs.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm px-4 py-8 text-center text-sm text-[#888888]">
              {t('help.noResultsFound')}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFaqs.map((faq) => {
                const isOpen = !!openFAQ[faq.id];
                return (
                  <div
                    key={faq.id}
                    className={`bg-white rounded-2xl shadow-sm overflow-hidden transition-all duration-200 ${
                      isOpen ? 'ring-1 ring-[#0052FF]/20' : ''
                    }`}
                  >
                    <button
                      onClick={() => setOpenFAQ(prev => ({ ...prev, [faq.id]: !prev[faq.id] }))}
                      className="w-full flex items-center gap-3 px-4 py-4 text-left"
                    >
                      {/* Number badge */}
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold transition-colors ${
                        isOpen ? 'bg-[#0052FF] text-white' : 'bg-[#F0F5FF] text-[#0052FF]'
                      }`}>
                        {faq.id}
                      </div>
                      <span className="flex-1 text-sm font-semibold text-[#111111] leading-snug pr-2">
                        {faq.q}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                          isOpen ? 'rotate-180 text-[#0052FF]' : 'text-[#AAAAAA]'
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="mx-4 mb-4 pl-4 border-l-2 border-[#0052FF]/30">
                        <p className="text-sm text-[#555555] leading-relaxed">{faq.a}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Support Topics Section */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#888888] uppercase tracking-wider px-1 mb-2">
            {t('help.quickConnect')}
          </p>

          {loading ? (
            <div className="bg-white rounded-2xl shadow-sm px-4 py-8 text-center">
              <div className="w-8 h-8 border-2 border-[#0052FF]/20 border-t-[#0052FF] rounded-full animate-spin mx-auto" />
            </div>
          ) : supportTopics.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm px-4 py-8 text-center">
              <AlertTriangle className="w-8 h-8 text-[#AAAAAA] mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#111111] mb-1">{t('help.noSupportTopicsAvailable')}</p>
              <p className="text-xs text-[#888888] mb-4">{t('help.supportTopicsConfiguring')}</p>
              <button
                onClick={handleRefresh}
                className="px-4 py-2 bg-[#0052FF] text-white text-sm font-medium rounded-xl"
              >
                {t('help.tryAgain')}
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {supportTopics.map((topic, idx) => {
                const Icon = iconMap[topic.icon] || HelpCircle;
                return (
                  <button
                    key={topic._id || idx}
                    onClick={() => handleTopicClick(topic)}
                    className={`w-full flex items-center gap-3 px-4 py-4 hover:bg-[#FAFAFA] transition-colors text-left ${
                      idx < supportTopics.length - 1 ? 'border-b border-[#F0F0F0]' : ''
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#F0F5FF] flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-[#0052FF]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#111111]">{topic.title}</p>
                      <p className="text-xs text-[#888888] truncate">{topic.description}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <MessageCircle className="w-3.5 h-3.5 text-[#0052FF]" />
                      <span className="text-xs text-[#0052FF] font-medium">@{topic.telegramUsername}</span>
                      <ExternalLink className="w-3 h-3 text-[#AAAAAA]" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Online indicator */}
        {!loading && supportTopics.length > 0 && (
          <div className="flex items-center justify-center gap-2 py-3">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-[#888888]">{t('help.supportTeamOnline')}</span>
          </div>
        )}

      </div>

      <Menu />
    </div>
  );
};

export default Help;
