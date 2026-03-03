import { v4 as uuidv4 } from 'uuid';
import { format, addDays, parseISO } from 'date-fns';
import * as db from './db';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const runSimulation = async () => {
    console.log("Starting 12 Month Simulation...");

    // Clear everything
    localStorage.clear();

    // We need to override the native Date object to simulate time traveling
    const OriginalDate = window.Date;
    let mockedTime = new OriginalDate('2025-01-01T12:00:00Z').getTime();

    class MockDate extends OriginalDate {
        constructor(...args) {
            if (args.length === 0) {
                super(mockedTime);
            } else {
                super(...args);
            }
        }
        static now() {
            return mockedTime;
        }
    }

    window.Date = MockDate;

    try {
        // Init first cycle by calling generateBillingCycle
        db.generateBillingCycle();

        for (let cycleIndex = 1; cycleIndex <= 12; cycleIndex++) {
            console.log(`--- Simulating Cycle ${cycleIndex} ---`);

            const activeCycle = db.getActiveBillingCycle();
            if (!activeCycle) throw new Error("No active cycle found!");

            const startDay = parseISO(activeCycle.start_date);
            const endDay = parseISO(activeCycle.end_date);

            // For this cycle, let's pre-add some cancel ranges or rate changes
            if (cycleIndex === 3) {
                const settings = db.getSettings();
                settings.cancelRanges.push({
                    start: format(addDays(startDay, 5), 'yyyy-MM-dd'),
                    end: format(addDays(startDay, 10), 'yyyy-MM-dd')
                });
                db.saveSettings(settings);
            }
            if (cycleIndex === 6) {
                const settings = db.getSettings();
                settings.rateChanges.push({
                    start_date: format(addDays(startDay, 15), 'yyyy-MM-dd'),
                    rate: 55
                });
                db.saveSettings(settings);
            }

            // Advance time day by day
            let currentDay = startDay;

            while (currentDay <= endDay) {
                mockedTime = currentDay.getTime() + (12 * 60 * 60 * 1000); // 12 PM

                // Open app
                db.generateBillingCycle();

                const todayStr = format(currentDay, 'yyyy-MM-dd');

                // Randomly modify some days (approx 10% chance)
                if (Math.random() < 0.1) {
                    db.updateTodayEntry('2.5', 'overwrite');
                }

                // Add a payment occasionally (approx 5% chance)
                if (Math.random() < 0.05) {
                    db.addPayment(activeCycle.id, 200, todayStr, 'Simulated Payment');
                }

                currentDay = addDays(currentDay, 1);
            }

            // End of cycle, close it
            // Time is now at the end of the last day
            mockedTime = endDay.getTime() + (23 * 60 * 60 * 1000);
            db.closeBillingCycle();
        }

        console.log("Simulation finished successfully!");
    } catch (e) {
        console.error("Simulation failed:", e);
    } finally {
        // Restore orig date
        window.Date = OriginalDate;
    }
};
