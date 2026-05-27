// ========== SERVICES MANAGER - COMPLETE FIXED VERSION ==========
// Handles services and jobs posting, loading, and booking

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

    async getServicesByCategory(category, limit = 20, startAfter = null) {
        try {
            let query = this.servicesCollection
                .where('category', '==', category)
                .where('status', '==', 'active')
                .orderBy('createdAt', 'desc');
            
            if (limit) query = query.limit(limit);
            if (startAfter) query = query.startAfter(startAfter);
            
            const snapshot = await query.get();
            const lastVisible = snapshot.docs[snapshot.docs.length - 1];
            
            return {
                services: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
                lastVisible
            };
        } catch (error) {
            console.error('Error getting services:', error);
            return { services: [], lastVisible: null };
        }
    }

    async getUrgentJobs(limit = 10) {
        try {
            const snapshot = await this.servicesCollection
                .where('urgent', '==', true)
                .where('status', '==', 'active')
                .orderBy('createdAt', 'desc')
                .limit(limit)
                .get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isJob: doc.data().isJob || false }));
        } catch (error) {
            console.error('Error getting urgent jobs:', error);
            return [];
        }
    }

    async createService(serviceData, imageFiles = []) {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('User must be logged in');

            let imageUrls = [];
            if (imageFiles.length > 0) {
                imageUrls = await this.uploadServiceImages(imageFiles, 'temp');
            }

            const serviceWithMetadata = {
                ...serviceData,
                userId: user.uid,
                userName: user.displayName || user.email,
                status: 'active',
                images: imageUrls,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                rating: 0,
                ratingCount: 0,
                viewCount: 0,
                isJob: false
            };
            
            const docRef = await this.servicesCollection.add(serviceWithMetadata);
            return { success: true, id: docRef.id, imageUrls };
        } catch (error) {
            console.error('Error creating service:', error);
            return { success: false, error: error.message };
        }
    }

    async createJob(jobData, imageFiles = []) {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('User must be logged in');

            let imageUrls = [];
            if (imageFiles.length > 0) {
                imageUrls = await this.uploadServiceImages(imageFiles, 'temp');
            }

            const jobWithMetadata = {
                ...jobData,
                userId: user.uid,
                userName: user.displayName || user.email,
                images: imageUrls,
                status: 'active',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                viewCount: 0,
                applicants: 0,
                isJob: true,
                rating: 0,
                ratingCount: 0
            };
            
            const docRef = await this.servicesCollection.add(jobWithMetadata);
            return { success: true, id: docRef.id };
        } catch (error) {
            console.error('Error creating job:', error);
            return { success: false, error: error.message };
        }
    }

    async uploadServiceImages(files, serviceId) {
        const imageUrls = [];
        for (const file of files) {
            try {
                const fileExtension = file.name.split('.').pop();
                const filename = `services/${serviceId}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExtension}`;
                const storageRef = this.storage.ref(filename);
                const snapshot = await storageRef.put(file);
                const downloadURL = await snapshot.ref.getDownloadURL();
                imageUrls.push(downloadURL);
            } catch (error) {
                console.error('Error uploading service image:', error);
            }
        }
        return imageUrls;
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
            await this.servicesCollection.doc(serviceId).update({ 
                viewCount: firebase.firestore.FieldValue.increment(1) 
            });
        } catch (error) { 
            console.error('Error incrementing view count:', error); 
        }
    }

    removeAllListeners() {
        Object.values(this.currentListeners).forEach(unsubscribe => { 
            if (typeof unsubscribe === 'function') unsubscribe(); 
        });
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
    
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div> Loading jobs...</div>';
    
    try {
        const jobs = await servicesManager.getUrgentJobs(limit);
        
        if (jobs.length === 0) {
            container.innerHTML = '<div class="no-jobs" style="text-align: center; padding: 20px;">No urgent jobs available at the moment</div>';
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
        <div class="job-poster"><div class="job-poster-img">${(job.postedBy || job.userName || 'U').charAt(0)}</div><span>Posted by: ${job.postedBy || job.userName || 'Unknown'}</span></div>
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
    
    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div> Loading services...</div>';
    
    try {
        let result;
        if (category) {
            result = await servicesManager.getServicesByCategory(category, limit);
        } else {
            const snapshot = await collections.services()
                .where('status', '==', 'active')
                .orderBy('createdAt', 'desc')
                .limit(limit)
                .get();
            result = {
                services: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
                lastVisible: snapshot.docs[snapshot.docs.length - 1]
            };
        }
        
        const services = result.services;
        
        if (services.length === 0) {
            container.innerHTML = '<div class="no-services" style="text-align: center; padding: 40px;">No services available</div>';
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
        <div class="service-provider"><div class="provider-avatar">${(service.providerName || service.userName || 'P').charAt(0)}</div><div class="provider-info"><div class="provider-name">${escapeHtml(service.providerName || service.userName || 'Service Provider')}</div><div class="provider-rating">${generateStarRating(service.rating || 0)}<span>(${service.ratingCount || 0})</span></div></div></div>
        <div class="service-description">${escapeHtml((service.description || 'No description available').substring(0, 100))}...</div>
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

// ========== BOOKING MODAL FUNCTION ==========
function showBookingModal(service) {
    const currentUser = firebase.auth().currentUser;
    
    const modalContent = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <div class="modal-title">Book ${escapeHtml(service.title)}</div>
                <button class="close-modal-btn">&times;</button>
            </div>
            <div style="padding: 20px;">
                <div class="form-group">
                    <label class="form-label">Your Name</label>
                    <input type="text" id="booking-name" class="form-input" value="${escapeHtml(currentUser?.displayName || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label">Your Phone</label>
                    <input type="tel" id="booking-phone" class="form-input" value="${escapeHtml(currentUser?.phoneNumber || '')}" placeholder="e.g., 0712345678">
                </div>
                <div class="form-group">
                    <label class="form-label">Date *</label>
                    <input type="date" id="booking-date" class="form-input" min="${new Date().toISOString().split('T')[0]}">
                </div>
                <div class="form-group">
                    <label class="form-label">Time</label>
                    <input type="time" id="booking-time" class="form-input">
                </div>
                <div class="form-group">
                    <label class="form-label">Message (Optional)</label>
                    <textarea id="booking-message" class="form-input" rows="3" placeholder="Any additional information..."></textarea>
                </div>
                <div class="form-actions" style="display: flex; gap: 10px; margin-top: 20px;">
                    <button class="btn btn-outline close-modal-btn">Cancel</button>
                    <button class="btn btn-primary" id="confirm-booking-btn" data-service-id="${service.id}" data-provider-id="${service.userId}">Confirm Booking</button>
                </div>
            </div>
        </div>
    `;
    
    if (typeof window.showModalWithContent === 'function') {
        window.showModalWithContent('booking-modal', modalContent);
    }
    
    setTimeout(() => {
        const confirmBtn = document.getElementById('confirm-booking-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', async () => {
                const name = document.getElementById('booking-name')?.value;
                const phone = document.getElementById('booking-phone')?.value;
                const date = document.getElementById('booking-date')?.value;
                const time = document.getElementById('booking-time')?.value;
                const message = document.getElementById('booking-message')?.value;
                
                if (!date) {
                    if (typeof window.showToast === 'function') {
                        window.showToast('Please select a date', 'error');
                    }
                    return;
                }
                
                if (!name) {
                    if (typeof window.showToast === 'function') {
                        window.showToast('Please enter your name', 'error');
                    }
                    return;
                }
                
                // Show loading state
                confirmBtn.disabled = true;
                confirmBtn.innerHTML = '<div class="spinner"></div> Processing...';
                
                const bookingData = {
                    serviceId: service.id,
                    serviceName: service.title,
                    providerId: service.userId,
                    providerName: service.userName || 'Provider',
                    customerName: name,
                    customerPhone: phone,
                    date: date,
                    time: time || 'Anytime',
                    notes: message,
                    price: service.price,
                    status: 'pending',
                    location: service.location,
                    createdAt: new Date().toISOString()
                };
                
                try {
                    // Save to Firestore bookings collection
                    const docRef = await firebase.firestore().collection('bookings').add({
                        ...bookingData,
                        customerId: firebase.auth().currentUser?.uid,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    if (typeof window.showToast === 'function') {
                        window.showToast('✅ Booking request sent successfully!', 'success');
                    }
                    
                    // Close modal
                    if (typeof window.closeModal === 'function') {
                        window.closeModal('booking-modal');
                    } else {
                        const modal = document.getElementById('booking-modal');
                        if (modal) modal.remove();
                    }
                    
                } catch (error) {
                    console.error('Error creating booking:', error);
                    if (typeof window.showToast === 'function') {
                        window.showToast('Error: ' + error.message, 'error');
                    }
                    confirmBtn.disabled = false;
                    confirmBtn.innerHTML = 'Confirm Booking';
                }
            });
        }
    }, 100);
}

function showServiceDetailsModal(service) {
    const currentUser = firebase.auth().currentUser;
    const isOwner = currentUser && service.userId === currentUser.uid;
    
    const modalContent = `
        <div class="modal-content" style="max-width: 500px; max-height: 80vh; overflow-y: auto;">
            <div class="modal-header">
                <div class="modal-title">${escapeHtml(service.title)}</div>
                <button class="close-modal-btn">&times;</button>
            </div>
            <div style="padding: 15px;">
                ${service.images && service.images.length > 0 ? `
                    <div style="display: flex; overflow-x: auto; gap: 10px; margin-bottom: 15px;">
                        ${service.images.map(img => `<img src="${img}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; cursor: pointer;" onclick="window.open('${img}', '_blank')">`).join('')}
                    </div>
                ` : ''}
                <div class="service-price" style="font-size: 1.5rem; font-weight: 700; color: var(--primary);">KES ${service.price}</div>
                <div class="service-location"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(service.location || 'Nairobi')}</div>
                <div class="service-description" style="margin: 15px 0;"><strong>Description:</strong><br>${escapeHtml(service.description)}</div>
                <div class="service-contact"><i class="fas fa-phone"></i> ${escapeHtml(service.phone || 'Contact via app')}</div>
                ${!isOwner ? `
                    <div class="form-actions" style="display: flex; gap: 10px; margin-top: 20px;">
                        <button class="btn btn-primary contact-service-btn" data-phone="${service.phone}" style="flex: 1;"><i class="fas fa-phone"></i> Call</button>
                        <button class="btn btn-outline book-service-btn" data-service-id="${service.id}" style="flex: 1;"><i class="fas fa-calendar-check"></i> Book</button>
                    </div>
                ` : `
                    <div class="form-actions" style="display: flex; gap: 10px; margin-top: 20px;">
                        <button class="btn btn-outline edit-service-btn" data-service-id="${service.id}" style="flex: 1;"><i class="fas fa-edit"></i> Edit</button>
                        <button class="btn btn-danger delete-service-btn" data-service-id="${service.id}" style="flex: 1;"><i class="fas fa-trash"></i> Delete</button>
                    </div>
                `}
            </div>
        </div>
    `;
    
    if (typeof window.showModalWithContent === 'function') {
        window.showModalWithContent('service-details-modal', modalContent);
    }
    
    setTimeout(() => {
        const contactBtn = document.querySelector('#service-details-modal .contact-service-btn');
        if (contactBtn) {
            contactBtn.addEventListener('click', () => {
                const phone = contactBtn.getAttribute('data-phone');
                if (phone) window.location.href = `tel:${phone}`;
                else window.showToast('Contact info coming soon', 'info');
            });
        }
        
        const bookBtn = document.querySelector('#service-details-modal .book-service-btn');
        if (bookBtn) {
            bookBtn.addEventListener('click', async () => {
                const user = firebase.auth().currentUser;
                if (!user) {
                    if (typeof window.showToast === 'function') {
                        window.showToast('Please sign in to book this service', 'warning');
                    }
                    if (typeof window.openAuthModal === 'function') window.openAuthModal();
                    return;
                }
                
                const serviceId = bookBtn.getAttribute('data-service-id');
                const result = await servicesManager.getServiceById(serviceId);
                if (result.success) {
                    showBookingModal(result.data);
                }
            });
        }
        
        const editBtn = document.querySelector('#service-details-modal .edit-service-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                window.showToast('Edit feature coming soon', 'info');
            });
        }
        
        const deleteBtn = document.querySelector('#service-details-modal .delete-service-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                if (confirm('Are you sure you want to delete this service?')) {
                    const serviceId = deleteBtn.getAttribute('data-service-id');
                    try {
                        await firebase.firestore().collection('services').doc(serviceId).delete();
                        window.showToast('Service deleted successfully', 'success');
                        if (typeof window.closeModal === 'function') {
                            window.closeModal('service-details-modal');
                        }
                        loadServices();
                    } catch (error) {
                        window.showToast('Error deleting service', 'error');
                    }
                }
            });
        }
    }, 100);
}

// ========== PROMOTE SERVICE ==========
function promoteService(serviceId) {
    const modalContent = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <div class="modal-title">Promote Service</div>
                <button class="close-modal-btn">&times;</button>
            </div>
            <div style="padding: 20px;">
                <p>To promote your service, it needs to be listed in the Marketplace.</p>
                <div class="form-actions" style="display: flex; gap: 10px; margin-top: 20px;">
                    <button class="btn btn-outline close-modal-btn">Cancel</button>
                    <button class="btn btn-primary" id="convert-and-promote-btn">Convert to Marketplace & Promote</button>
                </div>
            </div>
        </div>
    `;
    
    if (typeof window.showModalWithContent === 'function') {
        window.showModalWithContent('promote-service-modal', modalContent);
    }
    
    setTimeout(() => {
        const convertBtn = document.getElementById('convert-and-promote-btn');
        if (convertBtn) {
            convertBtn.addEventListener('click', async () => {
                const result = await servicesManager.getServiceById(serviceId);
                if (result.success) {
                    const service = result.data;
                    const marketplaceData = {
                        category: 'services',
                        title: service.title,
                        description: service.description,
                        price: service.price,
                        location: service.location,
                        phone: service.phone,
                        images: service.images || [],
                        status: 'active',
                        promoted: false,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        userId: service.userId,
                        userName: service.userName,
                        userEmail: service.userEmail,
                        originalServiceId: serviceId
                    };
                    
                    const docRef = await firebase.firestore().collection('marketplace_items').add(marketplaceData);
                    window.showToast('Service copied to Marketplace! Now you can promote it.', 'success');
                    if (typeof window.closeModal === 'function') {
                        window.closeModal('promote-service-modal');
                    }
                    if (typeof window.showAdPackagesModal === 'function') {
                        window.showAdPackagesModal(docRef.id);
                    }
                }
            });
        }
    }, 100);
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
    } else {
        console.error('service-post-modal not found');
        window.showToast('Service form not available', 'error');
    }
}

function setupServiceModalHandlers() {
    const modal = document.getElementById('service-post-modal');
    if (!modal) return;
    
    const closeBtn = modal.querySelector('.close-modal-btn');
    if (closeBtn) {
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            modal.style.display = 'none';
        });
    }
    
    const cancelBtn = modal.querySelector('.btn-outline');
    if (cancelBtn && cancelBtn.textContent.includes('Cancel')) {
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        newCancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            modal.style.display = 'none';
        });
    }
    
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
    const imageInput = document.getElementById('service-images');
    if (imageInput) imageInput.value = '';
    const previewContainer = document.getElementById('service-image-preview');
    if (previewContainer) previewContainer.innerHTML = '';
}

