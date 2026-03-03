import { v4 as uuidv4 } from 'uuid';
import { addDays, format, isWithinInterval, parseISO, startOfDay, endOfDay, differenceInDays } from 'date-fns';

const DB_KEY = 'milk_ledger_entries';
const SETTINGS_KEY = 'milk_ledger_settings';
const CYCLES_KEY = 'milk_billing_cycles';
const PAYMENTS_KEY = 'milk_payments';

export const getSettings = () => {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {
        defaultQuantity: 1,
        ratePerLiter: 50,
        cancelRanges: [], // { start, end }
        rateChanges: [], // { start_date, rate }
        currentBillingCycleId: null
    };
    const parsed = JSON.parse(raw);
    return {
        defaultQuantity: parsed.defaultQuantity || 1,
        ratePerLiter: parsed.ratePerLiter || 50,
        cancelRanges: parsed.cancelRanges || [],
        rateChanges: parsed.rateChanges || [],
        currentBillingCycleId: parsed.currentBillingCycleId || null
    };
};

export const saveSettings = (settings) => {
    settings.cancelRanges = mergeCancelRanges(settings.cancelRanges);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

const mergeCancelRanges = (ranges) => {
    if (!ranges.length) return [];

    const sorted = [...ranges].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    const merged = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
        const current = sorted[i];
        const last = merged[merged.length - 1];

        const currentStart = startOfDay(parseISO(current.start));
        const lastEnd = endOfDay(parseISO(last.end));

        if (currentStart <= addDays(lastEnd, 1)) {
            const currentEnd = endOfDay(parseISO(current.end));
            last.end = currentEnd > lastEnd ? current.end : last.end;
        } else {
            merged.push(current);
        }
    }
    return merged;
};

export const getBillingCycles = () => {
    const raw = localStorage.getItem(CYCLES_KEY);
    if (!raw) return [];
    let cycles = JSON.parse(raw);
    if (!Array.isArray(cycles)) return [];

    // Protect against 'Invalid Date' corruption in local storage crashing UI routines
    return cycles.filter(c =>
        c && c.start_date && c.end_date &&
        !c.start_date.includes("Invalid") && !c.end_date.includes("Invalid")
    );
};

export const saveBillingCycles = (cycles) => {
    localStorage.setItem(CYCLES_KEY, JSON.stringify(cycles));
};

export const getEntries = () => {
    const raw = localStorage.getItem(DB_KEY);
    return raw ? JSON.parse(raw) : [];
};

export const saveEntries = (entries) => {
    localStorage.setItem(DB_KEY, JSON.stringify(entries));
};

export const getPayments = () => {
    const raw = localStorage.getItem(PAYMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
};

export const savePayments = (payments) => {
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments));
};

export const addPayment = (cycleId, amount, dateStr, notes) => {
    const payments = getPayments();
    payments.push({
        id: uuidv4(),
        billing_cycle_id: cycleId,
        payment_date: dateStr,
        amount_paid: amount,
        notes: notes || '',
        previous_amount: null,
        edited_at: null
    });
    savePayments(payments);
};

export const updatePayment = (paymentId, newAmount) => {
    const payments = getPayments();
    const cycles = getBillingCycles();

    const paymentIndex = payments.findIndex(p => p.id === paymentId);
    if (paymentIndex === -1) return false;

    const payment = payments[paymentIndex];
    const cycle = cycles.find(c => c.id === payment.billing_cycle_id);

    if (cycle && cycle.is_locked) {
        alert("Cannot edit payment in a locked cycle.");
        return false;
    }

    if (payment.amount_paid !== newAmount) {
        payment.previous_amount = payment.amount_paid;
        payment.amount_paid = newAmount;
        payment.edited_at = new Date().toISOString();
        savePayments(payments);
        return true;
    }
    return false;
};

export const getPaymentsForCycle = (cycleId) => {
    const payments = getPayments();
    return payments.filter(p => p.billing_cycle_id === cycleId).sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
};

export const getActiveBillingCycle = () => {
    const settings = getSettings();
    const cycles = getBillingCycles();
    if (!settings.currentBillingCycleId) return null;
    return cycles.find(c => c.id === settings.currentBillingCycleId) || null;
};

// Rate resolution logic
export const getApplicableRate = (dateStr) => {
    const settings = getSettings();
    if (!settings.rateChanges || settings.rateChanges.length === 0) return settings.ratePerLiter;

    const sortedRates = [...settings.rateChanges].sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
    for (const change of sortedRates) {
        if (dateStr >= change.start_date) {
            return change.rate;
        }
    }
    return settings.ratePerLiter;
};

