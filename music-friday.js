// ==========================================================================
// iPlug GQ – New Music Friday (NMF) Script
// Fresh Sounds Every Friday from Mzansi & Eastern Cape
// ==========================================================================

const NMF_DATA_URL = './music-releases.json';

// Genre configurations & labels
const GENRE_LABELS = {
    'all': 'All Music',
    'amapiano': 'Amapiano',
    'afrohouse': 'Afro House',
    'threestep': '3-Step',
    'deephouse': 'Deep House',
    'hiphop': 'Hip-hop',
    'gqom': 'Gqom',
    'maskandi': 'Maskandi',
    'gospel': 'Gospel',
    'afropop': 'Afro-pop',
    'rnb': 'R&B',
    'kwaito': 'Kwaito',
    'other': 'Other'
};

const GENRE_ICONS = {
    'all': 'fa-headphones',
    'amapiano': 'fa-drum',
    'afrohouse': 'fa-compact-disc',
    'threestep': 'fa-music',
    'deephouse': 'fa-water',
    'hiphop': 'fa-microphone',
    'gqom': 'fa-bolt',
    'maskandi': 'fa-guitar',
    'gospel': 'fa-hands-praying',
    'afropop': 'fa-star',
    'rnb': 'fa-heart',
    'kwaito': 'fa-fire',
    'other': 'fa-headphones'
};

const RELEASE_TYPES = {
    'single': 'Single',
    'ep': 'EP',
    'album': 'Album'
};

// Global State
let allReleases = [];
let activeGenre = 'all';
let activeLocal = false;        // "Eastern Cape" filter chip
let latestWeek = null;          // Friday (YYYY-MM-DD) of the newest published drop
let nmfAudio = null;            // shared audio player for 30-second previews
let nmfPlayingId = null;
let activeType = 'all';
let searchQuery = '';

document.addEventListener('DOMContentLoaded', () => {
    // Dynamic year in footer
    const currentYearEl = document.getElementById('current-year');
    if (currentYearEl) {
        currentYearEl.textContent = new Date().getFullYear();
    }

    setupMobileNav();

    if (document.body.classList.contains('nmf-page')) {
        setupNMFPage();
        setupSubmissionForm();
    }

    if (document.getElementById('nmf-teaser-grid')) {
        setupNMFTeaser();
    }
});

// ==========================================================================
// MOBILE NAVIGATION
// ==========================================================================
function setupMobileNav() {
    const menuToggle = document.querySelector('.menu-toggle');
    const navUl = document.querySelector('nav ul');

    if (menuToggle && navUl) {
        menuToggle.addEventListener('click', () => {
            const isOpen = navUl.classList.toggle('show');
            menuToggle.setAttribute('aria-expanded', String(isOpen));
            menuToggle.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
            const icon = menuToggle.querySelector('i');
            if (icon) {
                icon.className = isOpen ? 'fas fa-xmark' : 'fas fa-bars';
            }
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!navUl.contains(e.target) && !menuToggle.contains(e.target) && navUl.classList.contains('show')) {
                navUl.classList.remove('show');
                menuToggle.setAttribute('aria-expanded', 'false');
                const icon = menuToggle.querySelector('i');
                if (icon) icon.className = 'fas fa-bars';
            }
        });

        navUl.querySelectorAll('a, button').forEach(link => {
            link.addEventListener('click', () => {
                navUl.classList.remove('show');
                menuToggle.setAttribute('aria-expanded', 'false');
                const icon = menuToggle.querySelector('i');
                if (icon) icon.className = 'fas fa-bars';
            });
        });
    }
}

