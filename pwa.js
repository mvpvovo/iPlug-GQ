// iPlug GQ PWA Functionality
class iPlugPWA {
    constructor() {
        this.SAVED_EVENTS_KEY = 'iplug_saved_events';
        this.EVENT_REMINDERS_KEY = 'iplug_event_reminders';
        this.savedEvents = [];
        this.eventReminders = {};
        this.init();
    }

    init() {
        this.loadSavedData();
        this.setupInstallPrompt();
        this.updateSavedCounts();
        
        // Setup notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    loadSavedData() {
        try {
            this.savedEvents = JSON.parse(localStorage.getItem(this.SAVED_EVENTS_KEY)) || [];
            this.eventReminders = JSON.parse(localStorage.getItem(this.EVENT_REMINDERS_KEY)) || {};
        } catch (e) {
            console.log('Error loading saved data:', e);
            this.savedEvents = [];
            this.eventReminders = {};
        }
    }

    saveEvent(event) {
        // Check if event already saved
        const existingIndex = this.savedEvents.findIndex(e => e.id == event.id);
        
        if (existingIndex === -1) {
            // Save event
            this.savedEvents.push({
                ...event,
                savedAt: new Date().toISOString()
            });
            this.showNotification(`"${event.title}" saved!`, 'success');
        } else {
            // Remove event
            this.savedEvents.splice(existingIndex, 1);
            
            // Also remove any reminders
            delete this.eventReminders[event.id];
            
            this.showNotification(`"${event.title}" removed from saved`, 'info');
        }
        
        // Save to localStorage
        this.saveToStorage();
        this.updateSavedCounts();
        
        // Return true if saved, false if removed
        return existingIndex === -1;
    }

    isEventSaved(eventId) {
        return this.savedEvents.some(event => event.id == eventId);
    }

