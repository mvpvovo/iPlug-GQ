// ======================
// iPlug GQ – MAIN SCRIPT
// ======================
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('current-year').textContent = new Date().getFullYear();

    // Mobile menu toggle
    const menuToggle = document.querySelector('.menu-toggle');
    const navUl = document.querySelector('nav ul');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            navUl.classList.toggle('show');
            const icon = menuToggle.querySelector('i');
            if (navUl.classList.contains('show')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });
    }

    // Close mobile menu when clicking a link (except saved link)
    document.querySelectorAll('nav a').forEach(link => {
        link.addEventListener('click', function(e) {
            if (this.getAttribute('href') === '#saved') return;
            navUl.classList.remove('show');
            if (menuToggle) {
                menuToggle.querySelector('i').classList.remove('fa-times');
                menuToggle.querySelector('i').classList.add('fa-bars');
            }
        });
    });

    loadEvents();
    setupForm();
    setupNavigation();
    setupLightbox();
    setupEventHandlers();

    // Deep linking: check for ?event=ID
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('event');
    if (eventId) {
        waitForEventCard(eventId);
    }

    checkHash();
});

// ======================
// HELPER: Check if event date has passed (based on local date)
// ======================
function isEventPassed(dateString) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    return dateString < todayStr; // event date earlier than today → passed
}

// ======================
// DATA LOADING & DISPLAY
// ======================
function loadEvents() {
    fetch('events.json')
        .then(response => response.json())
        .then(venues => {
            // Flatten all events
            let allEvents = venues.flatMap(venue =>
                venue.events.map(event => ({
                    ...event,
                    venueName: venue.venueName,
                    location: venue.location
                }))
            );

            // 🔥 FILTER OUT PAST EVENTS
            allEvents = allEvents.filter(event => !isEventPassed(event.date));

            window.allEvents = allEvents;
            window.venuesData = venues;
            displayGroupedEvents(window.allEvents);
        })
        .catch(error => {
            console.error('Error loading events:', error);
            document.getElementById('events-container').innerHTML = `
                <div class="no-events">
                    <p>Unable to load events. Please check back soon or submit your event!</p>
                    <p><small>Error: ${error.message}</small></p>
                </div>
            `;
        });
}

function displayGroupedEvents(events) {
    const container = document.getElementById('events-container');
    if (!container) return;

    if (events.length === 0) {
        container.innerHTML = '<div class="no-events">No events this week.</div>';
        return;
    }

    // Group by venueName (using flattened events)
    const grouped = {};
    events.forEach(event => {
        const key = event.venueName;
        if (!grouped[key]) {
            grouped[key] = {
                venueName: event.venueName,
                location: event.location,
                events: []
            };
        }
        grouped[key].events.push(event);
    });

    let html = '';
    const sortedVenues = Object.values(grouped).sort((a, b) => {
        const aDate = a.events[0].date;
        const bDate = b.events[0].date;
        return new Date(aDate) - new Date(bDate);
    });

    sortedVenues.forEach(venue => {
        html += `
            <div class="venue-group" data-venue="${venue.venueName}">
                <div class="venue-header">
                    <h3><i class="fas fa-map-marker-alt"></i> ${venue.venueName}</h3>
                    <span class="venue-location">${venue.location}</span>
                </div>
                <div class="venue-events-grid">
        `;

        venue.events.sort((a, b) => new Date(a.date) - new Date(b.date));
        venue.events.forEach(event => {
            const isSaved = window.iplugPWA?.isEventSaved(event.id) || false;
            html += `
                <div class="event-card" data-category="${event.category}" data-id="${event.id}">
                    <img src="${event.flyer}" alt="${event.title} flyer" class="event-img" onerror="this.src='https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80'">
                    <div class="event-info">
                        <span class="event-date"><i class="far fa-calendar"></i> ${formatDate(event.date)}</span>
                        <h4 class="event-title">${event.title}</h4>
                        <p class="event-venue"><i class="fas fa-map-marker-alt"></i> ${venue.venueName}</p>
                        <p class="event-description">${event.description}</p>
                        <div class="event-actions">
                            <button class="save-btn ${isSaved ? 'saved' : ''}" data-event-id="${event.id}">
                                <i class="${isSaved ? 'fas' : 'far'} fa-heart"></i> ${isSaved ? 'Saved' : 'Save'}
                            </button>
                            <button class="reminder-btn" data-event-id="${event.id}">
                                <i class="far fa-bell"></i> Remind
                            </button>
                            <button class="share-btn" data-event-id="${event.id}">
                                <i class="fas fa-share-alt"></i> Share
                            </button>
                            <span class="event-category">${event.categoryLabel}</span>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `</div></div>`;
    });

    container.innerHTML = html;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

// ======================
// FILTERING
// ======================
function filterEvents(filter) {
    const events = window.allEvents || [];
    if (filter === 'all') {
        displayGroupedEvents(events);
    } else {
        const filtered = events.filter(event => event.category === filter);
        displayGroupedEvents(filtered);
    }
}

// ======================
// SOCIAL SHARING
// ======================
function shareEvent(eventId, platform) {
    const event = window.allEvents.find(e => e.id == eventId);
    if (!event) return;

    const baseUrl = window.location.origin + window.location.pathname;
    const eventUrl = `${baseUrl}?event=${eventId}`;
    const text = `${event.title} - ${formatDate(event.date)} at ${event.venueName}`;
    const hashtags = 'iPlugGQ,GqeberhaEvents';

    let shareUrl = '';
    switch(platform) {
        case 'facebook':
            shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(eventUrl)}`;
            break;
        case 'twitter':
        case 'x':
            shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(eventUrl)}&hashtags=${hashtags}`;
            break;
        case 'whatsapp':
            shareUrl = `https://wa.me/?text=${encodeURIComponent(text + ' ' + eventUrl)}`;
            break;
        case 'instagram':
        case 'tiktok':
            copyToClipboard(eventUrl);
            window.iplugPWA?.showNotification(`Link copied! Share it on ${platform}`, 'info');
            return;
        default:
            if (navigator.share) {
                navigator.share({ title: event.title, text, url: eventUrl })
                    .catch(() => copyToClipboard(eventUrl));
                return;
            } else {
                copyToClipboard(eventUrl);
                window.iplugPWA?.showNotification('Link copied to clipboard!', 'info');
                return;
            }
    }

    if (shareUrl) {
        window.open(shareUrl, '_blank', 'noopener,noreferrer');
    }
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
    } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }
}

