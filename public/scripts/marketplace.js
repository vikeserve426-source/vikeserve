// marketplace.js - Complete Marketplace with all service functions (FIXED - Firebase Saving)

// ========== HELPER FUNCTIONS ==========
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getCategoryIcon(category) {
    const icons = {
        'electronics': 'fas fa-tv', 'phones': 'fas fa-mobile-alt', 'furniture': 'fas fa-couch',
        'mitumba': 'fas fa-tshirt', 'clothing': 'fas fa-tshirt', 'vehicles': 'fas fa-car',
        'books': 'fas fa-book', 'sports': 'fas fa-basketball-ball', 'services': 'fas fa-tools',
        'hotel': 'fas fa-hotel', 'gas-refill': 'fas fa-fire', 'water-delivery': 'fas fa-tint',
        'land': 'fas fa-vector-square', 'rooms': 'fas fa-door-open', 'bedsitters': 'fas fa-bed',
        'apartments': 'fas fa-building', 'houses': 'fas fa-home', 'short-stays': 'fas fa-hotel',
        'default': 'fas fa-box'
    };
    return icons[category] || icons.default;
}

function formatPrice(item) {
    if (item.category === 'hotel') {
        return `KES ${item.price?.toLocaleString() || '0'}/night`;
    } else if (item.category === 'land' && item.listingType === 'rent') {
        return `KES ${item.price?.toLocaleString() || '0'}/month`;
    } else if (['rooms', 'bedsitters', 'apartments', 'houses', 'short-stays'].includes(item.category)) {
        return `KES ${item.price?.toLocaleString() || '0'}/month`;
    } else {
        return `KES ${item.price?.toLocaleString() || '0'}`;
    }
}

// ========== MARKETPLACE ITEM DISPLAY ==========
function createMarketplaceItemElement(item) {
    const div = document.createElement('div');
    div.className = 'market-item';
    div.setAttribute('data-ad-id', item.id || item.adId);
    
    let isPromoted = false;
    let daysLeft = 0;
    
    const promotedAds = JSON.parse(localStorage.getItem('vikeserve_promoted_ads') || '[]');
    const now = new Date();
    const promotion = promotedAds.find(ad => (ad.adId == item.id || ad.adId == item.adId) && ad.status === 'active' && new Date(ad.expiresAt) > now);
    
    if (promotion) {
        isPromoted = true;
        daysLeft = Math.ceil((new Date(promotion.expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
    }
    
    if (!isPromoted && typeof getPaymentSystem === 'function') {
        try {
            const payments = getPaymentSystem();
            isPromoted = payments.isAdPromoted(item.id || item.adId);
        } catch(e) {}
    }
    
    if (isPromoted) div.classList.add('promoted-ad');
    
    div.onclick = (e) => {
        if (e.target.closest('.market-item-actions')) return;
        if (isPromoted && typeof getPaymentSystem === 'function') {
            try {
                const payments = getPaymentSystem();
                payments.handleAdClick(item.id || item.adId);
                return;
            } catch(e) {}
        }
        viewListingDetails(item.id);
    };
    
    const icon = getCategoryIcon(item.category);
    const priceText = formatPrice(item);
    const daysLeftHtml = isPromoted ? `<div class="promoted-badge" style="margin-top: 4px;"><i class="fas fa-crown"></i> PROMOTED (${daysLeft}d left)</div>` : '';
    
    div.innerHTML = `
        <div class="market-item-img">
            ${item.images && item.images.length > 0 ? 
                `<img src="${item.images[0]}" alt="${escapeHtml(item.title)}" loading="lazy" style="width:100%;height:120px;object-fit:cover;">` : 
                `<i class="${icon}" style="font-size:2rem;"></i>`
            }
            ${item.status === 'sold' ? '<div class="sold-badge">Sold</div>' : ''}
        </div>
        <div class="market-item-info">
            <div class="market-item-title">
                ${escapeHtml(item.title)}
                ${daysLeftHtml}
            </div>
            <div class="market-item-price">${priceText}</div>
            <div class="market-item-location">
                <i class="fas fa-map-marker-alt"></i> ${escapeHtml(item.location || 'Location not specified')}
            </div>
            <div class="market-item-actions">
                <button class="btn btn-sm btn-primary contact-seller-btn" data-item-id="${item.id}" style="width:100%;">
                    <i class="fas fa-comment"></i> Contact Seller
                </button>
            </div>
        </div>
    `;
    
    const contactBtn = div.querySelector('.contact-seller-btn');
    if (contactBtn) {
        contactBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            contactSeller(item.phone || item.id);
        });
    }
    
    return div;
}

// ========== LOAD MARKETPLACE ITEMS FROM FIRESTORE ==========
async function loadMarketplaceItems(category = 'all', filters = {}) {
    const container = document.getElementById('marketplace-items-container');
    if (!container) return;
    
    container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading items...</div>';
    
    try {
        let query = firebase.firestore().collection('marketplace_items').where('status', '==', 'active');
        
        if (category && category !== 'all') {
            query = query.where('category', '==', category);
        }
        
        query = query.orderBy('createdAt', 'desc');
        
        const snapshot = await query.get();
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty-marketplace" style="text-align: center; padding: 60px 20px; grid-column: span 2;">
                    <i class="fas fa-store-slash" style="font-size: 3rem; color: var(--grey-dark); margin-bottom: 15px;"></i>
                    <h3>No Items Listed Yet</h3>
                    <p style="color: var(--grey-dark);">Be the first to sell something!</p>
                    <button class="btn btn-primary show-marketplace-post-btn" style="margin-top: 15px;">
                        <i class="fas fa-plus-circle"></i> Sell an Item
                    </button>
                </div>
            `;
            
            const postBtn = container.querySelector('.show-marketplace-post-btn');
            if (postBtn) {
                postBtn.addEventListener('click', () => showMarketplacePostModal());
            }
            return;
        }
        
        container.innerHTML = '';
        items.forEach(item => {
            container.appendChild(createMarketplaceItemElement(item));
        });
    } catch (error) {
        console.error('Error loading marketplace items:', error);
        container.innerHTML = '<div class="error-message">Failed to load items. Please refresh.</div>';
    }
}

// ========== VIEW LISTING DETAILS ==========
async function viewListingDetails(itemId) {
    try {
        const doc = await firebase.firestore().collection('marketplace_items').doc(itemId).get();
        if (!doc.exists) {
            if (typeof window.showToast === 'function') window.showToast('Item not found', 'error');
            return;
        }
        
        const item = { id: doc.id, ...doc.data() };
        
        let isPromoted = false;
        let daysLeft = 0;
        const promotedAds = JSON.parse(localStorage.getItem('vikeserve_promoted_ads') || '[]');
        const promotion = promotedAds.find(ad => ad.adId == itemId && ad.status === 'active' && new Date(ad.expiresAt) > new Date());
        if (promotion) {
            isPromoted = true;
            daysLeft = Math.ceil((new Date(promotion.expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
        }
        
        const modalContent = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <div class="modal-title">
                        ${escapeHtml(item.title)}
                        ${isPromoted ? `<span class="promoted-badge" style="margin-left: 10px;"><i class="fas fa-crown"></i> PROMOTED (${daysLeft}d left)</span>` : ''}
                    </div>
                    <button class="close-modal-btn">&times;</button>
                </div>
                <div style="padding: 10px 0;">
                    <div style="background: var(--light); padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary);">${formatPrice(item)}</div>
                        <div style="display: flex; gap: 10px; margin-top: 5px; flex-wrap: wrap;">
                            <span style="background: var(--grey); padding: 2px 8px; border-radius: 12px; font-size: 0.7rem;">${item.condition || 'N/A'}</span>
                            ${item.negotiable ? '<span style="background: var(--success); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem;">Negotiable</span>' : ''}
                            ${item.delivery ? '<span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem;">Delivery Available</span>' : ''}
                        </div>
                    </div>
                    <div class="form-group"><label class="form-label">Description</label><p style="line-height: 1.5;">${escapeHtml(item.description)}</p></div>
                    <div class="form-group"><label class="form-label">Location</label><p><i class="fas fa-map-marker-alt"></i> ${escapeHtml(item.location)}</p></div>
                    <div class="form-group"><label class="form-label">Contact</label><p><i class="fas fa-phone"></i> ${escapeHtml(item.phone)}</p>${item.whatsapp ? `<p><i class="fab fa-whatsapp"></i> ${escapeHtml(item.whatsapp)}</p>` : ''}</div>
                    <div class="form-actions" style="display: flex; gap: 10px; margin-top: 20px;">
                        <button class="btn btn-primary call-seller-btn" data-phone="${item.phone}" style="flex: 1;"><i class="fas fa-phone"></i> Call Seller</button>
                        <button class="btn btn-outline whatsapp-seller-btn" data-phone="${item.whatsapp || item.phone}" style="flex: 1;"><i class="fab fa-whatsapp"></i> WhatsApp</button>
                    </div>
                </div>
            </div>
        `;
        
        if (typeof window.showModalWithContent === 'function') {
            window.showModalWithContent('item-details-modal', modalContent);
        }
        
        setTimeout(() => {
            const closeBtn = document.querySelector('#item-details-modal .close-modal-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    if (typeof window.closeModal === 'function') window.closeModal('item-details-modal');
                });
            }
            
            const callBtn = document.querySelector('#item-details-modal .call-seller-btn');
            if (callBtn) {
                callBtn.addEventListener('click', () => contactSeller(callBtn.getAttribute('data-phone')));
            }
            
            const whatsappBtn = document.querySelector('#item-details-modal .whatsapp-seller-btn');
            if (whatsappBtn) {
                whatsappBtn.addEventListener('click', () => whatsappSeller(whatsappBtn.getAttribute('data-phone')));
            }
        }, 100);
    } catch (error) {
        console.error('Error viewing listing:', error);
        if (typeof window.showToast === 'function') window.showToast('Error loading details', 'error');
    }
}

