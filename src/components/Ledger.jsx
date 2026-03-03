import React, { useEffect, useState, useMemo } from 'react';
import { getEntries, getBillingCycles, getCycleStats } from '../lib/db';
import { format, parseISO } from 'date-fns';

const Ledger = () => {
    const [entries, setEntries] = useState([]);
    const [cycles, setCycles] = useState([]);
    const [selectedCycleId, setSelectedCycleId] = useState('');
    const [stats, setStats] = useState(null);
    const [isCorrupted, setIsCorrupted] = useState(false);

    const refresh = () => {
        const c = getBillingCycles();
        setCycles(c);

        if (c.length > 0 && !selectedCycleId) {
            setSelectedCycleId(c[c.length - 1].id);
        }
    };

    useEffect(() => {
        refresh();
    }, [selectedCycleId]);

    useEffect(() => {
        if (selectedCycleId) {
            const allEntries = getEntries();
            const cycleEntries = allEntries.filter(e => e.billing_cycle_id === selectedCycleId);
            setEntries(cycleEntries);

            const s = getCycleStats(selectedCycleId);
            setStats(s);

            const selectedCycle = cycles.find(c => c.id === selectedCycleId);
            if (selectedCycle && selectedCycle.is_locked && selectedCycle.snapshot_total_liters !== undefined) {
                const corrupted =
                    s.totalLiters !== selectedCycle.snapshot_total_liters ||
                    s.totalBill !== selectedCycle.snapshot_total_bill ||
                    s.totalPaid !== selectedCycle.snapshot_total_paid ||
                    s.pendingBalance !== selectedCycle.snapshot_closing_balance;
                setIsCorrupted(corrupted);
            } else {
                setIsCorrupted(false);
            }
        }
    }, [selectedCycleId, cycles]);

    const renderedEntries = useMemo(() => {
        if (entries.length === 0) {
            return (
                <div className="card text-center">
                    <p className="text-secondary" style={{ padding: '16px 0' }}>Start tracking your daily milk...</p>
                </div>
            );
        }
        return (
            <div className="flex-col gap-2">
                {entries.map(entry => (
                    <div key={entry.id} className={`card ${entry.is_cancelled && !entry.is_modified ? 'is-cancelled' : ''}`} style={{ padding: '16px', marginBottom: 0 }}>
                        <div className="flex justify-between items-start mb-1">
                            <div>
                                <p style={{ fontWeight: 600, fontSize: '15px' }}>{format(parseISO(entry.date), 'dd/MM/yy')}</p>
                                {entry.is_cancelled && !entry.is_modified && (
                                    <span className="badge badge-cancelled mt-1" style={{ fontSize: '10px' }}>Cancelled</span>
                                )}
                                {entry.is_modified && (
                                    <span className="badge badge-modified mt-1" style={{ fontSize: '10px' }}>Modified</span>
                                )}
                                {!entry.is_cancelled && !entry.is_modified && (
                                    <span className="badge mt-1" style={{ fontSize: '10px', backgroundColor: '#e5e5ea', color: '#8e8e93' }}>Default</span>
                                )}
                            </div>
                            <div className="text-right">
                                <p style={{ fontWeight: 600, fontSize: '15px' }}>{entry.quantity} L</p>
                                <p className="text-secondary" style={{ fontSize: '12px' }}>@ ₹{entry.rate_used}/L</p>
                            </div>
                        </div>
                        <div className="text-right mt-1">
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>₹{entry.total_amount.toFixed(2)}</span>
                        </div>
                    </div>
                ))}
            </div>
        );
    }, [entries]);

    if (!selectedCycleId || !stats) {
        return (
            <div className="animate-slide-up">
                <h1 className="page-title">Ledger</h1>
                <p className="text-secondary">No billing cycles found.</p>
            </div>
        );
    }

    const renderStatusBadge = () => {
        switch (stats.status) {
            case 'Paid':
                return <span className="badge mt-1" style={{ fontSize: '10px', backgroundColor: 'var(--success-color)', color: 'white' }}>Paid</span>;
            case 'Partial':
                return <span className="badge mt-1" style={{ fontSize: '10px', backgroundColor: 'var(--accent-color)', color: 'white' }}>Partial</span>;
            case 'Unpaid':
            default:
                return <span className="badge mt-1" style={{ fontSize: '10px', backgroundColor: 'var(--danger-color)', color: 'white' }}>Unpaid</span>;
        }
    };

    return (
        <div className="animate-slide-up">
            <div className="flex justify-between items-center mb-1">
                <h1 className="page-title" style={{ marginBottom: '16px' }}>Ledger</h1>
                <div>
                    {stats.isLocked && (
                        <span className="badge mt-1" style={{ fontSize: '10px', backgroundColor: '#e5e5ea', color: '#1d1d1f' }}>Locked Cycle</span>
                    )}
                    {isCorrupted && (
                        <span className="badge mt-1" style={{ fontSize: '10px', backgroundColor: 'var(--danger-color)', color: 'white', marginLeft: '8px' }}>Data Integrity Warning</span>
                    )}
                </div>
            </div>

            <div className="mb-3">
                <select
                    value={selectedCycleId}
                    onChange={e => setSelectedCycleId(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)', fontSize: '16px', backgroundColor: 'var(--card-bg)' }}
                >
                    {cycles.map(c => (
                        <option key={c.id} value={c.id}>
                            Cycle: {format(parseISO(c.start_date), 'dd/MM/yy')} – {format(parseISO(c.end_date), 'dd/MM/yy')}
                        </option>
                    ))}
                </select>
                <div className="flex justify-between items-center mt-1">
                    <p className="text-secondary" style={{ fontSize: '13px' }}>
                        {stats.cycleRange}
                    </p>
                    {renderStatusBadge()}
                </div>
            </div>

            <div className="card mb-3">
                <div className="flex justify-between items-center mb-2 pb-2 border-b" style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <span className="text-secondary">Opening Balance</span>
                    <span style={{ fontWeight: 600 }}>
                        {stats.openingBalance < 0 ? `-₹${Math.abs(stats.openingBalance).toFixed(2)} (CR)` : `₹${stats.openingBalance.toFixed(2)}`}
                    </span>
                </div>
                <div className="flex justify-between items-center mb-2 pb-2 border-b" style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <span className="text-secondary">Total Liters</span>
                    <span style={{ fontWeight: 600 }}>{stats.totalLiters.toFixed(1)} L</span>
                </div>
                <div className="flex justify-between items-center mb-2 pb-2 border-b" style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <span className="text-secondary">Expected Total Bill</span>
                    <span style={{ fontWeight: 600 }}>₹{stats.totalBill.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mb-2 pb-2 border-b" style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <span className="text-secondary">Total Paid</span>
                    <span className="text-success" style={{ fontWeight: 600 }}>₹{stats.totalPaid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-secondary">Pending</span>
                    <span className={stats.pendingBalance > 0 ? "text-danger" : "text-success"} style={{ fontWeight: 600, fontSize: '18px' }}>
                        {stats.pendingBalance < 0 ? `-₹${Math.abs(stats.pendingBalance).toFixed(2)} (CR)` : `₹${stats.pendingBalance.toFixed(2)}`}
                    </span>
                </div>
            </div>

            <h3 className="mb-2">Daily Entries</h3>

            {renderedEntries}
        </div>
    );
};

export default Ledger;