// ==========================================================================
// NEW MUSIC FRIDAY PAGE LOGIC
// ==========================================================================
async function setupNMFPage() {
    const gridEl = document.getElementById('nmf-grid');
    if (!gridEl) return;

    try {
        const response = await fetch(NMF_DATA_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        // Security & Status Filter: Only show published releases to the public
        allReleases = Array.isArray(data) ? data.filter(r => r.status === 'published') : [];

        // Check for any approved submissions saved in local storage
        const localApproved = getLocalApprovedReleases();
        if (localApproved.length > 0) {
            allReleases = [...allReleases, ...localApproved];
        }

        // Scheduling: releases with a future publishDate stay hidden until that day
        const today = todayIso();
        allReleases = allReleases.filter(r => (r.publishDate || r.releaseDate || '') <= today);

        // Sort descending by releaseDate
        allReleases.sort((a, b) => new Date(b.releaseDate || b.publishDate) - new Date(a.releaseDate || a.publishDate));

        // "This week's drop" = releases published in the newest Friday week
        latestWeek = allReleases
            .map(r => getFridayOfWeek(r.publishDate || r.releaseDate))
            .filter(Boolean).sort().pop() || null;

        renderFeaturedReleases();
        renderMainGrid();
        renderArchive();
        setupToolbarListeners();
        setupPreviewAndShare();
        openReleaseFromHash();
    } catch (err) {
        console.error('[NMF] Error loading releases:', err);
        gridEl.innerHTML = `
            <div class="nmf-empty">
                <i class="fas fa-triangle-exclamation"></i>
                <h3>Unable to load releases right now</h3>
                <p>Please check back soon for this week's New Music Friday drops.</p>
            </div>
        `;
    }
}

function setupToolbarListeners() {
    // Search input
    const searchInput = document.getElementById('nmf-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            searchQuery = e.target.value.trim().toLowerCase();
            renderMainGrid();
        }, 250));
    }

    // Type filter select
    const typeSelect = document.getElementById('nmf-type-filter');
    if (typeSelect) {
        typeSelect.addEventListener('change', (e) => {
            activeType = e.target.value;
            renderMainGrid();
        });
    }

    // Genre buttons
    const localBtn = document.querySelector('.nmf-local-btn');
    if (localBtn) {
        localBtn.addEventListener('click', () => {
            activeLocal = !activeLocal;
            localBtn.classList.toggle('active', activeLocal);
            localBtn.setAttribute('aria-pressed', String(activeLocal));
            renderMainGrid();
        });
    }

    const genreButtons = document.querySelectorAll('.nmf-genre-btn:not(.nmf-local-btn)');
    genreButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            genreButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeGenre = btn.getAttribute('data-genre') || 'all';
            renderMainGrid();
        });
    });
}

function renderFeaturedReleases() {
    const featuredSection = document.getElementById('nmf-featured');
    const featuredGrid = document.getElementById('nmf-featured-grid');
    if (!featuredGrid) return;

    const featured = allReleases.filter(r => r.featured === true);

    if (featured.length === 0) {
        if (featuredSection) featuredSection.style.display = 'none';
        return;
    }

    if (featuredSection) featuredSection.style.display = 'block';

    featuredGrid.innerHTML = featured.map(r => `
        <article class="nmf-featured-card" data-id="${escapeHtml(r.id)}">
            <div class="nmf-featured-art-wrap">
                ${renderPlayButton(r)}
                <img src="${escapeHtml(r.coverArt || 'https://ik.imagekit.io/vurvay/placeholder/IMG_9774.jpg?tr=w-400,h-400,fo-auto')}" 
                     alt="${escapeHtml(r.title)} by ${escapeHtml(r.artistName)}" 
                     loading="lazy" 
                     onerror="this.src='https://ik.imagekit.io/vurvay/placeholder/IMG_9774.jpg?tr=w-400,h-400,fo-auto'">
            </div>
            <div class="nmf-featured-info">
                <div class="nmf-badge-row">
                    <span class="nmf-pill-pick"><i class="fas fa-star"></i> Editor's Pick</span>
                    <span class="nmf-pill-genre">${escapeHtml(GENRE_LABELS[r.genre] || r.genre)} · ${escapeHtml(RELEASE_TYPES[r.releaseType] || r.releaseType)}</span>
                </div>
                <h3 class="nmf-featured-title">${escapeHtml(r.title)}</h3>
                <p class="nmf-featured-artist">
                    ${escapeHtml(r.artistName)} 
                    ${r.featuredArtists ? `<span class="nmf-feat">${escapeHtml(r.featuredArtists)}</span>` : ''}
                </p>
                ${r.description ? `<p class="nmf-featured-desc">${escapeHtml(r.description)}</p>` : ''}
                <div class="nmf-card-date">
                    <i class="far fa-calendar-alt"></i> ${formatDisplayDate(r.releaseDate || r.publishDate)} 
                    ${r.province ? `· <i class="fas fa-location-dot"></i> ${escapeHtml(r.province)}` : ''}
                </div>
                <div class="nmf-card-links" style="padding: 10px 0 0; background: transparent; border-top: none;">
                    ${renderListenButtons(r.links)}
                    ${renderShareButton(r)}
                </div>
            </div>
        </article>
    `).join('');
}

