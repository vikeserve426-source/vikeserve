class AuthManager {
    constructor() {
        this.auth = auth;
        this.db = db;
        this.currentUser = null;
        this.userData = null;
        this.init();
    }

    async init() {
        this.auth.onAuthStateChanged(async (user) => {
            this.currentUser = user;
            if (user) {
                await this.loadUserData(user.uid);
                this.updateUIForAuthenticatedUser(user);
                window.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user: user, isLoggedIn: true } }));
            } else {
                this.updateUIForGuest();
                window.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user: null, isLoggedIn: false } }));
            }
        });

        this.setupFormHandlers();
        this.setupUserMenuButtons();
    }

    async loadUserData(userId) {
        try {
            const userDoc = await this.db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                this.userData = userDoc.data();
                return this.userData;
            } else {
                await this.createUserDocument(userId);
                return null;
            }
        } catch (error) {
            return null;
        }
    }

    async createUserDocument(userId) {
        try {
            const userData = {
                uid: userId,
                email: this.currentUser.email,
                displayName: this.currentUser.displayName || this.currentUser.email.split('@')[0],
                photoURL: this.currentUser.photoURL || '',
                role: 'general-user',
                phoneNumber: null,
                location: null,
                bio: null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                stats: {
                    adsPosted: 0,
                    bookingsMade: 0,
                    servicesOffered: 0,
                    reviewsReceived: 0,
                    rating: 0
                }
            };

            await this.db.collection('users').doc(userId).set(userData);
            this.userData = userData;
            return userData;
        } catch (error) {
            throw error;
        }
    }

    setupFormHandlers() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            const newLoginForm = loginForm.cloneNode(true);
            loginForm.parentNode.replaceChild(newLoginForm, loginForm);
            newLoginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleLoginFormSubmit(newLoginForm);
            });
        }

        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            const newRegisterForm = registerForm.cloneNode(true);
            registerForm.parentNode.replaceChild(newRegisterForm, registerForm);
            newRegisterForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleRegisterFormSubmit(newRegisterForm);
            });
        }

        this.setupRoleSelection();
    }

    setupUserMenuButtons() {
        const userMenu = document.getElementById('user-menu');
        
        const buttons = [
            { id: 'profile-button', handler: () => this.showProfile() },
            { id: 'my-ads-button', handler: () => this.showMyAds() },
            { id: 'my-bookings-button', handler: () => this.showMyBookings() },
            { id: 'logout-button', handler: () => this.signOut() },
            { id: 'settings-button', handler: () => this.openSettings() }
        ];
        
        buttons.forEach(btn => {
            const element = document.getElementById(btn.id);
            if (element) {
                const newElement = element.cloneNode(true);
                element.parentNode.replaceChild(newElement, element);
                newElement.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (userMenu) {
                        userMenu.classList.remove('show');
                    }
                    
                    btn.handler();
                });
            }
        });
    }

    showProfile() {
        if (typeof window.closeMoreMenu === 'function') {
            window.closeMoreMenu();
        }
        
        if (typeof window.switchTab === 'function') {
            window.switchTab('account-tab');
        } else if (window.app && typeof window.app.switchTab === 'function') {
            window.app.switchTab('account-tab');
        }
        
        if (typeof loadUserAccountData === 'function') {
            setTimeout(() => loadUserAccountData(), 100);
        }
        
        this.showToast('Profile', 'info');
    }

showMyAds() {
    if (typeof window.switchTab === 'function') {
        window.switchTab('marketplace-tab');
    }
    
    const currentUser = this.currentUser;
    if (currentUser) {
        // Load from Firebase instead of localStorage
        this.loadUserAdsFromFirebase(currentUser.uid);
    } else {
        this.showToast('Please sign in to view your ads', 'warning');
        if (typeof showAuthModal === 'function') showAuthModal();
    }
}

