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
        'home-appliances': 'fas fa-blender', 'default': 'fas fa-box'
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

function generateStarRating(rating) {
    if (!rating || rating === 0) return '';
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= fullStars) {
            stars += '<i class="fas fa-star" style="font-size: 0.65rem;"></i>';
        } else if (i === fullStars + 1 && hasHalfStar) {
            stars += '<i class="fas fa-star-half-alt" style="font-size: 0.65rem;"></i>';
        } else {
            stars += '<i class="far fa-star" style="font-size: 0.65rem;"></i>';
        }
    }
    return stars;
}

async function uploadMarketplaceImages(files, itemId) {
    const imageUrls = [];
    
    if (typeof firebase === 'undefined' || !firebase.storage) {
        console.warn('Firebase Storage not available');
        if (typeof window.showToast === 'function') {
            window.showToast('Storage service unavailable. Images not uploaded.', 'warning');
        }
        return imageUrls;
    }
    
    for (const file of files) {
        try {
            const fileExtension = file.name.split('.').pop();
            const filename = `marketplace/${itemId}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExtension}`;
            const storageRef = firebase.storage().ref(filename);
            const snapshot = await storageRef.put(file);
            const downloadURL = await snapshot.ref.getDownloadURL();
            imageUrls.push(downloadURL);
        } catch (error) {
            console.error('Error uploading image:', error);
            if (typeof window.showToast === 'function') {
                window.showToast('Error uploading image: ' + error.message, 'error');
            }
        }
    }
    
    return imageUrls;
}

async function isAdPromoted(adId) {
    try {
        const doc = await firebase.firestore().collection('marketplace_items').doc(adId).get();
        if (!doc.exists) return false;
        
        const data = doc.data();
        if (data.promoted === true && data.promotionExpiresAt) {
            const expiresAt = data.promotionExpiresAt.toDate ? data.promotionExpiresAt.toDate() : new Date(data.promotionExpiresAt);
            return expiresAt > new Date();
        }
        return false;
    } catch (error) {
        console.error('Error checking promotion:', error);
        return false;
    }
}

