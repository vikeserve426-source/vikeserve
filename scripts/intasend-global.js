// ========== INTASEND PAYMENT SYSTEM - COMPLETE FIXED VERSION ==========
// FIXES: CORS issue resolved (redirect method), Currency conversion added, PayPal fixed
// FIXED: Payment method selection, Phone number formatting, Modal close before redirect
// Supports: M-Pesa, Airtel Money, MTN Uganda, Tigo Pesa, Visa/Mastercard, PayPal

class VikeServeGlobalPayments {
    constructor() {
        this.config = {
            intasend: {
                publicKey: 'ISPubKey_live_7b219b83-74bc-4661-90ce-126679748f2e',
                environment: 'live'
            }
        };
        
        this.userCountry = 'KE';
        this.userCurrency = 'KES';
        this.userId = null;
        this.userEmail = null;
        this.userPhone = null;
        this.pendingVerifications = new Map();
        
        // Exchange rates (1 KES to other currencies)
        this.exchangeRates = {
            'KES': 1,
            'UGX': 28.5,
            'TZS': 18.2,
            'USD': 0.0076,
            'GBP': 0.006,
            'EUR': 0.007,
            'NGN': 11.5,
            'GHS': 0.11,
            'ZAR': 0.14
        };
        
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
                    this.checkPendingTransactions();
                } else {
                    this.userId = null;
                }
            });
        }
        
        await this.detectUserCountry();
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
            'US': 'USD', 'GB': 'GBP'
        };
        return currencies[country] || 'USD';
    }

    async convertCurrency(amount, fromCurrency = 'KES', toCurrency = null) {
        const targetCurrency = toCurrency || this.userCurrency;
        if (fromCurrency === targetCurrency) return amount;
        
        const fromRate = this.exchangeRates[fromCurrency] || 1;
        const toRate = this.exchangeRates[targetCurrency] || 1;
        
        const amountInKES = amount / fromRate;
        const convertedAmount = amountInKES * toRate;
        
        return Math.round(convertedAmount);
    }

    getAvailablePaymentMethods(country = null) {
        const activeCountry = country || this.userCountry;
        
        const methods = {
            'KE': [
                { id: 'mpesa', name: 'M-Pesa', icon: 'fas fa-mobile-alt', type: 'mobile_money', provider: 'SAFARICOM' },
                { id: 'airtel_kenya', name: 'Airtel Money', icon: 'fas fa-mobile-alt', type: 'mobile_money', provider: 'AIRTEL' },
                { id: 'card', name: 'Credit/Debit Card', icon: 'fab fa-cc-visa', type: 'card' },
                { id: 'paypal', name: 'PayPal', icon: 'fab fa-paypal', type: 'paypal' }
            ],
            'UG': [
                { id: 'mtn_uganda', name: 'MTN Money', icon: 'fas fa-mobile-alt', type: 'mobile_money', provider: 'MTN' },
                { id: 'airtel_uganda', name: 'Airtel Money', icon: 'fas fa-mobile-alt', type: 'mobile_money', provider: 'AIRTEL' },
                { id: 'card', name: 'Credit/Debit Card', icon: 'fab fa-cc-visa', type: 'card' },
                { id: 'paypal', name: 'PayPal', icon: 'fab fa-paypal', type: 'paypal' }
            ],
            'TZ': [
                { id: 'mpesa_tz', name: 'M-Pesa Tanzania', icon: 'fas fa-mobile-alt', type: 'mobile_money', provider: 'VODACOM' },
                { id: 'tigo_pesa', name: 'Tigo Pesa', icon: 'fas fa-mobile-alt', type: 'mobile_money', provider: 'TIGO' },
                { id: 'card', name: 'Credit/Debit Card', icon: 'fab fa-cc-visa', type: 'card' },
                { id: 'paypal', name: 'PayPal', icon: 'fab fa-paypal', type: 'paypal' }
            ],
            'DEFAULT': [
                { id: 'card', name: 'Credit/Debit Card', icon: 'fab fa-cc-visa', type: 'card' },
                { id: 'paypal', name: 'PayPal', icon: 'fab fa-paypal', type: 'paypal' }
            ]
        };
        
        return methods[activeCountry] || methods['DEFAULT'];
    }

    async checkLoginAndContinue(callback) {
        const user = firebase.auth().currentUser;
        
        if (!user) {
            if (typeof window.showAuthModal === 'function') {
                window.showAuthModal();
                window.pendingPromotionCallback = callback;
                window.showToast('Please sign in to continue', 'warning');
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
            console.error('Error loading user ads:', error);
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
            window.showToast('You don\'t have any ads yet. Please create an ad first!', 'warning');
            setTimeout(() => {
                const marketplaceModal = document.getElementById('marketplace-post-modal');
                if (marketplaceModal) marketplaceModal.style.display = 'flex';
                else if (typeof window.showMarketplacePostModal === 'function') window.showMarketplacePostModal();
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
        
        const currentMethods = this.getAvailablePaymentMethods();
        
        return `
            <div class="modal-content" style="max-width: 600px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <div class="modal-title"><i class="fas fa-rocket"></i> Promote Your Ad</div>
                    <button class="close-modal-btn" onclick="document.getElementById('ad-packages-full-modal').style.display='none'">&times;</button>
                </div>
                
                <div style="padding: 20px;">
                    <div class="promotion-steps" style="display: flex; margin-bottom: 30px; justify-content: space-between;">
                        <div class="step active" data-step="1" style="text-align: center; flex: 1;"><div style="width: 30px; height: 30px; background: var(--primary); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: white;">1</div><div style="font-size: 0.7rem; margin-top: 5px;">Select Ad</div></div>
                        <div class="step" data-step="2" style="text-align: center; flex: 1;"><div style="width: 30px; height: 30px; background: var(--grey); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: white;">2</div><div style="font-size: 0.7rem; margin-top: 5px;">Package</div></div>
                        <div class="step" data-step="3" style="text-align: center; flex: 1;"><div style="width: 30px; height: 30px; background: var(--grey); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: white;">3</div><div style="font-size: 0.7rem; margin-top: 5px;">Action</div></div>
                        <div class="step" data-step="4" style="text-align: center; flex: 1;"><div style="width: 30px; height: 30px; background: var(--grey); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: white;">4</div><div style="font-size: 0.7rem; margin-top: 5px;">Payment</div></div>
                        <div class="step" data-step="5" style="text-align: center; flex: 1;"><div style="width: 30px; height: 30px; background: var(--grey); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: white;">5</div><div style="font-size: 0.7rem; margin-top: 5px;">Verify</div></div>
                    </div>
                    
                    <div id="promo-step-1" class="promo-step">
                        <h3 style="margin-bottom: 15px;">Select Ad to Promote</h3>
                        <div class="form-group">
                            <label class="form-label">Your Ads</label>
                            <select id="promo-ad-select" class="form-input">
                                <option value="">-- Select an ad --</option>
                                ${userAds.map(ad => `<option value="${ad.id}" ${selectedAdId == ad.id ? 'selected' : ''}>${this.escapeHtml(ad.title.substring(0, 50))} - KES ${ad.price}</option>`).join('')}
                            </select>
                        </div>
                        <div id="promo-ad-preview" style="display: none; margin: 15px 0; padding: 15px; background: var(--light); border-radius: 10px;"></div>
                        <button class="btn btn-primary" id="promo-step1-next" style="margin-top: 15px;" disabled>Continue →</button>
                    </div>
                    
                    <div id="promo-step-2" class="promo-step" style="display: none;">
                        <h3 style="margin-bottom: 15px;">Select Promotion Package</h3>
                        <div class="packages-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                            ${packages.map(pkg => `
                                <div class="package-card" data-package-id="${pkg.id}" data-package-name="${pkg.name}" data-package-price="${pkg.price}" data-package-duration="${pkg.duration}" style="padding: 15px; border: 2px solid var(--grey); border-radius: 10px; cursor: pointer; text-align: center; transition: all 0.2s; position: relative;">
                                    ${pkg.tag ? `<span style="position: absolute; top: -10px; right: -5px; background: ${pkg.color}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.6rem;">${pkg.tag}</span>` : ''}
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
                                <option value="KE" ${this.userCountry === 'KE' ? 'selected' : ''}>🇰🇪 Kenya (M-Pesa, Airtel, Card, PayPal)</option>
                                <option value="UG" ${this.userCountry === 'UG' ? 'selected' : ''}>🇺🇬 Uganda (MTN Money, Airtel, Card, PayPal)</option>
                                <option value="TZ" ${this.userCountry === 'TZ' ? 'selected' : ''}>🇹🇿 Tanzania (M-Pesa, Tigo Pesa, Card, PayPal)</option>
                                <option value="OTHER" ${this.userCountry === 'OTHER' ? 'selected' : ''}>🌍 Other (Card/PayPal)</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Select Payment Method</label>
                            <div id="payment-methods-grid" class="payment-methods-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                                ${currentMethods.map(method => `
                                    <div class="payment-method" data-method-id="${method.id}" data-method-name="${method.name}" data-method-type="${method.type}" data-method-provider="${method.provider || ''}" style="padding: 12px; border: 2px solid var(--grey); border-radius: 8px; text-align: center; cursor: pointer;">
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
                                    <div class="form-hint">You will receive an STK push prompt on your phone. Enter your PIN to complete payment.</div>
                                </div>
                            </div>
                            
                            <div id="card-details" class="payment-detail" style="display: none;">
                                <div class="form-group">
                                    <label class="form-label">Card Number *</label>
                                    <input type="text" id="card-number" class="form-input" placeholder="4242 4242 4242 4242" maxlength="19">
                                </div>
                                <div class="form-row" style="display: flex; gap: 10px;">
                                    <div class="form-group" style="flex: 1;">
                                        <label class="form-label">Expiry Date *</label>
                                        <input type="text" id="card-expiry" class="form-input" placeholder="MM/YY" maxlength="5">
                                    </div>
                                    <div class="form-group" style="flex: 1;">
                                        <label class="form-label">CVV *</label>
                                        <input type="password" id="card-cvv" class="form-input" placeholder="123" maxlength="4">
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">Cardholder Name *</label>
                                    <input type="text" id="card-name" class="form-input" placeholder="Name on card">
                                </div>
                                <div class="form-hint">Your card details are securely processed by IntaSend. We do not store card information.</div>
                            </div>
                            
                            <div id="paypal-details" class="payment-detail" style="display: none;">
                                <div class="form-group">
                                    <label class="form-label">PayPal Email *</label>
                                    <input type="email" id="payment-paypal-email" class="form-input" placeholder="your@paypal.com" value="${this.userEmail || ''}">
                                </div>
                                <div class="form-hint">You will be redirected to PayPal to complete payment.</div>
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button class="btn btn-outline" id="promo-step4-back">← Back</button>
                            <button class="btn btn-primary" id="promo-submit-payment" disabled>Pay Now</button>
                        </div>
                    </div>
                    
                    <div id="promo-step-5" class="promo-step" style="display: none;">
                        <h3 style="margin-bottom: 15px;">Verify & Activate Your Ad</h3>
                        
                        <div class="verification-options" style="margin-bottom: 20px;">
                            <div class="verification-tabs" style="display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid var(--grey);">
                                <button class="verification-tab active" data-tab="auto" style="padding: 10px 15px; background: none; border: none; cursor: pointer; font-weight: 600; color: var(--primary); border-bottom: 2px solid var(--primary);">Auto Verification</button>
                                <button class="verification-tab" data-tab="manual" style="padding: 10px 15px; background: none; border: none; cursor: pointer; font-weight: 600;">Manual Verification</button>
                            </div>
                            
                            <div id="auto-verify-tab" class="verification-tab-content">
                                <div id="payment-status-checker" style="text-align: center; padding: 20px;">
                                    <div class="loader" style="border: 4px solid #f3f3f3; border-top: 4px solid var(--primary); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
                                    <p>Checking payment status...</p>
                                    <p id="status-message" style="font-size: 0.85rem; color: var(--grey-dark);"></p>
                                </div>
                                <div id="payment-success-display" style="display: none; text-align: center; padding: 20px;">
                                    <i class="fas fa-check-circle" style="font-size: 3rem; color: #27ae60; margin-bottom: 15px;"></i>
                                    <h4>Payment Verified Successfully!</h4>
                                    <p>Your ad is now being activated.</p>
                                </div>
                            </div>
                            
                            <div id="manual-verify-tab" class="verification-tab-content" style="display: none;">
                                <p style="margin-bottom: 15px;">If you have already paid but haven't received confirmation, enter your payment details below:</p>
                                
                                <div class="form-group">
                                    <label class="form-label">Payment Method *</label>
                                    <select id="manual-payment-method" class="form-input">
                                        <option value="">Select payment method</option>
                                        <option value="M-Pesa">M-Pesa</option>
                                        <option value="Airtel Money">Airtel Money</option>
                                        <option value="MTN Money">MTN Money</option>
                                        <option value="Tigo Pesa">Tigo Pesa</option>
                                        <option value="Card">Credit/Debit Card</option>
                                        <option value="PayPal">PayPal</option>
                                    </select>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">Transaction Code / Reference *</label>
                                    <input type="text" id="manual-transaction-code" class="form-input" placeholder="e.g., R8X9K2L4M or M-Pesa confirmation code">
                                    <div class="form-hint">Enter the transaction ID from your payment confirmation message or email.</div>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">Phone Number Used (for M-Pesa/Airtel)</label>
                                    <input type="tel" id="manual-phone-number" class="form-input" placeholder="e.g., 254712345678">
                                </div>
                                
                                <div class="warning-item" style="margin: 15px 0; padding: 12px; background: rgba(243, 156, 18, 0.1); border-radius: 8px;">
                                    <i class="fas fa-info-circle"></i>
                                    <span style="font-size: 0.8rem;">Our team will verify your payment within 5-10 minutes during business hours.</span>
                                </div>
                                
                                <button class="btn btn-primary" id="submit-manual-verification" style="width: 100%;">Submit for Verification</button>
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button class="btn btn-outline" id="promo-step5-back">← Back to Payment</button>
                            <button class="btn btn-success" id="promo-activate-btn" style="display: none;">Activate Ad Now</button>
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
        let currentTransactionId = null;
        
        window.selectedPackage = null;
        
        // Step 1: Select Ad
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
                setTimeout(() => adSelect.dispatchEvent(new Event('change')), 100);
            }
        }
        
        if (step1Next) {
            step1Next.addEventListener('click', () => {
                if (selectedAd) this.goToPromoStep(2);
            });
        }
        
        // Step 2: Select Package
        const packageCards = document.querySelectorAll('.package-card');
        const step2Next = document.getElementById('promo-step2-next');
        const step2Back = document.getElementById('promo-step2-back');
        
        packageCards.forEach(card => {
            card.addEventListener('click', () => {
                packageCards.forEach(c => {
                    c.style.borderColor = 'var(--grey)';
                    c.style.backgroundColor = 'transparent';
                });
                card.style.borderColor = 'var(--primary)';
                card.style.backgroundColor = 'rgba(46, 134, 222, 0.1)';
                
                selectedPackage = {
                    id: card.getAttribute('data-package-id'),
                    name: card.getAttribute('data-package-name'),
                    price: parseInt(card.getAttribute('data-package-price')),
                    duration: parseInt(card.getAttribute('data-package-duration')),
                    originalPriceKES: parseInt(card.getAttribute('data-package-price'))
                };
                window.selectedPackage = selectedPackage;
                
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
        
        // Step 3: Select Action
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
                            window.showToast('Please enter a valid WhatsApp number', 'error');
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
                            window.showToast('Please enter a valid phone number', 'error');
                            isValid = false;
                        } else {
                            selectedActionDetails = callPhone;
                        }
                        break;
                    case 'email':
                        const email = document.getElementById('action-email-address')?.value;
                        if (!email || !email.includes('@')) {
                            window.showToast('Please enter a valid email address', 'error');
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
                            window.showToast('Please enter a valid website URL (https://...)', 'error');
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
        
        // Step 4: Payment Method
        const submitPaymentBtn = document.getElementById('promo-submit-payment');
        const step4Back = document.getElementById('promo-step4-back');
        const countrySelect = document.getElementById('payment-country');
        
        if (countrySelect) {
            countrySelect.addEventListener('change', async (e) => {
                this.userCountry = e.target.value;
                this.userCurrency = this.getCurrencyForCountry(this.userCountry);
                await this.updatePaymentMethodsForCountry(e.target.value);
            });
        }
        
        // Function to attach payment method click handlers
        const attachPaymentMethodHandlers = () => {
            const methodElements = document.querySelectorAll('.payment-method');
            console.log('Attaching handlers to', methodElements.length, 'payment methods');
            
            methodElements.forEach(method => {
                const newMethod = method.cloneNode(true);
                method.parentNode.replaceChild(newMethod, method);
                
                newMethod.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    console.log('Payment method clicked:', newMethod.getAttribute('data-method-id'));
                    
                    document.querySelectorAll('.payment-method').forEach(m => {
                        m.style.borderColor = 'var(--grey)';
                        m.style.backgroundColor = 'transparent';
                    });
                    
                    newMethod.style.borderColor = 'var(--primary)';
                    newMethod.style.backgroundColor = 'rgba(46, 134, 222, 0.1)';
                    
                    selectedPaymentMethod = {
                        id: newMethod.getAttribute('data-method-id'),
                        name: newMethod.getAttribute('data-method-name'),
                        type: newMethod.getAttribute('data-method-type'),
                        provider: newMethod.getAttribute('data-method-provider')
                    };
                    
                    console.log('Selected payment method:', selectedPaymentMethod);
                    
                    const paymentDetailsContainer = document.getElementById('payment-details-container');
                    if (paymentDetailsContainer) paymentDetailsContainer.style.display = 'block';
                    
                    document.querySelectorAll('.payment-detail').forEach(detail => {
                        detail.style.display = 'none';
                    });
                    
                    if (selectedPaymentMethod.type === 'mobile_money') {
                        const mobileForm = document.getElementById('mobile-money-details');
                        if (mobileForm) mobileForm.style.display = 'block';
                    } else if (selectedPaymentMethod.id === 'card') {
                        const cardForm = document.getElementById('card-details');
                        if (cardForm) cardForm.style.display = 'block';
                    } else if (selectedPaymentMethod.id === 'paypal') {
                        const paypalForm = document.getElementById('paypal-details');
                        if (paypalForm) paypalForm.style.display = 'block';
                    }
                    
                    if (submitPaymentBtn) submitPaymentBtn.disabled = false;
                });
            });
        };
        
        setTimeout(() => {
            attachPaymentMethodHandlers();
        }, 200);
        
        const originalUpdateMethods = this.updatePaymentMethodsForCountry;
        this.updatePaymentMethodsForCountry = async function(country) {
            await originalUpdateMethods.call(this, country);
            setTimeout(() => {
                attachPaymentMethodHandlers();
            }, 200);
        };
        
        if (submitPaymentBtn) {
            submitPaymentBtn.addEventListener('click', async () => {
                console.log('Pay button clicked. Selected payment method:', selectedPaymentMethod);
                
                if (!selectedPaymentMethod) {
                    window.showToast('Please select a payment method first', 'warning');
                    return;
                }
                
                let paymentDetails = {};
                
                if (selectedPaymentMethod.type === 'mobile_money') {
                    let phone = document.getElementById('payment-phone-number')?.value;
                    if (!phone || phone.length < 10) {
                        window.showToast('Please enter a valid phone number (e.g., 0712345678 or 254712345678)', 'error');
                        return;
                    }
                    phone = phone.replace(/\s/g, '');
                    if (phone.startsWith('0')) {
                        phone = '254' + phone.substring(1);
                    } else if (phone.startsWith('+')) {
                        phone = phone.substring(1);
                    }
                    if (phone.length < 12) {
                        window.showToast('Please enter a valid phone number with country code (e.g., 254712345678)', 'error');
                        return;
                    }
                    paymentDetails.phone = phone;
                } else if (selectedPaymentMethod.id === 'card') {
                    const cardNumber = document.getElementById('card-number')?.value.replace(/\s/g, '');
                    const cardExpiry = document.getElementById('card-expiry')?.value;
                    const cardCvv = document.getElementById('card-cvv')?.value;
                    const cardName = document.getElementById('card-name')?.value;
                    
                    if (!cardNumber || cardNumber.length < 15) {
                        window.showToast('Please enter a valid card number', 'error');
                        return;
                    }
                    if (!cardExpiry || !cardExpiry.includes('/')) {
                        window.showToast('Please enter expiry date (MM/YY)', 'error');
                        return;
                    }
                    if (!cardCvv || cardCvv.length < 3) {
                        window.showToast('Please enter CVV', 'error');
                        return;
                    }
                    if (!cardName) {
                        window.showToast('Please enter cardholder name', 'error');
                        return;
                    }
                    
                    paymentDetails = {
                        card_number: cardNumber,
                        card_expiry: cardExpiry,
                        card_cvv: cardCvv,
                        card_name: cardName
                    };
                } else if (selectedPaymentMethod.id === 'paypal') {
                    const email = document.getElementById('payment-paypal-email')?.value;
                    if (!email || !email.includes('@')) {
                        window.showToast('Please enter a valid PayPal email', 'error');
                        return;
                    }
                    paymentDetails = { email: email };
                }
                
                submitPaymentBtn.disabled = true;
                submitPaymentBtn.innerHTML = '<div class="spinner"></div> Processing...';
                
                currentTransactionId = await this.processPayment(
                    selectedAd, selectedPackage, selectedAction, selectedActionDetails,
                    selectedPaymentMethod, paymentDetails
                );
                
                if (currentTransactionId) {
                    this.goToPromoStep(5);
                    this.startPaymentStatusCheck(currentTransactionId);
                } else {
                    submitPaymentBtn.disabled = false;
                    submitPaymentBtn.innerHTML = 'Pay Now';
                }
            });
        }
        
        if (step4Back) {
            step4Back.addEventListener('click', () => this.goToPromoStep(3));
        }
        
        // Step 5: Verification
        const verificationTabs = document.querySelectorAll('.verification-tab');
        const step5Back = document.getElementById('promo-step5-back');
        const manualVerifyBtn = document.getElementById('submit-manual-verification');
        
        verificationTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                verificationTabs.forEach(t => {
                    t.classList.remove('active');
                    t.style.color = '';
                    t.style.borderBottom = '';
                });
                tab.classList.add('active');
                tab.style.color = 'var(--primary)';
                tab.style.borderBottom = '2px solid var(--primary)';
                
                const tabId = tab.getAttribute('data-tab');
                document.getElementById('auto-verify-tab').style.display = tabId === 'auto' ? 'block' : 'none';
                document.getElementById('manual-verify-tab').style.display = tabId === 'manual' ? 'block' : 'none';
                
                if (tabId === 'auto' && currentTransactionId) {
                    this.startPaymentStatusCheck(currentTransactionId);
                }
            });
        });
        
        if (manualVerifyBtn) {
            manualVerifyBtn.addEventListener('click', async () => {
                const paymentMethod = document.getElementById('manual-payment-method')?.value;
                const transactionCode = document.getElementById('manual-transaction-code')?.value;
                const phoneNumber = document.getElementById('manual-phone-number')?.value;
                
                if (!paymentMethod) {
                    window.showToast('Please select payment method', 'error');
                    return;
                }
                if (!transactionCode) {
                    window.showToast('Please enter transaction code', 'error');
                    return;
                }
                
                window.showToast('Submitting for verification...', 'info');
                
                await firebase.firestore().collection('payment_verifications').add({
                    transactionId: currentTransactionId,
                    adId: selectedAd?.id,
                    adTitle: selectedAd?.title,
                    packageName: selectedPackage?.name,
                    amount: selectedPackage?.price,
                    paymentMethod: paymentMethod,
                    transactionCode: transactionCode,
                    phoneNumber: phoneNumber,
                    userId: this.userId,
                    userEmail: this.userEmail,
                    action: selectedAction,
                    actionDetails: selectedActionDetails,
                    status: 'pending_verification',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                window.showToast('Verification request submitted! Our team will review and activate your ad shortly.', 'success');
                
                setTimeout(() => {
                    const modal = document.getElementById('ad-packages-full-modal');
                    if (modal) modal.style.display = 'none';
                }, 3000);
            });
        }
        
        if (step5Back) {
            step5Back.addEventListener('click', () => this.goToPromoStep(4));
        }
        
        window.paymentSystem = this;
    }

    async updatePaymentMethodsForCountry(country) {
        this.userCountry = country;
        this.userCurrency = this.getCurrencyForCountry(country);
        const newMethods = this.getAvailablePaymentMethods(country);
        const methodsContainer = document.getElementById('payment-methods-grid');
        
        if (window.selectedPackage) {
            const convertedPrice = await this.convertCurrency(window.selectedPackage.originalPriceKES || window.selectedPackage.price, 'KES', this.userCurrency);
            window.selectedPackage.displayPrice = convertedPrice;
            window.selectedPackage.displayCurrency = this.userCurrency;
            
            const summaryPrice = document.getElementById('summary-package-price');
            if (summaryPrice) {
                summaryPrice.textContent = `${this.userCurrency} ${convertedPrice.toLocaleString()}`;
            }
        }
        
        if (methodsContainer) {
            methodsContainer.innerHTML = newMethods.map(method => `
                <div class="payment-method" data-method-id="${method.id}" data-method-name="${method.name}" data-method-type="${method.type}" data-method-provider="${method.provider || ''}" style="padding: 12px; border: 2px solid var(--grey); border-radius: 8px; text-align: center; cursor: pointer;">
                    <i class="${method.icon}" style="font-size: 1.2rem;"></i>
                    <div style="font-size: 0.8rem;">${method.name}</div>
                </div>
            `).join('');
        }
    }

    async processPayment(ad, pkg, action, actionDetails, paymentMethod, paymentDetails) {
    const transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (pkg.duration || 3));
    
    try {
        let finalAmount = pkg.price;
        let finalCurrency = 'KES';
        
        if (this.userCurrency !== 'KES') {
            finalAmount = await this.convertCurrency(pkg.price, 'KES', this.userCurrency);
            finalCurrency = this.userCurrency;
        }
        
        // Format phone number
        let formattedPhone = paymentDetails.phone || '';
        if (formattedPhone && formattedPhone.startsWith('0')) {
            formattedPhone = '254' + formattedPhone.substring(1);
        } else if (formattedPhone && !formattedPhone.startsWith('254') && formattedPhone.length === 9) {
            formattedPhone = '254' + formattedPhone;
        }
        
        // Save transaction to Firestore
        const paymentRecord = {
            transactionId: transactionId,
            adId: ad.id,
            adTitle: ad.title,
            packageName: pkg.name,
            amount: finalAmount,
            originalAmountKES: pkg.price,
            currency: finalCurrency,
            duration: pkg.duration,
            paymentMethod: paymentMethod.name,
            status: 'pending',
            userId: this.userId,
            userEmail: this.userEmail || 'customer@vikeserve.com',
            userPhone: formattedPhone || this.userPhone,
            action: { type: action, details: actionDetails },
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            expiresAt: firebase.firestore.Timestamp.fromDate(expiresAt),
            userCountry: this.userCountry
        };
        
        await firebase.firestore().collection('transactions').add(paymentRecord);
        
        // Close the modal
        const modal = document.getElementById('ad-packages-full-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        // Use IntaSend InlineJS - This avoids all CORS and DNS issues
        if (typeof window.IntaSend === 'undefined') {
            window.showToast('Loading payment system...', 'info');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        const intaSend = new window.IntaSend({
            publicAPIKey: this.config.intasend.publicKey,
            live: true  // Set to true for live payments
        });
        
        intaSend
            .on("COMPLETE", async (results) => {
                console.log("Payment successful!", results);
                window.showToast('Payment successful! Activating your ad...', 'success');
                await this.activatePromotion(transactionId);
                this.goToPromoStep(5);
                this.startPaymentStatusCheck(transactionId);
            })
            .on("FAILED", (results) => {
                console.log("Payment failed!", results);
                window.showToast('Payment failed. Please try again.', 'error');
            })
            .on("IN-PROGRESS", (results) => {
                console.log("Payment in progress...", results);
                window.showToast('Processing payment...', 'info');
            });
        
        // Prepare the data for IntaSend
        const paymentData = {
            amount: finalAmount,
            currency: finalCurrency,
            email: this.userEmail || 'customer@vikeserve.com',
            api_ref: transactionId,
            comment: `Ad Promotion: ${pkg.name} for ${ad.title.substring(0, 50)}`,
            first_name: this.userEmail?.split('@')[0] || 'Customer'
        };
        
        // Add phone number for mobile money
        if (paymentMethod.type === 'mobile_money' && formattedPhone && formattedPhone.length >= 12) {
            paymentData.phone_number = formattedPhone;
        }
        
        // Add method to force specific payment type
        if (paymentMethod.id === 'mpesa' || paymentMethod.id === 'airtel_kenya' || paymentMethod.id === 'mtn_uganda' || paymentMethod.id === 'mpesa_tz' || paymentMethod.id === 'tigo_pesa') {
            paymentData.method = 'M-PESA';
        } else if (paymentMethod.id === 'card') {
            paymentData.method = 'CARD-PAYMENT';
        }
        
        console.log('Opening IntaSend modal with:', paymentData);
        
        // Open the IntaSend payment modal
        intaSend.open(paymentData);
        
        return transactionId;
        
    } catch (error) {
        console.error('Payment error:', error);
        window.showToast(error.message || 'Payment service error. Please try again.', 'error');
        return null;
    }
}

    async startPaymentStatusCheck(transactionId) {
        const statusChecker = document.getElementById('payment-status-checker');
        const successDisplay = document.getElementById('payment-success-display');
        const statusMessage = document.getElementById('status-message');
        
        let attempts = 0;
        const maxAttempts = 60;
        
        const checkStatus = async () => {
            attempts++;
            
            try {
                const snapshot = await firebase.firestore()
                    .collection('transactions')
                    .where('transactionId', '==', transactionId)
                    .get();
                
                if (!snapshot.empty) {
                    const transaction = snapshot.docs[0].data();
                    
                    if (transaction.status === 'completed') {
                        if (statusChecker) statusChecker.style.display = 'none';
                        if (successDisplay) successDisplay.style.display = 'block';
                        if (statusMessage) statusMessage.textContent = '✅ Payment confirmed! Your ad is now active.';
                        window.showToast('Payment successful! Your ad is now promoted!', 'success');
                        await this.activatePromotion(transactionId);
                        return;
                    } else if (transaction.status === 'failed') {
                        if (statusMessage) statusMessage.textContent = '❌ Payment failed. Please try again or use manual verification.';
                        return;
                    }
                }
                
                if (statusMessage) {
                    statusMessage.textContent = `Waiting for payment confirmation... (${attempts}/${maxAttempts})`;
                }
                
                if (attempts < maxAttempts) {
                    setTimeout(checkStatus, 2000);
                } else {
                    if (statusMessage) statusMessage.textContent = '⚠️ Payment confirmation taking longer than expected. Please use Manual Verification tab.';
                }
                
            } catch (error) {
                console.error('Status check error:', error);
                if (attempts < maxAttempts) {
                    setTimeout(checkStatus, 3000);
                }
            }
        };
        
        checkStatus();
    }

    async activatePromotion(transactionId) {
        try {
            const transactionSnapshot = await firebase.firestore()
                .collection('transactions')
                .where('transactionId', '==', transactionId)
                .get();
            
            if (transactionSnapshot.empty) return;
            
            const transaction = transactionSnapshot.docs[0].data();
            const adId = transaction.adId;
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + transaction.duration);
            
            await firebase.firestore().collection('marketplace_items').doc(adId).update({
                promoted: true,
                promotionPackage: transaction.packageName,
                promotionExpiresAt: firebase.firestore.Timestamp.fromDate(expiresAt),
                promotionAction: transaction.action,
                promotedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            await firebase.firestore().collection('promoted_ads').add({
                adId: adId,
                adTitle: transaction.adTitle,
                packageName: transaction.packageName,
                duration: transaction.duration,
                transactionId: transactionId,
                paymentMethod: transaction.paymentMethod,
                status: 'active',
                activatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                expiresAt: firebase.firestore.Timestamp.fromDate(expiresAt),
                userId: this.userId,
                action: transaction.action
            });
            
            await transactionSnapshot.docs[0].ref.update({
                status: 'completed',
                completedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            if (typeof window.loadMarketplaceItems === 'function') {
                setTimeout(() => window.loadMarketplaceItems('all'), 500);
            }
            
        } catch (error) {
            console.error('Activation error:', error);
        }
    }

    async checkPendingTransactions() {
        if (!this.userId) return;
        
        const snapshot = await firebase.firestore()
            .collection('transactions')
            .where('userId', '==', this.userId)
            .where('status', '==', 'pending')
            .get();
        
        if (!snapshot.empty) {
            window.showToast(`You have ${snapshot.size} pending payment(s).`, 'warning');
        }
    }

    async setupPaymentStatusListener() {
        const urlParams = new URLSearchParams(window.location.search);
        const transactionRef = urlParams.get('api_ref') || urlParams.get('reference');
        const status = urlParams.get('status') || urlParams.get('payment_status');
        
        if (transactionRef && (status === 'complete' || status === 'SUCCESS' || status === 'success')) {
            console.log('Payment callback detected for:', transactionRef);
            await this.activatePromotion(transactionRef);
            window.history.replaceState({}, document.title, window.location.pathname);
            window.showToast('Payment successful! Your ad is now promoted.', 'success');
        }
    }

    goToPromoStep(step) {
        for (let i = 1; i <= 5; i++) {
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
        });
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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

window.paymentSystem = getPaymentSystem();
window.getPaymentSystem = getPaymentSystem;
window.showAdPackagesModal = showAdPackagesModal;

const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

console.log('✅ Payment system loaded with CORS fix, currency conversion, and verification tab');