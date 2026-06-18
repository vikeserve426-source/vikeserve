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

    switchToTab(tabId) {
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
        const originalIcon = buttonElement.querySelector('i')?.className;
        const originalText = buttonElement.querySelector('.action-name')?.textContent;
        
        this.showButtonLoading(buttonElement, originalText);
        
        const servicesActions = ['boda', 'construction', 'daily', 'farm', 'electricity', 'house', 'phone'];
        const marketplaceActions = ['Marketplace', 'marketplace', 'gas', 'water'];
        const educationActions = ['education', 'teachers', 'internships', 'attachments', 'training'];
        const alertsActions = ['alerts', 'report', 'community-alerts'];
        const wifiActions = ['wifi', 'wificonnect', 'vikeserve-connect'];
        
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
            
            setTimeout(() => {
                this.applyMarketplaceFilter(categoryFilter);
            }, 300);
            
            setTimeout(() => this.resetButton(buttonElement, originalIcon, originalText), 500);
            
        } else if (wifiActions.includes(actionType)) {
            // VikeServe Connect - Coming Soon
            if (typeof window.showToast === 'function') {
                window.showToast('🌐 VikeServe Connect - Coming Soon!', 'info');
            }
            this.showWifiComingSoonModal();
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
        if (typeof window.loadMarketplaceItems === 'function') {
            window.loadMarketplaceItems(category);
            return;
        }
        
        const filterBtns = document.querySelectorAll('.filter-btn');
        let filterApplied = false;
        
        filterBtns.forEach(btn => {
            const btnCategory = btn.getAttribute('data-category');
            if (btnCategory === category) {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                btn.click();
                filterApplied = true;
            }
        });
        
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
        if (typeof window.openMoreMenu === 'function') {
            window.openMoreMenu();
        } else if (window.app && typeof window.app.openMoreMenu === 'function') {
            window.app.openMoreMenu();
        } else {
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
        
        setTimeout(() => {
            if (window.moreMenuManager && typeof window.moreMenuManager.switchMoreTab === 'function') {
                window.moreMenuManager.switchMoreTab(tabId);
            } else {
                const tabBtn = document.querySelector(`.more-tab-btn[data-more-tab="${tabId}"]`);
                if (tabBtn) {
                    tabBtn.click();
                }
            }
        }, 300);
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
            'Marketplace': 'Marketplace',
            'wifi': 'VikeServe Connect'
        };
        return titles[actionType] || 'Services';
    }

    // ========== WIFI CONNECT COMING SOON MODAL ==========
    showWifiComingSoonModal() {
        const modalContent = `
            <div class="modal-content" style="max-width: 400px; text-align: center;">
                <div class="modal-header">
                    <div class="modal-title"><i class="fas fa-wifi"></i> VikeServe Connect</div>
                    <button class="close-modal-btn">&times;</button>
                </div>
                <div style="padding: 20px;">
                    <div style="font-size: 4rem; margin-bottom: 15px;">
                        <i class="fas fa-wifi" style="color: var(--primary);"></i>
                    </div>
                    <h3>Coming Soon! 🚀</h3>
                    <p style="color: var(--grey-dark); margin: 15px 0;">
                        VikeServe Connect will allow you to buy affordable WiFi packages directly from your phone.
                    </p>
                    <div style="background: var(--light); padding: 15px; border-radius: 10px; margin: 15px 0; text-align: left;">
                        <div style="font-weight: 600; margin-bottom: 8px;">📦 Available Packages (Coming Soon)</div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; padding: 4px 0; border-bottom: 1px solid var(--grey);">
                            <span>1 Hour Pass</span> <span>KES 10</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; padding: 4px 0; border-bottom: 1px solid var(--grey);">
                            <span>1 Day Pass</span> <span>KES 50</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; padding: 4px 0;">
                            <span>7 Days Pass</span> <span>KES 250</span>
                        </div>
                    </div>
                    <p style="font-size: 0.8rem; color: var(--grey-dark);">
                        ⚡ Stay tuned! We're working hard to bring this to you.
                    </p>
                    <div class="form-actions" style="margin-top: 20px;">
                        <button class="btn btn-primary close-modal-btn">Got It!</button>
                    </div>
                </div>
            </div>
        `;
        
        if (typeof window.showModalWithContent === 'function') {
            window.showModalWithContent('wifi-coming-soon-modal', modalContent);
        } else {
            let modal = document.getElementById('wifi-coming-soon-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'wifi-coming-soon-modal';
                modal.className = 'modal';
                document.body.appendChild(modal);
            }
            modal.innerHTML = modalContent;
            modal.style.display = 'flex';
            modal.style.zIndex = '10001';
        }
        
        setTimeout(() => {
            const closeBtns = document.querySelectorAll('#wifi-coming-soon-modal .close-modal-btn');
            closeBtns.forEach(btn => {
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                newBtn.addEventListener('click', () => {
                    if (typeof window.closeModal === 'function') {
                        window.closeModal('wifi-coming-soon-modal');
                    } else {
                        const modal = document.getElementById('wifi-coming-soon-modal');
                        if (modal) modal.style.display = 'none';
                    }
                });
            });
        }, 100);
    }
}

const quickActionsManager = new QuickActionsManager();
window.quickActionsManager = quickActionsManager;