// ==========================================
// iPlug GQ – Core Application Script
// Gqeberha's #1 Gig Guide
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Dynamic year in footer
    const currentYearEl = document.getElementById('current-year');
    if (currentYearEl) {
        currentYearEl.textContent = new Date().getFullYear();
    }

    // Initialize application modules
    setupMobileNav();
    setupNavigation();
    setupFilters();
    setupLightbox();
    setupForm();
    setupDeepLinking();

    // Load and render events
    loadEvents();
});

// ==========================================
// NAVIGATION & MOBILE MENU
// ==========================================
function setupMobileNav() {
    const menuToggle = document.querySelector('.menu-toggle');
    const navUl = document.querySelector('nav ul');

    if (menuToggle && navUl) {
        menuToggle.addEventListener('click', () => {
            navUl.classList.toggle('show');
            const expanded = navUl.classList.contains('show');
            menuToggle.setAttribute('aria-expanded', String(expanded));
            menuToggle.setAttribute('aria-label', expanded ? 'Close navigation menu' : 'Open navigation menu');
            const icon = menuToggle.querySelector('i');
            if (icon) {
                icon.className = expanded ? 'fas fa-xmark' : 'fas fa-bars';
            }
        });

        // Close menu when clicking outside or clicking any nav link
        document.addEventListener('click', (e) => {
            if (!navUl.contains(e.target) && !menuToggle.contains(e.target) && navUl.classList.contains('show')) {
                closeNavMenu(menuToggle, navUl);
            }
        });

        navUl.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                closeNavMenu(menuToggle, navUl);
            });
        });
    }
}

function closeNavMenu(menuToggle, navUl) {
    navUl.classList.remove('show');
    menuToggle.setAttribute('aria-expanded', 'false');
    const icon = menuToggle.querySelector('i');
    if (icon) icon.className = 'fas fa-bars';
}

function setupNavigation() {
    const homeLinks = document.querySelectorAll('a[href="#home"], .logo');
    const eventLinks = document.querySelectorAll('a[href="#events"]');
    const savedLink = document.getElementById('saved-link');
    const pastGigsLink = document.getElementById('past-gigs-link');

    homeLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showMainView();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            window.history.pushState(null, null, '#home');
        });
    });

    eventLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showMainView();
            const dateFilter = document.getElementById('date-filter');
            if (dateFilter && dateFilter.value === 'past') {
                dateFilter.value = 'weekend';
                applyFilters();
            }
            document.getElementById('events')?.scrollIntoView({ behavior: 'smooth' });
            window.history.pushState(null, null, '#events');
        });
    });

    if (pastGigsLink) {
        pastGigsLink.addEventListener('click', (e) => {
            e.preventDefault();
            showMainView();
            const dateFilter = document.getElementById('date-filter');
            if (dateFilter) {
                dateFilter.value = 'past';
                applyFilters();
            }
            document.getElementById('events')?.scrollIntoView({ behavior: 'smooth' });
            window.history.pushState(null, null, '#past-gigs');
        });
    }

    if (savedLink) {
        savedLink.addEventListener('click', (e) => {
            e.preventDefault();
            showSavedView();
            window.history.pushState(null, null, '#saved');
        });
    }

    document.getElementById('switch-upcoming-btn')?.addEventListener('click', () => {
        const dateFilter = document.getElementById('date-filter');
        if (dateFilter) {
            dateFilter.value = (window.upcomingEvents && window.upcomingEvents.length > 0) ? 'weekend' : 'all';
            applyFilters();
        }
    });

    window.addEventListener('popstate', checkHash);
    checkHash();
}

function showMainView() {
    document.querySelector('.events').style.display = 'block';
    document.querySelector('.hero').style.display = 'flex';
    document.querySelector('.submit').style.display = 'block';
    document.querySelector('.saved-events').style.display = 'none';

    document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
    document.querySelector('a[href="#events"]')?.classList.add('active');
}

