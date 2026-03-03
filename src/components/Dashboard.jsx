import React, { useEffect, useState, useMemo } from 'react';
import { getDashboardStats, addPayment, closeBillingCycle, unlockBillingCycle, getActiveBillingCycle, getPaymentsForCycle, updatePayment, generateBillingCycle } from '../lib/db';
import { format, parseISO } from 'date-fns';

const Dashboard = ({ showToast, setIsLoading }) => {
    const [stats, setStats] = useState({
        totalLiters: 0,
        totalBill: 0,
        totalPaid: 0,
        pendingBalance: 0,
        openingBalance: 0,
        lastPaymentDate: 'N/A',
        rateUsed: 50,
        cycleRange: '',
        status: 'Unpaid'
    });

    const [activeCycle, setActiveCycle] = useState(null);

    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentAmt, setPaymentAmt] = useState('');

    // Using simple unlock confirm inside modal
    const [showUnlockModal, setShowUnlockModal] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);

    const [payments, setPayments] = useState([]);
    const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);
    const [editPaymentId, setEditPaymentId] = useState(null);
    const [editPaymentAmt, setEditPaymentAmt] = useState('');

    const refresh = () => {
        setStats(getDashboardStats());
        const cycle = getActiveBillingCycle();
        setActiveCycle(cycle);
        if (cycle) {
            setPayments(getPaymentsForCycle(cycle.id));
        } else {
            setPayments([]);
        }
    };

    useEffect(() => {
        refresh();
    }, []);

    useEffect(() => {
        if (!activeCycle?.id) return;
        generateBillingCycle();
    }, [activeCycle?.id]);

    const renderedPayments = useMemo(() => {
        if (!payments || payments.length === 0) return null;
        return (
            <div className="card mt-2">
                <h3 className="mb-2" style={{ fontSize: '16px' }}>Recent Payments</h3>
                <div className="flex-col gap-2">
                    {payments.map(p => (
                        <div key={p?.id || Math.random()} className="flex justify-between items-center pb-2 border-b" style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <div>
                                <p style={{ fontWeight: 600 }}>₹{parseFloat(p?.amount_paid || 0).toFixed(2)}</p>
                                <p className="text-secondary" style={{ fontSize: '12px' }}>
                                    {p?.payment_date ? format(parseISO(p.payment_date), 'dd/MM/yy') : ''} {p?.edited_at && '(Edited)'}
                                </p>
                            </div>
                            {!activeCycle?.is_locked && (
                                <button className="text-accent" style={{ color: 'var(--accent-color)', fontSize: '14px', fontWeight: 500 }} onClick={() => handleEditPaymentClick(p)}>
                                    Edit
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    }, [payments, activeCycle?.is_locked, showToast]);

    // Null safety guard
    if (!stats) return <div className="animate-slide-up"><p>Loading...</p></div>;

    const handleAddPayment = () => {
        if (!activeCycle || activeCycle.is_locked) {
            if (showToast) showToast("Cannot add payment. Cycle is locked.");
            return;
        }
        if (parseFloat(paymentAmt) > 0) {
            addPayment(activeCycle.id, parseFloat(paymentAmt), format(new Date(), 'yyyy-MM-dd'), 'Manual Payment');
            setPaymentAmt('');
            setShowPaymentModal(false);
            if (showToast) showToast("Payment added successfully");
            refresh();
        }
    };

    const handleEditPaymentClick = (payment) => {
        if (!activeCycle || activeCycle.is_locked) {
            if (showToast) showToast("Cannot edit payment. Cycle is locked.");
            return;
        }
        setEditPaymentId(payment.id);
        setEditPaymentAmt(payment.amount_paid);
        setShowEditPaymentModal(true);
    };

    const handleSaveEditPayment = () => {
        const amt = parseFloat(editPaymentAmt);
        if (amt >= 0 && editPaymentId) {
            const success = updatePayment(editPaymentId, amt);
            if (success) {
                if (showToast) showToast('Payment updated successfully');
            } else {
                if (showToast) showToast('Failed or no change to update');
            }
            setShowEditPaymentModal(false);
            refresh();
        }
    };

    const handleCloseCycle = () => {
        setShowCloseModal(true);
    };

    const handleConfirmCloseCycle = () => {
        setShowCloseModal(false);
        if (setIsLoading) setIsLoading(true);
        setTimeout(() => {
            closeBillingCycle();
            refresh();
            if (setIsLoading) setIsLoading(false);
            if (showToast) showToast('Cycle closed successfully');
        }, 300); // UI breathing room for heavy computation simulation
    };

    const handleUnlockCycle = () => {
        if (!activeCycle) return;
        unlockBillingCycle(activeCycle.id);
        setShowUnlockModal(false);
        if (showToast) showToast('Cycle unlocked successfully');
        refresh();
    };

    return (
        <div className="animate-slide-up">
            <div className="flex justify-between items-center mb-1">
                <h1 className="page-title" style={{ marginBottom: '8px' }}>Dashboard</h1>
                {activeCycle && activeCycle.is_locked && (
                    <span className="badge badge-modified" style={{ marginBottom: '8px', backgroundColor: '#e5e5ea', color: '#1d1d1f' }}>Locked</span>
                )}
            </div>
            <p className="text-secondary mb-3" style={{ fontSize: '14px' }}>Cycle: {stats?.cycleRange || ''}</p>

            <div className="card mb-3" style={{ background: 'linear-gradient(135deg, var(--accent-color), #005bb5)', color: 'white', border: 'none' }}>
                <div className="mb-2">
                    <p style={{ opacity: 0.9, fontSize: '14px' }} className="mb-1">This Cycle's Total</p>
                    <h2 style={{ fontSize: '32px' }}>{(stats?.totalLiters || 0).toFixed(1)} L</h2>
                </div>
            </div>

            <h2 className="mb-2" style={{ fontSize: '20px' }}>Billing Summary</h2>
            <div className="card mb-2">
                <div className="flex justify-between items-center mb-2 pb-2 border-b" style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <span className="text-secondary">Opening Balance</span>
                    <span style={{ fontWeight: 600, fontSize: '16px' }}>
                        {(stats?.openingBalance || 0) < 0 ? `-₹${Math.abs(stats?.openingBalance || 0).toFixed(2)} (CR)` : `₹${(stats?.openingBalance || 0).toFixed(2)}`}
                    </span>
                </div>
                <div className="flex justify-between items-center mb-2 pb-2 border-b" style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <span className="text-secondary">Expected Total Bill</span>
                    <span style={{ fontWeight: 600, fontSize: '18px' }}>₹{(stats?.totalBill || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mb-2 pb-2 border-b" style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <span className="text-secondary">Base Rate</span>
                    <span style={{ fontWeight: 600 }}>₹{stats?.baseRate || activeCycle?.base_rate}/L</span>
                </div>
                <div className="flex justify-between items-center mb-2 pb-2 border-b" style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <span className="text-secondary">Total Paid</span>
                    <span className="text-success" style={{ fontWeight: 600 }}>₹{(stats?.totalPaid || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-secondary">Pending Balance</span>
                    <span className={(stats?.pendingBalance || 0) > 0 ? "text-danger" : "text-success"} style={{ fontWeight: 600, fontSize: '18px' }}>
                        {(stats?.pendingBalance || 0) < 0 ? `-₹${Math.abs(stats?.pendingBalance || 0).toFixed(2)} (CR)` : `₹${(stats?.pendingBalance || 0).toFixed(2)}`}
                    </span>
                </div>
            </div>

            {activeCycle && !activeCycle.is_locked ? (
                <div className="flex-col gap-2 mb-2">
                    <button className="btn btn-primary w-full" style={{ height: '56px', fontSize: '18px' }} onClick={() => setShowPaymentModal(true)}>
                        Add Payment
                    </button>
                    <button className="btn w-full" style={{ height: '56px', fontSize: '18px', borderColor: 'var(--danger-color)', color: 'var(--danger-color)' }} onClick={handleCloseCycle}>
                        Close Cycle
                    </button>
                </div>
            ) : (
                <button className="btn w-full mb-2" style={{ height: '56px', fontSize: '18px', borderColor: 'var(--accent-color)', color: 'var(--accent-color)' }} onClick={() => setShowUnlockModal(true)}>
                    Unlock Cycle
                </button>
            )}

            {renderedPayments}

            {showPaymentModal && (
                <div className="popup-backdrop animate-fade-in">
                    <div className="card w-full" style={{ maxWidth: '400px', zIndex: 1001 }}>
                        <h3 className="mb-2">Enter Payment</h3>
                        <p className="text-secondary mb-3">
                            Record a manual payment for this cycle. The pending balance is ₹{stats.pendingBalance.toFixed(2)}
                        </p>
                        <input
                            type="number"
                            placeholder="Amount (₹)"
                            value={paymentAmt}
                            onChange={(e) => setPaymentAmt(e.target.value)}
                            className="mb-3"
                        />
                        <div className="flex-col gap-2">
                            <button className="btn btn-primary w-full" onClick={handleAddPayment}>
                                Confirm Payment
                            </button>
                            <button className="btn w-full" onClick={() => setShowPaymentModal(false)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showUnlockModal && (
                <div className="popup-backdrop animate-fade-in">
                    <div className="card w-full" style={{ maxWidth: '400px', zIndex: 1001 }}>
                        <h3 className="mb-2">Unlock Cycle?</h3>
                        <p className="text-secondary mb-3">
                            Warning: Unlocking allows edits to historic frozen entries but retains your payment history. Are you sure you want to unlock?
                        </p>
                        <div className="flex-col gap-2">
                            <button className="btn btn-danger w-full" onClick={handleUnlockCycle}>
                                Yes, Unlock
                            </button>
                            <button className="btn w-full" onClick={() => setShowUnlockModal(false)}>
                                Keep Locked
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showCloseModal && (
                <div className="popup-backdrop animate-fade-in">
                    <div className="card w-full" style={{ maxWidth: '400px', zIndex: 1001 }}>
                        <h3 className="mb-2">Close Cycle?</h3>
                        <p className="text-secondary mb-3">
                            Are you sure you want to close this billing cycle? This will lock entries and carry the balance forward.
                        </p>
                        <div className="flex-col gap-2">
                            <button className="btn btn-danger w-full" onClick={handleConfirmCloseCycle}>
                                Yes, Close Cycle
                            </button>
                            <button className="btn w-full" onClick={() => setShowCloseModal(false)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showEditPaymentModal && (
                <div className="popup-backdrop animate-fade-in">
                    <div className="card w-full" style={{ maxWidth: '400px', zIndex: 1001 }}>
                        <h3 className="mb-2">Edit Payment</h3>
                        <p className="text-secondary mb-3">
                            Update the previously recorded payment amount.
                        </p>
                        <input
                            type="number"
                            placeholder="Amount (₹)"
                            value={editPaymentAmt}
                            onChange={(e) => setEditPaymentAmt(e.target.value)}
                            className="mb-3"
                        />
                        <div className="flex-col gap-2">
                            <button className="btn btn-primary w-full" onClick={handleSaveEditPayment}>
                                Save Changes
                            </button>
                            <button className="btn w-full" onClick={() => setShowEditPaymentModal(false)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