function renderMainGrid() {
    const gridEl = document.getElementById('nmf-grid');
    const countEl = document.getElementById('nmf-count-chip');
    if (!gridEl) return;

    const isBrowsing = activeGenre === 'all' && activeType === 'all' && !searchQuery && !activeLocal;

    let filtered = allReleases.filter(r => {
        // Default view: only this week's new drop (older weeks + throwbacks live in the archive)
        if (isBrowsing && latestWeek &&
            (getFridayOfWeek(r.publishDate || r.releaseDate) !== latestWeek || isThrowback(r))) {
            return false;
        }
        // Eastern Cape filter
        if (activeLocal && !isEasternCape(r)) return false;
        // Genre match
        if (activeGenre !== 'all' && (r.genre || '').toLowerCase() !== activeGenre.toLowerCase()) {
            return false;
        }
        // Type match
        if (activeType !== 'all' && (r.releaseType || '').toLowerCase() !== activeType.toLowerCase()) {
            return false;
        }
        // Search query match (artist, title, featured artists, genre)
        if (searchQuery) {
            const text = `${r.title} ${r.artistName} ${r.featuredArtists || ''} ${GENRE_LABELS[r.genre] || r.genre} ${r.description || ''}`.toLowerCase();
            if (!text.includes(searchQuery)) return false;
        }
        return true;
    });

    if (countEl) {
        const n = `${filtered.length} Release${filtered.length === 1 ? '' : 's'}`;
        countEl.textContent = isBrowsing && latestWeek
            ? `${n} · Friday ${formatDisplayDate(latestWeek)}`
            : `${n} · all weeks`;
    }

    if (filtered.length === 0) {
        gridEl.innerHTML = `
            <div class="nmf-empty">
                <i class="fas fa-compact-disc"></i>
                <h3>No releases found</h3>
                <p>Try switching to "All Music" or searching with different keywords.</p>
            </div>
        `;
        return;
    }

    gridEl.innerHTML = filtered.map(r => createMusicCardHtml(r)).join('');
}

function createMusicCardHtml(r) {
    const genreLabel = GENRE_LABELS[r.genre] || r.genre || 'Music';
    const typeLabel = RELEASE_TYPES[r.releaseType] || r.releaseType || 'Single';
    const coverArtUrl = r.coverArt || 'https://ik.imagekit.io/vurvay/placeholder/IMG_9774.jpg?tr=w-400,h-400,fo-auto';

    return `
        <article class="nmf-card" id="${releaseAnchor(r)}" data-id="${escapeHtml(r.id)}">
            <div class="nmf-card-art-wrap">
                <img class="nmf-card-art" 
                     src="${escapeHtml(coverArtUrl)}" 
                     alt="${escapeHtml(r.title)} by ${escapeHtml(r.artistName)}" 
                     loading="lazy"
                     onerror="this.src='https://ik.imagekit.io/vurvay/placeholder/IMG_9774.jpg?tr=w-400,h-400,fo-auto'">
                <span class="nmf-card-type-badge">${escapeHtml(typeLabel)}</span>
                ${r.featured ? '<span class="nmf-card-feat-badge">⭐ PICK</span>' : ''}
                ${renderPlayButton(r)}
            </div>
            <div class="nmf-card-body">
                <div class="nmf-card-meta-row">
                    <span class="nmf-card-genre">${escapeHtml(genreLabel)}${isEasternCape(r) ? ' <span class="nmf-ec-badge" title="Eastern Cape talent">EC 🔥</span>' : ''}</span>
                    ${r.province ? `<span class="nmf-card-province"><i class="fas fa-location-dot"></i> ${escapeHtml(r.province)}</span>` : ''}
                </div>
                <h3 class="nmf-card-title">${escapeHtml(r.title)}</h3>
                <p class="nmf-card-artist">${escapeHtml(r.artistName)}</p>
                ${r.featuredArtists ? `<p class="nmf-card-feat">${escapeHtml(r.featuredArtists)}</p>` : ''}
                ${r.description ? `<p class="nmf-card-desc">${escapeHtml(r.description)}</p>` : ''}
                <div class="nmf-card-date">
                    <i class="far fa-calendar"></i> ${formatDisplayDate(r.releaseDate || r.publishDate)}
                    ${r.recordLabel ? `· <span title="Record Label">${escapeHtml(r.recordLabel)}</span>` : ''}
                </div>
            </div>
            <div class="nmf-card-links">
                ${renderListenButtons(r.links)}
                ${renderShareButton(r)}
            </div>
        </article>
    `;
}

