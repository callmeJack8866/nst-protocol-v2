import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { WalletProvider } from './context/WalletContext';
import { PerspectiveProvider } from './context/PerspectiveContext';
import PerspectiveTransition from './components/PerspectiveTransition';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { OrderMarket } from './pages/OrderMarket';
import FeederPanel from './pages/FeederPanel';
import MyOrders from './pages/MyOrders';
import CreateBuyerRFQ from './pages/CreateBuyerRFQ';
import CreateSellerOrder from './pages/CreateSellerOrder';
import OrderDetail from './pages/OrderDetail';
import Leaderboard from './pages/Leaderboard';
import { PointsCenter } from './pages/PointsCenter';
import { SeatManagement } from './pages/SeatManagement';
import SubmitQuotePage from './pages/SubmitQuotePage';
import { ToastProvider } from './components/Toast';

function App() {
  const { t } = useTranslation();
  return (

    <ToastProvider>
      <WalletProvider>
        <PerspectiveProvider>
          <PerspectiveTransition />
          <BrowserRouter>
            <div className="flex h-screen bg-[#050505] text-white overflow-hidden relative font-['Outfit']">
              {/* Background Decorative Layer */}
              <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gold-500/5 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-gold-500/5 blur-[120px] rounded-full" />
              </div>

              {/* Sidebar - Fixed width, full height */}
              <Sidebar />

              {/* Main Interface Area */}
              <div className="flex-1 flex flex-col relative z-10 min-w-0 h-full">
                {/* Header - Horizontal status bar */}
                <Header />

                {/* Scrollable Content Viewport */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                  <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-10 min-h-full">
                    <Routes>
                      <Route path="/" element={<Navigate to="/market" replace />} />
                      <Route path="/market" element={<OrderMarket />} />
                      <Route path="/orders" element={<MyOrders />} />
                      <Route path="/portfolio" element={<MyOrders />} />
                      <Route path="/feeder" element={<FeederPanel />} />
                      <Route path="/points" element={<PointsCenter />} />
                      <Route path="/rewards" element={<PointsCenter />} />
                      <Route path="/create-rfq" element={<CreateBuyerRFQ />} />
                      <Route path="/create-seller-order" element={<CreateSellerOrder />} />
                      <Route path="/leaderboard" element={<Leaderboard />} />
                      <Route path="/order/:orderId" element={<OrderDetail />} />
                      <Route path="/seat" element={<SeatManagement />} />
                      <Route path="/quote/:orderId" element={<SubmitQuotePage />} />
                    </Routes>
                  </div>

                  <footer className="w-full py-10 border-t border-white/[0.04] mt-10">
                    <div className="text-center opacity-30">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em]">
                        {t('rfq.common.footer_copyright')}
                      </p>

                    </div>
                  </footer>
                </main>
              </div>
            </div>
          </BrowserRouter>
        </PerspectiveProvider>
      </WalletProvider>
    </ToastProvider>
  );
}

export default App;
