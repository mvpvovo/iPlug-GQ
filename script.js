// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    // Set current year in footer
    document.getElementById('current-year').textContent = new Date().getFullYear();

    // Mobile menu toggle
    const menuToggle = document.querySelector('.menu-toggle');
    const navUl = document.querySelector('nav ul');
    
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            navUl.classList.toggle('show');
            // Change menu icon
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

    // Close mobile menu when clicking a link
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

    // Load events from events.json
    loadEvents();

    // Filter buttons
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Update active button
            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Filter events
            const filter = this.getAttribute('data-filter');
            filterEvents(filter);
        });
    });

    // Form submission handling
    setupForm();
    
    // Initialize navigation
    setupNavigation();
    
    // Initialize lightbox
    setupLightbox();
    
    // Check initial hash
    checkHash();
});

// Check URL hash on load
function checkHash() {
    const hash = window.location.hash;
    if (hash === '#saved') {
        showSavedEvents();
    } else {
        showMainEvents();
    }
}

// Setup navigation between sections
function setupNavigation() {
    // Home link - show main events
    document.querySelector('a[href="#home"]').addEventListener('click', function(e) {
        e.preventDefault();
        showMainEvents();
        window.history.pushState(null, null, '#home');
    });
    
    // Events link - show main events
    document.querySelector('a[href="#events"]').addEventListener('click', function(e) {
        e.preventDefault();
        showMainEvents();
        window.history.pushState(null, null, '#events');
    });
    
    // Saved Events link
    const savedLink = document.getElementById('saved-link');
    if (savedLink) {
        savedLink.addEventListener('click', function(e) {
            e.preventDefault();
            showSavedEvents();
            window.history.pushState(null, null, '#saved');
        });
    }
}

// Show main events section
function showMainEvents() {
    document.querySelector('.events').style.display = 'block';
    document.querySelector('.saved-events').style.display = 'none';
    document.querySelector('.hero').style.display = 'flex';
    document.querySelector('.submit').style.display = 'block';
    
    // Update active nav link
    document.querySelectorAll('nav a').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector('a[href="#home"]').classList.add('active');
}

// Show saved events section
function showSavedEvents() {
    document.querySelector('.events').style.display = 'none';
    document.querySelector('.saved-events').style.display = 'block';
    document.querySelector('.hero').style.display = 'none';
    document.querySelector('.submit').style.display = 'none';
    
    // Update active nav link
    document.querySelectorAll('nav a').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector('#saved-link').classList.add('active');
    
    // Load saved events
    loadSavedEvents();
}

// Load events from JSON file
function loadEvents() {
    fetch('events.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load events');
            }
            return response.json();
        })
        .then(events => {
            window.allEvents = events; // Store for filtering
            displayEvents(events);
        })
        .catch(error => {
            console.error('Error loading events:', error);
            const container = document.getElementById('events-container');
            container.innerHTML = `
                <div class="no-events">
                    <p>Unable to load events. Please check back soon or submit your event!</p>
                    <p><small>Error: ${error.message}</small></p>
                </div>
            `;
        });
}

// Display events in the container WITH SAVE/REMINDER BUTTONS
function displayEvents(events) {
    const container = document.getElementById('events-container');
    if (!container) return;

    if (events.length === 0) {
        container.innerHTML = `
            <div class="no-events">
                <p><i class="fas fa-calendar-times fa-2x" style="margin-bottom: 15px; color: var(--accent);"></i></p>
                <p>No events listed this week. Check back soon or submit your event!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = events.map(event => {
        const isSaved = window.iplugPWA?.isEventSaved(event.id) || false;
        
        return `
            <div class="event-card" data-category="${event.category}" data-id="${event.id}">
                <img src="${event.flyer}" alt="${event.title} flyer" class="event-img" onerror="this.src='https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80'">
                <div class="event-info">
                    <span class="event-date"><i class="far fa-calendar"></i> ${formatDate(event.date)}</span>
                    <h3 class="event-title">${event.title}</h3>
                    <p class="event-venue"><i class="fas fa-map-marker-alt"></i> ${event.venue}</p>
                    <p class="event-description">${event.description}</p>
                    <div class="event-actions">
                        <button class="save-btn ${isSaved ? 'saved' : ''}" onclick="toggleSaveEvent(${event.id}, ${JSON.stringify(event).replace(/'/g, "\\'")})">
                            <i class="${isSaved ? 'fas' : 'far'} fa-heart"></i> ${isSaved ? 'Saved' : 'Save'}
                        </button>
                        <button class="reminder-btn" onclick="showReminderOptions(${event.id}, ${JSON.stringify(event).replace(/'/g, "\\'")})">
                            <i class="far fa-bell"></i> Remind
                        </button>
                        <span class="event-category">${event.categoryLabel}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Format date from YYYY-MM-DD to DD Month YYYY
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        weekday: 'short',
        day: 'numeric', 
        month: 'short',
        year: 'numeric'
    });
}

