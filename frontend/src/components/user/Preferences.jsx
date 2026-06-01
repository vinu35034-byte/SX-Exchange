import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { useSession } from '../../contexts/SessionContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from "@/components/ui/button";
import {
  ArrowLeftIcon,
  GlobeAltIcon,
  PaintBrushIcon,
  MoonIcon,
  SunIcon,
  CurrencyDollarIcon,
  ChevronRightIcon,
  DevicePhoneMobileIcon,
  ComputerDesktopIcon,
  CheckIcon
} from "@heroicons/react/24/outline";

const meshBg = { background: '#FFFFFF' };

const Preferences = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useUserAuth();
  const { sessionStatus } = useSession();
  const { isDarkMode, toggleTheme } = useTheme();
  const [activeSection, setActiveSection] = useState(null);
  const [preferences, setPreferences] = useState({
    language: localStorage.getItem('language') || i18n.language || 'en',
    currency: 'USD',
    theme: isDarkMode ? 'dark' : 'light',
    compactMode: false,
    showBalances: true,
    hideSmallBalances: false,
  });

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
    { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
    { code: 'pt', name: 'Português', flag: '🇧🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'th', name: 'ภาษาไทย', flag: '🇹🇭' },
    { code: 'fa', name: 'فارسی', flag: '🇮🇷' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'ko', name: '한국어', flag: '🇰🇷' },
  ];

  const currencies = [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' }
  ];

  const themes = [
    { id: 'light', name: 'Light', icon: SunIcon },
    { id: 'dark', name: 'Dark', icon: MoonIcon },
    { id: 'auto', name: 'Auto', icon: ComputerDesktopIcon }
  ];

  const handleThemeChange = (theme) => {
    setPreferences(prev => ({ ...prev, theme }));
    if (theme === 'dark' && !isDarkMode) {
      toggleTheme();
    } else if (theme === 'light' && isDarkMode) {
      toggleTheme();
    }
  };

  const handleToggle = (key) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const savePreferences = () => {
    // TODO: Implement API call to save preferences
    navigate('/profile');
  };

  // Language Selection Screen
  if (activeSection === 'language') {
    return (
      <div className="min-h-screen p-4 pb-20 transition-colors duration-300 text-[#111111]" style={meshBg}>
        <div className="max-w-md mx-auto relative z-10">
          <div className="flex items-center justify-between mb-6">
            <Button
              onClick={() => setActiveSection(null)}
              variant="ghost"
              size="sm"
              className="text-[#555555] hover:text-[#0052FF] p-2"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold text-[#111111]">{t('preferences.language')}</h1>
            <div className="w-9"></div>
          </div>

          <div className="space-y-2">
            {languages.map((lang) => (
              <Button
                key={lang.code}
                onClick={() => {
                  i18n.changeLanguage(lang.code);
                  localStorage.setItem('language', lang.code);
                  setPreferences(prev => ({ ...prev, language: lang.code }));
                  setActiveSection(null);
                }}
                className={`w-full justify-between text-left ${
                  preferences.language === lang.code
                    ? 'bg-[#0052FF]/12 border-[#0052FF]/30 text-[#0052FF]'
                    : 'bg-white/70 backdrop-blur-xl border-[#0052FF]/15 hover:bg-[#F0F5FF]/60 text-[#111111]'
                }`}
              >
                <div className="flex items-center">
                  <span className="text-2xl mr-3">{lang.flag}</span>
                  <span className="font-medium">{lang.name}</span>
                </div>
                {preferences.language === lang.code && (
                  <CheckIcon className="w-5 h-5 text-[#0052FF]" />
                )}
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Currency Selection Screen
  if (activeSection === 'currency') {
    return (
      <div className="min-h-screen p-4 pb-20 transition-colors duration-300 text-[#111111]" style={meshBg}>
        <div className="max-w-md mx-auto relative z-10">
          <div className="flex items-center justify-between mb-6">
            <Button
              onClick={() => setActiveSection(null)}
              variant="ghost"
              size="sm"
              className="text-[#555555] hover:text-[#0052FF] p-2"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold text-[#111111]">{t('preferences.currency')}</h1>
            <div className="w-9"></div>
          </div>

          <div className="space-y-2">
            {currencies.map((currency) => (
              <Button
                key={currency.code}
                onClick={() => {
                  setPreferences(prev => ({ ...prev, currency: currency.code }));
                  setActiveSection(null);
                }}
                className={`w-full justify-between text-left ${
                  preferences.currency === currency.code
                    ? 'bg-[#0052FF]/12 border-[#0052FF]/30 text-[#0052FF]'
                    : 'bg-white/70 backdrop-blur-xl border-[#0052FF]/15 hover:bg-[#F0F5FF]/60 text-[#111111]'
                }`}
              >
                <div className="flex items-center">
                  <span className="text-lg mr-3 font-bold">{currency.symbol}</span>
                  <div>
                    <div className="font-medium">{currency.name}</div>
                    <div className="text-xs text-[#888888]">{currency.code}</div>
                  </div>
                </div>
                {preferences.currency === currency.code && (
                  <CheckIcon className="w-5 h-5 text-[#0052FF]" />
                )}
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Theme Selection Screen
  if (activeSection === 'theme') {
    return (
      <div className="min-h-screen p-4 pb-20 transition-colors duration-300 text-[#111111]" style={meshBg}>
        <div className="max-w-md mx-auto relative z-10">
          <div className="flex items-center justify-between mb-6">
            <Button
              onClick={() => setActiveSection(null)}
              variant="ghost"
              size="sm"
              className="text-[#555555] hover:text-[#0052FF] p-2"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold text-[#111111]">{t('preferences.theme')}</h1>
            <div className="w-9"></div>
          </div>

          <div className="space-y-2">
            {themes.map((theme) => {
              const IconComponent = theme.icon;
              return (
                <Button
                  key={theme.id}
                  onClick={() => {
                    handleThemeChange(theme.id);
                    setActiveSection(null);
                  }}
                  className={`w-full justify-between text-left ${
                    preferences.theme === theme.id
                      ? 'bg-[#0052FF]/12 border-[#0052FF]/30 text-[#0052FF]'
                      : 'bg-white/70 backdrop-blur-xl border-[#0052FF]/15 hover:bg-[#F0F5FF]/60 text-[#111111]'
                  }`}
                >
                  <div className="flex items-center">
                    <IconComponent className="w-5 h-5 mr-3" />
                    <span className="font-medium">{t(`preferences.${theme.id}`)}</span>
                  </div>
                  {preferences.theme === theme.id && (
                    <CheckIcon className="w-5 h-5 text-[#0052FF]" />
                  )}
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Main Preferences Screen
  return (
    <div className="min-h-screen p-4 pb-20 transition-colors duration-300 text-[#111111]" style={meshBg}>
      <div className="max-w-md mx-auto relative z-10">
        <div className="flex items-center justify-between mb-6">
          <Button
            onClick={() => navigate('/profile')}
            variant="ghost"
            size="sm"
            className="text-[#555555] hover:text-[#0052FF] p-2"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-[#111111]">{t('preferences.preferences')}</h1>
          <Button
            onClick={savePreferences}
            size="sm"
            className="border border-[#0052FF]/25 text-[#111111]"
            style={{ background: 'linear-gradient(135deg, #0052FF 0%, #0041CC 40%, #0052FF 100%)' }}
          >
            {t('common.save')}
          </Button>
        </div>

        <div className="space-y-6">
          {/* Appearance */}
          <div className="bg-white/70 backdrop-blur-xl border border-[#0052FF]/15 rounded-2xl p-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center text-[#111111]">
              <PaintBrushIcon className="w-5 h-5 mr-2" />
              {t('preferences.appearance')}
            </h3>
            <div className="space-y-3">
              <Button
                onClick={() => setActiveSection('theme')}
                className="w-full bg-white/70 backdrop-blur-xl hover:bg-[#F0F5FF]/60 border border-[#0052FF]/15 text-left justify-between text-[#111111]"
              >
                <div className="flex items-center">
                  <span className="font-medium">{t('preferences.theme')}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-[#555555] mr-2 capitalize">{preferences.theme}</span>
                  <ChevronRightIcon className="w-4 h-4 text-[#555555]" />
                </div>
              </Button>
            </div>
          </div>

          {/* Language & Region */}
          <div className="bg-white/70 backdrop-blur-xl border border-[#0052FF]/15 rounded-2xl p-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center text-[#111111]">
              <GlobeAltIcon className="w-5 h-5 mr-2" />
              {t('preferences.languageRegion')}
            </h3>
            <div className="space-y-3">
              <Button
                onClick={() => setActiveSection('language')}
                className="w-full bg-white/70 backdrop-blur-xl hover:bg-[#F0F5FF]/60 border border-[#0052FF]/15 text-left justify-between text-[#111111]"
              >
                <div className="flex items-center">
                  <span className="font-medium">{t('preferences.language')}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-[#555555] mr-2">
                    {languages.find(l => l.code === preferences.language)?.name}
                  </span>
                  <ChevronRightIcon className="w-4 h-4 text-[#555555]" />
                </div>
              </Button>

              <Button
                onClick={() => setActiveSection('currency')}
                className="w-full bg-white/70 backdrop-blur-xl hover:bg-[#F0F5FF]/60 border border-[#0052FF]/15 text-left justify-between text-[#111111]"
              >
                <div className="flex items-center">
                  <CurrencyDollarIcon className="w-5 h-5 mr-3 text-[#555555]" />
                  <span className="font-medium">Currency</span>
                </div>
                <div className="flex items-center">
                  <span className="text-[#555555] mr-2">{preferences.currency}</span>
                  <ChevronRightIcon className="w-4 h-4 text-[#555555]" />
                </div>
              </Button>
            </div>
          </div>

          {/* Display Options */}
          <div className="bg-white/70 backdrop-blur-xl border border-[#0052FF]/15 rounded-2xl p-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center text-[#111111]">
              <DevicePhoneMobileIcon className="w-5 h-5 mr-2" />
              {t('preferences.displayOptions')}
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-[#111111]">Compact Mode</div>
                  <div className="text-xs text-[#888888]">Reduce spacing and padding</div>
                </div>
                <button
                  onClick={() => handleToggle('compactMode')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    preferences.compactMode ? 'bg-[#0052FF]' : 'bg-[#AAAAAA]'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences.compactMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-[#111111]">Show Balances</div>
                  <div className="text-xs text-[#888888]">Display account balances</div>
                </div>
                <button
                  onClick={() => handleToggle('showBalances')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    preferences.showBalances ? 'bg-[#0052FF]' : 'bg-[#AAAAAA]'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences.showBalances ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-[#111111]">Hide Small Balances</div>
                  <div className="text-xs text-[#888888]">Hide balances under $1</div>
                </div>
                <button
                  onClick={() => handleToggle('hideSmallBalances')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    preferences.hideSmallBalances ? 'bg-[#0052FF]' : 'bg-[#AAAAAA]'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      preferences.hideSmallBalances ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Preferences;
