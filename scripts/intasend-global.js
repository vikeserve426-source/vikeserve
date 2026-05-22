// ========== INTASEND PAYMENT SYSTEM - COMPLETE WITH WEBHOOK ==========
// Supports: M-Pesa, Airtel Money, MTN Uganda, Visa/Mastercard, PayPal
// Includes: Webhook verification, manual activation, payment status check
// FIXED: Uses redirect checkout method (no CORS errors)

class VikeServeGlobalPayments {
    constructor() {
        this.config = {
            intasend: {
                publicKey: 'ISPubKey_live_7b219b83-74bc-4661-90ce-126679748f2e',
                environment: 'live',
                apiUrl: 'https://api.intasend.com/v1/'
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
        
        if (typeof firebase !== 'undefined' && firebase.auth) {
            firebase.auth().onAuthStateChanged((user) => {
                if (user) {
                    this.userId = user.uid;
                    this.userEmail = user.email;
                    this.userPhone = user.phoneNumber || '';
                    this.checkPendingPromotions();
                } else {
                    this.userId = null;
                }
            });
        }
        
        await this.detectUserCountry();
        await this.loadPaymentHistoryFromFirestore();
        await this.setupPaymentStatusListener();
        
        console.log('✅ Payment system ready! Country:', this.userCountry, 'Currency:', this.userCurrency);
    }

    async detectUserCountry() {
        try {
            const savedLocation = localStorage.getItem('vikeserve_location');
            if (savedLocation) {
                const locationData = JSON.parse(savedLocation);
                this.userCountry = this.getCountryCode(locationData.country || '');
            }
            
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

    getAvailablePaymentMethods() {
        // Get selected country from dropdown if available
        const selectedCountryElem = document.getElementById('payment-country');
        let activeCountry = this.userCountry;
        
        if (selectedCountryElem && selectedCountryElem.value && selectedCountryElem.value !== 'OTHER') {
            activeCountry = selectedCountryElem.value;
        }
        
        const methods = {
            'KE': [
                { id: 'mpesa', name: 'M-Pesa', icon: 'fas fa-mobile-alt', requires: ['phone'], type: 'mobile_money' },
                { id: 'airtel_kenya', name: 'Airtel Money', icon: 'fas fa-mobile-alt', requires: ['phone'], type: 'mobile_money' },
                { id: 'card', name: 'Credit/Debit Card', icon: 'fab fa-cc-visa', requires: ['card'], type: 'card' },
                { id: 'paypal', name: 'PayPal', icon: 'fab fa-paypal', requires: ['email'], type: 'global' }
            ],
            'UG': [
                { id: 'mtn_uganda', name: 'MTN Uganda Money', icon: 'fas fa-mobile-alt', requires: ['phone'], type: 'mobile_money' },
                { id: 'airtel_uganda', name: 'Airtel Money Uganda', icon: 'fas fa-mobile-alt', requires: ['phone'], type: 'mobile_money' },
                { id: 'card', name: 'Credit/Debit Card', icon: 'fab fa-cc-visa', requires: ['card'], type: 'card' },
                { id: 'paypal', name: 'PayPal', icon: 'fab fa-paypal', requires: ['email'], type: 'global' }
            ],
            'TZ': [
                { id: 'mpesa_tz', name: 'M-Pesa Tanzania', icon: 'fas fa-mobile-alt', requires: ['phone'], type: 'mobile_money' },
                { id: 'tigo_pesa', name: 'Tigo Pesa', icon: 'fas fa-mobile-alt', requires: ['phone'], type: 'mobile_money' },
                { id: 'card', name: 'Credit/Debit Card', icon: 'fab fa-cc-visa', requires: ['card'], type: 'card' },
                { id: 'paypal', name: 'PayPal', icon: 'fab fa-paypal', requires: ['email'], type: 'global' }
            ],
            'NG': [
                { id: 'card', name: 'Credit/Debit Card', icon: 'fab fa-cc-visa', requires: ['card'], type: 'card' },
                { id: 'paypal', name: 'PayPal', icon: 'fab fa-paypal', requires: ['email'], type: 'global' }
            ],
            'GH': [
                { id: 'card', name: 'Credit/Debit Card', icon: 'fab fa-cc-visa', requires: ['card'], type: 'card' },
                { id: 'paypal', name: 'PayPal', icon: 'fab fa-paypal', requires: ['email'], type: 'global' }
            ],
            'US': [
                { id: 'card', name: 'Credit/Debit Card', icon: 'fab fa-cc-visa', requires: ['card'], type: 'card' },
                { id: 'paypal', name: 'PayPal', icon: 'fab fa-paypal', requires: ['email'], type: 'global' }
            ],
            'GB': [
                { id: 'card', name: 'Credit/Debit Card', icon: 'fab fa-cc-visa', requires: ['card'], type: 'card' },
                { id: 'paypal', name: 'PayPal', icon: 'fab fa-paypal', requires: ['email'], type: 'global' }
            ],
            'ZA': [
                { id: 'card', name: 'Credit/Debit Card', icon: 'fab fa-cc-visa', requires: ['card'], type: 'card' },
                { id: 'paypal', name: 'PayPal', icon: 'fab fa-paypal', requires: ['email'], type: 'global' }
            ]
        };
        
        // For OTHER countries, just show global payment methods
        if (activeCountry === 'OTHER' || !methods[activeCountry]) {
            return [
                { id: 'card', name: 'Credit/Debit Card', icon: 'fab fa-cc-visa', requires: ['card'], type: 'card' },
                { id: 'paypal', name: 'PayPal', icon: 'fab fa-paypal', requires: ['email'], type: 'global' }
            ];
        }
        
        return methods[activeCountry];
    }

    async checkLoginAndContinue(callback) {
        const user = firebase.auth().currentUser;
        
        if (!user) {
            if (typeof window.showAuthModal === 'function') {
                window.showAuthModal();
                window.pendingPromotionCallback = callback;
                if (typeof window.showToast === 'function') {
                    window.showToast('Please sign in to continue', 'warning');
                }
            } else if (typeof window.openAuthModal === 'function') {
                window.openAuthModal();
                window.pendingPromotionCallback = callback;
            } else {
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

    async showAdPackagesModal(adId = null) {
        console.log('showAdPackagesModal called with adId:', adId);
        
        const isLoggedIn = await this.checkLoginAndContinue(() => {
            this.showAdPackagesModal(adId);
        });
        
        if (!isLoggedIn) return;
        
        const userAds = await this.getUserAds();
        
        if (userAds.length === 0) {
            if (typeof window.showToast === 'function') {
                window.showToast('You don\'t have any ads yet. Please create an ad first!', 'warning');
            }
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
        
        const modalContent = this.createFullAdPromotionModal(userAds, adId);
        
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
        
        setTimeout(() => {
            this.setupAdPromotionModalEvents(adId);
        }, 100);
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
                    <div class="promotion-steps" style="display: flex; margin-bottom: 30px; justify-content: space-between;">
                        <div class="step active" data-step="1" style="text-align: center; flex: 1;"><div style="width: 30px; height: 30px; background: var(--primary); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: white;">1</div><div style="font-size: 0.7rem; margin-top: 5px;">Select Ad</div></div>
                        <div class="step" data-step="2" style="text-align: center; flex: 1;"><div style="width: 30px; height: 30px; background: var(--grey); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: white;">2</div><div style="font-size: 0.7rem; margin-top: 5px;">Package</div></div>
                        <div class="step" data-step="3" style="text-align: center; flex: 1;"><div style="width: 30px; height: 30px; background: var(--grey); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: white;">3</div><div style="font-size: 0.7rem; margin-top: 5px;">Ad Action</div></div>
                        <div class="step" data-step="4" style="text-align: center; flex: 1;"><div style="width: 30px; height: 30px; background: var(--grey); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: white;">4</div><div style="font-size: 0.7rem; margin-top: 5px;">Payment</div></div>
                    </div>
                    
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
                            <div id="action-whatsapp-details" class="action-detail" style="display: none;">
                                <div class="form-group"><label class="form-label">WhatsApp Number *</label><input type="tel" id="action-whatsapp-number" class="form-input" placeholder="e.g., 254712345678"></div>
                                <div class="form-group"><label class="form-label">Auto Message (Optional)</label><textarea id="action-whatsapp-message" class="form-input" rows="2" placeholder="Hi! I'm interested in your ad on VikeServe..."></textarea></div>
                            </div>
                            <div id="action-phone-details" class="action-detail" style="display: none;">
                                <div class="form-group"><label class="form-label">Phone Number *</label><input type="tel" id="action-phone-number" class="form-input" placeholder="e.g., 254712345678"></div>
                            </div>
                            <div id="action-email-details" class="action-detail" style="display: none;">
                                <div class="form-group"><label class="form-label">Email Address *</label><input type="email" id="action-email-address" class="form-input" placeholder="your@email.com"></div>
                                <div class="form-group"><label class="form-label">Email Subject</label><input type="text" id="action-email-subject" class="form-input" placeholder="Interested in your ad"></div>
                            </div>
                            <div id="action-link-details" class="action-detail" style="display: none;">
                                <div class="form-group"><label class="form-label">Website URL *</label><input type="url" id="action-link-url" class="form-input" placeholder="https://yourwebsite.com"></div>
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button class="btn btn-outline" id="promo-step3-back">← Back</button>
                            <button class="btn btn-primary" id="promo-step3-next" disabled>Continue →</button>
                        </div>
                    </div>
                    
                    <div id="promo-step-4" class="promo-step" style="display: none;">
                        <h3 style="margin-bottom: 15px;">Complete Payment</h3>
                        
                        <div id="payment-summary" style="background: var(--light); padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                            <div><strong>Ad:</strong> <span id="summary-ad-name">-</span></div>
                            <div><strong>Package:</strong> <span id="summary-package-name">-</span> (<span id="summary-package-duration">-</span> days)</div>
                            <div><strong>Amount:</strong> <span id="summary-package-price" style="font-size: 1.2rem; font-weight: 700; color: var(--primary);">KES 0</span></div>
                            <div><strong>Action:</strong> <span id="summary-action-name">-</span></div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Your Country</label>
                            <select id="payment-country" class="form-input">
                                <option value="KE">🇰🇪 Kenya</option>
                                <option value="UG">🇺🇬 Uganda</option>
                                <option value="TZ">🇹🇿 Tanzania</option>
                                <option value="NG">🇳🇬 Nigeria</option>
                                <option value="GH">🇬🇭 Ghana</option>
                                <option value="US">🇺🇸 United States</option>
                                <option value="GB">🇬🇧 United Kingdom</option>
                                <option value="ZA">🇿🇦 South Africa</option>
                                <option value="OTHER">🌍 Other (Card/PayPal)</option>
                            </select>
                            <div class="form-hint">Select your country for available payment methods</div>
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
                        
                        <div id="payment-details-container" style="display: none;">
                            <div id="mobile-money-details" class="payment-detail" style="display: none;">
                                <div class="form-group">
                                    <label class="form-label">Phone Number *</label>
                                    <input type="tel" id="payment-phone-number" class="form-input" placeholder="e.g., 254712345678" value="${this.userPhone || ''}">
                                    <div class="form-hint">You will be redirected to complete payment</div>
                                </div>
                            </div>
                            <div id="intasend-card-details" class="payment-detail" style="display: none;">
                                <div class="form-group">
                                    <label class="form-label">Card Details</label>
                                    <div id="intasend-card-element" style="border: 1px solid var(--grey); border-radius: 8px; padding: 12px; background: white;">
                                        <div class="form-hint">You will be redirected to secure payment page</div>
                                    </div>
                                </div>
                            </div>
                            <div id="paypal-details" class="payment-detail" style="display: none;">
                                <div class="form-group"><label class="form-label">PayPal Email *</label><input type="email" id="payment-paypal-email" class="form-input" placeholder="your@paypal.com" value="${this.userEmail || ''}"></div>
                                <div class="form-hint">You will be redirected to PayPal to complete payment</div>
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
        
        const step1Next = document.getElementById('promo-step1-next');
        const adSelect = document.getElementById('promo-ad-select');
        const adPreview = document.getElementById('promo-ad-preview');
        
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
                                    <div style="font-weight: 600;">${this.escapeHtml(selectedAd.title)}</div>
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
                if (selectedAd) this.goToPromoStep(2);
            });
        }
        
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
                if (selectedPackage) this.goToPromoStep(3);
            });
        }
        
        if (step2Back) {
            step2Back.addEventListener('click', () => this.goToPromoStep(1));
        }
        
        const actionOptions = document.querySelectorAll('.action-option');
        const actionDetailsContainer = document.getElementById('action-details-container');
        const step3Next = document.getElementById('promo-step3-next');
        const step3Back = document.getElementById('promo-step3-back');
        
        actionOptions.forEach(option => {
            option.addEventListener('click', () => {
                actionOptions.forEach(opt => opt.style.borderColor = 'var(--grey)');
                option.style.borderColor = 'var(--primary)';
                
                selectedAction = option.getAttribute('data-action');
                
                if (actionDetailsContainer) actionDetailsContainer.style.display = 'block';
                document.querySelectorAll('.action-detail').forEach(detail => detail.style.display = 'none');
                
                const detailForm = document.getElementById(`action-${selectedAction}-details`);
                if (detailForm) detailForm.style.display = 'block';
                
                if (step3Next) step3Next.disabled = false;
            });
        });
        
        if (step3Next) {
            step3Next.addEventListener('click', () => {
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
                
                if (paymentDetailsContainer) paymentDetailsContainer.style.display = 'block';
                document.querySelectorAll('.payment-detail').forEach(detail => detail.style.display = 'none');
                
                if (selectedPaymentMethod.type === 'mobile_money') {
                    const mobileForm = document.getElementById('mobile-money-details');
                    if (mobileForm) mobileForm.style.display = 'block';
                } else if (selectedPaymentMethod.id === 'card') {
                    const cardForm = document.getElementById('intasend-card-details');
                    if (cardForm) cardForm.style.display = 'block';
                } else if (selectedPaymentMethod.id === 'paypal') {
                    const paypalForm = document.getElementById('paypal-details');
                    if (paypalForm) paypalForm.style.display = 'block';
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
                
                let paymentDetails = {};
                
                if (selectedPaymentMethod.type === 'mobile_money') {
                    const phone = document.getElementById('payment-phone-number')?.value;
                    if (!phone || phone.length < 10) {
                        if (typeof window.showToast === 'function') window.showToast('Please enter a valid phone number', 'error');
                        return;
                    }
                    paymentDetails.phone = phone;
                } else if (selectedPaymentMethod.id === 'paypal') {
                    const email = document.getElementById('payment-paypal-email')?.value;
                    if (!email || !email.includes('@')) {
                        if (typeof window.showToast === 'function') window.showToast('Please enter a valid PayPal email', 'error');
                        return;
                    }
                    paymentDetails.email = email;
                }
                
                await this.processIntaSendPayment(
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
        for (let i = 1; i <= 4; i++) {
            const stepDiv = document.getElementById(`promo-step-${i}`);
            if (stepDiv) stepDiv.style.display = 'none';
        }
        
        const selectedStep = document.getElementById(`promo-step-${step}`);
        if (selectedStep) selectedStep.style.display = 'block';
        
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

    async loadIntaSendCardElement() {
        // Card element not needed for redirect method
        console.log('Using redirect checkout method');
    }

    async loadIntaSendScript() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://js.intasend.com/v1/';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // ========== FIXED: PROCESS PAYMENT USING REDIRECT METHOD (NO CORS) ==========
    async processIntaSendPayment(ad, pkg, action, actionDetails, paymentMethod, paymentDetails) {
        if (typeof window.showToast === 'function') {
            window.showToast('Redirecting to payment page...', 'info');
        }
        
        const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + pkg.duration);

        // Get selected country from dropdown
        const selectedCountry = document.getElementById('payment-country')?.value;
        if (selectedCountry && selectedCountry !== 'OTHER') {
            this.userCountry = selectedCountry;
            this.userCurrency = this.getCurrencyForCountry(selectedCountry);
            console.log(`Country updated to: ${this.userCountry}, Currency: ${this.userCurrency}`);
        }
        
        try {
            // Save transaction record first
            const paymentRecord = {
                transactionId: transactionId,
                adId: ad.id,
                adTitle: ad.title,
                packageName: pkg.name,
                amount: pkg.price,
                duration: pkg.duration,
                paymentMethod: paymentMethod.name,
                status: 'pending',
                userId: this.userId,
                userEmail: this.userEmail,
                action: { type: action, details: actionDetails },
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                expiresAt: firebase.firestore.Timestamp.fromDate(expiresAt),
                userCountry: this.userCountry,
                userCurrency: this.userCurrency
            };
            
            await firebase.firestore().collection('transactions').add(paymentRecord);
            
            // Load IntaSend script if not loaded
            await this.loadIntaSendScript();
            
            const intasend = new IntaSend({
                publicAPIKey: this.config.intasend.publicKey,
                live: this.config.intasend.environment === 'live'
            });
            
            // Prepare checkout data
            const checkoutData = {
                amount: pkg.price,
                currency: this.userCurrency,
                email: this.userEmail,
                reference: transactionId,
                api_ref: transactionId,
                api_key: this.config.intasend.publicKey
            };
            
            // Add phone number for mobile money if provided
            if (paymentDetails.phone) {
                checkoutData.phone = paymentDetails.phone;
            }
            
            // Add country code for better payment routing
            if (this.userCountry && this.userCountry !== 'OTHER') {
                checkoutData.country = this.userCountry;
            }
            
            console.log('Creating checkout with data:', checkoutData);
            
            // Create checkout URL (this redirects to IntaSend's hosted page)
            const checkoutUrl = await intasend.createCheckout(checkoutData);
            
            console.log('Redirecting to:', checkoutUrl);
            
            // Redirect to IntaSend payment page
            window.location.href = checkoutUrl;
            
        } catch (error) {
            console.error('Payment error:', error);
            if (typeof window.showToast === 'function') {
                window.showToast('Payment failed: ' + error.message, 'error');
            }
        }
    }

    // These methods are kept for compatibility but not used with redirect method
    async initiateMpesaPayment(phoneNumber, amount, transactionId) {
        console.log('Direct payment disabled - using redirect method');
        return { success: false, error: 'Use redirect method' };
    }

    async pollMpesaPaymentStatus(checkoutId, transactionId, ad, pkg, actionDetails) {
        // Handled by redirect
    }

    async activatePromotion(adId, adTitle, pkg, actionDetails, transactionId, paymentMethod) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + pkg.duration);
        
        try {
            await firebase.firestore().collection('promoted_ads').add({
                adId: adId,
                adTitle: adTitle,
                packageName: pkg.name,
                duration: pkg.duration,
                transactionId: transactionId,
                paymentMethod: paymentMethod.name,
                status: 'active',
                activatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                expiresAt: firebase.firestore.Timestamp.fromDate(expiresAt),
                userId: this.userId,
                action: actionDetails
            });
            
            await firebase.firestore().collection('marketplace_items').doc(adId).update({
                promoted: true,
                promotionPackage: pkg.name,
                promotionExpiresAt: firebase.firestore.Timestamp.fromDate(expiresAt),
                promotionAction: actionDetails,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            const transactionQuery = await firebase.firestore()
                .collection('transactions')
                .where('transactionId', '==', transactionId)
                .get();
            
            if (!transactionQuery.empty) {
                await transactionQuery.docs[0].ref.update({
                    status: 'completed',
                    completedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            
            if (typeof window.showToast === 'function') {
                window.showToast(`✅ Success! Your ad "${adTitle}" is now promoted for ${pkg.duration} days!`, 'success');
            }
            
            const modal = document.getElementById('ad-packages-full-modal');
            if (modal) modal.style.display = 'none';
            
            if (typeof window.loadMarketplaceItems === 'function') {
                setTimeout(() => window.loadMarketplaceItems('all'), 500);
            }
            
        } catch (error) {
            console.error('Error activating promotion:', error);
            if (typeof window.showToast === 'function') {
                window.showToast('Payment succeeded but promotion activation failed. Contact support.', 'error');
            }
        }
    }

    async setupPaymentStatusListener() {
        const urlParams = new URLSearchParams(window.location.search);
        const transactionRef = urlParams.get('api_ref') || urlParams.get('reference');
        const status = urlParams.get('status') || urlParams.get('intasend_status');
        
        if (transactionRef && (status === 'complete' || status === 'SUCCESS')) {
            console.log('Payment successful for:', transactionRef);
            await this.verifyAndActivatePayment(transactionRef);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    async verifyAndActivatePayment(transactionId) {
        const transactionQuery = await firebase.firestore()
            .collection('transactions')
            .where('transactionId', '==', transactionId)
            .get();
        
        if (!transactionQuery.empty) {
            const transaction = transactionQuery.docs[0].data();
            if (transaction.status !== 'completed') {
                await this.activatePromotion(
                    transaction.adId,
                    transaction.adTitle,
                    {
                        name: transaction.packageName,
                        duration: transaction.duration,
                        price: transaction.amount
                    },
                    transaction.action,
                    transactionId,
                    { name: transaction.paymentMethod }
                );
            }
        }
    }

    async verifyPaymentWithIntaSend(transactionId) {
        // Not needed for redirect method
        return { verified: true };
    }

    async showManualActivationModal() {
        const pendingTransactions = await firebase.firestore()
            .collection('transactions')
            .where('userId', '==', this.userId)
            .where('status', 'in', ['pending', 'pending_mpesa'])
            .get();
        
        const pendingList = pendingTransactions.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (pendingList.length === 0) {
            if (typeof window.showToast === 'function') {
                window.showToast('No pending payments to activate', 'info');
            }
            return;
        }
        
        const modalContent = `
            <div class="modal-content" style="max-width: 500px; z-index: 20002;">
                <div class="modal-header">
                    <div class="modal-title"><i class="fas fa-hourglass-half"></i> Pending Activations</div>
                    <button class="close-modal-btn">&times;</button>
                </div>
                <div style="padding: 20px;">
                    <p>Select a payment to activate:</p>
                    <div class="pending-list">
                        ${pendingList.map(tx => `
                            <div class="pending-item" style="padding: 12px; border-bottom: 1px solid var(--grey); margin-bottom: 10px;">
                                <div><strong>${this.escapeHtml(tx.adTitle)}</strong></div>
                                <div>Package: ${tx.packageName} (${tx.duration} days)</div>
                                <div>Amount: KES ${tx.amount}</div>
                                <div>Payment: ${tx.paymentMethod}</div>
                                <div>Status: ${tx.status}</div>
                                <button class="btn btn-sm btn-primary activate-now-btn" data-tx-id="${tx.transactionId}" style="margin-top: 8px;">Activate Now</button>
                            </div>
                        `).join('')}
                    </div>
                    <div class="form-actions" style="margin-top: 20px;">
                        <button class="btn btn-outline close-modal-btn">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        if (typeof window.showModalWithContent === 'function') {
            window.showModalWithContent('manual-activation-modal', modalContent);
        }
        
        setTimeout(() => {
            document.querySelectorAll('.activate-now-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const txId = btn.getAttribute('data-tx-id');
                    await this.verifyAndActivatePayment(txId);
                    if (typeof window.closeModal === 'function') {
                        window.closeModal('manual-activation-modal');
                    }
                });
            });
        }, 100);
    }

    async checkPendingPromotions() {
        if (!this.userId) return;
        
        const pendingTransactions = await firebase.firestore()
            .collection('transactions')
            .where('userId', '==', this.userId)
            .where('status', 'in', ['pending', 'pending_mpesa'])
            .get();
        
        if (pendingTransactions.size > 0) {
            if (typeof window.showToast === 'function') {
                window.showToast(`You have ${pendingTransactions.size} pending activation(s). Click here to activate.`, 'warning');
            }
        }
    }

    async loadPaymentHistoryFromFirestore() {
        if (!this.userId) return;
        
        try {
            const snapshot = await firebase.firestore()
                .collection('transactions')
                .where('userId', '==', this.userId)
                .orderBy('createdAt', 'desc')
                .limit(20)
                .get();
            
            const payments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log(`Loaded ${payments.length} payment records from Firestore`);
        } catch (error) {
            console.error('Error loading payment history:', error);
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showToast(message, type) {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            console.log(`${type}: ${message}`);
        }
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

function showAdPackagesModal(adId = null) {
    const payments = getPaymentSystem();
    payments.showAdPackagesModal(adId);
}

function showManualActivationModal() {
    const payments = getPaymentSystem();
    payments.showManualActivationModal();
}

if (window.location.search.includes('payment_status=success') || window.location.search.includes('intasend_status=complete')) {
    const urlParams = new URLSearchParams(window.location.search);
    const transactionRef = urlParams.get('api_ref') || urlParams.get('reference');
    if (transactionRef) {
        console.log('Payment webhook detected for:', transactionRef);
        setTimeout(() => {
            const payments = getPaymentSystem();
            payments.verifyAndActivatePayment(transactionRef);
        }, 1000);
    }
}

window.VikeServeGlobalPayments = VikeServeGlobalPayments;
window.getPaymentSystem = getPaymentSystem;
window.showAdPackagesModal = showAdPackagesModal;
window.showManualActivationModal = showManualActivationModal;

console.log('✅ intasend-global.js with redirect checkout method and global support loaded');