// Filter events by category
function filterEvents(filter) {
    const events = window.allEvents || [];
    if (filter === 'all') {
        displayEvents(events);
    } else {
        const filtered = events.filter(event => event.category === filter);
        displayEvents(filtered);
    }
}

// Setup form submission
function setupForm() {
    const form = document.getElementById('event-form');
    if (!form) return;

    // Set minimum date to today
    const dateInput = document.getElementById('event-date');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.min = today;
    }

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Basic validation
        const requiredFields = form.querySelectorAll('[required]');
        let isValid = true;
        
        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                field.style.borderColor = 'var(--primary)';
                isValid = false;
            } else {
                field.style.borderColor = '';
            }
        });
        
        if (!isValid) {
            alert('Please fill in all required fields.');
            return;
        }

        // Get form data
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

        // Save to localStorage as backup (optional)
        try {
            const submissions = JSON.parse(localStorage.getItem('iplugSubmissions') || '[]');
            submissions.push(eventData);
            localStorage.setItem('iplugSubmissions', JSON.stringify(submissions));
        } catch (e) {
            console.log('Local storage not available');
        }

        // Show success message
        alert(`✅ Event submitted successfully!\n\n"${eventData.name}" has been submitted for review. We will contact you at ${eventData.email} if needed.\n\nThank you for supporting Gqeberha's nightlife!`);

        // Reset form
        form.reset();
        
        // Actually submit via email (opens default email client)
        setTimeout(() => {
            // This will open the user's default email client
            form.submit();
        }, 500);
    });
}

// Lightbox functionality for event images
function setupLightbox() {
    const modal = document.getElementById('lightbox-modal');
    const modalImg = document.getElementById('lightbox-image');
    const modalTitle = document.getElementById('lightbox-title');
    const modalDetails = document.getElementById('lightbox-details');
    const modalActions = document.getElementById('lightbox-actions');
    const closeBtn = document.querySelector('.close-lightbox');
    
    if (!modal) return;
    
    // Close modal when clicking X
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Re-enable scrolling
    });
    
    // Close modal when clicking outside image
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });
    
    // Close with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    });
    
    // Add click event to event images (using event delegation)
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('event-img')) {
            const eventCard = e.target.closest('.event-card');
            if (!eventCard) return;
            
            // Get event details
            const eventId = eventCard.getAttribute('data-id');
            const title = eventCard.querySelector('.event-title')?.textContent || 'Event Flyer';
            const date = eventCard.querySelector('.event-date')?.textContent || '';
            const venue = eventCard.querySelector('.event-venue')?.textContent || '';
            const imgSrc = e.target.src;
            
            // Get full event data
            const event = window.allEvents?.find(e => e.id == eventId) || { id: eventId, title, date, venue };
            
            // Set modal content
            modalImg.src = imgSrc;
            modalImg.alt = title;
            modalTitle.textContent = title;
            modalDetails.innerHTML = `
                <p><strong><i class="far fa-calendar"></i> ${date}</strong></p>
                <p><strong><i class="fas fa-map-marker-alt"></i> ${venue}</strong></p>
            `;
            
            // Set up modal actions
            const isSaved = window.iplugPWA?.isEventSaved(event.id) || false;
            modalActions.innerHTML = `
                <button class="btn-save" onclick="toggleSaveEvent(${event.id}, ${JSON.stringify(event).replace(/'/g, "\\'")})">
                    <i class="${isSaved ? 'fas' : 'far'} fa-heart"></i> ${isSaved ? 'Saved' : 'Save Event'}
                </button>
                <button class="btn-reminder" onclick="showReminderOptions(${event.id}, ${JSON.stringify(event).replace(/'/g, "\\'")})">
                    <i class="far fa-bell"></i> Set Reminder
                </button>
            `;
            
            // Show modal
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
            
            // Add a slight delay for smoother animation
            setTimeout(() => {
                modal.style.opacity = '1';
            }, 10);
        }
    });
}