function updateServiceForm() {
    const serviceType = document.getElementById('service-type')?.value;
    const specificFields = document.getElementById('service-specific-fields');
    if (!specificFields) return;
    
    let additionalFields = '';
    switch(serviceType) {
        case 'vehicle-hire':
            additionalFields = `<div class="form-group"><label class="form-label">Vehicle Type</label><select id="service-vehicle-type" class="form-input"><option value="car">Car</option><option value="truck">Truck</option><option value="van">Van</option></select></div><div class="form-group"><label class="form-label">Capacity</label><input type="text" id="service-capacity" class="form-input" placeholder="e.g., 7-seater"></div>`;
            break;
        case 'boda':
            additionalFields = `<div class="form-group"><label class="form-label">Boda Type</label><select id="service-boda-type" class="form-input"><option value="motorcycle">Motorcycle</option><option value="tuk-tuk">Tuk Tuk</option></select></div>`;
            break;
        case 'construction':
            additionalFields = `<div class="form-group"><label class="form-label">Skill Type</label><select id="service-skill-type" class="form-input"><option value="laborer">General Laborer</option><option value="mason">Mason</option><option value="carpenter">Carpenter</option></select></div><div class="form-group"><label class="form-label">Experience</label><input type="text" id="service-experience" class="form-input" placeholder="e.g., 5 years"></div>`;
            break;
        default: additionalFields = '';
    }
    specificFields.innerHTML = additionalFields;
}