export const generateBillingCycle = (startDate = new Date()) => {
    const today = new Date();
    if (!startDate || startDate > today) return;

    const settings = getSettings();
    let cycles = getBillingCycles();
    let entries = getEntries();

    // Create new active cycle if none exists
    let activeCycle = cycles.find(c => c.id === settings.currentBillingCycleId);

    const start = startOfDay(startDate);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);

    if (!activeCycle) {
        activeCycle = {
            id: uuidv4(),
            start_date: format(start, 'yyyy-MM-dd'),
            end_date: format(end, 'yyyy-MM-dd'),
            opening_balance: 0,
            closing_balance: 0,
            is_locked: false,
            base_rate: settings.ratePerLiter
        };
        cycles.push(activeCycle);
        settings.currentBillingCycleId = activeCycle.id;
        saveSettings(settings);
        saveBillingCycles(cycles);
    }

    if (activeCycle.is_locked) return;

    // Step 1: Get active cycle dates
    const startStr = activeCycle.start_date;
    const endStr = activeCycle.end_date;

    // Step 2: Get today's date
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    // Step 3: Get last existing entry date inside current billing_cycle
    const cycleEntries = entries.filter(e => e.billing_cycle_id === activeCycle.id);
    let lastExistingDate = null;
    if (cycleEntries.length > 0) {
        lastExistingDate = cycleEntries.map(e => e.date).sort().pop();
    }

    // Step 4: For each date from (last_existing_date + 1) to today
    let currentLoopDate = lastExistingDate
        ? addDays(parseISO(lastExistingDate), 1)
        : parseISO(startStr);

    // Safety fallback: never backfill before cycle start
    if (format(currentLoopDate, 'yyyy-MM-dd') < startStr) {
        currentLoopDate = parseISO(startStr);
    }

    const todayObj = parseISO(todayStr);
    const endObj = parseISO(endStr);

    while (currentLoopDate <= todayObj && currentLoopDate <= endObj) {
        const dateStr = format(currentLoopDate, 'yyyy-MM-dd');

        // Check if entry already exists
        const exists = entries.some(e => e.date === dateStr && e.billing_cycle_id === activeCycle.id);

        if (!exists) {
            let isCancelled = false;
            for (const range of settings.cancelRanges) {
                const rangeStartStr = format(parseISO(range.start), 'yyyy-MM-dd');
                const rangeEndStr = format(parseISO(range.end), 'yyyy-MM-dd');
                if (dateStr >= rangeStartStr && dateStr <= rangeEndStr) {
                    isCancelled = true;
                    break;
                }
            }

            const applicableRate = activeCycle.base_rate !== undefined ? activeCycle.base_rate : getApplicableRate(dateStr);

            entries.push({
                id: uuidv4(),
                billing_cycle_id: activeCycle.id,
                date: dateStr,
                time_of_update: null,
                quantity: isCancelled ? 0 : settings.defaultQuantity,
                rate_used: applicableRate,
                total_amount: isCancelled ? 0 : (settings.defaultQuantity * applicableRate),
                is_modified: false,
                is_cancelled: isCancelled,
                change_log: []
            });
        }

        currentLoopDate = addDays(currentLoopDate, 1);
    }

    saveEntries(entries.sort((a, b) => a.date.localeCompare(b.date)));
};

export const updateTodayEntry = (quantityStr, mode) => {
    const entries = getEntries();
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const activeCycle = getActiveBillingCycle();

    if (activeCycle && activeCycle.is_locked) {
        alert("Current billing cycle is locked.");
        return null;
    }

    let entryIndex = entries.findIndex(e => e.date === todayStr && e.billing_cycle_id === activeCycle?.id);
    let entry;

    const qty = parseFloat(quantityStr);
    const nowTime = format(new Date(), 'HH:mm:ss');
    const applicableRate = activeCycle?.base_rate !== undefined ? activeCycle.base_rate : getApplicableRate(todayStr);

    if (entryIndex === -1 && activeCycle) {
        entry = {
            id: uuidv4(),
            billing_cycle_id: activeCycle.id,
            date: todayStr,
            time_of_update: nowTime,
            quantity: qty,
            rate_used: applicableRate,
            total_amount: qty * applicableRate,
            is_modified: true,
            is_cancelled: false,
            change_log: [{ time: nowTime, qty, action: 'created' }]
        };
        entries.push(entry);
    } else if (entryIndex !== -1) {
        entry = entries[entryIndex];

        const prevQty = entry.quantity;
        const newQty = mode === 'add' ? prevQty + qty : qty;

        entry.quantity = newQty;
        entry.time_of_update = nowTime;
        // Keep the historic rate if we are updating, or use applicable?
        // Instructions: rate_used per entry must remain immutable. But what if we overwrite today's quantity and the rate changed today? We'll update the total amount using the entry's ALREADY assigned rate. Wait, if it's the SAME day, applicable rate is the same anyway. 
        entry.total_amount = newQty * entry.rate_used;
        entry.is_modified = true;
        entry.is_cancelled = false;

        entry.change_log.push({
            time: nowTime,
            action: mode,
            added: qty,
            result: newQty
        });

        entries[entryIndex] = entry;
    }

    saveEntries(entries);
    return entry;
};

