// ==========================================
// iPlug GQ – PWA, Easy Install & Offline
// ==========================================

class iPlugPWA {
    constructor() {
        this.deferredPrompt = null;
        this.isStandalone = this.checkIsStandalone();
        this.SAVED_EVENTS_KEY = 'iplug_saved_events';
        this.EVENT_REMINDERS_KEY = 'iplug_event_reminders';
        this.init();
    }

    init() {
        this.loadSavedData();
        this.registerServiceWorker();
        this.setupTopInstallBar();
        this.setupInstallPrompt();
        this.setupInstallModal();
    }

    checkIsStandalone() {
        return (
            window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true ||
            document.referrer.includes('android-app://')
        );
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./service-worker.js')
                    .then(reg => {
                        console.log('[iPlug PWA] Service Worker registered:', reg.scope);
                    })
                    .catch(err => {
                        console.warn('[iPlug PWA] Service Worker registration failed:', err);
                    });
            });
        }
    }

    loadSavedData() {
        try {
            this.savedEvents = JSON.parse(localStorage.getItem(this.SAVED_EVENTS_KEY)) || [];
            this.eventReminders = JSON.parse(localStorage.getItem(this.EVENT_REMINDERS_KEY)) || {};
        } catch {
            this.savedEvents = [];
            this.eventReminders = {};
        }
        this.updateSavedCounts();
    }

    isEventSaved(eventId) {
        return this.savedEvents.some(e => e.id == eventId);
    }

    saveEvent(event) {
        const index = this.savedEvents.findIndex(e => e.id == event.id);
        const isCurrentlySaved = index !== -1;

        if (!isCurrentlySaved) {
            this.savedEvents.push({
                ...event,
                savedAt: new Date().toISOString()
            });
            this.showNotification(`Saved "${event.title}" to My Events!`, 'success');
        } else {
            this.savedEvents.splice(index, 1);
            delete this.eventReminders[event.id];
            this.showNotification(`Removed "${event.title}" from My Events`, 'info');
        }

        this.persistStorage();
        this.updateSavedCounts();
        this.loadSavedEvents();
        return !isCurrentlySaved;
    }

    unsaveEvent(eventId) {
        this.savedEvents = this.savedEvents.filter(e => e.id != eventId);
        delete this.eventReminders[eventId];
        this.persistStorage();
        this.updateSavedCounts();
        this.loadSavedEvents();
        this.showNotification('Event removed from your list', 'info');

        document.querySelectorAll(`.save-btn[data-event-id="${eventId}"]`).forEach(btn => {
            btn.classList.remove('saved');
            btn.innerHTML = `<i class="far fa-heart"></i> <span>Save</span>`;
        });
    }

    removeReminder(eventId) {
        delete this.eventReminders[eventId];
        this.persistStorage();
        this.updateSavedCounts();
        this.loadSavedEvents();
        this.showNotification('Reminder canceled', 'info');
    }

    async setReminder(event, reminderType) {
        const reminderTimes = {
            '1day': 24 * 60 * 60 * 1000,
            '3hours': 3 * 60 * 60 * 1000,
            '1hour': 60 * 60 * 1000,
            '30min': 30 * 60 * 1000
        };

        const eventDate = new Date(`${event.date}T18:00:00`);
        const reminderMs = reminderTimes[reminderType] || (3 * 60 * 60 * 1000);
        const notificationTime = new Date(eventDate.getTime() - reminderMs);

        this.eventReminders[event.id] = {
            eventId: event.id,
            eventTitle: event.title,
            eventDate: event.date,
            reminderType,
            notificationTime: notificationTime.toISOString(),
            setAt: new Date().toISOString()
        };

        if (!this.isEventSaved(event.id)) {
            this.savedEvents.push({
                ...event,
                savedAt: new Date().toISOString()
            });
            document.querySelectorAll(`.save-btn[data-event-id="${event.id}"]`).forEach(btn => {
                btn.classList.add('saved');
                btn.innerHTML = `<i class="fas fa-heart"></i> <span>Saved</span>`;
            });
        }

        this.persistStorage();
        this.updateSavedCounts();
        this.loadSavedEvents();

        let permissionGranted = false;
        try {
            permissionGranted = await this.requestNotificationPermission();
        } catch (e) {
            console.error('Notification permission error:', e);
        }

        if (permissionGranted) {
            this.scheduleNotification(event, notificationTime);
            this.showNotification(`Reminder set for "${event.title}"!`, 'success');
        } else {
            this.showNotification(`Reminder saved to My Events list!`, 'info');
        }
    }

    persistStorage() {
        try {
            localStorage.setItem(this.SAVED_EVENTS_KEY, JSON.stringify(this.savedEvents));
            localStorage.setItem(this.EVENT_REMINDERS_KEY, JSON.stringify(this.eventReminders));
        } catch (e) {
            console.warn('LocalStorage error:', e);
        }
    }

    updateSavedCounts() {
        const count = this.savedEvents.length;
        const remindersCount = Object.keys(this.eventReminders).length;

        const savedCountEl = document.getElementById('saved-count');
        const remindersCountEl = document.getElementById('reminders-count');
        const badgeEl = document.getElementById('nav-saved-badge');

        if (savedCountEl) savedCountEl.textContent = count;
        if (remindersCountEl) remindersCountEl.textContent = remindersCount;

        if (badgeEl) {
            badgeEl.textContent = count;
            badgeEl.style.display = count > 0 ? 'inline-block' : 'none';
        }
    }

    loadSavedEvents() {
        const savedList = document.getElementById('saved-events-list');
        const remindersList = document.getElementById('reminders-list');

        if (savedList) {
            if (this.savedEvents.length === 0) {
                savedList.innerHTML = `<p class="no-saved"><i class="far fa-heart"></i><br>No saved gigs yet. Browse events and tap Save to build your weekend plans!</p>`;
            } else {
                savedList.innerHTML = this.savedEvents.map(event => {
                    const flyer = event.flyer ? `${event.flyer}?tr=w-160,h-160,f-auto` : 'https://ik.imagekit.io/vurvay/placeholder/IMG_9774.jpg';
                    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venueName}, ${event.location}, Gqeberha`)}`;
                    return `
                        <div class="saved-item" data-id="${event.id}">
                            <img src="${flyer}" alt="${this.escapeHtml(event.title)}" class="saved-img" onerror="this.src='https://ik.imagekit.io/vurvay/placeholder/IMG_9774.jpg'">
                            <div class="saved-info">
                                <h4>${this.escapeHtml(event.title)}</h4>
                                <p><i class="far fa-calendar"></i> ${event.date}</p>
                                <p><a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="color:var(--text-muted);"><i class="fas fa-location-dot"></i> ${this.escapeHtml(event.venueName)}</a></p>
                                <div style="display:flex; gap:8px; margin-top:auto; padding-top:6px;">
                                    <button onclick="window.iplugPWA.unsaveEvent(${event.id})" class="btn-remove">
                                        <i class="fas fa-trash-can"></i> Remove
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        if (remindersList) {
            const reminders = Object.values(this.eventReminders);
            if (reminders.length === 0) {
                remindersList.innerHTML = `<p class="no-reminders"><i class="far fa-bell"></i><br>No active reminders. Tap the bell icon on any event to get alerted before it starts!</p>`;
            } else {
                remindersList.innerHTML = reminders.map(reminder => {
                    return `
                        <div class="reminder-item" data-id="${reminder.eventId}">
                            <div class="reminder-info">
                                <h4>${this.escapeHtml(reminder.eventTitle)}</h4>
                                <p><i class="far fa-clock"></i> Reminder: <strong>${this.formatReminderType(reminder.reminderType)} before</strong></p>
                                <p><i class="far fa-calendar"></i> Event Date: ${reminder.eventDate}</p>
                                <div style="display:flex; gap:8px; margin-top:auto; padding-top:6px;">
                                    <button onclick="window.iplugPWA.removeReminder(${reminder.eventId})" class="btn-remove">
                                        <i class="fas fa-bell-slash"></i> Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        this.updateSavedCounts();
    }

    formatReminderType(type) {
        const types = {
            '1day': '1 day',
            '3hours': '3 hours',
            '1hour': '1 hour',
            '30min': '30 minutes'
        };
        return types[type] || type;
    }

    showReminderModal(event) {
        const existing = document.querySelector('.reminder-modal-overlay');
        if (existing) existing.remove();

        const modalHtml = `
            <div class="reminder-modal-overlay">
                <div class="reminder-modal">
                    <h3><i class="fas fa-bell"></i> Set Event Reminder</h3>
                    <p>Get notified before <strong>"${this.escapeHtml(event.title)}"</strong> kicks off:</p>
                    <div class="reminder-options">
                        <button class="reminder-option" data-time="1day">
                            <i class="far fa-clock"></i> 1 Day Before
                        </button>
                        <button class="reminder-option" data-time="3hours">
                            <i class="far fa-clock"></i> 3 Hours Before
                        </button>
                        <button class="reminder-option" data-time="1hour">
                            <i class="far fa-clock"></i> 1 Hour Before
                        </button>
                        <button class="reminder-option" data-time="30min">
                            <i class="far fa-clock"></i> 30 Mins Before
                        </button>
                    </div>
                    <button class="reminder-cancel" type="button">Cancel</button>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const overlay = document.querySelector('.reminder-modal-overlay');

        overlay.querySelectorAll('.reminder-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const time = btn.getAttribute('data-time');
                this.setReminder(event, time);
                overlay.remove();
            });
        });

        overlay.querySelector('.reminder-cancel')?.addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    }

    async requestNotificationPermission() {
        if (!('Notification' in window)) return false;
        if (Notification.permission === 'granted') return true;
        if (Notification.permission !== 'denied') {
            const status = await Notification.requestPermission();
            return status === 'granted';
        }
        return false;
    }

    scheduleNotification(event, notificationTime) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        const now = new Date();
        const diff = notificationTime.getTime() - now.getTime();

        if (diff > 0) {
            setTimeout(() => {
                this.showBrowserNotification(event);
            }, diff);
        }
    }

    showBrowserNotification(event) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        try {
            new Notification('iPlug GQ Gig Reminder', {
                body: `"${event.title}" at ${event.venueName} is coming up soon!`,
                icon: 'https://ik.imagekit.io/vurvay/iPlug%20GQ%20logo1.png?tr=w-192,h-192',
                tag: `iplug-reminder-${event.id}`
            });
        } catch (e) {
            console.warn('Could not trigger Notification:', e);
        }
    }

    showNotification(message, type = 'info') {
        const existing = document.querySelector('.pwa-notification');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `pwa-notification ${type}`;

        let iconClass = 'fa-info-circle';
        if (type === 'success') iconClass = 'fa-check-circle';
        else if (type === 'error') iconClass = 'fa-triangle-exclamation';

        toast.innerHTML = `
            <div class="notification-content">
                <i class="fas ${iconClass}"></i>
                <span>${this.escapeHtml(message)}</span>
            </div>
            <button class="notification-close" aria-label="Close notification">&times;</button>
        `;

        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));

        const timeout = setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 250);
        }, 3500);

        toast.querySelector('.notification-close').addEventListener('click', () => {
            clearTimeout(timeout);
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 250);
        });
    }

    // ==========================================
    // PWA INSTALLATION SYSTEM
    // ==========================================
    setupTopInstallBar() {
        const topBar = document.getElementById('top-pwa-bar');
        if (!topBar) return;

        // If running in installed PWA standalone mode or dismissed in this session
        if (this.isStandalone || sessionStorage.getItem('top_pwa_dismissed') === 'true') {
            topBar.style.display = 'none';
        } else {
            topBar.style.display = 'block';
        }

        const dismissBtn = document.getElementById('top-pwa-dismiss');
        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => {
                topBar.style.display = 'none';
                sessionStorage.setItem('top_pwa_dismissed', 'true');
            });
        }
    }

    setupInstallPrompt() {
        // If already running as installed PWA app, hide install bars & adjust body
        if (this.isStandalone) {
            document.body.classList.add('app-installed');
            document.documentElement.classList.add('app-installed');
            const navInstall = document.getElementById('app-install');
            if (navInstall) navInstall.style.display = 'none';
            const topBar = document.getElementById('top-pwa-bar');
            if (topBar) topBar.style.display = 'none';
            return;
        }

        // Attach to all install buttons
        document.querySelectorAll('#top-pwa-install-btn, #app-install, #feature-install, #install-btn, #mobile-menu-install').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.promptInstallation();
            });
        });

        // Capture Android / Chrome beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', e => {
            e.preventDefault();
            this.deferredPrompt = e;
            console.log('[iPlug PWA] Captured beforeinstallprompt event');

            // Make sure top installer bar is visible if not dismissed
            const topBar = document.getElementById('top-pwa-bar');
            if (topBar && !this.isStandalone && !sessionStorage.getItem('top_pwa_dismissed')) {
                topBar.style.display = 'block';
            }
        });

        // Listen for successful installation
        window.addEventListener('appinstalled', () => {
            this.isStandalone = true;
            this.deferredPrompt = null;
            document.body.classList.add('app-installed');
            document.documentElement.classList.add('app-installed');
            localStorage.setItem('iplug_app_installed', 'true');

            const topBar = document.getElementById('top-pwa-bar');
            if (topBar) topBar.style.display = 'none';
            const navInstall = document.getElementById('app-install');
            if (navInstall) navInstall.style.display = 'none';

            this.showNotification('🎉 iPlug GQ installed successfully!', 'success');
        });
    }

    promptInstallation() {
        // 1. Android / Chrome / Edge with deferred prompt
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            this.deferredPrompt.userChoice.then(({ outcome }) => {
                if (outcome === 'accepted') {
                    console.log('[iPlug PWA] User accepted installation prompt');
                    const topBar = document.getElementById('top-pwa-bar');
                    if (topBar) topBar.style.display = 'none';
                }
                this.deferredPrompt = null;
            });
            return;
        }

        // 2. iOS Safari (iPhone / iPad)
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) {
            this.showIOSInstallModal();
            return;
        }

        // 3. Android without deferredPrompt (e.g. Chrome, Samsung Internet)
        const isAndroid = /Android/i.test(navigator.userAgent);
        if (isAndroid) {
            this.showAndroidInstallModal();
            return;
        }

        // 4. Desktop Chrome / Edge / Safari fallback
        this.showDesktopInstallModal();
    }

    // ==========================================
    // INSTALL MODAL GUIDES (iOS / Android / Desktop)
    // ==========================================
    setupInstallModal() {
        const modal = document.getElementById('install-modal');
        if (!modal) return;

        modal.querySelector('.close-install-modal')?.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        modal.querySelector('.install-modal-close-btn')?.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    }

    showIOSInstallModal() {
        const modal = document.getElementById('install-modal');
        const container = document.getElementById('install-modal-instructions');
        if (!modal || !container) return;

        container.innerHTML = `
            <div class="install-step-list">
                <div class="install-step-item">
                    <div class="step-badge">1</div>
                    <div class="step-text">
                        <strong>Tap the Share button</strong> in Safari's bottom navigation bar
                        <span class="step-sub"><i class="fas fa-arrow-up-from-bracket" style="color:var(--primary);"></i> (Square icon with arrow pointing up)</span>
                    </div>
                </div>
                <div class="install-step-item">
                    <div class="step-badge">2</div>
                    <div class="step-text">
                        Scroll down and tap <strong>"Add to Home Screen"</strong>
                        <span class="step-sub"><i class="far fa-square-plus" style="color:var(--primary);"></i> Adds the iPlug GQ icon to your apps</span>
                    </div>
                </div>
                <div class="install-step-item">
                    <div class="step-badge">3</div>
                    <div class="step-text">
                        Tap <strong>"Add"</strong> in the top-right corner
                        <span class="step-sub">You're done! Enjoy 1-tap offline access.</span>
                    </div>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
    }

    showAndroidInstallModal() {
        const modal = document.getElementById('install-modal');
        const container = document.getElementById('install-modal-instructions');
        if (!modal || !container) return;

        container.innerHTML = `
            <div class="install-step-list">
                <div class="install-step-item">
                    <div class="step-badge">1</div>
                    <div class="step-text">
                        Tap the browser menu button <strong>(⋮ 3 dots)</strong> in the top-right corner
                    </div>
                </div>
                <div class="install-step-item">
                    <div class="step-badge">2</div>
                    <div class="step-text">
                        Select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>
                    </div>
                </div>
                <div class="install-step-item">
                    <div class="step-badge">3</div>
                    <div class="step-text">
                        Tap <strong>"Install"</strong> to confirm
                    </div>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
    }

    showDesktopInstallModal() {
        const modal = document.getElementById('install-modal');
        const container = document.getElementById('install-modal-instructions');
        if (!modal || !container) return;

        container.innerHTML = `
            <div class="install-step-list">
                <div class="install-step-item">
                    <div class="step-badge">1</div>
                    <div class="step-text">
                        Look at your browser's address bar at the top
                    </div>
                </div>
                <div class="install-step-item">
                    <div class="step-badge">2</div>
                    <div class="step-text">
                        Click the <strong>Install icon <i class="fas fa-arrow-down-to-bracket" style="color:var(--primary);"></i></strong> on the right side of the address bar
                    </div>
                </div>
                <div class="install-step-item">
                    <div class="step-badge">3</div>
                    <div class="step-text">
                        Click <strong>"Install"</strong> to add iPlug GQ to your desktop apps
                    </div>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, c => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[c]);
    }
}

// Initialize and mount globally
window.iplugPWA = new iPlugPWA();
