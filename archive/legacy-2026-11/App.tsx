import React from 'react';
import { OwnerPortal } from './components/OwnerPortal';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { QueueManagement } from './components/QueueManagement';
import { CustomerManagement } from './components/CustomerManagement';
import { BayManagement } from './components/BayManagement';
import { CashAndPayments } from './components/CashAndPayments';
import { InventoryAndExpenses } from './components/InventoryAndExpenses';
import { ReportsAndAnalytics } from './components/ReportsAndAnalytics';
import { CatalogueManagement } from './components/CatalogueManagement';
import { StaffManagement } from './components/StaffManagement';
import { SaaSAdminAndSubscriptions } from './components/SaaSAdminAndSubscriptions';
import { MarketplaceView } from './components/MarketplaceView';
import { SettingsAndHelp } from './components/SettingsAndHelp';
import { NotificationsCenter } from './components/NotificationsCenter';
import { NewWashModal } from './components/NewWashModal';
import { TicketModal } from './components/TicketModal';
import { OrderDetailModal } from './components/OrderDetailModal';
import { OnboardingWizard } from './components/OnboardingWizard';
import { PosScreen } from './components/PosScreen';
import { HelpScreen } from './components/HelpScreen';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { 
    activeTab, 
    bannerMessage, 
    isDarkMode, 
    selectedOrderForDetail, 
    setSelectedOrderForDetail,
    isOnboardingOpen,
    setIsOnboardingOpen 
  } = useApp();

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'queue':
        return <QueueManagement />;
      case 'customers':
        return <CustomerManagement />;
      case 'bays':
        return <BayManagement />;
      case 'payments':
        return <CashAndPayments />;
      case 'inventory':
        return <InventoryAndExpenses />;
      case 'reports':
        return <ReportsAndAnalytics />;
      case 'catalogue':
        return <CatalogueManagement />;
      case 'staff':
        return <StaffManagement />;
      case 'subscriptions':
      case 'superadmin':
        return <SaaSAdminAndSubscriptions />;
      case 'marketplace':
        return <MarketplaceView />;
      case 'notifications':
        return <NotificationsCenter />;
      case 'pos':
        return <PosScreen />;
      case 'settings':
        return <SettingsAndHelp />;
      case 'help':
        return <HelpScreen />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className={`min-h-screen flex ${isDarkMode ? 'bg-[#111317] text-gray-100' : 'bg-gray-50 text-gray-900'} font-sans transition-colors duration-200 antialiased`}>
      {/* Fixed Left Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* Top Sticky Header */}
        <Header />

        {/* Floating Notification Banner */}
        {bannerMessage && (
          <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom duration-300">
            <div
              className={`px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-semibold border ${
                bannerMessage.type === 'success'
                  ? 'bg-[#183a2b] text-emerald-300 border-emerald-500/40 shadow-emerald-900/30'
                  : bannerMessage.type === 'warning'
                  ? 'bg-[#3d2e1b] text-amber-300 border-amber-500/40 shadow-amber-900/30'
                  : 'bg-[#1b2f44] text-cyan-300 border-cyan-500/40 shadow-cyan-900/30'
              }`}
            >
              {bannerMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : bannerMessage.type === 'warning' ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              ) : (
                <Info className="w-4 h-4 text-cyan-400 flex-shrink-0" />
              )}
              <span>{bannerMessage.text}</span>
            </div>
          </div>
        )}

        {/* Dynamic Route View */}
        <main className="flex-1 pb-16">
          {renderActiveTab()}
        </main>
      </div>

      {/* Global Interactive Modals */}
      <NewWashModal />
      <TicketModal />
      <OrderDetailModal order={selectedOrderForDetail} onClose={() => setSelectedOrderForDetail(null)} />
      <OnboardingWizard isOpen={isOnboardingOpen} onClose={() => setIsOnboardingOpen(false)} />
    </div>
  );
};

export default function App() {
  return <OwnerPortal />;
}
