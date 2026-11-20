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

        // Sort descending by releaseDate
        allReleases.sort((a, b) => new Date(b.releaseDate || b.publishDate) - new Date(a.releaseDate || a.publishDate));

        renderFeaturedReleases();
        renderMainGrid();
        renderArchive();
        setupToolbarListeners();
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
    const genreButtons = document.querySelectorAll('.nmf-genre-btn');
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
                </div>
            </div>
        </article>
    `).join('');
}

function renderMainGrid() {
    const gridEl = document.getElementById('nmf-grid');
    const countEl = document.getElementById('nmf-count-chip');
    if (!gridEl) return;

    let filtered = allReleases.filter(r => {
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
        countEl.textContent = `${filtered.length} Release${filtered.length === 1 ? '' : 's'}`;
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
        <article class="nmf-card" data-id="${escapeHtml(r.id)}">
            <div class="nmf-card-art-wrap">
                <img class="nmf-card-art" 
                     src="${escapeHtml(coverArtUrl)}" 
                     alt="${escapeHtml(r.title)} by ${escapeHtml(r.artistName)}" 
                     loading="lazy"
                     onerror="this.src='https://ik.imagekit.io/vurvay/placeholder/IMG_9774.jpg?tr=w-400,h-400,fo-auto'">
                <span class="nmf-card-type-badge">${escapeHtml(typeLabel)}</span>
                ${r.featured ? '<span class="nmf-card-feat-badge">⭐ PICK</span>' : ''}
            </div>
            <div class="nmf-card-body">
                <div class="nmf-card-meta-row">
                    <span class="nmf-card-genre">${escapeHtml(genreLabel)}</span>
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

    allReleases.forEach(release => {
        const dateStr = release.publishDate || release.releaseDate;
        if (!dateStr) return;
        const friday = getFridayOfWeek(dateStr);
        if (!weekGroups[friday]) {
            weekGroups[friday] = [];
        }
        weekGroups[friday].push(release);
    });

    const sortedWeeks = Object.keys(weekGroups).sort((a, b) => new Date(b) - new Date(a));

    if (sortedWeeks.length <= 1) {
        archiveContainer.innerHTML = `
            <p style="color:var(--text-muted); font-size:0.95rem; text-align:center; padding: 30px 0;">
                <i class="fas fa-clock-rotate-left"></i> Previous drops from past weeks will archive here automatically each Friday.
            </p>
        `;
        return;
    }

    // Show past weeks (skip the newest week which is displayed in the main grid)
    const pastWeeks = sortedWeeks.slice(1);

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
    }).join('');
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

        let releases = Array.isArray(data) ? data.filter(r => r.status === 'published') : [];
        const localApproved = getLocalApprovedReleases();
        if (localApproved.length > 0) releases = [...releases, ...localApproved];

        releases.sort((a, b) => new Date(b.releaseDate || b.publishDate) - new Date(a.releaseDate || a.publishDate));

        // Display latest 4–6 releases
        const latest = releases.slice(0, 6);

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
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return dateInput;
    const day = d.getDay(); // 0 is Sunday, 5 is Friday
    const diff = (day >= 5 ? 5 - day : -2 - day); // get nearest Friday
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
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
