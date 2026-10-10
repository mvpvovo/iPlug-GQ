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
            const expanded = navUl.classList.contains('show');
            menuToggle.setAttribute('aria-expanded', String(expanded));
            menuToggle.setAttribute('aria-label', expanded ? 'Close navigation menu' : 'Open navigation menu');
            const icon = menuToggle.querySelector('i');
            if (expanded) {
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
                menuToggle.setAttribute('aria-expanded', 'false');
                menuToggle.setAttribute('aria-label', 'Open navigation menu');
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
    setupEventFilters();

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
    document.getElementById('events-container').setAttribute('aria-busy', 'true');
    document.getElementById('events-count').textContent = 'Loading events…';
    fetch('events.csv')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} while loading events.csv`);
            }
            return response.text();
        })
        .then(parseEventsCsv)
        .then(events => {
            window.allEvents = events.filter(event => !isEventPassed(event.date));
            document.getElementById('events-container').setAttribute('aria-busy', 'false');
            applyEventFilters();
        })
        .catch(error => {
            console.error('Error loading events:', error);
            const container = document.getElementById('events-container');
            container.setAttribute('aria-busy', 'false');
            container.innerHTML = `
                <div class="no-events error-state">
                    <span class="empty-icon"><i class="fas fa-triangle-exclamation"></i></span>
                    <h3>We hit a small snag.</h3>
                    <p>Events couldn’t load just now. Give it another try, or send us your event directly.</p>
                    <div class="empty-actions">
                        <button class="btn" id="retry-events" type="button">Try again</button>
                        <a class="btn-secondary" href="#submit">Submit an event</a>
                    </div>
                </div>`;
            document.getElementById('events-count').textContent = 'Events unavailable';
        });
}

function parseEventsCsv(csv) {
    const rows = [];
    let row = [];
    let field = '';
    let insideQuotes = false;
    const input = csv.replace(/^\uFEFF/, '');

    for (let i = 0; i < input.length; i++) {
        const character = input[i];
        if (insideQuotes) {
            if (character === '"' && input[i + 1] === '"') {
                field += '"';
                i++;
            } else if (character === '"') {
                insideQuotes = false;
            } else {
                field += character;
            }
        } else if (character === '"' && field.length === 0) {
            insideQuotes = true;
        } else if (character === ',') {
            row.push(field);
            field = '';
        } else if (character === '\n' || character === '\r') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
            if (character === '\r' && input[i + 1] === '\n') i++;
        } else {
            field += character;
        }
    }

    if (insideQuotes) {
        throw new Error('The CSV has an unclosed quoted field.');
    }
    if (field.length || row.length) {
        row.push(field);
        rows.push(row);
    }
    if (!rows.length) {
        throw new Error('The CSV is empty.');
    }

    const headers = rows.shift().map(header => header.trim().toLowerCase());
    const columns = {
        id: headers.indexOf('event id'),
        title: headers.indexOf('event name'),
        date: headers.indexOf('date'),
        venueName: headers.indexOf('venue'),
        location: headers.indexOf('venue location'),
        flyer: headers.indexOf('flyer image url'),
        description: headers.indexOf('event description'),
        category: headers.indexOf('category')
    };
    const requiredColumns = ['title', 'date', 'venueName', 'location', 'flyer', 'description', 'category'];
    const missingColumns = requiredColumns.filter(column => columns[column] === -1);
    if (missingColumns.length) {
        throw new Error(`Missing required CSV column(s): ${missingColumns.join(', ')}.`);
    }
    if (new Set(headers).size !== headers.length) {
        throw new Error('The CSV contains duplicate column headers.');
    }

    const categoryLabels = {
        nightclub: 'Night Club',
        kasivibe: 'Kasi Vibe',
        urban: 'Urban Lifestyle',
        other: 'Other'
    };
    const categoryValues = {
        'night club': 'nightclub',
        nightclub: 'nightclub',
        'kasi vibe': 'kasivibe',
        kasivibe: 'kasivibe',
        'urban lifestyle': 'urban',
        urban: 'urban',
        other: 'other'
    };
    const parsedEvents = [];

    rows.forEach((values, index) => {
        const line = index + 2;
        if (values.every(value => !value.trim())) return;
        const value = column => (values[columns[column]] || '').trim();
        const title = value('title');
        const rawDate = value('date');
        const venueName = value('venueName');
        const location = value('location');
        const flyer = value('flyer');
        const description = value('description');
        const categoryKey = value('category').toLowerCase();
        const category = categoryValues[categoryKey];
        const missing = [
            ['Event Name', title],
            ['Date', rawDate],
            ['Venue', venueName],
            ['Venue Location', location],
            ['Flyer Image URL', flyer],
            ['Event Description', description],
            ['Category', category]
        ].filter(([, fieldValue]) => !fieldValue).map(([name]) => name);

        if (missing.length) {
            throw new Error(`CSV row ${line} is missing or has an invalid value for: ${missing.join(', ')}.`);
        }

        const date = parseEventDate(rawDate);
        let flyerUrl;
        try {
            flyerUrl = new URL(flyer);
        } catch {
            throw new Error(`CSV row ${line} has an invalid Flyer Image URL.`);
        }
        if (!['http:', 'https:'].includes(flyerUrl.protocol)) {
            throw new Error(`CSV row ${line} Flyer Image URL must use HTTP or HTTPS.`);
        }

        let id = null;
        if (columns.id !== -1 && value('id')) {
            id = Number(value('id'));
            if (!Number.isSafeInteger(id) || id < 1) {
                throw new Error(`CSV row ${line} Event ID must be a positive whole number or blank.`);
            }
        }

        parsedEvents.push({
            id,
            title,
            date,
            venueName,
            location,
            flyer: flyerUrl.href,
            description,
            category,
            categoryLabel: categoryLabels[category]
        });
    });

    const usedIds = new Set();
    parsedEvents.forEach(event => {
        if (event.id === null) return;
        if (usedIds.has(event.id)) {
            throw new Error(`The CSV contains duplicate Event ID ${event.id}.`);
        }
        usedIds.add(event.id);
    });
    parsedEvents.forEach(event => {
        if (event.id !== null) return;
        const key = `${event.title}\u0000${event.date}\u0000${event.venueName}\u0000${event.location}`;
        let id = hashEventId(key);
        while (usedIds.has(id)) id = (id + 1) % 4294967296;
        event.id = id;
        usedIds.add(id);
    });

    return parsedEvents;
}

function parseEventDate(value) {
    let year;
    let month;
    let day;
    let match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) {
        [, year, month, day] = match;
    } else {
        match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (!match) {
            throw new Error(`Invalid event date "${value}". Use YYYY-MM-DD or DD/MM/YYYY.`);
        }
        [, day, month, year] = match;
    }

    const normalized = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const parsed = new Date(`${normalized}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
        throw new Error(`Invalid event date "${value}".`);
    }
    return normalized;
}