function showSavedView() {
    document.querySelector('.events').style.display = 'none';
    document.querySelector('.hero').style.display = 'none';
    document.querySelector('.submit').style.display = 'none';
    document.querySelector('.saved-events').style.display = 'block';

    document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
    document.getElementById('saved-link')?.classList.add('active');

    if (window.iplugPWA) {
        window.iplugPWA.loadSavedEvents();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function checkHash() {
    if (window.location.hash === '#saved') {
        showSavedView();
    } else if (window.location.hash === '#past-gigs') {
        showMainView();
        const dateFilter = document.getElementById('date-filter');
        if (dateFilter) {
            dateFilter.value = 'past';
            applyFilters();
        }
    } else {
        showMainView();
    }
}

// ==========================================
// DATA LOADING & PARSING
// ==========================================
function isEventPassed(dateString) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    return dateString < todayStr;
}

function optimizeImageUrl(url, width = 600) {
    if (!url) return 'https://ik.imagekit.io/vurvay/placeholder/IMG_9774.jpg?tr=w-600,q-75,f-auto';
    if (url.includes('ik.imagekit.io')) {
        if (url.includes('?tr=')) return url;
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}tr=w-${width},q-75,f-auto`;
    }
    return url;
}

function loadEvents() {
    const container = document.getElementById('events-container');
    const countEl = document.getElementById('events-count');

    if (container) container.setAttribute('aria-busy', 'true');
    if (countEl) countEl.textContent = 'Loading gigs…';

    fetch('events.csv')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} loading events.csv`);
            }
            return response.text();
        })
        .then(parseEventsCsv)
        .then(events => {
            window.allRawEvents = events;
            window.upcomingEvents = events.filter(e => !isEventPassed(e.date));
            window.pastEvents = events.filter(e => isEventPassed(e.date));

            // Smart UX: If no upcoming events in CSV (e.g. gap between weekly updates), default to archive mode
            const dateFilter = document.getElementById('date-filter');
            if (window.upcomingEvents.length === 0 && window.pastEvents.length > 0) {
                if (dateFilter && dateFilter.value !== 'past') {
                    dateFilter.value = 'past';
                }
            }

            if (container) container.setAttribute('aria-busy', 'false');
            applyFilters();
            injectSchemaStructuredData(events);
        })
        .catch(error => {
            console.error('Error loading events:', error);
            if (container) {
                container.setAttribute('aria-busy', 'false');
                container.innerHTML = `
                    <div class="no-events error-state">
                        <span class="empty-icon"><i class="fas fa-triangle-exclamation"></i></span>
                        <h3>Events could not load</h3>
                        <p>We had a glitch loading the guide. Check your connection or try again.</p>
                        <div class="empty-actions">
                            <button class="btn" id="retry-events-btn" type="button">Try again</button>
                            <a class="btn-secondary" href="https://wa.me/27815294035" target="_blank" rel="noopener noreferrer">WhatsApp Support</a>
                        </div>
                    </div>`;
                document.getElementById('retry-events-btn')?.addEventListener('click', loadEvents);
            }
            if (countEl) countEl.textContent = 'Guide offline';
        });
}

function parseEventsCsv(csv) {
    const rows = [];
    let row = [];
    let field = '';
    let insideQuotes = false;
    const input = csv.replace(/^\uFEFF/, '');

    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        if (insideQuotes) {
            if (char === '"' && input[i + 1] === '"') {
                field += '"';
                i++;
            } else if (char === '"') {
                insideQuotes = false;
            } else {
                field += char;
            }
        } else if (char === '"' && field.length === 0) {
            insideQuotes = true;
        } else if (char === ',') {
            row.push(field);
            field = '';
        } else if (char === '\n' || char === '\r') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
            if (char === '\r' && input[i + 1] === '\n') i++;
        } else {
            field += char;
        }
    }
    if (field.length || row.length) {
        row.push(field);
        rows.push(row);
    }
    if (!rows.length) return [];

    const headers = rows.shift().map(h => h.trim().toLowerCase());
    const colMap = {
        id: headers.indexOf('event id'),
        title: headers.indexOf('event name'),
        date: headers.indexOf('date'),
        venueName: headers.indexOf('venue'),
        location: headers.indexOf('venue location'),
        flyer: headers.indexOf('flyer image url'),
        description: headers.indexOf('event description'),
        category: headers.indexOf('category')
    };

    const categoryLabels = {
        nightclub: 'Night Club',
        kasivibe: 'Kasi Vibe',
        urban: 'Urban Lifestyle',
        other: 'Other'
    };

    const parsedEvents = [];
    const usedIds = new Set();

    rows.forEach((values, index) => {
        if (!values || values.every(v => !v.trim())) return;
        const getVal = key => (colMap[key] !== -1 ? (values[colMap[key]] || '').trim() : '');

        const title = getVal('title');
        const rawDate = getVal('date');
        const venueName = getVal('venueName');
        const location = getVal('location') || 'Gqeberha';
        const flyer = getVal('flyer');
        const description = getVal('description');
        const rawCategory = getVal('category').toLowerCase().replace(/\s+/g, '');

        if (!title || !rawDate || !venueName) {
            console.warn(`Row ${index + 2} skipped due to missing essential fields`);
            return;
        }

        let date;
        try {
            date = normalizeEventDate(rawDate);
        } catch {
            console.warn(`Row ${index + 2} skipped due to invalid date format:`, rawDate);
            return;
        }

        let category = 'other';
        if (rawCategory.includes('nightclub') || rawCategory.includes('club')) category = 'nightclub';
        else if (rawCategory.includes('kasi') || rawCategory.includes('tavern')) category = 'kasivibe';
        else if (rawCategory.includes('urban') || rawCategory.includes('lifestyle')) category = 'urban';

        let id = Number(getVal('id'));
        if (!id || !Number.isSafeInteger(id) || usedIds.has(id)) {
            id = generateEventHashId(`${title}-${date}-${venueName}`);
            while (usedIds.has(id)) id++;
        }
        usedIds.add(id);

        // Detect if Free Entry is mentioned in description
        const isFree = /(free entry|free entrance|free before|no cover)/i.test(description);

        // Detect ticket links if present (Quicket, Howler, Computicket)
        const ticketMatch = description.match(/(https?:\/\/[^\s]+(?:quicket|howler|computicket|ticket)[^\s]*)/i);
        const ticketUrl = ticketMatch ? ticketMatch[0] : null;

        parsedEvents.push({
            id,
            title,
            date,
            venueName,
            location,
            flyer: flyer || 'https://ik.imagekit.io/vurvay/placeholder/IMG_9774.jpg',
            description,
            category,
            categoryLabel: categoryLabels[category] || 'Other',
            isFree,
            ticketUrl
        });
    });

    return parsedEvents;
}

