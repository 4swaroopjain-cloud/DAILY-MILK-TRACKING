import React, { useState } from 'react';
import Home from './components/Home';
import Settings from './components/Settings';
import Dashboard from './components/Dashboard';
import Ledger from './components/Ledger';
import Navigation from './components/Navigation';
import { Moon, Sun } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [toastMessage, setToastMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  React.useEffect(() => {
    const saved = localStorage.getItem('milk_theme');
    // Default to dark if user hasn't explicitly set otherwise or user prefers dark match media
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (!saved && prefersDark)) {
      setIsDarkMode(true);
      document.body.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      if (next) {
        document.body.classList.add('dark');
        localStorage.setItem('milk_theme', 'dark');
      } else {
        document.body.classList.remove('dark');
        localStorage.setItem('milk_theme', 'light');
      }
      return next;
    });
  };

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

      <button
        onClick={toggleTheme}
        className="animate-fade-in"
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 1000,
          background: 'var(--card-bg)',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
          color: 'var(--text-primary)'
        }}
        aria-label="Toggle Dark Mode"
      >
        {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>

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
