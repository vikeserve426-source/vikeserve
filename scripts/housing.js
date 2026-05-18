// Housing services management - FIXED FIREBASE PATTERN

// Add this at the top of the file
if (typeof window.showToast !== 'function') {
    window.showToast = console.log;
}
if (typeof window.showModalWithContent !== 'function') {
    window.showModalWithContent = function(id, content) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = content;
        document.body.appendChild(modal);
        modal.style.display = 'block';
    };
}

class HousingManager {
    constructor() {
        // Use global Firebase instances
        this.db = db;
        this.auth = auth;
        this.storage = storage;
        this.currentListeners = {};
        
        // Use the consistent collections pattern
        this.housingCollection = collections.housing ? collections.housing() : collections.propertyListings();
        this.usersCollection = collections.users();
        this.chatsCollection = collections.chats ? collections.chats() : collections.bookingChats();
    }

    // Get housing listings by type with filters
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

    // Search housing listings
    async searchHousingListings(searchTerm, type = null, filters = {}, limit = 20) {
        try {
            let query = this.housingCollection
                .where('status', '==', 'active');

            if (type) {
                query = query.where('type', '==', type);
            }

            // Apply filters (same as getHousingListings)
            if (filters.minPrice) query = query.where('price', '>=', parseInt(filters.minPrice));
            if (filters.maxPrice) query = query.where('price', '<=', parseInt(filters.maxPrice));
            if (filters.location) query = query.where('location', '==', filters.location);
            if (filters.bedrooms) query = query.where('bedrooms', '==', parseInt(filters.bedrooms));
            if (filters.bathrooms) query = query.where('bathrooms', '==', parseInt(filters.bathrooms));
            if (filters.furnished !== undefined) {
                query = query.where('furnished', '==', filters.furnished === 'true');
            }

            const snapshot = await query
                .orderBy('createdAt', 'desc')
                .get();

            const listings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Client-side search
            const searchLower = searchTerm.toLowerCase();
            const filteredListings = listings.filter(listing => 
                listing.title.toLowerCase().includes(searchLower) ||
                listing.description.toLowerCase().includes(searchLower) ||
                listing.location.toLowerCase().includes(searchLower)
            ).slice(0, limit);

            return filteredListings;
        } catch (error) {
            console.error('Error searching housing listings:', error);
            return [];
        }
    }

    // Create a new housing listing
    async createHousingListing(listingData) {
        try {
            const user = this.auth.currentUser;
            if (!user) throw new Error('User must be logged in to create a housing listing');

            const listingWithMetadata = {
                ...listingData,
                userId: user.uid,
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                viewCount: 0
            };

            const docRef = await this.housingCollection.add(listingWithMetadata);
            return { success: true, id: docRef.id };
        } catch (error) {
            console.error('Error creating housing listing:', error);
            return { success: false, error: error.message };
        }
    }