function normalizeEventDate(value) {
    let year, month, day;
    let match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) {
        [, year, month, day] = match;
    } else {
        match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (!match) throw new Error('Invalid format');
        [, day, month, year] = match;
    }
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return iso;
}

function generateEventHashId(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[c]);
}

function formatDate(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
    });
}

function formatFullDate(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

// ==========================================
// FILTERING & SEARCH
// ==========================================
function setupFilters() {
    const searchInput = document.getElementById('event-search');
    const areaFilter = document.getElementById('area-filter');
    const dateFilter = document.getElementById('date-filter');
    const freeFilterBtn = document.getElementById('filter-free');

    searchInput?.addEventListener('input', applyFilters);
    areaFilter?.addEventListener('change', applyFilters);
    dateFilter?.addEventListener('change', applyFilters);

    freeFilterBtn?.addEventListener('click', () => {
        const isActive = freeFilterBtn.classList.toggle('active');
        freeFilterBtn.setAttribute('aria-pressed', String(isActive));
        freeFilterBtn.dataset.free = String(isActive);
        applyFilters();
    });

    document.querySelectorAll('.filter-btn:not(#filter-free)').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn:not(#filter-free)').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            button.classList.add('active');
            button.setAttribute('aria-pressed', 'true');
            applyFilters();
        });
    });

    // Keyboard shortcut: '/' focuses search input
    document.addEventListener('keydown', e => {
        if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
            e.preventDefault();
            searchInput?.focus();
        }
    });

    document.addEventListener('click', e => {
        if (e.target.closest('#reset-filters-btn')) {
            resetAllFilters();
        }
    });
}

function resetAllFilters() {
    const searchInput = document.getElementById('event-search');
    const areaFilter = document.getElementById('area-filter');
    const dateFilter = document.getElementById('date-filter');
    const freeFilterBtn = document.getElementById('filter-free');

    if (searchInput) searchInput.value = '';
    if (areaFilter) areaFilter.value = 'all';
    if (dateFilter) dateFilter.value = (window.upcomingEvents && window.upcomingEvents.length > 0) ? 'weekend' : 'all';

    if (freeFilterBtn) {
        freeFilterBtn.classList.remove('active');
        freeFilterBtn.dataset.free = 'false';
        freeFilterBtn.setAttribute('aria-pressed', 'false');
    }

    document.querySelectorAll('.filter-btn:not(#filter-free)').forEach((btn, idx) => {
        btn.classList.toggle('active', idx === 0);
        btn.setAttribute('aria-pressed', idx === 0 ? 'true' : 'false');
    });

    applyFilters();
}

function matchArea(event, areaKey) {
    if (areaKey === 'all') return true;
    const text = `${event.venueName} ${event.location}`.toLowerCase();

    const areaKeywords = {
        central: ['central', 'richmond hill', 'donkin', 'stanley', 'parliament'],
        summerstrand: ['summerstrand', 'humewood', 'happy valley', 'boardwalk', 'nmb'],
        harbour: ['harbour', 'deal party', 'endaweni'],
        newbrighton: ['new brighton', 'zwide', 'oom cola', 'chief ngqoko', 'red location'],
        motherwell: ['motherwell', 'wells estate', 'ethafeni', 'kwa masinga', 'monde', 'eskwerini'],
        addo: ['addo', 'k lounge', 'sundays river']
    };

    const keywords = areaKeywords[areaKey] || [];
    return keywords.some(k => text.includes(k));
}

