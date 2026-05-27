// ========== HOUSING MANAGER - COMPLETE FIXED VERSION ==========
// Uses propertyListings collection (exists in firebase.js)

if (typeof window.showToast !== 'function') {
    window.showToast = console.log;
}
if (typeof window.showModalWithContent !== 'function') {
    window.showModalWithContent = function(id, content) {
        const modal = document.createElement('div');
        modal.id = id;
        modal.className = 'modal';
        modal.innerHTML = content;
        document.body.appendChild(modal);
        modal.style.display = 'block';
        
        const closeBtn = modal.querySelector('.close-modal-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.remove();
            });
        }
    };
}

class HousingManager {
    constructor() {
        this.db = db;
        this.auth = auth;
        this.storage = storage;
        this.currentListeners = {};
        
        // FIXED: Use propertyListings collection (exists in firebase.js)
        this.housingCollection = collections.propertyListings();
        this.usersCollection = collections.users();
        this.chatsCollection = collections.chats ? collections.chats() : collections.bookingChats();
    }

    // Get housing listings by type with filters (with pagination)
    async getHousingListings(type, filters = {}, limit = 20, startAfter = null) {
        try {
            let query = this.housingCollection
                .where('type', '==', type)
                .where('status', '==', 'active');

            // Apply filters
            if (filters.minPrice) {
                query = query.where('price', '>=', parseInt(filters.minPrice));
            }
            if (filters.maxPrice) {
                query = query.where('price', '<=', parseInt(filters.maxPrice));
            }
            if (filters.location) {
                query = query.where('location', '==', filters.location);
            }
            if (filters.bedrooms) {
                query = query.where('bedrooms', '==', parseInt(filters.bedrooms));
            }
            if (filters.bathrooms) {
                query = query.where('bathrooms', '==', parseInt(filters.bathrooms));
            }
            if (filters.furnished !== undefined) {
                query = query.where('furnished', '==', filters.furnished === 'true');
            }

            if (startAfter) {
                query = query.startAfter(startAfter);
            }

            const snapshot = await query
                .orderBy('createdAt', 'desc')
                .limit(limit)
                .get();

            const lastVisible = snapshot.docs[snapshot.docs.length - 1];
            
            return {
                listings: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
                lastVisible
            };
        } catch (error) {
            console.error('Error getting housing listings:', error);
            return { listings: [], lastVisible: null };
        }
    }

    // FIXED: Search with pagination (not loading all)
    async searchHousingListings(searchTerm, type = null, filters = {}, limit = 20, startAfter = null) {
        try {
            let query = this.housingCollection
                .where('status', '==', 'active');

            if (type) {
                query = query.where('type', '==', type);
            }

            // Apply filters
            if (filters.minPrice) query = query.where('price', '>=', parseInt(filters.minPrice));
            if (filters.maxPrice) query = query.where('price', '<=', parseInt(filters.maxPrice));
            if (filters.location) query = query.where('location', '==', filters.location);
            if (filters.bedrooms) query = query.where('bedrooms', '==', parseInt(filters.bedrooms));
            if (filters.bathrooms) query = query.where('bathrooms', '==', parseInt(filters.bathrooms));

            if (startAfter) {
                query = query.startAfter(startAfter);
            }

            const snapshot = await query
                .orderBy('createdAt', 'desc')
                .limit(limit * 2) // Fetch extra for client-side search
                .get();

            const listings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Client-side search on limited results
            const searchLower = searchTerm.toLowerCase();
            const filteredListings = listings.filter(listing => 
                listing.title.toLowerCase().includes(searchLower) ||
                (listing.description && listing.description.toLowerCase().includes(searchLower)) ||
                listing.location.toLowerCase().includes(searchLower)
            ).slice(0, limit);

            return filteredListings;
        } catch (error) {
            console.error('Error searching housing listings:', error);
            return [];
        }
    }

    // Create a new housing listing
    async createHousingListing(listingData, imageFiles = []) {
        try {
            const user = this.auth.currentUser;
            if (!user) throw new Error('User must be logged in to create a housing listing');

            // Upload images first
            const imageUrls = [];
            if (imageFiles.length > 0) {
                const uploadResult = await this.uploadHousingImages(imageFiles, 'temp');
                if (uploadResult.success) {
                    imageUrls.push(...uploadResult.urls);
                }
            }

            const listingWithMetadata = {
                ...listingData,
                userId: user.uid,
                userName: user.displayName || user.email,
                images: imageUrls,
                status: 'pending', // Admin approval required
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                viewCount: 0
            };

            const docRef = await this.housingCollection.add(listingWithMetadata);
            return { success: true, id: docRef.id, imageUrls: imageUrls };
        } catch (error) {
            console.error('Error creating housing listing:', error);
            return { success: false, error: error.message };
        }
    }