    showReminderModal(event) {
        // Create modal overlay
        const modalHtml = `
            <div class="reminder-modal-overlay">
                <div class="reminder-modal">
                    <h3><i class="fas fa-bell"></i> Set Reminder</h3>
                    <p>For "${event.title}"</p>
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
                            <i class="far fa-clock"></i> 30 Minutes Before
                        </button>
                    </div>
                    <button class="reminder-cancel">Cancel</button>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Setup event handlers
        const modal = document.querySelector('.reminder-modal-overlay');
        
        // Reminder option clicks
        modal.querySelectorAll('.reminder-option').forEach(option => {
            option.addEventListener('click', () => {
                const time = option.getAttribute('data-time');
                this.setReminder(event, time);
                modal.remove();
            });
        });
        
        // Cancel button
        modal.querySelector('.reminder-cancel').addEventListener('click', () => {
            modal.remove();
        });
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    setReminder(event, reminderType) {
        // Calculate reminder time
        const eventDate = new Date(event.date);
        let reminderTime = new Date(eventDate);
        
        switch(reminderType) {
            case '1day':
                reminderTime.setDate(reminderTime.getDate() - 1);
                break;
            case '3hours':
                reminderTime.setHours(reminderTime.getHours() - 3);
                break;
            case '1hour':
                reminderTime.setHours(reminderTime.getHours() - 1);
                break;
            case '30min':
                reminderTime.setMinutes(reminderTime.getMinutes() - 30);
                break;
        }
        
        // Save reminder
        this.eventReminders[event.id] = {
            eventId: event.id,
            eventTitle: event.title,
            eventDate: event.date,
            reminderType: reminderType,
            reminderTime: reminderTime.toISOString(),
            setAt: new Date().toISOString()
        };
        
        this.saveToStorage();
        this.updateSavedCounts();
        this.showNotification(`Reminder set for "${event.title}"`, 'success');
        
        // Schedule notification if supported
        if ('Notification' in window && Notification.permission === 'granted') {
            const timeUntil = reminderTime.getTime() - Date.now();
            if (timeUntil > 0) {
                setTimeout(() => {
                    this.sendNotification(event);
                }, timeUntil);
            }
        }
    }

    sendNotification(event) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('iPlug GQ Reminder', {
                body: `"${event.title}" is coming up soon!`,
                icon: 'https://ik.imagekit.io/vurvay/iPlug%20GQ%20logo1.png'
            });
        }
    }

    removeReminder(eventId) {
        delete this.eventReminders[eventId];
        this.saveToStorage();
        this.updateSavedCounts();
        this.showNotification('Reminder removed', 'info');
    }

    saveToStorage() {
        try {
            localStorage.setItem(this.SAVED_EVENTS_KEY, JSON.stringify(this.savedEvents));
            localStorage.setItem(this.EVENT_REMINDERS_KEY, JSON.stringify(this.eventReminders));
        } catch (e) {
            console.log('Error saving to storage:', e);
        }
    }

    updateSavedCounts() {
        const savedCount = document.getElementById('saved-count');
        const remindersCount = document.getElementById('reminders-count');
        
        if (savedCount) {
            savedCount.textContent = this.savedEvents.length;
        }
        
        if (remindersCount) {
            remindersCount.textContent = Object.keys(this.eventReminders).length;
        }
    }

    loadSavedEvents() {
        const savedList = document.getElementById('saved-events-list');
        const remindersList = document.getElementById('reminders-list');
        
        // Display saved events
        if (savedList) {
            if (this.savedEvents.length > 0) {
                savedList.innerHTML = this.savedEvents.map(event => `
                    <div class="saved-item">
                        <img src="${event.flyer}" alt="${event.title}" class="saved-img">
                        <div class="saved-info">
                            <h4>${event.title}</h4>
                            <p><i class="far fa-calendar"></i> ${new Date(event.date).toLocaleDateString()}</p>
                            <p><i class="fas fa-map-marker-alt"></i> ${event.venue}</p>
                            <button class="btn-remove" data-event-id="${event.id}">
                                <i class="fas fa-trash"></i> Remove
                            </button>
                        </div>
                    </div>
                `).join('');
                
                // Add remove button handlers
                savedList.querySelectorAll('.btn-remove').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const eventId = btn.getAttribute('data-event-id');
                        this.saveEvent({ id: eventId, title: '' }); // Just need the ID to remove
                        this.loadSavedEvents(); // Refresh the list
                    });
                });
            } else {
                savedList.innerHTML = '<p class="no-saved">No saved events yet. Browse events and click the heart icon to save!</p>';
            }
        }
        
        // Display reminders
        if (remindersList) {
            const reminders = Object.values(this.eventReminders);
            if (reminders.length > 0) {
                remindersList.innerHTML = reminders.map(reminder => `
                    <div class="reminder-item">
                        <div class="reminder-info">
                            <h4>${reminder.eventTitle}</h4>
                            <p><i class="far fa-clock"></i> ${this.formatReminderTime(reminder.reminderType)} before</p>
                            <p><i class="far fa-calendar"></i> Event: ${new Date(reminder.eventDate).toLocaleDateString()}</p>
                            <button class="btn-remove" data-event-id="${reminder.eventId}">
                                <i class="fas fa-bell-slash"></i> Cancel Reminder
                            </button>
                        </div>
                    </div>
                `).join('');
                
                // Add remove reminder handlers
                remindersList.querySelectorAll('.btn-remove').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const eventId = btn.getAttribute('data-event-id');
                        this.removeReminder(eventId);
                        this.loadSavedEvents(); // Refresh the list
                    });
                });
            } else {
                remindersList.innerHTML = '<p class="no-reminders">No reminders set. Click the bell icon on any event to set a reminder!</p>';
            }
        }
        
        this.updateSavedCounts();
    }

    formatReminderTime(reminderType) {
        const times = {
            '1day': '1 day',
            '3hours': '3 hours',
            '1hour': '1 hour',
            '30min': '30 minutes'
        };
        return times[reminderType] || reminderType;
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `pwa-notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close">&times;</button>
        `;
        
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
        
        // Close button
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        });
    }

    setupInstallPrompt() {
        let deferredPrompt;
        
        // Install banner
        const installBanner = document.getElementById('install-banner');
        const installBtn = document.getElementById('install-btn');
        const dismissBtn = document.getElementById('dismiss-install');
        const appInstallBtn = document.getElementById('app-install');
        const featureInstallBtn = document.getElementById('feature-install');
        
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            
            // Show banner after delay
            setTimeout(() => {
                if (installBanner && !localStorage.getItem('installDismissed')) {
                    installBanner.style.display = 'block';
                }
            }, 3000);
        });
        
        // Install button handlers
        if (installBtn) {
            installBtn.addEventListener('click', async () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    if (outcome === 'accepted') {
                        console.log('User installed the app');
                        if (installBanner) installBanner.style.display = 'none';
                    }
                    deferredPrompt = null;
                }
            });
        }
        
        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => {
                if (installBanner) {
                    installBanner.style.display = 'none';
                    localStorage.setItem('installDismissed', 'true');
                }
            });
        }
        
        if (appInstallBtn) {
            appInstallBtn.addEventListener('click', () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                } else {
                    this.showNotification('Use browser menu to install (⋮ → "Add to Home Screen")', 'info');
                }
            });
        }
        
        if (featureInstallBtn) {
            featureInstallBtn.addEventListener('click', () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                } else {
                    this.showNotification('Use browser menu to install (⋮ → "Add to Home Screen")', 'info');
                }
            });
        }
        
        window.addEventListener('appinstalled', () => {
            deferredPrompt = null;
            if (installBanner) installBanner.style.display = 'none';
            this.showNotification('App installed successfully!', 'success');
        });
    }
}

// Initialize PWA when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.iplugPWA = new iPlugPWA();
});