function applyFilters() {
    const allEvents = window.allRawEvents || [];
    const category = document.querySelector('.filter-btn.active:not(#filter-free)')?.dataset.filter || 'all';
    const area = document.getElementById('area-filter')?.value || 'all';
    const dateRange = document.getElementById('date-filter')?.value || 'weekend';
    const freeOnly = document.getElementById('filter-free')?.dataset.free === 'true';
    const search = (document.getElementById('event-search')?.value || '').trim().toLowerCase();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Handle Archive banner display
    const archiveBanner = document.getElementById('archive-banner');
    const sectionTitle = document.getElementById('events-section-title');
    if (archiveBanner) {
        const isArchive = dateRange === 'past';
        archiveBanner.style.display = isArchive ? 'flex' : 'none';
        if (sectionTitle) {
            sectionTitle.innerHTML = isArchive ? 'Past gigs archive<span class="heading-period">.</span>' : 'This week<span class="heading-period">.</span>';
        }
    }

    const filtered = allEvents.filter(event => {
        // Date filtering
        const isPassed = isEventPassed(event.date);

        if (dateRange === 'past') {
            if (!isPassed) return false;
        } else {
            // For all non-past ranges, ignore past events
            if (isPassed) return false;

            if (dateRange === 'today') {
                if (event.date !== todayStr) return false;
            } else if (dateRange === 'weekend') {
                // Determine upcoming Saturday and Sunday
                const daysUntilSat = today.getDay() === 0 ? 0 : (6 - today.getDay() + 7) % 7;
                const satDate = new Date(today);
                satDate.setDate(satDate.getDate() + daysUntilSat);
                const sunDate = new Date(satDate);
                sunDate.setDate(sunDate.getDate() + (today.getDay() === 0 ? 0 : 1));

                const eventD = new Date(`${event.date}T00:00:00`);
                // Also allow Friday events if today is Friday or after
                const friDate = new Date(satDate);
                friDate.setDate(friDate.getDate() - 1);

                if (eventD < friDate || eventD > sunDate) return false;
            } else if (dateRange === '7days') {
                const limit = new Date(today);
                limit.setDate(limit.getDate() + 7);
                const eventD = new Date(`${event.date}T00:00:00`);
                if (eventD < today || eventD > limit) return false;
            }
        }

        // Category filter
        if (category !== 'all' && event.category !== category) {
            return false;
        }

        // Area filter
        if (!matchArea(event, area)) {
            return false;
        }

        // Free Entry filter
        if (freeOnly && !event.isFree) {
            return false;
        }

        // Search text
        if (search) {
            const haystack = `${event.title} ${event.venueName} ${event.location} ${event.description} ${event.categoryLabel}`.toLowerCase();
            if (!haystack.includes(search)) return false;
        }

        return true;
    });

    const countEl = document.getElementById('events-count');
    if (countEl) {
        countEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'event' : 'events'}`;
    }

    renderGroupedEvents(filtered, dateRange === 'past');
}

// ==========================================
// RENDERING
// ==========================================
function renderGroupedEvents(events, isArchiveMode = false) {
    const container = document.getElementById('events-container');
    if (!container) return;

    if (events.length === 0) {
        const hasAnyEvents = (window.allRawEvents || []).length > 0;
        container.innerHTML = `
            <div class="no-events">
                <span class="empty-icon"><i class="fas fa-magnifying-glass"></i></span>
                <h3>No gigs match your filters</h3>
                <p>Try switching date range, clearing search terms, or checking out the past gigs archive.</p>
                <div class="empty-actions">
                    <button class="btn" id="reset-filters-btn" type="button">Clear filters</button>
                    ${!isArchiveMode ? `<button class="btn-secondary" id="open-archive-btn" type="button"><i class="fas fa-clock-rotate-left"></i> View Past Gigs</button>` : ''}
                    <a class="btn-secondary" href="#submit">Submit an event</a>
                </div>
            </div>`;

        document.getElementById('open-archive-btn')?.addEventListener('click', () => {
            const dateFilter = document.getElementById('date-filter');
            if (dateFilter) {
                dateFilter.value = 'past';
                applyFilters();
            }
        });
        return;
    }

    // Group by venueName
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

    // Sort venues by earliest event date
    const sortedVenues = Object.values(grouped).sort((a, b) => {
        const aDate = a.events[0].date;
        const bDate = b.events[0].date;
        return isArchiveMode ? new Date(bDate) - new Date(aDate) : new Date(aDate) - new Date(bDate);
    });

    let html = '';
    sortedVenues.forEach(venue => {
        venue.events.sort((a, b) => isArchiveMode ? new Date(b.date) - new Date(a.date) : new Date(a.date) - new Date(b.date));

        html += `
            <div class="venue-group">
                <div class="venue-header">
                    <h3><i class="fas fa-location-dot"></i> ${escapeHtml(venue.venueName)}</h3>
                    <span class="venue-location"><i class="fas fa-map-pin"></i> ${escapeHtml(venue.location)}</span>
                </div>
                <div class="venue-events-grid">
        `;

        venue.events.forEach(event => {
            const isSaved = window.iplugPWA?.isEventSaved(event.id) || false;
            const optimizedFlyer = optimizeImageUrl(event.flyer, 600);
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venueName}, ${event.location}, Gqeberha`)}`;

            html += `
                <article class="event-card ${isArchiveMode ? 'past-card' : ''}" data-id="${event.id}">
                    <div class="event-img-wrap" data-event-id="${event.id}">
                        <img src="${escapeHtml(optimizedFlyer)}" 
                             alt="${escapeHtml(event.title)} flyer" 
                             class="event-img" 
                             loading="lazy" 
                             decoding="async" 
                             onerror="this.src='https://ik.imagekit.io/vurvay/placeholder/IMG_9774.jpg?tr=w-600,q-75,f-auto'">
                        <span class="event-img-badge">${formatDate(event.date)}</span>
                        <span class="event-category-badge">${escapeHtml(event.categoryLabel)}</span>
                        ${event.isFree ? `<span class="event-tag-free"><i class="fas fa-ticket"></i> Free</span>` : ''}
                        ${isArchiveMode ? `<span class="event-tag-past"><i class="fas fa-clock-rotate-left"></i> Past</span>` : ''}
                    </div>

                    <div class="event-info">
                        <span class="event-date-text"><i class="far fa-calendar"></i> ${formatFullDate(event.date)}</span>
                        <h4 class="event-title" data-event-id="${event.id}">${escapeHtml(event.title)}</h4>
                        <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="event-venue-link" title="Open in Google Maps">
                            <i class="fas fa-location-dot"></i> ${escapeHtml(event.venueName)}, ${escapeHtml(event.location)}
                        </a>
                        <p class="event-description">${escapeHtml(event.description)}</p>

                        <div class="event-actions">
                            ${event.ticketUrl ? `
                                <a href="${escapeHtml(event.ticketUrl)}" target="_blank" rel="noopener noreferrer" class="ticket-btn">
                                    <i class="fas fa-ticket"></i> Tickets
                                </a>
                            ` : ''}
                            <button class="save-btn ${isSaved ? 'saved' : ''}" data-event-id="${event.id}" title="Save to My Events">
                                <i class="${isSaved ? 'fas' : 'far'} fa-heart"></i> <span>${isSaved ? 'Saved' : 'Save'}</span>
                            </button>
                            <button class="reminder-btn" data-event-id="${event.id}" title="Set reminder">
                                <i class="far fa-bell"></i>
                            </button>
                            <button class="calendar-btn" data-event-id="${event.id}" title="Add to Calendar">
                                <i class="far fa-calendar-plus"></i>
                            </button>
                            <button class="share-btn" data-event-id="${event.id}" title="Share this gig">
                                <i class="fas fa-share-nodes"></i>
                            </button>
                            <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="maps-btn" title="Map directions">
                                <i class="fas fa-map-location-dot"></i>
                            </a>
                        </div>
                    </div>
                </article>
            `;
        });

        html += `</div></div>`;
    });

    container.innerHTML = html;
    setupEventCardHandlers();
}

// ==========================================
// EVENT CARD INTERACTIONS
// ==========================================
function setupEventCardHandlers() {
    // Flyer & Title click -> Lightbox
    document.querySelectorAll('.event-img-wrap, .event-title').forEach(el => {
        el.addEventListener('click', () => {
            const eventId = el.getAttribute('data-event-id');
            const event = (window.allRawEvents || []).find(e => e.id == eventId);
            if (event) openLightbox(event);
        });
    });

    // Save button
    document.querySelectorAll('.save-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const eventId = btn.getAttribute('data-event-id');
            const event = (window.allRawEvents || []).find(e => e.id == eventId);
            if (event && window.iplugPWA) {
                const saved = window.iplugPWA.saveEvent(event);
                btn.classList.toggle('saved', saved);
                btn.innerHTML = `<i class="${saved ? 'fas' : 'far'} fa-heart"></i> <span>${saved ? 'Saved' : 'Save'}</span>`;
            }
        });
    });

    // Reminder button
    document.querySelectorAll('.reminder-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const eventId = btn.getAttribute('data-event-id');
            const event = (window.allRawEvents || []).find(e => e.id == eventId);
            if (event && window.iplugPWA) {
                window.iplugPWA.showReminderModal(event);
            }
        });
    });

    // Calendar button
    document.querySelectorAll('.calendar-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const eventId = btn.getAttribute('data-event-id');
            showCalendarMenu(eventId);
        });
    });

    // Share button
    document.querySelectorAll('.share-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const eventId = btn.getAttribute('data-event-id');
            showShareMenu(eventId);
        });
    });
}

// ==========================================
// CALENDAR & MAPS INTEGRATION
// ==========================================
function createGoogleCalendarLink(event) {
    const cleanDate = event.date.replace(/-/g, '');
    const start = `${cleanDate}T160000Z`;
    const end = `${cleanDate}T235959Z`;
    const title = encodeURIComponent(event.title);
    const details = encodeURIComponent(`${event.description}\n\nVenue: ${event.venueName}, ${event.location}\nDiscover more on iPlug GQ: https://ipluggq.com/?event=${event.id}`);
    const location = encodeURIComponent(`${event.venueName}, ${event.location}, Gqeberha`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;
}