function createMarketplaceItemElement(item) {
    const div = document.createElement('div');
    div.className = 'market-item';
    div.setAttribute('data-ad-id', item.id);
    div.setAttribute('data-category', item.category);
    div.setAttribute('data-seller-id', item.userId);
    // Add inline styles to force mobile width
    div.style.width = '100%';
    div.style.maxWidth = '100%';
    div.style.boxSizing = 'border-box';
    div.style.overflow = 'hidden';
    
    let isPromoted = item.promoted === true;
    let daysLeft = 0;
    
    if (isPromoted && item.promotionExpiresAt) {
        const expiresAt = item.promotionExpiresAt.toDate ? item.promotionExpiresAt.toDate() : new Date(item.promotionExpiresAt);
        daysLeft = Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 0) isPromoted = false;
    }
    
    if (isPromoted) div.classList.add('promoted-ad');
    
    div.onclick = (e) => {
        if (e.target.closest('.market-item-actions')) return;
        viewListingDetails(item.id);
    };
    
    const icon = getCategoryIcon(item.category);
    const priceText = formatPrice(item);
    const daysLeftHtml = isPromoted && daysLeft > 0 ? `<div class="promoted-badge" style="margin-top: 4px;"><i class="fas fa-crown"></i> PROMOTED (${daysLeft}d left)</div>` : '';
    
    const sellerRating = item.sellerRating || item.rating || 0;
    const sellerRatingCount = item.sellerRatingCount || item.ratingCount || 0;
    const ratingStars = generateStarRating(sellerRating);
    
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
            <!-- SELLER PROFILE SECTION WITH RATINGS -->
            <div class="market-item-seller" style="display: flex; align-items: center; gap: 8px; margin: 8px 0; padding: 6px 0; border-top: 1px solid var(--grey); border-bottom: 1px solid var(--grey); cursor: pointer;" data-seller-id="${item.userId}">
                <div class="seller-avatar" style="width: 28px; height: 28px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.7rem; font-weight: bold;">
                    ${(item.userName || 'U').charAt(0).toUpperCase()}
                </div>
                <div class="seller-info" style="flex: 1;">
                    <div class="seller-name" style="font-size: 0.75rem; font-weight: 500;">${escapeHtml(item.userName || 'Unknown Seller')}</div>
                    <div class="seller-rating" style="font-size: 0.65rem; color: var(--warning);">
                        ${ratingStars} ${sellerRating > 0 ? `<span style="color: var(--grey-dark);">(${sellerRatingCount} reviews)</span>` : '<span style="color: var(--grey-dark);">No ratings yet</span>'}
                    </div>
                </div>
            </div>
            <div class="market-item-actions" style="display: flex; gap: 8px;">
                <button class="btn btn-sm btn-primary contact-seller-btn" data-item-id="${item.id}" style="flex: 1;">
                    <i class="fas fa-comment"></i> Contact
                </button>
                <button class="btn btn-sm btn-outline view-seller-profile-btn" data-seller-id="${item.userId}" data-seller-name="${escapeHtml(item.userName || 'Seller')}" style="flex: 1;">
                    <i class="fas fa-user"></i> Profile
                </button>
            </div>
        </div>
    `;
    
    const contactBtn = div.querySelector('.contact-seller-btn');
if (contactBtn) {
    contactBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.userId) {
            startChatWithSeller(item.userId, item.userName);
        } else {
            window.showToast('Seller contact info coming soon', 'info');
        }
    });
}
    
    const profileBtn = div.querySelector('.view-seller-profile-btn');
    if (profileBtn) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            viewSellerProfile(profileBtn.getAttribute('data-seller-id'));
        });
    }
    
    const sellerInfoDiv = div.querySelector('.market-item-seller');
    if (sellerInfoDiv) {
        sellerInfoDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            viewSellerProfile(sellerInfoDiv.getAttribute('data-seller-id'));
        });
    }
    
    return div;
}

let lastVisibleItem = null;
let isLoadingMore = false;
let currentCategory = 'all';

async function loadMarketplaceItems(category = 'all', loadMore = false) {
    const container = document.getElementById('marketplace-items-container');
    if (!container) return;
    
    if (!loadMore) {
        container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div> Loading items...</div>';
        lastVisibleItem = null;
        currentCategory = category;
    } else if (isLoadingMore) return;
    
    isLoadingMore = true;
    
    try {
        let query = firebase.firestore().collection('marketplace_items')
            .where('status', '==', 'active')
            .orderBy('createdAt', 'desc')
            .limit(20);
        
        if (category && category !== 'all') {
            query = query.where('category', '==', category);
        }
        
        if (loadMore && lastVisibleItem) {
            query = query.startAfter(lastVisibleItem);
        }
        
        const snapshot = await query.get();
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const itemsWithRatings = await Promise.all(items.map(async (item) => {
            if (item.userId) {
                try {
                    const userDoc = await firebase.firestore().collection('users').doc(item.userId).get();
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        item.sellerRating = userData.averageRating || userData.rating || 0;
                        item.sellerRatingCount = userData.totalReviews || userData.ratingCount || 0;
                        item.userName = userData.displayName || userData.userName || item.userName;
                    }
                } catch (err) {
                    console.error('Error fetching seller rating:', err);
                }
            }
            return item;
        }));
        
        if (snapshot.docs.length > 0) {
            lastVisibleItem = snapshot.docs[snapshot.docs.length - 1];
        }
        
        if (itemsWithRatings.length === 0 && !loadMore) {
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
            isLoadingMore = false;
            return;
        }
        
        if (!loadMore) {
            container.innerHTML = '';
        }
        
        itemsWithRatings.forEach(item => {
            container.appendChild(createMarketplaceItemElement(item));
        });
        
        if (snapshot.docs.length === 20) {
            let loadMoreBtn = document.getElementById('load-more-marketplace-btn');
            if (!loadMoreBtn) {
                loadMoreBtn = document.createElement('button');
                loadMoreBtn.id = 'load-more-marketplace-btn';
                loadMoreBtn.className = 'btn btn-outline';
                loadMoreBtn.style.margin = '20px auto';
                loadMoreBtn.style.display = 'block';
                loadMoreBtn.style.width = 'auto';
                loadMoreBtn.innerHTML = '<i class="fas fa-arrow-down"></i> Load More';
                loadMoreBtn.addEventListener('click', () => loadMarketplaceItems(currentCategory, true));
                container.appendChild(loadMoreBtn);
            }
        } else {
            const loadMoreBtn = document.getElementById('load-more-marketplace-btn');
            if (loadMoreBtn) loadMoreBtn.remove();
        }
        
    } catch (error) {
        console.error('Error loading marketplace items:', error);
        if (!loadMore) {
            container.innerHTML = '<div class="error-message">Failed to load items. Please refresh.</div>';
        }
    } finally {
        isLoadingMore = false;
    }
}

async function viewListingDetails(itemId) {
    try {
        const doc = await firebase.firestore().collection('marketplace_items').doc(itemId).get();
        if (!doc.exists) {
            if (typeof window.showToast === 'function') window.showToast('Item not found', 'error');
            return;
        }
        
        const item = { id: doc.id, ...doc.data() };
        
        let sellerRating = 0;
        let sellerRatingCount = 0;
        let sellerName = item.userName || 'Unknown Seller';
        
        if (item.userId) {
            try {
                const userDoc = await firebase.firestore().collection('users').doc(item.userId).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    sellerRating = userData.averageRating || userData.rating || 0;
                    sellerRatingCount = userData.totalReviews || userData.ratingCount || 0;
                    sellerName = userData.displayName || userData.userName || sellerName;
                }
            } catch (err) {
                console.error('Error fetching seller details:', err);
            }
        }
        
        let isPromoted = item.promoted === true;
        let daysLeft = 0;
        
        if (isPromoted && item.promotionExpiresAt) {
            const expiresAt = item.promotionExpiresAt.toDate ? item.promotionExpiresAt.toDate() : new Date(item.promotionExpiresAt);
            daysLeft = Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24));
            if (daysLeft <= 0) isPromoted = false;
        }
        
        const ratingStars = generateStarRating(sellerRating);
        
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
                    ${item.images && item.images.length > 0 ? `
                        <div style="display: flex; overflow-x: auto; gap: 10px; margin-bottom: 15px;">
                            ${item.images.map(img => `<img src="${img}" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px; cursor: pointer;" onclick="window.open('${img}', '_blank')">`).join('')}
                        </div>
                    ` : ''}
                    
                    <div style="background: var(--light); padding: 12px; border-radius: 10px; margin-bottom: 15px; display: flex; align-items: center; gap: 12px;">
                        <div class="seller-avatar" style="width: 45px; height: 45px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.2rem; font-weight: bold;">
                            ${sellerName.charAt(0).toUpperCase()}
                        </div>
                        <div class="seller-info" style="flex: 1;">
                            <div class="seller-name" style="font-weight: 600;">${escapeHtml(sellerName)}</div>
                            <div class="seller-rating" style="font-size: 0.8rem; color: var(--warning);">
                                ${ratingStars} ${sellerRating > 0 ? `<span style="color: var(--grey-dark);">(${sellerRatingCount} reviews)</span>` : '<span style="color: var(--grey-dark);">No ratings yet</span>'}
                            </div>
                        </div>
                        <button class="btn btn-sm btn-outline view-seller-profile-btn" data-seller-id="${item.userId}" style="padding: 6px 12px;">View Profile</button>
                    </div>
                    
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
                    ${item.userId === firebase.auth().currentUser?.uid ? `
                        <div class="form-actions" style="display: flex; gap: 10px; margin-top: 10px;">
                            <button class="btn btn-outline edit-item-btn" data-id="${item.id}" style="flex: 1;"><i class="fas fa-edit"></i> Edit</button>
                            <button class="btn btn-danger delete-item-btn" data-id="${item.id}" style="flex: 1;"><i class="fas fa-trash"></i> Delete</button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        if (typeof window.showModalWithContent === 'function') {
            window.showModalWithContent('item-details-modal', modalContent);
        }
        
        setTimeout(() => {
            const callBtn = document.querySelector('#item-details-modal .call-seller-btn');
            if (callBtn) {
                callBtn.addEventListener('click', () => contactSeller(callBtn.getAttribute('data-phone')));
            }
            
            const whatsappBtn = document.querySelector('#item-details-modal .whatsapp-seller-btn');
            if (whatsappBtn) {
                whatsappBtn.addEventListener('click', () => whatsappSeller(whatsappBtn.getAttribute('data-phone')));
            }
            
            const profileBtn = document.querySelector('#item-details-modal .view-seller-profile-btn');
            if (profileBtn) {
                profileBtn.addEventListener('click', () => {
                    viewSellerProfile(profileBtn.getAttribute('data-seller-id'));
                });
            }
            
            const editBtn = document.querySelector('#item-details-modal .edit-item-btn');
            if (editBtn) {
                editBtn.addEventListener('click', () => editMarketplaceItem(editBtn.getAttribute('data-id')));
            }
            
            const deleteBtn = document.querySelector('#item-details-modal .delete-item-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => deleteMarketplaceItem(deleteBtn.getAttribute('data-id')));
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

async function viewSellerProfile(sellerId) {
    if (!sellerId) {
        window.showToast('Invalid seller ID', 'error');
        return;
    }
    
    try {
        window.showToast('Loading profile...', 'info');
        
        const userDoc = await firebase.firestore().collection('users').doc(sellerId).get();
        if (!userDoc.exists) {
            window.showToast('Seller profile not found', 'error');
            return;
        }
        
        const seller = userDoc.data();
        const sellerName = seller.displayName || seller.userName || 'User';
        const sellerEmail = seller.email || '';
        const sellerPhone = seller.phone || '';
        const sellerRating = seller.averageRating || seller.rating || 0;
        const sellerRatingCount = seller.totalReviews || seller.ratingCount || 0;
        const ratingStars = generateStarRating(sellerRating);
        
        let itemsCount = 0;
        try {
            const itemsSnapshot = await firebase.firestore().collection('marketplace_items')
                .where('userId', '==', sellerId)
                .where('status', '==', 'active')
                .get();
            itemsCount = itemsSnapshot.size;
        } catch (err) {
            console.error('Error getting items count:', err);
        }
        
        let servicesCount = 0;
        try {
            const servicesSnapshot = await firebase.firestore().collection('services')
                .where('userId', '==', sellerId)
                .where('status', '==', 'active')
                .get();
            servicesCount = servicesSnapshot.size;
        } catch (err) {
            console.error('Error getting services count:', err);
        }
        
        const modalContent = `
            <div class="modal-content" style="max-width: 400px; border-radius: 20px;">
                <div class="modal-header" style="border-bottom: none; padding-bottom: 0;">
                    <div class="modal-title"><i class="fas fa-user-circle"></i> Seller Profile</div>
                    <button class="close-modal-btn" onclick="closeSellerProfileModal()">&times;</button>
                </div>
                <div style="padding: 20px; text-align: center;">
                    <div class="seller-avatar" style="width: 80px; height: 80px; background: linear-gradient(135deg, var(--primary), var(--primary-dark)); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 2rem; font-weight: bold; margin: 0 auto 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                        ${sellerName.charAt(0).toUpperCase()}
                    </div>
                    <h3 style="margin: 0 0 5px 0;">${escapeHtml(sellerName)}</h3>
                    <div class="seller-rating" style="margin: 10px 0;">
                        ${ratingStars}
                        <span style="margin-left: 8px; color: var(--grey-dark);">${sellerRating > 0 ? sellerRating.toFixed(1) : 'No ratings yet'}</span>
                        ${sellerRatingCount > 0 ? `<span style="color: var(--grey-dark);">(${sellerRatingCount} reviews)</span>` : ''}
                    </div>
                    
                    <div style="display: flex; justify-content: space-around; margin: 20px 0; padding: 15px 0; background: var(--light); border-radius: 12px;">
                        <div style="text-align: center;">
                            <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary);">${itemsCount + servicesCount}</div>
                            <div style="font-size: 0.7rem; color: var(--grey-dark);">Listings</div>
                        </div>
                        <div style="text-align: center;">
                            <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary);">${sellerRatingCount}</div>
                            <div style="font-size: 0.7rem; color: var(--grey-dark);">Reviews</div>
                        </div>
                    </div>
                    
                    ${seller.bio ? `<p style="margin: 10px 0; color: var(--grey-dark); font-size: 0.85rem; padding: 0 10px;">${escapeHtml(seller.bio)}</p>` : ''}
                    ${seller.location ? `<p style="margin: 5px 0;"><i class="fas fa-map-marker-alt" style="color: var(--primary);"></i> ${escapeHtml(seller.location)}</p>` : ''}
                    ${sellerEmail ? `<p style="margin: 5px 0;"><i class="fas fa-envelope" style="color: var(--primary);"></i> ${escapeHtml(sellerEmail)}</p>` : ''}
                    ${sellerPhone ? `<p style="margin: 5px 0;"><i class="fas fa-phone" style="color: var(--primary);"></i> ${escapeHtml(sellerPhone)}</p>` : ''}
                    
                    <div class="form-actions" style="display: flex; gap: 10px; margin-top: 20px;">
                        <button class="btn btn-primary" id="contact-seller-from-profile" style="flex: 1;">
                            <i class="fas fa-comment"></i> Send Message
                        </button>
                        <button class="btn btn-outline" id="view-seller-listings" style="flex: 1;">
                            <i class="fas fa-store"></i> View Listings
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        const modal = document.createElement('div');
        modal.id = 'seller-profile-modal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.style.zIndex = '20002';
        modal.innerHTML = modalContent;
        document.body.appendChild(modal);
        
        window.closeSellerProfileModal = function() {
            const modalEl = document.getElementById('seller-profile-modal');
            if (modalEl) modalEl.remove();
        };
        
        const contactBtn = document.getElementById('contact-seller-from-profile');
        if (contactBtn) {
            contactBtn.addEventListener('click', async () => {
                const currentUser = firebase.auth().currentUser;
                if (!currentUser) {
                    window.showToast('Please sign in to send a message', 'warning');
                    if (typeof window.openAuthModal === 'function') window.openAuthModal();
                    modal.remove();
                    return;
                }
                
                if (window.moreMenuManager && typeof window.moreMenuManager.startChatWithUser === 'function') {
                    await window.moreMenuManager.startChatWithUser(sellerId, `Hi! I'm interested in your listings on VikeServe.`);
                    window.showToast('Chat started! Check your messages.', 'success');
                    modal.remove();
                    
                    if (typeof window.switchTab === 'function') {
                        window.switchTab('more-tab');
                    }
                    if (window.moreMenuManager && typeof window.moreMenuManager.switchMoreTab === 'function') {
                        setTimeout(() => {
                            window.moreMenuManager.switchMoreTab('messages');
                        }, 500);
                    }
                } else {
                    window.showToast('Opening chat...', 'info');
                    modal.remove();
                }
            });
        }
        
        const listingsBtn = document.getElementById('view-seller-listings');
        if (listingsBtn) {
            listingsBtn.addEventListener('click', () => {
                modal.remove();
                if (typeof window.loadMarketplaceItems === 'function') {
                    window.showToast(`Loading ${escapeHtml(sellerName)}'s listings...`, 'info');
                    if (typeof window.switchTab === 'function') {
                        window.switchTab('marketplace-tab');
                    }
                }
            });
        }
        
    } catch (error) {
        console.error('Error loading seller profile:', error);
        window.showToast('Error loading seller profile: ' + error.message, 'error');
    }
}

