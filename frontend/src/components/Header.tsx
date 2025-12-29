import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
    { path: '/buyer', label: '买方大厅', icon: '📋' },
    { path: '/seller', label: '卖方大厅', icon: '📊' },
    { path: '/orders', label: '我的订单', icon: '📁' },
    { path: '/feeder', label: '喂价工作台', icon: '📡' },
    { path: '/points', label: '积分中心', icon: '🎁' },
];

export function Header() {
    const location = useLocation();
    const [isConnected, setIsConnected] = useState(false);
    const [address, setAddress] = useState('');

    const connectWallet = async () => {
        if (typeof window.ethereum !== 'undefined') {
            try {
                const accounts = await window.ethereum.request({
                    method: 'eth_requestAccounts',
                }) as string[];
                setAddress(accounts[0]);
                setIsConnected(true);
            } catch (error) {
                console.error('Failed to connect wallet:', error);
            }
        } else {
            alert('Please install MetaMask!');
        }
    };

    const formatAddress = (addr: string) => {
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    return (
        <header className="sticky top-0 z-50 bg-dark-950/90 backdrop-blur-xl border-b border-dark-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link to="/" className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                            <span className="text-white font-bold text-lg">N</span>
                        </div>
                        <span className="text-xl font-bold text-white">NST Options</span>
                    </Link>

                    {/* Navigation */}
                    <nav className="hidden md:flex items-center space-x-1">
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${location.pathname === item.path
                                        ? 'bg-primary-500/20 text-primary-400'
                                        : 'text-dark-300 hover:text-white hover:bg-dark-800'
                                    }`}
                            >
                                <span className="mr-2">{item.icon}</span>
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    {/* Wallet Connection */}
                    <div className="flex items-center space-x-4">
                        {isConnected ? (
                            <div className="flex items-center space-x-3">
                                <span className="text-sm text-green-400">● BSC</span>
                                <button className="btn-secondary text-sm">
                                    {formatAddress(address)}
                                </button>
                            </div>
                        ) : (
                            <button onClick={connectWallet} className="btn-primary text-sm">
                                连接钱包
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}

export default Header;
