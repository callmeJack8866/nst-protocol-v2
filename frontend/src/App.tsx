import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/Header';
import { BuyerHall } from './pages/BuyerHall';
import { SellerHall } from './pages/SellerHall';
import { FeederPanel } from './pages/FeederPanel';
import { PointsCenter } from './pages/PointsCenter';
import { MyOrders } from './pages/MyOrders';
import CreateBuyerRFQ from './pages/CreateBuyerRFQ';
import CreateSellerOrder from './pages/CreateSellerOrder';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950">
        <Header />
        <main className="max-w-[1500px] w-full mx-auto px-8 py-20 flex-grow">
          <Routes>
            <Route path="/" element={<Navigate to="/buyer" replace />} />
            <Route path="/buyer" element={<BuyerHall />} />
            <Route path="/seller" element={<SellerHall />} />
            <Route path="/orders" element={<MyOrders />} />
            <Route path="/feeder" element={<FeederPanel />} />
            <Route path="/points" element={<PointsCenter />} />
            <Route path="/create-rfq" element={<CreateBuyerRFQ />} />
            <Route path="/create-order" element={<CreateSellerOrder />} />
          </Routes>
        </main>
        <footer className="bg-dark-950/50 border-t border-white/5 py-10 mt-20">
          <div className="max-w-[1500px] mx-auto px-8 text-center">
            <p className="text-dark-500 text-xs font-medium uppercase tracking-[0.2em]">
              2024 NST Options. 场外期权撮合系统 | BSC Chain
            </p>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