async function editMarketplaceItem(itemId) {
    try {
        const doc = await firebase.firestore().collection('marketplace_items').doc(itemId).get();
        if (!doc.exists) {
            window.showToast('Item not found', 'error');
            return;
        }
        
        const item = doc.data();
        
        const currentUser = firebase.auth().currentUser;
        if (!currentUser || item.userId !== currentUser.uid) {
            window.showToast('You can only edit your own items', 'error');
            return;
        }
        
        const existingModal = document.getElementById('edit-item-modal');
        if (existingModal) existingModal.remove();
        
        const modalContent = `
            <div class="modal-content" style="max-width: 500px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <div class="modal-title"><i class="fas fa-edit"></i> Edit Item</div>
                    <button class="close-modal-btn" onclick="closeEditModal()">&times;</button>
                </div>
                <div style="padding: 10px 0;">
                    <div class="form-group">
                        <label class="form-label">Category</label>
                        <select id="edit-category" class="form-input">
                            <option value="electronics" ${item.category === 'electronics' ? 'selected' : ''}>📱 Electronics</option>
                            <option value="phones" ${item.category === 'phones' ? 'selected' : ''}>📱 Phones</option>
                            <option value="furniture" ${item.category === 'furniture' ? 'selected' : ''}>🛋️ Furniture</option>
                            <option value="mitumba" ${item.category === 'mitumba' ? 'selected' : ''}>👕 Mitumba</option>
                            <option value="vehicles" ${item.category === 'vehicles' ? 'selected' : ''}>🚗 Vehicles</option>
                            <option value="books" ${item.category === 'books' ? 'selected' : ''}>📚 Books</option>
                            <option value="sports" ${item.category === 'sports' ? 'selected' : ''}>⚽ Sports</option>
                            <option value="home-appliances" ${item.category === 'home-appliances' ? 'selected' : ''}>🔌 Appliances</option>
                            <option value="other" ${item.category === 'other' ? 'selected' : ''}>📦 Other</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Title *</label>
                        <input type="text" id="edit-title" class="form-input" value="${escapeHtml(item.title)}" placeholder="Item title">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Description *</label>
                        <textarea id="edit-description" class="form-input" rows="4" placeholder="Item description">${escapeHtml(item.description)}</textarea>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Price (KES) *</label>
                            <input type="number" id="edit-price" class="form-input" value="${item.price}" placeholder="Price">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Condition *</label>
                            <select id="edit-condition" class="form-input">
                                <option value="new" ${item.condition === 'new' ? 'selected' : ''}>🆕 Brand New</option>
                                <option value="like-new" ${item.condition === 'like-new' ? 'selected' : ''}>✨ Like New</option>
                                <option value="excellent" ${item.condition === 'excellent' ? 'selected' : ''}>⭐ Excellent</option>
                                <option value="good" ${item.condition === 'good' ? 'selected' : ''}>👍 Good</option>
                                <option value="fair" ${item.condition === 'fair' ? 'selected' : ''}>🔄 Fair</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Location *</label>
                        <input type="text" id="edit-location" class="form-input" value="${escapeHtml(item.location)}" placeholder="Your location">
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Phone Number *</label>
                            <input type="tel" id="edit-phone" class="form-input" value="${escapeHtml(item.phone)}" placeholder="Phone number">
                        </div>
                        <div class="form-group">
                            <label class="form-label">WhatsApp</label>
                            <input type="tel" id="edit-whatsapp" class="form-input" value="${escapeHtml(item.whatsapp || item.phone)}" placeholder="WhatsApp number">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label style="display: flex; align-items: center; gap: 8px;">
                                <input type="checkbox" id="edit-negotiable" ${item.negotiable ? 'checked' : ''}> Price Negotiable
                            </label>
                        </div>
                        <div class="form-group">
                            <label style="display: flex; align-items: center; gap: 8px;">
                                <input type="checkbox" id="edit-delivery" ${item.delivery ? 'checked' : ''}> Delivery Available
                            </label>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Status</label>
                        <select id="edit-status" class="form-input">
                            <option value="active" ${item.status === 'active' ? 'selected' : ''}>Active</option>
                            <option value="sold" ${item.status === 'sold' ? 'selected' : ''}>Sold</option>
                            <option value="inactive" ${item.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                        </select>
                    </div>
                    
                    ${item.images && item.images.length > 0 ? `
                        <div class="form-group">
                            <label class="form-label">Current Images</label>
                            <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px;">
                                ${item.images.map((img, idx) => `
                                    <div style="position: relative; display: inline-block;">
                                        <img src="${img}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;">
                                        <button type="button" class="remove-existing-image" data-img-url="${img}" style="position: absolute; top: -5px; right: -5px; background: red; color: white; border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; cursor: pointer;">×</button>
                                    </div>
                                `).join('')}
                            </div>
                            <input type="hidden" id="edit-existing-images" value='${JSON.stringify(item.images)}'>
                        </div>
                    ` : ''}
                    
                    <div class="image-upload-area" onclick="document.getElementById('edit-images').click()" style="margin: 10px 0;">
                        <i class="fas fa-cloud-upload-alt"></i>
                        <p>Click to add new images</p>
                        <span>Optional: Add more images</span>
                    </div>
                    <input type="file" id="edit-images" multiple accept="image/*" style="display: none;">
                    <div id="edit-image-preview-container" class="image-preview-container"></div>
                    
                    <div class="form-actions" style="display: flex; gap: 10px; margin-top: 20px;">
                        <button class="btn btn-outline" onclick="closeEditModal()">Cancel</button>
                        <button class="btn btn-primary" id="save-edit-btn" data-item-id="${itemId}">Save Changes</button>
                    </div>
                </div>
            </div>
        `;
        
        const modal = document.createElement('div');
        modal.id = 'edit-item-modal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.style.zIndex = '20001';
        modal.innerHTML = modalContent;
        document.body.appendChild(modal);
        
        const editImageInput = document.getElementById('edit-images');
        if (editImageInput) {
            editImageInput.addEventListener('change', (e) => {
                const previewContainer = document.getElementById('edit-image-preview-container');
                if (previewContainer) {
                    previewContainer.innerHTML = '';
                    Array.from(e.target.files).forEach(file => {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            const preview = document.createElement('div');
                            preview.className = 'image-preview-item';
                            preview.innerHTML = `
                                <img src="${event.target.result}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;">
                                <button type="button" class="remove-image-preview" style="position: absolute; top: -5px; right: -5px; background: red; color: white; border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; cursor: pointer;">×</button>
                            `;
                            previewContainer.appendChild(preview);
                        };
                        reader.readAsDataURL(file);
                    });
                }
            });
        }
        
        document.querySelectorAll('.remove-existing-image').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const imgUrl = btn.getAttribute('data-img-url');
                let existingImages = JSON.parse(document.getElementById('edit-existing-images')?.value || '[]');
                existingImages = existingImages.filter(url => url !== imgUrl);
                document.getElementById('edit-existing-images').value = JSON.stringify(existingImages);
                btn.closest('div').remove();
                window.showToast('Image will be removed on save', 'info');
            });
        });
        
        const saveBtn = document.getElementById('save-edit-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                await saveEditedItem(itemId);
            });
        }
        
    } catch (error) {
        console.error('Error loading item for edit:', error);
        window.showToast('Error loading item for edit: ' + error.message, 'error');
    }
}

