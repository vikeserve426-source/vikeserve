// services.js - Complete Services and Jobs Management (FIXED - Working Modal Buttons)

class ServicesManager {
    constructor() {
        this.db = db;
        this.storage = storage;
        this.currentListeners = {};
        this.servicesCollection = collections.services();
        this.usersCollection = collections.users();
        this.bookingsCollection = collections.bookings();
        this.ratingsCollection = collections.ratings();
    }

    async getServicesByCategory(category, limit = 20) {
        try {
            let query = this.servicesCollection.where('category', '==', category).where('status', '==', 'active').orderBy('createdAt', 'desc');
            if (limit) query = query.limit(limit);
            const snapshot = await query.get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting services:', error);
            return [];
        }
    }

    async getUrgentJobs(limit = 10) {
        try {
            const snapshot = await this.servicesCollection.where('urgent', '==', true).where('status', '==', 'active').orderBy('createdAt', 'desc').limit(limit).get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isJob: doc.data().isJob || false }));
        } catch (error) {
            console.error('Error getting urgent jobs:', error);
            return [];
        }
    }

    async createService(serviceData) {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error('User must be logged in');
        const serviceWithMetadata = {
            ...serviceData, userId: user.uid, status: 'active',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            rating: 0, ratingCount: 0, viewCount: 0, isJob: false
        };
        const docRef = await this.servicesCollection.add(serviceWithMetadata);
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Error creating service:', error);
        return { success: false, error: error.message };
    }
}

    async createJob(jobData) {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('User must be logged in');
            const jobWithMetadata = {
                ...jobData, userId: user.uid, userName: user.displayName || user.email,
                status: 'active', createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                viewCount: 0, applicants: 0, isJob: true, rating: 0, ratingCount: 0
            };
            const docRef = await this.servicesCollection.add(jobWithMetadata);
            return { success: true, id: docRef.id };
        } catch (error) {
            console.error('Error creating job:', error);
            return { success: false, error: error.message };
        }
    }

    async getServiceById(serviceId) {
        try {
            const doc = await this.servicesCollection.doc(serviceId).get();
            if (doc.exists) {
                await this.incrementViewCount(serviceId);
                return { success: true, data: { id: doc.id, ...doc.data() } };
            }
            return { success: false, error: 'Service not found' };
        } catch (error) {
            console.error('Error getting service:', error);
            return { success: false, error: error.message };
        }
    }

    async incrementViewCount(serviceId) {
        try {
            await this.servicesCollection.doc(serviceId).update({ viewCount: firebase.firestore.FieldValue.increment(1) });
        } catch (error) { console.error('Error incrementing view count:', error); }
    }

    setupServicesListener(category, callback) {
        if (this.currentListeners[category]) this.currentListeners[category]();
        const unsubscribe = this.servicesCollection.where('category', '==', category).where('status', '==', 'active').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, error => console.error('Services listener error:', error));
        this.currentListeners[category] = unsubscribe;
        return unsubscribe;
    }

    removeAllListeners() {
        Object.values(this.currentListeners).forEach(unsubscribe => { if (typeof unsubscribe === 'function') unsubscribe(); });
        this.currentListeners = {};
    }
}

const servicesManager = new ServicesManager();

// ========== HELPER FUNCTIONS ==========
function generateStarRating(rating) {
    if (!rating) rating = 0;
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= rating) stars += '<i class="fas fa-star"></i>';
        else if (i - 0.5 <= rating) stars += '<i class="fas fa-star-half-alt"></i>';
        else stars += '<i class="far fa-star"></i>';
    }
    return stars;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== LOAD URGENT JOBS ==========
async function loadUrgentJobs(limit = 5) {
    const container = document.getElementById('urgent-jobs-container');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner">Loading jobs...</div>';
    
    try {
        const jobs = await servicesManager.getUrgentJobs(limit);
        
        if (jobs.length === 0) {
            container.innerHTML = '<div class="no-jobs">No urgent jobs available at the moment</div>';
            return;
        }
        
        container.innerHTML = '';
        jobs.forEach(job => {
            const jobElement = createJobElement(job);
            container.appendChild(jobElement);
        });
    } catch (error) {
        console.error('Error loading urgent jobs:', error);
        container.innerHTML = '<div class="error-jobs">Failed to load jobs</div>';
    }
}

