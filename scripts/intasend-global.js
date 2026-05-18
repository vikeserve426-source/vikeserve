// intasend-global.js - Complete Global Payment System with Ad Actions
// Supports: M-Pesa, Airtel Money, MTN Uganda, Visa/Mastercard, PayPal, etc.

class VikeServeGlobalPayments {
    constructor() {
        this.config = {
            intasend: {
                publicKey: 'ISPubKey_live_7b219b83-74bc-4661-90ce-126679748f2e',
                environment: 'live'
            },
            fallbackToManualCode: true
        };
        
        this.userCountry = 'KE';
        this.userCurrency = 'KES';
        this.userId = null;
        this.userEmail = null;
        this.userPhone = null;
        this.pendingVerifications = new Map();
        this.useFallbackMode = false;
        this.init();
    }

    async init() {
        console.log('🌍 VikeServe Global Payments initializing...');
        
        // Get current user
        if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().onAuthStateChanged((user) => {
                if (user) {
                    this.userId = user.uid;
                    this.userEmail = user.email;
                    this.userPhone = user.phoneNumber || '';
                } else {
                    this.userId = null;
                }
            });
        }
        
        await this.detectUserCountry();
        this.loadPaymentHistoryFromStorage();
        
        console.log('✅ Payment system ready! Country:', this.userCountry, 'Currency:', this.userCurrency);
    }

    async detectUserCountry() {
        try {
            // Try to get from saved location
            const savedLocation = localStorage.getItem('vikeserve_location');
            if (savedLocation) {
                const locationData = JSON.parse(savedLocation);
                this.userCountry = this.getCountryCode(locationData.country || '');
            }
            
            // Try to get from app's location system
            if (typeof window.getCurrentLocation === 'function') {
                const appLocation = window.getCurrentLocation();
                if (appLocation && appLocation.country) {
                    this.userCountry = this.getCountryCode(appLocation.country);
                }
            }
        } catch (error) {
            console.log('Using default country: KE');
            this.userCountry = 'KE';
        }
        
        this.userCurrency = this.getCurrencyForCountry(this.userCountry);
    }

    getCountryCode(countryName) {
        const countryMap = {
            'Kenya': 'KE', 'Uganda': 'UG', 'Tanzania': 'TZ', 'Rwanda': 'RW',
            'Nigeria': 'NG', 'Ghana': 'GH', 'South Africa': 'ZA',
            'United States': 'US', 'USA': 'US', 'United Kingdom': 'GB', 'UK': 'GB'
        };
        return countryMap[countryName] || 'KE';
    }

    getCurrencyForCountry(country) {
        const currencies = {
            'KE': 'KES', 'UG': 'UGX', 'TZ': 'TZS', 'RW': 'RWF',
            'NG': 'NGN', 'GH': 'GHS', 'ZA': 'ZAR',
            'US': 'USD', 'GB': 'GBP', 'UK': 'GBP'
        };
        return currencies[country] || 'USD';
    }

    // ========== GET PAYMENT METHODS BASED ON COUNTRY ==========
    getAvailablePaymentMethods() {
        const methods = {
            // Kenya specific
            'KE': [
                { id: 'mpesa', name: 'M-Pesa', icon: 'fas fa-mobile-alt', requires: ['phone'], type: 'mobile_money' },
                { id: 'airtel_kenya', name: 'Airtel Money', icon: 'fas fa-mobile-alt', requires: ['phone'], type: 'mobile_money' },
                { id: 'card', name: 'Credit/Debit Card', icon: 'fab fa-cc-visa', requires: ['card'], type: 'card' },
                { id: 'paypal', name: 'PayPal', icon: 'fab fa-paypal', requires: ['email'], type: 'global' }
            ],
            // Uganda specific
            'UG': [
                { id: 'mtn_uganda', name: 'MTN Uganda Money', icon: 'fas fa-mobile-alt', requires: ['phone'], type: 'mobile_money' },
                { id: 'airtel_uganda', name: 'Airtel Money Uganda', icon: 'fas fa-mobile-alt', requires: ['phone'], type: 'mobile_money' },
                { id: 'card', name: 'Credit/Debit Card', icon: 'fab fa-cc-visa', requires: ['card'], type: 'card' },
                { id: 'paypal', name: 'PayPal', icon: 'fab fa-paypal', requires: ['email'], type: 'global' }
            ],
            // Tanzania specific
            'TZ': [
                { id: 'mpesa_tz', name: 'M-Pesa Tanzania', icon: 'fas fa-mobile-alt', requires: ['phone'], type: 'mobile_money' },
                { id: 'tigo_pesa', name: 'Tigo Pesa', icon: 'fas fa-mobile-alt', requires: ['phone'], type: 'mobile_money' },
                { id: 'airtel_tz', name: 'Airtel Money', icon: 'fas fa-mobile-alt', requires: ['phone'], type: 'mobile_money' },
                { id: 'card', name: 'Credit/Debit Card', icon: 'fab fa-cc-visa', requires: ['card'], type: 'card' }
            ],
            // Nigeria specific
            'NG': [
                { id: 'paystack', name: 'Paystack (Card/Bank)', icon: 'fas fa-credit-card', requires: ['email'], type: 'card' },
                { id: 'flutterwave', name: 'Flutterwave', icon: 'fas fa-globe', requires: ['email'], type: 'global' },
                { id: 'card', name: 'Credit/Debit Card', icon: 'fab fa-cc-visa', requires: ['card'], type: 'card' }
            ],
            // Global fallback for all other countries
            'GLOBAL': [
                { id: 'card', name: 'Credit/Debit Card', icon: 'fab fa-cc-visa', requires: ['card'], type: 'card' },
                { id: 'paypal', name: 'PayPal', icon: 'fab fa-paypal', requires: ['email'], type: 'global' },
                { id: 'bank_transfer', name: 'Bank Transfer', icon: 'fas fa-university', requires: ['bank'], type: 'global' },
                { id: 'crypto', name: 'Cryptocurrency', icon: 'fab fa-bitcoin', requires: ['wallet'], type: 'global' }
            ]
        };
        
        return methods[this.userCountry] || methods['GLOBAL'];
    }

    // ========== CHECK LOGIN AND SHOW AUTH MODAL ==========
    async checkLoginAndContinue(callback) {
        const user = firebase.auth().currentUser;
        
        if (!user) {
            // Show auth modal first
            if (typeof window.showAuthModal === 'function') {
                window.showAuthModal();
                // Store callback to execute after login
                window.pendingPromotionCallback = callback;
                if (typeof window.showToast === 'function') {
                    window.showToast('Please sign in to continue', 'warning');
                }
            } else if (typeof window.openAuthModal === 'function') {
                window.openAuthModal();
                window.pendingPromotionCallback = callback;
            } else {
                // Fallback: try to open the auth modal manually
                const authModal = document.getElementById('auth-modal');
                if (authModal) {
                    authModal.style.display = 'flex';
                    window.pendingPromotionCallback = callback;
                }
            }
            return false;
        }
        
        this.userId = user.uid;
        this.userEmail = user.email;
        this.userPhone = user.phoneNumber || '';
        return true;
    }

    // ========== MAIN SHOW AD PACKAGES FUNCTION ==========
