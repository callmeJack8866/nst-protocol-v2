import { Link, useLocation } from 'react-router-dom';
import { useWalletContext } from '../context/WalletContext';
import { useState } from 'react';

export function Header() {
  const location = useLocation();
  const { account, chainId, isConnected, isConnecting, connect, disconnect } = useWalletContext();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: '买方大厅', path: '/buyer' },
    { name: '卖方大厅', path: '/seller' },
    { name: '我的订单', path: '/orders' },
    { name: '数据终端', path: '/feeder' },
  ];

  const isActive = (path: string) => location.pathname === path || (path === '/buyer' && location.pathname === '/');

  return (
    <header className="sticky top-0 z-[60] w-full h-16 border-b border-white/[0.04] bg-slate-950/70 backdrop-blur-2xl">
      <div className="max-w-[1500px] mx-auto h-full px-8 flex items-center justify-between">

        <div className="flex items-center space-x-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-4 group">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 transition-all group-hover:scale-110 group-hover:rotate-3">
              <span className="text-slate-950 font-black text-xl italic leading-none">N</span>
            </div>
            <span className="text-white font-extrabold text-xl tracking-tighter italic">NST Finance</span>
          </Link>

          {/* Nav */}
          <nav className="hidden lg:flex items-center space-x-2">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`nav-link px-5 py-2.5 text-[13px] font-bold tracking-tight transition-all ${isActive(link.path) ? 'active shadow-lg shadow-emerald-500/5' : 'text-slate-400'}`}
              >
                {link.name}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center space-x-4 md:space-x-6">
          {/* 移动端汉堡菜单按钮 */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl bg-slate-900/50 border border-white/10 text-slate-400 hover:text-white transition-all"
          >
            {isMobileMenuOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            )}
          </button>
          {isConnected && (
            <div className="hidden md:flex items-center px-4 py-1.5 bg-slate-900 border border-white/[0.08] rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <span className={`w-1.5 h-1.5 rounded-full mr-2.5 ${chainId === 97 ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-amber-500'}`} />
              {chainId === 97 ? 'BSC 测试网' : '已连接'}
            </div>
          )}

          {!isConnected ? (
            <button
              onClick={connect}
              disabled={isConnecting}
              className="btn-elite-primary py-2.5 px-8 text-[12px]"
            >
              {isConnecting ? '身份验证中...' : '连接钱包'}
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-4 px-5 py-2.5 bg-slate-900/50 border border-white/[0.1] hover:border-emerald-500/30 rounded-2xl transition-all shadow-sm"
              >
                <div className="w-5 h-5 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                </div>
                <span className="text-[12px] font-mono font-bold text-slate-200">{account?.slice(0, 6)}...{account?.slice(-4)}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" className={`transition-all ${isDropdownOpen ? 'rotate-180 transform' : ''}`}><path d="m6 9 6 6 6-6" /></svg>
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-4 w-48 glass-surface rounded-[24px] p-2.5 shadow-2xl animate-elite-entry border-white/10">
                  <div className="px-4 py-3 border-b border-white/[0.05] mb-1.5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">交易身份</p>
                    <p className="text-sm font-bold text-white italic">精英交易员</p>
                  </div>
                  <button
                    onClick={() => { disconnect(); setIsDropdownOpen(false); }}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-rose-400 hover:bg-rose-400/5 transition-all text-xs font-bold"
                  >
                    <span>断开连接</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 移动端导航抽屉 */}
      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-16 left-0 right-0 glass-surface border-t border-white/[0.05] animate-elite-entry">
          <nav className="p-4 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-xl text-sm font-bold transition-all ${isActive(link.path)
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
              >
                {link.name}
              </Link>
            ))}
            <Link
              to="/points"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-4 py-3 rounded-xl text-sm font-bold text-slate-400 hover:bg-white/5 hover:text-white transition-all"
            >
              积分中心
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
