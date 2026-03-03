import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings, generateBillingCycle } from '../lib/db';
import { format, differenceInDays, parseISO } from 'date-fns';

const Settings = () => {
    const [settings, setLocalSettings] = useState({
        defaultQuantity: 1,
        ratePerLiter: 50,
        cancelRanges: [],
        rateChanges: [],
        currentBillingCycleId: ''
    });

    const [newRange, setNewRange] = useState({ start: '', end: '' });
    const [newRateChange, setNewRateChange] = useState({ start_date: '', rate: '' });
    const [confirmRemoveIndex, setConfirmRemoveIndex] = useState(null);

    const refresh = () => {
        setLocalSettings(getSettings());
    };

    useEffect(() => {
        refresh();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setLocalSettings(prev => ({
            ...prev,
            [name]: parseFloat(value) || value
        }));
    };

    const handleAddRange = () => {
        if (newRange.start && newRange.end) {
            setLocalSettings(prev => ({
                ...prev,
                cancelRanges: [...prev.cancelRanges, newRange]
            }));
            setNewRange({ start: '', end: '' });
        }
    };

    const handleAddRateChange = () => {
        if (!newRateChange.start_date || !newRateChange.rate) {
            alert("Please enter both an effective date and a new rate.");
            return;
        }
        setLocalSettings(prev => ({
            ...prev,
            rateChanges: [...(prev.rateChanges || []), { start_date: newRateChange.start_date, rate: parseFloat(newRateChange.rate) }]
        }));
        setNewRateChange({ start_date: '', rate: '' });
    };

    const requestRemoveRange = (index) => {
        setConfirmRemoveIndex(index);
    };

    const confirmRemove = () => {
        if (confirmRemoveIndex !== null) {
            setLocalSettings(prev => ({
                ...prev,
                cancelRanges: prev.cancelRanges.filter((_, i) => i !== confirmRemoveIndex)
            }));
            setConfirmRemoveIndex(null);
        }
    };

    const removeRateChange = (index) => {
        setLocalSettings(prev => ({
            ...prev,
            rateChanges: prev.rateChanges.filter((_, i) => i !== index)
        }));
    };

    const handleSave = () => {
        saveSettings(settings);
        generateBillingCycle();      // backfill any missing days
        refresh();                   // re-read merged ranges from storage
        alert("Settings saved and billing rules updated!");
    };

    const formatDateDisplay = (dateStr) => {
        if (!dateStr) return '';
        return format(parseISO(dateStr), 'dd/MM/yy');
    };

    const getDaysCount = (start, end) => {
        if (!start || !end) return 0;
        return differenceInDays(parseISO(end), parseISO(start)) + 1;
    };

    return (
        <div className="animate-slide-up">
            <h1 className="page-title">Settings</h1>

            <div className="card mb-3">
                <h3 className="mb-2">Milk Settings</h3>
                <div className="mb-2">
                    <label className="text-secondary" style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Default Daily Quantity (L)</label>
                    <input
                        type="number"
                        name="defaultQuantity"
                        value={settings.defaultQuantity}
                        onChange={handleChange}
                        step="0.5"
                    />
                </div>
                <div className="mb-2">
                    <label className="text-secondary" style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Base Rate per Liter (₹)</label>
                    <input
                        type="number"
                        name="ratePerLiter"
                        value={settings.ratePerLiter}
                        onChange={handleChange}
                        step="1"
                    />
                </div>
            </div>

            <div className="card mb-3">
                <h3 className="mb-2">Mid-Month Rate Change</h3>
                <p className="text-secondary mb-2" style={{ fontSize: '14px' }}>
                    Set a new rate starting from a specific date. Will apply moving forward.
                </p>

                <div className="flex gap-2 mb-2">
                    <div className="w-full">
                        <label className="text-secondary" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Effective Date</label>
                        <input
                            type="date"
                            value={newRateChange.start_date}
                            onChange={(e) => setNewRateChange({ ...newRateChange, start_date: e.target.value })}
                        />
                    </div>
                    <div className="w-full">
                        <label className="text-secondary" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>New Rate (₹)</label>
                        <input
                            type="number"
                            value={newRateChange.rate}
                            onChange={(e) => setNewRateChange({ ...newRateChange, rate: e.target.value })}
                        />
                    </div>
                </div>
                <button className="btn w-full mb-3" onClick={handleAddRateChange} style={{ borderColor: 'var(--accent-color)', color: 'var(--accent-color)', backgroundColor: 'var(--accent-color-light)' }}>
                    Add Rate Change
                </button>

                {settings.rateChanges && settings.rateChanges.length > 0 && (
                    <div className="mt-2">
                        <h4 className="mb-1" style={{ fontSize: '14px', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Upcoming/Historic Rates</h4>
                        <div className="flex-col gap-2">
                            {settings.rateChanges.map((rc, i) => (
                                <div key={i} className="card" style={{ padding: '16px', marginBottom: 0, border: '1px solid var(--border-color)' }}>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p style={{ fontWeight: 600, fontSize: '15px' }}>
                                                From: {formatDateDisplay(rc.start_date)}
                                            </p>
                                            <p className="text-secondary" style={{ fontSize: '13px' }}>
                                                Rate: ₹{rc.rate}/L
                                            </p>
                                        </div>
                                        <button className="btn btn-danger" style={{ padding: '8px 12px', fontSize: '14px' }} onClick={() => removeRateChange(i)}>
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="card mb-3">
                <h3 className="mb-2">Cancel Period</h3>
                <p className="text-secondary mb-2" style={{ fontSize: '14px' }}>
                    Set dates when you don't need milk. Daily entries for these dates will be set to 0. Auto-merges on save.
                </p>

                <div className="flex gap-2 mb-2">
                    <div className="w-full">
                        <label className="text-secondary" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Start Date</label>
                        <input
                            type="date"
                            value={newRange.start}
                            onChange={(e) => setNewRange({ ...newRange, start: e.target.value })}
                        />
                    </div>
                    <div className="w-full">
                        <label className="text-secondary" style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>End Date</label>
                        <input
                            type="date"
                            value={newRange.end}
                            onChange={(e) => setNewRange({ ...newRange, end: e.target.value })}
                        />
                    </div>
                </div>
                <button className="btn w-full mb-3" onClick={handleAddRange} style={{ borderColor: 'var(--accent-color)', color: 'var(--accent-color)', backgroundColor: 'var(--accent-color-light)' }}>
                    Add Cancel Range
                </button>

                {settings.cancelRanges.length > 0 && (
                    <div className="mt-2">
                        <h4 className="mb-1" style={{ fontSize: '14px', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Active Ranges</h4>
                        <div className="flex-col gap-2">
                            {settings.cancelRanges.map((range, i) => (
                                <div key={i} className="card is-cancelled" style={{ padding: '16px', marginBottom: 0, border: '1px solid var(--border-color)', opacity: 1 }}>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p style={{ fontWeight: 600, fontSize: '15px' }}>
                                                {formatDateDisplay(range.start)} → {formatDateDisplay(range.end)}
                                            </p>
                                            <p className="text-secondary" style={{ fontSize: '13px' }}>
                                                {getDaysCount(range.start, range.end)} day(s) cancelled
                                            </p>
                                        </div>
                                        <button className="btn btn-danger" style={{ padding: '8px 12px', fontSize: '14px' }} onClick={() => requestRemoveRange(i)}>
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <button className="btn btn-primary w-full" onClick={handleSave} style={{ height: '56px', fontSize: '18px' }}>
                Save & Apply Settings
            </button>

            {confirmRemoveIndex !== null && (
                <div className="popup-backdrop animate-fade-in">
                    <div className="card w-full" style={{ maxWidth: '400px', zIndex: 1001 }}>
                        <h3 className="mb-2">Remove Cancel Range?</h3>
                        <p className="text-secondary mb-3">
                            Are you sure you want to remove this cancel period? The default quantity will apply.
                        </p>
                        <div className="flex-col gap-2">
                            <button className="btn btn-danger w-full" onClick={confirmRemove}>
                                Yes, Remove
                            </button>
                            <button className="btn w-full" onClick={() => setConfirmRemoveIndex(null)}>
                                Keep Range
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
