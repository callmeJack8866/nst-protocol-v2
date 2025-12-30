import { Link, useLocation } from 'react-router-dom';
import { useWallet } from '../hooks';

const navItems = [
  { path: '/buyer', label: '买方大厅', icon: '' },
  { path: '/seller', label: '卖方大厅', icon: '' },
  { path: '/orders', label: '我的订单', icon: '' },
  { path: '/feeder', label: '喂价工作台', icon: '' },
  { path: '/points', label: '积分中心', icon: '' },
];

export function Header() {
  const location = useLocation();
  const { account, chainId, isConnected, isConnecting, connect, disconnect, switchToBSC } = useWallet();

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const getNetworkName = (id: number | null) => id === 56 ? 'BSC' : id === 97 ? 'BSC Testnet' : 'Wrong Network';
  const isCorrectNetwork = chainId === 56 || chainId === 97;

  return (
    <header className="sticky top-0 z-50 bg-dark-950/40 backdrop-blur-2xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-400 via-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/20 group-hover:scale-105 transition-transform">
              <span className="text-black font-extrabold text-xl">N</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black text-white leading-none tracking-tight">NST Options</span>
              <span className="text-[10px] text-primary-400 font-bold uppercase tracking-[0.2em] mt-1">Institutional Grade</span>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="hidden xl:flex items-center space-x-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center space-x-2 ${
                  location.pathname === item.path
                    ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20 shadow-inner'
                    : 'text-dark-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="opacity-80 grayscale group-hover:grayscale-0">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* Wallet Section */}
          <div className="flex items-center space-x-4">
            {isConnected && account ? (
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => !isCorrectNetwork && switchToBSC(true)}
                  className={`hidden sm:flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border transition-all ${
                    isCorrectNetwork 
                      ? 'text-green-400 bg-green-500/5 border-green-500/20 hover:bg-green-500/10' 
                      : 'text-red-400 bg-red-500/5 border-red-500/20 hover:pulse-red'
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${isCorrectNetwork ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]' : 'bg-red-400 animate-pulse'}`} />
                  <span>{getNetworkName(chainId)}</span>
                </button>
                
                <div className="relative group">
                  <button className="flex items-center space-x-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-2 transition-all">
                    <div className="w-2 h-2 rounded-full bg-primary-400 shadow-[0_0_8px_rgba(247,168,31,0.6)]" />
                    <span className="text-sm font-bold text-white font-mono">{formatAddress(account)}</span>
                  </button>
                  
                  <div className="absolute right-0 top-full mt-3 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                    <div className="bg-dark-900/90 backdrop-blur-3xl border border-white/10 rounded-2xl p-2 shadow-2xl">
                      <button 
                        onClick={disconnect} 
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-red-500/10 text-red-400 hover:text-red-300 text-sm font-bold rounded-xl transition-colors"
                      >
                        <span>断开连接</span>
                        <span></span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <button 
                onClick={connect} 
                disabled={isConnecting} 
                className="btn-primary flex items-center space-x-2 relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12" />
                <span className="relative z-10">{isConnecting ? '连接中...' : '连接钱包'}</span>
                <span className="relative z-10 text-base"></span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
