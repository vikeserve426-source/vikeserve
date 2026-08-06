(function() {
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

    window.showToast = window.showToast || function(msg, type, duration = 3000) {
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

    setTimeout(() => {
        if (typeof window._realShowToast === 'function') {
            window._realShowToast(msg, type);
        }
    }, 100);
};
})();

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
        this.init();
    }

    async init() {
        this.applyGlobalFixes();
        this.setupEventListeners();
        setTimeout(() => this.setupCloseButtons(), 300);
        this.setupNavigation();
        this.setupQuickActions();
        this.setupSettings();
        this.initLocationSystem();
        this.checkAuthState();
        this.loadInitialData();
        await this.loadStatsCounts();
        this.ensureMoreMenuConnection();
        this.setupAdPromotionButtons();
        this.setupFeatureToggles();
        this.handleInitialTabFromURL();
    }

    async loadStatsCounts() {
        try {
            let isFounder = false;
            let userRole = 'user';

            if (this.currentUser) {
                try {
                    const userDoc = await firebase.firestore().collection('users').doc(this.currentUser.uid).get();
                    if (userDoc.exists) {
                        userRole = userDoc.data().role || 'user';
                        isFounder = userRole === 'founder';
                    }
                } catch (e) {
                    }
            }

            const servicesSnapshot = await firebase.firestore()
                .collection('services')
                .where('status', '==', 'active')
                .get();
            const activeServices = servicesSnapshot.size;

            const workersSnapshot = await firebase.firestore()
                .collection('users')
                .where('role', 'in', ['service_provider', 'verified', 'provider'])
                .get();

            let verifiedWorkers = workersSnapshot.size;

            if (verifiedWorkers === 0) {
                const allUsersSnapshot = await firebase.firestore().collection('users').get();
                verifiedWorkers = allUsersSnapshot.size;
            }

            let totalUsers = 0;
            if (isFounder) {
                const totalUsersSnapshot = await firebase.firestore().collection('users').get();
                totalUsers = totalUsersSnapshot.size;
            }

            const marketplaceSnapshot = await firebase.firestore()
                .collection('marketplace_items')
                .where('status', '==', 'active')
                .get();
            const marketplaceItems = marketplaceSnapshot.size;

            const bookingsSnapshot = await firebase.firestore().collection('bookings').get();
            const totalBookings = bookingsSnapshot.size;

            const reviewsSnapshot = await firebase.firestore().collection('reviews').get();
            const totalReviews = reviewsSnapshot.size;

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
                if (el) el.textContent = value;
            });

            const totalUsersContainer = document.getElementById('total-users-count')?.closest('.stat-card');
            if (totalUsersContainer) {
                if (!isFounder) {
                    totalUsersContainer.style.display = 'none';
                } else {
                    totalUsersContainer.style.display = 'block';
                }
            }

            return { activeServices, verifiedWorkers, totalUsers, marketplaceItems, totalBookings, totalReviews };
        } catch (error) {
            console.error('Error loading stats:', error);
            const ids = ['active-jobs-count', 'verified-workers-count', 'marketplace-items-count', 'total-bookings-count', 'reviews-count'];
            ids.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = '0';
            });
            const totalUsersContainer = document.getElementById('total-users-count')?.closest('.stat-card');
            if (totalUsersContainer) totalUsersContainer.style.display = 'none';
            return { activeServices: 0, verifiedWorkers: 0, totalUsers: 0, marketplaceItems: 0, totalBookings: 0, totalReviews: 0 };
        }
    }

    handleInitialTabFromURL() {
        const hash = window.location.hash.substring(1);
        if (hash && ['home-tab', 'services-tab', 'marketplace-tab', 'account-tab'].includes(hash)) {
            setTimeout(() => {
                this.switchTab(hash);
            }, 100);
        }
    }

    updateURLHash(tabId) {
        if (tabId && tabId !== 'more-tab') {
            window.location.hash = tabId;
        }
    }

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

    switchTab(tabId) {
        this.currentTab = tabId;

        document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
            item.classList.remove('active');
        });
        const activeNav = document.querySelector(`.bottom-nav .nav-item[data-tab="${tabId}"]`);
        if (activeNav) {
            activeNav.classList.add('active');
        }

        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        const targetTab = document.getElementById(tabId);
        if (targetTab) {
            targetTab.classList.add('active');
            this.loadTabContent(tabId);
            } else {
            }

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

    openMoreMenu() {
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

        if (window.moreMenuManager) {
            if (typeof window.moreMenuManager.switchMoreTab === 'function') {
                window.moreMenuManager.switchMoreTab('education');
            }
        } else {
            const defaultTab = document.getElementById('education-content');
            if (defaultTab) defaultTab.classList.add('active');

            if (typeof MoreMenuManager !== 'undefined' && !window.moreMenuManager) {
                window.moreMenuManager = new MoreMenuManager();
            }
        }
    }

    closeMoreMenu() {
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

    setupLocationSelector() {
        const locationSelector = document.getElementById('location-selector');
        if (locationSelector) {
            const newSelector = locationSelector.cloneNode(true);
            locationSelector.parentNode.replaceChild(newSelector, locationSelector);
            newSelector.addEventListener('click', () => this.openLocationModal());
        }
    }

    openLocationModal() {
        const modalContent = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <div class="modal-title"><i class="fas fa-map-marker-alt"></i> Select Your Location</div>
                    <button class="close-modal-btn">&times;</button>
                </div>
                <div style="padding: 20px;">
                    <div class="form-group">
                        <label class="form-label">Country <span style="color: var(--danger);">*</span></label>
                        <input type="text" id="location-country-input" class="form-input" placeholder="e.g., Kenya, Uganda, Nigeria, USA, UK">
                    </div>
                    <div class="form-group">
                        <label class="form-label">County / State / Region</label>
                        <input type="text" id="location-state-input" class="form-input" placeholder="e.g., Nairobi, Lagos, Texas">
                    </div>
                    <div class="form-group">
                        <label class="form-label">City / Town / Ward</label>
                        <input type="text" id="location-city-input" class="form-input" placeholder="e.g., Westlands, Kilimani">
                    </div>
                    <div id="location-preview" style="display: none; margin: 15px 0; padding: 12px; background: var(--light); border-radius: 8px;">
                        <i class="fas fa-map-pin"></i> <span id="location-preview-text"></span>
                    </div>
                    <div class="form-actions" style="display: flex; gap: 10px; margin-top: 20px;">
                        <button class="btn btn-outline" id="cancel-location-btn">Cancel</button>
                        <button class="btn btn-primary" id="save-location-btn"><i class="fas fa-save"></i> Save Location</button>
                    </div>
                </div>
            </div>
        `;

        if (typeof window.showModalWithContent === 'function') {
            window.showModalWithContent('location-modal', modalContent);
        } else {
            let modal = document.getElementById('location-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'location-modal';
                modal.className = 'modal';
                document.body.appendChild(modal);
            }
            modal.innerHTML = modalContent;
            modal.style.display = 'flex';
            modal.style.zIndex = '10001';
        }

        setTimeout(() => {
            const countryInput = document.getElementById('location-country-input');
            const stateInput = document.getElementById('location-state-input');
            const cityInput = document.getElementById('location-city-input');

            if (countryInput) countryInput.value = this.currentLocation.country || '';
            if (stateInput) stateInput.value = this.currentLocation.state || '';
            if (cityInput) cityInput.value = this.currentLocation.city || '';

            this.updateManualLocationPreview();

            const saveBtn = document.getElementById('save-location-btn');
            if (saveBtn) {
                const newSaveBtn = saveBtn.cloneNode(true);
                saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
                newSaveBtn.addEventListener('click', () => this.saveManualLocation());
            }

            const cancelBtn = document.getElementById('cancel-location-btn');
            if (cancelBtn) {
                const newCancelBtn = cancelBtn.cloneNode(true);
                cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
                newCancelBtn.addEventListener('click', () => {
                    if (typeof window.closeModal === 'function') {
                        window.closeModal('location-modal');
                    } else {
                        const modal = document.getElementById('location-modal');
                        if (modal) modal.style.display = 'none';
                    }
                });
            }

            const closeBtn = document.querySelector('#location-modal .close-modal-btn');
            if (closeBtn) {
                const newCloseBtn = closeBtn.cloneNode(true);
                closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
                newCloseBtn.addEventListener('click', () => {
                    if (typeof window.closeModal === 'function') {
                        window.closeModal('location-modal');
                    } else {
                        const modal = document.getElementById('location-modal');
                        if (modal) modal.style.display = 'none';
                    }
                });
            }

            const inputs = ['location-country-input', 'location-state-input', 'location-city-input'];
            inputs.forEach(id => {
                const input = document.getElementById(id);
                if (input) {
                    input.addEventListener('input', () => this.updateManualLocationPreview());
                }
            });
        }, 100);
    }

    updateManualLocationPreview() {
        const country = document.getElementById('location-country-input')?.value || '';
        const state = document.getElementById('location-state-input')?.value || '';
        const city = document.getElementById('location-city-input')?.value || '';

        const previewSpan = document.getElementById('location-preview-text');
        const previewDiv = document.getElementById('location-preview');

        if (previewSpan && previewDiv) {
            let previewText = '';
            if (city && state) previewText = `${city}, ${state}, ${country}`;
            else if (city && country) previewText = `${city}, ${country}`;
            else if (state && country) previewText = `${state}, ${country}`;
            else if (country) previewText = country;

            if (previewText) {
                previewSpan.textContent = previewText;
                previewDiv.style.display = 'flex';
            } else {
                previewDiv.style.display = 'none';
            }
        }
    }

    saveManualLocation() {
        const country = document.getElementById('location-country-input')?.value.trim();
        const state = document.getElementById('location-state-input')?.value.trim();
        const city = document.getElementById('location-city-input')?.value.trim();

        if (!country) {
            if (typeof window.showToast === 'function') {
                window.showToast('Please enter your country', 'warning');
            }
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

        if (typeof window.closeModal === 'function') {
            window.closeModal('location-modal');
        } else {
            const modal = document.getElementById('location-modal');
            if (modal) modal.style.display = 'none';
        }

        const displayText = this.getLocationDisplayText();
        if (typeof window.showToast === 'function') {
            window.showToast(`📍 Location set to ${displayText || country}`, 'success');
        }

        window.dispatchEvent(new CustomEvent('locationUpdated', { detail: this.currentLocation }));
    }

    getCurrentLocation() {
        return { ...this.currentLocation };
    }

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

    setupSettings() {
        const savedDarkMode = localStorage.getItem('darkMode');
        if (savedDarkMode === 'enabled') {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    }

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

    async updateFounderBodyClass() {
        if (!this.currentUser) {
            document.body.classList.remove('founder');
            return;
        }

        try {
            const userDoc = await firebase.firestore().collection('users').doc(this.currentUser.uid).get();
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

    async isUserFounder() {
        if (!this.currentUser) return false;

        try {
            const userDoc = await firebase.firestore().collection('users').doc(this.currentUser.uid).get();
            if (userDoc.exists) {
                return userDoc.data().role === 'founder';
            }
            return false;
        } catch (error) {
            console.error('Error checking founder status:', error);
            return false;
        }
    }

    loadInitialData() {
        if (typeof window.loadUrgentJobs === 'function') {
            setTimeout(() => window.loadUrgentJobs(), 500);
        }
        if (typeof window.loadMarketplaceItems === 'function') {
            setTimeout(() => window.loadMarketplaceItems('all'), 1000);
        }
    }

    loadTabContent(tabId) {
        const currentLocation = this.getCurrentLocation();

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

    setupEventListeners() {
        window.addEventListener('click', (e) => {
            if (e.target.classList && e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
                document.body.style.overflow = '';
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal').forEach(modal => {
                    modal.style.display = 'none';
                });
                this.closeMoreMenu();
                document.body.style.overflow = '';
            }
        });

        const userProfile = document.getElementById('user-profile');
        if (userProfile) {
            const newUserProfile = userProfile.cloneNode(true);
            userProfile.parentNode.replaceChild(newUserProfile, userProfile);

            newUserProfile.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isLoggedIn = this.currentUser !== null;

                if (!isLoggedIn) {
                    if (typeof window.openAuthModal === 'function') {
                        window.openAuthModal();
                    } else if (typeof window.showAuthModal === 'function') {
                        window.showAuthModal();
                    } else {
                        const authModal = document.getElementById('auth-modal');
                        if (authModal) authModal.style.display = 'flex';
                    }
                } else {
                    this.toggleUserMenu();
                }
            });
        }

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

        const moreCloseBtn = document.querySelector('.more-close');
        if (moreCloseBtn) {
            const newMoreCloseBtn = moreCloseBtn.cloneNode(true);
            moreCloseBtn.parentNode.replaceChild(newMoreCloseBtn, moreCloseBtn);
            newMoreCloseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.closeMoreMenu();
            });
        }

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

    setupCloseButtons() {
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
                    }
            });
        });
    }

    toggleUserMenu() {
        const userMenu = document.getElementById('user-menu');
        if (userMenu) {
            userMenu.classList.toggle('show');
            } else {
            console.error('❌ User menu element not found');
        }
    }

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
                    setTimeout(() => {
                        if (window.pendingPromotionCallback) {
                            window.pendingPromotionCallback = null;
                        }
                    }, 300000);
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

    applyFeatureToggles() {
        const isFeatureEnabled = typeof window.isFeatureEnabled === 'function'
            ? window.isFeatureEnabled
            : () => {
                return false;
            };

        try {
            const isAdPromotionEnabled = isFeatureEnabled('feature_adPromotion');
            const isWifiConnectEnabled = isFeatureEnabled('feature_wifiConnect');
            const showComingSoon = isFeatureEnabled('feature_showComingSoon');

            const promoteButtons = document.querySelectorAll(
                '.ad-cta, .btn-promote, .promote-service-btn, .promote-ad-btn, #view-packages-btn, #post-ad-btn'
            );

            promoteButtons.forEach(el => {
                if (!isAdPromotionEnabled) {
                    el.disabled = true;
                    el.style.opacity = '0.5';
                    el.style.cursor = 'not-allowed';
                    el.style.pointerEvents = 'none';
                    el.style.position = 'relative';

                    if (showComingSoon && !el.querySelector('.coming-soon-badge')) {
                        const badge = document.createElement('span');
                        badge.className = 'coming-soon-badge';
                        badge.textContent = '🔒 Coming Soon';
                        badge.style.cssText = `
                            position: absolute;
                            top: -10px;
                            right: -8px;
                            background: var(--warning);
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
                    wifiAction.style.position = 'relative';

                    if (showComingSoon && !wifiAction.querySelector('.coming-soon-badge')) {
                        const badge = document.createElement('span');
                        badge.className = 'coming-soon-badge';
                        badge.textContent = '🔒 Coming Soon';
                        badge.style.cssText = `
                            position: absolute;
                            top: -5px;
                            right: 5px;
                            background: var(--warning);
                            color: white;
                            font-size: 0.5rem;
                            padding: 2px 6px;
                            border-radius: 8px;
                            font-weight: bold;
                            z-index: 10;
                        `;
                        wifiAction.appendChild(badge);
                    }
                } else {
                    wifiAction.style.opacity = '1';
                    wifiAction.style.cursor = 'pointer';
                    wifiAction.style.pointerEvents = 'auto';

                    const badge = wifiAction.querySelector('.coming-soon-badge');
                    if (badge) badge.remove();
                }
            }
        } catch (error) {
            }
    }

    destroy() {
        this.timeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.timeouts = [];

        if (typeof this.cleanupModals === 'function') {
            this.cleanupModals();
        }

        }
}