function renderListenButtons(links) {
    if (!links || typeof links !== 'object') return '';

    const buttons = [];

    // Spotify
    if (links.spotify && isValidUrl(links.spotify)) {
        buttons.push(`
            <a href="${escapeHtml(links.spotify)}" target="_blank" rel="noopener noreferrer" 
               class="nmf-listen-btn nmf-listen-btn--spotify" aria-label="Listen on Spotify">
               <i class="fab fa-spotify"></i> Spotify
            </a>
        `);
    }

    // Apple Music
    if (links.apple && isValidUrl(links.apple)) {
        buttons.push(`
            <a href="${escapeHtml(links.apple)}" target="_blank" rel="noopener noreferrer" 
               class="nmf-listen-btn nmf-listen-btn--apple" aria-label="Listen on Apple Music">
               <i class="fab fa-apple"></i> Apple Music
            </a>
        `);
    }

    // YouTube
    if (links.youtube && isValidUrl(links.youtube)) {
        buttons.push(`
            <a href="${escapeHtml(links.youtube)}" target="_blank" rel="noopener noreferrer" 
               class="nmf-listen-btn nmf-listen-btn--youtube" aria-label="Watch on YouTube">
               <i class="fab fa-youtube"></i> YouTube
            </a>
        `);
    }

    // SoundCloud
    if (links.soundcloud && isValidUrl(links.soundcloud)) {
        buttons.push(`
            <a href="${escapeHtml(links.soundcloud)}" target="_blank" rel="noopener noreferrer" 
               class="nmf-listen-btn nmf-listen-btn--soundcloud" aria-label="Listen on SoundCloud">
               <i class="fab fa-soundcloud"></i> SoundCloud
            </a>
        `);
    }

    // Other streaming link
    if (links.other && isValidUrl(links.other)) {
        buttons.push(`
            <a href="${escapeHtml(links.other)}" target="_blank" rel="noopener noreferrer" 
               class="nmf-listen-btn nmf-listen-btn--other" aria-label="Listen to Release">
               <i class="fas fa-link"></i> Listen
            </a>
        `);
    }

    if (buttons.length === 0) {
        return `<span style="font-size:0.75rem; color:var(--text-dim);"><i class="fas fa-headphones"></i> Release dropping soon</span>`;
    }

    return buttons.join('');
}

