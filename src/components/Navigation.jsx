import React from 'react';
import { Home, ClipboardList, LineChart, Settings } from 'lucide-react';

const Navigation = ({ activeTab, setActiveTab }) => {
    return (
        <nav className="nav-bar">
            <button
                className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
                onClick={() => setActiveTab('home')}
            >
                <Home size={24} />
                <span>Home</span>
            </button>
            <button
                className={`nav-item ${activeTab === 'ledger' ? 'active' : ''}`}
                onClick={() => setActiveTab('ledger')}
            >
                <ClipboardList size={24} />
                <span>Ledger</span>
            </button>
            <button
                className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('dashboard')}
            >
                <LineChart size={24} />
                <span>Dashboard</span>
            </button>
            <button
                className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
            >
                <Settings size={24} />
                <span>Settings</span>
            </button>
        </nav>
    );
};

export default Navigation;