function previewServiceImages(files) {
    const container = document.getElementById('service-image-preview');
    if (!container) return;
    container.innerHTML = '';
    
    for (let i = 0; i < Math.min(files.length, 5); i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const previewDiv = document.createElement('div');
                previewDiv.className = 'image-preview-item';
                previewDiv.innerHTML = `
                    <img src="${e.target.result}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;">
                    <button type="button" class="remove-image-btn" data-index="${i}">&times;</button>
                `;
                container.appendChild(previewDiv);
            };
            reader.readAsDataURL(file);
        }
    }
}

async function submitService() {
    console.log('submitService called - saving to Firebase');
    
    const serviceType = document.getElementById('service-type')?.value;
    const title = document.getElementById('service-title')?.value;
    const description = document.getElementById('service-description')?.value;
    const price = document.getElementById('service-price')?.value;
    const location = document.getElementById('service-location')?.value;
    const phone = document.getElementById('service-phone')?.value;
    const imageInput = document.getElementById('service-images');
    const imageFiles = imageInput ? Array.from(imageInput.files) : [];
    
    const user = firebase.auth().currentUser;
    if (!user) {
        window.showToast('Please sign in to post a service', 'error');
        if (typeof window.openAuthModal === 'function') window.openAuthModal();
        return;
    }
    
    if (!serviceType || !title || !description || !price || !location || !phone) {
        window.showToast('Please fill in all required fields', 'error');
        return;
    }
    
    const submitBtn = document.getElementById('submit-service-btn');
    const originalText = submitBtn?.textContent;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="spinner"></div> Saving...';
    }
    
    window.showToast('Saving service to database...', 'info');
    
    const additionalData = {};
    switch(serviceType) {
        case 'vehicle-hire':
            additionalData.vehicleType = document.getElementById('service-vehicle-type')?.value;
            additionalData.capacity = document.getElementById('service-capacity')?.value;
            break;
        case 'boda':
            additionalData.bodaType = document.getElementById('service-boda-type')?.value;
            break;
        case 'construction':
            additionalData.skillType = document.getElementById('service-skill-type')?.value;
            additionalData.experience = document.getElementById('service-experience')?.value;
            break;
    }
    
    const serviceData = {
        title: title,
        description: description,
        price: parseInt(price),
        location: location,
        phone: phone,
        serviceType: serviceType,
        category: serviceType,
        status: 'active',
        ...additionalData
    };
    
    const result = await servicesManager.createService(serviceData, imageFiles);
    
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
    
    if (result.success) {
        window.showToast('✅ Service posted successfully!', 'success');
        
        const modal = document.getElementById('service-post-modal');
        if (modal) modal.style.display = 'none';
        
        resetServicePostForm();
        setTimeout(() => loadServices(), 500);
    } else {
        window.showToast(`Error: ${result.error}`, 'error');
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
    } else {
        console.error('job-post-modal not found');
        window.showToast('Job form not available', 'error');
    }
}