function createJobElement(job) {
    const div = document.createElement('div');
    div.className = 'job-card';
    const isJob = job.isJob || job.type === 'job';
    const typeBadge = isJob ? '<span class="job-tag job-type">Job</span>' : '<span class="job-tag service-type">Service</span>';
    
    div.innerHTML = `
        <div class="job-title"><i class="fas fa-briefcase"></i> ${escapeHtml(job.title)}</div>
        <div class="job-poster"><div class="job-poster-img">${job.postedBy?.charAt(0) || job.userName?.charAt(0) || 'U'}</div><span>Posted by: ${job.postedBy || job.userName || 'Unknown'}</span></div>
        <div class="job-detail"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(job.location || 'Nairobi')}</div>
        <div class="job-detail"><i class="fas fa-money-bill-wave"></i> ${job.price ? `KES ${job.price}` : 'Price negotiable'}</div>
        ${job.rating > 0 ? `<div class="job-detail"><i class="fas fa-star"></i> ${job.rating.toFixed(1)} (${job.ratingCount} reviews)</div>` : ''}
        <div class="job-tags">${typeBadge}<span class="job-tag">${escapeHtml(job.category)}</span>${job.urgent ? '<span class="job-tag urgent">Urgent</span>' : ''}</div>
        <button class="btn btn-primary view-job-detail-btn" data-job-id="${job.id}">View Details</button>
    `;
    
    const viewBtn = div.querySelector('.view-job-detail-btn');
    if (viewBtn) {
        viewBtn.addEventListener('click', () => viewJobDetails(job.id));
    }
    
    return div;
}

// ========== LOAD SERVICES ==========
async function loadServices(category = null, limit = 20) {
    const container = document.getElementById('services-list-container');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner">Loading services...</div>';
    
    try {
        let query = collections.services().where('status', '==', 'active');
        if (category) query = query.where('category', '==', category);
        query = query.orderBy('createdAt', 'desc').limit(limit);
        
        const snapshot = await query.get();
        const services = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (services.length === 0) {
            container.innerHTML = '<div class="no-services">No services available</div>';
            return;
        }
        
        container.innerHTML = '';
        services.forEach(service => {
            container.appendChild(createServiceElement(service));
        });
    } catch (error) {
        console.error('Error loading services:', error);
        container.innerHTML = '<div class="error-services">Failed to load services</div>';
    }
}

function createServiceElement(service) {
    const div = document.createElement('div');
    div.className = 'service-card';
    div.innerHTML = `
        <div class="service-header"><div class="service-title">${escapeHtml(service.title)}</div><div class="service-price">KES ${service.price}</div></div>
        <div class="service-provider"><div class="provider-avatar">${service.providerName?.charAt(0) || 'P'}</div><div class="provider-info"><div class="provider-name">${escapeHtml(service.providerName || 'Service Provider')}</div><div class="provider-rating">${generateStarRating(service.rating || 0)}<span>(${service.ratingCount || 0})</span></div></div></div>
        <div class="service-description">${escapeHtml(service.description || 'No description available')}</div>
        <div class="service-meta"><span class="service-category">${escapeHtml(service.category)}</span><span class="service-location"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(service.location)}</span></div>
        <button class="btn-promote promote-service-btn" data-service-id="${service.id}"><i class="fas fa-rocket"></i> Promote</button>
    `;
    
    const promoteBtn = div.querySelector('.promote-service-btn');
    if (promoteBtn) {
        promoteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            promoteService(service.id);
        });
    }
    
    return div;
}

// ========== VIEW FUNCTIONS ==========
async function viewJobDetails(serviceId) {
    try {
        const result = await servicesManager.getServiceById(serviceId);
        if (result.success) {
            showServiceDetailsModal(result.data);
        } else if (typeof window.showToast === 'function') {
            window.showToast('Error loading service details', 'error');
        }
    } catch (error) {
        console.error('Error viewing job details:', error);
    }
}