// ==========================================================================
// PREVIOUS RELEASES ARCHIVE
// ==========================================================================
function renderArchive() {
    const archiveContainer = document.getElementById('nmf-archive');
    if (!archiveContainer) return;

    // Group releases by Friday / Week
    const weekGroups = {};

    const throwbacks = allReleases.filter(isThrowback);

    allReleases.forEach(release => {
        if (isThrowback(release)) return;
        const dateStr = release.publishDate || release.releaseDate;
        if (!dateStr) return;
        const friday = getFridayOfWeek(dateStr);
        if (!weekGroups[friday]) {
            weekGroups[friday] = [];
        }
        weekGroups[friday].push(release);
    });

    const sortedWeeks = Object.keys(weekGroups).sort((a, b) => new Date(b) - new Date(a));

    if (sortedWeeks.length <= 1 && throwbacks.length === 0) {
        archiveContainer.innerHTML = `
            <p style="color:var(--text-muted); font-size:0.95rem; text-align:center; padding: 30px 0;">
                <i class="fas fa-clock-rotate-left"></i> Previous drops from past weeks will archive here automatically each Friday.
            </p>
        `;
        return;
    }

    // Show past weeks (the newest week is displayed in the main grid)
    const pastWeeks = sortedWeeks.filter(w => w !== latestWeek);

    const throwbackHtml = throwbacks.length ? `
            <div class="nmf-week-group">
                <button type="button" class="nmf-week-header" onclick="this.parentElement.classList.toggle('open')">
                    <span><i class="fas fa-clock-rotate-left" style="color:var(--secondary); margin-right:8px;"></i> Throwbacks: older tracks worth a replay</span>
                    <span>
                        <span class="nmf-count-chip" style="margin-right:12px;">${throwbacks.length} Release${throwbacks.length === 1 ? '' : 's'}</span>
                        <i class="fas fa-chevron-down"></i>
                    </span>
                </button>
                <div class="nmf-week-body">
                    <div class="nmf-archive-grid">
                        ${throwbacks.map(r => createMusicCardHtml(r)).join('')}
                    </div>
                </div>
            </div>` : '';

    archiveContainer.innerHTML = pastWeeks.map((weekDate, index) => {
        const count = weekGroups[weekDate].length;
        const isOpen = index === 0 ? 'open' : '';

        return `
            <div class="nmf-week-group ${isOpen}">
                <button type="button" class="nmf-week-header" onclick="this.parentElement.classList.toggle('open')">
                    <span><i class="fas fa-calendar-check" style="color:var(--primary); margin-right:8px;"></i> Friday, ${formatDisplayDate(weekDate)}</span>
                    <span>
                        <span class="nmf-count-chip" style="margin-right:12px;">${count} Release${count === 1 ? '' : 's'}</span>
                        <i class="fas fa-chevron-down"></i>
                    </span>
                </button>
                <div class="nmf-week-body">
                    <div class="nmf-archive-grid">
                        ${weekGroups[weekDate].map(r => createMusicCardHtml(r)).join('')}
                    </div>
                </div>
            </div>
        `;
    }).join('') + throwbackHtml;
}

// ==========================================================================
// HOMEPAGE COMPACT TEASER
// ==========================================================================
async function setupNMFTeaser() {
    const teaserGrid = document.getElementById('nmf-teaser-grid');
    if (!teaserGrid) return;

    try {
        const response = await fetch(NMF_DATA_URL);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const data = await response.json();

        let releases = Array.isArray(data) ? data.filter(r => r.status === 'published' && (r.publishDate || r.releaseDate || '') <= todayIso()) : [];
        const localApproved = getLocalApprovedReleases();
        if (localApproved.length > 0) releases = [...releases, ...localApproved];

        releases.sort((a, b) => new Date(b.releaseDate || b.publishDate) - new Date(a.releaseDate || a.publishDate));

        // Display latest 4–6 releases
        const latest = releases.filter(r => !isThrowback(r)).slice(0, 6);

        if (latest.length === 0) {
            const section = document.getElementById('nmf-teaser');
            if (section) section.style.display = 'none';
            return;
        }

        teaserGrid.innerHTML = latest.map(r => {
            const firstLink = r.links?.youtube || r.links?.spotify || r.links?.apple || r.links?.soundcloud || r.links?.other || 'music-friday.html';
            const genreLabel = GENRE_LABELS[r.genre] || r.genre || 'Music';
            const coverArtUrl = r.coverArt || 'https://ik.imagekit.io/vurvay/placeholder/IMG_9774.jpg?tr=w-160,h-160,fo-auto';

            return `
                <a href="${escapeHtml(firstLink)}" target="_blank" rel="noopener noreferrer" class="nmf-teaser-card" title="Listen to ${escapeHtml(r.title)} by ${escapeHtml(r.artistName)}">
                    <img class="nmf-teaser-card-art" 
                         src="${escapeHtml(coverArtUrl)}" 
                         alt="${escapeHtml(r.title)}" 
                         loading="lazy"
                         onerror="this.src='https://ik.imagekit.io/vurvay/placeholder/IMG_9774.jpg?tr=w-160,h-160,fo-auto'">
                    <div class="nmf-teaser-card-info">
                        <span class="nmf-teaser-card-genre">${escapeHtml(genreLabel)}</span>
                        <h4 class="nmf-teaser-card-title">${escapeHtml(r.title)}</h4>
                        <p class="nmf-teaser-card-artist">${escapeHtml(r.artistName)}</p>
                    </div>
                </a>
            `;
        }).join('');
    } catch (err) {
        console.warn('[NMF] Teaser load failed:', err);
        const section = document.getElementById('nmf-teaser');
        if (section) section.style.display = 'none';
    }
}

