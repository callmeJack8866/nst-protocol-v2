import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/Header';
import { BuyerHall } from './pages/BuyerHall';

// Placeholder pages
const SellerHall = () => (
  <div className="max-w-7xl mx-auto px-4 py-8">
    <h1 className="text-3xl font-bold text-white mb-4">卖方订单大厅</h1>
    <p className="text-dark-400">浏览买方询价订单，提交您的报价</p>
    <div className="glass-card p-12 text-center mt-8">
      <div className="text-6xl mb-4">📊</div>
      <p className="text-dark-400">页面开发中...</p>
    </div>
  </div>
);

const MyOrders = () => (
  <div className="max-w-7xl mx-auto px-4 py-8">
    <h1 className="text-3xl font-bold text-white mb-4">我的订单</h1>
    <p className="text-dark-400">查看和管理您的所有订单</p>
    <div className="glass-card p-12 text-center mt-8">
      <div className="text-6xl mb-4">📁</div>
      <p className="text-dark-400">页面开发中...</p>
    </div>
  </div>
);

const FeederPanel = () => (
  <div className="max-w-7xl mx-auto px-4 py-8">
    <h1 className="text-3xl font-bold text-white mb-4">喂价员工作台</h1>
    <p className="text-dark-400">处理待喂价的订单</p>
    <div className="glass-card p-12 text-center mt-8">
      <div className="text-6xl mb-4">📡</div>
      <p className="text-dark-400">页面开发中...</p>
    </div>
  </div>
);

const PointsCenter = () => (
  <div className="max-w-7xl mx-auto px-4 py-8">
    <h1 className="text-3xl font-bold text-white mb-4">积分中心</h1>
    <p className="text-dark-400">查看积分余额，领取空投奖励</p>
    <div className="glass-card p-12 text-center mt-8">
      <div className="text-6xl mb-4">🎁</div>
      <p className="text-dark-400">页面开发中...</p>
    </div>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-dark-950">
        <Header />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Navigate to="/buyer" replace />} />
            <Route path="/buyer" element={<BuyerHall />} />
            <Route path="/seller" element={<SellerHall />} />
            <Route path="/orders" element={<MyOrders />} />
            <Route path="/feeder" element={<FeederPanel />} />
            <Route path="/points" element={<PointsCenter />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="bg-dark-950 border-t border-dark-800 py-6 mt-auto">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-dark-500 text-sm">
              © 2024 NST Options. 场外期权撮合系统 | BSC Chain
            </p>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