function downloadEventIcs(eventId) {
    const event = (window.allRawEvents || []).find(item => item.id == eventId);
    if (!event) return;

    const escapeCalendarText = val => String(val || '')
        .replace(/\\/g, '\\\\')
        .replace(/\r?\n/g, '\\n')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;');

    const eventDate = event.date.replace(/-/g, '');
    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//iPlug GQ//Gig Guide//EN',
        'CALSCALE:GREGORIAN',
        'BEGIN:VEVENT',
        `UID:${event.id}@ipluggq.com`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
        `DTSTART;VALUE=DATE:${eventDate}`,
        `DTEND;VALUE=DATE:${eventDate}`,
        `SUMMARY:${escapeCalendarText(event.title)}`,
        `LOCATION:${escapeCalendarText(`${event.venueName}, ${event.location}, Gqeberha`)}`,
        `DESCRIPTION:${escapeCalendarText(event.description)}`,
        `URL:https://ipluggq.com/?event=${event.id}`,
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'iplug-gq-event'}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showCalendarMenu(eventId) {
    const event = (window.allRawEvents || []).find(e => e.id == eventId);
    if (!event) return;

    const existing = document.querySelector('.share-menu-overlay');
    if (existing) existing.remove();

    const googleUrl = createGoogleCalendarLink(event);

    const modalHtml = `
        <div class="share-menu-overlay">
            <div class="share-menu">
                <h4><i class="far fa-calendar-plus"></i> Add to Calendar</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px;">"${escapeHtml(event.title)}"</p>
                <div class="share-options" style="grid-template-columns: 1fr;">
                    <a href="${googleUrl}" target="_blank" rel="noopener noreferrer" style="display:flex; align-items:center; gap:8px; padding:12px; background:var(--surface-card); border:1px solid var(--line); border-radius:6px; color:#fff;">
                        <i class="fab fa-google" style="color:var(--primary);"></i> Add to Google Calendar
                    </a>
                    <button id="download-ics-btn" type="button" style="display:flex; align-items:center; gap:8px; padding:12px; background:var(--surface-card); border:1px solid var(--line); border-radius:6px; color:#fff; cursor:pointer;">
                        <i class="fab fa-apple" style="color:var(--secondary);"></i> Download Apple / Outlook .ics
                    </button>
                </div>
                <button class="close-menu" type="button">Close</button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const overlay = document.querySelector('.share-menu-overlay');

    overlay.querySelector('#download-ics-btn')?.addEventListener('click', () => {
        downloadEventIcs(eventId);
        overlay.remove();
    });

    overlay.querySelector('.close-menu')?.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ==========================================
// SOCIAL SHARING
// ==========================================
function shareEvent(eventId, platform) {
    const event = (window.allRawEvents || []).find(e => e.id == eventId);
    if (!event) return;

    const eventUrl = `https://ipluggq.com/?event=${eventId}`;
    const text = `Check out ${event.title} happening on ${formatDate(event.date)} at ${event.venueName} (Gqeberha)!`;

    let shareUrl = '';
    switch (platform) {
        case 'whatsapp':
            shareUrl = `https://wa.me/?text=${encodeURIComponent(`${text}\n${eventUrl}`)}`;
            break;
        case 'x':
            shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(eventUrl)}&hashtags=iPlugGQ,Gqeberha`;
            break;
        case 'facebook':
            shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(eventUrl)}`;
            break;
        case 'copy':
            copyToClipboard(eventUrl);
            window.iplugPWA?.showNotification('Event link copied to clipboard!', 'success');
            return;
        default:
            if (navigator.share) {
                navigator.share({ title: event.title, text, url: eventUrl })
                    .catch(() => copyToClipboard(eventUrl));
                return;
            } else {
                copyToClipboard(eventUrl);
                window.iplugPWA?.showNotification('Event link copied!', 'success');
                return;
            }
    }

    if (shareUrl) {
        window.open(shareUrl, '_blank', 'noopener,noreferrer');
    }
}