async loadUserAdsFromFirebase(userId) {
    try {
        const snapshot = await firebase.firestore()
            .collection('marketplace_items')
            .where('userId', '==', userId)
            .where('status', '==', 'active')
            .orderBy('createdAt', 'desc')
            .get();
        
        const userItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (userItems.length === 0) {
            this.showToast('You have not posted any ads yet', 'info');
            setTimeout(() => {
                if (typeof showMarketplacePostModal === 'function') {
                    showMarketplacePostModal();
                }
            }, 1000);
        } else {
            this.showToast(`You have ${userItems.length} active ad(s)`, 'success');
            this.showMyAdsModal(userItems);
        }
    } catch (error) {
        console.error('Error loading user ads from Firebase:', error);
        this.showToast('Error loading your ads', 'error');
    }
}

    showMyAdsModal(ads) {
        const modalContent = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <div class="modal-title"><i class="fas fa-ad"></i> My Ads (${ads.length})</div>
                    <button class="close-modal-btn">&times;</button>
                </div>
                <div style="max-height: 60vh; overflow-y: auto; padding: 10px;">
                    ${ads.map(ad => `
                        <div style="background: var(--light); border-radius: 10px; padding: 12px; margin-bottom: 10px;">
                            <div style="font-weight: 600;">${this.escapeHtml(ad.title)}</div>
                            <div style="font-size: 0.8rem; color: var(--primary);">${ad.price ? `KES ${ad.price}` : 'Price not set'}</div>
                            <div style="font-size: 0.7rem; color: #666;">Posted: ${new Date(ad.timestamp).toLocaleDateString()}</div>
                            <div style="margin-top: 8px;">
                                <button class="btn btn-sm btn-outline view-ad-btn" data-id="${ad.id}" style="margin-right: 5px;">View</button>
                                <button class="btn btn-sm btn-danger delete-ad-btn" data-id="${ad.id}">Delete</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="form-actions" style="margin-top: 15px; padding: 10px;">
                    <button class="btn btn-primary" id="post-new-ad-btn">Post New Ad</button>
                    <button class="btn btn-outline close-modal-btn">Close</button>
                </div>
            </div>
        `;
        
        if (typeof window.showModalWithContent === 'function') {
            window.showModalWithContent('my-ads-modal', modalContent);
        }
        
        setTimeout(() => {
            document.querySelectorAll('.view-ad-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const adId = btn.getAttribute('data-id');
                    if (typeof viewListingDetails === 'function') {
                        viewListingDetails(adId);
                    }
                });
            });
            
            document.querySelectorAll('.delete-ad-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const adId = btn.getAttribute('data-id');
                    if (confirm('Are you sure you want to delete this ad?')) {
    try {
        await firebase.firestore().collection('marketplace_items').doc(adId).delete();
        this.showToast('Ad deleted successfully', 'success');
        if (typeof window.closeModal === 'function') window.closeModal('my-ads-modal');
        this.showMyAds();
    } catch (error) {
        console.error('Error deleting ad:', error);
        this.showToast('Error deleting ad', 'error');
    }
}
                });
            });
            
            const postNewBtn = document.getElementById('post-new-ad-btn');
            if (postNewBtn) {
                postNewBtn.addEventListener('click', () => {
                    if (typeof window.closeModal === 'function') window.closeModal('my-ads-modal');
                    if (typeof showMarketplacePostModal === 'function') {
                        showMarketplacePostModal();
                    }
                });
            }
            
            const closeBtn = document.querySelector('#my-ads-modal .close-modal-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    if (typeof window.closeModal === 'function') window.closeModal('my-ads-modal');
                });
            }
        }, 100);
    }

    showMyBookings() {
        if (typeof window.switchTab === 'function') {
            window.switchTab('services-tab');
        }
        
        const bookings = JSON.parse(localStorage.getItem('vikeserve_bookings') || '[]');
        const userBookings = bookings.filter(b => b.userId === this.currentUser?.uid);
        
        if (userBookings.length === 0) {
            this.showToast('You have no bookings yet', 'info');
        } else {
            this.showToast(`You have ${userBookings.length} booking(s)`, 'success');
            this.showMyBookingsModal(userBookings);
        }
    }

    showMyBookingsModal(bookings) {
        const modalContent = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <div class="modal-title"><i class="fas fa-calendar-check"></i> My Bookings (${bookings.length})</div>
                    <button class="close-modal-btn">&times;</button>
                </div>
                <div style="max-height: 60vh; overflow-y: auto; padding: 10px;">
                    ${bookings.map(booking => `
                        <div style="background: var(--light); border-radius: 10px; padding: 12px; margin-bottom: 10px;">
                            <div style="font-weight: 600;">${this.escapeHtml(booking.serviceName || 'Service')}</div>
                            <div style="font-size: 0.8rem;">Date: ${booking.date || 'Not specified'}</div>
                            <div style="font-size: 0.8rem;">Status: <span style="color: ${booking.status === 'confirmed' ? '#27ae60' : '#f39c12'}">${booking.status || 'pending'}</span></div>
                            <div style="font-size: 0.7rem; color: #666;">Booked: ${new Date(booking.timestamp).toLocaleDateString()}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="form-actions" style="margin-top: 15px; padding: 10px;">
                    <button class="btn btn-outline close-modal-btn">Close</button>
                </div>
            </div>
        `;
        
        if (typeof window.showModalWithContent === 'function') {
            window.showModalWithContent('my-bookings-modal', modalContent);
        }
        
        setTimeout(() => {
            const closeBtn = document.querySelector('#my-bookings-modal .close-modal-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    if (typeof window.closeModal === 'function') window.closeModal('my-bookings-modal');
                });
            }
        }, 100);
    }

    openSettings() {
        if (typeof window.openMoreMenu === 'function') {
            window.openMoreMenu();
            setTimeout(() => {
                if (window.moreMenuManager && typeof window.moreMenuManager.switchMoreTab === 'function') {
                    window.moreMenuManager.switchMoreTab('settings');
                }
            }, 200);
        } else if (window.app && typeof window.app.openMoreMenu === 'function') {
            window.app.openMoreMenu();
            setTimeout(() => {
                if (window.moreMenuManager) window.moreMenuManager.switchMoreTab('settings');
            }, 200);
        }
    }

    async handleLoginFormSubmit(form) {
        const email = form.querySelector('#login-email')?.value;
        const password = form.querySelector('#login-password')?.value;

        if (!email || !password) {
            this.showToast('Please fill in all fields', 'error');
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.innerHTML = '<div class="spinner"></div> Signing In...';
        submitBtn.disabled = true;

        try {
            const result = await this.signInWithEmail(email, password);
            
            if (result.success) {
                this.showToast('✅ Signed in successfully!', 'success');
                this.forceCloseAllOverlays();
                this.closeAuthModal();
            } else {
                let errorMessage = result.error;
                if (errorMessage.includes('user-not-found')) {
                    errorMessage = 'No account found with this email';
                } else if (errorMessage.includes('wrong-password')) {
                    errorMessage = 'Incorrect password';
                } else if (errorMessage.includes('invalid-email')) {
                    errorMessage = 'Please enter a valid email address';
                }
                this.showToast('Login failed: ' + errorMessage, 'error');
            }
        } catch (error) {
            this.showToast('Login error: ' + error.message, 'error');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    async handleRegisterFormSubmit(form) {
        const email = form.querySelector('#register-email')?.value;
        const password = form.querySelector('#register-password')?.value;
        const confirmPassword = form.querySelector('#register-confirm-password')?.value;
        const displayName = form.querySelector('#register-name')?.value;
        const role = document.getElementById('user-role')?.value;

        if (!email || !password || !confirmPassword || !displayName) {
            this.showToast('Please fill in all fields', 'error');
            return;
        }

        if (password !== confirmPassword) {
            this.showToast('Passwords do not match', 'error');
            return;
        }

        if (password.length < 6) {
            this.showToast('Password must be at least 6 characters', 'error');
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.innerHTML = '<div class="spinner"></div> Creating Account...';
        submitBtn.disabled = true;

        try {
            const result = await this.registerWithEmail(email, password, displayName, role || 'general-user');
            
            if (result.success) {
                this.showToast(`🎉 Welcome to VikeServe, ${displayName}!`, 'success');
                this.forceCloseAllOverlays();
                this.closeAuthModal();
            } else {
                let errorMessage = result.error;
                if (errorMessage.includes('email-already-in-use')) {
                    errorMessage = 'Email already registered. Please sign in instead.';
                } else if (errorMessage.includes('weak-password')) {
                    errorMessage = 'Password is too weak. Use at least 6 characters with letters and numbers.';
                }
                this.showToast('Registration failed: ' + errorMessage, 'error');
            }
        } catch (error) {
            this.showToast('Registration error: ' + error.message, 'error');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    async registerWithEmail(email, password, displayName, role) {
        try {
            const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
            await userCredential.user.updateProfile({ displayName: displayName });
            
            await this.db.collection('users').doc(userCredential.user.uid).set({
                uid: userCredential.user.uid,
                email: email,
                displayName: displayName,
                role: role,
                photoURL: null,
                phoneNumber: null,
                location: null,
                bio: null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                stats: {
                    adsPosted: 0,
                    bookingsMade: 0,
                    servicesOffered: 0,
                    reviewsReceived: 0,
                    rating: 0
                }
            });
            
            return { success: true, user: userCredential.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async signInWithEmail(email, password) {
        try {
            const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
            await this.db.collection('users').doc(userCredential.user.uid).update({
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(() => {});
            return { success: true, user: userCredential.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async signInWithGoogle() {
        const isEmulator = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        if (isEmulator) {
            this.showToast('Google sign-in not available in development mode. Please use email sign-in.', 'warning');
            return { success: false };
        }
        
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const userCredential = await this.auth.signInWithPopup(provider);
            
            const userDoc = await this.db.collection('users').doc(userCredential.user.uid).get();
            if (!userDoc.exists) {
                await this.db.collection('users').doc(userCredential.user.uid).set({
                    uid: userCredential.user.uid,
                    email: userCredential.user.email,
                    displayName: userCredential.user.displayName,
                    photoURL: userCredential.user.photoURL,
                    role: 'general-user',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                    stats: { adsPosted: 0, bookingsMade: 0, servicesOffered: 0, reviewsReceived: 0, rating: 0 }
                });
            }
            
            this.showToast('✅ Signed in with Google!', 'success');
            this.closeAuthModal();
            this.forceCloseAllOverlays();
            return { success: true, user: userCredential.user };
        } catch (error) {
            this.showToast('Google sign-in failed: ' + error.message, 'error');
            return { success: false, error: error.message };
        }
    }

    async signInWithFacebook() {
        const isEmulator = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        if (isEmulator) {
            this.showToast('Facebook sign-in not available in development mode. Please use email sign-in.', 'warning');
            return { success: false };
        }
        
        try {
            const provider = new firebase.auth.FacebookAuthProvider();
            const userCredential = await this.auth.signInWithPopup(provider);
            
            const userDoc = await this.db.collection('users').doc(userCredential.user.uid).get();
            if (!userDoc.exists) {
                await this.db.collection('users').doc(userCredential.user.uid).set({
                    uid: userCredential.user.uid,
                    email: userCredential.user.email,
                    displayName: userCredential.user.displayName,
                    photoURL: userCredential.user.photoURL,
                    role: 'general-user',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                    stats: { adsPosted: 0, bookingsMade: 0, servicesOffered: 0, reviewsReceived: 0, rating: 0 }
                });
            }
            
            this.showToast('✅ Signed in with Facebook!', 'success');
            this.closeAuthModal();
            this.forceCloseAllOverlays();
            return { success: true, user: userCredential.user };
        } catch (error) {
            this.showToast('Facebook sign-in failed: ' + error.message, 'error');
            return { success: false, error: error.message };
        }
    }

    async signOut() {
        try {
            await this.auth.signOut();
            this.currentUser = null;
            this.userData = null;
            
            const userMenu = document.getElementById('user-menu');
            if (userMenu) userMenu.classList.remove('show');
            
            this.showToast('Signed out successfully', 'success');
            this.updateUIForGuest();
            
            return { success: true };
        } catch (error) {
            this.showToast('Sign out failed: ' + error.message, 'error');
            return { success: false, error: error.message };
        }
    }

    async resetPassword(email) {
        try {
            await this.auth.sendPasswordResetEmail(email);
            this.showToast('Password reset email sent! Check your inbox.', 'success');
            return { success: true };
        } catch (error) {
            this.showToast('Error: ' + error.message, 'error');
            return { success: false, error: error.message };
        }
    }

    forceCloseAllOverlays() {
        const moreSection = document.getElementById('more-section');
        if (moreSection) {
            moreSection.style.display = 'none';
            moreSection.classList.remove('active');
        }
        const mainBottomNav = document.querySelector('.bottom-nav');
        if (mainBottomNav) mainBottomNav.style.display = 'flex';
        const moreBottomNav = document.querySelector('.more-bottom-nav');
        if (moreBottomNav) moreBottomNav.style.display = 'none';
        const userMenu = document.getElementById('user-menu');
        if (userMenu) userMenu.classList.remove('show');
        document.body.style.overflow = '';
    }

    closeAuthModal() {
        const authModal = document.getElementById('auth-modal');
        if (authModal) {
            authModal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }

    setupRoleSelection() {
        const roleOptions = document.querySelectorAll('.role-option');
        const roleInput = document.getElementById('user-role');
        if (roleOptions.length > 0 && roleInput) {
            roleOptions.forEach(option => {
                const newOption = option.cloneNode(true);
                option.parentNode.replaceChild(newOption, option);
                newOption.addEventListener('click', function() {
                    roleOptions.forEach(opt => {
                        const existingOpt = document.querySelector(`.role-option[data-role="${opt.getAttribute('data-role')}"]`);
                        if (existingOpt) existingOpt.classList.remove('selected');
                    });
                    this.classList.add('selected');
                    roleInput.value = this.getAttribute('data-role');
                });
            });
        }
    }

    updateUIForAuthenticatedUser(user) {
        const userName = document.getElementById('user-name');
        const userEmail = document.getElementById('user-email');
        const userAvatar = document.getElementById('user-avatar');
        
        if (userName) userName.textContent = this.userData?.displayName || user.displayName || user.email;
        if (userEmail) userEmail.textContent = user.email;
        
        if (userAvatar) {
            if (user.photoURL) {
                userAvatar.innerHTML = `<img src="${user.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
            } else {
                const initial = (this.userData?.displayName || user.displayName || user.email || 'U').charAt(0).toUpperCase();
                userAvatar.innerHTML = `<span>${initial}</span>`;
                userAvatar.style.background = 'var(--primary)';
            }
        }
        
        const authButton = document.getElementById('auth-button');
        const profileButton = document.getElementById('profile-button');
        const logoutButton = document.getElementById('logout-button');
        const myAdsButton = document.getElementById('my-ads-button');
        const myBookingsButton = document.getElementById('my-bookings-button');
        
        if (authButton) authButton.style.display = 'none';
        if (profileButton) profileButton.style.display = 'flex';
        if (logoutButton) logoutButton.style.display = 'flex';
        if (myAdsButton) myAdsButton.style.display = 'flex';
        if (myBookingsButton) myBookingsButton.style.display = 'flex';
        
        const guestMessage = document.getElementById('guest-message');
        const authContent = document.getElementById('authenticated-content');
        if (guestMessage) guestMessage.style.display = 'none';
        if (authContent) authContent.style.display = 'block';
        
        const profileName = document.getElementById('profile-name');
        if (profileName) profileName.textContent = this.userData?.displayName || user.displayName || user.email;
        
        const profileAvatar = document.getElementById('profile-avatar');
        if (profileAvatar) {
            if (user.photoURL) {
                profileAvatar.innerHTML = `<img src="${user.photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
            } else {
                const initial = (this.userData?.displayName || user.displayName || user.email || 'U').charAt(0).toUpperCase();
                profileAvatar.innerHTML = `<span>${initial}</span>`;
                profileAvatar.style.background = 'var(--primary)';
            }
        }
        
        this.setupUserMenuButtons();
    }

    updateUIForGuest() {
        const userName = document.getElementById('user-name');
        const userEmail = document.getElementById('user-email');
        const userAvatar = document.getElementById('user-avatar');
        
        if (userName) userName.textContent = 'Guest User';
        if (userEmail) userEmail.textContent = 'Sign in to access all features';
        if (userAvatar) {
            userAvatar.innerHTML = '<i class="fas fa-user"></i>';
            userAvatar.style.background = 'var(--primary)';
        }
        
        const authButton = document.getElementById('auth-button');
        const profileButton = document.getElementById('profile-button');
        const logoutButton = document.getElementById('logout-button');
        const myAdsButton = document.getElementById('my-ads-button');
        const myBookingsButton = document.getElementById('my-bookings-button');
        
        if (authButton) authButton.style.display = 'flex';
        if (profileButton) profileButton.style.display = 'none';
        if (logoutButton) logoutButton.style.display = 'none';
        if (myAdsButton) myAdsButton.style.display = 'none';
        if (myBookingsButton) myBookingsButton.style.display = 'none';
        
        const guestMessage = document.getElementById('guest-message');
        const authContent = document.getElementById('authenticated-content');
        if (guestMessage) guestMessage.style.display = 'block';
        if (authContent) authContent.style.display = 'none';
        
        const profileName = document.getElementById('profile-name');
        if (profileName) profileName.textContent = 'Guest User';
        
        const profileAvatar = document.getElementById('profile-avatar');
        if (profileAvatar) {
            profileAvatar.innerHTML = '<i class="fas fa-user"></i>';
            profileAvatar.style.background = 'var(--primary)';
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showToast(message, type = 'info') {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        }
    }

    isAuthenticated() {
        return this.currentUser !== null;
    }

    getUserRole() {
        return this.userData?.role || 'guest';
    }
}

let authManager = null;

function showAuthModal() {
    if (typeof window.openAuthModal === 'function') {
        window.openAuthModal();
    } else {
        const authModal = document.getElementById('auth-modal');
        if (authModal) authModal.style.display = 'flex';
    }
}

function closeAuthModal() {
    const authModal = document.getElementById('auth-modal');
    if (authModal) {
        authModal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

async function signInWithGoogle() {
    if (authManager) {
        await authManager.signInWithGoogle();
    } else if (typeof window.showToast === 'function') {
        window.showToast('Authentication system not ready', 'error');
    }
}

async function signInWithFacebook() {
    if (authManager) {
        await authManager.signInWithFacebook();
    } else if (typeof window.showToast === 'function') {
        window.showToast('Authentication system not ready', 'error');
    }
}

function toggleAuthForm() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const switchText = document.getElementById('auth-switch-text');
    const switchLink = document.getElementById('auth-switch-link');
    
    if (loginForm && registerForm) {
        if (loginForm.style.display !== 'none') {
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
            if (switchText) switchText.textContent = 'Already have an account?';
            if (switchLink) switchLink.textContent = 'Sign In';
        } else {
            registerForm.style.display = 'none';
            loginForm.style.display = 'block';
            if (switchText) switchText.textContent = 'Don\'t have an account?';
            if (switchLink) switchLink.textContent = 'Sign Up';
        }
    }
}

function showForgotPassword() {
    const email = prompt('Enter your email address to reset password:');
    if (email && authManager) {
        authManager.resetPassword(email);
    }
}

async function logout() {
    if (authManager) {
        await authManager.signOut();
        const userMenu = document.getElementById('user-menu');
        if (userMenu) userMenu.classList.remove('show');
    } else if (typeof window.showToast === 'function') {
        window.showToast('Authentication system not ready', 'error');
    }
}

window.showAuthModal = showAuthModal;
window.closeAuthModal = closeAuthModal;
window.signInWithGoogle = signInWithGoogle;
window.signInWithFacebook = signInWithFacebook;
window.toggleAuthForm = toggleAuthForm;
window.showForgotPassword = showForgotPassword;
window.logout = logout;

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (typeof auth !== 'undefined' && auth) {
            authManager = new AuthManager();
            window.authManager = authManager;
        }
    }, 500);
});

function setupAuthModalButtons() {
    const attachClick = (selector, handler, name) => {
        const element = document.querySelector(selector);
        if (element) {
            const newElement = element.cloneNode(true);
            element.parentNode.replaceChild(newElement, element);
            newElement.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handler(e);
            });
            return true;
        }
        return false;
    };
    
    attachClick('#google-signin', () => signInWithGoogle(), 'Google sign in');
    attachClick('#facebook-signin', () => signInWithFacebook(), 'Facebook sign in');
    attachClick('#auth-switch-link', () => toggleAuthForm(), 'Auth switch link');
    attachClick('#forgot-password', () => showForgotPassword(), 'Forgot password');
    attachClick('#auth-modal .close-modal-btn', () => closeAuthModal(), 'Close modal button');
    
    const passwordToggles = document.querySelectorAll('.password-toggle');
    passwordToggles.forEach(toggle => {
        const newToggle = toggle.cloneNode(true);
        toggle.parentNode.replaceChild(newToggle, toggle);
        newToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const passwordInput = newToggle.parentElement.querySelector('input');
            if (passwordInput) {
                const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordInput.setAttribute('type', type);
                const icon = newToggle.querySelector('i');
                if (icon) {
                    icon.classList.toggle('fa-eye');
                    icon.classList.toggle('fa-eye-slash');
                }
            }
        });
    });
    
    const roleOptions = document.querySelectorAll('.role-option');
    roleOptions.forEach(option => {
        const newOption = option.cloneNode(true);
        option.parentNode.replaceChild(newOption, option);
        newOption.addEventListener('click', function() {
            document.querySelectorAll('.role-option').forEach(opt => {
                const existingOpt = document.querySelector(`.role-option[data-role="${opt.getAttribute('data-role')}"]`);
                if (existingOpt) existingOpt.classList.remove('selected');
            });
            this.classList.add('selected');
            const roleInput = document.getElementById('user-role');
            if (roleInput) roleInput.value = this.getAttribute('data-role');
        });
    });
}

window.openAuthModal = function() {
    const moreSection = document.getElementById('more-section');
    if (moreSection) {
        moreSection.style.display = 'none';
        moreSection.classList.remove('active');
    }
    
    const mainBottomNav = document.querySelector('.bottom-nav');
    if (mainBottomNav) mainBottomNav.style.display = 'flex';
    
    const moreBottomNav = document.querySelector('.more-bottom-nav');
    if (moreBottomNav) moreBottomNav.style.display = 'none';
    
    const authModal = document.getElementById('auth-modal');
    if (authModal) {
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const switchText = document.getElementById('auth-switch-text');
        const switchLink = document.getElementById('auth-switch-link');
        
        if (loginForm && registerForm) {
            loginForm.style.display = 'block';
            registerForm.style.display = 'none';
            if (switchText) switchText.textContent = 'Don\'t have an account?';
            if (switchLink) switchLink.textContent = 'Sign Up';
        }
        
        authModal.style.display = 'flex';
        authModal.style.zIndex = '100000';
        document.body.style.overflow = 'hidden';
    } else {
        if (typeof window.showToast === 'function') {
            window.showToast('Please refresh the page', 'error');
        }
    }
};

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        setupAuthModalButtons();
    }, 500);
});

document.addEventListener('click', function(e) {
    const userMenu = document.getElementById('user-menu');
    const userProfile = document.getElementById('user-profile');
    
    if (userMenu && userMenu.classList.contains('show')) {
        const clickedInsideMenu = userMenu.contains(e.target);
        const clickedProfile = userProfile && userProfile.contains(e.target);
        
        if (!clickedInsideMenu && !clickedProfile) {
            userMenu.classList.remove('show');
        }
    }
});