    // Upload housing images to Firebase Storage (not base64)
    async uploadHousingImages(files, listingId) {
        try {
            const imageUrls = [];
            
            for (const file of files) {
                // Generate unique filename
                const fileExtension = file.name.split('.').pop();
                const filename = `image-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExtension}`;
                
                const storageRef = this.storage.ref(`properties/${listingId}/${filename}`);
                const snapshot = await storageRef.put(file);
                const downloadURL = await snapshot.ref.getDownloadURL();
                imageUrls.push(downloadURL);
            }
            
            return { success: true, urls: imageUrls };
        } catch (error) {
            console.error('Error uploading housing images:', error);
            return { success: false, error: error.message };
        }
    }

    // Contact housing lister
    async contactLister(listingId, message) {
        try {
            const user = this.auth.currentUser;
            if (!user) throw new Error('User must be logged in to contact a lister');

            const listingDoc = await this.housingCollection.doc(listingId).get();
            if (!listingDoc.exists) throw new Error('Housing listing not found');

            const listing = listingDoc.data();
            const listerId = listing.userId;
            
            // Prevent self-contact
            if (user.uid === listerId) {
                return { success: false, error: 'You cannot contact yourself' };
            }

            const chatData = {
                participants: [user.uid, listerId],
                listingId: listingId,
                listingType: 'housing',
                listingTitle: listing.title,
                lastMessage: message,
                lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const existingChat = await this.chatsCollection
                .where('participants', 'array-contains', user.uid)
                .where('listingId', '==', listingId)
                .get();

            let chatRef;
            if (existingChat.empty) {
                chatRef = await this.chatsCollection.add(chatData);
            } else {
                chatRef = existingChat.docs[0].ref;
                await chatRef.update({
                    lastMessage: message,
                    lastMessageAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            await this.chatsCollection.doc(chatRef.id).collection('messages').add({
                senderId: user.uid,
                text: message,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            return { success: true, chatId: chatRef.id };
        } catch (error) {
            console.error('Error contacting lister:', error);
            return { success: false, error: error.message };
        }
    }

    // Get housing listing by ID
    async getHousingListing(listingId) {
        try {
            const doc = await this.housingCollection.doc(listingId).get();
            if (doc.exists) {
                await this.incrementViewCount(listingId);
                return { success: true, data: { id: doc.id, ...doc.data() } };
            } else {
                return { success: false, error: 'Listing not found' };
            }
        } catch (error) {
            console.error('Error getting housing listing:', error);
            return { success: false, error: error.message };
        }
    }

    // Increment view count
    async incrementViewCount(listingId) {
        try {
            await this.housingCollection.doc(listingId).update({
                viewCount: firebase.firestore.FieldValue.increment(1)
            });
        } catch (error) {
            console.error('Error incrementing view count:', error);
        }
    }

    // Get user's housing listings
    async getUserListings(userId) {
        try {
            const snapshot = await this.housingCollection
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .get();

            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting user listings:', error);
            return [];
        }
    }

    // FIXED: Get user's favorite housing listings (batched query)
    async getUserFavorites(userId) {
        try {
            const userDoc = await this.usersCollection.doc(userId).get();
            if (!userDoc.exists) return [];

            const favorites = userDoc.data().housingFavorites || [];
            if (favorites.length === 0) return [];

            // Batch query using 'in' (max 10 items per batch)
            const batchSize = 10;
            const batches = [];
            for (let i = 0; i < favorites.length; i += batchSize) {
                batches.push(favorites.slice(i, i + batchSize));
            }
            
            const allListings = [];
            for (const batch of batches) {
                const snapshot = await this.housingCollection
                    .where(firebase.firestore.FieldPath.documentId(), 'in', batch)
                    .where('status', '==', 'active')
                    .get();
                
                allListings.push(...snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }

            return allListings;
        } catch (error) {
            console.error('Error getting user favorites:', error);
            return [];
        }
    }

    // Add to favorites
    async addToFavorites(listingId) {
        try {
            const user = this.auth.currentUser;
            if (!user) throw new Error('User must be logged in to add favorites');

            await this.usersCollection.doc(user.uid).update({
                housingFavorites: firebase.firestore.FieldValue.arrayUnion(listingId)
            });

            return { success: true };
        } catch (error) {
            console.error('Error adding to favorites:', error);
            return { success: false, error: error.message };
        }
    }

    // Remove from favorites
    async removeFromFavorites(listingId) {
        try {
            const user = this.auth.currentUser;
            if (!user) throw new Error('User must be logged in to remove favorites');

            await this.usersCollection.doc(user.uid).update({
                housingFavorites: firebase.firestore.FieldValue.arrayRemove(listingId)
            });

            return { success: true };
        } catch (error) {
            console.error('Error removing from favorites:', error);
            return { success: false, error: error.message };
        }
    }

    // Delete a housing listing
    async deleteListing(listingId) {
        try {
            const user = this.auth.currentUser;
            if (!user) throw new Error('User must be logged in to delete a listing');

            const listingDoc = await this.housingCollection.doc(listingId).get();
            if (!listingDoc.exists || listingDoc.data().userId !== user.uid) {
                throw new Error('You can only delete your own listings');
            }

            await this.housingCollection.doc(listingId).delete();
            return { success: true };
        } catch (error) {
            console.error('Error deleting listing:', error);
            return { success: false, error: error.message };
        }
    }

    // Mark as rented/sold
    async markAsRented(listingId) {
        try {
            const user = this.auth.currentUser;
            if (!user) throw new Error('User must be logged in to mark as rented');

            const listingDoc = await this.housingCollection.doc(listingId).get();
            if (!listingDoc.exists || listingDoc.data().userId !== user.uid) {
                throw new Error('You can only update your own listings');
            }

            await this.housingCollection.doc(listingId).update({
                status: 'rented',
                rentedAt: firebase.firestore.FieldValue.serverTimestamp(),
                rentedBy: user.uid,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            return { success: true };
        } catch (error) {
            console.error('Error marking as rented:', error);
            return { success: false, error: error.message };
        }
    }

    // Get housing types
    getHousingTypes() {
        return [
            { id: 'rooms', name: 'Rooms', icon: 'fas fa-door-open' },
            { id: 'bedsitters', name: 'Bedsitters', icon: 'fas fa-bed' },
            { id: 'apartments', name: 'Apartments', icon: 'fas fa-building' },
            { id: 'houses', name: 'Houses', icon: 'fas fa-home' },
            { id: 'short-stays', name: 'Short Stays', icon: 'fas fa-hotel' },
            { id: 'land', name: 'Land/Plots', icon: 'fas fa-vector-square' }
        ];
    }

    // Get common locations
    getCommonLocations() {
        return [
            'Nairobi CBD', 'Westlands', 'Kilimani', 'Karen', 'Langata',
            'Eastleigh', 'Embakasi', 'Kasarani', 'Ruiru', 'Thika',
            'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret'
        ];
    }
}

// Initialize housing manager
function initializeHousingManager() {
    window.housingManager = new HousingManager();
    console.log("✅ Housing Manager initialized with propertyListings collection");
}

if (typeof db !== 'undefined' && db && typeof auth !== 'undefined' && auth) {
    initializeHousingManager();
} else {
    document.addEventListener('firebase-ready', initializeHousingManager);
}

// ========== UI FUNCTIONS ==========

// Load housing listings by type
async function loadHousingListings(type, filters = {}) {
    const housingContainer = document.getElementById('housing-container');
    if (!housingContainer) return;

    housingContainer.innerHTML = '<div class="loading-spinner"><div class="spinner"></div> Loading listings...</div>';
    
    const result = await housingManager.getHousingListings(type, filters, 20);
    
    if (result.listings.length === 0) {
        housingContainer.innerHTML = '<div class="no-listings" style="text-align: center; padding: 40px;">No housing listings available in this category</div>';
        return;
    }

    housingContainer.innerHTML = '';
    result.listings.forEach(listing => {
        const listingElement = createHousingListingElement(listing);
        housingContainer.appendChild(listingElement);
    });

    window.lastVisibleHousingListing = result.lastVisible;
}

// Create HTML element for a housing listing
function createHousingListingElement(listing) {
    const div = document.createElement('div');
    div.className = 'property-listing';
    div.setAttribute('data-id', listing.id);
    div.innerHTML = `
        <div class="property-image" style="cursor: pointer;">
            ${listing.images && listing.images.length > 0 ? 
                `<img src="${listing.images[0]}" alt="${escapeHtml(listing.title)}" loading="lazy">` : 
                `<div style="height: 180px; background: var(--light); display: flex; align-items: center; justify-content: center;"><i class="fas fa-home" style="font-size: 3rem; color: var(--grey-dark);"></i></div>`
            }
            ${listing.urgent ? '<div class="property-badge urgent">Urgent</div>' : ''}
            ${listing.status === 'rented' ? '<div class="property-badge rented">Rented</div>' : ''}
        </div>
        <div class="property-info">
            <div class="property-title">${escapeHtml(listing.title)}</div>
            <div class="property-location">
                <i class="fas fa-map-marker-alt"></i> ${escapeHtml(listing.location || 'Nairobi')}
            </div>
            <div class="property-price">KES ${listing.price?.toLocaleString() || '0'}</div>
            <div class="property-meta">
                <div class="property-meta-item">
                    <i class="fas fa-bed"></i> ${listing.bedrooms || 'N/A'} beds
                </div>
                <div class="property-meta-item">
                    <i class="fas fa-bath"></i> ${listing.bathrooms || 'N/A'} baths
                </div>
                ${listing.furnished ? '<div class="property-meta-item"><i class="fas fa-couch"></i> Furnished</div>' : ''}
            </div>
            <div class="property-actions">
                <button class="btn btn-sm btn-primary contact-lister-btn" data-id="${listing.id}">Contact</button>
                <button class="btn btn-sm btn-outline view-details-btn" data-id="${listing.id}">Details</button>
                <button class="btn btn-sm btn-outline favorite-btn" data-id="${listing.id}">
                    <i class="far fa-heart"></i>
                </button>
            </div>
        </div>
    `;
    
    // Attach event listeners
    const imageDiv = div.querySelector('.property-image');
    if (imageDiv) {
        imageDiv.addEventListener('click', () => viewHousingDetails(listing.id));
    }
    
    const contactBtn = div.querySelector('.contact-lister-btn');
    if (contactBtn) {
        contactBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            contactHousingLister(listing.id);
        });
    }
    
    const detailsBtn = div.querySelector('.view-details-btn');
    if (detailsBtn) {
        detailsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            viewHousingDetails(listing.id);
        });
    }
    
    const favBtn = div.querySelector('.favorite-btn');
    if (favBtn) {
        favBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleHousingFavorite(listing.id, favBtn);
        });
    }
    
    return div;
}

// Contact housing lister
async function contactHousingLister(listingId) {
    if (!auth.currentUser) {
        showToast('Please sign in to contact the owner', 'warning');
        if (typeof openAuthModal === 'function') openAuthModal();
        return;
    }
    
    // Use custom modal instead of prompt
    showContactMessageModal(listingId);
}

function showContactMessageModal(listingId) {
    const modalContent = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <div class="modal-title"><i class="fas fa-envelope"></i> Contact Owner</div>
                <button class="close-modal-btn">&times;</button>
            </div>
            <div style="padding: 20px;">
                <div class="form-group">
                    <label class="form-label">Your Message</label>
                    <textarea id="contact-message" class="form-input" rows="4" placeholder="Hi, I'm interested in your property. Is it still available?"></textarea>
                </div>
                <div class="form-actions" style="display: flex; gap: 10px; margin-top: 20px;">
                    <button class="btn btn-outline close-modal-btn">Cancel</button>
                    <button class="btn btn-primary" id="send-message-btn">Send Message</button>
                </div>
            </div>
        </div>
    `;
    
    if (typeof window.showModalWithContent === 'function') {
        window.showModalWithContent('contact-modal', modalContent);
    }
    
    setTimeout(() => {
        const sendBtn = document.getElementById('send-message-btn');
        if (sendBtn) {
            sendBtn.addEventListener('click', async () => {
                const message = document.getElementById('contact-message')?.value;
                if (!message) {
                    showToast('Please enter a message', 'error');
                    return;
                }
                
                const result = await housingManager.contactLister(listingId, message);
                if (result.success) {
                    showToast('Message sent to property owner!', 'success');
                    if (typeof window.closeModal === 'function') {
                        window.closeModal('contact-modal');
                    }
                } else {
                    showToast('Error: ' + result.error, 'error');
                }
            });
        }
    }, 100);
}

// View housing details
async function viewHousingDetails(listingId) {
    try {
        const result = await housingManager.getHousingListing(listingId);
        if (result.success) {
            showHousingModal(result.data);
        } else {
            showToast('Error: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error viewing housing details:', error);
        showToast('Error loading property details', 'error');
    }
}

// Show housing modal
function showHousingModal(listing) {
    const modalContent = `
        <div class="modal-content" style="max-width: 500px; max-height: 80vh; overflow-y: auto;">
            <div class="modal-header">
                <div class="modal-title">${escapeHtml(listing.title)}</div>
                <button class="close-modal-btn">&times;</button>
            </div>
            <div style="padding: 15px;">
                <div class="housing-images" style="display: flex; overflow-x: auto; gap: 10px; margin-bottom: 15px;">
                    ${listing.images && listing.images.length > 0 ? 
                        listing.images.map(img => `<img src="${img}" alt="${escapeHtml(listing.title)}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px; cursor: pointer;" onclick="window.open('${img}', '_blank')">`).join('') : 
                        '<div class="no-image" style="height: 150px; background: var(--light); display: flex; align-items: center; justify-content: center;"><i class="fas fa-home" style="font-size: 3rem;"></i></div>'
                    }
                </div>
                <div class="housing-price" style="font-size: 1.5rem; font-weight: 700; color: var(--primary); margin-bottom: 10px;">KES ${listing.price?.toLocaleString() || '0'}</div>
                <div class="housing-location" style="margin-bottom: 10px;"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(listing.location || 'Nairobi')}</div>
                <div class="housing-description" style="margin-bottom: 15px;"><strong>Description:</strong><br>${escapeHtml(listing.description || 'No description provided.')}</div>
                <div class="housing-features" style="display: flex; gap: 15px; margin-bottom: 15px;">
                    <div><i class="fas fa-bed"></i> ${listing.bedrooms || 'N/A'} Bedrooms</div>
                    <div><i class="fas fa-bath"></i> ${listing.bathrooms || 'N/A'} Bathrooms</div>
                    ${listing.furnished ? '<div><i class="fas fa-couch"></i> Furnished</div>' : ''}
                </div>
                <div class="form-actions" style="display: flex; gap: 10px;">
                    <button class="btn btn-primary contact-from-modal-btn" data-id="${listing.id}" style="flex: 1;">Contact Owner</button>
                    <button class="btn btn-outline favorite-modal-btn" data-id="${listing.id}" style="flex: 1;">Save Property</button>
                </div>
            </div>
        </div>
    `;
    
    if (typeof window.showModalWithContent === 'function') {
        window.showModalWithContent('housing-details-modal', modalContent);
    }
    
    setTimeout(() => {
        const contactBtn = document.querySelector('#housing-details-modal .contact-from-modal-btn');
        if (contactBtn) {
            contactBtn.addEventListener('click', () => {
                if (typeof window.closeModal === 'function') {
                    window.closeModal('housing-details-modal');
                }
                contactHousingLister(listing.id);
            });
        }
        
        const favBtn = document.querySelector('#housing-details-modal .favorite-modal-btn');
        if (favBtn) {
            favBtn.addEventListener('click', () => {
                toggleHousingFavorite(listing.id, favBtn);
            });
        }
    }, 100);
}

// Toggle housing favorite
async function toggleHousingFavorite(listingId, button = null) {
    try {
        const user = auth.currentUser;
        if (!user) {
            showToast('Please sign in to save properties', 'warning');
            if (typeof openAuthModal === 'function') openAuthModal();
            return;
        }

        const userDoc = await collections.users().doc(user.uid).get();
        const favorites = userDoc.exists ? userDoc.data().housingFavorites || [] : [];
        
        if (favorites.includes(listingId)) {
            await housingManager.removeFromFavorites(listingId);
            if (button) button.innerHTML = '<i class="far fa-heart"></i>';
            showToast('Removed from saved properties', 'success');
        } else {
            await housingManager.addToFavorites(listingId);
            if (button) button.innerHTML = '<i class="fas fa-heart" style="color: #e74c3c;"></i>';
            showToast('Added to saved properties', 'success');
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
        showToast('Error updating saved properties', 'error');
    }
}

// Show housing filter modal
function showHousingFilters(type) {
    const housingTypes = housingManager.getHousingTypes();
    const currentType = housingTypes.find(t => t.id === type);
    const locations = housingManager.getCommonLocations();
    
    const filterContent = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <div class="modal-title">Filter ${currentType?.name || 'Housing'} Listings</div>
                <button class="close-modal-btn">&times;</button>
            </div>
            <div style="padding: 20px;">
                <div class="form-group">
                    <label for="min-price">Minimum Price (KES)</label>
                    <input type="number" id="min-price" class="form-input" placeholder="0">
                </div>
                <div class="form-group">
                    <label for="max-price">Maximum Price (KES)</label>
                    <input type="number" id="max-price" class="form-input" placeholder="100000">
                </div>
                <div class="form-group">
                    <label for="location">Location</label>
                    <select id="location" class="form-input">
                        <option value="">Any Location</option>
                        ${locations.map(loc => `<option value="${loc}">${loc}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="bedrooms">Bedrooms</label>
                    <select id="bedrooms" class="form-input">
                        <option value="">Any</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4+</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="bathrooms">Bathrooms</label>
                    <select id="bathrooms" class="form-input">
                        <option value="">Any</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3+</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="furnished">Furnished</label>
                    <select id="furnished" class="form-input">
                        <option value="">Any</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                    </select>
                </div>
                <div class="form-actions" style="display: flex; gap: 10px; margin-top: 20px;">
                    <button class="btn btn-outline close-modal-btn">Cancel</button>
                    <button class="btn btn-primary" id="apply-filters-btn">Apply Filters</button>
                </div>
            </div>
        </div>
    `;
    
    if (typeof window.showModalWithContent === 'function') {
        window.showModalWithContent('filter-modal', filterContent);
    }
    
    setTimeout(() => {
        const applyBtn = document.getElementById('apply-filters-btn');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const minPrice = document.getElementById('min-price').value;
                const maxPrice = document.getElementById('max-price').value;
                const location = document.getElementById('location').value;
                const bedrooms = document.getElementById('bedrooms').value;
                const bathrooms = document.getElementById('bathrooms').value;
                const furnished = document.getElementById('furnished').value;
                
                const filters = {};
                if (minPrice) filters.minPrice = minPrice;
                if (maxPrice) filters.maxPrice = maxPrice;
                if (location) filters.location = location;
                if (bedrooms) filters.bedrooms = bedrooms;
                if (bathrooms) filters.bathrooms = bathrooms;
                if (furnished) filters.furnished = furnished;
                
                loadHousingListings(type, filters);
                if (typeof window.closeModal === 'function') {
                    window.closeModal('filter-modal');
                }
            });
        }
    }, 100);
}

// Load housing listings for specific type
function loadHousingListingsByType(type) {
    window.currentHousingType = type;
    loadHousingListings(type);
}

// Search housing
function searchHousing() {
    const searchInput = document.querySelector('#services-tab .search-input');
    const searchTerm = searchInput?.value.trim();
    
    if (!searchTerm || searchTerm.length === 0) {
        if (window.currentHousingType) {
            loadHousingListings(window.currentHousingType);
        }
        return;
    }
    
    const housingContainer = document.getElementById('housing-container');
    if (!housingContainer) return;
    
    housingContainer.innerHTML = '<div class="loading-spinner"><div class="spinner"></div> Searching properties...</div>';
    
    housingManager.searchHousingListings(searchTerm, window.currentHousingType).then(listings => {
        housingContainer.innerHTML = '';
        if (listings.length === 0) {
            housingContainer.innerHTML = '<div class="no-listings" style="text-align: center; padding: 40px;">No properties found for "' + escapeHtml(searchTerm) + '"</div>';
            return;
        }
        
        listings.forEach(listing => {
            const listingElement = createHousingListingElement(listing);
            housingContainer.appendChild(listingElement);
        });
    });
}

// Escape HTML helper
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== EXPOSE GLOBALLY ==========
window.housingManager = housingManager;
window.loadHousingListings = loadHousingListings;
window.contactHousingLister = contactHousingLister;
window.viewHousingDetails = viewHousingDetails;
window.showHousingFilters = showHousingFilters;
window.toggleHousingFavorite = toggleHousingFavorite;
window.loadHousingListingsByType = loadHousingListingsByType;
window.searchHousing = searchHousing;

console.log('✅ Housing.js fully loaded with all fixes');