async function saveEditedItem(itemId) {
    try {
        const category = document.getElementById('edit-category')?.value;
        const title = document.getElementById('edit-title')?.value.trim();
        const description = document.getElementById('edit-description')?.value.trim();
        const price = document.getElementById('edit-price')?.value;
        const condition = document.getElementById('edit-condition')?.value;
        const location = document.getElementById('edit-location')?.value.trim();
        const phone = document.getElementById('edit-phone')?.value.trim();
        const whatsapp = document.getElementById('edit-whatsapp')?.value.trim();
        const negotiable = document.getElementById('edit-negotiable')?.checked;
        const delivery = document.getElementById('edit-delivery')?.checked;
        const status = document.getElementById('edit-status')?.value;
        
        if (!title || !description || !price || !location || !phone) {
            window.showToast('Please fill in all required fields', 'error');
            return;
        }
        
        window.showToast('Saving changes...', 'info');
        
        let existingImages = [];
        const existingImagesInput = document.getElementById('edit-existing-images');
        if (existingImagesInput && existingImagesInput.value) {
            existingImages = JSON.parse(existingImagesInput.value);
        }
        
        const imageInput = document.getElementById('edit-images');
        let newImages = [];
        if (imageInput && imageInput.files && imageInput.files.length > 0) {
            window.showToast('Uploading new images...', 'info');
            const imageFiles = Array.from(imageInput.files);
            newImages = await uploadMarketplaceImages(imageFiles, itemId);
        }
        
        const allImages = [...existingImages, ...newImages];
        
        await firebase.firestore().collection('marketplace_items').doc(itemId).update({
            category: category,
            title: title,
            description: description,
            price: parseInt(price),
            condition: condition,
            location: location,
            phone: phone,
            whatsapp: whatsapp || phone,
            negotiable: negotiable || false,
            delivery: delivery || false,
            status: status,
            images: allImages,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        window.showToast('✅ Item updated successfully!', 'success');
        
        closeEditModal();
        
        setTimeout(() => {
            loadMarketplaceItems(currentCategory || 'all');
        }, 500);
        
    } catch (error) {
        console.error('Error saving edited item:', error);
        window.showToast('Error saving changes: ' + error.message, 'error');
    }
}

function closeEditModal() {
    const modal = document.getElementById('edit-item-modal');
    if (modal) {
        modal.remove();
    }
}

window.closeEditModal = closeEditModal;
window.saveEditedItem = saveEditedItem;

async function deleteMarketplaceItem(itemId) {
    if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) return;
    
    try {
        await firebase.firestore().collection('marketplace_items').doc(itemId).delete();
        showToast('Item deleted successfully', 'success');
        if (typeof window.closeModal === 'function') {
            window.closeModal('item-details-modal');
        }
        loadMarketplaceItems(currentCategory);
    } catch (error) {
    console.error('Error deleting item:', error);
    window.showToast('Error deleting item: ' + error.message, 'error');
}
}

async function submitMarketplaceItem() {
    console.log('submitMarketplaceItem called - saving to Firebase Storage');
    
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
    
    if (!category) {
        window.showToast('Please select a category', 'error');
        return;
    }
    if (!title) {
        window.showToast('Please enter a title', 'error');
        return;
    }
    if (!description) {
        window.showToast('Please enter a description', 'error');
        return;
    }
    if (!price || price <= 0) {
        window.showToast('Please enter a valid price', 'error');
        return;
    }
    if (!condition) {
        window.showToast('Please select a condition', 'error');
        return;
    }
    if (!location) {
        window.showToast('Please enter a location', 'error');
        return;
    }
    if (!phone) {
        window.showToast('Please enter a phone number', 'error');
        return;
    }
    
    window.showToast('Saving item...', 'info');
    
    const itemId = firebase.firestore().collection('marketplace_items').doc().id;
    
    const itemData = {
        category: category,
        title: title,
        description: description,
        price: parseInt(price),
        condition: condition,
        location: location,
        phone: phone,
        whatsapp: whatsapp || phone,
        negotiable: negotiable || false,
        delivery: delivery || false,
        status: 'active',
        promoted: false,
        images: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        userId: user.uid,
        userName: user.displayName || user.email || 'User',
        userEmail: user.email
    };
    
    try {
        const imageInput = document.getElementById('market-images');
        if (imageInput && imageInput.files && imageInput.files.length > 0) {
            window.showToast('Uploading images...', 'info');
            const imageFiles = Array.from(imageInput.files);
            const uploadedUrls = await uploadMarketplaceImages(imageFiles, itemId);
            itemData.images = uploadedUrls;
        }
        
        await firebase.firestore().collection('marketplace_items').doc(itemId).set(itemData);
        console.log('Item saved to Firebase with ID:', itemId);
        
        window.showToast('✅ Item listed successfully!', 'success');
        
        const modal = document.getElementById('marketplace-post-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        resetMarketplaceForm();
        
        setTimeout(() => {
            loadMarketplaceItems(currentCategory || 'all');
            if (typeof window.switchTab === 'function') {
                window.switchTab('marketplace-tab');
            }
        }, 500);
        
    } catch (error) {
        console.error('Error saving item:', error);
        window.showToast(`Error: ${error.message}`, 'error');
    }
}

function resetMarketplaceForm() {
    const fields = ['market-category', 'market-title', 'market-description', 'market-price', 'market-condition', 'market-location', 'market-phone', 'market-whatsapp'];
    fields.forEach(id => { const field = document.getElementById(id); if (field) field.value = ''; });
    const checkboxes = ['market-negotiable', 'market-delivery'];
    checkboxes.forEach(id => { const cb = document.getElementById(id); if (cb) cb.checked = false; });
    const previewContainer = document.getElementById('image-preview-container');
    if (previewContainer) previewContainer.innerHTML = '';
    const imageInput = document.getElementById('market-images');
    if (imageInput) imageInput.value = '';
}

function showMarketplacePostModal() {
    console.log('showMarketplacePostModal called');
    resetMarketplaceForm();
    const modal = document.getElementById('marketplace-post-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '10001';
    } else {
    console.error('marketplace-post-modal not found');
    window.showToast('Form not available', 'error');
}
}

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

function setupMarketplaceSearch() {
    const searchInput = document.querySelector('#marketplace-tab .search-input');
    if (searchInput) {
        let timeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(async () => {
                const searchTerm = e.target.value.toLowerCase();
                if (searchTerm.length < 2) {
                    loadMarketplaceItems(currentCategory);
                    return;
                }
                
                const container = document.getElementById('marketplace-items-container');
                container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div> Searching...</div>';
                
                const snapshot = await firebase.firestore().collection('marketplace_items')
                    .where('status', '==', 'active')
                    .get();
                    
                const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const filtered = items.filter(item => 
                    item.title?.toLowerCase().includes(searchTerm) || 
                    item.description?.toLowerCase().includes(searchTerm)
                );
                
                container.innerHTML = '';
                if (filtered.length === 0) {
                    container.innerHTML = '<div class="empty-marketplace">No items found</div>';
                } else {
                    filtered.forEach(item => {
                        container.appendChild(createMarketplaceItemElement(item));
                    });
                }
            }, 300);
        });
    }
}