function setupJobModalHandlers() {
    const modal = document.getElementById('job-post-modal');
    if (!modal) return;
    
    const closeBtn = modal.querySelector('.close-modal-btn');
    if (closeBtn) {
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            modal.style.display = 'none';
        });
    }
    
    const cancelBtn = modal.querySelector('.btn-outline');
    if (cancelBtn && cancelBtn.textContent.includes('Cancel')) {
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        newCancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            modal.style.display = 'none';
        });
    }
    
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
    const imageInput = document.getElementById('job-images');
    if (imageInput) imageInput.value = '';
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
    const imageInput = document.getElementById('job-images');
    const imageFiles = imageInput ? Array.from(imageInput.files) : [];
    
    const user = firebase.auth().currentUser;
    if (!user) {
        window.showToast('Please sign in to post a job', 'error');
        if (typeof window.openAuthModal === 'function') window.openAuthModal();
        return;
    }
    
    if (!title || !category || !description || !price || !location || !phone) {
        window.showToast('Please fill in all required fields', 'error');
        return;
    }
    
    const submitBtn = document.getElementById('submit-job-btn');
    const originalText = submitBtn?.textContent;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="spinner"></div> Saving...';
    }
    
    window.showToast('Saving job to database...', 'info');
    
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
    
    const result = await servicesManager.createJob(jobData, imageFiles);
    
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
    
    if (result.success) {
        window.showToast('✅ Job posted successfully!', 'success');
        
        const modal = document.getElementById('job-post-modal');
        if (modal) modal.style.display = 'none';
        
        resetJobPostForm();
        
        if (urgent === 'yes') {
            setTimeout(() => loadUrgentJobs(), 500);
        }
        setTimeout(() => loadServices(), 500);
    } else {
        window.showToast(`Error: ${result.error}`, 'error');
    }
}

