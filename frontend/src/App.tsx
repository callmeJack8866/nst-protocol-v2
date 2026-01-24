import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { WalletProvider } from './context/WalletContext';
import { PerspectiveProvider } from './context/PerspectiveContext';
import { Header } from './components/Header';
import { BuyerHall } from './pages/BuyerHall';
import { SellerHall } from './pages/SellerHall';
import { FeederPanel } from './pages/FeederPanel';
import { MyOrders } from './pages/MyOrders';
import CreateBuyerRFQ from './pages/CreateBuyerRFQ';
import CreateSellerOrder from './pages/CreateSellerOrder';
import { PointsCenter } from './pages/PointsCenter';

function App() {
  return (
    <WalletProvider>
      <PerspectiveProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-slate-950 flex flex-col">
            {/* Header stays sticky at the top */}
            <Header />

            <div className="flex flex-col flex-1">
              {/* Sidebar removed as per user request */}

              <main className="flex-1 w-full flex flex-col items-center">
                <div className="w-full max-w-[1500px] px-6 md:px-10">
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
                </div>

                <footer className="w-full py-12 border-t border-white/[0.03] mt-20">
                  <div className="text-center">
                    <p className="text-slate-600 text-[10px] font-bold uppercase tracking-[0.3em]">
                      2024 NST OPTIONS. 场外期权撮合系统 | BSC CHAIN
                    </p>
                  </div>
                </footer>
              </main>
            </div>
          </div>
        </BrowserRouter>
      </PerspectiveProvider>
    </WalletProvider>
  );
}

export default App;
