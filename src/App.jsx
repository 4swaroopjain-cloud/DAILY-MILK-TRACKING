import React, { useState } from 'react';
import Home from './components/Home';
import Settings from './components/Settings';
import Dashboard from './components/Dashboard';
import Ledger from './components/Ledger';
import Navigation from './components/Navigation';

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [toastMessage, setToastMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 2000); // Auto dismiss after 2s
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <Home setActiveTab={setActiveTab} showToast={showToast} setIsLoading={setIsLoading} />;
      case 'dashboard':
        return <Dashboard showToast={showToast} setIsLoading={setIsLoading} />;
      case 'ledger':
        return <Ledger showToast={showToast} setIsLoading={setIsLoading} />;
      case 'settings':
        return <Settings showToast={showToast} setIsLoading={setIsLoading} />;
      default:
        return <Home setActiveTab={setActiveTab} showToast={showToast} setIsLoading={setIsLoading} />;
    }
  };

  return (
    <>
      {isLoading && (
        <div className="loader-overlay animate-fade-in">
          <div className="spinner"></div>
        </div>
      )}

      <div className="page animate-fade-in">
        {renderContent()}
      </div>
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="toast-container">
        <div className={`toast ${toastMessage ? 'show' : ''}`}>
          {toastMessage}
        </div>
      </div>
    </>
  );
}

export default App;
