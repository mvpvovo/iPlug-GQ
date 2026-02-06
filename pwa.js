// PWA Installation and App Features
class iPlugPWA {
  constructor() {
    this.deferredPrompt = null;
    this.isInstalled = false;
    this.SAVED_EVENTS_KEY = 'iplug_saved_events';
    this.EVENT_REMINDERS_KEY = 'iplug_event_reminders';
    this.init();
  }

  init() {
    this.checkInstallation();
    this.registerServiceWorker();
    this.setupInstallPrompt();
    this.setupNavigation();
    this.loadSavedData();
  }

  // Check if app is installed
  checkInstallation() {
    if (window.matchMedia('(display-mode: standalone)').matches || 
        window.navigator.standalone === true) {
      this.isInstalled = true;
      document.body.classList.add('app-installed');
      console.log('Running as installed app');
    }
  }

  // Register Service Worker
  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
          .then(registration => {
            console.log('ServiceWorker registered:', registration.scope);
            
            // Check for updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  this.showUpdateNotification();
                }
              });
            });
          })
          .catch(err => console.log('ServiceWorker registration failed:', err));
      });
    }
  }

  // Setup Install Prompt
  setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      
      // Show install banner after 5 seconds
      setTimeout(() => {
        if (!this.isInstalled && this.deferredPrompt) {
          this.showInstallBanner();
        }
      }, 5000);
      
      // Manual install buttons
      document.querySelectorAll('#app-install, #feature-install').forEach(btn => {
        btn.addEventListener('click', () => this.promptInstallation());
      });
    });

    window.addEventListener('appinstalled', () => {
      this.isInstalled = true;
      this.deferredPrompt = null;
      document.body.classList.add('app-installed');
      this.hideInstallBanner();
      this.showNotification('App installed successfully!', 'success');
    });
  }

  // Show Install Banner
  showInstallBanner() {
    const banner = document.getElementById('install-banner');
    if (banner) {
      banner.style.display = 'block';
      
      document.getElementById('install-btn').addEventListener('click', () => {
        this.promptInstallation();
      });
      
      document.getElementById('dismiss-install').addEventListener('click', () => {
        banner.style.display = 'none';
        localStorage.setItem('install_banner_dismissed', 'true');
      });
    }
  }

  hideInstallBanner() {
    const banner = document.getElementById('install-banner');
    if (banner) banner.style.display = 'none';
  }

  // Prompt User to Install
  async promptInstallation() {
    if (!this.deferredPrompt) {
      this.showNotification('Your browser doesn\'t support app installation', 'error');
      return;
    }
    
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted install');
    } else {
      console.log('User dismissed install');
    }
    
    this.deferredPrompt = null;
    this.hideInstallBanner();
  }

  // Setup Navigation
  setupNavigation() {
    const savedLink = document.getElementById('saved-link');
    if (savedLink) {
      savedLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.showSavedEvents();
      });
    }
  }

  // Saved Events System
  loadSavedData() {
    this.savedEvents = JSON.parse(localStorage.getItem(this.SAVED_EVENTS_KEY)) || [];
    this.eventReminders = JSON.parse(localStorage.getItem(this.EVENT_REMINDERS_KEY)) || {};
    this.updateSavedCounts();
  }

  saveEvent(event) {
    const existingIndex = this.savedEvents.findIndex(e => e.id === event.id);
    
    if (existingIndex === -1) {
      this.savedEvents.push({
        ...event,
        savedAt: new Date().toISOString()
      });
      this.showNotification(`"${event.title}" saved!`, 'success');
    } else {
      this.savedEvents.splice(existingIndex, 1);
      delete this.eventReminders[event.id];
      this.showNotification(`"${event.title}" removed`, 'info');
    }
    
    this.saveToStorage();
    this.updateSavedCounts();
    return existingIndex === -1;
  }

  setReminder(event, reminderType) {
    const reminderTimes = {
      '1day': 24 * 60 * 60 * 1000,
      '3hours': 3 * 60 * 60 * 1000,
      '1hour': 60 * 60 * 1000,
      '30min': 30 * 60 * 1000
    };
    
    const eventDate = new Date(event.date);
    const reminderTime = reminderTimes[reminderType];
    const notificationTime = new Date(eventDate.getTime() - reminderTime);
    
    this.eventReminders[event.id] = {
      eventId: event.id,
      eventTitle: event.title,
      eventDate: event.date,
      reminderType: reminderType,
      notificationTime: notificationTime.toISOString(),
      setAt: new Date().toISOString()
    };
    
    this.saveToStorage();
    this.scheduleNotification(event, notificationTime);
    this.showNotification(`Reminder set for "${event.title}"`, 'success');
    this.updateSavedCounts();
  }

  removeReminder(eventId) {
    delete this.eventReminders[eventId];
    this.saveToStorage();
    this.updateSavedCounts();
    this.showNotification('Reminder removed', 'info');
  }

  saveToStorage() {
    localStorage.setItem(this.SAVED_EVENTS_KEY, JSON.stringify(this.savedEvents));
    localStorage.setItem(this.EVENT_REMINDERS_KEY, JSON.stringify(this.eventReminders));
  }

  updateSavedCounts() {
    const savedCount = document.getElementById('saved-count');
    const remindersCount = document.getElementById('reminders-count');
    
    if (savedCount) savedCount.textContent = this.savedEvents.length;
    if (remindersCount) remindersCount.textContent = Object.keys(this.eventReminders).length;
  }

  showSavedEvents() {
    document.querySelector('.events').style.display = 'none';
    document.querySelector('.saved-events').style.display = 'block';
    
    // Populate saved events list
    const savedList = document.getElementById('saved-events-list');
    const remindersList = document.getElementById('reminders-list');
    
    if (savedList) {
      savedList.innerHTML = this.savedEvents.length ? 
        this.savedEvents.map(event => this.createSavedEventCard(event)).join('') :
        '<p class="no-saved">No saved events yet. Browse events and click the heart icon to save!</p>';
    }
    
    if (remindersList) {
      const reminders = Object.values(this.eventReminders);
      remindersList.innerHTML = reminders.length ?
        reminders.map(reminder => this.createReminderCard(reminder)).join('') :
        '<p class="no-reminders">No reminders set. Click the bell icon on any event to set a reminder!</p>';
    }
  }

  createSavedEventCard(event) {
    return `
      <div class="saved-item">
        <img src="${event.flyer}" alt="${event.title}" class="saved-img">
        <div class="saved-info">
          <h4>${event.title}</h4>
          <p><i class="far fa-calendar"></i> ${new Date(event.date).toLocaleDateString()}</p>
          <p><i class="fas fa-map-marker-alt"></i> ${event.venue}</p>
          <button onclick="iplugPWA.unsaveEvent(${event.id})" class="btn-remove">
            <i class="fas fa-trash"></i> Remove
          </button>
        </div>
      </div>
    `;
  }

  createReminderCard(reminder) {
    const event = this.savedEvents.find(e => e.id === reminder.eventId);
    return `
      <div class="reminder-item">
        <div class="reminder-info">
          <h4>${reminder.eventTitle}</h4>
          <p><i class="far fa-clock"></i> Reminder: ${this.formatReminderType(reminder.reminderType)} before</p>
          <p><i class="far fa-calendar"></i> Event: ${new Date(reminder.eventDate).toLocaleDateString()}</p>
          ${event ? `<p><i class="fas fa-map-marker-alt"></i> ${event.venue}</p>` : ''}
          <button onclick="iplugPWA.removeReminder(${reminder.eventId})" class="btn-remove">
            <i class="fas fa-bell-slash"></i> Cancel Reminder
          </button>
        </div>
      </div>
    `;
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

  unsaveEvent(eventId) {
    this.savedEvents = this.savedEvents.filter(e => e.id !== eventId);
    this.removeReminder(eventId);
    this.saveToStorage();
    this.showSavedEvents();
  }

  scheduleNotification(event, notificationTime) {
    if ('Notification' in window && Notification.permission === 'granted') {
      const now = new Date();
      const timeUntilNotification = notificationTime.getTime() - now.getTime();
      
      if (timeUntilNotification > 0) {
        setTimeout(() => {
          this.showBrowserNotification(event);
        }, timeUntilNotification);
      }
    }
  }

  showBrowserNotification(event) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('iPlug GQ Reminder', {
        body: `"${event.title}" is coming up soon!`,
        icon: 'https://ik.imagekit.io/vurvay/iPlug%20GQ%20logo1.png',
        tag: `reminder-${event.id}`
      });
    }
  }

  requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          this.showNotification('Notifications enabled!', 'success');
        }
      });
    }
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

  showUpdateNotification() {
    this.showNotification('New version available! Refresh for updates.', 'info');
  }

  // Check if online/offline
  setupOnlineStatus() {
    window.addEventListener('online', () => {
      document.body.classList.remove('offline');
      this.showNotification('You\'re back online!', 'success');
    });
    
    window.addEventListener('offline', () => {
      document.body.classList.add('offline');
      this.showNotification('You\'re offline. Using cached content.', 'warning');
    });
  }
}

// Initialize PWA
const iplugPWA = new iPlugPWA();
window.iplugPWA = iplugPWA;

// Request notification permission on first interaction
document.addEventListener('click', () => {
  iplugPWA.requestNotificationPermission();
}, { once: true });