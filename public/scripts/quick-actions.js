// scripts/quick-actions.js - UPDATED VERSION (Gas & Water go to Marketplace)

class QuickActionsManager {
    constructor() {
        this.db = window.db;
        this.currentServiceType = '';
        this.currentProviders = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        console.log('Quick Actions Manager initialized - Corrected routing');
    }

    setupEventListeners() {
        const setup = () => {
            const quickActions = document.querySelectorAll('.quick-action');
            console.log('Found quick actions:', quickActions.length);
            
            quickActions.forEach(action => {
                const newAction = action.cloneNode(true);
                action.parentNode.replaceChild(newAction, action);
                const actionType = newAction.getAttribute('data-action');
                
                newAction.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Quick action clicked:', actionType);
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

    handleQuickAction(actionType) {
        console.log('Quick action triggered:', actionType);
        
        // Services actions - go to Services tab
        const servicesActions = ['boda', 'construction', 'daily', 'farm', 'electricity', 'house', 'phone'];
        
        // Marketplace actions - go to Marketplace tab (Gas and Water are marketplace items)
        const marketplaceActions = ['Marketplace', 'marketplace', 'gas', 'water'];
        
        // Education action - opens More menu > Education tab
        const educationActions = ['education', 'teachers', 'internships', 'attachments', 'training'];
        
        // Alerts action - opens More menu > Alerts tab
        const alertsActions = ['alerts', 'report', 'community-alerts'];
        
        if (servicesActions.includes(actionType)) {
            // Switch to services tab
            if (typeof window.switchTab === 'function') {
                window.switchTab('services-tab');
            }
            if (typeof window.showToast === 'function') {
                window.showToast(`Opening ${this.getServiceTitle(actionType)}`, 'info');
            }
            
        } else if (marketplaceActions.includes(actionType)) {
            // Switch to marketplace tab
            if (typeof window.switchTab === 'function') {
                window.switchTab('marketplace-tab');
            }
            
            // Apply category filter for gas and water
            let categoryMessage = 'Opening Marketplace';
            if (actionType === 'gas') {
                categoryMessage = 'Opening Gas Refill listings';
                // Apply gas-refill filter after tab loads
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
            // Open More menu and go to Education tab
            this.openMoreMenuAndSwitchTo('education');
            if (typeof window.showToast === 'function') {
                window.showToast('Opening Education Hub', 'info');
            }
            
        } else if (alertsActions.includes(actionType)) {
            // Open More menu and go to Alerts tab
            this.openMoreMenuAndSwitchTo('alerts');
            if (typeof window.showToast === 'function') {
                window.showToast('Opening Community Alerts', 'info');
            }
            
        } else {
            // Default - open More menu to Education tab
            this.openMoreMenuAndSwitchTo('education');
        }
    }
    
    // Apply filter to marketplace items
    applyMarketplaceFilter(category) {
        // Find and click the filter button for the category
        const filterBtns = document.querySelectorAll('.filter-btn');
        let filterApplied = false;
        
        filterBtns.forEach(btn => {
            const btnCategory = btn.getAttribute('data-category');
            if (btnCategory === category) {
                btn.click();
                filterApplied = true;
                console.log(`Applied marketplace filter: ${category}`);
            }
        });
        
        if (!filterApplied && category !== 'all') {
            console.log(`Filter button for ${category} not found, showing all items`);
        }
        
        // Also trigger loadMarketplaceItems if function exists
        if (typeof window.loadMarketplaceItems === 'function') {
            window.loadMarketplaceItems(category);
        }
    }

    // Helper method to open More menu and switch to specific tab
    openMoreMenuAndSwitchTo(tabId) {
        // First open the More menu
        if (typeof window.openMoreMenu === 'function') {
            window.openMoreMenu();
        } else if (window.app && typeof window.app.openMoreMenu === 'function') {
            window.app.openMoreMenu();
        }
        
        // Then switch to the specific tab after a short delay
        setTimeout(() => {
            if (window.moreMenuManager && typeof window.moreMenuManager.switchMoreTab === 'function') {
                window.moreMenuManager.switchMoreTab(tabId);
            } else if (window.moreMenuManager) {
                // Fallback: manually trigger tab switch
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

// Initialize quick actions manager
const quickActionsManager = new QuickActionsManager();
window.quickActionsManager = quickActionsManager;

console.log('✅ Quick Actions Manager loaded - Gas & Water go to Marketplace');