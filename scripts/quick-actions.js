// ========== QUICK ACTIONS MANAGER - COMPLETE FIXED VERSION ==========
// Handles home screen quick action buttons (Boda, Mjengo, Gas, Water, Education, Alerts, etc.)

class QuickActionsManager {
    constructor() {
        this.db = window.db;
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const setup = () => {
            const quickActions = document.querySelectorAll('.quick-action');
            
            quickActions.forEach(action => {
                const newAction = action.cloneNode(true);
                action.parentNode.replaceChild(newAction, action);
                const actionType = newAction.getAttribute('data-action');
                
                newAction.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleQuickAction(actionType, newAction);
                });
            });
        };
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setup);
        } else {
            setup();
        }
    }

    // Helper function to switch tabs (works in APK WebView)
    switchToTab(tabId) {
        // Special handling for 'more-tab' (opens menu, not a tab)
        if (tabId === 'more-tab') {
            this.openMoreMenuAndSwitchTo('education');
            return true;
        }
        
        if (typeof window.switchTab === 'function') {
            window.switchTab(tabId);
            return true;
        } else if (window.app && typeof window.app.switchTab === 'function') {
            window.app.switchTab(tabId);
            return true;
        } else {
            // Fallback for APK - directly manipulate DOM
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            const targetTab = document.getElementById(tabId);
            if (targetTab) targetTab.classList.add('active');
            
            document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
                item.classList.remove('active');
            });
            const activeNav = document.querySelector(`.bottom-nav .nav-item[data-tab="${tabId}"]`);
            if (activeNav) activeNav.classList.add('active');
            return true;
        }
    }

    // Show loading indicator on clicked button
    showButtonLoading(button, originalText) {
        if (!button) return;
        button.disabled = true;
        button.style.opacity = '0.6';
        const icon = button.querySelector('i');
        if (icon) {
            icon.className = 'fas fa-spinner fa-spin';
        }
        if (originalText) {
            const textSpan = button.querySelector('.action-name');
            if (textSpan) textSpan.textContent = 'Loading...';
        }
    }

    // Reset button after loading
    resetButton(button, originalIcon, originalText) {
        if (!button) return;
        button.disabled = false;
        button.style.opacity = '1';
        const icon = button.querySelector('i');
        if (icon && originalIcon) {
            icon.className = originalIcon;
        }
        if (originalText) {
            const textSpan = button.querySelector('.action-name');
            if (textSpan) textSpan.textContent = originalText;
        }
    }

    handleQuickAction(actionType, buttonElement) {
        // Save original button state
        const originalIcon = buttonElement.querySelector('i')?.className;
        const originalText = buttonElement.querySelector('.action-name')?.textContent;
        
        // Show loading state
        this.showButtonLoading(buttonElement, originalText);
        
        // Services actions - go to Services tab
        const servicesActions = ['boda', 'construction', 'daily', 'farm', 'electricity', 'house', 'phone'];
        
        // Marketplace actions - go to Marketplace tab
        const marketplaceActions = ['Marketplace', 'marketplace', 'gas', 'water'];
        
        // Education action - opens More menu > Education tab
        const educationActions = ['education', 'teachers', 'internships', 'attachments', 'training'];
        
        // Alerts action - opens More menu > Alerts tab
        const alertsActions = ['alerts', 'report', 'community-alerts'];
        
        if (servicesActions.includes(actionType)) {
            this.switchToTab('services-tab');
            if (typeof window.showToast === 'function') {
                window.showToast(`Opening ${this.getServiceTitle(actionType)}`, 'info');
            }
            setTimeout(() => this.resetButton(buttonElement, originalIcon, originalText), 500);
            
        } else if (marketplaceActions.includes(actionType)) {
            this.switchToTab('marketplace-tab');
            
            let categoryFilter = 'all';
            let categoryMessage = 'Opening Marketplace';
            
            if (actionType === 'gas') {
                categoryFilter = 'gas-refill';
                categoryMessage = 'Opening Gas Refill listings';
            } else if (actionType === 'water') {
                categoryFilter = 'water-delivery';
                categoryMessage = 'Opening Water Delivery listings';
            }
            
            if (typeof window.showToast === 'function') {
                window.showToast(categoryMessage, 'info');
            }
            
            // Apply filter after tab is switched
            setTimeout(() => {
                this.applyMarketplaceFilter(categoryFilter);
            }, 300);
            
            setTimeout(() => this.resetButton(buttonElement, originalIcon, originalText), 500);
            
        } else if (educationActions.includes(actionType)) {
            this.openMoreMenuAndSwitchTo('education');
            if (typeof window.showToast === 'function') {
                window.showToast('Opening Education Hub', 'info');
            }
            setTimeout(() => this.resetButton(buttonElement, originalIcon, originalText), 500);
            
        } else if (alertsActions.includes(actionType)) {
            this.openMoreMenuAndSwitchTo('alerts');
            if (typeof window.showToast === 'function') {
                window.showToast('Opening Community Alerts', 'info');
            }
            setTimeout(() => this.resetButton(buttonElement, originalIcon, originalText), 500);
            
        } else {
            this.openMoreMenuAndSwitchTo('education');
            setTimeout(() => this.resetButton(buttonElement, originalIcon, originalText), 500);
        }
    }
    
    applyMarketplaceFilter(category) {
        // Method 1: Use the loadMarketplaceItems function if available
        if (typeof window.loadMarketplaceItems === 'function') {
            window.loadMarketplaceItems(category);
            return;
        }
        
        // Method 2: Click the filter button if available
        const filterBtns = document.querySelectorAll('.filter-btn');
        let filterApplied = false;
        
        filterBtns.forEach(btn => {
            const btnCategory = btn.getAttribute('data-category');
            if (btnCategory === category) {
                // Remove active class from all, add to this one
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                // Trigger click event
                btn.click();
                filterApplied = true;
            }
        });
        
        // Method 3: Fallback for APK - manually filter items
        if (!filterApplied && category !== 'all') {
            const itemsContainer = document.getElementById('marketplace-items-container');
            if (itemsContainer) {
                const items = itemsContainer.querySelectorAll('.market-item');
                items.forEach(item => {
                    const itemCategory = item.getAttribute('data-category');
                    if (itemCategory === category) {
                        item.style.display = 'block';
                    } else {
                        item.style.display = 'none';
                    }
                });
            }
        }
    }

    openMoreMenuAndSwitchTo(tabId) {
        // First open the More menu
        if (typeof window.openMoreMenu === 'function') {
            window.openMoreMenu();
        } else if (window.app && typeof window.app.openMoreMenu === 'function') {
            window.app.openMoreMenu();
        } else {
            // Fallback for APK
            const moreSection = document.getElementById('more-section');
            const mainNav = document.querySelector('.bottom-nav');
            const moreBottomNav = document.querySelector('.more-bottom-nav');
            
            if (moreSection) {
                moreSection.style.display = 'block';
                moreSection.classList.add('active');
            }
            if (mainNav) mainNav.style.display = 'none';
            if (moreBottomNav) moreBottomNav.style.display = 'flex';
        }
        
        // Then switch to the specific tab after a delay (increased for slow devices)
        setTimeout(() => {
            if (window.moreMenuManager && typeof window.moreMenuManager.switchMoreTab === 'function') {
                window.moreMenuManager.switchMoreTab(tabId);
            } else {
                const tabBtn = document.querySelector(`.more-tab-btn[data-more-tab="${tabId}"]`);
                if (tabBtn) {
                    tabBtn.click();
                }
            }
        }, 300); // Increased from 150ms to 300ms for slow devices
    }

    getServiceTitle(actionType) {
        const titles = {
            'boda': 'Boda Boda Services',
            'construction': 'Construction Services',
            'daily': 'Daily Jobs',
            'farm': 'Farm Services',
            'electricity': 'Electrician Services',
            'house': 'House Help Services',
            'phone': 'Phone Repair Services',
            'gas': 'Gas Refill',
            'water': 'Water Delivery',
            'education': 'Education Hub',
            'alerts': 'Community Alerts',
            'Marketplace': 'Marketplace'
        };
        return titles[actionType] || 'Services';
    }
}

// Initialize quick actions manager
const quickActionsManager = new QuickActionsManager();
window.quickActionsManager = quickActionsManager;

console.log('✅ Quick-actions.js fully loaded with all fixes');