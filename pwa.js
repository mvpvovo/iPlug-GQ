// ==========================================
// iPlug GQ – PWA, Saved Events & Offline
// ==========================================

class iPlugPWA {
    constructor() {
        this.deferredPrompt = null;
        this.isInstalled = false;
        this.SAVED_EVENTS_KEY = 'iplug_saved_events';
        this.EVENT_REMINDERS_KEY = 'iplug_event_reminders';
        this.init();
    }

    init() {
        this.loadSavedData();
        this.setupInstallPrompt();
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

        // Also update any card button in the view
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

        // If not already in saved events, automatically save it
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

    setupInstallPrompt() {
        document.querySelectorAll('#app-install, #feature-install').forEach(btn => {
            btn.addEventListener('click', () => this.promptInstallation());
        });

        window.addEventListener('beforeinstallprompt', e => {
            e.preventDefault();
            this.deferredPrompt = e;

            setTimeout(() => {
                if (!this.isInstalled && this.deferredPrompt && !localStorage.getItem('install_dismissed')) {
                    this.showInstallBanner();
                }
            }, 3000);
        });

        window.addEventListener('appinstalled', () => {
            this.isInstalled = true;
            this.deferredPrompt = null;
            this.hideInstallBanner();
            this.showNotification('iPlug GQ added to Home Screen!', 'success');
        });
    }

    showInstallBanner() {
        const banner = document.getElementById('install-banner');
        if (banner) {
            banner.style.display = 'block';
            document.getElementById('install-btn')?.addEventListener('click', () => {
                this.promptInstallation();
            });
            document.getElementById('dismiss-install')?.addEventListener('click', () => {
                banner.style.display = 'none';
                localStorage.setItem('install_dismissed', 'true');
            });
        }
    }

    hideInstallBanner() {
        const banner = document.getElementById('install-banner');
        if (banner) banner.style.display = 'none';
    }

    async promptInstallation() {
        if (!this.deferredPrompt) {
            this.showNotification('To install, open browser menu (⋮ or Share) and tap "Add to Home Screen"', 'info');
            return;
        }

        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            this.isInstalled = true;
        }
        this.deferredPrompt = null;
        this.hideInstallBanner();
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