function showShareMenu(eventId) {
    const existing = document.querySelector('.share-menu-overlay');
    if (existing) existing.remove();

    const menuHtml = `
        <div class="share-menu-overlay">
            <div class="share-menu">
                <h4><i class="fas fa-share-nodes"></i> Share This Gig</h4>
                <div class="share-options">
                    <button onclick="shareEvent(${eventId}, 'whatsapp')"><i class="fab fa-whatsapp" style="color:#25d366;"></i> WhatsApp</button>
                    <button onclick="shareEvent(${eventId}, 'x')"><i class="fab fa-x-twitter"></i> X (Twitter)</button>
                    <button onclick="shareEvent(${eventId}, 'facebook')"><i class="fab fa-facebook-f" style="color:#1877f2;"></i> Facebook</button>
                    <button onclick="shareEvent(${eventId}, 'copy')"><i class="fas fa-link" style="color:var(--primary);"></i> Copy Link</button>
                </div>
                <button class="close-menu" type="button">Close</button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', menuHtml);
    const overlay = document.querySelector('.share-menu-overlay');
    overlay.querySelector('.close-menu')?.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
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

// ==========================================
// LIGHTBOX MODAL
// ==========================================
function setupLightbox() {
    const modal = document.getElementById('lightbox-modal');
    const closeBtn = modal?.querySelector('.close-lightbox');

    if (!modal) return;

    closeBtn?.addEventListener('click', closeLightbox);
    modal.addEventListener('click', e => {
        if (e.target === modal) closeLightbox();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            closeLightbox();
        }
    });
}

function openLightbox(event) {
    const modal = document.getElementById('lightbox-modal');
    const img = document.getElementById('lightbox-image');
    const title = document.getElementById('lightbox-title');
    const details = document.getElementById('lightbox-details');
    const actions = document.getElementById('lightbox-actions');

    if (!modal) return;

    img.src = optimizeImageUrl(event.flyer, 1000);
    title.textContent = event.title;

    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venueName}, ${event.location}, Gqeberha`)}`;

    details.innerHTML = `
        <p><i class="far fa-calendar"></i> <strong>${formatFullDate(event.date)}</strong></p>
        <p><i class="fas fa-location-dot"></i> <strong>${escapeHtml(event.venueName)}</strong> (${escapeHtml(event.location)})</p>
        <p style="margin-top: 10px; color: #d0d2c7;">${escapeHtml(event.description)}</p>
    `;

    const isSaved = window.iplugPWA?.isEventSaved(event.id) || false;
    actions.innerHTML = `
        ${event.ticketUrl ? `
            <a href="${escapeHtml(event.ticketUrl)}" target="_blank" rel="noopener noreferrer" class="btn-small">
                <i class="fas fa-ticket"></i> Buy Tickets
            </a>
        ` : ''}
        <button class="save-btn ${isSaved ? 'saved' : ''}" data-event-id="${event.id}">
            <i class="${isSaved ? 'fas' : 'far'} fa-heart"></i> ${isSaved ? 'Saved' : 'Save Gig'}
        </button>
        <button class="reminder-btn" data-event-id="${event.id}">
            <i class="far fa-bell"></i> Remind
        </button>
        <button class="calendar-btn" data-event-id="${event.id}">
            <i class="far fa-calendar-plus"></i> Add to Calendar
        </button>
        <button class="share-btn" data-event-id="${event.id}">
            <i class="fas fa-share-nodes"></i> Share
        </button>
        <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="maps-btn">
            <i class="fas fa-map-location-dot"></i> Directions
        </a>
    `;

    // Hook up modal action buttons
    actions.querySelector('.save-btn')?.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        if (window.iplugPWA) {
            const saved = window.iplugPWA.saveEvent(event);
            btn.classList.toggle('saved', saved);
            btn.innerHTML = `<i class="${saved ? 'fas' : 'far'} fa-heart"></i> ${saved ? 'Saved' : 'Save Gig'}`;
            // Also update any card button in the background
            document.querySelectorAll(`.save-btn[data-event-id="${event.id}"]`).forEach(b => {
                b.classList.toggle('saved', saved);
                b.innerHTML = `<i class="${saved ? 'fas' : 'far'} fa-heart"></i> <span>${saved ? 'Saved' : 'Save'}</span>`;
            });
        }
    });

    actions.querySelector('.reminder-btn')?.addEventListener('click', () => {
        window.iplugPWA?.showReminderModal(event);
    });

    actions.querySelector('.calendar-btn')?.addEventListener('click', () => {
        showCalendarMenu(event.id);
    });

    actions.querySelector('.share-btn')?.addEventListener('click', () => {
        showShareMenu(event.id);
    });

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    const modal = document.getElementById('lightbox-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// ==========================================
// SUBMIT FORM (WHATSAPP INTEGRATION)
// ==========================================
function setupForm() {
    const form = document.getElementById('event-form');
    if (!form) return;

    const dateInput = document.getElementById('event-date');
    if (dateInput) {
        const now = new Date();
        const minIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        dateInput.min = minIso;
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!form.reportValidity()) return;

        const formData = new FormData(form);
        const name = formData.get('event-name');
        const date = formData.get('event-date');
        const venue = formData.get('venue');
        const category = formData.get('category');
        const flyer = formData.get('flyer-url') || 'Flyer image will be attached directly in chat';
        const contact = formData.get('contact-email');
        const desc = formData.get('description');

        const messageLines = [
            '🔥 *iPlug GQ Event Submission*',
            '--------------------------------',
            `*Event:* ${name}`,
            `*Date:* ${date}`,
            `*Venue:* ${venue}`,
            `*Category:* ${category}`,
            `*Flyer Link / Note:* ${flyer}`,
            `*Contact:* ${contact}`,
            '',
            `*Details / Lineup:*`,
            desc,
            '--------------------------------',
            'Please review my event for the upcoming weekly guide.'
        ];

        const whatsappUrl = `https://wa.me/27815294035?text=${encodeURIComponent(messageLines.join('\n'))}`;
        const statusEl = document.getElementById('form-status');

        window.open(whatsappUrl, '_blank');
        if (statusEl) {
            statusEl.innerHTML = `<strong>WhatsApp opened!</strong> Review your details in WhatsApp and tap <em>Send</em>. If you have the flyer image, please attach it directly in the chat.`;
        }
        form.reset();
    });
}