function hashEventId(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}

function displayGroupedEvents(events) {
    const container = document.getElementById('events-container');
    if (!container) return;

    if (events.length === 0) {
        const hasEvents = (window.allEvents || []).length > 0;
        container.innerHTML = hasEvents ? `
            <div class="no-events filtered-empty">
                <span class="empty-icon"><i class="fas fa-magnifying-glass"></i></span>
                <h3>No matches this time.</h3>
                <p>Try another search, category, or date range.</p>
                <button class="btn-secondary" id="reset-event-filters" type="button">Clear filters</button>
            </div>` : `
            <div class="no-events">
                <span class="empty-icon"><i class="far fa-calendar-xmark"></i></span>
                <p class="section-eyebrow">YOUR WEEKEND IS WIDE OPEN</p>
                <h3>No upcoming events just yet.</h3>
                <p>Got something happening in GQ? Send it through and help the city make plans.</p>
                <div class="empty-actions">
                    <a class="btn" href="#submit">Submit an event</a>
                    <a class="btn-secondary" href="https://wa.me/27815294035" target="_blank" rel="noopener noreferrer">WhatsApp us</a>
                </div>
            </div>`;
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
            <div class="venue-group" data-venue="${escapeHtml(venue.venueName)}">
                <div class="venue-header">
                    <h3><i class="fas fa-map-marker-alt"></i> ${escapeHtml(venue.venueName)}</h3>
                    <span class="venue-location">${escapeHtml(venue.location)}</span>
                </div>
                <div class="venue-events-grid">
        `;

        venue.events.sort((a, b) => new Date(a.date) - new Date(b.date));
        venue.events.forEach(event => {
            const isSaved = window.iplugPWA?.isEventSaved(event.id) || false;
            html += `
                <article class="event-card" data-category="${event.category}" data-id="${event.id}">
                    <img src="${escapeHtml(event.flyer)}" alt="${escapeHtml(event.title)} flyer" class="event-img" onerror="this.src='https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80'">
                    <div class="event-info">
                        <span class="event-date"><i class="far fa-calendar"></i> ${formatDate(event.date)}</span>
                        <h4 class="event-title">${escapeHtml(event.title)}</h4>
                        <p class="event-venue"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(venue.venueName)}</p>
                        <p class="event-description">${escapeHtml(event.description)}</p>
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
                            <button class="calendar-btn" data-event-id="${event.id}" aria-label="Add ${escapeHtml(event.title)} to calendar">
                                <i class="far fa-calendar-plus"></i><span>Add to calendar</span>
                            </button>
                            <span class="event-category">${event.categoryLabel}</span>
                        </div>
                    </div>
                </article>
            `;
        });

        html += `</div></div>`;
    });

    container.innerHTML = html;
}

function formatDate(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
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
function setupEventFilters() {
    document.getElementById('event-search')?.addEventListener('input', applyEventFilters);
    document.getElementById('date-filter')?.addEventListener('change', applyEventFilters);

    document.querySelectorAll('.filter-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(filterButton => {
                const isActive = filterButton === button;
                filterButton.classList.toggle('active', isActive);
                filterButton.setAttribute('aria-pressed', String(isActive));
            });
            applyEventFilters();
        });
    });

    document.addEventListener('click', event => {
        if (event.target.closest('#reset-event-filters')) {
            resetEventFilters();
        }
        if (event.target.closest('#retry-events')) {
            loadEvents();
        }
    });

    document.addEventListener('keydown', event => {
        if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey &&
            !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
            event.preventDefault();
            document.getElementById('event-search')?.focus();
        }
    });
}

function resetEventFilters() {
    document.getElementById('event-search').value = '';
    document.getElementById('date-filter').value = 'weekend';
    document.querySelector('.filter-btn[data-filter="all"]').click();
}

function filterEvents(filter) {
    const button = document.querySelector(`.filter-btn[data-filter="${filter}"]`);
    if (button) button.click();
}

function applyEventFilters() {
    const events = window.allEvents || [];
    const category = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
    const search = document.getElementById('event-search').value.trim().toLocaleLowerCase();
    const dateRange = document.getElementById('date-filter').value;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let rangeStart = today;
    let rangeEnd = null;
    if (dateRange === '7days') {
        rangeEnd = new Date(today);
        rangeEnd.setDate(rangeEnd.getDate() + 7);
    } else if (dateRange === 'weekend') {
        rangeStart = new Date(today);
        const daysUntilSaturday = today.getDay() === 0 ? 0 : (6 - today.getDay() + 7) % 7;
        rangeStart.setDate(rangeStart.getDate() + daysUntilSaturday);
        rangeEnd = new Date(rangeStart);
        rangeEnd.setDate(rangeEnd.getDate() + (today.getDay() === 0 ? 1 : 2));
    }

    const filtered = events.filter(event => {
        if (category !== 'all' && event.category !== category) return false;
        if (search && ![event.title, event.venueName, event.location, event.description, event.categoryLabel]
            .some(value => value.toLocaleLowerCase().includes(search))) return false;
        if (dateRange !== 'all') {
            const eventDate = new Date(`${event.date}T00:00:00`);
            if (eventDate < rangeStart || eventDate >= rangeEnd) return false;
        }
        return true;
    });

    const count = document.getElementById('events-count');
    count.textContent = `${filtered.length} ${filtered.length === 1 ? 'event' : 'events'}`;
    displayGroupedEvents(filtered);
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

function downloadEventCalendar(eventId) {
    const event = (window.allEvents || []).find(item => item.id == eventId);
    if (!event) return;

    const escapeCalendarText = value => String(value)
        .replace(/\\/g, '\\\\')
        .replace(/\r?\n/g, '\\n')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;');
    const eventDate = event.date.replace(/-/g, '');
    const calendar = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//iPlug GQ//Events//EN',
        'BEGIN:VEVENT',
        `UID:${event.id}@ipluggq.co.za`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
        `DTSTART;VALUE=DATE:${eventDate}`,
        `DTEND;VALUE=DATE:${new Date(new Date(`${event.date}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10).replace(/-/g, '')}`,
        `SUMMARY:${escapeCalendarText(event.title)}`,
        `LOCATION:${escapeCalendarText(`${event.venueName}, ${event.location}`)}`,
        `DESCRIPTION:${escapeCalendarText(event.description)}`,
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'iplug-gq-event'}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
        if (e.target.closest('.calendar-btn')) {
            downloadEventCalendar(e.target.closest('.calendar-btn').getAttribute('data-event-id'));
        }
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
                <p><strong><i class="fas fa-map-marker-alt"></i> ${escapeHtml(event.venueName)}</strong></p>
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
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        dateInput.min = today;
    }

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        if (!form.reportValidity()) return;
        const formData = new FormData(form);
        const eventData = {
            name: formData.get('event-name'),
            date: formData.get('event-date'),
            venue: formData.get('venue'),
            flyer: formData.get('flyer-url'),
            description: formData.get('description'),
            category: formData.get('category'),
            email: formData.get('contact-email')
        };
        const message = [
            'Hi iPlug GQ! Please review my event for the weekly guide:',
            '',
            `Event: ${eventData.name}`,
            `Date: ${eventData.date}`,
            `Venue: ${eventData.venue}`,
            `Flyer: ${eventData.flyer}`,
            `Category: ${eventData.category}`,
            `Description: ${eventData.description}`,
            `Contact email: ${eventData.email}`
        ].join('\n');
        const whatsappUrl = `https://wa.me/27815294035?text=${encodeURIComponent(message)}`;
        const status = document.getElementById('form-status');
        const whatsappWindow = window.open(whatsappUrl, '_blank');

        if (whatsappWindow) {
            whatsappWindow.opener = null;
            status.textContent = 'WhatsApp opened with your event details. Review the message and tap Send to submit it.';
            form.reset();
        } else {
            status.innerHTML = `Your browser blocked the new tab. <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer">Tap here to open WhatsApp with your event details.</a>`;
        }
    });
}