export const getTodayEntry = () => {
    const entries = getEntries();
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const activeCycle = getActiveBillingCycle();
    if (!activeCycle) return null;
    return entries.find(e => e.date === todayStr && e.billing_cycle_id === activeCycle.id) || null;
};

export const getCycleStats = (cycleId) => {
    const entries = getEntries();
    const cycles = getBillingCycles();
    const payments = getPayments();

    const cycle = cycles.find(c => c.id === cycleId);
    if (!cycle) return null;

    const cycleEntries = entries.filter(e => e.billing_cycle_id === cycleId);
    const cyclePayments = payments.filter(p => p.billing_cycle_id === cycleId);

    const totalLiters = cycleEntries.reduce((sum, e) => sum + e.quantity, 0);
    const totalBill = cycleEntries.reduce((sum, e) => sum + e.total_amount, 0);
    const totalPaid = cyclePayments.reduce((sum, p) => sum + parseFloat(p.amount_paid), 0);

    const pendingBalance = cycle.opening_balance + totalBill - totalPaid;

    const sortedPayments = [...cyclePayments].sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime());
    const lastPaymentDate = sortedPayments.length > 0 ? format(parseISO(sortedPayments[sortedPayments.length - 1].payment_date), 'dd/MM/yy') : 'N/A';

    let status = 'Unpaid';
    if (totalPaid >= cycle.opening_balance + totalBill) {
        status = 'Paid';
    } else if (totalPaid > 0) {
        status = 'Partial';
    }

    let safeCycleRange = 'Invalid Date Range';
    try {
        if (cycle.start_date && cycle.end_date && !cycle.start_date.includes("Invalid") && !cycle.end_date.includes("Invalid")) {
            safeCycleRange = `${format(parseISO(cycle.start_date), 'dd/MM/yy')} – ${format(parseISO(cycle.end_date), 'dd/MM/yy')}`;
        }
    } catch (e) { }

    return {
        totalLiters,
        totalBill,
        totalPaid,
        pendingBalance,
        openingBalance: cycle.opening_balance,
        lastPaymentDate,
        status,
        isLocked: cycle.is_locked,
        baseRate: cycle.base_rate,
        cycleRange: safeCycleRange
    };
};

export const getDashboardStats = () => {
    const activeCycle = getActiveBillingCycle();
    if (!activeCycle) {
        return {
            totalLiters: 0,
            totalBill: 0,
            totalPaid: 0,
            pendingBalance: 0,
            openingBalance: 0,
            lastPaymentDate: 'N/A',
            cycleRange: 'No active cycle',
            baseRate: 50,
            status: 'N/A'
        };
    }

    return getCycleStats(activeCycle.id);
};

export const closeBillingCycle = () => {
    const settings = getSettings();
    let cycles = getBillingCycles();
    const activeCycle = cycles.find(c => c.id === settings.currentBillingCycleId);
    if (!activeCycle) return;

    if (activeCycle.is_locked) return; // already locked

    const stats = getCycleStats(activeCycle.id);
    activeCycle.closing_balance = stats.pendingBalance;
    activeCycle.is_locked = true;

    // Snapshot Audit Fields
    activeCycle.snapshot_total_liters = stats.totalLiters;
    activeCycle.snapshot_total_bill = stats.totalBill;
    activeCycle.snapshot_total_paid = stats.totalPaid;
    activeCycle.snapshot_closing_balance = stats.pendingBalance;
    activeCycle.snapshot_created_at = new Date().toISOString();

    // Save cycle state
    saveBillingCycles(cycles);

    // Create next cycle dynamically aligned strictly to end of new current calendar month
    const nextStart = addDays(parseISO(activeCycle.end_date), 1);
    const nextEnd = new Date(nextStart.getFullYear(), nextStart.getMonth() + 1, 0);

    const nextCycle = {
        id: uuidv4(),
        start_date: format(nextStart, 'yyyy-MM-dd'),
        end_date: format(nextEnd, 'yyyy-MM-dd'),
        opening_balance: activeCycle.closing_balance,
        closing_balance: 0,
        is_locked: false,
        base_rate: settings.ratePerLiter
    };
    cycles.push(nextCycle);

    settings.currentBillingCycleId = nextCycle.id;
    saveBillingCycles(cycles);
    saveSettings(settings);

    // generateBillingCycle(nextStart); // Removed to prevent double backfill
};

export const unlockBillingCycle = (cycleId) => {
    let cycles = getBillingCycles();
    const cycleIndex = cycles.findIndex(c => c.id === cycleId);
    if (cycleIndex !== -1) {
        cycles[cycleIndex].is_locked = false;
        saveBillingCycles(cycles);
    }
};

