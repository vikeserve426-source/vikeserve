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
    this.setupNavigation();
    this.setupQuickActions();
    this.setupSettings();
    this.initLocationSystem();
    this.checkAuthState();
    this.loadInitialData();
    this.ensureMoreMenuConnection();
    this.setupAdPromotionButtons();
    this.setupFeatureToggles();
    this.handleInitialTabFromURL();
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
        if (activeNav) activeNav.classList.add('active');
        
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const targetTab = document.getElementById(tabId);
        if (targetTab) {
            targetTab.classList.add('active');
            this.loadTabContent(tabId);
        }
    }

    openMoreMenu() {
        const moreSection = document.getElementById('more-section');
        const mainNav = document.querySelector('.bottom-nav');
        const moreBottomNav = document.querySelector('.more-bottom-nav');
        
        if (moreSection) {
            moreSection.style.display = 'block';
            moreSection.classList.add('active');
        }
        if (mainNav) mainNav.style.display = 'none';
        if (moreBottomNav) moreBottomNav.style.display = 'flex';
        
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
        const mainNav = document.querySelector('.bottom-nav');
        const moreBottomNav = document.querySelector('.more-bottom-nav');
        
        if (moreSection) {
            moreSection.style.display = 'none';
            moreSection.classList.remove('active');
        }
        if (mainNav) mainNav.style.display = 'flex';
        if (moreBottomNav) moreBottomNav.style.display = 'none';
        
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
            // Remove existing listener by cloning
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
            firebase.auth().onAuthStateChanged((user) => {
                this.currentUser = user;
                this.updateUIForAuthState();
                
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
                    if (typeof window.showAuthModal === 'function') {
                        window.showAuthModal();
                    } else if (typeof window.openAuthModal === 'function') {
                        window.openAuthModal();
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
    }

    toggleUserMenu() {
        const userMenu = document.getElementById('user-menu');
        if (userMenu) {
            userMenu.classList.toggle('show');
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
            : () => false;
        
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
    }

    destroy() {
        this.timeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.timeouts = [];
        
        if (typeof this.cleanupModals === 'function') {
            this.cleanupModals();
        }
        
        console.log('App destroyed, cleaned up timeouts and listeners');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    window.app = new VikeServeApp();
    
    window.switchTab = (tabId) => window.app?.switchTab(tabId);
    window.openMoreMenu = () => window.app?.openMoreMenu();
    window.closeMoreMenu = () => window.app?.closeMoreMenu();
    window.getCurrentLocation = () => window.app?.getCurrentLocation();
    
    window.addEventListener('beforeunload', () => {
        if (window.app && typeof window.app.destroy === 'function') {
            window.app.destroy();
        }
    });
});