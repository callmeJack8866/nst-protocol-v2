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
  const getNetworkName = (id: number | null) => id === 56 ? 'BSC' : id === 97 ? 'BSC Test' : 'Wrong Network';
  const isCorrectNetwork = chainId === 56 || chainId === 97;

  return (
    <header className="sticky top-0 z-50 bg-dark-950/90 backdrop-blur-xl border-b border-dark-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">N</span>
            </div>
            <span className="text-xl font-bold text-white">NST Options</span>
          </Link>

          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  location.pathname === item.path
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'text-dark-300 hover:text-white hover:bg-dark-800'
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center space-x-4">
            {isConnected && account ? (
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => !isCorrectNetwork && switchToBSC(true)}
                  className={`text-sm px-3 py-1 rounded-lg ${
                    isCorrectNetwork ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'
                  }`}
                >
                   {getNetworkName(chainId)}
                </button>
                <div className="relative group">
                  <button className="btn-secondary text-sm">{formatAddress(account)}</button>
                  <div className="absolute right-0 top-full mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <button onClick={disconnect} className="px-4 py-2 bg-dark-800 text-red-400 text-sm rounded-lg border border-dark-600">
                      断开连接
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button onClick={connect} disabled={isConnecting} className="btn-primary text-sm disabled:opacity-50">
                {isConnecting ? '连接中...' : '连接钱包'}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