// ========== MAIN SHOW AD PACKAGES FUNCTION ==========
async showAdPackagesModal(adId = null) {
    console.log('showAdPackagesModal called with adId:', adId);
    
    // First check if user is logged in
    const isLoggedIn = await this.checkLoginAndContinue(() => {
        this.showAdPackagesModal(adId);
    });
    
    if (!isLoggedIn) return;
    
    // Get user's ads (await the async function)
    const userAds = await this.getUserAds();
    
    if (userAds.length === 0) {
        if (typeof window.showToast === 'function') {
            window.showToast('You don\'t have any ads yet. Please create an ad first!', 'warning');
        }
        // Open the marketplace post modal instead of showing error
        setTimeout(() => {
            const marketplaceModal = document.getElementById('marketplace-post-modal');
            if (marketplaceModal) {
                marketplaceModal.style.display = 'flex';
                marketplaceModal.style.zIndex = '10001';
            } else if (typeof window.showMarketplacePostModal === 'function') {
                window.showMarketplacePostModal();
            }
        }, 1000);
        return;
    }
    
    // Show the ad packages modal
    const modalContent = this.createFullAdPromotionModal(userAds, adId);
    
    // Create or get modal
    let modal = document.getElementById('ad-packages-full-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'ad-packages-full-modal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = modalContent;
    modal.style.display = 'flex';
    modal.style.zIndex = '10001';
    
    // Setup all event listeners after modal is added to DOM
    setTimeout(() => {
        this.setupAdPromotionModalEvents(adId);
    }, 100);
}

async getUserAds() {
    try {
        const snapshot = await firebase.firestore()
            .collection('marketplace_items')
            .where('userId', '==', this.userId)
            .where('status', '==', 'active')
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error loading user ads from Firebase:', error);
        return [];
    }
}
    createFullAdPromotionModal(userAds, selectedAdId = null) {
        const packages = [
            { id: 'basic', name: 'Basic Boost', price: 100, duration: 3, color: '#27ae60', tag: 'POPULAR' },
            { id: 'premium', name: 'Premium Reach', price: 250, duration: 7, color: '#2E86DE', tag: 'BEST VALUE' },
            { id: 'pro', name: 'Pro Featured', price: 500, duration: 14, color: '#f39c12', tag: 'HOT' },
            { id: 'vip', name: 'VIP Spotlight', price: 1000, duration: 30, color: '#e74c3c', tag: 'VIP' }
        ];
        
        const paymentMethods = this.getAvailablePaymentMethods();
        
        return `
            <div class="modal-content" style="max-width: 550px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <div class="modal-title"><i class="fas fa-rocket"></i> Promote Your Ad</div>
                    <button class="close-modal-btn" onclick="document.getElementById('ad-packages-full-modal').style.display='none'">&times;</button>
                </div>
                
                <div style="padding: 20px;">
                    <!-- Step Indicator -->
                    <div class="promotion-steps" style="display: flex; margin-bottom: 30px; justify-content: space-between;">
                        <div class="step active" data-step="1" style="text-align: center; flex: 1;"><div style="width: 30px; height: 30px; background: var(--primary); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: white;">1</div><div style="font-size: 0.7rem; margin-top: 5px;">Select Ad</div></div>
                        <div class="step" data-step="2" style="text-align: center; flex: 1;"><div style="width: 30px; height: 30px; background: var(--grey); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: white;">2</div><div style="font-size: 0.7rem; margin-top: 5px;">Package</div></div>
                        <div class="step" data-step="3" style="text-align: center; flex: 1;"><div style="width: 30px; height: 30px; background: var(--grey); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: white;">3</div><div style="font-size: 0.7rem; margin-top: 5px;">Ad Action</div></div>
                        <div class="step" data-step="4" style="text-align: center; flex: 1;"><div style="width: 30px; height: 30px; background: var(--grey); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: white;">4</div><div style="font-size: 0.7rem; margin-top: 5px;">Payment</div></div>
                    </div>
                    
                    <!-- STEP 1: Select Ad -->
                    <div id="promo-step-1" class="promo-step">
                        <h3 style="margin-bottom: 15px;">Select Ad to Promote</h3>
                        <div class="form-group">
                            <label class="form-label">Your Ads</label>
                            <select id="promo-ad-select" class="form-input">
                                <option value="">-- Select an ad --</option>
                                ${userAds.map(ad => `<option value="${ad.id}" ${selectedAdId == ad.id ? 'selected' : ''}>${ad.title.substring(0, 50)} - KES ${ad.price}</option>`).join('')}
                            </select>
                        </div>
                        <div id="promo-ad-preview" style="display: none; margin: 15px 0; padding: 15px; background: var(--light); border-radius: 10px;"></div>
                        <button class="btn btn-primary" id="promo-step1-next" style="margin-top: 15px;">Continue →</button>
                    </div>
                    
                    <!-- STEP 2: Select Package -->
                    <div id="promo-step-2" class="promo-step" style="display: none;">
                        <h3 style="margin-bottom: 15px;">Select Promotion Package</h3>
                        <div class="packages-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                            ${packages.map(pkg => `
                                <div class="package-card" data-package-id="${pkg.id}" data-package-name="${pkg.name}" data-package-price="${pkg.price}" data-package-duration="${pkg.duration}" style="padding: 15px; border: 2px solid var(--grey); border-radius: 10px; cursor: pointer; text-align: center; transition: all 0.2s;">
                                    ${pkg.tag ? `<span style="position: absolute; margin-top: -25px; margin-left: -5px; background: ${pkg.color}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.6rem;">${pkg.tag}</span>` : ''}
                                    <div style="font-weight: 700; font-size: 1rem;">${pkg.name}</div>
                                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary); margin: 10px 0;">KES ${pkg.price}</div>
                                    <div style="font-size: 0.7rem; color: var(--grey-dark);">${pkg.duration} days promotion</div>
                                </div>
                            `).join('')}
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button class="btn btn-outline" id="promo-step2-back">← Back</button>
                            <button class="btn btn-primary" id="promo-step2-next" disabled>Continue →</button>
                        </div>
                    </div>
                    
                    <!-- STEP 3: Configure Ad Action -->
                    <div id="promo-step-3" class="promo-step" style="display: none;">
                        <h3 style="margin-bottom: 15px;">What happens when someone clicks your ad?</h3>
                        <div class="action-options" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px;">
                            <div class="action-option" data-action="whatsapp" style="padding: 12px; border: 2px solid var(--grey); border-radius: 8px; text-align: center; cursor: pointer;">
                                <i class="fab fa-whatsapp" style="font-size: 1.5rem; color: #25D366;"></i>
                                <div>WhatsApp</div>
                            </div>
                            <div class="action-option" data-action="phone" style="padding: 12px; border: 2px solid var(--grey); border-radius: 8px; text-align: center; cursor: pointer;">
                                <i class="fas fa-phone" style="font-size: 1.5rem; color: var(--primary);"></i>
                                <div>Phone Call</div>
                            </div>
                            <div class="action-option" data-action="email" style="padding: 12px; border: 2px solid var(--grey); border-radius: 8px; text-align: center; cursor: pointer;">
                                <i class="fas fa-envelope" style="font-size: 1.5rem; color: #EA4335;"></i>
                                <div>Email</div>
                            </div>
                            <div class="action-option" data-action="link" style="padding: 12px; border: 2px solid var(--grey); border-radius: 8px; text-align: center; cursor: pointer;">
                                <i class="fas fa-link" style="font-size: 1.5rem; color: #34A853;"></i>
                                <div>Website Link</div>
                            </div>
                        </div>
                        
                        <div id="action-details-container" style="display: none;">
                            <!-- WhatsApp Details -->
                            <div id="action-whatsapp-details" class="action-detail" style="display: none;">
                                <div class="form-group"><label class="form-label">WhatsApp Number *</label><input type="tel" id="action-whatsapp-number" class="form-input" placeholder="e.g., 254712345678"></div>
                                <div class="form-group"><label class="form-label">Auto Message (Optional)</label><textarea id="action-whatsapp-message" class="form-input" rows="2" placeholder="Hi! I'm interested in your ad on VikeServe..."></textarea></div>
                            </div>
                            <!-- Phone Details -->
                            <div id="action-phone-details" class="action-detail" style="display: none;">
                                <div class="form-group"><label class="form-label">Phone Number *</label><input type="tel" id="action-phone-number" class="form-input" placeholder="e.g., 254712345678"></div>
                            </div>
                            <!-- Email Details -->
                            <div id="action-email-details" class="action-detail" style="display: none;">
                                <div class="form-group"><label class="form-label">Email Address *</label><input type="email" id="action-email-address" class="form-input" placeholder="your@email.com"></div>
                                <div class="form-group"><label class="form-label">Email Subject</label><input type="text" id="action-email-subject" class="form-input" placeholder="Interested in your ad"></div>
                            </div>
                            <!-- Link Details -->
                            <div id="action-link-details" class="action-detail" style="display: none;">
                                <div class="form-group"><label class="form-label">Website URL *</label><input type="url" id="action-link-url" class="form-input" placeholder="https://yourwebsite.com"></div>
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button class="btn btn-outline" id="promo-step3-back">← Back</button>
                            <button class="btn btn-primary" id="promo-step3-next" disabled>Continue →</button>
                        </div>
                    </div>
                    
                    <!-- STEP 4: Payment -->
                    <div id="promo-step-4" class="promo-step" style="display: none;">
                        <h3 style="margin-bottom: 15px;">Complete Payment</h3>
                        
                        <div id="payment-summary" style="background: var(--light); padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                            <div><strong>Ad:</strong> <span id="summary-ad-name">-</span></div>
                            <div><strong>Package:</strong> <span id="summary-package-name">-</span> (<span id="summary-package-duration">-</span> days)</div>
                            <div><strong>Amount:</strong> <span id="summary-package-price" style="font-size: 1.2rem; font-weight: 700; color: var(--primary);">KES 0</span></div>
                            <div><strong>Action:</strong> <span id="summary-action-name">-</span></div>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Select Payment Method</label>
                            <div class="payment-methods-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                                ${paymentMethods.map(method => `
                                    <div class="payment-method" data-method-id="${method.id}" data-method-name="${method.name}" data-method-type="${method.type}" style="padding: 12px; border: 2px solid var(--grey); border-radius: 8px; text-align: center; cursor: pointer;">
                                        <i class="${method.icon}" style="font-size: 1.2rem;"></i>
                                        <div style="font-size: 0.8rem;">${method.name}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <!-- Payment Details Forms -->
                        <div id="payment-details-container" style="display: none;">
                            <!-- Mobile Money Details (M-Pesa, Airtel, MTN) -->
                            <div id="mobile-money-details" class="payment-detail" style="display: none;">
                                <div class="form-group">
                                    <label class="form-label">Phone Number *</label>
                                    <input type="tel" id="payment-phone-number" class="form-input" placeholder="e.g., 254712345678" value="${this.userPhone || ''}">
                                    <div class="form-hint">You will receive a prompt on your phone to enter PIN</div>
                                </div>
                            </div>
                            <!-- Card Details -->
                            <div id="card-details" class="payment-detail" style="display: none;">
                                <div class="form-group"><label class="form-label">Card Number *</label><input type="text" id="payment-card-number" class="form-input" placeholder="4242 4242 4242 4242"></div>
                                <div class="form-row"><div class="form-group"><label>Expiry *</label><input type="text" id="payment-card-expiry" class="form-input" placeholder="MM/YY"></div><div class="form-group"><label>CVV *</label><input type="text" id="payment-card-cvv" class="form-input" placeholder="123"></div></div>
                                <div class="form-group"><label class="form-label">Cardholder Name</label><input type="text" id="payment-card-name" class="form-input" placeholder="Name on card"></div>
                            </div>
                            <!-- PayPal Details -->
                            <div id="paypal-details" class="payment-detail" style="display: none;">
                                <div class="form-group"><label class="form-label">PayPal Email *</label><input type="email" id="payment-paypal-email" class="form-input" placeholder="your@paypal.com" value="${this.userEmail || ''}"></div>
                            </div>
                            <!-- Bank Transfer Details -->
                            <div id="bank-details" class="payment-detail" style="display: none;">
                                <div class="form-group"><label class="form-label">Bank Name</label><input type="text" id="payment-bank-name" class="form-input" placeholder="Your bank"></div>
                                <div class="form-group"><label class="form-label">Account Number</label><input type="text" id="payment-account-number" class="form-input" placeholder="Account number"></div>
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button class="btn btn-outline" id="promo-step4-back">← Back</button>
                            <button class="btn btn-primary" id="promo-submit-payment" disabled>Pay & Activate Ad</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    setupAdPromotionModalEvents(selectedAdId = null) {
        let selectedAd = null;
        let selectedPackage = null;
        let selectedAction = null;
        let selectedActionDetails = null;
        let selectedPaymentMethod = null;
        
        // Step 1: Select Ad
        const adSelect = document.getElementById('promo-ad-select');
        const adPreview = document.getElementById('promo-ad-preview');
        const step1Next = document.getElementById('promo-step1-next');
        
if (adSelect) {
    adSelect.addEventListener('change', async () => {
        const adId = adSelect.value;
        if (adId) {
            const userAds = await this.getUserAds();
            selectedAd = userAds.find(ad => ad.id == adId);
                    if (selectedAd && adPreview) {
                        adPreview.style.display = 'block';
                        adPreview.innerHTML = `
                            <div style="display: flex; gap: 10px;">
                                <div style="width: 50px; height: 50px; background: var(--primary); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                                    <i class="fas fa-tag" style="color: white;"></i>
                                </div>
                                <div>
                                    <div style="font-weight: 600;">${selectedAd.title}</div>
                                    <div style="font-size: 0.75rem; color: var(--grey-dark);">KES ${selectedAd.price} • ${selectedAd.location || 'Nairobi'}</div>
                                </div>
                            </div>
                        `;
                    }
                    if (step1Next) step1Next.disabled = false;
                } else {
                    if (adPreview) adPreview.style.display = 'none';
                    if (step1Next) step1Next.disabled = true;
                }
            });
            
if (selectedAdId && adSelect) {
    adSelect.value = selectedAdId;
    setTimeout(() => {
        adSelect.dispatchEvent(new Event('change'));
    }, 100);
}
        }
        
        if (step1Next) {
            step1Next.addEventListener('click', () => {
                if (selectedAd) {
                    this.goToPromoStep(2);
                }
            });
        }
        
        // Step 2: Select Package
        const packageCards = document.querySelectorAll('.package-card');
        const step2Next = document.getElementById('promo-step2-next');
        const step2Back = document.getElementById('promo-step2-back');
        
        packageCards.forEach(card => {
            card.addEventListener('click', () => {
                packageCards.forEach(c => c.style.borderColor = 'var(--grey)');
                card.style.borderColor = 'var(--primary)';
                card.style.backgroundColor = 'rgba(46, 134, 222, 0.1)';
                
                selectedPackage = {
                    id: card.getAttribute('data-package-id'),
                    name: card.getAttribute('data-package-name'),
                    price: parseInt(card.getAttribute('data-package-price')),
                    duration: parseInt(card.getAttribute('data-package-duration'))
                };
                
                if (step2Next) step2Next.disabled = false;
            });
        });
        
        if (step2Next) {
            step2Next.addEventListener('click', () => {
                if (selectedPackage) {
                    this.goToPromoStep(3);
                }
            });
        }
        
        if (step2Back) {
            step2Back.addEventListener('click', () => this.goToPromoStep(1));
        }
        
        // Step 3: Configure Action
        const actionOptions = document.querySelectorAll('.action-option');
        const actionDetailsContainer = document.getElementById('action-details-container');
        const step3Next = document.getElementById('promo-step3-next');
        const step3Back = document.getElementById('promo-step3-back');
        
        actionOptions.forEach(option => {
            option.addEventListener('click', () => {
                actionOptions.forEach(opt => opt.style.borderColor = 'var(--grey)');
                option.style.borderColor = 'var(--primary)';
                
                selectedAction = option.getAttribute('data-action');
                
                // Show relevant details form
                if (actionDetailsContainer) actionDetailsContainer.style.display = 'block';
                document.querySelectorAll('.action-detail').forEach(detail => detail.style.display = 'none');
                
                const detailForm = document.getElementById(`action-${selectedAction}-details`);
                if (detailForm) detailForm.style.display = 'block';
                
                if (step3Next) step3Next.disabled = false;
            });
        });
        
        if (step3Next) {
            step3Next.addEventListener('click', () => {
                // Validate action details
                let isValid = true;
                
                switch(selectedAction) {
                    case 'whatsapp':
                        const phone = document.getElementById('action-whatsapp-number')?.value;
                        if (!phone || phone.length < 10) {
                            if (typeof window.showToast === 'function') window.showToast('Please enter a valid WhatsApp number', 'error');
                            isValid = false;
                        } else {
                            selectedActionDetails = {
                                number: phone,
                                message: document.getElementById('action-whatsapp-message')?.value || ''
                            };
                        }
                        break;
                    case 'phone':
                        const callPhone = document.getElementById('action-phone-number')?.value;
                        if (!callPhone || callPhone.length < 10) {
                            if (typeof window.showToast === 'function') window.showToast('Please enter a valid phone number', 'error');
                            isValid = false;
                        } else {
                            selectedActionDetails = callPhone;
                        }
                        break;
                    case 'email':
                        const email = document.getElementById('action-email-address')?.value;
                        if (!email || !email.includes('@')) {
                            if (typeof window.showToast === 'function') window.showToast('Please enter a valid email address', 'error');
                            isValid = false;
                        } else {
                            selectedActionDetails = {
                                email: email,
                                subject: document.getElementById('action-email-subject')?.value || 'Interested in your ad on VikeServe'
                            };
                        }
                        break;
                    case 'link':
                        const url = document.getElementById('action-link-url')?.value;
                        if (!url || !url.startsWith('http')) {
                            if (typeof window.showToast === 'function') window.showToast('Please enter a valid website URL (https://...)', 'error');
                            isValid = false;
                        } else {
                            selectedActionDetails = url;
                        }
                        break;
                }
                
                if (isValid && selectedAction && selectedActionDetails) {
                    // Update summary
                    const summaryAd = document.getElementById('summary-ad-name');
                    const summaryPackage = document.getElementById('summary-package-name');
                    const summaryDuration = document.getElementById('summary-package-duration');
                    const summaryPrice = document.getElementById('summary-package-price');
                    const summaryAction = document.getElementById('summary-action-name');
                    
                    if (summaryAd) summaryAd.textContent = selectedAd?.title || '-';
                    if (summaryPackage) summaryPackage.textContent = selectedPackage?.name || '-';
                    if (summaryDuration) summaryDuration.textContent = selectedPackage?.duration || '-';
                    if (summaryPrice) summaryPrice.textContent = `KES ${selectedPackage?.price || 0}`;
                    
                    const actionNames = { 'whatsapp': 'WhatsApp', 'phone': 'Phone Call', 'email': 'Email', 'link': 'Website' };
                    if (summaryAction) summaryAction.textContent = actionNames[selectedAction] || '-';
                    
                    this.goToPromoStep(4);
                }
            });
        }
        
        if (step3Back) {
            step3Back.addEventListener('click', () => this.goToPromoStep(2));
        }
        
        // Step 4: Payment
        const paymentMethods = document.querySelectorAll('.payment-method');
        const paymentDetailsContainer = document.getElementById('payment-details-container');
        const submitPaymentBtn = document.getElementById('promo-submit-payment');
        const step4Back = document.getElementById('promo-step4-back');
        
        paymentMethods.forEach(method => {
            method.addEventListener('click', () => {
                paymentMethods.forEach(m => m.style.borderColor = 'var(--grey)');
                method.style.borderColor = 'var(--primary)';
                
                selectedPaymentMethod = {
                    id: method.getAttribute('data-method-id'),
                    name: method.getAttribute('data-method-name'),
                    type: method.getAttribute('data-method-type')
                };
                
                // Show relevant payment details form
                if (paymentDetailsContainer) paymentDetailsContainer.style.display = 'block';
                document.querySelectorAll('.payment-detail').forEach(detail => detail.style.display = 'none');
                
                if (selectedPaymentMethod.type === 'mobile_money') {
                    const mobileForm = document.getElementById('mobile-money-details');
                    if (mobileForm) mobileForm.style.display = 'block';
                } else if (selectedPaymentMethod.id === 'card') {
                    const cardForm = document.getElementById('card-details');
                    if (cardForm) cardForm.style.display = 'block';
                } else if (selectedPaymentMethod.id === 'paypal') {
                    const paypalForm = document.getElementById('paypal-details');
                    if (paypalForm) paypalForm.style.display = 'block';
                } else if (selectedPaymentMethod.id === 'bank_transfer') {
                    const bankForm = document.getElementById('bank-details');
                    if (bankForm) bankForm.style.display = 'block';
                }
                
                if (submitPaymentBtn) submitPaymentBtn.disabled = false;
            });
        });
        
        if (submitPaymentBtn) {
            submitPaymentBtn.addEventListener('click', async () => {
                if (!selectedPaymentMethod) {
                    if (typeof window.showToast === 'function') window.showToast('Please select a payment method', 'warning');
                    return;
                }
                
                // Collect payment details
                let paymentDetails = {};
                
                if (selectedPaymentMethod.type === 'mobile_money') {
                    const phone = document.getElementById('payment-phone-number')?.value;
                    if (!phone || phone.length < 10) {
                        if (typeof window.showToast === 'function') window.showToast('Please enter a valid phone number', 'error');
                        return;
                    }
                    paymentDetails.phone = phone;
                } else if (selectedPaymentMethod.id === 'card') {
                    const cardNumber = document.getElementById('payment-card-number')?.value;
                    const expiry = document.getElementById('payment-card-expiry')?.value;
                    const cvv = document.getElementById('payment-card-cvv')?.value;
                    if (!cardNumber || !expiry || !cvv) {
                        if (typeof window.showToast === 'function') window.showToast('Please enter complete card details', 'error');
                        return;
                    }
                    paymentDetails = { cardNumber, expiry, cvv };
                }
                
                // Process the payment and activate ad
                await this.processPromotionPayment(
                    selectedAd,
                    selectedPackage,
                    selectedAction,
                    selectedActionDetails,
                    selectedPaymentMethod,
                    paymentDetails
                );
            });
        }
        
        if (step4Back) {
            step4Back.addEventListener('click', () => this.goToPromoStep(3));
        }
    }

    goToPromoStep(step) {
        // Hide all steps
        for (let i = 1; i <= 4; i++) {
            const stepDiv = document.getElementById(`promo-step-${i}`);
            if (stepDiv) stepDiv.style.display = 'none';
        }
        
        // Show selected step
        const selectedStep = document.getElementById(`promo-step-${step}`);
        if (selectedStep) selectedStep.style.display = 'block';
        
        // Update step indicators
        const stepIndicators = document.querySelectorAll('.promotion-steps .step');
        stepIndicators.forEach((indicator, index) => {
            const stepNum = index + 1;
            const circle = indicator.querySelector('div:first-child');
            if (circle) {
                if (stepNum <= step) {
                    circle.style.background = 'var(--primary)';
                } else {
                    circle.style.background = 'var(--grey)';
                }
            }
            if (stepNum === step) {
                indicator.classList.add('active');
            } else {
                indicator.classList.remove('active');
            }
        });
    }

    async processPromotionPayment(ad, pkg, action, actionDetails, paymentMethod, paymentDetails) {
        if (typeof window.showToast === 'function') {
            window.showToast('Processing payment...', 'info');
        }
        
        // Simulate payment processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Generate transaction ID
        const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        
        // Calculate expiry
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + pkg.duration);
        
        // Save promotion record
        const promotionData = {
            adId: ad.id,
            adTitle: ad.title,
            packageName: pkg.name,
            packagePrice: pkg.price,
            duration: pkg.duration,
            transactionId: transactionId,
            paymentMethod: paymentMethod.name,
            status: 'active',
            activatedAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString(),
            userId: this.userId,
            action: { type: action, details: actionDetails }
        };
        
        // Save to localStorage
        const promotions = JSON.parse(localStorage.getItem('vikeserve_promotions') || '[]');
        promotions.push(promotionData);
        localStorage.setItem('vikeserve_promotions', JSON.stringify(promotions));
        
        // Mark ad as promoted
        const marketplaceItems = JSON.parse(localStorage.getItem('vikeserve_marketplace_items') || '[]');
        const adIndex = marketplaceItems.findIndex(item => item.id == ad.id);
        if (adIndex !== -1) {
            marketplaceItems[adIndex].promoted = true;
            marketplaceItems[adIndex].promotionPackage = pkg.name;
            marketplaceItems[adIndex].promotionExpiresAt = expiresAt.toISOString();
            marketplaceItems[adIndex].promotionAction = { type: action, details: actionDetails };
            localStorage.setItem('vikeserve_marketplace_items', JSON.stringify(marketplaceItems));
        }
        
        // Save action config for the ad
        const actionConfigs = JSON.parse(localStorage.getItem('vikeserve_ad_actions') || '{}');
        actionConfigs[ad.id] = {
            actionType: action,
            actionValue: actionDetails,
            updatedAt: new Date().toISOString()
        };
        localStorage.setItem('vikeserve_ad_actions', JSON.stringify(actionConfigs));
        
        if (typeof window.showToast === 'function') {
            window.showToast(`✅ Success! Your ad "${ad.title}" is now promoted for ${pkg.duration} days!`, 'success');
        }
        
        // Close modal
        const modal = document.getElementById('ad-packages-full-modal');
        if (modal) modal.style.display = 'none';
        
        // Refresh marketplace display
        if (typeof window.loadMarketplaceItems === 'function') {
            setTimeout(() => window.loadMarketplaceItems('all'), 500);
        }
    }

    loadPaymentHistoryFromStorage() {
        // Load existing payments
        const payments = JSON.parse(localStorage.getItem('vikeserve_payments') || '[]');
        console.log(`Loaded ${payments.length} payment records`);
    }
}

