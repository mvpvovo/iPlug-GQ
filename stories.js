const storiesGrid = document.getElementById('stories-grid');
const storiesCount = document.getElementById('stories-count');

document.getElementById('current-year').textContent = new Date().getFullYear();

const menuToggle = document.querySelector('.menu-toggle');
const navList = document.getElementById('stories-nav');
menuToggle?.addEventListener('click', () => {
    const isOpen = navList.classList.toggle('show');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? 'Close navigation menu' : 'Open navigation menu');
    menuToggle.querySelector('i').className = isOpen ? 'fas fa-xmark' : 'fas fa-bars';
});

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}

function getVideoEmbed(url) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return null;
    }

    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be' || host === 'youtube.com' || host === 'm.youtube.com') {
        const videoId = host === 'youtu.be'
            ? parsed.pathname.split('/').filter(Boolean)[0]
            : parsed.pathname === '/watch'
                ? parsed.searchParams.get('v')
                : parsed.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1];
        return /^[\w-]{11}$/.test(videoId || '')
            ? { src: `https://www.youtube-nocookie.com/embed/${videoId}`, title: 'YouTube video' }
            : null;
    }

    if (host === 'tiktok.com' || host === 'vm.tiktok.com' || host === 'vt.tiktok.com') {
        const videoId = parsed.pathname.match(/\/video\/(\d+)/)?.[1];
        return videoId ? {
            src: `https://www.tiktok.com/player/v1/${videoId}`,
            title: 'TikTok video',
            vertical: true
        } : null;
    }

    if (host === 'instagram.com') {
        const match = parsed.pathname.match(/^\/(?:p|reel|tv)\/([\w-]+)/);
        return match ? {
            src: `https://www.instagram.com/${parsed.pathname.split('/').filter(Boolean)[0]}/${match[1]}/embed`,
            title: 'Instagram post or reel'
        } : null;
    }

    return null;
}

function renderVideo(url) {
    const embed = getVideoEmbed(url);
    if (!embed) return '';

    return `<iframe
        class="story-video${embed.vertical ? ' story-video--vertical' : ''}"
        src="${escapeHtml(embed.src)}"
        title="${escapeHtml(embed.title)}"
        loading="lazy"
        referrerpolicy="strict-origin-when-cross-origin"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen></iframe>`;
}

function renderGallery(photos) {
    const safePhotos = (Array.isArray(photos) ? photos : [])
        .filter(photo => photo && typeof photo.src === 'string'
            && /^images\/stories\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:jpe?g|png|webp|avif)$/i.test(photo.src));
    if (!safePhotos.length) return '';

    return `<div class="story-gallery" role="group" aria-label="Story photo gallery">${safePhotos.map(photo => `
        <img src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.alt || 'iPlug GQ story photo')}" loading="lazy" decoding="async">`
    ).join('')}</div>`;
}

function renderStory(story) {
    const title = escapeHtml(story.title);
    const category = escapeHtml(story.category || 'GQ Stories');
    const date = escapeHtml(story.date || '');
    const dateMarkup = date ? `<time datetime="${date}">${date}</time>` : '';
    const excerpt = escapeHtml(story.excerpt || '');
    const body = escapeHtml(story.body || '');
    const bodyMarkup = body ? `<p class="story-card-body">${body}</p>` : '';
    const media = `${renderVideo(story.videoUrl)}${renderGallery(story.photos)}`;

    return `<article class="story-card">
        ${media}
        <div class="story-card-content">
            <div class="story-card-meta"><span class="story-category">${category}</span>${dateMarkup}</div>
            <h3>${title}</h3>
            ${excerpt ? `<p class="story-card-excerpt">${excerpt}</p>` : ''}
            ${bodyMarkup}
        </div>
    </article>`;
}

async function loadStories() {
    try {
        const response = await fetch('stories.json', { cache: 'no-cache' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} loading stories.json`);
        }

        const stories = await response.json();
        if (!Array.isArray(stories)) {
            throw new TypeError('stories.json must contain a JSON array');
        }

        const publishedStories = stories.filter(story =>
            story && typeof story.title === 'string' && story.title.trim()
        );
        storiesCount.textContent = `${publishedStories.length} ${publishedStories.length === 1 ? 'story' : 'stories'}`;
        storiesGrid.innerHTML = publishedStories.length
            ? publishedStories.map(renderStory).join('')
            : `<div class="stories-empty">
                <span class="stories-empty-icon"><i class="fas fa-book-open" aria-hidden="true"></i></span>
                <h3>The first GQ stories are on the way.</h3>
                <p>We’re getting ready to share event moments, local venue finds, and conversations with the people behind the scene. Have a story idea or photos to share? Send it to the iPlug GQ team.</p>
                <a class="btn-small-outline" href="https://wa.me/27815294035?text=Hi%20iPlug%20GQ%2C%20I%20have%20a%20story%20idea%20to%20share." target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp" aria-hidden="true"></i> Share a story idea</a>
            </div>`;
        storiesGrid.setAttribute('aria-busy', 'false');
    } catch (error) {
        console.error('Error loading GQ Stories:', error);
        storiesCount.textContent = 'Stories unavailable';
        storiesGrid.innerHTML = `<div class="stories-empty" role="alert">
            <span class="stories-empty-icon"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i></span>
            <h3>Stories could not load.</h3>
            <p>Please check your connection and try again.</p>
            <button class="btn-small-outline" type="button" id="retry-stories">Try again</button>
        </div>`;
        storiesGrid.setAttribute('aria-busy', 'false');
        document.getElementById('retry-stories')?.addEventListener('click', loadStories);
    }
}

loadStories();