// ==========================================
// DEEP LINKING
// ==========================================
function setupDeepLinking() {
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get('event');
    if (!eventId) return;

    let attempts = 0;
    const interval = setInterval(() => {
        attempts++;
        const card = document.querySelector(`.event-card[data-id="${eventId}"]`);
        if (card) {
            clearInterval(interval);
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.style.borderColor = 'var(--primary)';
            card.style.boxShadow = '0 0 20px rgba(245, 255, 88, 0.4)';
            setTimeout(() => {
                const event = (window.allRawEvents || []).find(e => e.id == eventId);
                if (event) openLightbox(event);
            }, 500);
        }
        if (attempts > 20) clearInterval(interval);
    }, 250);
}

// ==========================================
// SCHEMA.ORG STRUCTURED DATA
// ==========================================
function injectSchemaStructuredData(events) {
    const upcoming = events.filter(e => !isEventPassed(e.date)).slice(0, 20);
    if (!upcoming.length) return;

    const schemaData = {
        '@context': 'https://schema.org',
        '@graph': upcoming.map(event => ({
            '@type': 'Event',
            'name': event.title,
            'startDate': `${event.date}T18:00:00+02:00`,
            'endDate': `${event.date}T23:59:59+02:00`,
            'eventStatus': 'https://schema.org/EventScheduled',
            'eventAttendanceMode': 'https://schema.org/OfflineEventAttendanceMode',
            'location': {
                '@type': 'Place',
                'name': event.venueName,
                'address': {
                    '@type': 'PostalAddress',
                    'addressLocality': 'Gqeberha',
                    'addressRegion': 'Eastern Cape',
                    'addressCountry': 'ZA'
                }
            },
            'image': [event.flyer],
            'description': event.description,
            'organizer': {
                '@type': 'Organization',
                'name': 'iPlug GQ',
                'url': 'https://ipluggq.com'
            }
        }))
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schemaData);
    document.head.appendChild(script);
}
