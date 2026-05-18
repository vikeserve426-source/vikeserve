// scripts/quick-actions.js - COMPLETE FIXED VERSION (Works in APK WebView)

class QuickActionsManager {
    constructor() {
        this.db = window.db;
        this.currentServiceType = '';
        this.currentProviders = [];
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
                    this.handleQuickAction(actionType);
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
        if (typeof window.switchTab === 'function') {
            window.switchTab(tabId);
        } else if (window.app && typeof window.app.switchTab === 'function') {
            window.app.switchTab(tabId);
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
        }
    }

    handleQuickAction(actionType) {
        // Services actions - go to Services tab
        const servicesActions = ['boda', 'construction', 'daily', 'farm', 'electricity', 'house', 'phone'];
        
        // Marketplace actions - go to Marketplace tab (Gas and Water are marketplace items)
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
            
        } else if (marketplaceActions.includes(actionType)) {
            this.switchToTab('marketplace-tab');
            
            let categoryMessage = 'Opening Marketplace';
            if (actionType === 'gas') {
                categoryMessage = 'Opening Gas Refill listings';
                setTimeout(() => {
                    this.applyMarketplaceFilter('gas-refill');
                }, 300);
            } else if (actionType === 'water') {
                categoryMessage = 'Opening Water Delivery listings';
                setTimeout(() => {
                    this.applyMarketplaceFilter('water-delivery');
                }, 300);
            } else {
                setTimeout(() => {
                    this.applyMarketplaceFilter('all');
                }, 300);
            }
            
            if (typeof window.showToast === 'function') {
                window.showToast(categoryMessage, 'info');
            }
            
        } else if (educationActions.includes(actionType)) {
            this.openMoreMenuAndSwitchTo('education');
            if (typeof window.showToast === 'function') {
                window.showToast('Opening Education Hub', 'info');
            }
            
        } else if (alertsActions.includes(actionType)) {
            this.openMoreMenuAndSwitchTo('alerts');
            if (typeof window.showToast === 'function') {
                window.showToast('Opening Community Alerts', 'info');
            }
            
        } else {
            this.openMoreMenuAndSwitchTo('education');
        }
    }
    
    applyMarketplaceFilter(category) {
        const filterBtns = document.querySelectorAll('.filter-btn');
        let filterApplied = false;
        
        filterBtns.forEach(btn => {
            const btnCategory = btn.getAttribute('data-category');
            if (btnCategory === category) {
                btn.click();
                filterApplied = true;
            }
        });
        
        if (typeof window.loadMarketplaceItems === 'function') {
            window.loadMarketplaceItems(category);
        }
        
        // Fallback for APK - manually filter items
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
        
        // Then switch to the specific tab after a short delay
        setTimeout(() => {
            if (window.moreMenuManager && typeof window.moreMenuManager.switchMoreTab === 'function') {
                window.moreMenuManager.switchMoreTab(tabId);
            } else {
                const tabBtn = document.querySelector(`.more-tab-btn[data-more-tab="${tabId}"]`);
                if (tabBtn) {
                    tabBtn.click();
                }
            }
        }, 150);
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
            'water': 'Water Delivery'
        };
        return titles[actionType] || 'Services';
    }

    getServiceIcon(actionType) {
        const icons = {
            'boda': '🏍️',
            'construction': '👷',
            'daily': '💼',
            'farm': '🚜',
            'gas': '🔥',
            'water': '💧',
            'electricity': '⚡',
            'house': '🏠',
            'phone': '📱'
        };
        return icons[actionType] || '🔧';
    }

    getServiceColor(actionType) {
        const colors = {
            'boda': '#2E86DE',
            'construction': '#f39c12',
            'daily': '#27ae60',
            'farm': '#8e44ad',
            'gas': '#e74c3c',
            'water': '#3498db',
            'electricity': '#f1c40f',
            'house': '#9b59b6',
            'phone': '#34495e'
        };
        return colors[actionType] || '#2E86DE';
    }
}

const quickActionsManager = new QuickActionsManager();
window.quickActionsManager = quickActionsManager;