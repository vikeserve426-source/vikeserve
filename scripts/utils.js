
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

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

let activeToastTimeout = null;

function showToast(message, type = 'info') {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        toast.innerHTML = `
            <div class="toast-icon"></div>
            <div class="toast-message"></div>
        `;
        document.body.appendChild(toast);
    }

    if (activeToastTimeout) {
        clearTimeout(activeToastTimeout);
        activeToastTimeout = null;
    }

    toast.classList.remove('show');

    setTimeout(() => {
        const toastIcon = toast.querySelector('.toast-icon');
        if (toastIcon) {
            toastIcon.innerHTML = '';
            toastIcon.className = 'toast-icon';
            if (type === 'success') toastIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
            else if (type === 'error') toastIcon.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
            else if (type === 'warning') toastIcon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
            else toastIcon.innerHTML = '<i class="fas fa-info-circle"></i>';
        }

        const toastMessage = toast.querySelector('.toast-message');
        if (toastMessage) toastMessage.textContent = message;

        toast.className = `toast toast-${type}`;
        toast.classList.add('show');

        activeToastTimeout = setTimeout(() => {
            toast.classList.remove('show');
            activeToastTimeout = null;
        }, 3000);

        toast.onclick = () => {
            toast.classList.remove('show');
            if (activeToastTimeout) {
                clearTimeout(activeToastTimeout);
                activeToastTimeout = null;
            }
        };
    }, 10);
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '20000';
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
    modal.style.cssText = `
        display: flex !important;
        z-index: 20002 !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background-color: rgba(0, 0, 0, 0.5) !important;
        overflow-y: auto !important;
        padding: 20px !important;
        box-sizing: border-box !important;
    `;

    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.style.cssText = `
            max-width: 500px !important;
            width: 100% !important;
            margin: 10px auto !important;
            box-sizing: border-box !important;
        `;
    }

    setTimeout(() => {
        const closeBtn = modal.querySelector('.close-modal-btn');
        if (closeBtn) {
            const newBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newBtn, closeBtn);
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                modal.style.display = 'none';
                document.body.style.overflow = '';
                setTimeout(() => {
                    if (modal.parentNode) {
                        modal.remove();
                    }
                }, 300);
            });
        }

        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
                document.body.style.overflow = '';
                setTimeout(() => {
                    if (this.parentNode) {
                        this.remove();
                    }
                }, 300);
            }
        });
    }, 100);
}

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

function formatPrice(amount, currency = 'KES') {
    const symbols = {
        'KES': 'KSh', 'UGX': 'USh', 'TZS': 'TSh', 'NGN': '₦', 'GHS': '₵', 'ZAR': 'R', 'USD': '$', 'EUR': '€', 'GBP': '£'
    };
    const symbol = symbols[currency] || currency;
    return `${symbol} ${parseInt(amount || 0).toLocaleString()}`;
}

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

function openAuthModal() {
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
        authModal.style.display = 'block';
        authModal.style.zIndex = '100000';
    } else {
        showToast('Please refresh the page', 'error');
    }
}

function quickAuthModal() {
    openAuthModal();
}

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

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!', 'success');
    }).catch(() => {
        showToast('Copy manually: ' + text, 'info');
    });
}

function generateUniqueId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

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

const POINTS_CONFIG = {
    ratingPoints: {
        5: 10,   // 5 stars = 10 points
        4: 6,    // 4 stars = 6 points
        3: 3,    // 3 stars = 3 points
        2: 1,    // 2 stars = 1 point
        1: 0     // 1 star = 0 points
    },

    maxPointsPercentage: 30,

    pointValue: 1,

    adPackages: [
        { id: 'basic', name: 'Basic Boost', price: 100, days: 3, maxPoints: 30 },
        { id: 'premium', name: 'Premium Reach', price: 250, days: 7, maxPoints: 75 },
        { id: 'pro', name: 'Pro Featured', price: 500, days: 14, maxPoints: 150 },
        { id: 'vip', name: 'VIP Spotlight', price: 1000, days: 30, maxPoints: 300 }
    ]
};

function getPointsForRating(rating) {
    const stars = Math.floor(rating);
    return POINTS_CONFIG.ratingPoints[stars] || 0;
}

function calculatePointsDiscount(packagePrice, userPoints) {
    const maxPointsAllowed = Math.floor(packagePrice * POINTS_CONFIG.maxPointsPercentage / 100);
    const pointsToUse = Math.min(userPoints, maxPointsAllowed);
    const discount = pointsToUse * POINTS_CONFIG.pointValue;
    const finalAmount = Math.max(0, packagePrice - discount);

    return {
        pointsToUse: pointsToUse,
        discount: discount,
        finalAmount: finalAmount,
        remainingPoints: userPoints - pointsToUse,
        cashToPay: finalAmount,
        pointsUsedPercentage: Math.round((pointsToUse / packagePrice) * 100)
    };
}

window.POINTS_CONFIG = POINTS_CONFIG;
window.getPointsForRating = getPointsForRating;
window.calculatePointsDiscount = calculatePointsDiscount;

function getRoleDisplay(role) {
    const roleMap = {
        'founder': '<span class="role-badge founder"><i class="fas fa-crown"></i> Founder</span>',
        'cofounder': '<span class="role-badge cofounder"><i class="fas fa-handshake"></i> Co-Founder</span>',
        'admin': '<span class="role-badge admin"><i class="fas fa-shield-alt"></i> Admin</span>',
        'moderator': '<span class="role-badge moderator"><i class="fas fa-gavel"></i> Moderator</span>',
        'general-user': '<span class="role-badge user"><i class="fas fa-user"></i> User</span>'
    };
    return roleMap[role] || roleMap['general-user'];
}

function getRoleName(role) {
    const roleMap = {
        'founder': 'Founder',
        'cofounder': 'Co-Founder',
        'admin': 'Admin',
        'moderator': 'Moderator',
        'general-user': 'User'
    };
    return roleMap[role] || 'User';
}

window.getRoleDisplay = getRoleDisplay;
window.getRoleName = getRoleName;

