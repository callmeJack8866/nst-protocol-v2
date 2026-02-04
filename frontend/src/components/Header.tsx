import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useWalletContext } from '../context/WalletContext';
import { usePerspective } from '../context/PerspectiveContext';
import { useTranslation } from 'react-i18next';

const Header: React.FC = () => {
  const { isConnected, account, chainId, connect } = useWalletContext();
  const { perspective } = usePerspective();
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const getPageTitle = (path: string) => {
    const titles: Record<string, string> = {
      '/market': t('header.market'),
      '/create-rfq': perspective === 'buyer' ? t('header.buyer_terminal') : t('header.seller_terminal'),
      '/create-seller-order': perspective === 'buyer' ? t('header.buyer_terminal') : t('header.seller_terminal'),
      '/portfolio': t('header.portfolio'),
      '/orders': t('header.portfolio'),
      '/feeder': t('header.feeder'),
      '/rewards': t('header.rewards'),
      '/points': t('header.rewards'),
      '/oracle': t('header.hall_of_fame'),
      '/seat': t('header.hall_of_fame'),
      '/leaderboard': t('header.hall_of_fame'),
      '/order': t('header.lifecycle')
    };
    if (path.startsWith('/order/')) return t('header.lifecycle');
    return titles[path] || 'NST Protocol';
  };

  const navLinks = [
    { name: t('nav.trading_floor'), path: '/market' },
    { name: t('nav.portfolio'), path: '/orders' },
    { name: t('nav.strategy_builder'), path: '/create-rfq' },
    { name: t('nav.oracle_node'), path: '/feeder' },
    { name: t('nav.rewards_hub'), path: '/points' }
  ];

  return (
    <header className="h-20 shrink-0 px-6 lg:px-8 flex items-center justify-between border-b border-white/[0.04] bg-white/[0.01] backdrop-blur-md relative z-[100]">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="lg:hidden w-10 h-10 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center text-white"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            {isMenuOpen ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>

        <div className="hidden sm:block w-1 h-6 bg-gold-500/40 rounded-full" />
        <h1 className="text-[11px] md:text-sm font-black uppercase tracking-[0.2em] text-white/90 truncate">
          {getPageTitle(location.pathname)}
        </h1>
      </div>

      <div className="flex items-center space-x-4 md:space-x-6">
        {isConnected && (
          <div className="hidden md:flex items-center px-4 py-1.5 bg-white/[0.03] border border-white/5 rounded-full">
            <div className={`w-2 h-2 rounded-full mr-2.5 ${chainId === 97 ? 'bg-gold-500' : 'bg-red-500'} animate-pulse`} />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/60">
              {chainId === 97 ? 'BSC Testnet' : 'Network Error'}
            </span>
          </div>
        )}

        {!isConnected ? (
          <button
            onClick={connect}
            className="px-5 py-2 md:px-6 md:py-2.5 bg-gold-500 text-obsidian-950 text-[10px] md:text-[11px] font-black uppercase tracking-widest rounded-lg hover:bg-gold-400 transition-all shadow-[0_0_20px_rgba(234,179,8,0.2)]"
          >
            {t('rfq.common.connect')}
          </button>
        ) : (
          <div className="flex items-center px-3 py-1.5 md:px-4 md:py-2 bg-gold-500/10 border border-gold-500/20 rounded-xl">
            <div className="w-5 h-5 bg-gold-500 rounded-md flex items-center justify-center mr-2 md:mr-3 hidden sm:flex">
              <span className="text-obsidian-900 font-bold text-[10px]">0x</span>
            </div>
            <span className="text-[11px] md:text-[12px] font-bold text-gold-400 font-mono tracking-wider italic">
              {formatAddress(account!)}
            </span>
          </div>
        )}
      </div>

      {isMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-20 bg-obsidian-950/95 backdrop-blur-2xl z-[90] p-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <nav className="flex flex-col space-y-4">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsMenuOpen(false)}
                className={`px-6 py-5 rounded-2xl border transition-all duration-300 ${location.pathname === link.path ? 'bg-gold-500/10 border-gold-500/30 text-gold-500' : 'bg-white/[0.02] border-white/5 text-gray-400'}`}
              >
                <span className="text-sm font-black uppercase tracking-widest italic">{link.name}</span>
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
export { Header as HeaderComponent };