function showGasRefillPostModal() {
    resetGasRefillForm();
    const modal = document.getElementById('gas-refill-post-modal');
    if (modal) modal.style.display = 'flex';
}

function resetGasRefillForm() {
    const fields = ['gas-title', 'gas-type', 'gas-cylinder-size', 'gas-price', 'gas-brand', 'gas-location', 'gas-description', 'gas-phone'];
    fields.forEach(id => {
        const field = document.getElementById(id);
        if (field) {
            if (field.tagName === 'SELECT') {
                field.selectedIndex = 0;
            } else {
                field.value = '';
            }
        }
    });
    console.log('Gas refill form reset');
}

async function submitGasRefillListing() {
    console.log('submitGasRefillListing called');
    
    const title = document.getElementById('gas-title')?.value.trim();
    const gasType = document.getElementById('gas-type')?.value;
    const cylinderSize = document.getElementById('gas-cylinder-size')?.value;
    const price = document.getElementById('gas-price')?.value;
    const brand = document.getElementById('gas-brand')?.value;
    const location = document.getElementById('gas-location')?.value.trim();
    const description = document.getElementById('gas-description')?.value.trim();
    const phone = document.getElementById('gas-phone')?.value.trim();
    
    console.log('Form values:', { title, gasType, cylinderSize, price, brand, location, description, phone });
    
    const user = firebase.auth().currentUser;
    if (!user) {
        window.showToast('Please sign in to list a service', 'error');
        if (typeof window.openAuthModal === 'function') window.openAuthModal();
        return;
    }
    
    if (!title) {
        window.showToast('Please enter a title', 'error');
        return;
    }
    if (!gasType) {
        window.showToast('Please select gas type', 'error');
        return;
    }
    if (!cylinderSize) {
        window.showToast('Please enter cylinder size', 'error');
        return;
    }
    if (!price) {
        window.showToast('Please enter price', 'error');
        return;
    }
    if (!location) {
        window.showToast('Please enter location', 'error');
        return;
    }
    if (!description) {
        window.showToast('Please enter description', 'error');
        return;
    }
    if (!phone) {
        window.showToast('Please enter phone number', 'error');
        return;
    }
    
    window.showToast('Saving gas refill service...', 'info');
    
    const gasData = {
        category: 'gas-refill',
        title: title,
        gasType: gasType,
        cylinderSize: cylinderSize,
        price: parseInt(price),
        location: location,
        description: description,
        phone: phone,
        status: 'active',
        promoted: false,
        images: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        userId: user.uid,
        userName: user.displayName || user.email || 'User',
        userEmail: user.email
    };
    
    if (brand && brand.trim() !== '') {
        gasData.brand = brand.trim();
    }
    
    console.log('Saving gas data:', gasData);
    
    try {
        const docRef = await firebase.firestore().collection('marketplace_items').add(gasData);
        console.log('Gas service saved with ID:', docRef.id);
        
        window.showToast('✅ Gas refill service listed successfully!', 'success');
        
        const modal = document.getElementById('gas-refill-post-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        resetGasRefillForm();
        
        setTimeout(() => {
            loadMarketplaceItems('gas-refill');
        }, 500);
        
    } catch (error) {
        console.error('Error saving gas service:', error);
        window.showToast(`Error: ${error.message}`, 'error');
    }
}

function showWaterDeliveryPostModal() {
    resetWaterDeliveryForm();
    const modal = document.getElementById('water-delivery-post-modal');
    if (modal) modal.style.display = 'flex';
}

function resetWaterDeliveryForm() {
    const fields = ['water-title', 'water-type', 'water-container-size', 'water-price', 'water-location', 'water-description', 'water-phone'];
    fields.forEach(id => {
        const field = document.getElementById(id);
        if (field) field.value = '';
    });
}

async function submitWaterDeliveryListing() {
    const title = document.getElementById('water-title')?.value.trim();
    const waterType = document.getElementById('water-type')?.value;
    const containerSize = document.getElementById('water-container-size')?.value;
    const price = document.getElementById('water-price')?.value;
    const location = document.getElementById('water-location')?.value.trim();
    const description = document.getElementById('water-description')?.value.trim();
    const phone = document.getElementById('water-phone')?.value.trim();
    
    const user = firebase.auth().currentUser;
    if (!user) {
        showToast('Please sign in to list a service', 'error');
        if (typeof window.openAuthModal === 'function') window.openAuthModal();
        return;
    }
    
    if (!title || !waterType || !containerSize || !price || !location || !description || !phone) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    const waterData = {
        category: 'water-delivery',
        title: title,
        waterType: waterType,
        containerSize: containerSize,
        price: parseInt(price),
        location: location,
        description: description,
        phone: phone,
        status: 'active',
        promoted: false,
        images: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        userId: user.uid,
        userName: user.displayName || user.email || 'User',
        userEmail: user.email
    };
    
    try {
        await firebase.firestore().collection('marketplace_items').add(waterData);
        showToast('✅ Water delivery service listed successfully!', 'success');
        const modal = document.getElementById('water-delivery-post-modal');
        if (modal) modal.style.display = 'none';
        resetWaterDeliveryForm();
        loadMarketplaceItems('water-delivery');
    } catch (error) {
        console.error('Error saving water service:', error);
        showToast(`Error: ${error.message}`, 'error');
    }
}

function showHotelPostModal() {
    resetHotelForm();
    const modal = document.getElementById('hotel-post-modal');
    if (modal) modal.style.display = 'flex';
}

function resetHotelForm() {
    const fields = ['hotel-name', 'hotel-type', 'hotel-price', 'hotel-rooms', 'hotel-location', 'hotel-description', 'hotel-phone'];
    fields.forEach(id => {
        const field = document.getElementById(id);
        if (field) field.value = '';
    });
}

async function submitHotelListing() {
    const name = document.getElementById('hotel-name')?.value.trim();
    const hotelType = document.getElementById('hotel-type')?.value;
    const price = document.getElementById('hotel-price')?.value;
    const rooms = document.getElementById('hotel-rooms')?.value;
    const location = document.getElementById('hotel-location')?.value.trim();
    const description = document.getElementById('hotel-description')?.value.trim();
    const phone = document.getElementById('hotel-phone')?.value.trim();
    
    const user = firebase.auth().currentUser;
    if (!user) {
        showToast('Please sign in to list a hotel', 'error');
        if (typeof window.openAuthModal === 'function') window.openAuthModal();
        return;
    }
    
    if (!name || !hotelType || !price || !rooms || !location || !description || !phone) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    const hotelData = {
        category: 'hotel',
        title: name,
        hotelType: hotelType,
        price: parseInt(price),
        rooms: parseInt(rooms),
        location: location,
        description: description,
        phone: phone,
        status: 'active',
        promoted: false,
        images: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        userId: user.uid,
        userName: user.displayName || user.email || 'User',
        userEmail: user.email
    };
    
    try {
        await firebase.firestore().collection('marketplace_items').add(hotelData);
        showToast('✅ Hotel listed successfully!', 'success');
        const modal = document.getElementById('hotel-post-modal');
        if (modal) modal.style.display = 'none';
        resetHotelForm();
        loadMarketplaceItems('hotel');
    } catch (error) {
        console.error('Error saving hotel:', error);
        showToast(`Error: ${error.message}`, 'error');
    }
}

function showPropertyPostModal() {
    resetPropertyForm();
    const modal = document.getElementById('property-post-modal');
    if (modal) modal.style.display = 'flex';
}

function resetPropertyForm() {
    const fields = ['property-type', 'property-title', 'property-price', 'property-location', 'property-bedrooms', 'property-bathrooms', 'property-description'];
    fields.forEach(id => {
        const field = document.getElementById(id);
        if (field) field.value = '';
    });
    const previewContainer = document.getElementById('property-images-container');
    if (previewContainer) previewContainer.innerHTML = '';
}

async function submitProperty() {
    const type = document.getElementById('property-type')?.value;
    const title = document.getElementById('property-title')?.value.trim();
    const price = document.getElementById('property-price')?.value;
    const location = document.getElementById('property-location')?.value.trim();
    const bedrooms = document.getElementById('property-bedrooms')?.value;
    const bathrooms = document.getElementById('property-bathrooms')?.value;
    const description = document.getElementById('property-description')?.value.trim();
    
    const user = firebase.auth().currentUser;
    if (!user) {
        showToast('Please sign in to list a property', 'error');
        if (typeof window.openAuthModal === 'function') window.openAuthModal();
        return;
    }
    
    if (!type || !title || !price || !location || !description) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    const propertyData = {
        category: type,
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
        await firebase.firestore().collection('marketplace_items').add(propertyData);
        showToast('✅ Property listed successfully!', 'success');
        const modal = document.getElementById('property-post-modal');
        if (modal) modal.style.display = 'none';
        resetPropertyForm();
        loadMarketplaceItems(type);
    } catch (error) {
        console.error('Error saving property:', error);
        showToast(`Error: ${error.message}`, 'error');
    }
}

function showLandPostModal() {
    resetLandForm();
    const modal = document.getElementById('land-post-modal');
    if (modal) modal.style.display = 'flex';
}

function resetLandForm() {
    const fields = ['land-title', 'land-description', 'land-price', 'land-size', 'land-location', 'land-phone'];
    fields.forEach(id => {
        const field = document.getElementById(id);
        if (field) field.value = '';
    });
}

async function submitLandListing() {
    const title = document.getElementById('land-title')?.value.trim();
    const description = document.getElementById('land-description')?.value.trim();
    const price = document.getElementById('land-price')?.value;
    const size = document.getElementById('land-size')?.value;
    const location = document.getElementById('land-location')?.value;
    const phone = document.getElementById('land-phone')?.value.trim();
    
    const user = firebase.auth().currentUser;
    if (!user) {
        showToast('Please sign in to list land', 'error');
        if (typeof window.openAuthModal === 'function') window.openAuthModal();
        return;
    }
    
    if (!title || !description || !price || !location || !phone) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    const landData = {
        category: 'land',
        title: title,
        description: description,
        price: parseInt(price),
        size: size || 'Not specified',
        location: location,
        phone: phone,
        images: [],
        status: 'active',
        promoted: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        userId: user.uid,
        userName: user.displayName || user.email || 'User',
        userEmail: user.email
    };
    
    try {
        await firebase.firestore().collection('marketplace_items').add(landData);
        showToast('✅ Land listed successfully!', 'success');
        const modal = document.getElementById('land-post-modal');
        if (modal) modal.style.display = 'none';
        resetLandForm();
        loadMarketplaceItems('land');
    } catch (error) {
        console.error('Error saving land listing:', error);
        showToast(`Error: ${error.message}`, 'error');
    }
}

function setupMarketplaceButtons() {
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
                btn.handler();
            });
        }
    });
    
    const submitMarketplaceBtn = document.getElementById('submit-marketplace-btn');
    if (submitMarketplaceBtn) {
        const newBtn = submitMarketplaceBtn.cloneNode(true);
        submitMarketplaceBtn.parentNode.replaceChild(newBtn, submitMarketplaceBtn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            submitMarketplaceItem();
        });
    }
    
    const submitGasBtn = document.getElementById('submit-gas-btn');
    if (submitGasBtn) {
        const newBtn = submitGasBtn.cloneNode(true);
        submitGasBtn.parentNode.replaceChild(newBtn, submitGasBtn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            submitGasRefillListing();
        });
    }
    
    const submitWaterBtn = document.getElementById('submit-water-btn');
    if (submitWaterBtn) {
        const newBtn = submitWaterBtn.cloneNode(true);
        submitWaterBtn.parentNode.replaceChild(newBtn, submitWaterBtn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            submitWaterDeliveryListing();
        });
    }
    
    const submitHotelBtn = document.getElementById('submit-hotel-btn');
    if (submitHotelBtn) {
        const newBtn = submitHotelBtn.cloneNode(true);
        submitHotelBtn.parentNode.replaceChild(newBtn, submitHotelBtn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            submitHotelListing();
        });
    }
    
    const submitPropertyBtn = document.getElementById('submit-property-btn');
    if (submitPropertyBtn) {
        const newBtn = submitPropertyBtn.cloneNode(true);
        submitPropertyBtn.parentNode.replaceChild(newBtn, submitPropertyBtn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            submitProperty();
        });
    }
    
    const submitLandBtn = document.getElementById('submit-land-btn');
    if (submitLandBtn) {
        const newBtn = submitLandBtn.cloneNode(true);
        submitLandBtn.parentNode.replaceChild(newBtn, submitLandBtn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            submitLandListing();
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        setupFilterButtons();
        setupMarketplaceSearch();
        setupMarketplaceButtons();
        loadMarketplaceItems('all');
        console.log('✅ Marketplace fully loaded');
    }, 300);
});