function setupAllModalHandlers() {
    const serviceBtn = document.getElementById('service-post-btn');
    if (serviceBtn) {
        const newBtn = serviceBtn.cloneNode(true);
        serviceBtn.parentNode.replaceChild(newBtn, serviceBtn);
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
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

    const marketBtn = document.getElementById('marketplace-post-btn');
    if (marketBtn) {
        const newBtn = marketBtn.cloneNode(true);
        marketBtn.parentNode.replaceChild(newBtn, marketBtn);
        newBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
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
            if (typeof window.showLandPostModal === 'function') {
                window.showLandPostModal();
            }
        });
        }

    }

document.addEventListener('DOMContentLoaded', function() {
    window.app = new VikeServeApp();

    window.switchTab = (tabId) => window.app?.switchTab(tabId);
    window.openMoreMenu = () => window.app?.openMoreMenu();
    window.closeMoreMenu = () => window.app?.closeMoreMenu();
    window.getCurrentLocation = () => window.app?.getCurrentLocation();

    window.isUserFounder = () => window.app?.isUserFounder();

    setTimeout(setupAllModalHandlers, 500);

    window.addEventListener('beforeunload', () => {
        if (window.app && typeof window.app.destroy === 'function') {
            window.app.destroy();
        }
    });
});

document.addEventListener('tabChanged', function(e) {
    setTimeout(setupAllModalHandlers, 300);
});

window.setupAllModalHandlers = setupAllModalHandlers;