// ==========================================================================
// SUBMISSION FORM LOGIC (WhatsApp + Email + Local Pending Queue)
// ==========================================================================
function setupSubmissionForm() {
    const form = document.getElementById('nmf-submit-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const artistName = document.getElementById('sub-artist')?.value.trim();
        const title = document.getElementById('sub-title')?.value.trim();
        const genre = document.getElementById('sub-genre')?.value;
        const releaseType = document.getElementById('sub-type')?.value;
        const releaseDate = document.getElementById('sub-date')?.value;
        const contact = document.getElementById('sub-contact')?.value.trim();
        const primaryLink = document.getElementById('sub-link')?.value.trim();

        // Optional fields
        const featuredArtists = document.getElementById('sub-feat')?.value.trim() || '';
        const recordLabel = document.getElementById('sub-label')?.value.trim() || 'Independent';
        const description = document.getElementById('sub-desc')?.value.trim() || '';
        const province = document.getElementById('sub-province')?.value || 'Eastern Cape';
        const coverArt = document.getElementById('sub-art')?.value.trim() || '';
        const spotify = document.getElementById('sub-spotify')?.value.trim() || '';
        const apple = document.getElementById('sub-apple')?.value.trim() || '';
        const youtube = document.getElementById('sub-youtube')?.value.trim() || '';
        const soundcloud = document.getElementById('sub-soundcloud')?.value.trim() || '';

        const consent = document.getElementById('sub-consent')?.checked;

        if (!artistName || !title || !genre || !releaseType || !releaseDate || !contact || !primaryLink) {
            alert('Please fill in all required fields marked with *');
            return;
        }

        if (!consent) {
            alert('Please confirm the consent checkbox regarding artwork and promotional rights.');
            return;
        }

        // Create submission record
        const newSubmission = {
            id: slugify(`${artistName}-${title}-${Date.now()}`),
            status: 'pending',
            featured: false,
            releaseType,
            title,
            artistName,
            featuredArtists,
            genre,
            releaseDate,
            publishDate: getFridayOfWeek(releaseDate),
            coverArt: coverArt || 'https://ik.imagekit.io/vurvay/placeholder/IMG_9774.jpg?tr=w-400,h-400,fo-auto',
            description,
            province,
            recordLabel,
            contact,
            links: {
                spotify: spotify || (primaryLink.includes('spotify') ? primaryLink : ''),
                apple: apple || (primaryLink.includes('apple') ? primaryLink : ''),
                youtube: youtube || (primaryLink.includes('youtube') || primaryLink.includes('youtu.be') ? primaryLink : ''),
                soundcloud: soundcloud || (primaryLink.includes('soundcloud') ? primaryLink : ''),
                other: primaryLink
            },
            submittedAt: new Date().toISOString(),
            approvedAt: null
        };

        // Save to pending queue in localStorage so admin dashboard can review it
        saveSubmissionLocally(newSubmission);

        // Format WhatsApp dispatch
        const waText = encodeURIComponent(
            `🎵 *NEW MUSIC FRIDAY SUBMISSION*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `• *Artist:* ${artistName}\n` +
            `• *Song/Album:* ${title}\n` +
            `• *Genre:* ${GENRE_LABELS[genre] || genre}\n` +
            `• *Type:* ${RELEASE_TYPES[releaseType] || releaseType}\n` +
            `• *Release Date:* ${releaseDate}\n` +
            (featuredArtists ? `• *Featured:* ${featuredArtists}\n` : '') +
            `• *Location:* ${province}\n` +
            `• *Contact:* ${contact}\n` +
            `• *Listening Link:* ${primaryLink}\n` +
            (coverArt ? `• *Cover Art:* ${coverArt}\n` : '') +
            (description ? `• *Details:* ${description}\n` : '') +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `_Submitted via iPlugGQ.com New Music Friday portal_`
        );

        // Show confirmation banner
        const successBanner = document.getElementById('nmf-success-banner');
        if (successBanner) {
            successBanner.style.display = 'block';
            successBanner.scrollIntoView({ behavior: 'smooth' });
        }

        // Open WhatsApp directly with prefilled details
        window.open(`https://wa.me/27815294035?text=${waText}`, '_blank');

        form.reset();
    });
}

