import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import HexLogo from './common/HexLogo';
import { Menu as MenuIcon, X, ChevronDown, ChevronRight, UserPlus, LogIn, Check, TrendingUp, Layers, Users, BookOpen, ArrowRight } from "lucide-react";
import { TbWorld } from "react-icons/tb";
import Menu from "./Menu";
import { useUserAuth } from "../contexts/UserAuthContext";
import { useTranslation } from 'react-i18next';
import { getCryptoLogoUrl } from '../utils/logoService';
import { useFormatters } from '../utils/formatters';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

function WordByWord({ text, from = 'left', startDelay = 0, className = '' }) {
  const words = text.split(' ');
  const xStart = from === 'left' ? -18 : 18;
  return (
    <span className={className}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, x: xStart }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, delay: startDelay + i * 0.06, ease: 'easeOut' }}
          style={{ display: 'inline-block', marginRight: '0.28em' }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
}

function CoinLogo({ symbol, url }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="w-10 h-10 rounded-full bg-[#F0F4FF] flex items-center justify-center overflow-hidden shrink-0">
      {url && !failed ? (
        <img
          src={url}
          alt={symbol}
          className="w-7 h-7 object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="flex w-full h-full items-center justify-center text-[10px] font-bold text-[#0052FF]">
          {(symbol || '?').slice(0, 3)}
        </span>
      )}
    </div>
  );
}
const SLIDE_INTERVAL = 6000; // ms

