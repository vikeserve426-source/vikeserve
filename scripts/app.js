// ========================================
// FIXED: VikeServe App - No More Blank Page
// ========================================

(function() {
    // Safe wrapper for window functions
    window.switchTab = function(tabId) {
        if (window.app && typeof window.app.switchTab === 'function') {
            window.app.switchTab(tabId);
        } else {
            window._pendingTabSwitch = tabId;
        }
    };
    
    window.openMoreMenu = function() {
        if (window.app && typeof window.app.openMoreMenu === 'function') {
            window.app.openMoreMenu();
        } else {
            window._pendingMoreMenu = true;
        }
    };
    
    window.closeMoreMenu = function() {
        if (window.app && typeof window.app.closeMoreMenu === 'function') {
            window.app.closeMoreMenu();
        } else {
            window._pendingCloseMoreMenu = true;
        }
    };
    
    window.getCurrentLocation = function() {
        if (window.app && typeof window.app.getCurrentLocation === 'function') {
            return window.app.getCurrentLocation();
        }
        return { country: '', state: '', city: '', fullAddress: '' };
    };
    
    // FIXED: Don't override showToast if it already exists
    if (typeof window.showToast !== 'function') {
        window.showToast = function(msg, type, duration = 3000) {
            console.log(`${type}: ${msg}`);
            
            let toast = document.getElementById('toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'toast';
                toast.className = 'toast';
                document.body.appendChild(toast);
            }
            
            if (window._toastTimeout) clearTimeout(window._toastTimeout);
            
            let icon = 'fa-info-circle';
            if (type === 'success') icon = 'fa-check-circle';
            else if (type === 'error') icon = 'fa-exclamation-circle';
            else if (type === 'warning') icon = 'fa-exclamation-triangle';
            
            toast.innerHTML = `<i class="fas ${icon}"></i><div class="toast-message">${msg}</div>`;
            toast.className = `toast toast-${type}`;
            toast.classList.add('show');
            
            window._toastTimeout = setTimeout(() => {
                toast.classList.remove('show');
            }, duration);
        };
    }
})();

// ========================================
// MAIN APP CLASS
// ========================================

class VikeServeApp {
    constructor() {
        this.currentUser = null;
        this.currentTab = 'home-tab';
        this.currentLocation = {
            country: '',
            state: '',
            city: '',
            fullAddress: ''
        };
        this.timeouts = [];
        this.isInitialized = false;
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        // Prevent double initialization
        if (this.isInitialized) return;
        this.isInitialized = true;
        
        console.log('🚀 VikeServe App Initializing...');
        
        // Wait for Firebase to be ready
        await this.waitForFirebase();
        
        this.applyGlobalFixes();
        this.setupEventListeners();
        this.setupCloseButtons();
        this.setupNavigation();
        this.setupQuickActions();
        this.setupSettings();
        this.initLocationSystem();
        this.checkAuthState();
        
        // Load data with proper error handling
        try {
            await this.loadStatsCounts();
        } catch (e) {
            console.warn('Stats loading failed, using defaults:', e);
        }
        
        this.loadInitialData();
        this.ensureMoreMenuConnection();
        this.setupAdPromotionButtons();
        this.setupFeatureToggles();
        this.handleInitialTabFromURL();
        
        console.log('✅ VikeServe App Initialized Successfully!');
        
        // Show the app is working
        this.showAppReady();
    }
    