// Local Storage helpers for zero-cost pending submission queue
function saveSubmissionLocally(sub) {
    try {
        const existing = JSON.parse(localStorage.getItem('iPlug_NMF_PendingSubmissions') || '[]');
        // Check for duplicates
        const isDuplicate = existing.some(item => 
            item.title.toLowerCase() === sub.title.toLowerCase() && 
            item.artistName.toLowerCase() === sub.artistName.toLowerCase() &&
            item.releaseDate === sub.releaseDate
        );
        if (!isDuplicate) {
            existing.unshift(sub);
            localStorage.setItem('iPlug_NMF_PendingSubmissions', JSON.stringify(existing));
        }
    } catch (e) {
        console.warn('[NMF] LocalStorage unavailable:', e);
    }
}

function getLocalApprovedReleases() {
    try {
        const approved = JSON.parse(localStorage.getItem('iPlug_NMF_ApprovedReleases') || '[]');
        return Array.isArray(approved) ? approved : [];
    } catch (e) {
        return [];
    }
}

// ==========================================================================
// UTILITY FUNCTIONS
// ==========================================================================
function getFridayOfWeek(dateInput) {
    // Returns the Friday on or before the given date (YYYY-MM-DD). Uses UTC so it
    // gives the same answer in every timezone.
    if (!dateInput) return null;
    const m = String(dateInput).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return dateInput;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    const day = d.getUTCDay(); // 0 = Sunday, 5 = Friday
    const diff = day >= 5 ? 5 - day : -2 - day;
    d.setUTCDate(d.getUTCDate() + diff);
    return d.toISOString().split('T')[0];
}

function todayIso() {
    // Today's date in South Africa (SAST), YYYY-MM-DD
    return new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10);
}

function isThrowback(r) {
    // Released more than a year before the week it was added to NMF
    const rel = r.releaseDate, pub = r.publishDate || r.releaseDate;
    if (!rel || !pub) return false;
    return (new Date(pub) - new Date(rel)) > 365 * 24 * 3600 * 1000;
}

function isEasternCape(r) {
    return /eastern\s*cape/i.test(r.province || '');
}

function releaseAnchor(r) {
    return 'r-' + slugify(`${r.artistName || ''} ${r.title || ''}`).slice(0, 80);
}

// ==========================================================================
// 30-SECOND PREVIEWS & SHARING
// ==========================================================================
function renderPlayButton(r) {
    if (!r.previewUrl || !isValidUrl(r.previewUrl)) return '';
    return `
        <button type="button" class="nmf-play-btn" data-id="${escapeHtml(r.id)}"
                aria-label="Play 30-second preview of ${escapeHtml(r.title)} by ${escapeHtml(r.artistName)}">
            <i class="fas fa-play" aria-hidden="true"></i>
            <span class="nmf-play-label">Preview</span>
        </button>`;
}

function renderShareButton(r) {
    return `
        <button type="button" class="nmf-listen-btn nmf-share-btn" data-id="${escapeHtml(r.id)}" aria-label="Share ${escapeHtml(r.title)}">
            <i class="fas fa-share-nodes" aria-hidden="true"></i> Share
        </button>`;
}

function trackEvent(name, params) {
    if (typeof window.gtag === 'function') window.gtag('event', name, params);
}

function setPlayingUi(id, playing) {
    document.querySelectorAll('.nmf-play-btn').forEach(btn => {
        const isThis = btn.getAttribute('data-id') === id && playing;
        btn.classList.toggle('playing', isThis);
        const icon = btn.querySelector('i');
        if (icon) icon.className = isThis ? 'fas fa-pause' : 'fas fa-play';
        const label = btn.querySelector('.nmf-play-label');
        if (label) label.textContent = isThis ? 'Playing' : 'Preview';
    });
}