function showShareMenu(eventId, anchor) {
    const existing = document.querySelector('.share-menu-overlay');
    if (existing) existing.remove();

    const menuHtml = `
        <div class="share-menu-overlay">
            <div class="share-menu">
                <h4>Share Event</h4>
                <div class="share-options">
                    <button onclick="shareEvent(${eventId}, 'facebook')"><i class="fab fa-facebook"></i> Facebook</button>
                    <button onclick="shareEvent(${eventId}, 'x')"><i class="fab fa-twitter"></i> X</button>
                    <button onclick="shareEvent(${eventId}, 'whatsapp')"><i class="fab fa-whatsapp"></i> WhatsApp</button>
                    <button onclick="shareEvent(${eventId}, 'instagram')"><i class="fab fa-instagram"></i> Instagram</button>
                    <button onclick="shareEvent(${eventId}, 'tiktok')"><i class="fab fa-tiktok"></i> TikTok</button>
                    <button onclick="shareEvent(${eventId}, 'copy')"><i class="fas fa-link"></i> Copy Link</button>
                </div>
                <button class="close-menu">&times;</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', menuHtml);

    const overlay = document.querySelector('.share-menu-overlay');
    overlay.querySelector('.close-menu').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

// ======================
// DEEP LINKING
// ======================
function waitForEventCard(eventId) {
    const checkExist = setInterval(() => {
        const eventCard = document.querySelector(`.event-card[data-id="${eventId}"]`);
        if (eventCard) {
            clearInterval(checkExist);
            eventCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
                eventCard.querySelector('.event-img')?.click();
            }, 600);
        }
    }, 300);
}

// ======================
// EVENT HANDLERS (SAVE, REMINDER, SHARE)
// ======================
function setupEventHandlers() {
    document.addEventListener('click', function(e) {
        // Save
        if (e.target.closest('.save-btn')) {
            const btn = e.target.closest('.save-btn');
            const eventId = btn.getAttribute('data-event-id');
            const event = window.allEvents.find(e => e.id == eventId);
            if (event && window.iplugPWA) {
                const saved = window.iplugPWA.saveEvent(event);
                btn.innerHTML = saved ? '<i class="fas fa-heart"></i> Saved' : '<i class="far fa-heart"></i> Save';
                btn.classList.toggle('saved', saved);
            }
        }
        // Reminder
        if (e.target.closest('.reminder-btn')) {
            const btn = e.target.closest('.reminder-btn');
            const eventId = btn.getAttribute('data-event-id');
            const event = window.allEvents.find(e => e.id == eventId);
            if (event && window.iplugPWA) {
                window.iplugPWA.showReminderModal(event);
            }
        }
        // Share
        if (e.target.closest('.share-btn')) {
            const btn = e.target.closest('.share-btn');
            const eventId = btn.getAttribute('data-event-id');
            showShareMenu(eventId, btn);
        }
    });
}

// ======================
// LIGHTBOX (with Share)
// ======================
function setupLightbox() {
    const modal = document.getElementById('lightbox-modal');
    const modalImg = document.getElementById('lightbox-image');
    const modalTitle = document.getElementById('lightbox-title');
    const modalDetails = document.getElementById('lightbox-details');
    const modalActions = document.getElementById('lightbox-actions');
    const closeBtn = document.querySelector('.close-lightbox');

    if (!modal) return;

    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    });
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('event-img')) {
            const card = e.target.closest('.event-card');
            if (!card) return;
            const eventId = card.getAttribute('data-id');
            const event = window.allEvents.find(e => e.id == eventId);
            if (!event) return;

            modalImg.src = e.target.src;
            modalTitle.textContent = event.title;
            modalDetails.innerHTML = `
                <p><strong><i class="far fa-calendar"></i> ${card.querySelector('.event-date')?.textContent || ''}</strong></p>
                <p><strong><i class="fas fa-map-marker-alt"></i> ${event.venueName}</strong></p>
            `;

            const isSaved = window.iplugPWA?.isEventSaved(event.id) || false;
            modalActions.innerHTML = `
                <button class="btn-save" data-event-id="${event.id}">
                    <i class="${isSaved ? 'fas' : 'far'} fa-heart"></i> ${isSaved ? 'Saved' : 'Save Event'}
                </button>
                <button class="btn-reminder" data-event-id="${event.id}">
                    <i class="far fa-bell"></i> Set Reminder
                </button>
                <button class="btn-share" data-event-id="${event.id}">
                    <i class="fas fa-share-alt"></i> Share
                </button>
            `;

            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    });

    // Lightbox action buttons
    modalActions.addEventListener('click', function(e) {
        if (e.target.closest('.btn-save')) {
            const btn = e.target.closest('.btn-save');
            const eventId = btn.getAttribute('data-event-id');
            const event = window.allEvents.find(e => e.id == eventId);
            if (event && window.iplugPWA) {
                const saved = window.iplugPWA.saveEvent(event);
                btn.innerHTML = saved ? '<i class="fas fa-heart"></i> Saved' : '<i class="far fa-heart"></i> Save Event';
            }
        }
        if (e.target.closest('.btn-reminder')) {
            const btn = e.target.closest('.btn-reminder');
            const eventId = btn.getAttribute('data-event-id');
            const event = window.allEvents.find(e => e.id == eventId);
            if (event && window.iplugPWA) {
                window.iplugPWA.showReminderModal(event);
            }
        }
        if (e.target.closest('.btn-share')) {
            const btn = e.target.closest('.btn-share');
            const eventId = btn.getAttribute('data-event-id');
            showShareMenu(eventId, btn);
        }
    });
}

// ======================
// NAVIGATION (Home / My Events)
// ======================
function setupNavigation() {
    document.querySelector('a[href="#home"]')?.addEventListener('click', function(e) {
        e.preventDefault();
        showMainEvents();
        window.history.pushState(null, null, '#home');
    });
    document.querySelector('a[href="#events"]')?.addEventListener('click', function(e) {
        e.preventDefault();
        showMainEvents();
        window.history.pushState(null, null, '#events');
    });
    const savedLink = document.getElementById('saved-link');
    if (savedLink) {
        savedLink.addEventListener('click', function(e) {
            e.preventDefault();
            showSavedEvents();
            window.history.pushState(null, null, '#saved');
        });
    }
}

function showMainEvents() {
    document.querySelector('.events').style.display = 'block';
    document.querySelector('.saved-events').style.display = 'none';
    document.querySelector('.hero').style.display = 'flex';
    document.querySelector('.submit').style.display = 'block';
    document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
    document.querySelector('a[href="#home"]')?.classList.add('active');
}

function showSavedEvents() {
    document.querySelector('.events').style.display = 'none';
    document.querySelector('.saved-events').style.display = 'block';
    document.querySelector('.hero').style.display = 'none';
    document.querySelector('.submit').style.display = 'none';
    document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
    document.querySelector('#saved-link')?.classList.add('active');
    if (window.iplugPWA) window.iplugPWA.loadSavedEvents();
}

function checkHash() {
    if (window.location.hash === '#saved') showSavedEvents();
    else showMainEvents();
}

window.addEventListener('popstate', checkHash);

// ======================
// FORM SUBMISSION
// ======================
function setupForm() {
    const form = document.getElementById('event-form');
    if (!form) return;

    const dateInput = document.getElementById('event-date');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.min = today;
    }

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const requiredFields = form.querySelectorAll('[required]');
        let isValid = true;
        requiredFields.forEach(f => {
            if (!f.value.trim()) {
                f.style.borderColor = 'var(--primary)';
                isValid = false;
            } else f.style.borderColor = '';
        });
        if (!isValid) {
            alert('Please fill in all required fields.');
            return;
        }

        const formData = new FormData(form);
        const eventData = {
            name: formData.get('event-name'),
            date: formData.get('event-date'),
            venue: formData.get('venue'),
            flyer: formData.get('flyer-url'),
            description: formData.get('description'),
            category: formData.get('category'),
            email: formData.get('contact-email'),
            submitted: new Date().toISOString()
        };

        try {
            const subs = JSON.parse(localStorage.getItem('iplugSubmissions') || '[]');
            subs.push(eventData);
            localStorage.setItem('iplugSubmissions', JSON.stringify(subs));
        } catch(e) { console.log(e); }

        alert(`✅ Event submitted successfully!\n\n"${eventData.name}" has been submitted. We'll contact you at ${eventData.email}.`);
        form.reset();
        setTimeout(() => form.submit(), 500);
    });
}