    // ========== WAIT FOR FIREBASE ==========
    async waitForFirebase() {
        console.log('⏳ Waiting for Firebase...');
        
        let attempts = 0;
        const maxAttempts = 30;
        
        while (attempts < maxAttempts) {
            if (typeof firebase !== 'undefined' && firebase.firestore) {
                console.log('✅ Firebase is ready!');
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
        }
        
        console.error('❌ Firebase failed to load after 6 seconds');
        this.showError('Firebase not loaded. Please check your internet connection and try again.');
        return false;
    }
    
    // ========== SHOW APP READY ==========
    showAppReady() {
        const container = document.querySelector('.container');
        if (container && !document.getElementById('app-ready-badge')) {
            const badge = document.createElement('div');
            badge.id = 'app-ready-badge';
            badge.style.cssText = `
                position: fixed;
                bottom: 70px;
                right: 10px;
                background: #00c853;
                color: white;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 10px;
                font-weight: bold;
                z-index: 999;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                display: none;
            `;
            badge.innerHTML = '✅ App Ready';
            document.body.appendChild(badge);
            
            // Auto-hide after 3 seconds
            setTimeout(() => {
                badge.style.display = 'none';
            }, 3000);
        }
    }
    
    // ========== SHOW ERROR ==========
    showError(message) {
        const container = document.querySelector('.container');
        if (container) {
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                background: #ff1744;
                color: white;
                padding: 15px;
                margin: 10px;
                border-radius: 8px;
                text-align: center;
                font-weight: bold;
                position: fixed;
                top: 10px;
                left: 10px;
                right: 10px;
                z-index: 10000;
                box-shadow: 0 4px 12px rgba(255,23,68,0.3);
            `;
            errorDiv.textContent = '⚠️ ' + message;
            document.body.prepend(errorDiv);
            
            // Auto-hide after 10 seconds
            setTimeout(() => {
                errorDiv.style.opacity = '0';
                errorDiv.style.transition = 'opacity 0.5s';
                setTimeout(() => errorDiv.remove(), 500);
            }, 10000);
        }
    }

    // ========== LOAD STATS COUNTS (FIXED) ==========
    async loadStatsCounts() {
        try {
            console.log('📊 Loading stats...');
            
            // Check if Firebase is ready
            if (typeof firebase === 'undefined' || !firebase.firestore) {
                console.warn('Firebase not ready for stats');
                this.setDefaultStats();
                return;
            }
            
            let isFounder = false;
            let userRole = 'user';
            
            if (this.currentUser) {
                try {
                    const userDoc = await firebase.firestore()
                        .collection('users')
                        .doc(this.currentUser.uid)
                        .get();
                    if (userDoc.exists) {
                        userRole = userDoc.data().role || 'user';
                        isFounder = userRole === 'founder';
                    }
                } catch (e) {
                    console.warn('Could not fetch user role:', e);
                }
            }
            
            // Use Promise.all for parallel loading
            const [
                servicesSnapshot,
                workersSnapshot,
                marketplaceSnapshot,
                bookingsSnapshot,
                reviewsSnapshot,
                totalUsersSnapshot
            ] = await Promise.all([
                firebase.firestore().collection('services').where('status', '==', 'active').get().catch(() => ({ size: 0 })),
                firebase.firestore().collection('users').where('role', 'in', ['service_provider', 'verified', 'provider']).get().catch(() => ({ size: 0 })),
                firebase.firestore().collection('marketplace_items').where('status', '==', 'active').get().catch(() => ({ size: 0 })),
                firebase.firestore().collection('bookings').get().catch(() => ({ size: 0 })),
                firebase.firestore().collection('reviews').get().catch(() => ({ size: 0 })),
                isFounder ? firebase.firestore().collection('users').get().catch(() => ({ size: 0 })) : Promise.resolve({ size: 0 })
            ]);
            
            const activeServices = servicesSnapshot.size || 0;
            let verifiedWorkers = workersSnapshot.size || 0;
            
            if (verifiedWorkers === 0) {
                const allUsersSnapshot = await firebase.firestore().collection('users').get().catch(() => ({ size: 0 }));
                verifiedWorkers = allUsersSnapshot.size || 0;
            }
            
            const totalUsers = isFounder ? (totalUsersSnapshot.size || 0) : 0;
            const marketplaceItems = marketplaceSnapshot.size || 0;
            const totalBookings = bookingsSnapshot.size || 0;
            const totalReviews = reviewsSnapshot.size || 0;
            
            // Update stats elements
            const statsElements = {
                'active-jobs-count': activeServices,
                'verified-workers-count': verifiedWorkers,
                'marketplace-items-count': marketplaceItems,
                'total-bookings-count': totalBookings,
                'reviews-count': totalReviews
            };
            
            if (isFounder) {
                statsElements['total-users-count'] = totalUsers;
            }
            
            Object.entries(statsElements).forEach(([id, value]) => {
                const el = document.getElementById(id);
                if (el) {
                    el.textContent = value;
                    el.style.display = 'block';
                }
            });
            
            // Handle total users visibility
            const totalUsersContainer = document.getElementById('total-users-count')?.closest('.stat-card');
            if (totalUsersContainer) {
                totalUsersContainer.style.display = isFounder ? 'block' : 'none';
            }
            
            console.log(`📊 Stats loaded: ${activeServices} jobs, ${verifiedWorkers} workers, ${isFounder ? totalUsers : 'hidden'} users`);
            return { activeServices, verifiedWorkers, totalUsers, marketplaceItems, totalBookings, totalReviews };
            
        } catch (error) {
            console.error('Error loading stats:', error);
            this.setDefaultStats();
            return { activeServices: 0, verifiedWorkers: 0, totalUsers: 0, marketplaceItems: 0, totalBookings: 0, totalReviews: 0 };
        }
    }
    
    setDefaultStats() {
        const ids = ['active-jobs-count', 'verified-workers-count', 'marketplace-items-count', 'total-bookings-count', 'reviews-count'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '0';
        });
        const totalUsersContainer = document.getElementById('total-users-count')?.closest('.stat-card');
        if (totalUsersContainer) totalUsersContainer.style.display = 'none';
    }

    // ========== HANDLE INITIAL TAB ==========
    handleInitialTabFromURL() {
        const hash = window.location.hash.substring(1);
        if (hash && ['home-tab', 'services-tab', 'marketplace-tab', 'account-tab'].includes(hash)) {
            setTimeout(() => {
                this.switchTab(hash);
            }, 100);
        }
    }

    // ========== UPDATE URL HASH ==========
    updateURLHash(tabId) {
        if (tabId && tabId !== 'more-tab') {
            window.location.hash = tabId;
        }
    }

    // ========== SETUP NAVIGATION ==========
    setupNavigation() {
        const navItems = document.querySelectorAll('.bottom-nav .nav-item');
        
        navItems.forEach((item) => {
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);
            
            newItem.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const tabId = newItem.getAttribute('data-tab');
                
                if (!tabId) return;
                
                if (tabId === 'more-tab') {
                    this.openMoreMenu();
                    return;
                }
                
                this.closeMoreMenu();
                this.switchTab(tabId);
                this.updateURLHash(tabId);
            });
        });
    }

    // ========== SWITCH TAB ==========
    switchTab(tabId) {
        console.log('🔄 Switching to tab:', tabId);
        this.currentTab = tabId;
        
        // Update bottom nav
        document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
            item.classList.remove('active');
        });
        const activeNav = document.querySelector(`.bottom-nav .nav-item[data-tab="${tabId}"]`);
        if (activeNav) {
            activeNav.classList.add('active');
        }
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const targetTab = document.getElementById(tabId);
        if (targetTab) {
            targetTab.classList.add('active');
            this.loadTabContent(tabId);
            console.log('✅ Tab activated:', tabId);
        } else {
            console.warn('⚠️ Tab not found:', tabId);
        }
        
        // Close any open menus
        const userMenu = document.getElementById('user-menu');
        if (userMenu) {
            userMenu.classList.remove('show');
        }
        
        if (tabId !== 'more-tab') {
            this.closeMoreMenu();
        }
        
        window.dispatchEvent(new CustomEvent('tabChanged', { 
            detail: { tabId: tabId } 
        }));
    }

    // ========== OPEN MORE MENU ==========
    openMoreMenu() {
        console.log('🔓 Opening More Menu...');
        
        const moreSection = document.getElementById('more-section');
        const overlay = document.getElementById('more-overlay');
        const mainNav = document.querySelector('.bottom-nav');
        const moreBottomNav = document.querySelector('.more-bottom-nav');
        
        if (overlay) {
            overlay.style.display = 'block';
            setTimeout(() => {
                overlay.classList.add('active');
            }, 10);
        }
        
        if (moreSection) {
            moreSection.style.display = 'flex';
            setTimeout(() => {
                moreSection.classList.add('active');
            }, 10);
        }
        
        if (mainNav) mainNav.style.display = 'none';
        if (moreBottomNav) moreBottomNav.style.display = 'flex';
        
        document.body.classList.add('more-open');
        
        document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
            item.classList.remove('active');
        });
        const moreNav = document.querySelector('.bottom-nav .nav-item[data-tab="more-tab"]');
        if (moreNav) moreNav.classList.add('active');
        
        if (window.moreMenuManager && typeof window.moreMenuManager.onMenuOpen === 'function') {
            window.moreMenuManager.onMenuOpen();
        }
    }

    // ========== CLOSE MORE MENU ==========
    closeMoreMenu() {
        console.log('🔒 Closing More Menu...');
        
        const moreSection = document.getElementById('more-section');
        const overlay = document.getElementById('more-overlay');
        const mainNav = document.querySelector('.bottom-nav');
        const moreBottomNav = document.querySelector('.more-bottom-nav');
        
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 300);
        }
        
        if (moreSection) {
            moreSection.classList.remove('active');
            setTimeout(() => {
                moreSection.style.display = 'none';
            }, 300);
        }
        
        if (mainNav) mainNav.style.display = 'flex';
        if (moreBottomNav) moreBottomNav.style.display = 'none';
        
        document.body.classList.remove('more-open');
        
        if (window.moreMenuManager && typeof window.moreMenuManager.onMenuClose === 'function') {
            window.moreMenuManager.onMenuClose();
        }
    }

    // ========== ENSURE MORE MENU CONNECTION ==========
    ensureMoreMenuConnection() {
        const timeoutId = setTimeout(() => {
            if (window.moreMenuManager) {
                if (this.currentTab === 'more-tab') {
                    this.openMoreMenu();
                }
            }
        }, 500);
        this.timeouts.push(timeoutId);
    }

    // ========== APPLY GLOBAL FIXES ==========
    applyGlobalFixes() {
        const modalsToMove = [];
        
        const fixModals = () => {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                if (modal.parentElement && modal.parentElement.id === 'more-section') {
                    modalsToMove.push({
                        modal: modal,
                        originalParent: modal.parentElement
                    });
                    document.body.appendChild(modal);
                }
            });
        };
        
        const restoreModals = () => {
            modalsToMove.forEach(item => {
                if (item.originalParent && item.originalParent.contains(item.modal)) {
                    item.originalParent.appendChild(item.modal);
                }
            });
        };
        
        const fixBottomNav = () => {
            const nav = document.querySelector('.bottom-nav');
            if (nav) {
                nav.style.position = 'fixed';
                nav.style.bottom = '0';
                nav.style.left = '50%';
                nav.style.transform = 'translateX(-50%)';
                nav.style.width = '100%';
                nav.style.maxWidth = '480px';
            }
        };
        
        const timeoutId1 = setTimeout(fixModals, 100);
        const timeoutId2 = setTimeout(fixBottomNav, 100);
        this.timeouts.push(timeoutId1, timeoutId2);
        
        window.addEventListener('resize', fixBottomNav);
        this.cleanupModals = restoreModals;
    }

    // ========== LOCATION SYSTEM ==========
    initLocationSystem() {
        this.loadSavedLocation();
        this.setupLocationSelector();
    }

    loadSavedLocation() {
        try {
            const saved = localStorage.getItem('vikeserve_location');
            if (saved) {
                this.currentLocation = JSON.parse(saved);
                this.updateLocationDisplay();
                return true;
            }
        } catch(e) {}
        
        this.currentLocation = { country: '', state: '', city: '', fullAddress: '' };
        this.updateLocationDisplay();
        return false;
    }

    saveLocationToStorage() {
        localStorage.setItem('vikeserve_location', JSON.stringify(this.currentLocation));
    }

    updateLocationDisplay() {
        const locationSpan = document.getElementById('location-name');
        if (locationSpan) {
            locationSpan.textContent = this.getLocationDisplayText() || 'Select Location';
        }
    }

    getLocationDisplayText() {
        if (this.currentLocation.city && this.currentLocation.state) {
            return `${this.currentLocation.city}, ${this.currentLocation.state}`;
        } else if (this.currentLocation.city) {
            return this.currentLocation.city;
        } else if (this.currentLocation.state) {
            return this.currentLocation.state;
        } else if (this.currentLocation.country) {
            return this.currentLocation.country;
        }
        return '';
    }

    getFullAddress() {
        const parts = [];
        if (this.currentLocation.city) parts.push(this.currentLocation.city);
        if (this.currentLocation.state) parts.push(this.currentLocation.state);
        if (this.currentLocation.country) parts.push(this.currentLocation.country);
        return parts.join(', ');
    }

    getCurrentLocation() {
        return { ...this.currentLocation };
    }

    setupLocationSelector() {
        const locationSelector = document.getElementById('location-selector');
        if (locationSelector) {
            const newSelector = locationSelector.cloneNode(true);
            locationSelector.parentNode.replaceChild(newSelector, locationSelector);
            newSelector.addEventListener('click', () => this.openLocationModal());
        }
    }

    // ========== OPEN LOCATION MODAL (SIMPLIFIED) ==========
    openLocationModal() {
        // Simple modal opening - use existing modal system
        const modal = document.getElementById('location-modal') || this.createLocationModal();
        modal.style.display = 'flex';
        
        // Populate fields
        setTimeout(() => {
            const countryInput = document.getElementById('location-country-input');
            const stateInput = document.getElementById('location-state-input');
            const cityInput = document.getElementById('location-city-input');
            
            if (countryInput) countryInput.value = this.currentLocation.country || '';
            if (stateInput) stateInput.value = this.currentLocation.state || '';
            if (cityInput) cityInput.value = this.currentLocation.city || '';
        }, 100);
    }
    
    createLocationModal() {
        const modal = document.createElement('div');
        modal.id = 'location-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <div class="modal-title"><i class="fas fa-map-marker-alt"></i> Select Your Location</div>
                    <button class="close-modal-btn">&times;</button>
                </div>
                <div style="padding: 20px;">
                    <div class="form-group">
                        <label class="form-label">Country <span style="color: var(--danger);">*</span></label>
                        <input type="text" id="location-country-input" class="form-input" placeholder="e.g., Kenya">
                    </div>
                    <div class="form-group">
                        <label class="form-label">County / State / Region</label>
                        <input type="text" id="location-state-input" class="form-input" placeholder="e.g., Nairobi">
                    </div>
                    <div class="form-group">
                        <label class="form-label">City / Town / Ward</label>
                        <input type="text" id="location-city-input" class="form-input" placeholder="e.g., Westlands">
                    </div>
                    <div class="form-actions" style="display: flex; gap: 10px; margin-top: 20px;">
                        <button class="btn btn-outline" id="cancel-location-btn">Cancel</button>
                        <button class="btn btn-primary" id="save-location-btn"><i class="fas fa-save"></i> Save Location</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Setup event listeners
        modal.querySelector('.close-modal-btn').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        document.getElementById('save-location-btn').addEventListener('click', () => {
            this.saveManualLocation();
        });
        
        document.getElementById('cancel-location-btn').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
        
        return modal;
    }

    saveManualLocation() {
        const country = document.getElementById('location-country-input')?.value.trim();
        const state = document.getElementById('location-state-input')?.value.trim();
        const city = document.getElementById('location-city-input')?.value.trim();
        
        if (!country) {
            window.showToast('Please enter your country', 'warning');
            return;
        }
        
        this.currentLocation = {
            country: country,
            state: state || '',
            city: city || '',
            fullAddress: this.getFullAddress()
        };
        
        this.saveLocationToStorage();
        this.updateLocationDisplay();
        
        const modal = document.getElementById('location-modal');
        if (modal) modal.style.display = 'none';
        
        window.showToast(`📍 Location set to ${this.getLocationDisplayText() || country}`, 'success');
        window.dispatchEvent(new CustomEvent('locationUpdated', { detail: this.currentLocation }));
    }

    // ========== SETUP QUICK ACTIONS ==========
    setupQuickActions() {
        const quickActions = document.querySelectorAll('.quick-action');
        
        quickActions.forEach(action => {
            const newAction = action.cloneNode(true);
            action.parentNode.replaceChild(newAction, action);
            
            const actionType = newAction.getAttribute('data-action');
            
            newAction.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (typeof window.quickActionsManager?.handleQuickAction === 'function') {
                    window.quickActionsManager.handleQuickAction(actionType);
                } else if (typeof window.showToast === 'function') {
                    window.showToast(`Opening ${actionType} services`, 'info');
                    this.switchTab('services-tab');
                }
            });
        });
    }

    // ========== SETUP SETTINGS ==========
    setupSettings() {
        const savedDarkMode = localStorage.getItem('darkMode');
        if (savedDarkMode === 'enabled') {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    }

    // ========== CHECK AUTH STATE ==========
    checkAuthState() {
        if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().onAuthStateChanged(async (user) => {
                this.currentUser = user;
                this.updateUIForAuthState();
                
                if (user) {
                    setTimeout(() => this.loadStatsCounts(), 500);
                }
                
                if (user && window.pendingPromotionCallback) {
                    const callback = window.pendingPromotionCallback;
                    window.pendingPromotionCallback = null;
                    if (typeof callback === 'function') {
                        callback();
                    }
                }
            });
        }
    }

    // ========== UPDATE UI FOR AUTH STATE ==========
    updateUIForAuthState() {
        const isLoggedIn = !!this.currentUser;
        
        const authBtn = document.getElementById('auth-button');
        const profileBtn = document.getElementById('profile-button');
        const logoutBtn = document.getElementById('logout-button');
        
        if (authBtn) authBtn.style.display = isLoggedIn ? 'none' : 'flex';
        if (profileBtn) profileBtn.style.display = isLoggedIn ? 'flex' : 'none';
        if (logoutBtn) logoutBtn.style.display = isLoggedIn ? 'flex' : 'none';
        
        const guestMessage = document.getElementById('guest-message');
        const authContent = document.getElementById('authenticated-content');
        
        if (guestMessage) guestMessage.style.display = isLoggedIn ? 'none' : 'block';
        if (authContent) authContent.style.display = isLoggedIn ? 'block' : 'none';
        
        if (isLoggedIn) {
            this.updateFounderBodyClass();
        } else {
            document.body.classList.remove('founder');
        }
    }
    
    // ========== UPDATE FOUNDER BODY CLASS ==========
    async updateFounderBodyClass() {
        if (!this.currentUser) {
            document.body.classList.remove('founder');
            return;
        }
        
        try {
            const userDoc = await firebase.firestore()
                .collection('users')
                .doc(this.currentUser.uid)
                .get();
            if (userDoc.exists) {
                const role = userDoc.data().role || 'user';
                if (role === 'founder') {
                    document.body.classList.add('founder');
                } else {
                    document.body.classList.remove('founder');
                }
            }
        } catch (error) {
            console.error('Error updating founder body class:', error);
        }
    }
    
    // ========== CHECK IF USER IS FOUNDER ==========
    async isUserFounder() {
        if (!this.currentUser) return false;
        
        try {
            const userDoc = await firebase.firestore()
                .collection('users')
                .doc(this.currentUser.uid)
                .get();
            if (userDoc.exists) {
                return userDoc.data().role === 'founder';
            }
            return false;
        } catch (error) {
            console.error('Error checking founder status:', error);
            return false;
        }
    }

    // ========== LOAD INITIAL DATA ==========
    loadInitialData() {
        if (typeof window.loadUrgentJobs === 'function') {
            setTimeout(() => window.loadUrgentJobs(), 500);
        }
        if (typeof window.loadMarketplaceItems === 'function') {
            setTimeout(() => window.loadMarketplaceItems('all'), 1000);
        }
    }

    // ========== LOAD TAB CONTENT ==========
    loadTabContent(tabId) {
        switch(tabId) {
            case 'home-tab':
                if (typeof window.loadUrgentJobs === 'function') window.loadUrgentJobs();
                break;
            case 'services-tab':
                if (typeof window.loadServices === 'function') window.loadServices();
                break;
            case 'marketplace-tab':
                if (typeof window.loadMarketplaceItems === 'function') window.loadMarketplaceItems('all');
                break;
            default:
                break;
        }
    }

    // ========== SETUP EVENT LISTENERS ==========
    setupEventListeners() {
        // Close modals on background click
        window.addEventListener('click', (e) => {
            if (e.target.classList && e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
                document.body.style.overflow = '';
            }
        });
        
        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal').forEach(modal => {
                    modal.style.display = 'none';
                });
                this.closeMoreMenu();
                document.body.style.overflow = '';
            }
        });
        
        // User profile click
        const userProfile = document.getElementById('user-profile');
        if (userProfile) {
            const newUserProfile = userProfile.cloneNode(true);
            userProfile.parentNode.replaceChild(newUserProfile, userProfile);
            
            newUserProfile.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🖱️ User profile clicked');
                
                const isLoggedIn = this.currentUser !== null;
                
                if (!isLoggedIn) {
                    console.log('🔓 User not logged in, opening auth modal');
                    if (typeof window.openAuthModal === 'function') {
                        window.openAuthModal();
                    } else if (typeof window.showAuthModal === 'function') {
                        window.showAuthModal();
                    } else {
                        const authModal = document.getElementById('auth-modal');
                        if (authModal) authModal.style.display = 'flex';
                    }
                } else {
                    console.log('👤 User logged in, toggling user menu');
                    this.toggleUserMenu();
                }
            });
        }
        
        // Close user menu on outside click
        document.addEventListener('click', (e) => {
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
        
        // More menu close button
        const moreCloseBtn = document.querySelector('.more-close');
        if (moreCloseBtn) {
            const newMoreCloseBtn = moreCloseBtn.cloneNode(true);
            moreCloseBtn.parentNode.replaceChild(newMoreCloseBtn, moreCloseBtn);
            newMoreCloseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🖱️ More menu close clicked');
                this.closeMoreMenu();
            });
        }

        // Home tab search
        const homeSearchInput = document.querySelector('#home-tab .search-input');
        if (homeSearchInput) {
            const newInput = homeSearchInput.cloneNode(true);
            homeSearchInput.parentNode.replaceChild(newInput, homeSearchInput);
            
            let timeout;
            newInput.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    const value = e.target.value;
                    if (window.search && typeof window.search.handleSearch === 'function') {
                        window.search.handleSearch(value);
                    }
                }, 300);
            });
        }
    }

    // ========== SETUP CLOSE BUTTONS ==========
    setupCloseButtons() {
        console.log('🔧 Setting up global close buttons...');
        
        document.querySelectorAll('.close-modal-btn').forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const modal = this.closest('.modal');
                if (modal) {
                    modal.style.display = 'none';
                    document.body.style.overflow = '';
                    console.log('✅ Modal closed:', modal.id);
                }
            });
        });
        
        document.querySelectorAll('.modal').forEach(modal => {
            const newModal = modal.cloneNode(true);
            modal.parentNode.replaceChild(newModal, modal);
            newModal.addEventListener('click', function(e) {
                if (e.target === this) {
                    this.style.display = 'none';
                    document.body.style.overflow = '';
                    console.log('✅ Modal closed by background click:', this.id);
                }
            });
        });
    }

    // ========== TOGGLE USER MENU ==========
    toggleUserMenu() {
        const userMenu = document.getElementById('user-menu');
        if (userMenu) {
            userMenu.classList.toggle('show');
            console.log('🔄 User menu toggled:', userMenu.classList.contains('show') ? 'open' : 'closed');
        } else {
            console.error('❌ User menu element not found');
        }
    }

    // ========== SETUP AD PROMOTION BUTTONS ==========
    setupAdPromotionButtons() {
        const handlePromotionClick = () => {
            if (!this.currentUser) {
                if (typeof window.showAuthModal === 'function') {
                    window.showAuthModal();
                    window.pendingPromotionCallback = () => {
                        if (typeof window.showAdPackagesModal === 'function') {
                            window.showAdPackagesModal();
                        }
                    };
                } else if (typeof window.openAuthModal === 'function') {
                    window.openAuthModal();
                    window.pendingPromotionCallback = () => {
                        if (typeof window.showAdPackagesModal === 'function') {
                            window.showAdPackagesModal();
                        }
                    };
                } else {
                    const authModal = document.getElementById('auth-modal');
                    if (authModal) authModal.style.display = 'flex';
                }
            } else {
                if (typeof window.showAdPackagesModal === 'function') {
                    window.showAdPackagesModal();
                } else if (typeof window.getPaymentSystem === 'function') {
                    const ps = window.getPaymentSystem();
                    ps.showAdPackagesModal();
                }
            }
        };
        
        const viewPackagesBtn = document.getElementById('view-packages-btn');
        if (viewPackagesBtn) {
            const newBtn = viewPackagesBtn.cloneNode(true);
            viewPackagesBtn.parentNode.replaceChild(newBtn, viewPackagesBtn);
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handlePromotionClick();
            });
        }
        
        const postAdBtn = document.getElementById('post-ad-btn');
        if (postAdBtn) {
            const newBtn = postAdBtn.cloneNode(true);
            postAdBtn.parentNode.replaceChild(newBtn, postAdBtn);
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handlePromotionClick();
            });
        }
    }

    // ========== SETUP FEATURE TOGGLES ==========
    setupFeatureToggles() {
        window.addEventListener('remoteConfigReady', () => {
            this.applyFeatureToggles();
        });
        
        setTimeout(() => {
            this.applyFeatureToggles();
        }, 500);
        
        document.addEventListener('tabChanged', () => {
            setTimeout(() => this.applyFeatureToggles(), 100);
        });
    }

    // ========== APPLY FEATURE TOGGLES ==========
    applyFeatureToggles() {
        const isFeatureEnabled = typeof window.isFeatureEnabled === 'function' 
            ? window.isFeatureEnabled 
            : () => false;
        
        try {
            const isAdPromotionEnabled = isFeatureEnabled('feature_adPromotion');
            const isWifiConnectEnabled = isFeatureEnabled('feature_wifiConnect');
            const showComingSoon = isFeatureEnabled('feature_showComingSoon');
            
            console.log('🔧 Feature Toggles - Ad Promotion:', isAdPromotionEnabled, 'WiFi Connect:', isWifiConnectEnabled);
            
            const promoteButtons = document.querySelectorAll(
                '.ad-cta, .btn-promote, .promote-service-btn, .promote-ad-btn, #view-packages-btn, #post-ad-btn'
            );
            
            promoteButtons.forEach(el => {
                if (!isAdPromotionEnabled) {
                    el.disabled = true;
                    el.style.opacity = '0.5';
                    el.style.cursor = 'not-allowed';
                    el.style.pointerEvents = 'none';
                    
                    if (showComingSoon && !el.querySelector('.coming-soon-badge')) {
                        const badge = document.createElement('span');
                        badge.className = 'coming-soon-badge';
                        badge.textContent = '🔒 Coming Soon';
                        badge.style.cssText = `
                            position: absolute;
                            top: -10px;
                            right: -8px;
                            background: #ff9800;
                            color: white;
                            font-size: 0.55rem;
                            padding: 2px 8px;
                            border-radius: 10px;
                            font-weight: bold;
                            white-space: nowrap;
                            z-index: 10;
                        `;
                        el.appendChild(badge);
                    }
                } else {
                    el.disabled = false;
                    el.style.opacity = '1';
                    el.style.cursor = 'pointer';
                    el.style.pointerEvents = 'auto';
                    const badge = el.querySelector('.coming-soon-badge');
                    if (badge) badge.remove();
                }
            });
            
            const wifiAction = document.querySelector('.quick-action[data-action="wifi"]');
            if (wifiAction) {
                if (!isWifiConnectEnabled) {
                    wifiAction.style.opacity = '0.6';
                    wifiAction.style.cursor = 'not-allowed';
                    wifiAction.style.pointerEvents = 'none';
                } else {
                    wifiAction.style.opacity = '1';
                    wifiAction.style.cursor = 'pointer';
                    wifiAction.style.pointerEvents = 'auto';
                }
            }
        } catch (error) {
            console.warn('⚠️ Error applying feature toggles:', error);
        }
    }

    // ========== DESTROY ==========
    destroy() {
        this.timeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.timeouts = [];
        
        if (typeof this.cleanupModals === 'function') {
            this.cleanupModals();
        }
        
        console.log('App destroyed, cleaned up timeouts and listeners');
    }
}

// ========================================
// MODAL BUTTON HANDLERS
// ========================================

function setupAllModalHandlers() {
    console.log('🔧 Setting up ALL modal button handlers...');
    
    // Services Tab
    const serviceBtn = document.getElementById('service-post-btn');
    if (serviceBtn) {
        const newBtn = serviceBtn.cloneNode(true);
        serviceBtn.parentNode.replaceChild(newBtn, serviceBtn);
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🖱️ Service post button clicked');
            if (typeof window.showServicePostModal === 'function') {
                window.showServicePostModal();
            } else {
                console.error('❌ showServicePostModal not found');
                if (typeof window.showToast === 'function') {
                    window.showToast('Service form not available', 'error');
                }
            }
        });
    }
    
    const jobBtn = document.getElementById('job-post-btn');
    if (jobBtn) {
        const newBtn = jobBtn.cloneNode(true);
        jobBtn.parentNode.replaceChild(newBtn, jobBtn);
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🖱️ Job post button clicked');
            if (typeof window.showJobPostModal === 'function') {
                window.showJobPostModal();
            } else {
                console.error('❌ showJobPostModal not found');
                if (typeof window.showToast === 'function') {
                    window.showToast('Job form not available', 'error');
                }
            }
        });
    }
    
    // Marketplace Tab
    const marketBtn = document.getElementById('marketplace-post-btn');
    if (marketBtn) {
        const newBtn = marketBtn.cloneNode(true);
        marketBtn.parentNode.replaceChild(newBtn, marketBtn);
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🖱️ Marketplace post button clicked');
            if (typeof window.showMarketplacePostModal === 'function') {
                window.showMarketplacePostModal();
            } else {
                console.error('❌ showMarketplacePostModal not found');
                if (typeof window.showToast === 'function') {
                    window.showToast('Marketplace form not available', 'error');
                }
            }
        });
    }
    
    const gasBtn = document.getElementById('gas-refill-post-btn');
    if (gasBtn) {
        const newBtn = gasBtn.cloneNode(true);
        gasBtn.parentNode.replaceChild(newBtn, gasBtn);
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🖱️ Gas refill button clicked');
            if (typeof window.showGasRefillPostModal === 'function') {
                window.showGasRefillPostModal();
            }
        });
    }
    
    const waterBtn = document.getElementById('water-delivery-post-btn');
    if (waterBtn) {
        const newBtn = waterBtn.cloneNode(true);
        waterBtn.parentNode.replaceChild(newBtn, waterBtn);
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🖱️ Water delivery button clicked');
            if (typeof window.showWaterDeliveryPostModal === 'function') {
                window.showWaterDeliveryPostModal();
            }
        });
    }
    
    const hotelBtn = document.getElementById('hotel-post-btn');
    if (hotelBtn) {
        const newBtn = hotelBtn.cloneNode(true);
        hotelBtn.parentNode.replaceChild(newBtn, hotelBtn);
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🖱️ Hotel button clicked');
            if (typeof window.showHotelPostModal === 'function') {
                window.showHotelPostModal();
            }
        });
    }
    
    const propertyBtn = document.getElementById('property-post-btn');
    if (propertyBtn) {
        const newBtn = propertyBtn.cloneNode(true);
        propertyBtn.parentNode.replaceChild(newBtn, propertyBtn);
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🖱️ Property button clicked');
            if (typeof window.showPropertyPostModal === 'function') {
                window.showPropertyPostModal();
            }
        });
    }
    
    const landBtn = document.getElementById('land-post-btn');
    if (landBtn) {
        const newBtn = landBtn.cloneNode(true);
        landBtn.parentNode.replaceChild(newBtn, landBtn);
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🖱️ Land button clicked');
            if (typeof window.showLandPostModal === 'function') {
                window.showLandPostModal();
            }
        });
    }
    
    console.log('✅ All modal button handlers setup complete');
}

// ========================================
// INITIALIZATION
// ========================================

// Wait for DOM ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM ready, initializing app...');
    
    // Create app instance
    window.app = new VikeServeApp();
    
    // Expose functions
    window.switchTab = (tabId) => window.app?.switchTab(tabId);
    window.openMoreMenu = () => window.app?.openMoreMenu();
    window.closeMoreMenu = () => window.app?.closeMoreMenu();
    window.getCurrentLocation = () => window.app?.getCurrentLocation();
    window.isUserFounder = () => window.app?.isUserFounder();
    
    // Setup modal handlers after app initializes
    setTimeout(setupAllModalHandlers, 1000);
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (window.app && typeof window.app.destroy === 'function') {
            window.app.destroy();
        }
    });
});

// Re-attach handlers on tab change
document.addEventListener('tabChanged', function(e) {
    console.log('🔄 Tab changed, reattaching modal handlers...');
    setTimeout(setupAllModalHandlers, 300);
});

// Expose to window
window.setupAllModalHandlers = setupAllModalHandlers;

console.log('✅ app.js loaded successfully');