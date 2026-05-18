// utils.js - MASTER UTILITY FILE (UPDATED)

// ========== HTML ESCAPING ==========
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== TIME FORMATTING ==========
function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Recently';
    try {
        let date;
        if (timestamp && typeof timestamp.toDate === 'function') {
            date = timestamp.toDate();
        } else if (typeof timestamp === 'string') {
            date = new Date(timestamp);
        } else if (timestamp instanceof Date) {
            date = timestamp;
        } else {
            date = new Date(timestamp);
        }
        
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`;
        return date.toLocaleDateString();
    } catch {
        return 'Recently';
    }
}

// ========== TOAST NOTIFICATIONS ==========
function showToast(message, type = 'info') {
    console.log(`🔔 [${type}]: ${message}`);
    
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        toast.innerHTML = `
            <i class="toast-icon"></i>
            <div class="toast-message"></div>
        `;
        document.body.appendChild(toast);
    }
    
    const toastIcon = toast.querySelector('.toast-icon');
    if (toastIcon) {
        toastIcon.className = 'toast-icon';
        if (type === 'success') toastIcon.classList.add('fas', 'fa-check-circle');
        else if (type === 'error') toastIcon.classList.add('fas', 'fa-exclamation-circle');
        else if (type === 'warning') toastIcon.classList.add('fas', 'fa-exclamation-triangle');
        else toastIcon.classList.add('fas', 'fa-info-circle');
    }
    
    const toastMessage = toast.querySelector('.toast-message');
    if (toastMessage) toastMessage.textContent = message;
    
    toast.className = `toast toast-${type}`;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ========== MODAL MANAGEMENT ==========
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    } else {
        console.error('Modal not found:', modalId);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

function showModalWithContent(modalId, content) {
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    modal.innerHTML = content;
    modal.style.display = 'flex';
}

// ========== STAR RATING ==========
function generateStarRating(rating) {
    if (!rating) rating = 0;
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= rating) {
            stars += '<i class="fas fa-star" style="color: var(--warning);"></i>';
        } else if (i - 0.5 <= rating) {
            stars += '<i class="fas fa-star-half-alt" style="color: var(--warning);"></i>';
        } else {
            stars += '<i class="far fa-star" style="color: var(--warning);"></i>';
        }
    }
    return stars;
}

// ========== FORMAT PRICE ==========
function formatPrice(amount, currency = 'KES') {
    const symbols = {
        'KES': 'KSh', 'UGX': 'USh', 'TZS': 'TSh', 'NGN': '₦', 'GHS': '₵', 'ZAR': 'R', 'USD': '$', 'EUR': '€', 'GBP': '£'
    };
    const symbol = symbols[currency] || currency;
    return `${symbol} ${parseInt(amount || 0).toLocaleString()}`;
}

// ========== GET CATEGORY ICON ==========
function getCategoryIcon(category) {
    const icons = {
        'electronics': 'fas fa-tv',
        'phones': 'fas fa-mobile-alt',
        'computers': 'fas fa-laptop',
        'furniture': 'fas fa-couch',
        'mitumba': 'fas fa-tshirt',
        'clothing': 'fas fa-tshirt',
        'vehicles': 'fas fa-car',
        'books': 'fas fa-book',
        'sports': 'fas fa-basketball-ball',
        'services': 'fas fa-tools',
        'hotel': 'fas fa-hotel',
        'gas-refill': 'fas fa-fire',
        'water-delivery': 'fas fa-tint',
        'land': 'fas fa-vector-square',
        'rooms': 'fas fa-door-open',
        'bedsitters': 'fas fa-bed',
        'apartments': 'fas fa-building',
        'houses': 'fas fa-home',
        'short-stays': 'fas fa-hotel',
        'home-appliances': 'fas fa-blender',
        'other': 'fas fa-box'
    };
    return icons[category] || 'fas fa-box';
}

// ========== AUTH MODAL (UPDATED) ==========
function openAuthModal() {
    // Close more section first
    const moreSection = document.getElementById('more-section');
    if (moreSection) {
        moreSection.style.display = 'none';
        moreSection.classList.remove('active');
    }
    // Show main bottom nav
    const mainBottomNav = document.querySelector('.bottom-nav');
    if (mainBottomNav) mainBottomNav.style.display = 'flex';
    // Hide more bottom nav
    const moreBottomNav = document.querySelector('.more-bottom-nav');
    if (moreBottomNav) moreBottomNav.style.display = 'none';
    
    const authModal = document.getElementById('auth-modal');
    if (authModal) {
        authModal.style.display = 'block';
        authModal.style.zIndex = '100000';
    } else {
        showToast('Please refresh the page', 'error');
    }
}

function quickAuthModal() {
    openAuthModal();
}

// ========== DARK MODE ==========
function initDarkMode() {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode === 'enabled') {
        document.documentElement.setAttribute('data-theme', 'dark');
        const darkModeSwitch = document.getElementById('settings-dark-mode-switch');
        if (darkModeSwitch) darkModeSwitch.checked = true;
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
}

function toggleDarkMode() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('darkMode', 'disabled');
        showToast('Light mode enabled', 'success');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('darkMode', 'enabled');
        showToast('Dark mode enabled', 'success');
    }
    
    const darkModeSwitch = document.getElementById('settings-dark-mode-switch');
    if (darkModeSwitch) darkModeSwitch.checked = !isDark;
}

// ========== FILE SIZE ==========
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ========== COPY TO CLIPBOARD ==========
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!', 'success');
    }).catch(() => {
        showToast('Copy manually: ' + text, 'info');
    });
}

// ========== GENERATE UNIQUE ID ==========
function generateUniqueId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ========== DEBOUNCE ==========
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ========== EXPORT ALL FUNCTIONS ==========
window.escapeHtml = escapeHtml;
window.formatTimeAgo = formatTimeAgo;
window.showToast = showToast;
window.showModal = showModal;
window.closeModal = closeModal;
window.showModalWithContent = showModalWithContent;
window.generateStarRating = generateStarRating;
window.formatPrice = formatPrice;
window.getCategoryIcon = getCategoryIcon;
window.openAuthModal = openAuthModal;
window.quickAuthModal = quickAuthModal;
window.initDarkMode = initDarkMode;
window.toggleDarkMode = toggleDarkMode;
window.formatFileSize = formatFileSize;
window.copyToClipboard = copyToClipboard;
window.generateUniqueId = generateUniqueId;
window.debounce = debounce;

console.log('✅ utils.js loaded');