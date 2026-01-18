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
        link.addEventListener('click', () => {
            navUl.classList.remove('show');
            menuToggle.querySelector('i').classList.remove('fa-times');
            menuToggle.querySelector('i').classList.add('fa-bars');
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
    
    // Initialize lightbox
    setupLightbox();
    
    // Add smooth scrolling for anchor links
    setupSmoothScrolling();
});

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

// Display events in the container
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

    container.innerHTML = events.map(event => `
        <div class="event-card" data-category="${event.category}">
            <img src="${event.flyer}" alt="${event.title} flyer" class="event-img" onerror="this.src='https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80'">
            <div class="event-info">
                <span class="event-date"><i class="far fa-calendar"></i> ${formatDate(event.date)}</span>
                <h3 class="event-title">${event.title}</h3>
                <p class="event-venue"><i class="fas fa-map-marker-alt"></i> ${event.venue}</p>
                <p class="event-description">${event.description}</p>
                <span class="event-category">${event.categoryLabel}</span>
            </div>
        </div>
    `).join('');
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
            
            // Get event details from the card
            const title = eventCard.querySelector('.event-title')?.textContent || 'Event Flyer';
            const date = eventCard.querySelector('.event-date')?.textContent || '';
            const venue = eventCard.querySelector('.event-venue')?.textContent || '';
            const imgSrc = e.target.src;
            
            // Clean up venue text (remove the map marker icon if present)
            const cleanVenue = venue.replace('📍', '').replace(/^\s*/, '');
            
            // Set modal content
            modalImg.src = imgSrc;
            modalImg.alt = `${title} flyer`;
            modalTitle.textContent = title;
            modalDetails.innerHTML = `
                <p><strong><i class="far fa-calendar"></i> ${date}</strong></p>
                <p><strong><i class="fas fa-map-marker-alt"></i> ${cleanVenue}</strong></p>
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

// Smooth scrolling for anchor links
function setupSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#' || href === '#!') return;
            
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                // Calculate header height for offset
                const headerHeight = document.querySelector('header').offsetHeight;
                window.scrollTo({
                    top: target.offsetTop - headerHeight - 10,
                    behavior: 'smooth'
                });
            }
        });
    });
}