const Home = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useUserAuth();
  const { t, i18n } = useTranslation();
  const { formatPrice, formatPercent: formatPct } = useFormatters();

  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showLanguagePanel, setShowLanguagePanel] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null);

  // Banner slider state
  const [banners, setBanners] = useState([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [sliding, setSliding] = useState(false);
  const timerRef = useRef(null);

  // Market preview state
  const [marketTab, setMarketTab] = useState('gainers');
  const [marketCoins, setMarketCoins] = useState([]);
  const [specialCoins, setSpecialCoins] = useState([]);
  const [marketLoading, setMarketLoading] = useState(true);

  // Blog posts
  const [blogPosts, setBlogPosts] = useState([]);
  useEffect(() => {
    fetch(`${BASE_URL}/api/v1/blog?limit=3`)
      .then(r => r.json())
      .then(d => setBlogPosts(d.data || []))
      .catch(() => {});
  }, []);

  const languages = [
    { code: 'en', name: 'English',      flag: '🇺🇸' },
    { code: 'es', name: 'Español',      flag: '🇪🇸' },
    { code: 'fr', name: 'Français',     flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch',      flag: '🇩🇪' },
    { code: 'ja', name: '日本語',        flag: '🇯🇵' },
    { code: 'ko', name: '한국어',        flag: '🇰🇷' },
    { code: 'hi', name: 'हिंदी',         flag: '🇮🇳' },
    { code: 'ar', name: 'العربية',      flag: '🇸🇦' },
    { code: 'vi', name: 'Tiếng Việt',   flag: '🇻🇳' },
    { code: 'pt', name: 'Português',    flag: '🇧🇷' },
    { code: 'tr', name: 'Türkçe',       flag: '🇹🇷' },
    { code: 'it', name: 'Italiano',     flag: '🇮🇹' },
    { code: 'ru', name: 'Русский',      flag: '🇷🇺' },
    { code: 'th', name: 'ภาษาไทย',      flag: '🇹🇭' },
    { code: 'fa', name: 'فارسی',        flag: '🇮🇷' },
  ];

  // Click-outside for hamburger
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showHamburgerMenu && !e.target.closest('.hamburger-menu') && !e.target.closest('.hamburger-button')) {
        setShowHamburgerMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showHamburgerMenu]);

  // Fetch active banners
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${BASE_URL}/api/v1/admin/banners/public`, { signal: controller.signal })
      .then(r => r.json())
      .then(d => { if (d.success) setBanners(d.banners || []); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // Fetch market preview data
  useEffect(() => {
    const controller = new AbortController();
    const fetchMarket = async () => {
      try {
        const [tickersRes, specialRes] = await Promise.all([
          fetch(`${BASE_URL}/api/v1/market/tickers`, { signal: controller.signal }),
          fetch(`${BASE_URL}/api/v1/market/special-tokens`, { signal: controller.signal }),
        ]);
        if (tickersRes.ok) {
          const d = await tickersRes.json();
          const list = Array.isArray(d) ? d : (d.data || d.tickers || []);
          setMarketCoins(list.slice(0, 200));
        }
        if (specialRes.ok) {
          const s = await specialRes.json();
          const list = Array.isArray(s) ? s : (s.data || []);
          setSpecialCoins(list.slice(0, 20));
        }
      } catch (_) {}
      setMarketLoading(false);
    };
    fetchMarket();
    return () => controller.abort();
  }, []);

  // Auto-advance slides
  const goToSlide = useCallback((index) => {
    if (sliding || banners.length <= 1) return;
    setSliding(true);
    setActiveSlide(index);
    setTimeout(() => setSliding(false), 400);
  }, [sliding, banners.length]);

  const nextSlide = useCallback(() => {
    goToSlide((activeSlide + 1) % banners.length);
  }, [activeSlide, banners.length, goToSlide]);

  useEffect(() => {
    if (banners.length <= 1) return;
    timerRef.current = setInterval(nextSlide, SLIDE_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [banners.length, nextSlide]);

  const handleDotClick = (i) => {
    clearInterval(timerRef.current);
    goToSlide(i);
    timerRef.current = setInterval(nextSlide, SLIDE_INTERVAL);
  };

  // Derive coins for each market tab
  const getTabCoins = () => {
    // For special tokens (New on GB), use specialCoins directly
    if (marketTab === 'new') {
      return specialCoins.slice(0, 7).map(c => ({
        pair: `${c.symbol}/USDT`,
        baseSymbol: c.symbol || '',
        name: c.name || c.symbol || '',
        price: c.currentPrice || 0,
        pct: parseFloat(c.priceChangePercent || 0),
        logo: c.logoUrl
          ? (c.logoUrl.startsWith('http') ? c.logoUrl : `${BASE_URL}${c.logoUrl}`)
          : null,
        isSpecial: true,
      }));
    }

    const normalize = (c) => {
      const base = c.pair ? c.pair.split('/')[0] : (c.symbol || '');
      return {
        pair: c.pair || `${base}/USDT`,
        baseSymbol: base,
        name: c.name || base,
        price: c.lastPrice || c.currentPrice || 0,
        pct: parseFloat(c.priceChangePercent || 0),
        logo: c.isSpecial && c.specialTokenData?.logoUrl
          ? (c.specialTokenData.logoUrl.startsWith('http')
              ? c.specialTokenData.logoUrl
              : `${BASE_URL}${c.specialTokenData.logoUrl}`)
          : null,
        volume: parseFloat(c.volume24h || c.quoteVolume || 0),
        isSpecial: c.isSpecial || false,
      };
    };

    if (marketTab === 'gainers') {
      const seen = new Set();
      return marketCoins
        .map(normalize)
        .filter(c => { if (!c.baseSymbol || seen.has(c.pair)) return false; seen.add(c.pair); return true; })
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 7);
    }
    // trade now — by volume
    const seen2 = new Set();
    return marketCoins
      .map(normalize)
      .filter(c => { if (!c.baseSymbol || seen2.has(c.pair)) return false; seen2.add(c.pair); return true; })
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 7);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="relative z-10 w-full max-w-md mx-auto px-4 py-6 pb-24">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <HexLogo size="sm" />
          <div className="flex items-center gap-2">

            {/* Sign Up button — guests only */}
            {!isAuthenticated() && (
              <button
                onClick={() => navigate('/signup')}
                className="px-4 h-9 rounded-xl text-sm font-semibold text-white active:scale-95 transition-all"
                style={{ background: '#0052FF' }}
              >
                {t('common.signUp')}
              </button>
            )}

            {/* Hamburger — icon only */}
            <button
              onClick={() => setShowHamburgerMenu(!showHamburgerMenu)}
              className="hamburger-button w-10 h-10 flex items-center justify-center rounded-xl border border-[#0052FF]/20 hover:bg-[#0052FF]/8 active:scale-95 transition-all"
            >
              <MenuIcon className="w-5 h-5 text-[#0052FF]" />
            </button>
          </div>
        </div>

        {/* ── Banner Slider ── */}
        {banners.length > 0 && (
          <div className="mt-5 relative overflow-hidden rounded-2xl" style={{ aspectRatio: '16/8' }}>
            {/* Slides */}
            <div
              className="flex h-full transition-transform duration-400 ease-in-out"
              style={{ transform: `translateX(-${activeSlide * 100}%)` }}
            >
              {banners.map((banner, i) => {
                const src = banner.imageUrl.startsWith('http')
                  ? banner.imageUrl
                  : `${BASE_URL}${banner.imageUrl}`;
                return (
                  <div key={banner._id} className="min-w-full h-full shrink-0">
                    <img
                      src={src}
                      alt={banner.title || `Slide ${i + 1}`}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  </div>
                );
              })}
            </div>

            {/* Dots */}
            {banners.length > 1 && (
              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                {banners.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => handleDotClick(i)}
                    className={`rounded-full transition-all duration-300 ${
                      i === activeSlide
                        ? 'w-5 h-1.5 bg-white'
                        : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/80'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}


        {/* ── Hero Section ── */}
        <div className="mt-8 mb-6">
          <motion.h1
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.38, ease: 'easeOut' }}
            className="text-4xl font-extrabold text-[#111111] leading-tight"
          >
            {t('home.heroTitle')}
          </motion.h1>
          <p className="mt-3 text-[12px] text-[#555555] leading-relaxed">
            <WordByWord text={t('home.heroSubtitle')} from="left" startDelay={0.32} />
          </p>
          {!isAuthenticated() && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.85, duration: 0.3 }}
              className="mt-5"
            >
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/signup')}
                className="w-full h-11 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: '#0052FF' }}
              >
                {t('common.signUp')}
              </motion.button>
            </motion.div>
          )}
        </div>

        {/* ── Gateway Section ── */}
        <div className="mt-2 mb-6 rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #0052FF 0%, #003DBF 100%)' }}>
          <div className="px-5 pt-6 pb-6 relative">
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10" style={{ background: '#ffffff', transform: 'translate(30%, -30%)' }} />
            <div className="absolute bottom-0 right-8 w-20 h-20 rounded-full opacity-10" style={{ background: '#ffffff', transform: 'translate(0, 40%)' }} />
            <motion.h2
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.38, ease: 'easeOut' }}
              className="text-3xl font-extrabold text-white leading-tight relative z-10"
            >
              {t('home.gatewayHeading')}
            </motion.h2>
            <p className="mt-3 text-[12px] text-white/75 leading-relaxed relative z-10">
              <WordByWord text={t('home.gatewaySub')} from="right" startDelay={0.32} />
            </p>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.85, duration: 0.3 }}
              className="mt-5 relative z-10"
            >
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/market')}
                className="px-6 h-10 rounded-xl text-sm font-semibold transition-all"
                style={{ background: 'rgba(255,255,255,0.18)', color: '#ffffff', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)' }}
              >
                {t('home.seeMore')}
              </motion.button>
            </motion.div>
          </div>
        </div>

        {/* ── Market Preview Section ── */}
        <div className="mb-8">
          {/* Underline tabs */}
          <div className="flex items-center border-b border-[#EEEEEE] mb-3">
            {[
              { key: 'gainers', label: t('home.tabTopGainer'), initial: { opacity: 0, x: -30 } },
              { key: 'new',     label: t('home.tabNewOnGb'),   initial: { opacity: 0, y: -20  } },
              { key: 'trade',   label: t('home.tabTradeNow'),  initial: { opacity: 0, x:  30 } },
            ].map((tab, i) => (
              <motion.div
                key={tab.key}
                onClick={() => setMarketTab(tab.key)}
                initial={tab.initial}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20, delay: i * 0.08 }}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.9 }}
                className={`flex-1 text-center pb-2.5 text-[11px] font-extrabold tracking-widest cursor-pointer select-none transition-colors ${
                  marketTab === tab.key
                    ? 'text-[#0052FF] border-b-2 border-[#0052FF] -mb-px'
                    : 'text-[#AAAAAA]'
                }`}
              >
                {tab.label}
              </motion.div>
            ))}
          </div>

          {/* Coin list */}
          {marketLoading ? (
            <div className="flex items-center justify-center py-12">
              <motion.span
                className="text-[#0052FF] text-7xl select-none"
                style={{ fontFamily: "'Google Sans Flex', sans-serif", fontWeight: 700 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              >
                 NexaBit
              </motion.span>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={marketTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="pt-1"
              >
                {getTabCoins().map((coin, idx) => {
                  const isUp = coin.pct >= 0;
                  const logoUrl = coin.logo || (coin.baseSymbol ? getCryptoLogoUrl(coin.baseSymbol) : null);

                  return (
                    <motion.div
                      key={`${marketTab}-${coin.pair}`}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: idx * 0.04 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => navigate(`/trade?pair=${encodeURIComponent(coin.pair)}`)}
                      className="flex items-center gap-3 px-3 py-3 mb-1.5 rounded-2xl bg-[#F8FAFF] cursor-pointer active:bg-[#EEF2FF] transition-colors"
                    >
                      {/* Logo */}
                      <CoinLogo symbol={coin.baseSymbol} url={logoUrl} />

                      {/* Symbol + name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-extrabold text-[#111111] leading-tight tracking-tight">{coin.baseSymbol}</p>
                        <p className="text-[10px] text-[#BBBBBB] truncate leading-tight mt-0.5 font-medium">{coin.name !== coin.baseSymbol ? coin.name : t('home.coinFallbackName')}</p>
                      </div>

                      {/* Price + badge */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <p className="text-[13px] font-extrabold text-[#111111] leading-tight">{formatPrice(coin.price)}</p>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold leading-tight ${
                          isUp
                            ? 'bg-[#E6F9F3] text-[#00A572]'
                            : 'bg-[#FFF0EE] text-[#E03228]'
                        }`}>
                          {formatPct(coin.pct)}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* ── Most Trusted Digital Section ── */}
        <div className="mb-6">
          {/* Section heading */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.38, ease: 'easeOut' }}
            className="mb-5"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full" style={{ background: '#EEF3FF', color: '#0052FF' }}>
                {t('home.features.sectionTitle')}
              </span>
            </div>
            <h2 className="text-[22px] font-extrabold text-[#111111] leading-snug mt-2">
              {t('home.features.sectionSubtitle')}
            </h2>
          </motion.div>

          {/* ── Spot Trading ── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="mb-3"
          >
            <div className="rounded-2xl overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #0E1726 0%, #0052FF 100%)' }}>
              <div className="absolute top-0 right-0 w-36 h-36 rounded-full" style={{ background: 'rgba(255,255,255,0.04)', transform: 'translate(30%,-30%)' }} />
              <div className="absolute bottom-0 right-10 w-20 h-20 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', transform: 'translate(0,40%)' }} />
              <div className="p-5 relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full" style={{ background: '#00A572', color: '#fff' }}>{t('home.badgeMostPopular')}</span>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
                    <TrendingUp size={18} color="#fff" />
                  </div>
                </div>
                <h3 className="text-[22px] font-extrabold text-white leading-tight mb-1">{t('home.features.spotTitle')}</h3>
                <p className="text-[12px] text-white/60 leading-relaxed mb-4">{t('home.features.spotDesc')}</p>
                <div className="flex items-center gap-5 mb-5">
                  <div>
                    <p className="text-[18px] font-extrabold text-white">0.1%</p>
                    <p className="text-[10px] text-white/50">{t('home.features.spotNote')}</p>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <div>
                    <p className="text-[18px] font-extrabold text-white">80+</p>
                    <p className="text-[10px] text-white/50">{t('home.features.pairsLabel', 'Pairs')}</p>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <div>
                    <p className="text-[18px] font-extrabold text-white">24/7</p>
                    <p className="text-[10px] text-white/50">{t('home.features.liveLabel', 'Live')}</p>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/trade')}
                  className="w-full h-11 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2"
                  style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
                >
                  {t('home.features.spotBtn')} <ArrowRight size={14} />
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* ── Copy Trading + Demo Trading (2-col) ── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="grid grid-cols-2 gap-3"
          >
            {/* Copy Trading */}
            <div className="rounded-2xl overflow-hidden relative flex flex-col" style={{ background: 'linear-gradient(135deg, #1A1435 0%, #4B35FF 100%)' }}>
              <div className="absolute top-0 right-0 w-20 h-20 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', transform: 'translate(30%,-30%)' }} />
              <div className="p-4 flex flex-col flex-1 relative z-10">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(255,255,255,0.12)' }}>
                  <Users size={16} color="#fff" />
                </div>
                <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full mb-2 self-start text-white/80" style={{ background: 'rgba(255,255,255,0.12)' }}>3,200+ {t('home.features.copyNote')}</span>
                <p className="text-[14px] font-extrabold text-white leading-tight mb-1">{t('home.features.copyTitle')}</p>
                <p className="text-[11px] text-white/55 leading-relaxed flex-1 mb-3">{t('home.features.copyDesc')}</p>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/copy-trading')}
                  className="w-full h-9 rounded-xl text-[11px] font-semibold text-white"
                  style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
                >
                  {t('home.features.copyBtn')}
                </motion.button>
              </div>
            </div>

            {/* Demo Trading */}
            <div className="rounded-2xl overflow-hidden relative flex flex-col" style={{ background: 'linear-gradient(135deg, #0D1F14 0%, #00A572 100%)' }}>
              <div className="absolute top-0 right-0 w-20 h-20 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', transform: 'translate(30%,-30%)' }} />
              <div className="p-4 flex flex-col flex-1 relative z-10">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(255,255,255,0.12)' }}>
                  <Layers size={16} color="#fff" />
                </div>
                <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full mb-2 self-start text-white/80" style={{ background: 'rgba(255,255,255,0.12)' }}>{t('home.badgeRiskFree')}</span>
                <p className="text-[14px] font-extrabold text-white leading-tight mb-1">{t('home.features.demoTitle')}</p>
                <p className="text-[11px] text-white/55 leading-relaxed flex-1 mb-3">{t('home.features.demoDesc')}</p>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/demo-trading')}
                  className="w-full h-9 rounded-xl text-[11px] font-semibold text-white"
                  style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
                >
                  {t('home.features.demoBtn')}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Blog Section ── */}
        {blogPosts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] font-bold text-[#888888] uppercase tracking-wider">{t('blog.blog')}</p>
                <h2 className="text-[20px] font-extrabold text-[#111111]">{t('blog.latestNews')}</h2>
              </div>
              <button onClick={() => navigate('/blog')} className="flex items-center gap-1 text-[12px] font-semibold text-[#0052FF]">
                {t('home.seeMore')} <ArrowRight size={13} />
              </button>
            </div>
            <div className="space-y-2.5">
              {blogPosts.map(post => (
                <motion.div
                  key={post._id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/blog/${post.slug}`)}
                  className="bg-white rounded-2xl shadow-sm p-3.5 flex gap-3 cursor-pointer active:bg-[#F8FAFF] transition-colors"
                >
                  <div className="w-15 h-15 rounded-xl bg-[#EEF3FF] flex items-center justify-center shrink-0 overflow-hidden">
                    {post.coverImage
                      ? <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display='none'; }} />
                      : <BookOpen size={22} color="#0052FF" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: '#EEF3FF', color: '#0052FF' }}>{post.category}</span>
                    <p className="text-[13px] font-bold text-[#111111] mt-1 leading-tight line-clamp-2">{post.title}</p>
                    <p className="text-[11px] text-[#AAAAAA] mt-0.5 truncate">{post.summary}</p>
                  </div>
                  <ChevronRight size={14} className="text-[#CCCCCC] shrink-0 self-center" />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Footer ── */}
        <footer className="mt-8">
          {/* Brand — centered */}
          <div className="flex flex-col items-center text-center mb-6 px-4">
            <HexLogo size="md" />
            <p className="text-[16px] font-extrabold text-[#111111] mt-2"> NexaBit Exchange</p>
            <p className="text-[11px] text-[#AAAAAA] mt-0.5">Trade smarter, not harder</p>
            <p className="text-[11px] text-[#888888] mt-2 leading-relaxed max-w-xs">
              A global crypto trading platform offering spot trading, copy trading, staking and more — available 24/7.
            </p>
            {/* Stat pills */}
            <div className="flex items-center gap-3 mt-4">
              <span className="text-[10px] font-bold text-[#0052FF] bg-[#EEF3FF] px-3 py-1 rounded-full">50K+ Traders</span>
              <span className="text-[10px] font-bold text-[#00A572] bg-[#E6F9F3] px-3 py-1 rounded-full">80+ Cryptos</span>
              <span className="text-[10px] font-bold text-[#888888] bg-[#F5F5F5] px-3 py-1 rounded-full">50+ Countries</span>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-4 border-t border-[#F0F0F0] mb-5" />

          {/* Link columns */}
          <div className="grid grid-cols-3 gap-2 mb-5 px-4">
            <div>
              <p className="text-[10px] font-bold text-[#888888] uppercase tracking-wider mb-2">Platform</p>
              {[
                { label: t('menu.market'), path: '/market' },
                { label: t('menu.trade'),  path: '/trade' },
                { label: t('home.staking'), path: '/staking' },
                { label: t('menu.referrals', 'Referrals'), path: '/referrals' },
                { label: t('home.copyTrading', 'Copy Trading'), path: '/copy-trading' },
              ].map(l => (
                <button key={l.path} onClick={() => navigate(l.path)} className="block text-[11px] text-[#555555] hover:text-[#0052FF] transition-colors py-0.5 text-left w-full">
                  {l.label}
                </button>
              ))}
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#888888] uppercase tracking-wider mb-2">Company</p>
              {[
                { label: t('nav.about'), path: '/about' },
                { label: t('nav.careers'), path: '/careers' },
                { label: t('nav.blog'), path: '/blog' },
                { label: t('nav.affiliates'), path: '/affiliates' },
                { label: t('nav.support'), path: '/help' },
              ].map(l => (
                <button key={l.path} onClick={() => navigate(l.path)} className="block text-[11px] text-[#555555] hover:text-[#0052FF] transition-colors py-0.5 text-left w-full">
                  {l.label}
                </button>
              ))}
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#888888] uppercase tracking-wider mb-2">Legal</p>
              {[
                { label: t('nav.terms', 'Terms'), path: '/terms' },
                { label: t('nav.privacy', 'Privacy'), path: '/privacy' },
                { label: t('nav.security'), path: '/security' },
                { label: 'KYC Policy', path: '/kyc' },
                { label: 'Cookie Policy', path: '/terms' },
              ].map(l => (
                <button key={l.path} onClick={() => navigate(l.path)} className="block text-[11px] text-[#555555] hover:text-[#0052FF] transition-colors py-0.5 text-left w-full">
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mx-4 border-t border-[#F0F0F0] pt-4 text-center">
            <p className="text-[10px] text-[#BBBBBB]">© {new Date().getFullYear()}  NexaBit Exchange. All rights reserved.</p>
            <p className="text-[9px] text-[#CCCCCC] mt-1">Crypto trading involves risk. Trade responsibly.</p>
          </div>
        </footer>

        {/* ── Hamburger Drawer ── */}
        {/* ── Language Panel (right side) ── */}
        {showLanguagePanel && (
          <>
            <div
              className="fixed inset-0 bg-black/25 backdrop-blur-sm z-[10000]"
              onClick={() => setShowLanguagePanel(false)}
            />
            <div className="fixed top-0 right-0 h-full w-72 z-[10001] flex flex-col shadow-2xl bg-white">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <TbWorld className="w-5 h-5 text-[#0052FF]" />
                  <span className="text-sm font-semibold text-[#111111]">{t('preferences.language')}</span>
                </div>
                <button
                  onClick={() => setShowLanguagePanel(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-[#0052FF]/10 hover:bg-[#0052FF]/15 text-[#555555] hover:text-[#111111] transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* Language list — selected at top */}
              <div className="flex-1 overflow-y-auto pb-25 py-2">
                {[
                  ...languages.filter(l => l.code === i18n.language),
                  ...languages.filter(l => l.code !== i18n.language),
                ].map((lang, idx) => {
                  const isSelected = i18n.language === lang.code;
                  return (
                    <>
                      {idx === 1 && (
                        <div key="divider" className="mx-4 my-2 border-t border-gray-100" />
                      )}
                      <button
                        key={lang.code}
                        onClick={() => {
                          i18n.changeLanguage(lang.code);
                          localStorage.setItem('language', lang.code);
                          setShowLanguagePanel(false);
                        }}
                        className={`w-full flex items-center gap-3 px-5 py-3 transition-all ${
                          isSelected ? 'bg-[#0052FF]/8' : 'hover:bg-gray-50'
                        }`}
                      >
                        <p className={`flex-1 text-left text-sm font-medium ${
                          isSelected ? 'text-[#0052FF]' : 'text-[#111111]'
                        }`}>{lang.name}</p>
                        {isSelected && (
                          <Check className="w-4 h-4 text-[#0052FF] shrink-0" />
                        )}
                      </button>
                    </>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {showHamburgerMenu && (
          <>
            {/* Backdrop */}
            <div
              className="hamburger-menu fixed inset-0 bg-black/25 backdrop-blur-sm z-[9998]"
              onClick={() => { setShowHamburgerMenu(false); setShowLanguagePicker(false); }}
            />

            {/* Panel */}
            <div className="hamburger-menu fixed top-0 right-0 h-full w-72 z-[9999] flex flex-col shadow-2xl bg-white">

              {/* Panel header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <HexLogo size="sm" />
                <button
                  onClick={() => { setShowHamburgerMenu(false); setShowLanguagePicker(false); }}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-[#0052FF]/10 hover:bg-[#0052FF]/15 text-[#555555] hover:text-[#111111] transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto">

                {/* User card — authenticated */}
                {isAuthenticated() && (
                  <div className="mx-4 mt-4 p-3 rounded-2xl border border-[#0052FF]/15 bg-[#0052FF]/5 cursor-pointer active:scale-[0.98] transition-all"
                    onClick={() => { navigate('/profile'); setShowHamburgerMenu(false); }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold text-white shrink-0"
                        style={{ background: '#0052FF' }}>
                        {(user?.username || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#111111] truncate">{user?.username || 'User'}</p>
                        <p className="text-[11px] text-[#555555] truncate">{user?.email || ''}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#888888] shrink-0" />
                    </div>
                  </div>
                )}

                {/* ── All Nav Items ── */}
                <div className="px-4 mt-5 space-y-0.5">

                  {/* Cryptocurrencies */}
                  <button
                    onClick={() => { navigate('/market'); setShowHamburgerMenu(false); }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#0052FF]/5 transition-all group"
                  >
                    <span className="text-sm font-semibold text-[#111111] group-hover:text-[#0052FF] transition-colors">{t('nav.cryptocurrencies')}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>

                  {/* Individuals */}
                  <div>
                    <button
                      onClick={() => setExpandedSection(expandedSection === 'individuals' ? null : 'individuals')}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#0052FF]/5 transition-all group"
                    >
                      <span className="text-sm font-semibold text-[#111111] group-hover:text-[#0052FF] transition-colors">{t('nav.individuals')}</span>
                      <ChevronDown className={`w-3.5 h-3.5 text-[#888888] transition-transform duration-200 ${expandedSection === 'individuals' ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedSection === 'individuals' && (
                      <div className="ml-3 mb-1 border-l-2 border-[#0052FF]/15 pl-3 space-y-3 mt-1">
                        <div>
                          <p className="text-[10px] font-bold text-[#888888] uppercase tracking-widest mb-1 px-1">{t('nav.trade')}</p>
                          <button onClick={() => { navigate('/trade'); setShowHamburgerMenu(false); }}
                            className="w-full flex flex-col items-start px-3 py-1.5 rounded-xl hover:bg-[#0052FF]/5 transition-all group">
                            <span className="text-sm font-medium text-[#111111] group-hover:text-[#0052FF] transition-colors">{t('nav.crypto')}</span>
                            <span className="text-[11px] text-[#888888]">{t('nav.buyAndSell')}</span>
                          </button>
                          <button onClick={() => { navigate('/blog'); setShowHamburgerMenu(false); }}
                            className="w-full flex flex-col items-start px-3 py-1.5 rounded-xl hover:bg-[#0052FF]/5 transition-all group">
                            <span className="text-sm font-medium text-[#111111] group-hover:text-[#0052FF] transition-colors">{t('nav.learn')}</span>
                            <span className="text-[11px] text-[#888888]">{t('nav.cryptoTips')}</span>
                          </button>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-[#888888] uppercase tracking-widest mb-1 px-1">{t('nav.earn')}</p>
                          <button onClick={() => { navigate('/staking'); setShowHamburgerMenu(false); }}
                            className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-[#0052FF]/5 transition-all group">
                            <span className="text-sm font-medium text-[#111111] group-hover:text-[#0052FF] transition-colors">{t('nav.staking')}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                          <button onClick={() => { navigate('/rewards'); setShowHamburgerMenu(false); }}
                            className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-[#0052FF]/5 transition-all group">
                            <span className="text-sm font-medium text-[#111111] group-hover:text-[#0052FF] transition-colors">{t('nav.rewards')}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                          <button onClick={() => { navigate('/referrals'); setShowHamburgerMenu(false); }}
                            className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-[#0052FF]/5 transition-all group">
                            <span className="text-sm font-medium text-[#111111] group-hover:text-[#0052FF] transition-colors">{t('nav.referrals')}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Company */}
                  <div>
                    <button
                      onClick={() => setExpandedSection(expandedSection === 'company' ? null : 'company')}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#0052FF]/5 transition-all group"
                    >
                      <span className="text-sm font-semibold text-[#111111] group-hover:text-[#0052FF] transition-colors">{t('nav.company')}</span>
                      <ChevronDown className={`w-3.5 h-3.5 text-[#888888] transition-transform duration-200 ${expandedSection === 'company' ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedSection === 'company' && (
                      <div className="ml-3 mb-1 border-l-2 border-[#0052FF]/15 pl-3 space-y-0.5 mt-1">
                        {[
                          { label: t('nav.about'),      path: '/about' },
                          { label: t('nav.careers'),    path: '/careers' },
                          { label: t('nav.affiliates'), path: '/affiliates' },
                          { label: t('nav.support'),    path: '/help' },
                          { label: t('nav.blog'),       path: '/blog' },
                          { label: t('nav.security'),   path: '/security' },
                        ].map(item => (
                          <button key={item.path}
                            onClick={() => { navigate(item.path); setShowHamburgerMenu(false); }}
                            className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-[#0052FF]/5 transition-all group"
                          >
                            <span className="text-sm font-medium text-[#111111] group-hover:text-[#0052FF] transition-colors">{item.label}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Trading */}
                  <div>
                    <button
                      onClick={() => setExpandedSection(expandedSection === 'trading' ? null : 'trading')}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#0052FF]/5 transition-all group"
                    >
                      <span className="text-sm font-semibold text-[#111111] group-hover:text-[#0052FF] transition-colors">{t('home.spotTrading')}</span>
                      <ChevronDown className={`w-3.5 h-3.5 text-[#888888] transition-transform duration-200 ${expandedSection === 'trading' ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedSection === 'trading' && (
                      <div className="ml-3 mb-1 border-l-2 border-[#0052FF]/15 pl-3 space-y-0.5 mt-1">
                        {[
                          { label: t('menu.market'),     path: '/market' },
                          { label: t('menu.trade'),       path: '/trade' },
                          { label: t('home.copyTrading'), path: '/copy-trading' },
                          { label: t('home.staking'),     path: '/staking' },
                        ].map(item => (
                          <button key={item.path}
                            onClick={() => { navigate(item.path); setShowHamburgerMenu(false); }}
                            className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-[#0052FF]/5 transition-all group"
                          >
                            <span className="text-sm font-medium text-[#111111] group-hover:text-[#0052FF] transition-colors">{item.label}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Account */}
                  <div>
                    <button
                      onClick={() => setExpandedSection(expandedSection === 'account' ? null : 'account')}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#0052FF]/5 transition-all group"
                    >
                      <span className="text-sm font-semibold text-[#111111] group-hover:text-[#0052FF] transition-colors">{t('settings.settings')}</span>
                      <ChevronDown className={`w-3.5 h-3.5 text-[#888888] transition-transform duration-200 ${expandedSection === 'account' ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedSection === 'account' && (
                      <div className="ml-3 mb-1 border-l-2 border-[#0052FF]/15 pl-3 space-y-0.5 mt-1">
                        {[
                          { label: t('menu.profile'),      path: '/profile' },
                          { label: t('home.helpCenter'),   path: '/help' },
                          { label: t('settings.settings'), path: '/settings' },
                        ].map(item => (
                          <button key={item.path}
                            onClick={() => { navigate(item.path); setShowHamburgerMenu(false); }}
                            className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-[#0052FF]/5 transition-all group"
                          >
                            <span className="text-sm font-medium text-[#111111] group-hover:text-[#0052FF] transition-colors">{item.label}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

                {/* Bottom row: user/signin + language */}
                <div className="px-4 mt-4 pb-6 flex items-center gap-2">

                  {/* Left: Sign In (guest) or User avatar (authenticated) */}
                  {isAuthenticated() ? (
                    <button
                      onClick={() => { navigate('/profile'); setShowHamburgerMenu(false); }}
                      className="flex items-center gap-2 flex-1 px-3 py-2.5 rounded-xl hover:bg-[#0052FF]/5 transition-all group"
                    >
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ background: '#0052FF' }}>
                        {(user?.username || 'U').charAt(0).toUpperCase()}
                      </div>
                      <p className="text-sm font-medium text-[#111111] group-hover:text-[#0052FF] transition-colors truncate">
                        {user?.username || 'Profile'}
                      </p>
                    </button>
                  ) : (
                    <button
                      onClick={() => { navigate('/signin'); setShowHamburgerMenu(false); }}
                      className="flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl text-sm font-semibold text-white active:scale-95 transition-all"
                      style={{ background: '#0052FF' }}
                    >
                      {t('auth.signIn')}
                    </button>
                  )}

                  {/* Right: Language / World icon */}
                  <button
                    onClick={() => setShowLanguagePanel(true)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl border border-[#0052FF]/20 hover:bg-[#0052FF]/8 active:scale-95 transition-all shrink-0"
                    title={languages.find(l => l.code === i18n.language)?.name}
                  >
                    <TbWorld className="w-5 h-5 text-[#0052FF]" />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      <Menu />
    </div>
  );
};

export default Home;
