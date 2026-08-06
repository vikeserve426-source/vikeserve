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

div.style.cssText = `
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
    `;

    div.setAttribute('data-ad-id', item.id);
    div.setAttribute('data-category', item.category);
    div.setAttribute('data-seller-id', item.userId);
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
        <div style="text-align: center; padding: 20px; color: var(--text-tertiary); font-size: 0.75rem; border-top: 1px solid var(--border-color); margin-top: 20px; grid-column: span 2;">
            <div style="font-weight: 600; margin-bottom: 4px;">VikeServe v1.0.0</div>
            <div>© 2026 VikeServe Ltd. Built with ❤️ in KENYA</div>
            <div style="font-size: 0.65rem; margin-top: 6px;">
                <a href="https://vike-store.netlify.app/" target="_blank" style="color: var(--primary); text-decoration: none;">Visit our website</a>
            </div>
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

if (!document.getElementById('marketplace-footer')) {
    const footer = document.createElement('div');
    footer.id = 'marketplace-footer';
    footer.style.cssText = `
        text-align: center;
        padding: 30px 20px 20px;
        color: var(--text-tertiary);
        font-size: 0.75rem;
        border-top: 1px solid var(--border-color);
        margin-top: 20px;
        width: 100%;
    `;
    footer.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 4px;">VikeServe v1.0.0</div>
        <div>© 2026 VikeServe Ltd. Built with ❤️ in KENYA</div>
        <div style="font-size: 0.65rem; margin-top: 6px;">
            <a href="https://vike-store.netlify.app/" target="_blank" style="color: var(--primary); text-decoration: none;">Visit our website</a>
        </div>
    `;
    container.appendChild(footer);
}

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
        const roleDisplay = getRoleDisplay(seller.role || 'general-user');

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

        const currentUser = firebase.auth().currentUser;
        const canReview = currentUser && currentUser.uid !== sellerId;

        const modalContent = `
            <div class="modal-content" style="max-width: 400px; border-radius: 20px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header" style="border-bottom: none; padding-bottom: 0;">
                    <div class="modal-title"><i class="fas fa-user-circle"></i> Seller Profile</div>
                    <button class="close-modal-btn" onclick="closeSellerProfileModal()">&times;</button>
                </div>
                <div style="padding: 20px; text-align: center;">
                    <div class="seller-avatar" style="width: 80px; height: 80px; background: linear-gradient(135deg, var(--primary), var(--primary-dark)); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 2rem; font-weight: bold; margin: 0 auto 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                        ${sellerName.charAt(0).toUpperCase()}
                    </div>
                    <h3 style="margin: 0 0 5px 0;">${escapeHtml(sellerName)}</h3>
                    <div style="margin: 5px 0;">${roleDisplay}</div>
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

                    <div class="form-actions" style="display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap;">
                        <button class="btn btn-primary" id="contact-seller-from-profile" style="flex: 1;">
                            <i class="fas fa-comment"></i> Send Message
                        </button>
                        <button class="btn btn-outline" id="view-seller-listings" style="flex: 1;">
                            <i class="fas fa-store"></i> View Listings
                        </button>
                        ${canReview ? `
                            <button class="btn btn-warning" id="review-seller-btn" style="flex: 1; background: var(--warning); color: white;">
                                <i class="fas fa-star"></i> Review
                            </button>
                        ` : ''}
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

        const reviewBtn = document.getElementById('review-seller-btn');
        if (reviewBtn) {
            reviewBtn.addEventListener('click', () => {
                modal.remove();
                if (typeof window.showReviewModal === 'function') {
                    window.showReviewModal(sellerId, sellerName, 'seller');
                } else {
                    window.showToast('Review feature coming soon', 'info');
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