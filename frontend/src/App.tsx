import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import BuyerHall from './pages/BuyerHall';
import SellerHall from './pages/SellerHall';
import FeederPanel from './pages/FeederPanel';
import PointsCenter from './pages/PointsCenter';
import MyOrders from './pages/MyOrders';
import CreateBuyerRFQ from './pages/CreateBuyerRFQ';
import CreateSellerOrder from './pages/CreateSellerOrder';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-8">
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
        <footer className="bg-dark-950 border-t border-dark-800 py-6 mt-auto">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <p className="text-dark-500 text-sm">
               2024 NST Options. 场外期权撮合系统 | BSC Chain
            </p>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
