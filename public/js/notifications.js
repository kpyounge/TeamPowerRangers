////////////////////////////////////////////////////////////////
//NOTIFICATIONS.JS
//BROWSER REMINDERS FOR HABIT STACKER.
//
//While the app is open in a browser tab, this checks the clock
//every 30 seconds. At each reminder time (see REMINDER_SCHEDULE)
//it loads the user's notification settings and habits from the
//server and, if the reminder applies, shows a browser
//notification:
//
//  1. Streak about to be lost - a habit with a streak of 3+ days
//     has not been checked off yet today  (setting: notify_streak_loss)
//  2. Log reminder - no habits have been checked off today
//                                           (setting: notify_log_reminder)
//  3. Missed habit - a stack still has unchecked habits when its
//     time block ends                       (setting: notify_missed_habit)
//
//If the user has not allowed notifications in their browser (or
//blocked them), the same reminders show up inside the app instead.
//
//Each reminder shows at most once a day. If the app is opened a
//little late, a reminder still shows up to GRACE_MINUTES (30)
//after its time, as long as it is still the same day. Anything
//later than that is skipped so the user is not buried in old reminders.
//
//This file works on its own: it only needs datamodel.js loaded
//first. Include it on any page that should show reminders.
////////////////////////////////////////////////////////////////
(function () {
    'use strict';

    //////////////////////////////////////////
    //SETTINGS - change these to change when reminders appear
    //Hours use a 24 hour clock in the user's own time zone
    //(21 = 9:00 PM).
    //////////////////////////////////////////
    const REMINDER_SCHEDULE = {
        streakHour: 21,          // 9 PM  - warn about streaks that are about to end
        logHour: 22,             // 10 PM - nothing has been logged today
        stackEndHours: {         // when each original stack's time block ends
            morning: 10,         // 10 AM
            afternoon: 15,       // 3 PM
            evening: 20,         // 8 PM
            night: 23            // 11 PM
        },
        otherStackEndHour: 20    // custom stacks (any other name): 8 PM
    };
    const STREAK_MIN_DAYS = 3;   // same as the flame on the dashboard
    const GRACE_MINUTES = 30;    // still remind if the app opens this many minutes late
    const CHECK_EVERY_MS = 30 * 1000;

    const STATE_KEY = 'habitStackerReminders';
    const BANNER_DISMISSED_KEY = 'habitStackerNotifBannerDismissed';

    let pollTimer = null;
    let checking = false;
    let memoryState = null;      // backup in case localStorage is unavailable

    //////////////////////////////////////////
    //SMALL HELPERS
    //////////////////////////////////////////
    function supported() {
        return 'Notification' in window;
    }

    // 'default' (not asked yet), 'granted', 'denied' or 'unsupported'
    function permission() {
        return supported() ? Notification.permission : 'unsupported';
    }

    function dateString(date) {
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${date.getFullYear()}-${month}-${day}`;
    }

    // Settings are on unless the user turned them off
    function isOn(value) {
        return value === undefined || value === null ? true : Boolean(value);
    }

    function joinNames(names) {
        const shown = names.slice(0, 3).join(', ');
        const extra = names.length - 3;
        return extra > 0 ? `${shown} and ${extra} more` : shown;
    }

    function getToken() {
        try {
            return localStorage.getItem('jwtToken');
        } catch (error) {
            return null;
        }
    }

    //////////////////////////////////////////
    //WHICH REMINDERS HAVE ALREADY BEEN HANDLED TODAY
    //Saved in the browser so a refresh (or a second tab) does not
    //show the same reminder twice. Resets every new day.
    //////////////////////////////////////////
    function readState(today) {
        try {
            const saved = JSON.parse(localStorage.getItem(STATE_KEY));
            if (saved && saved.date === today && Array.isArray(saved.handled)) {
                return saved;
            }
        } catch (error) {
            // fall through to the in-memory copy
        }
        if (memoryState && memoryState.date === today) {
            return { date: today, handled: memoryState.handled.slice() };
        }
        return { date: today, handled: [] };
    }

    function writeState(state) {
        memoryState = { date: state.date, handled: state.handled.slice() };
        try {
            localStorage.setItem(STATE_KEY, JSON.stringify(state));
        } catch (error) {
            // not a problem - memoryState still prevents repeats
        }
    }

    //////////////////////////////////////////
    //THE SCHEDULE
    //////////////////////////////////////////
    function allReminderHours() {
        const hours = new Set([
            REMINDER_SCHEDULE.streakHour,
            REMINDER_SCHEDULE.logHour,
            REMINDER_SCHEDULE.otherStackEndHour
        ]);
        Object.values(REMINDER_SCHEDULE.stackEndHours).forEach(hour => hours.add(hour));
        return Array.from(hours);
    }

    // True from the reminder time until GRACE_MINUTES later (never past midnight)
    function inWindow(hour, now) {
        const minutes = now.getHours() * 60 + now.getMinutes();
        const start = hour * 60;
        return minutes >= start && minutes <= Math.min(start + GRACE_MINUTES, 24 * 60 - 1);
    }

    function stackEndHour(stack) {
        const name = String(stack.stack_name || '').trim().toLowerCase();
        const known = Object.prototype.hasOwnProperty.call(REMINDER_SCHEDULE.stackEndHours, name);
        return known ? REMINDER_SCHEDULE.stackEndHours[name] : REMINDER_SCHEDULE.otherStackEndHour;
    }

    //////////////////////////////////////////
    //DECIDE WHICH REMINDERS APPLY
    //dueHours = the reminder hours that are due right now
    //Returns a list of { title, body, tag }
    //////////////////////////////////////////
    function buildReminders(user, habits, stacks, dueHours, today) {
        const reminders = [];

        // 1. Streak about to be lost
        if (dueHours.includes(REMINDER_SCHEDULE.streakHour) && isOn(user.notify_streak_loss)) {
            // A habit's streak counts the days up to yesterday until it is
            // checked today, so an unchecked habit with a streak is at risk
            const atRisk = habits
                .filter(habit => habit.streak >= STREAK_MIN_DAYS && !habit.completed)
                .sort((a, b) => b.streak - a.streak);

            if (atRisk.length === 1) {
                reminders.push({
                    title: `Don't lose your ${atRisk[0].streak}-day streak!`,
                    body: `Check off "${atRisk[0].name}" before the day ends.`,
                    tag: `habit-stacker-streak-${today}`
                });
            } else if (atRisk.length > 1) {
                reminders.push({
                    title: `${atRisk.length} streaks are about to end`,
                    body: joinNames(atRisk.map(habit => `${habit.name} (${habit.streak} days)`)),
                    tag: `habit-stacker-streak-${today}`
                });
            }
        }

        // 2. Nothing logged today
        if (dueHours.includes(REMINDER_SCHEDULE.logHour) && isOn(user.notify_log_reminder)) {
            if (habits.length > 0 && habits.every(habit => !habit.completed)) {
                reminders.push({
                    title: "Don't forget to log your habits",
                    body: "You haven't checked off any habits today. Take a minute to log them!",
                    tag: `habit-stacker-log-${today}`
                });
            }
        }

        // 3. A stack's time block ended with habits still unchecked
        if (isOn(user.notify_missed_habit)) {
            stacks.forEach(stack => {
                if (!dueHours.includes(stackEndHour(stack))) {
                    return;
                }
                const missed = habits.filter(habit =>
                    Number(habit.stack_id) === Number(stack.stack_id) && !habit.completed
                );
                if (missed.length > 0) {
                    reminders.push({
                        title: `You still have habits left in ${stack.stack_name}`,
                        body: joinNames(missed.map(habit => habit.name)),
                        tag: `habit-stacker-missed-${stack.stack_id}-${today}`
                    });
                }
            });
        }

        return reminders;
    }

    //////////////////////////////////////////
    //THE CHECK THAT RUNS EVERY 30 SECONDS
    //////////////////////////////////////////
    async function checkReminders() {
        if (checking) {
            return;
        }

        const token = getToken();
        if (!token) {
            stopPolling(); // logged out
            return;
        }

        const now = new Date();
        const today = dateString(now);
        const state = readState(today);

        const dueHours = allReminderHours().filter(hour =>
            inWindow(hour, now) && !state.handled.includes(hour)
        );
        if (dueHours.length === 0) {
            return; // nothing is due, so no need to contact the server
        }

        // Claim these hours first so another tab (or the next check) does not repeat them
        checking = true;
        state.handled.push(...dueHours);
        writeState(state);

        try {
            DataModel.setToken(token);
            const [user, habitsResult, stacksResult] = await Promise.all([
                DataModel.getCurrentUser(),
                DataModel.getHabits(today),
                DataModel.getStacks()
            ]);

            if (!habitsResult.ok && (habitsResult.status === 401 || habitsResult.status === 403)) {
                stopPolling(); // login expired - the page will send the user to log in
                return;
            }
            if (!user || !habitsResult.ok) {
                throw new Error('Could not load reminder data.');
            }

            const stacks = stacksResult.ok ? stacksResult.data.stacks : [];
            buildReminders(user, habitsResult.data.habits, stacks, dueHours, today).forEach(showReminder);
        } catch (error) {
            // Could not reach the server: give the hours back so the next check retries
            const retry = readState(today);
            retry.handled = retry.handled.filter(hour => !dueHours.includes(hour));
            writeState(retry);
        } finally {
            checking = false;
        }
    }

    function startPolling() {
        if (pollTimer) {
            return;
        }
        checkReminders();
        pollTimer = setInterval(checkReminders, CHECK_EVERY_MS);
    }

    function stopPolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    //////////////////////////////////////////
    //SHOWING A REMINDER
    //A browser notification if the user allowed them, otherwise a
    //pop-up inside the page.
    //////////////////////////////////////////
    function openApp() {
        if (!/dashboard/.test(window.location.pathname)) {
            window.location.href = '/dashboard';
        }
    }

    function showReminder(reminder) {
        if (permission() === 'granted') {
            try {
                const notification = new Notification(reminder.title, {
                    body: reminder.body,
                    tag: reminder.tag
                });
                notification.onclick = () => {
                    window.focus();
                    notification.close();
                    openApp();
                };
                return;
            } catch (error) {
                // Some browsers (e.g. Chrome on Android) do not allow this -
                // fall back to the in-app pop-up below
            }
        }
        showToast(reminder);
    }

    function showToast(reminder) {
        addStyles();

        let box = document.getElementById('hsToastBox');
        if (!box) {
            box = document.createElement('div');
            box.id = 'hsToastBox';
            box.className = 'hs-toast-box';
            document.body.appendChild(box);
        }

        const toast = document.createElement('div');
        toast.className = 'hs-toast';
        toast.setAttribute('role', 'status');

        const text = document.createElement('div');
        text.className = 'hs-toast-text';
        const title = document.createElement('strong');
        title.textContent = reminder.title;
        const body = document.createElement('span');
        body.textContent = reminder.body;
        text.appendChild(title);
        text.appendChild(body);
        text.addEventListener('click', () => {
            toast.remove();
            openApp();
        });

        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'hs-toast-close';
        close.setAttribute('aria-label', 'Dismiss reminder');
        close.textContent = '×';
        close.addEventListener('click', () => toast.remove());

        toast.appendChild(text);
        toast.appendChild(close);
        box.appendChild(toast);

        setTimeout(() => toast.remove(), 20000);
    }

    //////////////////////////////////////////
    //ASKING FOR PERMISSION
    //Browsers only allow this from a click, so it is tied to buttons.
    //Resolves to 'granted', 'denied', 'default' or 'unsupported'.
    //If the user clicks Block, the browser will never ask again -
    //they have to change it in the browser's site settings.
    //////////////////////////////////////////
    async function askPermission() {
        if (!supported()) {
            return 'unsupported';
        }
        try {
            return await new Promise(resolve => {
                // Older browsers use a callback, newer ones return a promise
                const result = Notification.requestPermission(resolve);
                if (result && typeof result.then === 'function') {
                    result.then(resolve);
                }
            });
        } catch (error) {
            return permission();
        }
    }

    //////////////////////////////////////////
    //BANNER (Dashboard / Progress pages)
    //Offers to turn on browser notifications until the user chooses
    //Turn on or Not now.
    //////////////////////////////////////////
    async function maybeShowBanner() {
        if (document.getElementById('browserNotifStatus')) {
            return; // the Profile page has its own controls
        }
        if (permission() !== 'default') {
            return;
        }
        try {
            if (localStorage.getItem(BANNER_DISMISSED_KEY) === '1') {
                return;
            }
        } catch (error) {
            // ignore - the banner just shows again next time
        }

        const token = getToken();
        if (!token) {
            return;
        }
        DataModel.setToken(token);
        const user = await DataModel.getCurrentUser();
        if (!user) {
            return;
        }
        // No point asking if every reminder is turned off
        if (!isOn(user.notify_streak_loss) && !isOn(user.notify_log_reminder) && !isOn(user.notify_missed_habit)) {
            return;
        }

        addStyles();

        const banner = document.createElement('div');
        banner.className = 'hs-banner';
        banner.setAttribute('role', 'region');
        banner.setAttribute('aria-label', 'Reminders');

        const text = document.createElement('span');
        text.className = 'hs-banner-text';
        text.textContent = 'Turn on browser notifications to get habit reminders.';

        const turnOn = document.createElement('button');
        turnOn.type = 'button';
        turnOn.className = 'hs-notif-btn';
        turnOn.textContent = 'Turn on';

        const notNow = document.createElement('button');
        notNow.type = 'button';
        notNow.className = 'hs-notif-btn hs-notif-btn-quiet';
        notNow.textContent = 'Not now';

        turnOn.addEventListener('click', async () => {
            const result = await askPermission();
            banner.remove();
            if (result === 'denied') {
                showToast({
                    title: 'Notifications are blocked',
                    body: 'Reminders will show up inside the app instead. You can change this in your browser settings.'
                });
            }
        });

        notNow.addEventListener('click', () => {
            try {
                localStorage.setItem(BANNER_DISMISSED_KEY, '1');
            } catch (error) {
                // ignore
            }
            banner.remove();
        });

        banner.appendChild(text);
        banner.appendChild(turnOn);
        banner.appendChild(notNow);

        // Put it at the top of the page, under the light / dark mode row
        const themeRow = document.querySelector('.theme-toggle-row');
        if (themeRow) {
            themeRow.insertAdjacentElement('afterend', banner);
        } else {
            document.body.prepend(banner);
        }
    }

    //////////////////////////////////////////
    //PROFILE PAGE CONTROLS
    //Shows whether browser notifications are on, with a button to
    //turn them on and a test button. Does nothing on other pages.
    //////////////////////////////////////////
    const STATUS_MESSAGES = {
        unsupported: "This browser doesn't support notifications. Reminders will show up inside the app instead.",
        default: 'Browser notifications are off. Turn them on to get reminders even when you are in another tab or window.',
        granted: 'Browser notifications are on.',
        denied: "Browser notifications are blocked for this site. To turn them on, allow notifications in your browser's site settings (click the icon next to the address), then reload. Until then, reminders show up inside the app."
    };

    function renderPermissionStatus() {
        const status = document.getElementById('browserNotifStatus');
        if (!status) {
            return;
        }
        const state = permission();
        status.textContent = STATUS_MESSAGES[state];

        const turnOn = document.getElementById('browserNotifButton');
        const test = document.getElementById('browserNotifTestButton');
        if (turnOn) {
            turnOn.hidden = state !== 'default';
        }
        if (test) {
            test.hidden = state !== 'granted';
        }
    }

    function setupProfileControls() {
        if (!document.getElementById('browserNotifStatus')) {
            return;
        }
        addStyles();

        const turnOn = document.getElementById('browserNotifButton');
        const test = document.getElementById('browserNotifTestButton');

        if (turnOn) {
            turnOn.addEventListener('click', async () => {
                await askPermission();
                renderPermissionStatus();
            });
        }
        if (test) {
            test.addEventListener('click', () => {
                showReminder({
                    title: 'Habit Stacker',
                    body: 'Notifications are working! This is what your reminders will look like.',
                    tag: 'habit-stacker-test'
                });
            });
        }

        renderPermissionStatus();

        // Update right away if the user changes the setting in the browser
        try {
            navigator.permissions.query({ name: 'notifications' }).then(result => {
                result.onchange = renderPermissionStatus;
            }).catch(() => {});
        } catch (error) {
            // older browsers - the status updates the next time the page loads
        }
    }

    //////////////////////////////////////////
    //STYLES (added by this file so no CSS edits are needed)
    //////////////////////////////////////////
    function addStyles() {
        if (document.getElementById('hsNotifStyles')) {
            return;
        }
        const style = document.createElement('style');
        style.id = 'hsNotifStyles';
        style.textContent = `
            .hs-banner {
                display: flex; align-items: center; flex-wrap: wrap; gap: 10px;
                width: 90%; max-width: 700px; box-sizing: border-box;
                margin: 12px auto 0; padding: 12px 16px;
                background: #5E57FF; color: #FFFFFF; border-radius: 16px;
                font-size: 0.95rem;
            }
            .hs-banner-text { flex: 1 1 220px; }
            .hs-notif-btn {
                padding: 8px 16px; border: 2px solid #FFFFFF; border-radius: 20px;
                background: #FFFFFF; color: #3B35C9; font-weight: 700;
                font-size: 0.85rem; cursor: pointer;
            }
            .hs-notif-btn-quiet { background: transparent; color: #FFFFFF; }
            .hs-notif-btn[hidden] { display: none; }
            .browser-permission-row { flex-wrap: wrap; }
            .browser-notif-actions { display: flex; gap: 8px; flex-wrap: wrap; }
            .hs-toast-box {
                position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%);
                z-index: 1200; width: 92%; max-width: 420px;
                display: flex; flex-direction: column; gap: 10px;
            }
            .hs-toast {
                display: flex; align-items: flex-start; gap: 10px;
                padding: 14px 16px; border-radius: 16px;
                background: #5E57FF; color: #FFFFFF;
                box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
                border: 2px solid #FFFFFF;
            }
            .hs-toast-text { flex: 1; display: flex; flex-direction: column; gap: 4px; cursor: pointer; }
            .hs-toast-text span { font-size: 0.9rem; }
            .hs-toast-close {
                background: none; border: none; color: #FFFFFF;
                font-size: 1.5rem; line-height: 1; cursor: pointer; padding: 0 4px;
            }
        `;
        document.head.appendChild(style);
    }

    //////////////////////////////////////////
    //START
    //////////////////////////////////////////
    document.addEventListener('DOMContentLoaded', () => {
        setupProfileControls();
        if (!getToken()) {
            return; // not logged in
        }
        maybeShowBanner();
        startPolling();
    });
})();