    // Upload housing images
    async uploadHousingImages(files, listingId) {
        try {
            const imageUrls = [];
            
            for (const file of files) {
                // Generate unique filename
                const fileExtension = file.name.split('.').pop();
                const filename = `image-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExtension}`;
                
                const storageRef = this.storage.ref(`housing-images/${listingId}/${filename}`);
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

            // Get listing details
            const listingDoc = await this.housingCollection.doc(listingId).get();
            if (!listingDoc.exists) throw new Error('Housing listing not found');

            const listing = listingDoc.data();
            const listerId = listing.userId;

            // Create chat between interested party and lister
            const chatData = {
                participants: [user.uid, listerId],
                listingId: listingId,
                listingType: 'housing',
                listingTitle: listing.title,
                lastMessage: message,
                lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Check if chat already exists
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

            // Add message to chat
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

    // Set up real-time listener for housing listings
    setupHousingListener(type, filters = {}, callback) {
        const listenerKey = `${type}-${JSON.stringify(filters)}`;
        
        // Remove any existing listener for this type/filters
        if (this.currentListeners[listenerKey]) {
            this.currentListeners[listenerKey]();
        }

        let query = this.housingCollection
            .where('type', '==', type)
            .where('status', '==', 'active');

        // Apply filters
        if (filters.minPrice) query = query.where('price', '>=', parseInt(filters.minPrice));
        if (filters.maxPrice) query = query.where('price', '<=', parseInt(filters.maxPrice));
        if (filters.location) query = query.where('location', '==', filters.location);
        if (filters.bedrooms) query = query.where('bedrooms', '==', parseInt(filters.bedrooms));
        if (filters.bathrooms) query = query.where('bathrooms', '==', parseInt(filters.bathrooms));

        const unsubscribe = query
            .orderBy('createdAt', 'desc')
            .onSnapshot(snapshot => {
                const listings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                callback(listings);
            }, error => {
                console.error('Housing listener error:', error);
            });

        // Store the unsubscribe function
        this.currentListeners[listenerKey] = unsubscribe;
        return unsubscribe;
    }

    // Remove all active listeners
    removeAllListeners() {
        Object.values(this.currentListeners).forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.currentListeners = {};
    }

    // Get housing listing by ID
    async getHousingListing(listingId) {
        try {
            const doc = await this.housingCollection.doc(listingId).get();
            if (doc.exists) {
                // Increment view count
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

    // Update a housing listing
    async updateListing(listingId, updates) {
        try {
            const user = this.auth.currentUser;
            if (!user) throw new Error('User must be logged in to update a listing');

            // Verify user owns this listing
            const listingDoc = await this.housingCollection.doc(listingId).get();
            if (!listingDoc.exists || listingDoc.data().userId !== user.uid) {
                throw new Error('You can only update your own listings');
            }

            await this.housingCollection.doc(listingId).update({
                ...updates,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            return { success: true };
        } catch (error) {
            console.error('Error updating listing:', error);
            return { success: false, error: error.message };
        }
    }

    // Delete a housing listing
    async deleteListing(listingId) {
        try {
            const user = this.auth.currentUser;
            if (!user) throw new Error('User must be logged in to delete a listing');

            // Verify user owns this listing
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

            // Verify user owns this listing
            const listingDoc = await this.housingCollection.doc(listingId).get();
            if (!listingDoc.exists || listingDoc.data().userId !== user.uid) {
                throw new Error('You can only update your own listings');
            }

            await this.housingCollection.doc(listingId).update({
                status: 'rented',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            return { success: true };
        } catch (error) {
            console.error('Error marking as rented:', error);
            return { success: false, error: error.message };
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

    // Get user's favorite housing listings
    async getUserFavorites(userId) {
        try {
            const userDoc = await this.usersCollection.doc(userId).get();
            if (!userDoc.exists) return [];

            const favorites = userDoc.data().housingFavorites || [];
            if (favorites.length === 0) return [];

            // Get favorite listings
            const listings = [];
            for (const listingId of favorites) {
                const listingDoc = await this.housingCollection.doc(listingId).get();
                if (listingDoc.exists && listingDoc.data().status === 'active') {
                    listings.push({ id: listingDoc.id, ...listingDoc.data() });
                }
            }

            return listings;
        } catch (error) {
            console.error('Error getting user favorites:', error);
            return [];
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
            { id: 'plots', name: 'Plots', icon: 'fas fa-vector-square' }
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

// Initialize housing manager when Firebase is ready
function initializeHousingManager() {
    window.housingManager = new HousingManager();
    console.log("Housing Manager initialized with Firebase collections pattern");
}

// Make sure Firebase is initialized before creating housing manager
if (typeof db !== 'undefined' && db && typeof auth !== 'undefined' && auth) {
    initializeHousingManager();
} else {
    // Wait for Firebase to be ready
    document.addEventListener('firebase-ready', initializeHousingManager);
}

// Load housing listings by type
async function loadHousingListings(type, filters = {}) {
    const housingContainer = document.getElementById('housing-container');
    if (!housingContainer) return;

    housingContainer.innerHTML = '<div class="loading-spinner">Loading listings...</div>';
    
    const result = await housingManager.getHousingListings(type, filters, 20);
    
    if (result.listings.length === 0) {
        housingContainer.innerHTML = '<div class="no-listings">No housing listings available in this category</div>';
        return;
    }

    housingContainer.innerHTML = '';
    result.listings.forEach(listing => {
        const listingElement = createHousingListingElement(listing);
        housingContainer.appendChild(listingElement);
    });

    // Store for pagination
    window.lastVisibleHousingListing = result.lastVisible;
}

// Create HTML element for a housing listing
function createHousingListingElement(listing) {
    const div = document.createElement('div');
    div.className = 'property-listing';
    div.innerHTML = `
        <div class="property-image" onclick="viewHousingDetails('${listing.id}')">
            ${listing.images && listing.images.length > 0 ? 
                `<img src="${listing.images[0]}" alt="${escapeHtml(listing.title)}" loading="lazy">` : 
                `<i class="fas fa-home"></i>`
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
                <button class="btn btn-sm btn-primary" onclick="contactHousingLister('${listing.id}')">Contact</button>
                <button class="btn btn-sm btn-outline" onclick="viewHousingDetails('${listing.id}')">Details</button>
                <button class="btn btn-sm btn-outline" onclick="toggleHousingFavorite('${listing.id}', this)">
                    <i class="far fa-heart"></i>
                </button>
            </div>
        </div>
    `;
    return div;
}

// Contact housing lister
async function contactHousingLister(listingId) {
    try {
        const message = prompt('Enter your message to the property owner:');
        if (!message) return;

        const result = await housingManager.contactLister(listingId, message);
        if (result.success) {
            showToast('Message sent to property owner successfully!', 'success');
            // Open chat interface
            openChat(result.chatId);
        } else {
            showToast('Error: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error contacting property owner:', error);
        showToast('Error contacting property owner', 'error');
    }
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
    // Implement modal showing property details
    const modalContent = `
        <div class="housing-modal">
            <div class="housing-images">
                ${listing.images && listing.images.length > 0 ? 
                    listing.images.map(img => `<img src="${img}" alt="${escapeHtml(listing.title)}">`).join('') : 
                    '<div class="no-image"><i class="fas fa-home"></i></div>'
                }
            </div>
            <div class="housing-details">
                <h2>${escapeHtml(listing.title)}</h2>
                <div class="housing-price">KES ${listing.price?.toLocaleString() || '0'}</div>
                <div class="housing-location">
                    <i class="fas fa-map-marker-alt"></i> ${escapeHtml(listing.location || 'Nairobi')}
                </div>
                <div class="housing-description">${escapeHtml(listing.description || 'No description provided.')}</div>
                <div class="housing-features">
                    <div><i class="fas fa-bed"></i> ${listing.bedrooms || 'N/A'} Bedrooms</div>
                    <div><i class="fas fa-bath"></i> ${listing.bathrooms || 'N/A'} Bathrooms</div>
                    ${listing.furnished ? '<div><i class="fas fa-couch"></i> Furnished</div>' : ''}
                </div>
                <button class="btn btn-primary" onclick="contactHousingLister('${listing.id}')">Contact Owner</button>
                <button class="btn btn-outline" onclick="toggleHousingFavorite('${listing.id}')">
                    <i class="far fa-heart"></i> Save Property
                </button>
            </div>
        </div>
    `;
    
    showModal(listing.title, modalContent);
}

// Toggle housing favorite
async function toggleHousingFavorite(listingId, button = null) {
    try {
        const user = auth.currentUser;
        if (!user) {
            showToast('Please sign in to save properties', 'warning');
            return;
        }

        // Check if already favorited
        const userDoc = await collections.users().doc(user.uid).get();
        const favorites = userDoc.exists ? userDoc.data().housingFavorites || [] : [];
        
        if (favorites.includes(listingId)) {
            await housingManager.removeFromFavorites(listingId);
            if (button) button.innerHTML = '<i class="far fa-heart"></i>';
            showToast('Removed from saved properties', 'success');
        } else {
            await housingManager.addToFavorites(listingId);
            if (button) button.innerHTML = '<i class="fas fa-heart"></i>';
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
        <div class="filter-modal">
            <h3>Filter ${currentType?.name || 'Housing'} Listings</h3>
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
            <button class="btn btn-primary" onclick="applyHousingFilters('${type}')">Apply Filters</button>
        </div>
    `;
    
    showModal('Filter Housing', filterContent);
}

// Apply housing filters
function applyHousingFilters(type) {
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
    closeModal();
}

// Open chat function (placeholder)
function openChat(chatId) {
    // This would open a chat interface
    console.log('Opening chat:', chatId);
    showToast('Chat opened successfully!', 'success');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== NEW FUNCTIONS ADDED =====

// Submit property listing - SAVES TO MARKETPLACE COLLECTION
async function submitProperty() {
    console.log('submitProperty called - saving to marketplace_items');
    
    const type = document.getElementById('property-type')?.value;
    const title = document.getElementById('property-title')?.value.trim();
    const price = document.getElementById('property-price')?.value;
    const location = document.getElementById('property-location')?.value.trim();
    const bedrooms = document.getElementById('property-bedrooms')?.value;
    const bathrooms = document.getElementById('property-bathrooms')?.value;
    const description = document.getElementById('property-description')?.value.trim();
    
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
    if (!type || !title || !price || !location || !description) {
        if (typeof window.showToast === 'function') {
            window.showToast('Please fill in all required fields', 'error');
        }
        return;
    }
    
    if (typeof window.showToast === 'function') {
        window.showToast('Saving property to database...', 'info');
    }
    
    // Prepare data for marketplace_items collection
    const propertyData = {
        category: type,  // 'rooms', 'bedsitters', 'apartments', 'houses'
        title: title,
        price: parseInt(price),
        location: location,
        bedrooms: bedrooms ? parseInt(bedrooms) : 0,
        bathrooms: bathrooms ? parseInt(bathrooms) : 0,
        description: description,
        images: [],
        status: 'active',
        promoted: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        userId: user.uid,
        userName: user.displayName || user.email || 'User',
        userEmail: user.email
    };
    
    try {
        // Save to marketplace_items collection
        const docRef = await firebase.firestore().collection('marketplace_items').add(propertyData);
        console.log('✅ Property saved to marketplace_items with ID:', docRef.id);
        
        if (typeof window.showToast === 'function') {
            window.showToast('✅ Property listed successfully in Marketplace!', 'success');
        }
        
        // Close modal
        const modal = document.getElementById('property-post-modal');
        if (modal) modal.style.display = 'none';
        
        // Reset form
        if (typeof resetPropertyForm === 'function') {
            resetPropertyForm();
        } else {
            document.getElementById('property-type').value = '';
            document.getElementById('property-title').value = '';
            document.getElementById('property-price').value = '';
            document.getElementById('property-location').value = '';
            document.getElementById('property-bedrooms').value = '';
            document.getElementById('property-bathrooms').value = '';
            document.getElementById('property-description').value = '';
        }
        
        // Refresh marketplace items to show new property
        setTimeout(() => {
            if (typeof window.loadMarketplaceItems === 'function') {
                window.loadMarketplaceItems(type);
            }
            // Switch to marketplace tab
            if (typeof window.switchTab === 'function') {
                window.switchTab('marketplace-tab');
            }
        }, 500);
        
    } catch (error) {
        console.error('Error saving property:', error);
        if (typeof window.showToast === 'function') {
            window.showToast(`Error: ${error.message}`, 'error');
        }
    }
}

// Upload property images (placeholder)
function uploadPropertyImages() {
    showToast('Image upload functionality coming soon', 'info');
}

// Show create housing modal
function showCreateHousingModal() {
    showModal('property-post-modal');
}

// Load housing listings for specific type
function loadHousingListingsByType(type) {
    window.currentHousingType = type;
    loadHousingListings(type);
}

// Show housing category
function showHousingCategory(category) {
    const housingTypes = housingManager.getHousingTypes();
    const type = housingTypes.find(t => t.name.toLowerCase().includes(category.toLowerCase()));
    if (type) {
        loadHousingListingsByType(type.id);
    } else {
        showToast('Housing category not found', 'error');
    }
}

// Search housing
function searchHousing() {
    const searchInput = document.querySelector('#services-tab .search-input');
    const searchTerm = searchInput.value.trim();
    
    if (searchTerm.length === 0) {
        if (window.currentHousingType) {
            loadHousingListings(window.currentHousingType);
        }
        return;
    }
    
    const housingContainer = document.getElementById('housing-container');
    housingContainer.innerHTML = '<div class="loading-spinner">Searching properties...</div>';
    
    housingManager.searchHousingListings(searchTerm, window.currentHousingType).then(listings => {
        housingContainer.innerHTML = '';
        if (listings.length === 0) {
            housingContainer.innerHTML = '<div class="no-listings">No properties found for "' + searchTerm + '"</div>';
            return;
        }
        
        listings.forEach(listing => {
            const listingElement = createHousingListingElement(listing);
            housingContainer.appendChild(listingElement);
        });
    });
}

// Load user's housing listings
async function loadUserHousingListings() {
    try {
        const user = auth.currentUser;
        if (!user) {
            showToast('Please sign in to view your listings', 'warning');
            return;
        }
        
        const listings = await housingManager.getUserListings(user.uid);
        const container = document.getElementById('user-housing-listings-container');
        
        if (!container) return;
        
        if (listings.length === 0) {
            container.innerHTML = '<div class="no-listings">You have no housing listings</div>';
            return;
        }
        
        container.innerHTML = '';
        listings.forEach(listing => {
            const listingElement = createUserHousingListingElement(listing);
            container.appendChild(listingElement);
        });
    } catch (error) {
        console.error('Error loading user housing listings:', error);
        showToast('Error loading your listings', 'error');
    }
}

// Create user housing listing element
function createUserHousingListingElement(listing) {
    const div = document.createElement('div');
    div.className = 'user-housing-listing';
    div.innerHTML = `
        <div class="listing-preview">
            ${listing.images && listing.images.length > 0 ? 
                `<img src="${listing.images[0]}" alt="${escapeHtml(listing.title)}">` : 
                `<div class="no-image"><i class="fas fa-home"></i></div>`
            }
        </div>
        <div class="listing-info">
            <h4>${escapeHtml(listing.title)}</h4>
            <div class="listing-price">KES ${listing.price?.toLocaleString() || '0'}</div>
            <div class="listing-type">${listing.type}</div>
            <div class="listing-status">
                <span class="status-badge ${listing.status}">${listing.status}</span>
            </div>
            <div class="listing-views">
                <i class="fas fa-eye"></i> ${listing.viewCount || 0} views
            </div>
        </div>
        <div class="listing-actions">
            <button class="btn btn-sm btn-outline" onclick="editHousingListing('${listing.id}')">Edit</button>
            ${listing.status === 'active' ? 
                `<button class="btn btn-sm btn-primary" onclick="markHousingAsRented('${listing.id}')">Mark Rented</button>` : 
                ''
            }
            <button class="btn btn-sm btn-danger" onclick="deleteHousingListing('${listing.id}')">Delete</button>
        </div>
    `;
    return div;
}

// Edit housing listing
function editHousingListing(listingId) {
    showToast('Edit housing listing functionality coming soon', 'info');
}

// Mark housing as rented
async function markHousingAsRented(listingId) {
    try {
        const result = await housingManager.markAsRented(listingId);
        if (result.success) {
            showToast('Property marked as rented!', 'success');
            loadUserHousingListings();
        } else {
            showToast('Error: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error marking property as rented:', error);
        showToast('Error updating listing', 'error');
    }
}

// Delete housing listing
async function deleteHousingListing(listingId) {
    if (!confirm('Are you sure you want to delete this property listing?')) return;
    
    try {
        const result = await housingManager.deleteListing(listingId);
        if (result.success) {
            showToast('Property listing deleted successfully!', 'success');
            loadUserHousingListings();
        } else {
            showToast('Error: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Error deleting property listing:', error);
        showToast('Error deleting listing', 'error');
    }
}

// Make it available globally
window.loadHousingListings = loadHousingListings;
window.contactHousingLister = contactHousingLister;
window.viewHousingDetails = viewHousingDetails;
window.showHousingFilters = showHousingFilters;
window.applyHousingFilters = applyHousingFilters;
window.toggleHousingFavorite = toggleHousingFavorite;
window.openChat = openChat;
window.escapeHtml = escapeHtml;
window.showPropertyPostModal = showPropertyPostModal;
window.submitProperty = submitProperty;
window.uploadPropertyImages = uploadPropertyImages;
window.showCreateHousingModal = showCreateHousingModal;
window.loadHousingListingsByType = loadHousingListingsByType;
window.showHousingCategory = showHousingCategory;
window.searchHousing = searchHousing;
window.loadUserHousingListings = loadUserHousingListings;
window.editHousingListing = editHousingListing;
window.markHousingAsRented = markHousingAsRented;
window.deleteHousingListing = deleteHousingListing;

// Auto-load housing listings when services tab is opened
document.addEventListener('DOMContentLoaded', function() {
    // Set default housing type
    window.currentHousingType = 'rooms';
    
    // Load initial housing listings when services tab is active
    setTimeout(() => {
        if (document.getElementById('services-tab').classList.contains('active')) {
            loadHousingListings('rooms');
        }
    }, 500);
});