window.loadMarketplaceItems = loadMarketplaceItems;
window.viewListingDetails = viewListingDetails;
window.contactSeller = contactSeller;
window.whatsappSeller = whatsappSeller;
window.submitMarketplaceItem = submitMarketplaceItem;
window.showMarketplacePostModal = showMarketplacePostModal;
window.showGasRefillPostModal = showGasRefillPostModal;
window.submitGasRefillListing = submitGasRefillListing;
window.showWaterDeliveryPostModal = showWaterDeliveryPostModal;
window.submitWaterDeliveryListing = submitWaterDeliveryListing;
window.showHotelPostModal = showHotelPostModal;
window.submitHotelListing = submitHotelListing;
window.showPropertyPostModal = showPropertyPostModal;
window.submitProperty = submitProperty;
window.showLandPostModal = showLandPostModal;
window.submitLandListing = submitLandListing;
window.setupFilterButtons = setupFilterButtons;
window.viewSellerProfile = viewSellerProfile;

async function startChatWithSeller(sellerId, sellerName) {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) {
        window.showToast('Please sign in to send a message', 'warning');
        if (typeof window.openAuthModal === 'function') window.openAuthModal();
        return;
    }
    
    if (!sellerId) {
        window.showToast('Invalid seller', 'error');
        return;
    }
    
    if (sellerId === currentUser.uid) {
        window.showToast('You cannot chat with yourself', 'info');
        return;
    }
    
    try {
        if (window.moreMenuManager && typeof window.moreMenuManager.startChatWithUser === 'function') {
            await window.moreMenuManager.startChatWithUser(sellerId, `Hi! I'm interested in your items on VikeServe.`);
            window.showToast('Chat started! Check your messages.', 'success');
            
            if (typeof window.switchTab === 'function') {
                window.switchTab('more-tab');
            }
            if (window.moreMenuManager && typeof window.moreMenuManager.switchMoreTab === 'function') {
                setTimeout(() => {
                    window.moreMenuManager.switchMoreTab('messages');
                }, 500);
            }
        } else {
            window.showToast('Opening chat...', 'info');
        }
    } catch (error) {
        console.error('Error starting chat:', error);
        window.showToast('Error starting chat: ' + error.message, 'error');
    }
}

window.startChatWithSeller = startChatWithSeller;