import React, { useState, useEffect } from 'react';
import { getTodayEntry, updateTodayEntry, generateBillingCycle, getDashboardStats, getActiveBillingCycle } from '../lib/db';
import { format } from 'date-fns';

const quantities = [1, 1.5, 2, 2.5, 3, 3.5];

const Home = ({ setActiveTab, showToast, setIsLoading }) => {
    const [todayEntry, setTodayEntry] = useState(null);
    const [activeCycle, setActiveCycle] = useState(null);
    const [popupContent, setPopupContent] = useState(null);
    const [cycleRange, setCycleRange] = useState('');
    const [isLocked, setIsLocked] = useState(false);

    const refresh = () => {
        setActiveCycle(getActiveBillingCycle());
        setTodayEntry(getTodayEntry());
        const stats = getDashboardStats();
        setCycleRange(stats.cycleRange);
        setIsLocked(stats.isLocked);
    };

    useEffect(() => {
        refresh();
    }, []);

    useEffect(() => {
        if (!activeCycle?.id) return;
        generateBillingCycle();

        // Ensure UI updates if the cycle triggers creation for today
        const freshEntry = getTodayEntry();
        if (freshEntry) setTodayEntry(freshEntry);
    }, [activeCycle?.id]);

    const handleQuantitySelect = (qty) => {
        if (todayEntry && todayEntry.is_modified) {
            setPopupContent(qty);
        } else {
            updateTodayEntry(qty, 'overwrite');
            if (showToast) showToast(`${qty}L milk added`);
            refresh();
        }
    };

    const handlePopupAction = (action) => {
        if (action !== 'cancel' && popupContent !== null) {
            updateTodayEntry(popupContent, action);
            if (showToast) showToast(`Entry updated`);
        }
        setPopupContent(null);
        refresh();
    };

    const renderBadges = () => {
        if (!todayEntry) return null;
        return (
            <div className="flex gap-1 mt-1">
                {todayEntry.is_cancelled && !todayEntry.is_modified && (
                    <span className="badge badge-cancelled">Cancelled</span>
                )}
                {todayEntry.is_modified && (
                    <span className="badge badge-modified">Modified</span>
                )}
            </div>
        );
    };

    return (
        <div className="animate-slide-up">
            <h1 className="page-title" style={{ marginBottom: '8px' }}>Milk Ledger</h1>
            <p className="text-secondary mb-3" style={{ fontSize: '14px' }}>Cycle: {cycleRange}</p>

            <div className={`card mb-3 today-highlight ${todayEntry?.is_cancelled && !todayEntry?.is_modified ? 'is-cancelled' : ''}`}>
                <div className="flex justify-between items-center mb-1">
                    <p className="text-secondary" style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '1px' }}>TODAY</p>
                    <p className="text-secondary" style={{ fontSize: '14px', fontWeight: 500 }}>
                        {format(new Date(), 'dd/MM/yy')}
                    </p>
                </div>

                <div className="mt-2">
                    <p className="text-secondary mb-1">Today's Total</p>
                    <h2 style={{ fontSize: '36px', fontWeight: 700 }}>
                        {todayEntry ? todayEntry.quantity : 0} L
                    </h2>
                    {renderBadges()}
                </div>
            </div>

            <h2 className="mb-2" style={{ fontSize: '20px' }}>Add Milk</h2>

            {isLocked ? (
                <div className="card mb-3 text-center is-cancelled" style={{ padding: '24px 16px', border: '1px dashed var(--danger-color)' }}>
                    <p className="text-secondary" style={{ color: 'var(--danger-color)' }}>
                        Cycle is Closed & Locked
                    </p>
                    <p className="text-secondary mt-1" style={{ fontSize: '13px' }}>
                        Go to Dashboard to unlock history.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                    {quantities.map(qty => (
                        <button
                            key={qty}
                            className="btn"
                            onClick={() => handleQuantitySelect(qty)}
                            style={{ height: '80px', fontSize: '24px' }}
                        >
                            {qty}L
                        </button>
                    ))}
                </div>
            )}

            <button className="btn w-full" style={{ borderColor: 'var(--accent-color)', color: 'var(--accent-color)' }} onClick={() => setActiveTab('ledger')}>
                View Month
            </button>

            {popupContent !== null && (
                <div className="popup-backdrop animate-fade-in">
                    <div className="card w-full" style={{ maxWidth: '400px' }}>
                        <h3 className="mb-2">Duplicate Entry</h3>
                        <p className="text-secondary mb-3">
                            Entry already exists for today.<br />
                            Current: <b>{todayEntry.quantity} L</b><br />
                            Selected: <b>{popupContent} L</b><br /><br />
                            Choose action:
                        </p>
                        <div className="flex-col gap-2">
                            <button className="btn btn-primary w-full" onClick={() => handlePopupAction('overwrite')}>
                                Overwrite
                            </button>
                            <button className="btn w-full" onClick={() => handlePopupAction('add')} style={{ borderColor: 'var(--accent-color)', color: 'var(--accent-color)' }}>
                                Add Quantity ({todayEntry.quantity + popupContent} L)
                            </button>
                            <button className="btn w-full" onClick={() => handlePopupAction('cancel')}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Home;
