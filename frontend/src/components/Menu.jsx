import { IoHomeSharp } from "react-icons/io5";
import { IoIosWallet } from "react-icons/io";
import { FaFileInvoice } from "react-icons/fa6";
import { FaArrowTrendUp } from "react-icons/fa6";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from 'react-i18next';
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

const iconAnimations = {
  home:   { y: [0, -10, 2, 0],        transition: { duration: 0.4, ease: "easeOut" } },
  market: { rotate: [0, 25, -10, 0],  transition: { duration: 0.4, ease: "easeInOut" } },
  trade:  { rotateY: [0, 180, 0],     transition: { duration: 0.5, ease: "easeInOut" } },
  asset:  { x: [0, -6, 6, -4, 4, 0], transition: { duration: 0.4, ease: "easeOut" } },
};

const Menu = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [animKeys, setAnimKeys] = useState({ home: 0, market: 0, trade: 0, asset: 0 });

  const getActiveTab = () => {
    const path = location.pathname;
    if (path === '/') return 'home';
    if (path.startsWith('/market')) return 'market';
    if (path.startsWith('/trade')) return 'trade';
    if (path.startsWith('/asset')) return 'asset';
    return 'home';
  };

  const activeTab = getActiveTab();

  // Fire animation whenever the active tab changes
  useEffect(() => {
    setAnimKeys(prev => ({ ...prev, [activeTab]: prev[activeTab] + 1 }));
  }, [activeTab]);

  const menuItems = [
    { id: 'home',   icon: IoHomeSharp,    label: t('menu.home'),   path: '/' },
    { id: 'market', icon: FaArrowTrendUp, label: t('menu.market'), path: '/market' },
    { id: 'trade',  icon: FaFileInvoice,  label: t('menu.trade'),  path: '/trade' },
    { id: 'asset',  icon: IoIosWallet,    label: t('nav.assets'),  path: '/assets' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0" style={{ zIndex: 9999 }}>
      <div className="absolute inset-0 bg-white border-t border-gray-200"></div>

      <div className="flex items-center justify-around px-4 py-3 max-w-md mx-auto relative z-10">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const { transition, ...anim } = iconAnimations[item.id];

          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center justify-center py-2 px-3 min-w-0"
              style={{ touchAction: 'manipulation' }}
            >
              <motion.div
                key={animKeys[item.id]}
                animate={isActive ? anim : {}}
                transition={transition}
                style={{ display: 'flex' }}
              >
                <Icon
                  className={`${isActive ? 'w-6 h-6' : 'w-5 h-5'} ${isActive ? 'text-[#0052FF]' : 'text-[#888888]'}`}
                />
              </motion.div>
              <span className={`text-[7px] mt-0.5 font-medium ${isActive ? 'text-[#0052FF]' : 'text-[#AAAAAA]'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="h-safe-area-inset-bottom bg-white"></div>
    </nav>
  );
};

export default Menu;