function showServiceDetailsModal(service) {
    const modalContent = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <div class="modal-title">${escapeHtml(service.title)}</div>
                <button class="close-modal-btn">&times;</button>
            </div>
            <div style="padding: 15px;">
                <div class="service-price" style="font-size: 1.5rem; font-weight: 700; color: var(--primary);">KES ${service.price}</div>
                <div class="service-location"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(service.location || 'Nairobi')}</div>
                <div class="service-description" style="margin: 15px 0;"><strong>Description:</strong><br>${escapeHtml(service.description)}</div>
                <div class="service-contact"><i class="fas fa-phone"></i> ${escapeHtml(service.phone || 'Contact via app')}</div>
                <div class="form-actions" style="display: flex; gap: 10px; margin-top: 20px;">
                    <button class="btn btn-primary contact-service-btn" data-phone="${service.phone}" style="flex: 1;"><i class="fas fa-phone"></i> Call</button>
                    <button class="btn btn-outline book-service-btn" data-service-id="${service.id}" style="flex: 1;"><i class="fas fa-calendar-check"></i> Book</button>
                </div>
            </div>
        </div>
    `;
    
    if (typeof window.showModalWithContent === 'function') {
        window.showModalWithContent('service-details-modal', modalContent);
    }
    
    setTimeout(() => {
        const closeBtn = document.querySelector('#service-details-modal .close-modal-btn');
        if (closeBtn) closeBtn.addEventListener('click', () => {
            if (typeof window.closeModal === 'function') window.closeModal('service-details-modal');
        });
        
        const contactBtn = document.querySelector('#service-details-modal .contact-service-btn');
        if (contactBtn) {
            contactBtn.addEventListener('click', () => {
                const phone = contactBtn.getAttribute('data-phone');
                if (phone) window.location.href = `tel:${phone}`;
                else if (typeof window.showToast === 'function') window.showToast('Contact info coming soon', 'info');
            });
        }
        
        const bookBtn = document.querySelector('#service-details-modal .book-service-btn');
        if (bookBtn) {
            bookBtn.addEventListener('click', () => {
                if (typeof window.showToast === 'function') window.showToast('Booking feature coming soon', 'info');
            });
        }
    }, 100);
}

function showServiceList(serviceType) {
    if (typeof window.showToast === 'function') window.showToast(`Loading ${serviceType} services...`, 'info');
}

function promoteService(serviceId) {
    if (typeof window.showAdPackagesModal === 'function') {
        window.showAdPackagesModal(serviceId);
    } else if (typeof window.showToast === 'function') {
        window.showToast('Promote service coming soon', 'info');
    }
}

// ========== LOCATION FUNCTIONS ==========
function fillServiceLocationFromProfile() {
    if (typeof window.getCurrentLocation === 'function') {
        const location = window.getCurrentLocation();
        const locationInput = document.getElementById('service-location');
        
        if (locationInput && location.fullAddress) {
            locationInput.value = location.fullAddress;
        } else if (locationInput && location.country) {
            let locationText = '';
            if (location.city) locationText += location.city;
            if (location.state) locationText += locationText ? `, ${location.state}` : location.state;
            if (location.country) locationText += locationText ? `, ${location.country}` : location.country;
            locationInput.value = locationText || location.country;
        }
    }
}

function fillJobLocationFromProfile() {
    if (typeof window.getCurrentLocation === 'function') {
        const location = window.getCurrentLocation();
        const locationInput = document.getElementById('job-location');
        
        if (locationInput && location.fullAddress) {
            locationInput.value = location.fullAddress;
        } else if (locationInput && location.country) {
            let locationText = '';
            if (location.city) locationText += location.city;
            if (location.state) locationText += locationText ? `, ${location.state}` : location.state;
            if (location.country) locationText += locationText ? `, ${location.country}` : location.country;
            locationInput.value = locationText || location.country;
        }
    }
}

// ========== SERVICE POST MODAL FUNCTIONS ==========
function showServicePostModal() {
    console.log('showServicePostModal called');
    resetServicePostForm();
    fillServiceLocationFromProfile();
    
    const modal = document.getElementById('service-post-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '10001';
        console.log('Service modal opened');
    } else {
        console.error('service-post-modal not found');
        if (typeof window.showToast === 'function') {
            window.showToast('Service form not available', 'error');
        }
    }
}

// Setup service modal close handlers (call this once on load)
function setupServiceModalHandlers() {
    const modal = document.getElementById('service-post-modal');
    if (!modal) return;
    
    // Handle close button
    const closeBtn = modal.querySelector('.close-modal-btn');
    if (closeBtn) {
        // Remove existing listeners by cloning
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            modal.style.display = 'none';
            console.log('Service modal closed');
        });
    }
    
    // Handle cancel button
    const cancelBtn = modal.querySelector('.btn-outline');
    if (cancelBtn && cancelBtn.textContent.includes('Cancel')) {
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        newCancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            modal.style.display = 'none';
            console.log('Service modal cancelled');
        });
    }
    
    // Handle submit button
    const submitBtn = document.getElementById('submit-service-btn');
    if (submitBtn) {
        const newSubmitBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
        newSubmitBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            submitService();
        });
    }
}

function resetServicePostForm() {
    const fields = ['service-type', 'service-title', 'service-description', 'service-price', 'service-location', 'service-phone'];
    fields.forEach(id => {
        const field = document.getElementById(id);
        if (field) field.value = '';
    });
    const specificFields = document.getElementById('service-specific-fields');
    if (specificFields) specificFields.innerHTML = '';
}

function updateServiceForm() {
    const serviceType = document.getElementById('service-type')?.value;
    const specificFields = document.getElementById('service-specific-fields');
    if (!specificFields) return;
    
    let additionalFields = '';
    switch(serviceType) {
        case 'vehicle-hire':
            additionalFields = `<div class="form-group"><label class="form-label">Vehicle Type</label><select class="form-input" id="service-vehicle-type"><option value="car">Car</option><option value="truck">Truck</option><option value="van">Van</option></select></div><div class="form-group"><label class="form-label">Capacity</label><input type="text" class="form-input" id="service-capacity" placeholder="e.g., 7-seater"></div>`;
            break;
        case 'boda':
            additionalFields = `<div class="form-group"><label class="form-label">Boda Type</label><select class="form-input" id="service-boda-type"><option value="motorcycle">Motorcycle</option><option value="tuk-tuk">Tuk Tuk</option></select></div>`;
            break;
        case 'construction':
            additionalFields = `<div class="form-group"><label class="form-label">Skill Type</label><select class="form-input" id="service-skill-type"><option value="laborer">General Laborer</option><option value="mason">Mason</option><option value="carpenter">Carpenter</option></select></div><div class="form-group"><label class="form-label">Experience</label><input type="text" class="form-input" id="service-experience" placeholder="e.g., 5 years"></div>`;
            break;
        case 'tools':
            additionalFields = `<div class="form-group"><label class="form-label">Tool Type</label><input type="text" class="form-input" id="service-tool-type" placeholder="e.g., Power drill"></div><div class="form-group"><label class="form-label">Rental Period</label><select class="form-input" id="service-rental-period"><option value="hourly">Hourly</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select></div>`;
            break;
        case 'cleaning':
            additionalFields = `<div class="form-group"><label class="form-label">Cleaning Type</label><select class="form-input" id="service-cleaning-type"><option value="home">Home Cleaning</option><option value="office">Office Cleaning</option><option value="commercial">Commercial Cleaning</option></select></div>`;
            break;
        case 'fundis':
            additionalFields = `<div class="form-group"><label class="form-label">Specialization</label><select class="form-input" id="service-specialization"><option value="plumber">Plumber</option><option value="electrician">Electrician</option><option value="carpenter">Carpenter</option><option value="mason">Mason</option><option value="painter">Painter</option></select></div><div class="form-group"><label class="form-label">Experience Level</label><select class="form-input" id="service-experience-level"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="expert">Expert</option></select></div>`;
            break;
        default: additionalFields = '';
    }
    specificFields.innerHTML = additionalFields;
}

async function submitService() {
    console.log('submitService called - saving to Firebase');
    const serviceType = document.getElementById('service-type')?.value;
    const title = document.getElementById('service-title')?.value;
    const description = document.getElementById('service-description')?.value;
    const price = document.getElementById('service-price')?.value;
    const location = document.getElementById('service-location')?.value;
    const phone = document.getElementById('service-phone')?.value;
    
    // Check if user is logged in
    const user = firebase.auth().currentUser;
    if (!user) {
        if (typeof window.showToast === 'function') {
            window.showToast('Please sign in to post a service', 'error');
        }
        if (typeof window.openAuthModal === 'function') {
            window.openAuthModal();
        }
        return;
    }
    
    if (!serviceType || !title || !description || !price || !location || !phone) {
        if (typeof window.showToast === 'function') {
            window.showToast('Please fill in all required fields', 'error');
        }
        return;
    }
    
    if (typeof window.showToast === 'function') {
        window.showToast('Saving service to database...', 'info');
    }
    
    // Prepare data for Firebase
    const serviceData = {
        title: title,
        description: description,
        price: parseInt(price),
        location: location,
        phone: phone,
        serviceType: serviceType,
        category: serviceType,
        status: 'active'
    };
    
    const result = await servicesManager.createService(serviceData);
    
    if (result.success) {
        if (typeof window.showToast === 'function') {
            window.showToast('✅ Service posted successfully to Firebase!', 'success');
        }
        
        const modal = document.getElementById('service-post-modal');
        if (modal) modal.style.display = 'none';
        
        resetServicePostForm();
        
        // Refresh services list
        setTimeout(() => loadServices(), 500);
    } else {
        if (typeof window.showToast === 'function') {
            window.showToast(`Error: ${result.error}`, 'error');
        }
    }
}

// ========== JOB POST MODAL FUNCTIONS ==========
function showJobPostModal() {
    console.log('showJobPostModal called');
    resetJobPostForm();
    fillJobLocationFromProfile();
    
    const modal = document.getElementById('job-post-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '10001';
        console.log('Job modal opened');
    } else {
        console.error('job-post-modal not found');
        if (typeof window.showToast === 'function') {
            window.showToast('Job form not available', 'error');
        }
    }
}

// Setup job modal close handlers (call this once on load)
function setupJobModalHandlers() {
    const modal = document.getElementById('job-post-modal');
    if (!modal) return;
    
    // Handle close button
    const closeBtn = modal.querySelector('.close-modal-btn');
    if (closeBtn) {
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            modal.style.display = 'none';
            console.log('Job modal closed');
        });
    }
    
    // Handle cancel button
    const cancelBtn = modal.querySelector('.btn-outline');
    if (cancelBtn && cancelBtn.textContent.includes('Cancel')) {
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        newCancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            modal.style.display = 'none';
            console.log('Job modal cancelled');
        });
    }
    
    // Handle submit button
    const submitBtn = document.getElementById('submit-job-btn');
    if (submitBtn) {
        const newSubmitBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
        newSubmitBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            submitJob();
        });
    }
}

function resetJobPostForm() {
    const fields = ['job-title', 'job-category', 'job-description', 'job-price', 'job-location', 'job-phone'];
    fields.forEach(id => {
        const field = document.getElementById(id);
        if (field) field.value = '';
    });
    const duration = document.getElementById('job-duration');
    if (duration) duration.value = 'once';
    const urgent = document.getElementById('job-urgent');
    if (urgent) urgent.value = 'no';
}

async function submitJob() {
    console.log('submitJob called - saving to Firebase');
    const title = document.getElementById('job-title')?.value;
    const category = document.getElementById('job-category')?.value;
    const description = document.getElementById('job-description')?.value;
    const price = document.getElementById('job-price')?.value;
    const location = document.getElementById('job-location')?.value;
    const duration = document.getElementById('job-duration')?.value;
    const urgent = document.getElementById('job-urgent')?.value;
    const phone = document.getElementById('job-phone')?.value;
    
    // Check if user is logged in
    const user = firebase.auth().currentUser;
    if (!user) {
        if (typeof window.showToast === 'function') {
            window.showToast('Please sign in to post a job', 'error');
        }
        if (typeof window.openAuthModal === 'function') {
            window.openAuthModal();
        }
        return;
    }
    
    if (!title || !category || !description || !price || !location || !phone) {
        if (typeof window.showToast === 'function') {
            window.showToast('Please fill in all required fields', 'error');
        }
        return;
    }
    
    if (typeof window.showToast === 'function') {
        window.showToast('Saving job to database...', 'info');
    }
    
    // Prepare data for Firebase
    const jobData = {
        title: title,
        category: category,
        description: description,
        price: parseInt(price),
        location: location,
        duration: duration || 'once',
        urgent: urgent === 'yes',
        phone: phone,
        status: 'active'
    };
    
    const result = await servicesManager.createJob(jobData);
    
    if (result.success) {
        if (typeof window.showToast === 'function') {
            window.showToast('✅ Job posted successfully to Firebase!', 'success');
        }
        
        const modal = document.getElementById('job-post-modal');
        if (modal) modal.style.display = 'none';
        
        resetJobPostForm();
        
        // Refresh urgent jobs if this was urgent
        if (urgent === 'yes') {
            setTimeout(() => loadUrgentJobs(), 500);
        }
        
        // Refresh services list
        setTimeout(() => loadServices(), 500);
    } else {
        if (typeof window.showToast === 'function') {
            window.showToast(`Error: ${result.error}`, 'error');
        }
    }
}

// ========== SETUP SEE ALL BUTTONS (UPDATED to use app.switchTab) ==========
function setupSeeAllButtons() {
    console.log('🔧 Setting up See All buttons');
    const seeAllButtons = document.querySelectorAll('.see-all');
    console.log(`Found ${seeAllButtons.length} see-all buttons`);
    
    seeAllButtons.forEach((button) => {
        // Remove any existing listeners by cloning
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        newButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const targetTab = this.getAttribute('data-tab');
            console.log(`See All clicked - target tab: ${targetTab}`);
            
            if (targetTab) {
                // Use the app's switchTab method if available
                if (window.app && typeof window.app.switchTab === 'function') {
                    window.app.switchTab(targetTab);
                    console.log(`Switched to ${targetTab} via app.switchTab`);
                } else if (typeof window.switchTab === 'function') {
                    // Fallback to global switchTab
                    window.switchTab(targetTab);
                    console.log(`Switched to ${targetTab} via global switchTab`);
                } else {
                    console.error('No tab switching function available');
                    // Manual fallback
                    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
                    const target = document.getElementById(targetTab);
                    if (target) target.classList.add('active');
                }
                
                // Show toast notification if available
                if (typeof window.showToast === 'function') {
                    const tabName = targetTab.replace('-tab', '');
                    window.showToast(`Loading all ${tabName}...`, 'info');
                }
            }
        });
        
        // Make it look clickable
        newButton.style.cursor = 'pointer';
        newButton.style.display = 'inline-flex';
        newButton.style.alignItems = 'center';
        newButton.style.gap = '5px';
    });
}

// ========== SETUP QUICK ACTIONS (UPDATED to work with app) ==========
function setupQuickActions() {
    const quickActions = document.querySelectorAll('.quick-action');
    console.log(`Setting up ${quickActions.length} quick actions`);
    
    quickActions.forEach(action => {
        const newAction = action.cloneNode(true);
        action.parentNode.replaceChild(newAction, action);
        
        newAction.addEventListener('click', function(e) {
            const actionType = this.getAttribute('data-action');
            console.log('Quick action clicked:', actionType);
            
            // Use app's switchTab if available
            const switchToTab = (tabId) => {
                if (window.app && typeof window.app.switchTab === 'function') {
                    window.app.switchTab(tabId);
                } else if (typeof window.switchTab === 'function') {
                    window.switchTab(tabId);
                } else {
                    // Manual fallback
                    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
                    const target = document.getElementById(tabId);
                    if (target) target.classList.add('active');
                }
            };
            
            const openMoreMenu = () => {
                if (window.app && typeof window.app.openMoreMenu === 'function') {
                    window.app.openMoreMenu();
                } else if (typeof window.openMoreMenu === 'function') {
                    window.openMoreMenu();
                }
            };
            
            switch(actionType) {
                case 'Marketplace':
                    switchToTab('marketplace-tab');
                    break;
                case 'boda':
                case 'construction':
                case 'daily':
                case 'farm':
                case 'gas':
                case 'water':
                case 'electricity':
                case 'house':
                case 'phone':
                    if (typeof window.showToast === 'function') {
                        window.showToast(`Looking for ${actionType} services...`, 'info');
                    }
                    switchToTab('services-tab');
                    setTimeout(() => {
                        if (typeof window.showToast === 'function') {
                            window.showToast(`Click "List Your Service" to offer ${actionType} services`, 'info');
                        }
                    }, 500);
                    break;
                case 'education':
                    openMoreMenu();
                    setTimeout(() => {
                        const eduTab = document.querySelector('.more-tab-btn[data-more-tab="education"]');
                        if (eduTab && window.moreMenuManager && typeof window.moreMenuManager.switchMoreTab === 'function') {
                            window.moreMenuManager.switchMoreTab('education');
                        } else if (eduTab) {
                            eduTab.click();
                        }
                    }, 200);
                    break;
                case 'alerts':
                    openMoreMenu();
                    setTimeout(() => {
                        const alertsTab = document.querySelector('.more-tab-btn[data-more-tab="alerts"]');
                        if (alertsTab && window.moreMenuManager && typeof window.moreMenuManager.switchMoreTab === 'function') {
                            window.moreMenuManager.switchMoreTab('alerts');
                        } else if (alertsTab) {
                            alertsTab.click();
                        }
                    }, 200);
                    break;
                default:
                    if (typeof window.showToast === 'function') {
                        window.showToast(`Opening ${actionType}...`, 'info');
                    }
            }
        });
    });
}

// ========== EXPORT GLOBALLY ==========
window.servicesManager = servicesManager;
window.loadUrgentJobs = loadUrgentJobs;
window.loadServices = loadServices;
window.viewJobDetails = viewJobDetails;
window.showServiceList = showServiceList;
window.showServicePostModal = showServicePostModal;
window.showJobPostModal = showJobPostModal;
window.fillServiceLocationFromProfile = fillServiceLocationFromProfile;
window.fillJobLocationFromProfile = fillJobLocationFromProfile;
window.updateServiceForm = updateServiceForm;
window.submitService = submitService;
window.submitJob = submitJob;
window.promoteService = promoteService;
window.setupSeeAllButtons = setupSeeAllButtons;
window.setupQuickActions = setupQuickActions;
window.setupServiceModalHandlers = setupServiceModalHandlers;
window.setupJobModalHandlers = setupJobModalHandlers;

// ========== INITIALIZE ON DOM LOAD ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('Services.js DOM loaded - initializing');
    
    // Wait a bit for app.js to fully initialize
    setTimeout(() => {
        // Setup See All buttons (this makes "View All" work)
        setupSeeAllButtons();
        
        // Setup Quick Actions
        setupQuickActions();
        
        // Setup modal handlers (only once!)
        setupServiceModalHandlers();
        setupJobModalHandlers();
        
        console.log('Services.js interactive elements initialized');
    }, 300);
    
    // Load initial data
    setTimeout(loadUrgentJobs, 500);
    setTimeout(() => loadServices(), 1000);
    
    // Setup service post button
    const serviceBtn = document.getElementById('service-post-btn');
    if (serviceBtn) {
        const newServiceBtn = serviceBtn.cloneNode(true);
        serviceBtn.parentNode.replaceChild(newServiceBtn, serviceBtn);
        newServiceBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Service post button clicked');
            showServicePostModal();
        });
        console.log('Service post button attached');
    }
    
    // Setup job post button
    const jobBtn = document.getElementById('job-post-btn');
    if (jobBtn) {
        const newJobBtn = jobBtn.cloneNode(true);
        jobBtn.parentNode.replaceChild(newJobBtn, jobBtn);
        newJobBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Job post button clicked');
            showJobPostModal();
        });
        console.log('Job post button attached');
    }
});

console.log('✅ Services.js fully loaded');