function contactSeller(phone) {
    window.location.href = `tel:${phone}`;
}

function whatsappSeller(phone) {
    let formattedPhone = phone.replace(/^0/, '254').replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${formattedPhone}`, '_blank');
}

// ========== GENERAL MARKETPLACE FORM FUNCTIONS ==========
function updateMarketplaceForm() {
    const category = document.getElementById('market-category')?.value;
    const categoryFields = document.getElementById('category-specific-fields');
    if (!categoryFields) return;
    
    document.querySelectorAll('.category-fields').forEach(field => field.style.display = 'none');
    
    if (!category || category === '') {
        categoryFields.style.display = 'none';
        return;
    }
    
    categoryFields.style.display = 'block';
    switch(category) {
        case 'electronics': 
            const electronicsFields = document.getElementById('electronics-fields');
            if (electronicsFields) electronicsFields.style.display = 'block';
            break;
        case 'phones': 
            const phonesFields = document.getElementById('phones-fields');
            if (phonesFields) phonesFields.style.display = 'block';
            break;
        case 'furniture': 
            const furnitureFields = document.getElementById('furniture-fields');
            if (furnitureFields) furnitureFields.style.display = 'block';
            break;
        case 'mitumba': case 'clothing': 
            const clothingFields = document.getElementById('clothing-fields');
            if (clothingFields) clothingFields.style.display = 'block';
            break;
        case 'vehicles': 
            const vehiclesFields = document.getElementById('vehicles-fields');
            if (vehiclesFields) vehiclesFields.style.display = 'block';
            break;
        default: categoryFields.style.display = 'none';
    }
}

function previewMarketplaceImages(files) {
    const container = document.getElementById('image-preview-container');
    if (!container) return;
    container.innerHTML = '';
    const maxFiles = Math.min(files.length, 5);
    for (let i = 0; i < maxFiles; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const previewDiv = document.createElement('div');
                previewDiv.className = 'image-preview-item';
                previewDiv.style.position = 'relative';
                previewDiv.style.display = 'inline-block';
                previewDiv.style.margin = '5px';
                previewDiv.innerHTML = `
                    <img src="${e.target.result}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;">
                    <button type="button" class="remove-image-btn">&times;</button>
                `;
                
                const removeBtn = previewDiv.querySelector('.remove-image-btn');
                if (removeBtn) {
                    removeBtn.addEventListener('click', () => previewDiv.remove());
                }
                
                container.appendChild(previewDiv);
            };
            reader.readAsDataURL(file);
        }
    }
}

// ========== SUBMIT FUNCTIONS WITH FIREBASE SAVING ==========
async function submitMarketplaceItem() {
    console.log('submitMarketplaceItem called - saving to Firebase');
    const category = document.getElementById('market-category')?.value;
    const title = document.getElementById('market-title')?.value.trim();
    const description = document.getElementById('market-description')?.value.trim();
    const price = document.getElementById('market-price')?.value;
    const condition = document.getElementById('market-condition')?.value;
    const location = document.getElementById('market-location')?.value.trim();
    const phone = document.getElementById('market-phone')?.value.trim();
    const whatsapp = document.getElementById('market-whatsapp')?.value.trim();
    const negotiable = document.getElementById('market-negotiable')?.checked;
    const delivery = document.getElementById('market-delivery')?.checked;
    
    const user = firebase.auth().currentUser;
    if (!user) {
        if (typeof window.showToast === 'function') {
            window.showToast('Please sign in to list an item', 'error');
        }
        if (typeof window.openAuthModal === 'function') {
            window.openAuthModal();
        }
        return;
    }
    
    if (!category || !title || !description || !price || price <= 0 || !condition || !location || !phone) {
        if (typeof window.showToast === 'function') window.showToast('Please fill in all required fields', 'error');
        return;
    }
    
    if (typeof window.showToast === 'function') {
        window.showToast('Saving item to database...', 'info');
    }
    
    const itemData = {
        category: category,
        title: title,
        description: description,
        price: parseInt(price),
        condition: condition,
        location: location,
        phone: phone,
        whatsapp: whatsapp || phone,
        negotiable: negotiable,
        delivery: delivery,
        status: 'active',
        promoted: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        userId: user.uid,
        userName: user.displayName || user.email || 'User',
        userEmail: user.email
    };
    
     // Add category-specific fields (only if they exist and have values)
    switch(category) {
        case 'electronics':
            const elecBrand = document.getElementById('elec-brand')?.value;
            const elecModel = document.getElementById('elec-model')?.value;
            const elecYear = document.getElementById('elec-year')?.value;
            if (elecBrand) itemData.brand = elecBrand;
            if (elecModel) itemData.model = elecModel;
            if (elecYear) itemData.year = elecYear;
            break;
        case 'phones':
            const phoneBrand = document.getElementById('phone-brand')?.value;
            const phoneModel = document.getElementById('phone-model')?.value;
            const phoneStorage = document.getElementById('phone-storage')?.value;
            const phoneRam = document.getElementById('phone-ram')?.value;
            if (phoneBrand) itemData.brand = phoneBrand;
            if (phoneModel) itemData.model = phoneModel;
            if (phoneStorage) itemData.storage = phoneStorage;
            if (phoneRam) itemData.ram = phoneRam;
            break;
        case 'furniture':
            const furnitureType = document.getElementById('furniture-type')?.value;
            const furnitureMaterial = document.getElementById('furniture-material')?.value;
            if (furnitureType) itemData.furnitureType = furnitureType;
            if (furnitureMaterial) itemData.material = furnitureMaterial;
            break;
        case 'mitumba':
            const clothingType = document.getElementById('clothing-type')?.value;
            const clothingSize = document.getElementById('clothing-size')?.value;
            if (clothingType) itemData.clothingType = clothingType;
            if (clothingSize) itemData.size = clothingSize;
            break;
        case 'vehicles':
            const vehicleMake = document.getElementById('vehicle-make')?.value;
            const vehicleModel = document.getElementById('vehicle-model')?.value;
            const vehicleYear = document.getElementById('vehicle-year')?.value;
            if (vehicleMake) itemData.make = vehicleMake;
            if (vehicleModel) itemData.model = vehicleModel;
            if (vehicleYear) itemData.year = vehicleYear;
            break;
    }
    
    try {
        const docRef = await firebase.firestore().collection('marketplace_items').add(itemData);
        console.log('Item saved to Firebase with ID:', docRef.id);
        
        if (typeof window.showToast === 'function') {
            window.showToast('✅ Item listed successfully on Firebase!', 'success');
        }
        
        const modal = document.getElementById('marketplace-post-modal');
        if (modal) modal.style.display = 'none';
        
        resetMarketplaceForm();
        setTimeout(() => {
            loadMarketplaceItems('all');
            if (typeof window.switchTab === 'function') window.switchTab('marketplace-tab');
        }, 500);
    } catch (error) {
        console.error('Error saving item:', error);
        if (typeof window.showToast === 'function') {
            window.showToast(`Error: ${error.message}`, 'error');
        }
    }
}

function resetMarketplaceForm() {
    const fields = ['market-category', 'market-title', 'market-description', 'market-price', 'market-condition', 'market-location', 'market-phone', 'market-whatsapp'];
    fields.forEach(id => { const field = document.getElementById(id); if (field) field.value = ''; });
    const checkboxes = ['market-negotiable', 'market-delivery'];
    checkboxes.forEach(id => { const cb = document.getElementById(id); if (cb) cb.checked = false; });
    const previewContainer = document.getElementById('image-preview-container');
    if (previewContainer) previewContainer.innerHTML = '';
    const categoryFields = document.getElementById('category-specific-fields');
    if (categoryFields) categoryFields.style.display = 'none';
    document.querySelectorAll('.category-fields input, .category-fields select').forEach(field => field.value = '');
    
    fillLocationFromProfile('market');
}

// ========== MODAL SHOW FUNCTIONS ==========
function showMarketplacePostModal() {
    console.log('showMarketplacePostModal called');
    resetMarketplaceForm();
    const modal = document.getElementById('marketplace-post-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '10001';
        console.log('Marketplace modal opened');
    } else {
        console.error('marketplace-post-modal not found');
        if (typeof window.showToast === 'function') window.showToast('Form not available', 'error');
    }
}

// Setup marketplace modal handlers (call once on load)
function setupMarketplaceModalHandlers() {
    const modal = document.getElementById('marketplace-post-modal');
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
            console.log('Marketplace modal closed');
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
            console.log('Marketplace modal cancelled');
        });
    }
    
    // Handle submit button
    const submitBtn = document.getElementById('submit-marketplace-btn');
    if (submitBtn) {
        const newSubmitBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
        newSubmitBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            submitMarketplaceItem();
        });
        console.log('✅ Marketplace submit button attached');
    }
}

// ========== GAS REFILL FUNCTIONS ==========
function resetGasRefillForm() {
    const fields = ['gas-title', 'gas-type', 'gas-cylinder-size', 'gas-price', 'gas-brand', 'gas-location', 'gas-description', 'gas-phone', 'gas-hours'];
    fields.forEach(id => {
        const field = document.getElementById(id);
        if (field) field.value = '';
    });
    const checkboxes = document.querySelectorAll('input[name="gas-features"]');
    checkboxes.forEach(cb => cb.checked = false);
    const defaultChecked = document.querySelector('input[name="gas-features"][value="delivery"]');
    if (defaultChecked) defaultChecked.checked = true;
    
    fillLocationFromProfile('gas');
}

function showGasRefillPostModal() {
    console.log('showGasRefillPostModal called');
    resetGasRefillForm();
    const modal = document.getElementById('gas-refill-post-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '10001';
        
        const closeBtn = modal.querySelector('.close-modal-btn');
        if (closeBtn) {
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            newCloseBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
        
        const cancelBtn = modal.querySelector('.btn-outline');
        if (cancelBtn) {
            const newCancelBtn = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            newCancelBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
        
        const submitBtn = document.getElementById('submit-gas-btn');
        if (submitBtn) {
            const newSubmitBtn = submitBtn.cloneNode(true);
            submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
            newSubmitBtn.addEventListener('click', submitGasRefillListing);
        }
    } else {
        console.error('gas-refill-post-modal not found');
        if (typeof window.showToast === 'function') window.showToast('Form not available', 'error');
    }
}

async function submitGasRefillListing() {
    console.log('submitGasRefillListing called - saving to Firebase');
    const title = document.getElementById('gas-title')?.value.trim();
    const gasType = document.getElementById('gas-type')?.value;
    const cylinderSize = document.getElementById('gas-cylinder-size')?.value;
    const price = document.getElementById('gas-price')?.value;
    const brand = document.getElementById('gas-brand')?.value;
    const location = document.getElementById('gas-location')?.value.trim();
    const description = document.getElementById('gas-description')?.value.trim();
    const phone = document.getElementById('gas-phone')?.value.trim();
    const hours = document.getElementById('gas-hours')?.value.trim();
    
    const features = [];
    document.querySelectorAll('input[name="gas-features"]:checked').forEach(cb => features.push(cb.value));
    
    const user = firebase.auth().currentUser;
    if (!user) {
        if (typeof window.showToast === 'function') {
            window.showToast('Please sign in to list a service', 'error');
        }
        if (typeof window.openAuthModal === 'function') {
            window.openAuthModal();
        }
        return;
    }
    
    if (!title || !gasType || !cylinderSize || !price || !location || !description || !phone) {
        if (typeof window.showToast === 'function') window.showToast('Please fill in all required fields', 'error');
        return;
    }
    
    if (typeof window.showToast === 'function') {
        window.showToast('Saving gas service to database...', 'info');
    }
    
    const gasData = {
        category: 'gas-refill',
        title: title,
        gasType: gasType,
        cylinderSize: cylinderSize,
        price: parseInt(price),
        brand: brand || 'Not specified',
        location: location,
        description: description,
        phone: phone,
        hours: hours || '24/7',
        features: features,
        status: 'active',
        promoted: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        userId: user.uid,
        userName: user.displayName || user.email || 'User',
        userEmail: user.email
    };
    
    try {
        const docRef = await firebase.firestore().collection('marketplace_items').add(gasData);
        console.log('Gas service saved to Firebase with ID:', docRef.id);
        
        if (typeof window.showToast === 'function') {
            window.showToast('✅ Gas refill service listed successfully on Firebase!', 'success');
        }
        
        const modal = document.getElementById('gas-refill-post-modal');
        if (modal) modal.style.display = 'none';
        
        resetGasRefillForm();
        setTimeout(() => loadMarketplaceItems('gas-refill'), 500);
    } catch (error) {
        console.error('Error saving gas service:', error);
        if (typeof window.showToast === 'function') {
            window.showToast(`Error: ${error.message}`, 'error');
        }
    }
}

// ========== WATER DELIVERY FUNCTIONS ==========
function resetWaterDeliveryForm() {
    const fields = ['water-title', 'water-type', 'water-container-size', 'water-price', 'water-min-order', 'water-location', 'water-description', 'water-phone', 'water-areas'];
    fields.forEach(id => {
        const field = document.getElementById(id);
        if (field) field.value = '';
    });
    const checkboxes = document.querySelectorAll('input[name="water-features"]');
    checkboxes.forEach(cb => cb.checked = false);
    const defaultChecked = document.querySelector('input[name="water-features"][value="delivery"]');
    if (defaultChecked) defaultChecked.checked = true;
    
    fillLocationFromProfile('water');
}

function showWaterDeliveryPostModal() {
    console.log('showWaterDeliveryPostModal called');
    resetWaterDeliveryForm();
    const modal = document.getElementById('water-delivery-post-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '10001';
        
        const closeBtn = modal.querySelector('.close-modal-btn');
        if (closeBtn) {
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            newCloseBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
        
        const cancelBtn = modal.querySelector('.btn-outline');
        if (cancelBtn) {
            const newCancelBtn = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            newCancelBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
        
        const submitBtn = document.getElementById('submit-water-btn');
        if (submitBtn) {
            const newSubmitBtn = submitBtn.cloneNode(true);
            submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
            newSubmitBtn.addEventListener('click', submitWaterDeliveryListing);
        }
    } else {
        console.error('water-delivery-post-modal not found');
        if (typeof window.showToast === 'function') window.showToast('Form not available', 'error');
    }
}

async function submitWaterDeliveryListing() {
    console.log('submitWaterDeliveryListing called - saving to Firebase');
    const title = document.getElementById('water-title')?.value.trim();
    const waterType = document.getElementById('water-type')?.value;
    const containerSize = document.getElementById('water-container-size')?.value;
    const price = document.getElementById('water-price')?.value;
    const minOrder = document.getElementById('water-min-order')?.value;
    const location = document.getElementById('water-location')?.value.trim();
    const description = document.getElementById('water-description')?.value.trim();
    const phone = document.getElementById('water-phone')?.value.trim();
    const areas = document.getElementById('water-areas')?.value.trim();
    
    const features = [];
    document.querySelectorAll('input[name="water-features"]:checked').forEach(cb => features.push(cb.value));
    
    const user = firebase.auth().currentUser;
    if (!user) {
        if (typeof window.showToast === 'function') {
            window.showToast('Please sign in to list a service', 'error');
        }
        if (typeof window.openAuthModal === 'function') {
            window.openAuthModal();
        }
        return;
    }
    
    if (!title || !waterType || !containerSize || !price || !location || !description || !phone) {
        if (typeof window.showToast === 'function') window.showToast('Please fill in all required fields', 'error');
        return;
    }
    
    if (typeof window.showToast === 'function') {
        window.showToast('Saving water service to database...', 'info');
    }
    
    const waterData = {
        category: 'water-delivery',
        title: title,
        waterType: waterType,
        containerSize: containerSize,
        price: parseInt(price),
        minOrder: minOrder ? parseInt(minOrder) : 1,
        location: location,
        description: description,
        phone: phone,
        deliveryAreas: areas || location,
        features: features,
        status: 'active',
        promoted: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        userId: user.uid,
        userName: user.displayName || user.email || 'User',
        userEmail: user.email
    };
    
    try {
        const docRef = await firebase.firestore().collection('marketplace_items').add(waterData);
        console.log('Water service saved to Firebase with ID:', docRef.id);
        
        if (typeof window.showToast === 'function') {
            window.showToast('✅ Water delivery service listed successfully on Firebase!', 'success');
        }
        
        const modal = document.getElementById('water-delivery-post-modal');
        if (modal) modal.style.display = 'none';
        
        resetWaterDeliveryForm();
        setTimeout(() => loadMarketplaceItems('water-delivery'), 500);
    } catch (error) {
        console.error('Error saving water service:', error);
        if (typeof window.showToast === 'function') {
            window.showToast(`Error: ${error.message}`, 'error');
        }
    }
}

// ========== HOTEL FUNCTIONS ==========
let hotelImageUrls = [];

function resetHotelForm() {
    const fields = ['hotel-name', 'hotel-type', 'hotel-price', 'hotel-rooms', 'hotel-rating', 'hotel-location', 'hotel-description', 'hotel-phone'];
    fields.forEach(id => {
        const field = document.getElementById(id);
        if (field) field.value = '';
    });
    const checkboxes = document.querySelectorAll('input[name="features"]');
    checkboxes.forEach(cb => cb.checked = false);
    const previewContainer = document.getElementById('hotel-image-preview-container');
    if (previewContainer) previewContainer.innerHTML = '';
    
    fillLocationFromProfile('hotel');
}

function showHotelPostModal() {
    console.log('showHotelPostModal called');
    resetHotelForm();
    hotelImageUrls = [];
    const modal = document.getElementById('hotel-post-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '10001';
        
        const closeBtn = modal.querySelector('.close-modal-btn');
        if (closeBtn) {
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            newCloseBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
        
        const cancelBtn = modal.querySelector('.btn-outline');
        if (cancelBtn) {
            const newCancelBtn = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            newCancelBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
        
        const submitBtn = document.getElementById('submit-hotel-btn');
        if (submitBtn) {
            const newSubmitBtn = submitBtn.cloneNode(true);
            submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
            newSubmitBtn.addEventListener('click', submitHotelListing);
        }
    } else {
        console.error('hotel-post-modal not found');
        if (typeof window.showToast === 'function') window.showToast('Form not available', 'error');
    }
}

function triggerImageUpload(type) {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*';
    input.onchange = (e) => handleImageSelection(e.target.files, type);
    input.click();
}

function handleImageSelection(files, type) {
    const container = document.getElementById(`${type}-image-preview-container`);
    if (!container) return;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const previewDiv = document.createElement('div');
                previewDiv.className = 'image-preview-item';
                previewDiv.innerHTML = `
                    <img src="${e.target.result}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;">
                    <button type="button" class="remove-image-btn">&times;</button>
                `;
                
                const removeBtn = previewDiv.querySelector('.remove-image-btn');
                if (removeBtn) {
                    removeBtn.addEventListener('click', () => {
                        previewDiv.remove();
                        const index = hotelImageUrls.indexOf(e.target.result);
                        if (index > -1) hotelImageUrls.splice(index, 1);
                    });
                }
                
                container.appendChild(previewDiv);
                if (type === 'hotel') hotelImageUrls.push(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    }
}

async function submitHotelListing() {
    console.log('submitHotelListing called - saving to Firebase');
    const name = document.getElementById('hotel-name')?.value.trim();
    const hotelType = document.getElementById('hotel-type')?.value;
    const price = document.getElementById('hotel-price')?.value;
    const rooms = document.getElementById('hotel-rooms')?.value;
    const rating = document.getElementById('hotel-rating')?.value;
    const location = document.getElementById('hotel-location')?.value.trim();
    const description = document.getElementById('hotel-description')?.value.trim();
    const phone = document.getElementById('hotel-phone')?.value.trim();
    
    const features = [];
    document.querySelectorAll('input[name="features"]:checked').forEach(cb => features.push(cb.value));
    
    const user = firebase.auth().currentUser;
    if (!user) {
        if (typeof window.showToast === 'function') {
            window.showToast('Please sign in to list a hotel', 'error');
        }
        if (typeof window.openAuthModal === 'function') {
            window.openAuthModal();
        }
        return;
    }
    
    if (!name || !hotelType || !price || !rooms || !location || !description || !phone) {
        if (typeof window.showToast === 'function') window.showToast('Please fill in all required fields', 'error');
        return;
    }
    
    if (typeof window.showToast === 'function') {
        window.showToast('Saving hotel to database...', 'info');
    }
    
    const hotelData = {
        category: 'hotel',
        title: name,
        hotelType: hotelType,
        price: parseInt(price),
        rooms: parseInt(rooms),
        rating: rating ? parseInt(rating) : 3,
        location: location,
        description: description,
        phone: phone,
        features: features,
        images: hotelImageUrls,
        status: 'active',
        promoted: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        userId: user.uid,
        userName: user.displayName || user.email || 'User',
        userEmail: user.email
    };
    
    try {
        const docRef = await firebase.firestore().collection('marketplace_items').add(hotelData);
        console.log('Hotel saved to Firebase with ID:', docRef.id);
        
        if (typeof window.showToast === 'function') {
            window.showToast('✅ Hotel listed successfully on Firebase!', 'success');
        }
        
        const modal = document.getElementById('hotel-post-modal');
        if (modal) modal.style.display = 'none';
        
        resetHotelForm();
        hotelImageUrls = [];
        setTimeout(() => loadMarketplaceItems('hotel'), 500);
    } catch (error) {
        console.error('Error saving hotel:', error);
        if (typeof window.showToast === 'function') {
            window.showToast(`Error: ${error.message}`, 'error');
        }
    }
}

// ========== PROPERTY FUNCTIONS (FIXED) ==========
let propertyImageUrls = [];

function resetPropertyForm() {
    console.log('Resetting property form');
    const fields = ['property-type', 'property-title', 'property-price', 'property-location', 'property-bedrooms', 'property-bathrooms', 'property-description'];
    fields.forEach(id => {
        const field = document.getElementById(id);
        if (field) field.value = '';
    });
    const previewContainer = document.getElementById('property-images-container');
    if (previewContainer) previewContainer.innerHTML = '';
    propertyImageUrls = [];
}

function showPropertyPostModal() {
    console.log('showPropertyPostModal called');
    resetPropertyForm();
    propertyImageUrls = [];
    
    const modal = document.getElementById('property-post-modal');
    if (!modal) {
        console.error('property-post-modal not found');
        if (typeof window.showToast === 'function') {
            window.showToast('Property form not available', 'error');
        }
        return;
    }
    
    modal.style.display = 'flex';
    modal.style.zIndex = '10001';
    console.log('Property modal opened');
}

// Setup property modal handlers (call once on load)
function setupPropertyModalHandlers() {
    const modal = document.getElementById('property-post-modal');
    if (!modal) {
        console.warn('property-post-modal not found for setup');
        return;
    }
    
    // Handle all close buttons
    const closeBtns = modal.querySelectorAll('.close-modal-btn');
    closeBtns.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            modal.style.display = 'none';
            resetPropertyForm();
            console.log('Property modal closed');
        });
    });
    
    // Handle cancel button
    const cancelBtn = modal.querySelector('.btn-outline');
    if (cancelBtn && cancelBtn.textContent.includes('Cancel')) {
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        newCancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            modal.style.display = 'none';
            resetPropertyForm();
            console.log('Property modal cancelled');
        });
        console.log('✅ Property cancel button attached');
    }
    
    // Handle submit button
    const submitBtn = document.getElementById('submit-property-btn');
    if (submitBtn) {
        const newSubmitBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
        newSubmitBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Property submit button clicked');
            await submitProperty();
        });
        console.log('✅ Property submit button attached');
    } else {
        console.error('submit-property-btn not found!');
    }
}

function uploadPropertyImages() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*';
    input.onchange = (e) => handlePropertyImageSelection(e.target.files);
    input.click();
}

function handlePropertyImageSelection(files) {
    const container = document.getElementById('property-images-container');
    if (!container) return;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const previewDiv = document.createElement('div');
                previewDiv.className = 'image-preview-item';
                previewDiv.innerHTML = `
                    <img src="${e.target.result}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;">
                    <button type="button" class="remove-image-btn">&times;</button>
                `;
                
                const removeBtn = previewDiv.querySelector('.remove-image-btn');
                if (removeBtn) {
                    removeBtn.addEventListener('click', () => {
                        previewDiv.remove();
                        const index = propertyImageUrls.indexOf(e.target.result);
                        if (index > -1) propertyImageUrls.splice(index, 1);
                    });
                }
                
                container.appendChild(previewDiv);
                propertyImageUrls.push(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    }
}

async function submitProperty() {
    console.log('submitProperty called - saving to Firebase');
    
    // Get form values
    const type = document.getElementById('property-type')?.value;
    const title = document.getElementById('property-title')?.value.trim();
    const price = document.getElementById('property-price')?.value;
    const location = document.getElementById('property-location')?.value.trim();
    const bedrooms = document.getElementById('property-bedrooms')?.value;
    const bathrooms = document.getElementById('property-bathrooms')?.value;
    const description = document.getElementById('property-description')?.value.trim();
    
    console.log('Property data collected:', { type, title, price, location, description });
    
    // Check if user is logged in
    const user = firebase.auth().currentUser;
    if (!user) {
        if (typeof window.showToast === 'function') {
            window.showToast('Please sign in to list a property', 'error');
        }
        if (typeof window.openAuthModal === 'function') {
            window.openAuthModal();
        }
        return;
    }
    
    // Validate required fields
    const errors = [];
    if (!type) errors.push('Property type');
    if (!title) errors.push('Title');
    if (!price) errors.push('Price');
    if (!location) errors.push('Location');
    if (!description) errors.push('Description');
    
    if (errors.length > 0) {
        if (typeof window.showToast === 'function') {
            window.showToast(`Please fill in: ${errors.join(', ')}`, 'error');
        }
        return;
    }
    
    if (typeof window.showToast === 'function') {
        window.showToast('Saving property to database...', 'info');
    }
    
    const propertyData = {
        category: type,
        title: title,
        price: parseInt(price),
        location: location,
        bedrooms: bedrooms ? parseInt(bedrooms) : 0,
        bathrooms: bathrooms ? parseInt(bathrooms) : 0,
        description: description,
        images: propertyImageUrls || [],
        status: 'active',
        promoted: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        userId: user.uid,
        userName: user.displayName || user.email || 'User',
        userEmail: user.email
    };
    
    try {
        const docRef = await firebase.firestore().collection('marketplace_items').add(propertyData);
        console.log('✅ Property saved to Firebase with ID:', docRef.id);
        
        if (typeof window.showToast === 'function') {
            window.showToast('✅ Property listed successfully!', 'success');
        }
        
        // Close modal
        const modal = document.getElementById('property-post-modal');
        if (modal) modal.style.display = 'none';
        
        // Reset form
        resetPropertyForm();
        propertyImageUrls = [];
        
        // Refresh marketplace items
        setTimeout(() => {
            loadMarketplaceItems(type);
        }, 500);
        
    } catch (error) {
        console.error('Error saving property:', error);
        if (typeof window.showToast === 'function') {
            window.showToast(`Error: ${error.message}`, 'error');
        }
    }
}

// ========== LAND FUNCTIONS ==========
let landImageUrls = [];

function resetLandForm() {
    const fields = ['land-title', 'land-description', 'land-price', 'land-size', 'land-location', 'land-type', 'land-title-deed', 'land-phone'];
    fields.forEach(id => {
        const field = document.getElementById(id);
        if (field) field.value = '';
    });
    const listingType = document.getElementById('land-listing-type');
    if (listingType) listingType.value = 'sale';
    const checkboxes = document.querySelectorAll('input[name="land-features"]');
    checkboxes.forEach(cb => cb.checked = false);
    const customSizeGroup = document.getElementById('custom-size-group');
    if (customSizeGroup) customSizeGroup.style.display = 'none';
    const previewContainer = document.getElementById('land-image-preview-container');
    if (previewContainer) previewContainer.innerHTML = '';
    
    fillLocationFromProfile('land');
}

function showLandPostModal() {
    console.log('showLandPostModal called');
    resetLandForm();
    landImageUrls = [];
    const modal = document.getElementById('land-post-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '10001';
        setupLandSizeListener();
        
        const closeBtn = modal.querySelector('.close-modal-btn');
        if (closeBtn) {
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            newCloseBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
        
        const cancelBtn = modal.querySelector('.btn-outline');
        if (cancelBtn) {
            const newCancelBtn = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            newCancelBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
        
        const submitBtn = document.getElementById('submit-land-btn');
        if (submitBtn) {
            const newSubmitBtn = submitBtn.cloneNode(true);
            submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
            newSubmitBtn.addEventListener('click', submitLandListing);
        }
    } else {
        console.error('land-post-modal not found');
        if (typeof window.showToast === 'function') window.showToast('Form not available', 'error');
    }
}

function triggerLandImageUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*';
    input.onchange = (e) => handleLandImageSelection(e.target.files);
    input.click();
}

function handleLandImageSelection(files) {
    const container = document.getElementById('land-image-preview-container');
    if (!container) return;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const previewDiv = document.createElement('div');
                previewDiv.className = 'image-preview-item';
                previewDiv.innerHTML = `
                    <img src="${e.target.result}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;">
                    <button type="button" class="remove-image-btn">&times;</button>
                `;
                
                const removeBtn = previewDiv.querySelector('.remove-image-btn');
                if (removeBtn) {
                    removeBtn.addEventListener('click', () => {
                        previewDiv.remove();
                        const index = landImageUrls.indexOf(e.target.result);
                        if (index > -1) landImageUrls.splice(index, 1);
                    });
                }
                
                container.appendChild(previewDiv);
                landImageUrls.push(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    }
}

function setupLandSizeListener() {
    const sizeSelect = document.getElementById('land-size');
    if (sizeSelect) {
        const newSizeSelect = sizeSelect.cloneNode(true);
        sizeSelect.parentNode.replaceChild(newSizeSelect, sizeSelect);
        newSizeSelect.addEventListener('change', function() {
            const customGroup = document.getElementById('custom-size-group');
            if (customGroup) {
                customGroup.style.display = this.value === 'custom' ? 'block' : 'none';
            }
        });
    }
}

async function submitLandListing() {
    console.log('submitLandListing called - saving to Firebase');
    const listingType = document.getElementById('land-listing-type')?.value;
    const title = document.getElementById('land-title')?.value.trim();
    const description = document.getElementById('land-description')?.value.trim();
    const price = document.getElementById('land-price')?.value;
    const size = document.getElementById('land-size')?.value;
    const customSize = document.getElementById('land-custom-size')?.value;
    const location = document.getElementById('land-location')?.value;
    const landType = document.getElementById('land-type')?.value;
    const titleDeed = document.getElementById('land-title-deed')?.value;
    const phone = document.getElementById('land-phone')?.value.trim();
    
    const features = [];
    document.querySelectorAll('input[name="land-features"]:checked').forEach(cb => features.push(cb.value));
    
    const user = firebase.auth().currentUser;
    if (!user) {
        if (typeof window.showToast === 'function') {
            window.showToast('Please sign in to list land', 'error');
        }
        if (typeof window.openAuthModal === 'function') {
            window.openAuthModal();
        }
        return;
    }
    
    if (!listingType || !title || !description || !price || !location || !phone) {
        if (typeof window.showToast === 'function') window.showToast('Please fill in all required fields', 'error');
        return;
    }
    
    if (typeof window.showToast === 'function') {
        window.showToast('Saving land listing to database...', 'info');
    }
    
    const finalSize = size === 'custom' ? customSize : size;
    
    const landData = {
        category: 'land',
        listingType: listingType,
        title: title,
        description: description,
        price: parseInt(price),
        size: finalSize,
        location: location,
        landType: landType || 'Not specified',
        titleDeed: titleDeed || 'Not specified',
        phone: phone,
        features: features,
        images: landImageUrls,
        status: 'active',
        promoted: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        userId: user.uid,
        userName: user.displayName || user.email || 'User',
        userEmail: user.email
    };
    
    try {
        const docRef = await firebase.firestore().collection('marketplace_items').add(landData);
        console.log('Land listing saved to Firebase with ID:', docRef.id);
        
        if (typeof window.showToast === 'function') {
            window.showToast('✅ Land listed successfully on Firebase!', 'success');
        }
        
        const modal = document.getElementById('land-post-modal');
        if (modal) modal.style.display = 'none';
        
        resetLandForm();
        landImageUrls = [];
        setTimeout(() => loadMarketplaceItems('land'), 500);
    } catch (error) {
        console.error('Error saving land listing:', error);
        if (typeof window.showToast === 'function') {
            window.showToast(`Error: ${error.message}`, 'error');
        }
    }
}

// ========== LOCATION FUNCTIONS ==========
function getCurrentUserLocation() {
    if (typeof window.getCurrentLocation === 'function') {
        const location = window.getCurrentLocation();
        return location;
    }
    return { country: '', state: '', city: '', fullAddress: '' };
}

function fillLocationFromProfile(formType) {
    const location = getCurrentUserLocation();
    const locationInput = document.getElementById(`${formType}-location`);
    
    if (locationInput && location.fullAddress) {
        locationInput.value = location.fullAddress;
        if (typeof window.showToast === 'function') {
            window.showToast('Location filled from profile', 'success');
        }
    } else if (locationInput && location.country) {
        let locationText = '';
        if (location.city) locationText += location.city;
        if (location.state) locationText += locationText ? `, ${location.state}` : location.state;
        if (location.country) locationText += locationText ? `, ${location.country}` : location.country;
        locationInput.value = locationText || location.country;
    }
}

// ========== BUTTON SETUP ==========
function setupMarketplaceButtons() {
    console.log('Setting up marketplace buttons...');
    
    const buttons = [
        { id: 'marketplace-post-btn', handler: showMarketplacePostModal },
        { id: 'gas-refill-post-btn', handler: showGasRefillPostModal },
        { id: 'water-delivery-post-btn', handler: showWaterDeliveryPostModal },
        { id: 'hotel-post-btn', handler: showHotelPostModal },
        { id: 'property-post-btn', handler: showPropertyPostModal },
        { id: 'land-post-btn', handler: showLandPostModal }
    ];
    
    buttons.forEach(btn => {
        const element = document.getElementById(btn.id);
        if (element) {
            const newElement = element.cloneNode(true);
            element.parentNode.replaceChild(newElement, element);
            newElement.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log(`${btn.id} clicked`);
                btn.handler();
            });
            console.log(`${btn.id} button attached`);
        } else {
            console.warn(`${btn.id} not found`);
        }
    });
    
    console.log('✅ Marketplace buttons attached');
}

// Setup all modal handlers
function setupAllModalHandlers() {
    setupMarketplaceModalHandlers();
    setupPropertyModalHandlers();
    // Add similar for other modals if needed (gas, water, hotel, land)
    console.log('✅ All modal handlers attached');
}

// ========== FILTER BUTTON HANDLERS ==========
function setupFilterButtons() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => {
            const category = newBtn.getAttribute('data-category');
            filterBtns.forEach(b => b.classList.remove('active'));
            newBtn.classList.add('active');
            loadMarketplaceItems(category);
        });
    });
}

// ========== SEARCH HANDLER ==========
function setupMarketplaceSearch() {
    const searchInput = document.querySelector('#marketplace-tab .search-input');
    if (searchInput) {
        let timeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(async () => {
                const searchTerm = e.target.value.toLowerCase();
                const snapshot = await firebase.firestore().collection('marketplace_items').where('status', '==', 'active').get();
                const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const filtered = items.filter(item => 
                    item.title?.toLowerCase().includes(searchTerm) || 
                    item.description?.toLowerCase().includes(searchTerm)
                );
                displaySearchResults(filtered);
            }, 300);
        });
    }
}

function displaySearchResults(items) {
    const container = document.getElementById('marketplace-items-container');
    if (!container) return;
    
    if (items.length === 0) {
        container.innerHTML = '<div class="empty-marketplace">No items found</div>';
        return;
    }
    
    container.innerHTML = '';
    items.forEach(item => {
        container.appendChild(createMarketplaceItemElement(item));
    });
}

// ========== EXPORT GLOBALLY ==========
window.loadMarketplaceItems = loadMarketplaceItems;
window.viewListingDetails = viewListingDetails;
window.contactSeller = contactSeller;
window.whatsappSeller = whatsappSeller;
window.updateMarketplaceForm = updateMarketplaceForm;
window.previewMarketplaceImages = previewMarketplaceImages;
window.submitMarketplaceItem = submitMarketplaceItem;
window.resetMarketplaceForm = resetMarketplaceForm;
window.showMarketplacePostModal = showMarketplacePostModal;

window.showGasRefillPostModal = showGasRefillPostModal;
window.submitGasRefillListing = submitGasRefillListing;

window.showWaterDeliveryPostModal = showWaterDeliveryPostModal;
window.submitWaterDeliveryListing = submitWaterDeliveryListing;

window.showHotelPostModal = showHotelPostModal;
window.submitHotelListing = submitHotelListing;
window.triggerImageUpload = triggerImageUpload;
window.handleImageSelection = handleImageSelection;

window.showPropertyPostModal = showPropertyPostModal;
window.submitProperty = submitProperty;
window.uploadPropertyImages = uploadPropertyImages;

window.showLandPostModal = showLandPostModal;
window.submitLandListing = submitLandListing;
window.triggerLandImageUpload = triggerLandImageUpload;
window.setupLandSizeListener = setupLandSizeListener;

window.getCurrentUserLocation = getCurrentUserLocation;
window.fillLocationFromProfile = fillLocationFromProfile;

window.setupFilterButtons = setupFilterButtons;
window.setupMarketplaceSearch = setupMarketplaceSearch;
window.setupMarketplaceButtons = setupMarketplaceButtons;
window.setupMarketplaceModalHandlers = setupMarketplaceModalHandlers;
window.setupPropertyModalHandlers = setupPropertyModalHandlers;
window.setupAllModalHandlers = setupAllModalHandlers;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        setupFilterButtons();
        setupMarketplaceSearch();
        setupMarketplaceButtons();
        setupAllModalHandlers();  // Add this line
        console.log('✅ Marketplace fully loaded');
    }, 100);
});

console.log('✅ Marketplace.js with all service functions (gas, hotel, water, property, land) loaded - Now saving to Firebase!');