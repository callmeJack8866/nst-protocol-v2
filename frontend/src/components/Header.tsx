import { Link, useLocation } from 'react-router-dom';
import { useWallet } from '../hooks';
import { useState } from 'react';

export function Header() {
  const location = useLocation();
  const { account, chainId, isConnected, isConnecting, connect, disconnect } = useWallet();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const navLinks = [
    { name: '买方大厅', path: '/buyer' },
    { name: '卖方大厅', path: '/seller' },
    { name: '我的订单', path: '/orders' },
    { name: '喂价工作台', path: '/feeder' },
    { name: '积分中心', path: '/points' },
  ];

  const isActive = (path: string) => location.pathname === path || (path === '/buyer' && location.pathname === '/');

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-dark-950/80 backdrop-blur-xl">
      <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center justify-between">

        {/* Left: Logo */}
        <Link to="/" className="flex items-center group">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20 group-hover:scale-105 transition-transform">
            <span className="text-black font-black text-xl">N</span>
          </div>
          <div className="ml-3">
            <h1 className="text-lg font-black text-white tracking-tighter leading-none">NST Options</h1>
            <p className="text-[8px] font-black text-primary-500 uppercase tracking-[0.2em] mt-1 opacity-70">Institutional Grade</p>
          </div>
        </Link>

        {/* Center: Navigation - Balanced and Spaced */}
        <nav className="hidden lg:flex items-center bg-white/5 rounded-2xl p-1.5 border border-white/5">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`px-6 py-2 rounded-xl text-xs font-black transition-all duration-300 uppercase tracking-widest
                ${isActive(link.path)
                  ? 'bg-primary-500 text-black shadow-lg shadow-primary-500/10'
                  : 'text-dark-400 hover:text-white hover:bg-white/5'}`}
            >
              {link.name}
            </Link>
          ))}
        </nav>

        {/* Right: Wallet Actions */}
        <div className="flex items-center space-x-4">
          {isConnected && (
            <div className="hidden sm:flex items-center px-3 py-1.5 rounded-xl bg-dark-900 border border-white/5 text-[10px] font-black uppercase tracking-widest text-dark-400">
              <span className={`w-2 h-2 rounded-full mr-2 ${chainId === 97 ? 'bg-green-500' : 'bg-amber-500'}`} />
              {chainId === 97 ? 'BSC Testnet' : 'Mainnet'}
            </div>
          )}

          {!isConnected ? (
            <button
              onClick={connect}
              disabled={isConnecting}
              className="btn-primary px-8 py-2.5 text-xs font-black group relative overflow-hidden"
            >
              <span className="relative z-10">{isConnecting ? 'Connecting...' : 'Connect Wallet'}</span>
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-3 bg-dark-900 border border-white/10 hover:border-primary-500/30 px-4 py-2 rounded-xl transition-all group"
              >
                <div className="text-right hidden md:block">
                  <p className="text-[9px] font-black text-dark-500 uppercase tracking-widest">Active Account</p>
                  <p className="text-xs font-bold text-white font-mono">{account?.slice(0, 6)}...{account?.slice(-4)}</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-dark-700 to-dark-900 border border-white/10 flex items-center justify-center text-primary-500 group-hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-3 w-56 glass-card p-2 border-white/10 animate-fade-in-up">
                  <div className="p-3 mb-2 bg-white/5 rounded-xl">
                    <p className="text-[8px] font-black text-dark-500 uppercase tracking-[0.2em] mb-1">Network Balance</p>
                    <p className="text-sm font-black text-white">--- BNB</p>
                  </div>
                  <button
                    onClick={() => { disconnect(); setIsDropdownOpen(false); }}
                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors text-xs font-bold"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Disconnect Wallet</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