// Global functions for button clicks
function toggleSaveEvent(eventId, eventData) {
    const saved = window.iplugPWA?.saveEvent(eventData);
    
    // Update button in event card
    const eventCard = document.querySelector(`.event-card[data-id="${eventId}"]`);
    if (eventCard) {
        const saveBtn = eventCard.querySelector('.save-btn');
        if (saveBtn) {
            saveBtn.innerHTML = saved ? 
                '<i class="fas fa-heart"></i> Saved' : 
                '<i class="far fa-heart"></i> Save';
            saveBtn.classList.toggle('saved', saved);
        }
    }
    
    // Update button in lightbox if open
    const modalActions = document.getElementById('lightbox-actions');
    if (modalActions) {
        const lightboxSaveBtn = modalActions.querySelector('.btn-save');
        if (lightboxSaveBtn) {
            lightboxSaveBtn.innerHTML = saved ? 
                '<i class="fas fa-heart"></i> Saved' : 
                '<i class="far fa-heart"></i> Save Event';
        }
    }
}

function showReminderOptions(eventId, eventData) {
    const reminderHtml = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); display: flex; justify-content: center; align-items: center; z-index: 3000;">
            <div style="background: #1a1a1a; padding: 30px; border-radius: 15px; max-width: 400px; width: 90%; border: 2px solid var(--primary);">
                <h3 style="color: var(--accent); margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-bell"></i> Set Reminder for "${eventData.title}"
                </h3>
                <div style="display: grid; gap: 10px; margin-bottom: 25px;">
                    <button onclick="setReminder(${eventId}, ${JSON.stringify(eventData).replace(/'/g, "\\'")}, '1day'); this.parentElement.parentElement.parentElement.remove();" 
                            style="background: var(--secondary); color: white; border: none; padding: 15px; border-radius: 8px; cursor: pointer; font-size: 16px; text-align: left;">
                        <i class="far fa-clock"></i> 1 Day Before
                    </button>
                    <button onclick="setReminder(${eventId}, ${JSON.stringify(eventData).replace(/'/g, "\\'")}, '3hours'); this.parentElement.parentElement.parentElement.remove();" 
                            style="background: var(--secondary); color: white; border: none; padding: 15px; border-radius: 8px; cursor: pointer; font-size: 16px; text-align: left;">
                        <i class="far fa-clock"></i> 3 Hours Before
                    </button>
                    <button onclick="setReminder(${eventId}, ${JSON.stringify(eventData).replace(/'/g, "\\'")}, '1hour'); this.parentElement.parentElement.parentElement.remove();" 
                            style="background: var(--secondary); color: white; border: none; padding: 15px; border-radius: 8px; cursor: pointer; font-size: 16px; text-align: left;">
                        <i class="far fa-clock"></i> 1 Hour Before
                    </button>
                    <button onclick="setReminder(${eventId}, ${JSON.stringify(eventData).replace(/'/g, "\\'")}, '30min'); this.parentElement.parentElement.parentElement.remove();" 
                            style="background: var(--secondary); color: white; border: none; padding: 15px; border-radius: 8px; cursor: pointer; font-size: 16px; text-align: left;">
                        <i class="far fa-clock"></i> 30 Minutes Before
                    </button>
                </div>
                <button onclick="this.parentElement.parentElement.remove();" 
                        style="background: #444; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; width: 100%;">
                    Cancel
                </button>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', reminderHtml);
}

function setReminder(eventId, eventData, reminderType) {
    window.iplugPWA?.setReminder(eventData, reminderType);
}

function loadSavedEvents() {
    window.iplugPWA?.showSavedEvents();
}