// ========== LOCATION FUNCTIONS ==========
function fillServiceLocationFromProfile() {
    if (typeof window.getCurrentLocation === 'function') {
        const location = window.getCurrentLocation();
        const locationInput = document.getElementById('service-location');
        if (locationInput && location.fullAddress) {
            locationInput.value = location.fullAddress;
        }
    }
}

function fillJobLocationFromProfile() {
    if (typeof window.getCurrentLocation === 'function') {
        const location = window.getCurrentLocation();
        const locationInput = document.getElementById('job-location');
        if (locationInput && location.fullAddress) {
            locationInput.value = location.fullAddress;
        }
    }
}

// ========== EXPORT GLOBALLY ==========
window.servicesManager = servicesManager;
window.loadUrgentJobs = loadUrgentJobs;
window.loadServices = loadServices;
window.viewJobDetails = viewJobDetails;
window.showServicePostModal = showServicePostModal;
window.showJobPostModal = showJobPostModal;
window.fillServiceLocationFromProfile = fillServiceLocationFromProfile;
window.fillJobLocationFromProfile = fillJobLocationFromProfile;
window.updateServiceForm = updateServiceForm;
window.submitService = submitService;
window.submitJob = submitJob;
window.promoteService = promoteService;
window.setupServiceModalHandlers = setupServiceModalHandlers;
window.setupJobModalHandlers = setupJobModalHandlers;
window.previewServiceImages = previewServiceImages;
window.showBookingModal = showBookingModal;

// ========== INITIALIZE ON DOM LOAD ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('Services.js DOM loaded - initializing');
    
    setTimeout(() => {
        setupServiceModalHandlers();
        setupJobModalHandlers();
        console.log('Services.js interactive elements initialized');
    }, 300);
    
    setTimeout(loadUrgentJobs, 500);
    setTimeout(() => loadServices(), 1000);
    
    const serviceBtn = document.getElementById('service-post-btn');
    if (serviceBtn) {
        const newServiceBtn = serviceBtn.cloneNode(true);
        serviceBtn.parentNode.replaceChild(newServiceBtn, serviceBtn);
        newServiceBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showServicePostModal();
        });
    }
    
    const jobBtn = document.getElementById('job-post-btn');
    if (jobBtn) {
        const newJobBtn = jobBtn.cloneNode(true);
        jobBtn.parentNode.replaceChild(newJobBtn, jobBtn);
        newJobBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showJobPostModal();
        });
    }
});

console.log('✅ Services.js fully loaded with booking feature');