function setupPreviewAndShare() {
    if (document.body.dataset.nmfBound) return;
    document.body.dataset.nmfBound = '1';

    document.addEventListener('click', (e) => {
        const playBtn = e.target.closest('.nmf-play-btn');
        if (playBtn) {
            e.preventDefault();
            e.stopPropagation();
            const id = playBtn.getAttribute('data-id');
            const r = allReleases.find(x => String(x.id) === id);
            if (!r || !r.previewUrl) return;

            if (!nmfAudio) {
                nmfAudio = new Audio();
                nmfAudio.preload = 'none';
                nmfAudio.addEventListener('ended', () => { setPlayingUi(nmfPlayingId, false); nmfPlayingId = null; });
                nmfAudio.addEventListener('error', () => { setPlayingUi(nmfPlayingId, false); nmfPlayingId = null; });
            }
            if (nmfPlayingId === id && !nmfAudio.paused) {
                nmfAudio.pause();
                setPlayingUi(id, false);
                nmfPlayingId = null;
                return;
            }
            nmfAudio.src = r.previewUrl;
            nmfAudio.play().then(() => {
                nmfPlayingId = id;
                setPlayingUi(id, true);
                trackEvent('nmf_preview_play', { release: `${r.artistName} – ${r.title}` });
            }).catch(() => setPlayingUi(id, false));
            return;
        }

        const shareBtn = e.target.closest('.nmf-share-btn');
        if (shareBtn) {
            e.preventDefault();
            const r = allReleases.find(x => String(x.id) === shareBtn.getAttribute('data-id'));
            if (!r) return;
            const url = `https://ipluggq.com/music-friday.html#${releaseAnchor(r)}`;
            const text = `🎧 ${r.title} by ${r.artistName}, out now on iPlug GQ New Music Friday`;
            trackEvent('nmf_share', { release: `${r.artistName} – ${r.title}` });
            if (navigator.share) {
                navigator.share({ title: r.title, text, url }).catch(() => {});
            } else {
                window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank', 'noopener');
            }
        }
    });

    // Count outbound streaming clicks (Spotify / Apple / YouTube…)
    document.addEventListener('click', (e) => {
        const a = e.target.closest('a.nmf-listen-btn');
        if (!a) return;
        const platform = (a.className.match(/nmf-listen-btn--(\w+)/) || [])[1] || 'other';
        trackEvent('nmf_listen_click', { platform });
    });

    window.addEventListener('hashchange', openReleaseFromHash);
}

function resetFilters() {
    activeGenre = 'all'; activeType = 'all'; searchQuery = ''; activeLocal = false;
    document.querySelectorAll('.nmf-genre-btn').forEach(b =>
        b.classList.toggle('active', b.getAttribute('data-genre') === 'all'));
    const localBtn = document.querySelector('.nmf-local-btn');
    if (localBtn) localBtn.setAttribute('aria-pressed', 'false');
    const typeSelect = document.getElementById('nmf-type-filter');
    if (typeSelect) typeSelect.value = 'all';
    const searchInput = document.getElementById('nmf-search');
    if (searchInput) searchInput.value = '';
    renderMainGrid();
}

function openReleaseFromHash() {
    const hash = decodeURIComponent(window.location.hash || '');
    if (!hash.startsWith('#r-')) return;
    let el = document.getElementById(hash.slice(1));
    if (!el) {
        // Not in this week's grid – maybe in a filtered-out state; reset filters and retry
        resetFilters();
        el = document.getElementById(hash.slice(1));
    }
    if (!el) return;
    const week = el.closest('.nmf-week-group');
    if (week) week.classList.add('open');
    setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('nmf-highlight');
        setTimeout(() => el.classList.remove('nmf-highlight'), 3500);
    }, 150);
}

function formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    try {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const year = parts[0];
            const month = months[parseInt(parts[1], 10) - 1] || parts[1];
            const day = parseInt(parts[2], 10);
            return `${day} ${month} ${year}`;
        }
        return dateStr;
    } catch (e) {
        return dateStr;
    }
}

function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