// ========== GLOBAL FUNCTIONS ==========
let globalPaymentSystem = null;

function getPaymentSystem() {
    if (!globalPaymentSystem) {
        globalPaymentSystem = new VikeServeGlobalPayments();
    }
    return globalPaymentSystem;
}

// Main function to show ad packages modal
function showAdPackagesModal(adId = null) {
    const payments = getPaymentSystem();
    payments.showAdPackagesModal(adId);
}

// Check login and show ad packages
function checkLoginAndShowAdPackages(adId = null) {
    const payments = getPaymentSystem();
    payments.checkLoginAndContinue(() => {
        payments.showAdPackagesModal(adId);
    });
}

// ========== EXPORT GLOBALLY ==========
window.VikeServeGlobalPayments = VikeServeGlobalPayments;
window.getPaymentSystem = getPaymentSystem;
window.showAdPackagesModal = showAdPackagesModal;
window.checkLoginAndShowAdPackages = checkLoginAndShowAdPackages;

// ========== INITIALIZE ON DOM LOAD ==========
// IMPORTANT: DO NOT attach button handlers here - they are handled by app.js
// This prevents conflicts with the main app's button handlers
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        // Just initialize the payment system, don't attach button handlers
        const payments = getPaymentSystem();
        
        // BUTTON HANDLERS ARE NOW HANDLED BY app.js setupAdPromotionButtons()
        // This prevents duplicate handlers and conflicts
        
        console.log('✅ intasend-global.js payment system ready');
        console.log('ℹ️ Ad promotion buttons are handled by app.js');
    }, 500);
});

// Ensure global functions are available
setTimeout(function() {
    if (typeof window.showAdPackagesModal !== 'function') {
        console.log('Re-exposing showAdPackagesModal globally');
        window.showAdPackagesModal = showAdPackagesModal;
    }
    if (typeof window.getPaymentSystem !== 'function') {
        window.getPaymentSystem = getPaymentSystem;
    }
    console.log('✅ Payment functions confirmed globally available');
}, 100);

console.log('✅ intasend-global.js with full payment system loaded');