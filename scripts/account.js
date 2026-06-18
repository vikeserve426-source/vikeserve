class AccountManager {
    constructor() {
        this.db = db;
        this.storage = storage;
        this.usersCollection = collections.users();
        this.adsCollection = collections.ads();
        this.bookingsCollection = collections.bookings();
        this.reviewsCollection = collections.reviews();
        this.favoritesCollection = collections.favorites ? collections.favorites() : null;
        
        if (!this.favoritesCollection) {
            console.warn('Favorites collection not found. Favorites feature will be disabled.');
        }
    }

    async getUserProfile(userId) {
        try {
            const userDoc = await this.usersCollection.doc(userId).get();
            
            if (!userDoc.exists) {
                await this.createUserProfile(userId);
                return this.getDefaultProfile(userId);
            }
            
            return { id: userDoc.id, ...userDoc.data() };
        } catch (error) {
            return this.getDefaultProfile(userId);
        }
    }

    async createUserProfile(userId) {
    try {
        const user = auth.currentUser;
        await this.usersCollection.doc(userId).set({
            displayName: user?.displayName || 'User',
            email: user?.email || '',
            profilePicture: null,
            phoneNumber: null,
            location: null,
            bio: null,
            preferences: {},
            role: 'general-user',
            averageRating: 0,
            totalReviews: 0,
            status: 'active',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('User profile created with role: general-user');
    } catch (error) {
        console.error('Error creating user profile:', error);
    }
}

    getDefaultProfile(userId) {
        const user = auth.currentUser;
        return {
            id: userId,
            displayName: user?.displayName || 'User',
            email: user?.email || '',
            profilePicture: null,
            phoneNumber: null,
            location: null,
            bio: null,
            preferences: {},
            averageRating: 0,
            totalReviews: 0,
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    async updateUserProfile(userId, updates) {
        try {
            await this.usersCollection.doc(userId).update({
                ...updates,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    isValidPhoneNumber(phone) {
    if (!phone) return false;
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    
    const kenyanRegex = /^(?:\+254|0|254)([17]\d{8})$/;
    
    const internationalRegex = /^\+?[0-9]{8,15}$/;
    
    return kenyanRegex.test(cleaned) || internationalRegex.test(cleaned);
}

    async uploadProfilePicture(userId, file) {
        try {
            const fileExtension = file.name.split('.').pop();
            const filename = `profile_${userId}_${Date.now()}.${fileExtension}`;
            
            const storageRef = storage.ref(`profile-pictures/${userId}/${filename}`);
            const snapshot = await storageRef.put(file);
            const downloadURL = await snapshot.ref.getDownloadURL();
            
            await this.updateUserProfile(userId, { profilePicture: downloadURL });
            
            return { success: true, url: downloadURL };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getUserAds(userId) {
        try {
            const snapshot = await this.adsCollection
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .get();

            if (snapshot.empty) {
                return [];
            }

            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            return [];
        }
    }

    async getUserBookings(userId) {
        try {
            const customerBookings = await this.bookingsCollection
                .where('customerId', '==', userId)
                .orderBy('createdAt', 'desc')
                .get();

            const providerBookings = await this.bookingsCollection
                .where('providerId', '==', userId)
                .orderBy('createdAt', 'desc')
                .get();

            const bookings = [
                ...customerBookings.docs.map(doc => ({ 
                    id: doc.id, 
                    ...doc.data(), 
                    type: 'customer',
                    createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date()
                })),
                ...providerBookings.docs.map(doc => ({ 
                    id: doc.id, 
                    ...doc.data(), 
                    type: 'provider',
                    createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date()
                }))
            ];

            bookings.sort((a, b) => b.createdAt - a.createdAt);
            return bookings;
        } catch (error) {
            return [];
        }
    }

    async getUserReviews(userId) {
        try {
            const givenReviews = await this.reviewsCollection
                .where('reviewerId', '==', userId)
                .orderBy('createdAt', 'desc')
                .get();

            const receivedReviews = await this.reviewsCollection
                .where('revieweeId', '==', userId)
                .orderBy('createdAt', 'desc')
                .get();

            const reviews = [
                ...givenReviews.docs.map(doc => ({ 
                    id: doc.id, 
                    ...doc.data(), 
                    type: 'given',
                    createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date()
                })),
                ...receivedReviews.docs.map(doc => ({ 
                    id: doc.id, 
                    ...doc.data(), 
                    type: 'received',
                    createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date()
                }))
            ];

            reviews.sort((a, b) => b.createdAt - a.createdAt);
            return reviews;
        } catch (error) {
            return [];
        }
    }

    async getUserFavorites(userId) {
        try {
            const favoritesSnapshot = await this.favoritesCollection
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .get();

            if (favoritesSnapshot.empty) {
                return [];
            }

            const favoriteAds = await Promise.all(
                favoritesSnapshot.docs.map(async (doc) => {
                    const favorite = doc.data();
                    const adDoc = await this.adsCollection.doc(favorite.adId).get();
                    if (adDoc.exists) {
                        return {
                            id: doc.id,
                            favoriteId: doc.id,
                            ...adDoc.data(),
                            favoritedAt: favorite.createdAt?.toDate ? favorite.createdAt.toDate() : new Date()
                        };
                    }
                    return null;
                })
            );

            return favoriteAds.filter(ad => ad !== null);
        } catch (error) {
            return [];
        }
    }

    async deleteUserAccount(userId) {
        try {
            await this.usersCollection.doc(userId).update({
                status: 'deleted',
                deletedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async updateUserPreferences(userId, preferences) {
        try {
            await this.usersCollection.doc(userId).update({
                preferences: preferences,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getUserStatistics(userId) {
        try {
            const [
                adsCount,
                bookingsCount,
                receivedReviews,
                favoritesCount
            ] = await Promise.all([
                this.adsCollection.where('userId', '==', userId).get(),
                this.bookingsCollection.where('customerId', '==', userId).get(),
                this.reviewsCollection.where('revieweeId', '==', userId).get(),
                this.favoritesCollection.where('userId', '==', userId).get()
            ]);
            
            let totalRating = 0;
            let averageRating = 0;
            
            if (!receivedReviews.empty) {
                receivedReviews.forEach(doc => {
                    totalRating += doc.data().rating || 0;
                });
                averageRating = receivedReviews.size > 0 ? totalRating / receivedReviews.size : 0;
            }
            
            return {
                ads: adsCount.size,
                bookings: bookingsCount.size,
                reviews: receivedReviews.size,
                favorites: favoritesCount.size,
                rating: averageRating
            };
        } catch (error) {
            return { ads: 0, bookings: 0, reviews: 0, favorites: 0, rating: 0 };
        }
    }

    async addToFavorites(userId, adId) {
        try {
            const existingFavorite = await this.favoritesCollection
                .where('userId', '==', userId)
                .where('adId', '==', adId)
                .get();

            if (!existingFavorite.empty) {
                return { success: false, error: 'Ad already in favorites' };
            }

            await this.favoritesCollection.add({
                userId: userId,
                adId: adId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async removeFromFavorites(userId, adId) {
        try {
            const favoriteSnapshot = await this.favoritesCollection
                .where('userId', '==', userId)
                .where('adId', '==', adId)
                .get();

            if (!favoriteSnapshot.empty) {
                await favoriteSnapshot.docs[0].ref.delete();
                return { success: true };
            }

            return { success: false, error: 'Favorite not found' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async isAdFavorited(userId, adId) {
        try {
            const favoriteSnapshot = await this.favoritesCollection
                .where('userId', '==', userId)
                .where('adId', '==', adId)
                .get();

            return !favoriteSnapshot.empty;
        } catch (error) {
            return false;
        }
    }
}

let accountManager;

function initAccountManager() {
    accountManager = new AccountManager();
    window.accountManager = accountManager;
}

function generateStarRating(rating) {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    
    let stars = '';
    for (let i = 0; i < fullStars; i++) {
        stars += '<i class="fas fa-star"></i>';
    }
    if (halfStar) {
        stars += '<i class="fas fa-star-half-alt"></i>';
    }
    for (let i = 0; i < emptyStars; i++) {
        stars += '<i class="far fa-star"></i>';
    }
    return stars;
}

async function loadUserAccountData() {
    if (!auth.currentUser) return;
    
    try {
        const userProfile = await accountManager.getUserProfile(auth.currentUser.uid);
        if (userProfile) {
            updateProfileUI(userProfile);
        }
        
        const userStats = await accountManager.getUserStatistics(auth.currentUser.uid);
        updateProfileStatsUI(userStats);
        
        await loadUserAds();
        await loadUserBookings();
        await loadUserReviews();
        await loadUserFavorites();
    } catch (error) {
        showToast('Error loading account data', 'error');
    }
}

async function loadUserAds() {
    if (!auth.currentUser) return;
    
    try {
        const ads = await accountManager.getUserAds(auth.currentUser.uid);
        
        let adsContainer = document.getElementById('user-ads-container');
        if (!adsContainer) {
            adsContainer = document.createElement('div');
            adsContainer.id = 'user-ads-container';
            adsContainer.className = 'user-items-container';
            
            const accountTab = document.getElementById('account-tab');
            const modules = accountTab.querySelectorAll('.module-card');
            if (modules.length > 0) {
                modules[0].appendChild(adsContainer);
            }
        }
        
        if (ads.length === 0) {
            adsContainer.innerHTML = '<div class="no-items">You haven\'t posted any ads yet</div>';
            return;
        }
        
        adsContainer.innerHTML = '';
        ads.forEach(ad => {
            const adElement = createUserAdElement(ad);
            adsContainer.appendChild(adElement);
        });
    } catch (error) {
        // Silent fail
    }
}

function createUserAdElement(ad) {
    const div = document.createElement('div');
    div.className = 'user-item';
    div.innerHTML = `
        <div class="item-header">
            <div class="item-title">${ad.title || 'Untitled Ad'}</div>
            <div class="item-status ${ad.status || 'inactive'}">${ad.status || 'inactive'}</div>
        </div>
        <div class="item-details">
            <div class="item-price">${ad.price ? `KES ${ad.price}` : 'Price not set'}</div>
            <div class="item-category">${ad.category || 'Uncategorized'}</div>
            <div class="item-date">Posted on ${ad.createdAt?.toDate ? ad.createdAt.toDate().toLocaleDateString() : 'Unknown date'}</div>
        </div>
        <div class="item-actions">
            <button class="btn btn-sm btn-outline" onclick="editAd('${ad.id}')">Edit</button>
            <button class="btn btn-sm btn-outline" onclick="viewAd('${ad.id}')">View</button>
        </div>
    `;
    return div;
}

async function loadUserBookings() {
    if (!auth.currentUser) return;
    
    try {
        const bookings = await accountManager.getUserBookings(auth.currentUser.uid);
        
        let bookingsContainer = document.getElementById('user-bookings-container');
        if (!bookingsContainer) {
            bookingsContainer = document.createElement('div');
            bookingsContainer.id = 'user-bookings-container';
            bookingsContainer.className = 'user-items-container';
            
            const accountTab = document.getElementById('account-tab');
            const modules = accountTab.querySelectorAll('.module-card');
            if (modules.length > 1) {
                modules[1].appendChild(bookingsContainer);
            }
        }
        
        if (bookings.length === 0) {
            bookingsContainer.innerHTML = '<div class="no-items">You don\'t have any bookings yet</div>';
            return;
        }
        
        bookingsContainer.innerHTML = '';
        bookings.forEach(booking => {
            const bookingElement = createUserBookingElement(booking);
            bookingsContainer.appendChild(bookingElement);
        });
    } catch (error) {
    }
}

function createUserBookingElement(booking) {
    const div = document.createElement('div');
    div.className = 'user-item';
    div.innerHTML = `
        <div class="item-header">
            <div class="item-title">${booking.serviceName || 'Unknown Service'}</div>
            <div class="item-status ${booking.status || 'pending'}">${booking.status || 'pending'}</div>
        </div>
        <div class="item-details">
            <div class="item-date">${booking.date || 'No date specified'}</div>
            <div class="item-time">${booking.time || 'No time specified'}</div>
            <div class="item-price">${booking.price ? `KES ${booking.price}` : 'Price not set'}</div>
        </div>
        <div class="item-actions">
            <button class="btn btn-sm btn-outline" onclick="viewBooking('${booking.id}')">Details</button>
        </div>
    `;
    return div;
}

async function loadUserReviews() {
    if (!auth.currentUser) return;
    
    try {
        const reviews = await accountManager.getUserReviews(auth.currentUser.uid);
        
        let reviewsContainer = document.getElementById('user-reviews-container');
        if (!reviewsContainer) {
            reviewsContainer = document.createElement('div');
            reviewsContainer.id = 'user-reviews-container';
            reviewsContainer.className = 'user-items-container';
            
            const accountTab = document.getElementById('account-tab');
            const modules = accountTab.querySelectorAll('.module-card');
            if (modules.length > 2) {
                modules[2].appendChild(reviewsContainer);
            }
        }
        
        if (reviews.length === 0) {
            reviewsContainer.innerHTML = '<div class="no-items">You don\'t have any reviews yet</div>';
            return;
        }
        
        reviewsContainer.innerHTML = '';
        reviews.forEach(review => {
            const reviewElement = createUserReviewElement(review);
            reviewsContainer.appendChild(reviewElement);
        });
    } catch (error) {
    }
}

function createUserReviewElement(review) {
    const div = document.createElement('div');
    div.className = 'user-item';
    div.innerHTML = `
        <div class="item-header">
            <div class="item-title">${review.type === 'given' ? 'Review you gave' : 'Review you received'}</div>
            <div class="item-rating">${generateStarRating(review.rating || 0)}</div>
        </div>
        <div class="item-details">
            <p>${review.comment || 'No comment provided'}</p>
        </div>
        <div class="item-meta">
            <div class="item-date">${review.createdAt?.toLocaleDateString ? review.createdAt.toLocaleDateString() : 'Unknown date'}</div>
            <div class="item-service">${review.serviceName || 'Unknown service'}</div>
        </div>
    `;
    return div;
}

async function loadUserFavorites() {
    if (!auth.currentUser) return;
    
    try {
        const favorites = await accountManager.getUserFavorites(auth.currentUser.uid);
        
        let favoritesContainer = document.getElementById('user-favorites-container');
        if (!favoritesContainer) {
            favoritesContainer = document.createElement('div');
            favoritesContainer.id = 'user-favorites-container';
            favoritesContainer.className = 'user-items-container';
            
            const accountTab = document.getElementById('account-tab');
            const modules = accountTab.querySelectorAll('.module-card');
            if (modules.length > 3) {
                modules[3].appendChild(favoritesContainer);
            }
        }
        
        if (favorites.length === 0) {
            favoritesContainer.innerHTML = '<div class="no-items">You haven\'t favorited any ads yet</div>';
            return;
        }
        
        favoritesContainer.innerHTML = '';
        favorites.forEach(favorite => {
            const favoriteElement = createUserFavoriteElement(favorite);
            favoritesContainer.appendChild(favoriteElement);
        });
    } catch (error) {
    }
}

function createUserFavoriteElement(favorite) {
    const div = document.createElement('div');
    div.className = 'user-item';
    div.innerHTML = `
        <div class="item-header">
            <div class="item-title">${favorite.title || 'Untitled Ad'}</div>
            <div class="item-favorite active"><i class="fas fa-heart"></i></div>
        </div>
        <div class="item-details">
            <div class="item-price">${favorite.price ? `KES ${favorite.price}` : 'Price not set'}</div>
            <div class="item-category">${favorite.category || 'Uncategorized'}</div>
            <div class="item-date">Favorited on ${favorite.favoritedAt?.toLocaleDateString ? favorite.favoritedAt.toLocaleDateString() : 'Unknown date'}</div>
        </div>
        <div class="item-actions">
            <button class="btn btn-sm btn-outline" onclick="viewAd('${favorite.id}')">View</button>
            <button class="btn btn-sm btn-outline" onclick="removeFavorite('${favorite.id}')">Remove</button>
        </div>
    `;
    return div;
}

function updateProfileUI(userProfile) {
    const profileName = document.getElementById('profile-name');
    const profileAvatar = document.getElementById('profile-avatar');
    const profileEmail = document.getElementById('profile-email');
    const profileLocation = document.getElementById('profile-location');
    const profileBio = document.getElementById('profile-bio');
    
    if (profileName) profileName.textContent = userProfile.displayName || 'User';
    if (profileEmail) profileEmail.textContent = userProfile.email || '';
    if (profileLocation) profileLocation.textContent = userProfile.location || 'No location set';
    if (profileBio) profileBio.textContent = userProfile.bio || 'No bio yet';
    
    if (profileAvatar) {
        if (userProfile.profilePicture) {
            profileAvatar.innerHTML = `<img src="${userProfile.profilePicture}" alt="Profile" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        } else {
            const initial = (userProfile.displayName || 'U').charAt(0).toUpperCase();
            profileAvatar.textContent = initial;
            profileAvatar.style.backgroundColor = getColorFromInitial(initial);
        }
    }
}

function getColorFromInitial(initial) {
    const colors = [
        '#2E86DE', '#341f97', '#27ae60', '#f39c12', 
        '#e74c3c', '#9b59b6', '#16a085', '#d35400'
    ];
    const index = initial.charCodeAt(0) % colors.length;
    return colors[index];
}

function updateProfileStatsUI(userStats) {
    const statsGrid = document.querySelector('.profile-stats');
    if (!statsGrid) return;
    
    statsGrid.innerHTML = `
        <div class="profile-stat">
            <div class="profile-stat-value">${userStats.ads}</div>
            <div class="profile-stat-label">Active Ads</div>
        </div>
        
        <div class="profile-stat">
            <div class="profile-stat-value">${userStats.bookings}</div>
            <div class="profile-stat-label">Bookings</div>
        </div>
        
        <div class="profile-stat">
            <div class="profile-stat-value">${userStats.reviews}</div>
            <div class="profile-stat-label">Reviews</div>
        </div>
        
        <div class="profile-stat">
            <div class="profile-stat-value">${userStats.favorites}</div>
            <div class="profile-stat-label">Favorites</div>
        </div>
    `;
    
    const ratingElement = document.getElementById('profile-rating');
    if (ratingElement) {
        ratingElement.innerHTML = generateStarRating(userStats.rating);
        ratingElement.innerHTML += ` <span>${userStats.rating.toFixed(1)}</span>`;
    }
}

function showEditProfileForm() {
    if (!auth.currentUser) {
        if (typeof showToast === 'function') {
            showToast('Please sign in to edit profile', 'warning');
        }
        return;
    }
    
    accountManager.getUserProfile(auth.currentUser.uid).then(userProfile => {
        const formContent = `
            <div class="edit-profile-form" style="padding: 10px;">
                <div class="form-group">
                    <label for="profile-displayname">Display Name</label>
                    <input type="text" id="profile-displayname" class="form-input" value="${escapeHtml(userProfile.displayName || '')}" placeholder="Your display name">
                </div>
                <div class="form-group">
                    <label for="profile-location">Location</label>
                    <input type="text" id="profile-location" class="form-input" value="${escapeHtml(userProfile.location || '')}" placeholder="Your location">
                </div>
                <div class="form-group">
                    <label for="profile-bio">Bio</label>
                    <textarea id="profile-bio" class="form-input" placeholder="Tell us about yourself" rows="3">${escapeHtml(userProfile.bio || '')}</textarea>
                </div>
                <div class="form-group">
                    <label for="profile-picture">Profile Picture</label>
                    <input type="file" id="profile-picture" class="form-input" accept="image/jpeg,image/png,image/gif">
                    <div class="form-hint">Max 2MB. JPG, PNG, or GIF only.</div>
                </div>
                <div class="form-actions" style="display: flex; gap: 10px; margin-top: 20px;">
                    <button class="btn btn-outline" id="cancel-profile-edit">Cancel</button>
                    <button class="btn btn-primary" id="save-profile-edit">Save Changes</button>
                </div>
            </div>
        `;
        
        if (typeof showModalWithContent === 'function') {
            showModalWithContent('edit-profile-modal', formContent);
        } else if (typeof showModal === 'function') {
            showModal('edit-profile-modal');
            const modal = document.getElementById('edit-profile-modal');
            if (modal) {
                const contentDiv = modal.querySelector('.modal-content');
                if (contentDiv) contentDiv.innerHTML = formContent;
            }
        } else {
            console.error('No modal function available');
            showToast('Form not available', 'error');
        }
        
        setTimeout(() => {
            const saveBtn = document.getElementById('save-profile-edit');
            if (saveBtn) {
                const newSaveBtn = saveBtn.cloneNode(true);
                saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
                newSaveBtn.addEventListener('click', () => {
                    if (typeof updateProfile === 'function') {
                        updateProfile();
                    }
                });
            }
            
            const cancelBtn = document.getElementById('cancel-profile-edit');
            if (cancelBtn) {
                const newCancelBtn = cancelBtn.cloneNode(true);
                cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
                newCancelBtn.addEventListener('click', () => {
                    if (typeof closeModal === 'function') {
                        closeModal('edit-profile-modal');
                    }
                });
            }
        }, 100);
        
    }).catch(error => {
        console.error('Error loading profile:', error);
        if (typeof showToast === 'function') {
            showToast('Error loading profile data', 'error');
        }
    });
}

async function updateProfile() {
    if (!auth.currentUser) return;
    
    if (typeof showToast !== 'function') {
        console.error('showToast function not available');
        alert('Please refresh the page and try again');
        return;
    }
    
    try {
        const displayName = document.getElementById('profile-displayname')?.value;
        const location = document.getElementById('profile-location')?.value;
        const bio = document.getElementById('profile-bio')?.value;
        const profilePicture = document.getElementById('profile-picture')?.files[0];
        
        const updates = {};
        if (displayName) updates.displayName = displayName;
        if (location) updates.location = location;
        if (bio) updates.bio = bio;
        
        if (Object.keys(updates).length === 0 && !profilePicture) {
            showToast('No changes to update', 'info');
            return;
        }
        
        const result = await accountManager.updateUserProfile(auth.currentUser.uid, updates);
        
        if (result.success) {
            if (profilePicture) {
                await accountManager.uploadProfilePicture(auth.currentUser.uid, profilePicture);
            }
            
            showToast('Profile updated successfully', 'success');
            if (typeof closeModal === 'function') {
                closeModal();
            }
            if (typeof loadUserAccountData === 'function') {
                loadUserAccountData();
            }
        } else {
            showToast('Error updating profile: ' + result.error, 'error');
        }
    } catch (error) {
        console.error('Update profile error:', error);
        showToast('Error updating profile: ' + error.message, 'error');
    }
}

async function removeFavorite(adId) {
    if (!auth.currentUser) return;
    
    try {
        const result = await accountManager.removeFromFavorites(auth.currentUser.uid, adId);
        if (result.success) {
            showToast('Removed from favorites', 'success');
            loadUserFavorites();
        } else {
            showToast(result.error, 'error');
        }
    } catch (error) {
        showToast('Error removing from favorites', 'error');
    }
}

async function toggleFavorite(adId) {
    if (!auth.currentUser) {
        showToast('Please sign in to add favorites', 'warning');
        return;
    }
    
    try {
        const isFavorited = await accountManager.isAdFavorited(auth.currentUser.uid, adId);
        
        if (isFavorited) {
            await accountManager.removeFromFavorites(auth.currentUser.uid, adId);
            showToast('Removed from favorites', 'success');
        } else {
            await accountManager.addToFavorites(auth.currentUser.uid, adId);
            showToast('Added to favorites', 'success');
        }
    } catch (error) {
        showToast('Error updating favorites', 'error');
    }
}

function editAd(adId) {
    showToast('Edit ad functionality coming soon', 'info');
}

function viewAd(adId) {
    showToast('View ad functionality coming soon', 'info');
}

function viewBooking(bookingId) {
    showToast('View booking functionality coming soon', 'info');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
window.escapeHtml = escapeHtml;
window.accountManager = accountManager;
window.initAccountManager = initAccountManager;
window.loadUserAccountData = loadUserAccountData;
window.showEditProfileForm = showEditProfileForm;
window.updateProfile = updateProfile;
window.toggleFavorite = toggleFavorite;
window.removeFavorite = removeFavorite;
window.editAd = editAd;
window.viewAd = viewAd;
window.viewBooking = viewBooking;
window.generateStarRating = generateStarRating;

if (typeof window.accountManager === 'undefined' || !window.accountManager) {
    auth.onAuthStateChanged(user => {
        if (user) {
            if (typeof initAccountManager === 'function') {
                initAccountManager();
            }
            if (typeof loadUserAccountData === 'function') {
                setTimeout(() => loadUserAccountData(), 500);
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    const editProfileBtn = document.querySelector('[onclick="showEditProfileForm()"]');
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', showEditProfileForm);
    }
});