// more-menu.js - COMPLETE FIXED VERSION with FULL CHAT IMPLEMENTATION
// FIXES: Alert sender avatars, Reply with tagging, Report alerts, Chat display fix
// UPDATED: Settings UI - Removed duplicate rate button, added founder bio, changed labels

class MoreMenuManager {
    constructor() {
        this.currentMoreTab = 'education';
        this.db = firebase.firestore();
        this.auth = firebase.auth();
        this.currentUser = null;
        this.hasRated = false;
        this.currentChatUnsubscribe = null;
        this.typingUnsubscribe = null;
        this.firstMessageDoc = null;
        this.init();
    }
    
    async init() {
        console.log('More Menu Manager initializing with Firestore...');
        
        this.auth.onAuthStateChanged((user) => {
            this.currentUser = user;
            if (user) {
                this.checkIfUserHasRated();
                this.loadDataFromFirestore();
            }
        });
        
        await this.initializeFirestoreData();
        this.replaceAllTabContent();
        this.setupEventListeners();
        await this.loadDataFromFirestore();
        console.log('✅ More Menu Manager ready with Firestore');
    }
    
    async initializeFirestoreData() {
        const founderRef = this.db.collection('system_settings').doc('founder');
        const founderDoc = await founderRef.get();
        
        if (!founderDoc.exists) {
            await founderRef.set({
                name: 'Victor Wanyama',
                email: 'vikeserve426@gmail.com',
                role: 'founder',
                totalStars: 0,
                ratingCount: 0,
                averageRating: 5.0,
                portfolioUrl: 'https://vike-store.netlify.app/',
                county: 'Kakamega',
                country: 'Kenya',
                schools: 'Kakamega High School, Jomo Kenyatta University of Agriculture and Technology (JKUAT)',
                achievements: 'Full Stack Developer, Firebase Expert, App Creator',
                bio: 'Passionate full-stack developer creating solutions that empower local communities.',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        const announcementsSnapshot = await this.db.collection('announcements').limit(1).get();
        if (announcementsSnapshot.empty) {
            const defaultAnnouncements = [
                {
                    id: Date.now(),
                    title: '🎉 Welcome to VikeServe!',
                    message: 'Thank you for using VikeServe! We\'re constantly improving to serve you better.',
                    date: firebase.firestore.FieldValue.serverTimestamp(),
                    isRead: false,
                    isGlobal: true
                },
                {
                    id: Date.now() + 1,
                    title: '✨ New Feature: Ad Promotion',
                    message: 'You can now promote your ads to reach more customers!',
                    date: firebase.firestore.FieldValue.serverTimestamp(),
                    isRead: false,
                    isGlobal: true
                }
            ];
            
            for (const announcement of defaultAnnouncements) {
                await this.db.collection('announcements').add(announcement);
            }
        }
        
        const termsRef = this.db.collection('system_settings').doc('terms');
        const termsDoc = await termsRef.get();
        if (!termsDoc.exists) {
            await termsRef.set({
                content: this.getDefaultTermsContent(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        const packagesRef = this.db.collection('ad_packages');
        const packagesSnapshot = await packagesRef.limit(1).get();
        if (packagesSnapshot.empty) {
            const defaultPackages = [
                { id: 'basic', name: 'Basic Boost', price: 100, duration: 3, tag: 'POPULAR', color: '#27ae60' },
                { id: 'premium', name: 'Premium Reach', price: 250, duration: 7, tag: 'BEST VALUE', color: '#2E86DE' },
                { id: 'pro', name: 'Pro Featured', price: 500, duration: 14, tag: 'HOT', color: '#f39c12' },
                { id: 'vip', name: 'VIP Spotlight', price: 1000, duration: 30, tag: 'VIP', color: '#e74c3c' }
            ];
            for (const pkg of defaultPackages) {
                await packagesRef.add(pkg);
            }
        }
    }
    
    getDefaultTermsContent() {
        return `
            <h4>1. Acceptance of Terms</h4>
            <p>By using VikeServe, you agree to these terms and conditions.</p>
            <h4>2. User Responsibilities</h4>
            <p>You are responsible for the accuracy of information you provide.</p>
            <h4>3. Prohibited Activities</h4>
            <p>You may not post false information, spam, or engage in fraudulent activities.</p>
            <h4>4. Payments and Fees</h4>
            <p>Service fees apply for promoted ads. All payments are processed securely.</p>
            <h4>5. Contact</h4>
            <p>For questions, contact vikeserve426@gmail.com</p>
        `;
    }
    
    async checkIfUserHasRated() {
        if (!this.currentUser) return;
        const ratingSnapshot = await this.db.collection('ratings')
            .where('userId', '==', this.currentUser.uid)
            .get();
        this.hasRated = !ratingSnapshot.empty;
    }
    
    async replaceAllTabContent() {
        console.log('Replacing all more tab content...');
        
        const educationContent = document.getElementById('education-content');
        if (educationContent) educationContent.innerHTML = this.getEducationHTML();
        
        const alertsContent = document.getElementById('alerts-content');
        if (alertsContent) alertsContent.innerHTML = this.getAlertsHTML();
        
        const messagesContent = document.getElementById('messages-content');
        if (messagesContent) messagesContent.innerHTML = this.getMessagesHTML();
        
        const safetyContent = document.getElementById('safety-content');
        if (safetyContent) safetyContent.innerHTML = this.getSafetyHTML();
        
        const settingsContent = document.getElementById('settings-content');
        if (settingsContent) {
            const settingsHTML = await this.getSettingsHTML();
            settingsContent.innerHTML = settingsHTML;
        }
    }
    
    getEducationHTML() {
        return `
            <div class="section-title"><i class="fas fa-graduation-cap"></i> Education & Skills</div>
            <div class="education-actions" style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
                <button class="post-teacher-btn btn btn-primary" style="flex: 1; padding: 12px;"><i class="fas fa-school"></i> Post Teaching Position</button>
                <button class="post-internship-btn btn btn-outline" style="flex: 1; padding: 12px;"><i class="fas fa-briefcase"></i> Post Internship</button>
                <button class="offer-attachment-btn btn btn-outline" style="flex: 1; padding: 12px;"><i class="fas fa-user-graduate"></i> Offer Attachment</button>
                <button class="post-training-btn btn btn-outline" style="flex: 1; padding: 12px;"><i class="fas fa-tools"></i> Offer Training</button>
            </div>
            
            <div class="education-section" style="margin-bottom: 25px;">
                <h3 style="margin-bottom: 10px;"><i class="fas fa-chalkboard-teacher"></i> Teachers Available</h3>
                <div id="teachers-list-container" class="teachers-list">
                    <div class="loading-spinner">Loading teachers...</div>
                </div>
            </div>
            
            <div class="education-section" style="margin-bottom: 25px;">
                <h3 style="margin-bottom: 10px;"><i class="fas fa-briefcase"></i> Internship Opportunities</h3>
                <div id="internships-list-container" class="internships-list">
                    <div class="loading-spinner">Loading internships...</div>
                </div>
            </div>
            
            <div class="education-section" style="margin-bottom: 25px;">
                <h3 style="margin-bottom: 10px;"><i class="fas fa-user-graduate"></i> Attachment Positions</h3>
                <div id="attachments-list-container" class="attachments-list">
                    <div class="loading-spinner">Loading attachments...</div>
                </div>
            </div>
            
            <div class="education-section" style="margin-bottom: 25px;">
                <h3 style="margin-bottom: 10px;"><i class="fas fa-tools"></i> Training Programs</h3>
                <div id="training-list-container" class="training-list">
                    <div class="loading-spinner">Loading training programs...</div>
                </div>
            </div>
        `;
    }
    
    getAlertsHTML() {
        return `
            <div class="section-title"><i class="fas fa-bell"></i> Community Alerts</div>
            <div style="margin-bottom: 20px;">
                <button class="report-alert-btn btn btn-primary" style="width: 100%;"><i class="fas fa-plus-circle"></i> Report Community Alert</button>
            </div>
            <div class="alerts-filters" style="display: flex; gap: 8px; margin-bottom: 15px; overflow-x: auto; padding-bottom: 5px;">
                <button class="filter-alert-btn active" data-filter="all" style="padding: 6px 12px; background: var(--primary); color: white; border: none; border-radius: 20px;">All</button>
                <button class="filter-alert-btn" data-filter="emergency" style="padding: 6px 12px; background: var(--light); border: none; border-radius: 20px;">Emergency</button>
                <button class="filter-alert-btn" data-filter="warning" style="padding: 6px 12px; background: var(--light); border: none; border-radius: 20px;">Warning</button>
                <button class="filter-alert-btn" data-filter="info" style="padding: 6px 12px; background: var(--light); border: none; border-radius: 20px;">Info</button>
                <button class="filter-alert-btn" data-filter="event" style="padding: 6px 12px; background: var(--light); border: none; border-radius: 20px;">Event</button>
            </div>
            <div id="alerts-list-container">
                <div class="loading-spinner">Loading alerts...</div>
            </div>
        `;
    }
    
    getMessagesHTML() {
    return `
        <div class="messages-container" style="display: flex; flex-direction: column; height: 100%; min-height: 500px;">
            <div class="search-bar" style="margin-bottom: 15px;">
                <i class="fas fa-search search-icon"></i>
                <input type="text" id="message-search-input" class="search-input" placeholder="Search conversations...">
            </div>
            <div id="conversations-list-container" style="flex: 1; overflow-y: auto;">
                <div class="loading-spinner">Loading conversations...</div>
            </div>
            <div style="text-align: center; margin-top: 20px;">
                <button class="new-chat-btn btn btn-primary" style="width: auto; padding: 10px 24px;"><i class="fas fa-plus"></i> Start New Chat</button>
            </div>
        </div>
    `;
}
    
    getSafetyHTML() {
        return `
            <div class="section-title"><i class="fas fa-shield-alt"></i> Safety Information</div>
            <div class="safety-categories" style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
                <button class="safety-cat-btn active" data-cat="payment" style="padding: 10px 15px; background: var(--primary); color: white; border: none; border-radius: 20px;"><i class="fas fa-money-bill-wave"></i> Payment Safety</button>
                <button class="safety-cat-btn" data-cat="personal" style="padding: 10px 15px; background: var(--light); border: none; border-radius: 20px;"><i class="fas fa-user-shield"></i> Personal Safety</button>
                <button class="safety-cat-btn" data-cat="home" style="padding: 10px 15px; background: var(--light); border: none; border-radius: 20px;"><i class="fas fa-home"></i> Home Safety</button>
                <button class="safety-cat-btn" data-cat="transport" style="padding: 10px 15px; background: var(--light); border: none; border-radius: 20px;"><i class="fas fa-car"></i> Transport Safety</button>
                <button class="safety-cat-btn" data-cat="online" style="padding: 10px 15px; background: var(--light); border: none; border-radius: 20px;"><i class="fas fa-laptop"></i> Online Safety</button>
                <button class="safety-cat-btn" data-cat="emergency" style="padding: 10px 15px; background: var(--light); border: none; border-radius: 20px;"><i class="fas fa-phone-alt"></i> Emergency Contacts</button>
            </div>
            
            <div data-safety-content="payment" class="safety-content-active">
                <div style="background: var(--light); padding: 15px; border-radius: 12px; margin-bottom: 10px;">
                    <strong><i class="fas fa-check-circle" style="color: #27ae60;"></i> DO: Meet in person before payment</strong>
                    <p style="margin-top: 5px;">Always verify the service or product quality before making any payments.</p>
                </div>
                <div style="background: var(--light); padding: 15px; border-radius: 12px; margin-bottom: 10px;">
                    <strong><i class="fas fa-times-circle" style="color: #e74c3c;"></i> DON'T: Send money to unknown accounts</strong>
                    <p style="margin-top: 5px;">Avoid sending money to personal accounts without proper verification.</p>
                </div>
            </div>
            
            <div data-safety-content="personal" style="display: none;">
                <div style="background: var(--light); padding: 15px; border-radius: 12px; margin-bottom: 10px;">
                    <strong><i class="fas fa-check-circle" style="color: #27ae60;"></i> Meet in public places</strong>
                    <p style="margin-top: 5px;">Always arrange to meet in well-lit, public areas for the first meeting.</p>
                </div>
                <div style="background: var(--light); padding: 15px; border-radius: 12px; margin-bottom: 10px;">
                    <strong><i class="fas fa-check-circle" style="color: #27ae60;"></i> Tell someone about your meeting</strong>
                    <p style="margin-top: 5px;">Always inform a friend or family member about your meeting plans.</p>
                </div>
            </div>
            
            <div data-safety-content="home" style="display: none;">
                <div style="background: var(--light); padding: 15px; border-radius: 12px; margin-bottom: 10px;">
                    <strong><i class="fas fa-check-circle" style="color: #27ae60;"></i> Verify service providers</strong>
                    <p style="margin-top: 5px;">Always check credentials, reviews, and ratings before allowing anyone into your home.</p>
                </div>
            </div>
            
            <div data-safety-content="transport" style="display: none;">
                <div style="background: var(--light); padding: 15px; border-radius: 12px; margin-bottom: 10px;">
                    <strong><i class="fas fa-check-circle" style="color: #27ae60;"></i> Use registered services</strong>
                    <p style="margin-top: 5px;">Only use registered transport providers with verified credentials.</p>
                </div>
            </div>
            
            <div data-safety-content="online" style="display: none;">
                <div style="background: var(--light); padding: 15px; border-radius: 12px; margin-bottom: 10px;">
                    <strong><i class="fas fa-check-circle" style="color: #27ae60;"></i> Use strong passwords</strong>
                    <p style="margin-top: 5px;">Create unique, strong passwords for your VikeServe account.</p>
                </div>
            </div>
            
            <div data-safety-content="emergency" style="display: none;">
                <div style="background: var(--light); border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                    <h4 style="margin-bottom: 15px; color: var(--emergency);"><i class="fas fa-phone-alt"></i> Emergency Contacts (Kenya)</h4>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <div class="emergency-contact-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: white; border-radius: 10px; border-left: 4px solid #e74c3c;">
                            <div><strong><i class="fas fa-shield-alt"></i> Police Emergency</strong><div style="font-size: 0.8rem; color: #666;">General emergencies</div></div>
                            <button class="btn btn-sm btn-danger emergency-call-btn" data-number="999" style="padding: 8px 16px;">Call 999</button>
                        </div>
                        <div class="emergency-contact-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: white; border-radius: 10px; border-left: 4px solid #e74c3c;">
                            <div><strong><i class="fas fa-phone-alt"></i> Emergency (All Networks)</strong><div style="font-size: 0.8rem; color: #666;">Works even without airtime</div></div>
                            <button class="btn btn-sm btn-danger emergency-call-btn" data-number="112" style="padding: 8px 16px;">Call 112</button>
                        </div>
                        <div class="emergency-contact-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: white; border-radius: 10px; border-left: 4px solid #2ecc71;">
                            <div><strong><i class="fas fa-brain"></i> Mental Health Helpline</strong><div style="font-size: 0.8rem; color: #666;">Counselling support</div></div>
                            <button class="btn btn-sm btn-success emergency-call-btn" data-number="1199" style="padding: 8px 16px;">Call 1199</button>
                        </div>
                        <div class="emergency-contact-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--primary); color: white; border-radius: 10px;">
                            <div><strong><i class="fas fa-headset"></i> VikeServe Support</strong><div style="font-size: 0.8rem; opacity: 0.9;">App support</div></div>
                            <button class="btn btn-sm btn-light vikeserve-support-btn" style="padding: 8px 16px; background: white; color: var(--primary);">Contact Support</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    async getSettingsHTML() {
    const founderDoc = await this.db.collection('system_settings').doc('founder').get();
    const founder = founderDoc.exists ? founderDoc.data() : { 
        name: 'Victor Wanyama', 
        totalStars: 0, 
        ratingCount: 0, 
        averageRating: 5.0, 
        portfolioUrl: 'https://vike-store.netlify.app/',
        county: 'Bungoma',
        country: 'Kenya',
        schools: 'St josephs Nalondo Boys High School, Kirinyaga University (KYU)',
        achievements: 'Full Stack Developer, Firebase Expert, App Creator',
        bio: 'Passionate full-stack developer creating solutions that empower local communities.'
    };
    
    return `
        <div class="section-title"><i class="fas fa-cog"></i> Settings & Preferences</div>
        
        <div style="background: var(--light); border-radius: 12px; padding: 15px; margin-bottom: 20px;">
            <h4><i class="fas fa-palette"></i> App Preferences</h4>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--grey);">
                <div><strong>Dark Mode</strong><div style="font-size: 0.8rem; color: #666;">Switch between light and dark theme</div></div>
                <label class="switch"><input type="checkbox" class="dark-mode-toggle-settings" ${localStorage.getItem('darkMode') === 'enabled' ? 'checked' : ''}><span class="slider round"></span></label>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0;">
                <div><strong>Notifications</strong><div style="font-size: 0.8rem; color: #666;">Receive push notifications</div></div>
                <label class="switch"><input type="checkbox" class="notifications-toggle" checked><span class="slider round"></span></label>
            </div>
        </div>
        
        <!-- RATE VIKESERVE SECTION (only button, no visible bio) -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 20px; margin-bottom: 20px; color: white;">
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-star" style="font-size: 2rem;"></i>
                </div>
                <div>
                    <h3 style="margin: 0;">Rate VikeServe</h3>
                    <p style="margin: 0; opacity: 0.9;">Help us improve</p>
                </div>
            </div>
            
            <div style="text-align: center; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 12px; margin-bottom: 15px;">
                <div style="font-size: 2.5rem; font-weight: bold;">${(founder.totalStars || 0).toLocaleString()}</div>
                <div style="font-size: 0.8rem; opacity: 0.9;">⭐ Total Stars Received ⭐</div>
                <div style="margin: 10px 0;">${this.generateStarRatingHTML(founder.averageRating || 5.0)}</div>
                <div style="font-size: 0.75rem;">⭐ Average Rating: ${(founder.averageRating || 5.0).toFixed(1)} ⭐</div>
                <div style="font-size: 0.7rem; margin-top: 5px;">Based on ${(founder.ratingCount || 0).toLocaleString()} ratings</div>
            </div>
            
            <div style="display: flex; gap: 10px;">
                <button class="btn rate-founder-btn" style="flex: 1; background: white; color: #764ba2;" ${this.hasRated ? 'disabled' : ''}>
                    <i class="fas fa-star"></i> ${this.hasRated ? 'Already Rated' : 'Rate VikeServe'}
                </button>
                <button class="btn view-founder-profile-btn" style="flex: 1; background: rgba(255,255,255,0.2); color: white;">
                    <i class="fas fa-user-circle"></i> Founder
                </button>
            </div>
        </div>
        
                <!-- MY POINTS SECTION -->
        <div style="background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%); border-radius: 12px; padding: 20px; margin-bottom: 20px; color: white;">
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-coins" style="font-size: 2rem;"></i>
                </div>
                <div>
                    <h3 style="margin: 0;">My Points</h3>
                    <p style="margin: 0; opacity: 0.9;">Earn points from reviews</p>
                </div>
            </div>
            
            <div style="text-align: center; padding: 15px; background: rgba(255,255,255,0.15); border-radius: 12px; margin-bottom: 15px;">
                <div style="font-size: 3rem; font-weight: bold;" id="user-points-display">0</div>
                <div style="font-size: 0.8rem; opacity: 0.9;">⭐ Available Points ⭐</div>
                <div style="margin: 10px 0; font-size: 0.75rem;">1 point = KES 1 discount on ad promotions (max 30% off)</div>
            </div>
            
            <div style="font-size: 0.7rem; text-align: center; opacity: 0.8; margin-bottom: 15px;">
                <i class="fas fa-info-circle"></i> Earn 10 points for 5-star reviews, 6 for 4-star, 3 for 3-star, 1 for 2-star
            </div>
            
            <button class="btn" id="view-points-history-btn" style="width: 100%; background: white; color: #27ae60; margin-top: 5px;">
                <i class="fas fa-history"></i> View Points History
            </button>
        </div>
        
    
    <!-- FAQ 1: How to post a service -->
    <div class="faq-item" style="border-bottom: 1px solid var(--grey);">
        <div class="faq-question" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; cursor: pointer;">
            <strong><i class="fas fa-tools" style="color: var(--primary); margin-right: 8px;"></i> How do I post a service?</strong>
            <i class="fas fa-chevron-down faq-icon"></i>
        </div>
        <div class="faq-answer" style="display: none; padding: 0 0 12px 20px; color: var(--grey-dark); font-size: 0.85rem; line-height: 1.6;">
            <p>Follow these simple steps to post your service:</p>
            <ol style="margin: 8px 0 0 20px; padding-left: 0;">
                <li>Tap on the <strong>Services</strong> tab at the bottom of the app</li>
                <li>Click the <strong>"List Your Service"</strong> button</li>
                <li>Fill in your service details (title, description, price, location)</li>
                <li>Add photos of your service (optional but recommended)</li>
                <li>Click <strong>"Submit"</strong> to publish your service</li>
            </ol>
            <p style="margin-top: 8px;">✅ Your service will be visible to all users immediately after posting.</p>
        </div>
    </div>
    
    <!-- FAQ 2: How to promote an ad -->
    <div class="faq-item" style="border-bottom: 1px solid var(--grey);">
        <div class="faq-question" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; cursor: pointer;">
            <strong><i class="fas fa-rocket" style="color: var(--primary); margin-right: 8px;"></i> How do I promote my ad?</strong>
            <i class="fas fa-chevron-down faq-icon"></i>
        </div>
        <div class="faq-answer" style="display: none; padding: 0 0 12px 20px; color: var(--grey-dark); font-size: 0.85rem; line-height: 1.6;">
            <p>Promote your ad to reach more customers:</p>
            <ol style="margin: 8px 0 0 20px; padding-left: 0;">
                <li>Go to your posted ad in <strong>Marketplace</strong> or <strong>Services</strong> tab</li>
                <li>Click the <strong>"Promote"</strong> button on your ad (only visible to you as the owner)</li>
                <li>Choose a promotion package:
                    <ul style="margin: 5px 0 5px 20px;">
                        <li>📌 <strong>Basic Boost</strong> (KES 100) - 3 days visibility</li>
                        <li>⭐ <strong>Premium Reach</strong> (KES 250) - 7 days visibility</li>
                        <li>🔥 <strong>Pro Featured</strong> (KES 500) - 14 days visibility</li>
                        <li>👑 <strong>VIP Spotlight</strong> (KES 1000) - 30 days visibility</li>
                    </ul>
                </li>
                <li>Select your preferred payment method (M-Pesa, Airtel Money, or Card)</li>
                <li>Complete payment to boost your ad visibility</li>
            </ol>
            <p style="margin-top: 8px;">📢 Promoted ads appear at the top of search results and get a special "PROMOTED" badge!</p>
        </div>
    </div>
    
    <!-- FAQ 3: Is payment secure -->
    <div class="faq-item">
        <div class="faq-question" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; cursor: pointer;">
            <strong><i class="fas fa-lock" style="color: var(--primary); margin-right: 8px;"></i> Is my payment secure?</strong>
            <i class="fas fa-chevron-down faq-icon"></i>
        </div>
        <div class="faq-answer" style="display: none; padding: 0 0 12px 20px; color: var(--grey-dark); font-size: 0.85rem; line-height: 1.6;">
            <p>✅ Yes, your payments are completely secure! Here's why:</p>
            <ul style="margin: 8px 0 0 20px; padding-left: 0;">
                <li>🔒 All transactions are encrypted using SSL/TLS technology</li>
                <li>🏦 Payments are processed through <strong>IntaSend</strong>, a PCI-DSS compliant payment gateway</li>
                <li>💳 We never store your card information on our servers</li>
                <li>🛡️ All transactions are monitored for fraudulent activity</li>
                <li>📧 You'll receive a receipt via email after every payment</li>
                <li>🔄 Refund policy available for failed transactions</li>
            </ul>
            <p style="margin-top: 8px;">For any payment issues, contact us at <strong>vikeserve426@gmail.com</strong></p>
        </div>
    </div>
</div>
        
        <div style="background: var(--light); border-radius: 12px; padding: 15px; margin-bottom: 20px;">
            <h4><i class="fas fa-link"></i> Quick Links</h4>
            <div class="support-option" data-action="portfolio" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; cursor: pointer; border-bottom: 1px solid var(--grey);">
                <div><strong>Founder's Portfolio</strong><div style="font-size: 0.8rem; color: #666;">Victor Wanyama - Web Developer</div></div>
                <i class="fas fa-external-link-alt"></i>
            </div>
            <div class="support-option" data-action="terms" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; cursor: pointer; border-bottom: 1px solid var(--grey);">
                <div><strong>Terms & Conditions</strong><div style="font-size: 0.8rem; color: #666;">App usage guidelines</div></div>
                <i class="fas fa-chevron-right"></i>
            </div>
            <div class="support-option" data-action="privacy" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; cursor: pointer;">
                <div><strong>Privacy Policy</strong><div style="font-size: 0.8rem; color: #666;">How we protect your data</div></div>
                <i class="fas fa-chevron-right"></i>
            </div>
        </div>
        
        <div style="background: var(--light); border-radius: 12px; padding: 15px; margin-bottom: 20px;">
            <h4><i class="fas fa-share-alt"></i> Share & Support</h4>
            <div class="support-option" data-action="share" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; cursor: pointer;">
                <div><strong>Share VikeServe</strong><div style="font-size: 0.8rem; color: #666;">Invite friends to the app</div></div>
                <i class="fas fa-chevron-right"></i>
            </div>
        </div>
        
        <div style="text-align: center; margin-top: 20px; padding: 15px; color: #999;">
            <div>VikeServe v1.0.0</div>
            <div>© 2026 VikeServe Ltd. Built with ❤️ by Victor Wanyama</div>
            <div style="font-size: 0.7rem; margin-top: 8px;">
                <a href="https://vike-store.netlify.app/" target="_blank" style="color: var(--primary); text-decoration: none;">Visit our website</a>
            </div>
        </div>
    `;
}
    
    generateStarRatingHTML(rating) {
        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5;
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= fullStars) {
                stars += '<i class="fas fa-star" style="color: #f39c12; font-size: 1.2rem; margin: 0 2px;"></i>';
            } else if (i === fullStars + 1 && halfStar) {
                stars += '<i class="fas fa-star-half-alt" style="color: #f39c12; font-size: 1.2rem; margin: 0 2px;"></i>';
            } else {
                stars += '<i class="far fa-star" style="color: #f39c12; font-size: 1.2rem; margin: 0 2px;"></i>';
            }
        }
        return stars;
    }
    
    setupEventListeners() {
        document.querySelectorAll('.more-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabId = btn.getAttribute('data-more-tab');
                this.switchMoreTab(tabId);
            });
        });
        
        document.querySelectorAll('.more-bottom-nav .nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                let tabId = item.getAttribute('data-tab');
                if (tabId) {
                    tabId = tabId.replace('-tab', '');
                    this.switchMoreTab(tabId);
                }
            });
        });
        
        const closeBtn = document.querySelector('.more-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (window.app && window.app.closeMoreMenu) window.app.closeMoreMenu();
            });
        }
        
        document.getElementById('more-section')?.addEventListener('click', async (e) => {
            if (e.target.closest('.post-teacher-btn')) this.showSubmitModal('teacher');
            if (e.target.closest('.post-internship-btn')) this.showSubmitModal('internship');
            if (e.target.closest('.offer-attachment-btn')) this.showSubmitModal('attachment');
            if (e.target.closest('.post-training-btn')) this.showSubmitModal('training');
            
            if (e.target.closest('.view-founder-profile-btn')) {
                this.showFounderProfile();
                return;
            }
            
            if (e.target.closest('.report-alert-btn')) this.showSubmitModal('alert');
            if (e.target.closest('.new-chat-btn')) this.startNewChat();
            
            if (e.target.closest('.emergency-call-btn')) {
                const number = e.target.closest('.emergency-call-btn').getAttribute('data-number');
                if (number) window.location.href = `tel:${number}`;
            }
            
            if (e.target.closest('.vikeserve-support-btn')) {
                this.showToast('Contact support: vikeserve426@gmail.com', 'info');
                return;
            }
            
            if (e.target.closest('.filter-alert-btn')) {
                const filter = e.target.closest('.filter-alert-btn').getAttribute('data-filter');
                this.filterAlerts(filter);
            }
            
            if (e.target.closest('.rate-founder-btn') && !this.hasRated) {
                this.showRatingModal();
                return;
            }

            if (e.target.closest('#view-points-history-btn')) {
                this.showPointsHistory();
                return;
            }

            if (e.target.closest('.view-points-history-btn') || e.target.closest('#view-points-history-btn')) {
                this.showPointsHistory();
                return;
            }
            
            if (e.target.closest('.faq-question')) {
                const question = e.target.closest('.faq-question');
                const answer = question.nextElementSibling;
                const icon = question.querySelector('.faq-icon');
                
                if (answer.style.display === 'none') {
                    answer.style.display = 'block';
                    icon.classList.remove('fa-chevron-down');
                    icon.classList.add('fa-chevron-up');
                } else {
                    answer.style.display = 'none';
                    icon.classList.remove('fa-chevron-up');
                    icon.classList.add('fa-chevron-down');
                }
                return;
            }
            
            if (e.target.closest('.dark-mode-toggle-settings')) {
                this.toggleDarkMode(e.target.closest('.dark-mode-toggle-settings').checked);
            }
            
            if (e.target.closest('.support-option')) {
                const action = e.target.closest('.support-option').getAttribute('data-action');
                this.handleSettingsAction(action);
            }
            
            if (e.target.closest('.notifications-toggle')) {
                const isChecked = e.target.closest('.notifications-toggle').checked;
                this.showToast(isChecked ? 'Notifications enabled' : 'Notifications disabled', 'info');
            }
            
            if (e.target.closest('.safety-cat-btn')) {
                const cat = e.target.closest('.safety-cat-btn').getAttribute('data-cat');
                this.switchSafetyCategory(cat);
            }
        });
        
        const searchInput = document.getElementById('message-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterConversations(e.target.value);
            });
        }
        
        this.loadTeachers();
        this.loadInternships();
        this.loadAttachments();
        this.loadTraining();
        this.loadAlerts();
        this.loadConversations();
    }
    
    filterConversations(searchTerm) {
        const conversationItems = document.querySelectorAll('#conversations-list-container .conversation-item');
        const term = searchTerm.toLowerCase();
        
        conversationItems.forEach(item => {
            const title = item.querySelector('.conversation-title')?.innerText.toLowerCase() || '';
            const lastMessage = item.querySelector('.conversation-last-message')?.innerText.toLowerCase() || '';
            
            if (title.includes(term) || lastMessage.includes(term)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }
    
    async showSubmitModal(type) {
        if (!this.currentUser) {
            this.showToast('Please sign in to post', 'warning');
            if (typeof window.openAuthModal === 'function') window.openAuthModal();
            return;
        }
        
        let title = '', fields = '', collection = '';
        
        switch(type) {
            case 'teacher':
                title = 'Post Teaching Position';
                fields = `
                    <div class="form-group"><label>School Name *</label><input type="text" id="teacher-school" class="form-input" required></div>
                    <div class="form-group"><label>Subject *</label><input type="text" id="teacher-subject" class="form-input" required></div>
                    <div class="form-group"><label>Level *</label><select id="teacher-level" class="form-input" required><option value="primary">Primary</option><option value="secondary">Secondary</option><option value="college">College/University</option></select></div>
                    <div class="form-group"><label>Description *</label><textarea id="teacher-description" class="form-input" rows="3" required></textarea></div>
                    <div class="form-group"><label>Contact Email *</label><input type="email" id="teacher-email" class="form-input" required></div>
                    <div class="form-group"><label>Contact Phone</label><input type="tel" id="teacher-phone" class="form-input"></div>
                `;
                collection = 'teachers';
                break;
            case 'internship':
                title = 'Post Internship Opportunity';
                fields = `
                    <div class="form-group"><label>Company Name *</label><input type="text" id="internship-company" class="form-input" required></div>
                    <div class="form-group"><label>Position Title *</label><input type="text" id="internship-title" class="form-input" required></div>
                    <div class="form-group"><label>Field *</label><select id="internship-field" class="form-input" required><option value="technology">Technology</option><option value="business">Business</option><option value="marketing">Marketing</option></select></div>
                    <div class="form-group"><label>Description *</label><textarea id="internship-description" class="form-input" rows="3" required></textarea></div>
                    <div class="form-group"><label>Duration (months) *</label><input type="number" id="internship-duration" class="form-input" required></div>
                    <div class="form-group"><label>Contact Email *</label><input type="email" id="internship-email" class="form-input" required></div>
                `;
                collection = 'internships';
                break;
            case 'attachment':
                title = 'Offer Attachment Position';
                fields = `
                    <div class="form-group"><label>Organization Name *</label><input type="text" id="attachment-organization" class="form-input" required></div>
                    <div class="form-group"><label>Position *</label><input type="text" id="attachment-position" class="form-input" required></div>
                    <div class="form-group"><label>Field *</label><input type="text" id="attachment-field" class="form-input" required></div>
                    <div class="form-group"><label>Description *</label><textarea id="attachment-description" class="form-input" rows="3" required></textarea></div>
                    <div class="form-group"><label>Duration (weeks) *</label><input type="number" id="attachment-duration" class="form-input" required></div>
                    <div class="form-group"><label>Contact Email *</label><input type="email" id="attachment-email" class="form-input" required></div>
                `;
                collection = 'attachments';
                break;
            case 'training':
                title = 'Offer Training Program';
                fields = `
                    <div class="form-group"><label>Training Provider *</label><input type="text" id="training-provider" class="form-input" required></div>
                    <div class="form-group"><label>Program Name *</label><input type="text" id="training-name" class="form-input" required></div>
                    <div class="form-group"><label>Category *</label><select id="training-category" class="form-input" required><option value="technical">Technical</option><option value="business">Business</option><option value="creative">Creative</option></select></div>
                    <div class="form-group"><label>Description *</label><textarea id="training-description" class="form-input" rows="3" required></textarea></div>
                    <div class="form-group"><label>Duration *</label><input type="text" id="training-duration" class="form-input" placeholder="e.g., 3 months" required></div>
                    <div class="form-group"><label>Price (KES) *</label><input type="number" id="training-price" class="form-input" required></div>
                    <div class="form-group"><label>Contact Email *</label><input type="email" id="training-email" class="form-input" required></div>
                `;
                collection = 'training_courses';
                break;
            case 'alert':
                title = 'Report Community Alert';
                fields = `
                    <div class="form-group"><label>Alert Type *</label><select id="alert-type" class="form-input" required><option value="info">Info</option><option value="warning">Warning</option><option value="emergency">Emergency</option></select></div>
                    <div class="form-group"><label>Title *</label><input type="text" id="alert-title" class="form-input" required></div>
                    <div class="form-group"><label>Description *</label><textarea id="alert-description" class="form-input" rows="3" required></textarea></div>
                    <div class="form-group"><label>Location *</label><input type="text" id="alert-location" class="form-input" required></div>
                    <div class="form-group"><label>Urgency Level *</label><select id="alert-urgency" class="form-input" required><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
                `;
                collection = 'community_alerts';
                break;
        }
        
        const modalContent = `
            <div class="modal-content" style="max-width: 500px; z-index: 20002;">
                <div class="modal-header">
                    <div class="modal-title">${title}</div>
                    <button class="close-modal-btn">&times;</button>
                </div>
                <div style="padding: 20px;">
                    ${fields}
                    <div class="form-actions" style="display: flex; gap: 10px; margin-top: 20px;">
                        <button class="btn btn-outline close-modal-btn">Cancel</button>
                        <button class="btn btn-primary submit-post-btn" data-type="${type}" data-collection="${collection}">Submit</button>
                    </div>
                </div>
            </div>
        `;
        
        this.showModalWithContent(`${type}-modal`, modalContent);
        
        setTimeout(() => {
            const submitBtn = document.querySelector(`#${type}-modal .submit-post-btn`);
            if (submitBtn) {
                submitBtn.addEventListener('click', () => this.submitPostToFirestore(type, collection));
            }
        }, 100);
    }
    
    async submitPostToFirestore(type, collection) {
        const modal = document.getElementById(`${type}-modal`);
        const inputs = modal.querySelectorAll('input, select, textarea');
        
        let isValid = true;
        inputs.forEach(input => {
            if (input.hasAttribute('required') && !input.value.trim()) {
                isValid = false;
                input.style.borderColor = '#e74c3c';
            } else {
                input.style.borderColor = '';
            }
        });
        
        if (!isValid) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }
        
        const data = {};
        inputs.forEach(input => {
            if (input.id) {
                let fieldName = input.id;
                if (fieldName.startsWith(`${type}-`)) {
                    fieldName = fieldName.substring(type.length + 1);
                }
                data[fieldName] = input.value;
            }
        });
        
        data.userId = this.currentUser.uid;
        data.userName = this.currentUser.displayName || this.currentUser.email;
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        data.status = 'active';
        
        try {
            const collectionRef = this.db.collection(collection);
            await collectionRef.add(data);
            this.showToast(`${type} posted successfully!`, 'success');
            this.closeModal(`${type}-modal`);
            
            setTimeout(() => {
                switch(type) {
                    case 'teacher': this.loadTeachers(); break;
                    case 'internship': this.loadInternships(); break;
                    case 'attachment': this.loadAttachments(); break;
                    case 'training': this.loadTraining(); break;
                    case 'alert': this.loadAlerts(); break;
                }
            }, 500);
        } catch (error) {
            console.error('Error posting:', error);
            this.showToast('Error posting: ' + error.message, 'error');
        }
    }
    
    async loadCollection(collectionName, containerId, typeName) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        try {
            const snapshot = await this.db.collection(collectionName)
                .where('status', '==', 'active')
                .orderBy('createdAt', 'desc')
                .limit(20)
                .get();
            
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            if (items.length === 0) {
                container.innerHTML = `<div class="empty-state">No ${typeName}s available yet.</div>`;
                return;
            }
            
            container.innerHTML = items.map(item => {
                const posterName = item.userName || item.name || item.company || item.school || item.organization || item.provider || 'Anonymous';
                const posterInitial = posterName.charAt(0).toUpperCase();
                const posterEmail = item.email || item.contactEmail || '';
                const posterPhone = item.phone || item.contactPhone || '';
                
                return `
                    <div class="list-item" style="background: var(--light); border-radius: 10px; padding: 12px; margin-bottom: 10px;">
                        <div class="poster-info" style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                            <div class="poster-avatar" style="width: 40px; height: 40px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 1.2rem;">
                                ${this.escapeHtml(posterInitial)}
                            </div>
                            <div class="poster-details">
                                <div class="poster-name" style="font-weight: 600; font-size: 0.9rem;">${this.escapeHtml(posterName)}</div>
                                ${posterEmail ? `<div class="poster-email" style="font-size: 0.7rem; color: var(--grey-dark);"><i class="fas fa-envelope"></i> ${this.escapeHtml(posterEmail)}</div>` : ''}
                                ${posterPhone ? `<div class="poster-phone" style="font-size: 0.7rem; color: var(--grey-dark);"><i class="fas fa-phone"></i> ${this.escapeHtml(posterPhone)}</div>` : ''}
                            </div>
                        </div>
                        
                        <div class="list-item-title" style="font-weight: 600; font-size: 1rem; margin-bottom: 8px;">
                            ${this.escapeHtml(item.title || item.name || item.company || item.school || item.position || 'Untitled')}
                        </div>
                        
                        <div class="list-item-subtitle" style="font-size: 0.8rem; color: #666; margin-bottom: 5px;">
                            ${this.escapeHtml(item.company || item.organization || item.provider || item.school || '')}
                        </div>
                        
                        <div class="list-item-description" style="font-size: 0.75rem; color: #666; margin-top: 5px;">
                            ${this.escapeHtml((item.description || '').substring(0, 100))}${(item.description || '').length > 100 ? '...' : ''}
                        </div>
                        
                        <div class="list-item-meta" style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; font-size: 0.7rem; color: var(--grey-dark);">
                            ${item.duration ? `<span><i class="fas fa-clock"></i> ${this.escapeHtml(item.duration)}</span>` : ''}
                            ${item.price ? `<span><i class="fas fa-money-bill-wave"></i> KES ${item.price}</span>` : ''}
                            ${item.location ? `<span><i class="fas fa-map-marker-alt"></i> ${this.escapeHtml(item.location)}</span>` : ''}
                        </div>
                        
                        <div class="list-item-date" style="font-size: 0.7rem; color: #999; margin-top: 5px;">
                            Posted: ${this.formatDate(item.createdAt)}
                        </div>
                        
                        <button class="btn btn-primary contact-poster-btn" 
                            data-poster-id="${item.userId || ''}" 
                            data-poster-name="${this.escapeHtml(posterName)}" 
                            data-poster-email="${this.escapeHtml(posterEmail)}" 
                            data-poster-phone="${this.escapeHtml(posterPhone)}" 
                            data-item-title="${this.escapeHtml(item.title || item.name || item.company || '')}" 
                            style="margin-top: 12px; width: 100%;">
                            <i class="fas fa-comment"></i> Contact Poster
                        </button>
                    </div>
                `;
            }).join('');
            
            document.querySelectorAll(`#${containerId} .contact-poster-btn`).forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const posterId = btn.getAttribute('data-poster-id');
                    const posterName = btn.getAttribute('data-poster-name');
                    const posterEmail = btn.getAttribute('data-poster-email');
                    const posterPhone = btn.getAttribute('data-poster-phone');
                    const itemTitle = btn.getAttribute('data-item-title');
                    this.showContactPosterOptions(posterId, posterName, posterEmail, posterPhone, itemTitle);
                });
            });
            
        } catch (error) {
            console.error(`Error loading ${collectionName}:`, error);
            container.innerHTML = `<div class="error-state">Error loading ${typeName}s</div>`;
        }
    }
    
    showContactPosterOptions(posterId, posterName, posterEmail, posterPhone, itemTitle) {
        if (!this.currentUser) {
            this.showToast('Please sign in to contact poster', 'warning');
            if (typeof window.openAuthModal === 'function') window.openAuthModal();
            return;
        }
        
        const modalContent = `
            <div class="modal-content" style="max-width: 400px; z-index: 20002;">
                <div class="modal-header">
                    <div class="modal-title">Contact ${this.escapeHtml(posterName)}</div>
                    <button class="close-modal-btn">&times;</button>
                </div>
                <div style="padding: 20px;">
                    <div style="background: var(--light); padding: 12px; border-radius: 10px; margin-bottom: 15px;">
                        <div style="font-weight: 600;">Regarding: ${this.escapeHtml(itemTitle)}</div>
                    </div>
                    
                    <div class="contact-options" style="display: flex; flex-direction: column; gap: 10px;">
                        ${posterPhone ? `
                            <button class="contact-option-call btn btn-primary" data-phone="${this.escapeHtml(posterPhone)}" style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                                <i class="fas fa-phone"></i> Call ${this.escapeHtml(posterPhone)}
                            </button>
                        ` : ''}
                        
                        ${posterEmail ? `
                            <button class="contact-option-email btn btn-outline" data-email="${this.escapeHtml(posterEmail)}" style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                                <i class="fas fa-envelope"></i> Send Email
                            </button>
                        ` : ''}
                        
                        ${posterId ? `
                            <button class="contact-option-chat btn btn-outline" data-user-id="${posterId}" style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                                <i class="fas fa-comments"></i> Send Message (In-App)
                            </button>
                        ` : ''}
                    </div>
                    
                    <div class="form-actions" style="margin-top: 20px;">
                        <button class="btn btn-outline close-modal-btn" style="width: 100%;">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        this.showModalWithContent('contact-poster-modal', modalContent);
        
        setTimeout(() => {
            const callBtn = document.querySelector('#contact-poster-modal .contact-option-call');
            if (callBtn) {
                callBtn.addEventListener('click', () => {
                    const phone = callBtn.getAttribute('data-phone');
                    if (phone) window.location.href = `tel:${phone}`;
                    this.closeModal('contact-poster-modal');
                });
            }
            
            const emailBtn = document.querySelector('#contact-poster-modal .contact-option-email');
            if (emailBtn) {
                emailBtn.addEventListener('click', () => {
                    const email = emailBtn.getAttribute('data-email');
                    if (email) window.location.href = `mailto:${email}`;
                    this.closeModal('contact-poster-modal');
                });
            }
            
            const chatBtn = document.querySelector('#contact-poster-modal .contact-option-chat');
            if (chatBtn) {
                chatBtn.addEventListener('click', () => {
                    const userId = chatBtn.getAttribute('data-user-id');
                    const initialMessage = `Hi, I'm interested in your post: ${itemTitle}`;
                    this.startChatWithUser(userId, initialMessage);
                    this.closeModal('contact-poster-modal');
                });
            }
        }, 100);
    }
    
    async loadTeachers() { await this.loadCollection('teachers', 'teachers-list-container', 'teacher'); }
    async loadInternships() { await this.loadCollection('internships', 'internships-list-container', 'internship'); }
    async loadAttachments() { await this.loadCollection('attachments', 'attachments-list-container', 'attachment'); }
    async loadTraining() { await this.loadCollection('training_courses', 'training-list-container', 'training'); }
    
    async loadAlerts() {
        const container = document.getElementById('alerts-list-container');
        if (!container) return;
        
        try {
            const snapshot = await this.db.collection('community_alerts')
                .orderBy('createdAt', 'desc')
                .limit(30)
                .get();
            
            const alerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            if (alerts.length === 0) {
                container.innerHTML = '<div class="empty-state">No alerts reported yet.</div>';
                return;
            }
            
            container.innerHTML = alerts.map(alert => {
                // Get alert poster info
                const posterName = alert.userName || 'Anonymous User';
                const posterInitial = posterName.charAt(0).toUpperCase();
                const isOwnAlert = this.currentUser && alert.userId === this.currentUser.uid;
                
                return `
                    <div class="alert-card" data-alert-id="${alert.id}" data-type="${alert.type || 'info'}" style="background: white; border-radius: 12px; padding: 15px; margin-bottom: 15px; border-left: 4px solid ${alert.type === 'emergency' ? '#e74c3c' : '#f39c12'};">
                        <!-- Alert Poster Info -->
                        <div class="alert-poster-info" style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                            <div class="poster-avatar" style="width: 40px; height: 40px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 1.2rem;">
                                ${this.escapeHtml(posterInitial)}
                            </div>
                            <div class="poster-details">
                                <div class="poster-name" style="font-weight: 600; font-size: 0.9rem;">${this.escapeHtml(posterName)}</div>
                                <div class="poster-time" style="font-size: 0.7rem; color: var(--grey-dark);">
                                    <i class="fas fa-clock"></i> ${this.formatDate(alert.createdAt)}
                                </div>
                            </div>
                            ${alert.type === 'emergency' ? '<span style="margin-left: auto; background: #e74c3c; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.6rem;">EMERGENCY</span>' : ''}
                        </div>
                        
                        <div class="alert-title" style="font-weight: 600; font-size: 1rem; margin-bottom: 8px;">
                            <i class="fas ${alert.type === 'emergency' ? 'fa-skull-crossbones' : alert.type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
                            ${this.escapeHtml(alert.title)}
                        </div>
                        
                        <div class="alert-content" style="font-size: 0.85rem; margin: 8px 0; color: var(--dark);">
                            ${this.escapeHtml(alert.description)}
                        </div>
                        
                        <div class="alert-location" style="font-size: 0.75rem; margin-bottom: 12px;">
                            <i class="fas fa-map-marker-alt"></i> ${this.escapeHtml(alert.location || 'Unknown location')}
                        </div>
                        
                        <div class="alert-actions" style="display: flex; gap: 8px; flex-wrap: wrap;">
                            ${this.currentUser && !isOwnAlert ? `
                                <button class="btn btn-sm btn-primary reply-to-alert-btn" data-reporter-id="${alert.userId}" data-alert-title="${this.escapeHtml(alert.title)}" data-alert-id="${alert.id}" style="flex: 1; padding: 8px;">
                                    <i class="fas fa-reply"></i> Reply
                                </button>
                                <button class="btn btn-sm btn-outline report-alert-btn" data-alert-id="${alert.id}" data-alert-title="${this.escapeHtml(alert.title)}" style="flex: 1; padding: 8px;">
                                    <i class="fas fa-flag"></i> Report
                                </button>
                            ` : ''}
                            ${!this.currentUser ? `
                                <button class="btn btn-sm btn-primary signin-to-reply-btn" style="flex: 1; padding: 8px;">
                                    <i class="fas fa-sign-in-alt"></i> Sign in to Reply
                                </button>
                            ` : ''}
                            ${isOwnAlert ? `
                                <button class="btn btn-sm btn-outline delete-alert-btn" data-alert-id="${alert.id}" style="flex: 1; padding: 8px;">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            }).join('');
            
            // Add event listeners for Reply buttons
            document.querySelectorAll('.reply-to-alert-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const reporterId = btn.getAttribute('data-reporter-id');
                    const alertTitle = btn.getAttribute('data-alert-title');
                    const alertId = btn.getAttribute('data-alert-id');
                    this.replyToAlert(reporterId, alertTitle, alertId);
                });
            });
            
            // Add event listeners for Report buttons
            document.querySelectorAll('.report-alert-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const alertId = btn.getAttribute('data-alert-id');
                    const alertTitle = btn.getAttribute('data-alert-title');
                    this.reportAlertToAdmin(alertId, alertTitle);
                });
            });
            
            // Add event listeners for Delete buttons
            document.querySelectorAll('.delete-alert-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const alertId = btn.getAttribute('data-alert-id');
                    if (confirm('Are you sure you want to delete this alert?')) {
                        await this.db.collection('community_alerts').doc(alertId).delete();
                        this.showToast('Alert deleted', 'success');
                        this.loadAlerts();
                    }
                });
            });
            
            // Sign in button
            document.querySelectorAll('.signin-to-reply-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (typeof window.openAuthModal === 'function') window.openAuthModal();
                });
            });
            
        } catch (error) {
            console.error('Error loading alerts:', error);
            container.innerHTML = '<div class="error-state">Error loading alerts</div>';
        }
    }
    
    async replyToAlert(reporterId, alertTitle, alertId) {
        if (!this.currentUser) {
            this.showToast('Please sign in to reply', 'warning');
            if (typeof window.openAuthModal === 'function') window.openAuthModal();
            return;
        }
        
        const replyMessage = `Regarding your alert: "${alertTitle}"\n\n`;
        
        // Pre-fill the chat message with the alert reference
        const modalContent = `
            <div class="modal-content" style="max-width: 400px; z-index: 20002;">
                <div class="modal-header">
                    <div class="modal-title">Reply to Alert</div>
                    <button class="close-modal-btn">&times;</button>
                </div>
                <div style="padding: 20px;">
                    <div style="background: var(--light); padding: 12px; border-radius: 10px; margin-bottom: 15px;">
                        <div style="font-weight: 600;">Alert: ${this.escapeHtml(alertTitle)}</div>
                        <div style="font-size: 0.8rem; color: var(--grey-dark);">Your reply will be sent as a direct message.</div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Your Message</label>
                        <textarea id="reply-message" class="form-input" rows="4" placeholder="Type your reply here...">${this.escapeHtml(replyMessage)}</textarea>
                    </div>
                    
                    <div class="form-actions" style="display: flex; gap: 10px; margin-top: 20px;">
                        <button class="btn btn-outline close-modal-btn">Cancel</button>
                        <button class="btn btn-primary" id="send-reply-btn">Send Reply</button>
                    </div>
                </div>
            </div>
        `;
        
        this.showModalWithContent('reply-modal', modalContent);
        
        setTimeout(() => {
            const sendBtn = document.getElementById('send-reply-btn');
            if (sendBtn) {
                sendBtn.addEventListener('click', async () => {
                    const message = document.getElementById('reply-message')?.value;
                    if (!message) {
                        this.showToast('Please enter a message', 'error');
                        return;
                    }
                    
                    await this.startChatWithUser(reporterId, message);
                    this.closeModal('reply-modal');
                    this.showToast('Reply sent!', 'success');
                });
            }
        }, 100);
    }
    
    async reportAlertToAdmin(alertId, alertTitle) {
        if (!this.currentUser) {
            this.showToast('Please sign in to report', 'warning');
            if (typeof window.openAuthModal === 'function') window.openAuthModal();
            return;
        }
        
        const modalContent = `
            <div class="modal-content" style="max-width: 400px; z-index: 20002;">
                <div class="modal-header">
                    <div class="modal-title">Report Alert</div>
                    <button class="close-modal-btn">&times;</button>
                </div>
                <div style="padding: 20px;">
                    <div style="background: var(--light); padding: 12px; border-radius: 10px; margin-bottom: 15px;">
                        <div style="font-weight: 600;">Alert: ${this.escapeHtml(alertTitle)}</div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Reason for Report *</label>
                        <select id="report-reason" class="form-input" required>
                            <option value="">Select reason</option>
                            <option value="spam">Spam or misleading</option>
                            <option value="false_info">False information</option>
                            <option value="harassment">Harassment or abuse</option>
                            <option value="dangerous">Dangerous content</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Additional Details</label>
                        <textarea id="report-details" class="form-input" rows="3" placeholder="Provide more information..."></textarea>
                    </div>
                    
                    <div class="form-actions" style="display: flex; gap: 10px; margin-top: 20px;">
                        <button class="btn btn-outline close-modal-btn">Cancel</button>
                        <button class="btn btn-danger" id="submit-report-btn">Submit Report</button>
                    </div>
                </div>
            </div>
        `;
        
        this.showModalWithContent('report-modal', modalContent);
        
        setTimeout(() => {
            const submitBtn = document.getElementById('submit-report-btn');
            if (submitBtn) {
                submitBtn.addEventListener('click', async () => {
                    const reason = document.getElementById('report-reason')?.value;
                    const details = document.getElementById('report-details')?.value;
                    
                    if (!reason) {
                        this.showToast('Please select a reason', 'error');
                        return;
                    }
                    
                    // Send report to admin/founder
                    const founderDoc = await this.db.collection('system_settings').doc('founder').get();
                    const founderEmail = founderDoc.exists ? founderDoc.data().email : 'vikeserve426@gmail.com';
                    
                    // Save report to Firestore
                    await this.db.collection('alert_reports').add({
                        alertId: alertId,
                        alertTitle: alertTitle,
                        reporterId: this.currentUser.uid,
                        reporterName: this.currentUser.displayName || this.currentUser.email,
                        reason: reason,
                        details: details,
                        reportedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        status: 'pending'
                    });
                    
                    // Also send email notification (via console log for now)
                    console.log('Alert reported:', { alertTitle, reason, details, reporter: this.currentUser.email });
                    
                    this.showToast('Report submitted to admin. Thank you!', 'success');
                    this.closeModal('report-modal');
                });
            }
        }, 100);
    }
    
// ========== COMPLETE CHAT IMPLEMENTATION ==========

async loadConversations() {
    const container = document.getElementById('conversations-list-container');
    if (!container) return;
    
    if (!this.currentUser) {
        container.innerHTML = '<div class="empty-state">Sign in to view your messages</div>';
        return;
    }
    
    try {
        const snapshot = await this.db.collection('chats')
            .where('participants', 'array-contains', this.currentUser.uid)
            .orderBy('lastMessageAt', 'desc')
            .limit(50)
            .get();
        
        const conversations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (conversations.length === 0) {
            container.innerHTML = '<div class="empty-state">No messages yet. Start a conversation!</div>';
            return;
        }
        
        const unreadCounts = {};
        for (const conv of conversations) {
            const unreadSnapshot = await this.db.collection('chats').doc(conv.id).collection('messages')
                .where('senderId', '!=', this.currentUser.uid)
                .where('read', '==', false)
                .get();
            unreadCounts[conv.id] = unreadSnapshot.size;
        }
        
        container.innerHTML = conversations.map(conv => {
            const otherParticipantId = conv.participants.find(p => p !== this.currentUser.uid);
            const otherParticipant = conv.otherUserName || 'User';
            const unreadCount = unreadCounts[conv.id] || 0;
            const hasUnread = unreadCount > 0;
            const lastMessage = conv.lastMessage || 'No messages';
            const lastMessagePreview = lastMessage.length > 40 ? lastMessage.substring(0, 40) + '...' : lastMessage;
            
            return `
                <div class="conversation-item" data-chat-id="${conv.id}" style="display: flex; align-items: center; gap: 12px; padding: 12px; border-bottom: 1px solid var(--grey); cursor: pointer; ${hasUnread ? 'background: rgba(46, 134, 222, 0.1);' : ''}">
                    <div class="conversation-avatar" style="width: 50px; height: 50px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.2rem; font-weight: bold;">
                        ${otherParticipant.charAt(0).toUpperCase()}
                    </div>
                    <div style="flex: 1;">
                        <div class="conversation-title" style="font-weight: 600;">${this.escapeHtml(otherParticipant)}</div>
                        <div class="conversation-last-message" style="font-size: 0.8rem; color: var(--grey-dark);">${this.escapeHtml(lastMessagePreview)}</div>
                    </div>
                    <div style="text-align: right;">
                        <div class="conversation-time" style="font-size: 0.7rem; color: var(--grey-dark);">${this.formatDate(conv.lastMessageAt)}</div>
                        ${hasUnread ? `<div class="unread-badge" style="background: var(--primary); color: white; border-radius: 50%; min-width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.6rem; margin-top: 5px; padding: 0 4px;">${unreadCount}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.addEventListener('click', () => {
                this.openChat(item.getAttribute('data-chat-id'));
            });
        });
        
    } catch (error) {
        console.error('Error loading conversations:', error);
        container.innerHTML = '<div class="error-state">Error loading messages</div>';
    }
}

async openChat(chatId) {
    await this.loadChat(chatId);
}

async loadChat(chatId) {
    try {
        const chatDoc = await this.db.collection('chats').doc(chatId).get();
        if (!chatDoc.exists) {
            this.showToast('Chat not found', 'error');
            return;
        }
        
        const chatData = chatDoc.data();
        const otherParticipantId = chatData.participants.find(p => p !== this.currentUser?.uid);
        
        let otherParticipant = null;
        if (otherParticipantId) {
            const userDoc = await this.db.collection('users').doc(otherParticipantId).get();
            if (userDoc.exists) {
                otherParticipant = userDoc.data();
            } else {
                otherParticipant = { displayName: 'User', email: 'user@example.com' };
            }
        }
        
        this.showChatWindow(chatId, chatData, otherParticipant);
        await this.markMessagesAsRead(chatId);
        this.setupChatListener(chatId);
        
    } catch (error) {
        console.error('Error loading chat:', error);
        this.showToast('Error loading chat', 'error');
    }
}

showChatWindow(chatId, chatData, otherParticipant) {
    const existingContainer = document.getElementById('chat-window-container');
    if (existingContainer) {
        existingContainer.remove();
    }
    
    const otherName = otherParticipant?.displayName || otherParticipant?.email || 'User';
    const otherAvatar = otherName.charAt(0).toUpperCase();
    
    const messagesContent = document.getElementById('messages-content');
    if (messagesContent) {
        messagesContent.innerHTML = '';
        messagesContent.style.overflow = 'hidden';
        messagesContent.style.display = 'flex';
        messagesContent.style.flexDirection = 'column';
        messagesContent.style.height = '100%';
        
        messagesContent.innerHTML = `
            <div id="chat-window-container" style="display: flex; flex-direction: column; height: 100%; background: white; border-radius: 12px; overflow: hidden;">
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 15px; background: var(--primary); color: white; flex-shrink: 0;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 40px; height: 40px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold;">${this.escapeHtml(otherAvatar)}</div>
                        <div>
                            <h3 style="margin: 0; font-size: 1rem;">${this.escapeHtml(otherName)}</h3>
                            <p id="chat-typing-status" style="font-size: 0.7rem; opacity: 0.8; margin: 0;"></p>
                        </div>
                    </div>
                    <button id="chat-back-btn" style="background: none; border: none; color: white; font-size: 1rem; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                        <i class="fas fa-arrow-left"></i> Back
                    </button>
                </div>
                
                <div id="chat-messages-area" style="flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 10px; background: var(--light); min-height: 0;">
                    <div class="loading-spinner">Loading messages...</div>
                </div>
                
                <div style="display: flex; align-items: center; gap: 10px; padding: 12px 15px; background: white; border-top: 1px solid var(--grey); flex-shrink: 0;">
                    <button id="chat-attach-btn" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--grey-dark); padding: 8px;">
                        <i class="fas fa-paperclip"></i>
                    </button>
                    <textarea id="chat-message-input" placeholder="Type a message..." rows="1" style="flex: 1; border: 1px solid var(--grey); border-radius: 20px; padding: 10px 15px; resize: none; font-family: inherit; font-size: 0.9rem; background: var(--light); color: var(--dark);"></textarea>
                    <button id="chat-send-btn" style="background: var(--primary); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; cursor: pointer;">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        `;
    }
    
    setTimeout(() => {
        const input = document.getElementById('chat-message-input');
        const sendBtn = document.getElementById('chat-send-btn');
        const attachBtn = document.getElementById('chat-attach-btn');
        const backBtn = document.getElementById('chat-back-btn');
        
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendChatMessage(chatId);
                }
            });
            
            input.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.min(this.scrollHeight, 100) + 'px';
            });
            
            let typingTimeout;
            input.addEventListener('input', () => {
                this.sendTypingIndicator(chatId, true);
                clearTimeout(typingTimeout);
                typingTimeout = setTimeout(() => {
                    this.sendTypingIndicator(chatId, false);
                }, 1000);
            });
        }
        
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendChatMessage(chatId));
        }
        
        if (attachBtn) {
            attachBtn.addEventListener('click', () => this.uploadChatAttachment(chatId));
        }
        
        if (backBtn) {
            backBtn.addEventListener('click', () => this.closeChatWindow());
        }
    }, 100);
    
    this.loadChatMessages(chatId);
}

closeChatWindow() {
    // Clean up listeners first
    if (this.currentChatUnsubscribe) {
        this.currentChatUnsubscribe();
        this.currentChatUnsubscribe = null;
    }
    if (this.typingUnsubscribe) {
        this.typingUnsubscribe();
        this.typingUnsubscribe = null;
    }
    this.firstMessageDoc = null;
    
    // Remove the chat window container
    const chatContainer = document.getElementById('chat-window-container');
    if (chatContainer) {
        chatContainer.remove();
    }
    
    // Reset messages content - remove all inline styles and restore original HTML
    const messagesContent = document.getElementById('messages-content');
    if (messagesContent) {
        // Remove all inline styles
        messagesContent.removeAttribute('style');
        // Restore original HTML
        messagesContent.innerHTML = this.getMessagesHTML();
        
        // Reload conversations
        this.loadConversations();
        
        // Re-attach event listeners
        setTimeout(() => {
            const searchInput = document.getElementById('message-search-input');
            if (searchInput) {
                const newSearchInput = searchInput.cloneNode(true);
                searchInput.parentNode.replaceChild(newSearchInput, searchInput);
                newSearchInput.addEventListener('input', (e) => {
                    this.filterConversations(e.target.value);
                });
            }
            
            const newChatBtn = document.querySelector('#messages-content .new-chat-btn');
            if (newChatBtn) {
                const newBtn = newChatBtn.cloneNode(true);
                newChatBtn.parentNode.replaceChild(newBtn, newChatBtn);
                newBtn.addEventListener('click', () => this.startNewChat());
            }
        }, 100);
    }
    
    // Clean up listeners
    if (this.currentChatUnsubscribe) {
        this.currentChatUnsubscribe();
        this.currentChatUnsubscribe = null;
    }
    if (this.typingUnsubscribe) {
        this.typingUnsubscribe();
        this.typingUnsubscribe = null;
    }
    this.firstMessageDoc = null;
}

async loadChatMessages(chatId, loadMore = false) {
    const messagesContainer = document.getElementById('chat-messages-area');
    if (!messagesContainer) return;
    
    try {
        let query = this.db.collection('chats').doc(chatId).collection('messages')
            .orderBy('timestamp', 'asc');
        
        if (loadMore && this.firstMessageDoc) {
            query = query.endBefore(this.firstMessageDoc);
        }
        
        const snapshot = await query.get();
        
        if (snapshot.empty && !loadMore) {
            messagesContainer.innerHTML = `
                <div class="empty-chat" style="text-align: center; padding: 40px; color: var(--grey-dark);">
                    <i class="fas fa-comments" style="font-size: 3rem; margin-bottom: 15px;"></i>
                    <p>No messages yet. Start the conversation!</p>
                    <p style="font-size: 0.8rem;">You can send text, images, PDFs, and other files.</p>
                </div>
            `;
            return;
        }
        
        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (snapshot.docs.length > 0 && !loadMore) {
            this.firstMessageDoc = snapshot.docs[0];
        }
        
        if (!loadMore) {
            messagesContainer.innerHTML = '';
        } else {
            const oldScrollHeight = messagesContainer.scrollHeight;
            const oldScrollTop = messagesContainer.scrollTop;
            
            messages.forEach(msg => {
                const msgElement = this.createMessageElement(msg);
                messagesContainer.insertBefore(msgElement, messagesContainer.firstChild);
            });
            
            const newScrollHeight = messagesContainer.scrollHeight;
            messagesContainer.scrollTop = newScrollHeight - oldScrollHeight + oldScrollTop;
            return;
        }
        
        messages.forEach(msg => {
            messagesContainer.appendChild(this.createMessageElement(msg));
        });
        
        this.scrollToBottom(messagesContainer);
        
        if (snapshot.docs.length >= 50) {
            let loadMoreBtn = document.getElementById('chat-load-more-btn');
            if (!loadMoreBtn) {
                loadMoreBtn = document.createElement('button');
                loadMoreBtn.id = 'chat-load-more-btn';
                loadMoreBtn.className = 'btn btn-sm btn-outline';
                loadMoreBtn.style.margin = '10px auto';
                loadMoreBtn.style.display = 'block';
                loadMoreBtn.innerHTML = '<i class="fas fa-arrow-up"></i> Load Older Messages';
                loadMoreBtn.addEventListener('click', () => this.loadChatMessages(chatId, true));
                messagesContainer.insertBefore(loadMoreBtn, messagesContainer.firstChild);
            }
        } else {
            const loadMoreBtn = document.getElementById('chat-load-more-btn');
            if (loadMoreBtn) loadMoreBtn.remove();
        }
        
    } catch (error) {
        console.error('Error loading messages:', error);
        messagesContainer.innerHTML = '<div class="error-state" style="text-align: center; padding: 20px; color: var(--danger);">Error loading messages. Please try again.</div>';
    }
}

createMessageElement(message) {
    const isCurrentUser = message.senderId === this.currentUser?.uid;
    
    const div = document.createElement('div');
    div.style.cssText = `display: flex; flex-direction: column; margin-bottom: 12px; ${isCurrentUser ? 'align-items: flex-end;' : 'align-items: flex-start;'}`;
    
    let attachmentsHtml = '';
    if (message.attachments && message.attachments.length > 0) {
        attachmentsHtml = '<div style="margin-bottom: 8px;">';
        for (const att of message.attachments) {
            const isImage = att.type && att.type.startsWith('image/');
            const fileSize = this.formatFileSize(att.size);
            
            if (isImage) {
                attachmentsHtml += `
                    <div onclick="window.open('${att.url}', '_blank')" style="margin: 5px 0; cursor: pointer; display: inline-block;">
                        <img src="${att.url}" alt="${this.escapeHtml(att.name)}" style="max-width: 200px; max-height: 150px; border-radius: 12px; object-fit: cover;">
                        <div style="font-size: 0.7rem; text-align: center; margin-top: 4px;">${this.escapeHtml(att.name)}</div>
                    </div>
                `;
            } else {
                attachmentsHtml += `
                    <div onclick="window.open('${att.url}', '_blank')" style="display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: rgba(0,0,0,0.08); border-radius: 10px; margin: 5px 0; cursor: pointer;">
                        <div style="font-size: 1.5rem;"><i class="fas fa-file-${this.getFileIcon(att.name)}"></i></div>
                        <div style="flex: 1; overflow: hidden;">
                            <div style="font-size: 0.8rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(att.name)}</div>
                            <div style="font-size: 0.65rem; opacity: 0.7;">${fileSize}</div>
                        </div>
                        <div><i class="fas fa-download"></i></div>
                    </div>
                `;
            }
        }
        attachmentsHtml += '</div>';
    }
    
    const messageText = message.text ? `<div style="word-wrap: break-word;">${this.escapeHtml(message.text)}</div>` : '';
    const messageTime = this.formatChatTime(message.timestamp);
    const statusIcon = isCurrentUser ? 
        `<span style="margin-left: 5px;"><i class="fas ${message.read ? 'fa-check-double' : 'fa-check'}" style="${message.read ? 'color: #4CAF50;' : 'color: #999;'}"></i></span>` : '';
    
    div.innerHTML = `
        <div style="max-width: 80%; padding: 10px 14px; border-radius: 18px; background: ${isCurrentUser ? 'var(--primary)' : 'white'}; color: ${isCurrentUser ? 'white' : 'var(--dark)'}; box-shadow: 0 1px 2px rgba(0,0,0,0.1); ${isCurrentUser ? 'border-bottom-right-radius: 4px;' : 'border-bottom-left-radius: 4px;'}">
            ${attachmentsHtml}
            ${messageText}
            <div style="display: flex; justify-content: flex-end; align-items: center; gap: 5px; margin-top: 5px;">
                <span style="font-size: 0.65rem; opacity: 0.7;">${messageTime}</span>
                ${statusIcon}
            </div>
        </div>
    `;
    
    return div;
}

getFileIcon(filename) {
    const extension = filename.split('.').pop()?.toLowerCase();
    const iconMap = {
        'pdf': 'pdf', 'doc': 'word', 'docx': 'word',
        'xls': 'excel', 'xlsx': 'excel',
        'ppt': 'powerpoint', 'pptx': 'powerpoint',
        'txt': 'alt', 'zip': 'archive', 'rar': 'archive',
        'mp3': 'audio', 'mp4': 'video',
        'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image'
    };
    return iconMap[extension] || 'paperclip';
}

formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

scrollToBottom(container) {
    if (!container) return;
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 100);
}

async sendChatMessage(chatId) {
    const input = document.getElementById('chat-message-input');
    const message = input?.value.trim();
    
    if (!message) return;
    
    const sendBtn = document.getElementById('chat-send-btn');
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<div class="spinner" style="width: 16px; height: 16px;"></div>';
    }
    
    try {
        const messageData = {
            senderId: this.currentUser.uid,
            senderName: this.currentUser.displayName || this.currentUser.email,
            text: message,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            read: false
        };
        
        await this.db.collection('chats').doc(chatId).collection('messages').add(messageData);
        
        await this.db.collection('chats').doc(chatId).update({
            lastMessage: message,
            lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastMessageBy: this.currentUser.uid
        });
        
        input.value = '';
        input.style.height = 'auto';
        
    } catch (error) {
        console.error('Error sending message:', error);
        this.showToast('Error sending message', 'error');
    } finally {
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
        }
    }
}

async uploadChatAttachment(chatId) {
    if (!this.currentUser) {
        this.showToast('Please sign in to upload files', 'warning');
        return;
    }
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf,.doc,.docx,.txt,.xls,.xlsx';
    input.multiple = true;
    
    input.onchange = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        
        this.showToast(`Uploading ${files.length} file(s)...`, 'info');
        
        const attachments = [];
        let successCount = 0;
        
        for (const file of files) {
            try {
                if (file.size > 10 * 1024 * 1024) {
                    this.showToast(`${file.name} is too large (max 10MB)`, 'error');
                    continue;
                }
                
                const fileExtension = file.name.split('.').pop();
                const filename = `chat_attachments/${chatId}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExtension}`;
                const storageRef = firebase.storage().ref(filename);
                
                await storageRef.put(file);
                const downloadURL = await storageRef.getDownloadURL();
                
                attachments.push({
                    name: file.name,
                    url: downloadURL,
                    type: file.type,
                    size: file.size,
                    fileType: file.type.startsWith('image/') ? 'image' : 'file'
                });
                successCount++;
            } catch (error) {
                console.error('Error uploading attachment:', error);
                this.showToast(`Failed to upload ${file.name}`, 'error');
            }
        }
        
        if (attachments.length > 0) {
            const messageData = {
                senderId: this.currentUser.uid,
                senderName: this.currentUser.displayName || this.currentUser.email,
                attachments: attachments,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                read: false
            };
            
            await this.db.collection('chats').doc(chatId).collection('messages').add(messageData);
            
            const attachmentText = attachments.length === 1 ? `📎 ${attachments[0].name}` : `📎 ${attachments.length} attachments`;
            
            await this.db.collection('chats').doc(chatId).update({
                lastMessage: attachmentText,
                lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessageBy: this.currentUser.uid
            });
            
            this.showToast(`${successCount} file(s) uploaded successfully!`, 'success');
            this.loadChatMessages(chatId);
        }
    };
    
    input.click();
}

setupChatListener(chatId) {
    if (this.currentChatUnsubscribe) {
        this.currentChatUnsubscribe();
        this.currentChatUnsubscribe = null;
    }
    
    this.currentChatUnsubscribe = this.db.collection('chats').doc(chatId).collection('messages')
        .orderBy('timestamp', 'asc')
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const message = { id: change.doc.id, ...change.doc.data() };
                    this.appendNewMessage(message);
                    
                    if (message.senderId !== this.currentUser?.uid && !message.read) {
                        this.markMessageAsRead(chatId, change.doc.id);
                    }
                }
            });
        }, (error) => {
            console.error('Chat listener error:', error);
        });
    
    const typingRef = this.db.collection('chats').doc(chatId).collection('typing').doc('status');
    if (this.typingUnsubscribe) {
        this.typingUnsubscribe();
    }
    this.typingUnsubscribe = typingRef.onSnapshot((doc) => {
        const typingStatus = document.getElementById('chat-typing-status');
        if (typingStatus && doc.exists && doc.data().isTyping && doc.data().userId !== this.currentUser?.uid) {
            typingStatus.textContent = 'typing...';
            typingStatus.style.opacity = '0.7';
            setTimeout(() => {
                if (typingStatus.textContent === 'typing...') {
                    typingStatus.textContent = '';
                }
            }, 1500);
        } else if (typingStatus) {
            typingStatus.textContent = '';
        }
    });
}

async sendTypingIndicator(chatId, isTyping) {
    if (!this.currentUser) return;
    
    const typingRef = this.db.collection('chats').doc(chatId).collection('typing').doc('status');
    await typingRef.set({
        userId: this.currentUser.uid,
        isTyping: isTyping,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    if (isTyping) {
        setTimeout(async () => {
            const doc = await typingRef.get();
            if (doc.exists && doc.data().isTyping === true) {
                await typingRef.set({
                    userId: this.currentUser.uid,
                    isTyping: false,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        }, 3000);
    }
}

async markMessagesAsRead(chatId) {
    if (!this.currentUser) return;
    
    const messagesRef = this.db.collection('chats').doc(chatId).collection('messages');
    const unreadSnapshot = await messagesRef
        .where('senderId', '!=', this.currentUser.uid)
        .where('read', '==', false)
        .get();
    
    const batch = this.db.batch();
    unreadSnapshot.forEach(doc => {
        batch.update(doc.ref, { read: true });
    });
    await batch.commit();
}

async markMessageAsRead(chatId, messageId) {
    if (!this.currentUser) return;
    await this.db.collection('chats').doc(chatId).collection('messages').doc(messageId).update({ read: true });
}

appendNewMessage(message) {
    const messagesContainer = document.getElementById('chat-messages-area');
    if (!messagesContainer) return;
    
    if (messagesContainer.querySelector('.empty-chat')) {
        messagesContainer.innerHTML = '';
    }
    
    const msgElement = this.createMessageElement(message);
    messagesContainer.appendChild(msgElement);
    this.scrollToBottom(messagesContainer);
}

formatChatTime(timestamp) {
    if (!timestamp) return '';
    
    let date;
    if (timestamp && timestamp.toDate) {
        date = timestamp.toDate();
    } else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
    } else if (timestamp instanceof Date) {
        date = timestamp;
    } else {
        return '';
    }
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (msgDate.getTime() === today.getTime()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
}

async startNewChat() {
    if (!this.currentUser) {
        this.showToast('Please sign in to start a chat', 'warning');
        if (typeof window.openAuthModal === 'function') window.openAuthModal();
        return;
    }
    
    const usersSnapshot = await this.db.collection('users').limit(50).get();
    const users = usersSnapshot.docs
        .filter(doc => doc.id !== this.currentUser.uid)
        .map(doc => ({ id: doc.id, ...doc.data() }));
    
    if (users.length === 0) {
        this.showToast('No other users found', 'info');
        return;
    }
    
    const modalContent = `
        <div class="modal-content" style="max-width: 400px; z-index: 20002;">
            <div class="modal-header">
                <div class="modal-title">Start New Chat</div>
                <button class="close-modal-btn">&times;</button>
            </div>
            <div style="padding: 20px;">
                <div class="form-group">
                    <label>Select User</label>
                    <select id="chat-user-select" class="form-input">
                        <option value="">-- Select a user --</option>
                        ${users.map(user => `<option value="${user.id}">${this.escapeHtml(user.displayName || user.email)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Message</label>
                    <textarea id="chat-initial-message" class="form-input" rows="3" placeholder="Type your message..."></textarea>
                </div>
                <div class="form-actions" style="display: flex; gap: 10px; margin-top: 20px;">
                    <button class="btn btn-outline close-modal-btn">Cancel</button>
                    <button class="btn btn-primary" id="create-chat-btn">Start Chat</button>
                </div>
            </div>
        </div>
    `;
    
    this.showModalWithContent('new-chat-modal', modalContent);
    
    setTimeout(() => {
        const createBtn = document.getElementById('create-chat-btn');
        if (createBtn) {
            createBtn.addEventListener('click', async () => {
                const selectedUserId = document.getElementById('chat-user-select').value;
                const message = document.getElementById('chat-initial-message').value;
                
                if (!selectedUserId) {
                    this.showToast('Please select a user', 'error');
                    return;
                }
                if (!message) {
                    this.showToast('Please enter a message', 'error');
                    return;
                }
                
                const existingChat = await this.db.collection('chats')
                    .where('participants', 'array-contains', this.currentUser.uid)
                    .get();
                
                let chatRef = null;
                for (const doc of existingChat.docs) {
                    const participants = doc.data().participants;
                    if (participants.includes(selectedUserId)) {
                        chatRef = doc.ref;
                        break;
                    }
                }
                
                if (!chatRef) {
                    const chatData = {
                        participants: [this.currentUser.uid, selectedUserId],
                        lastMessage: message,
                        lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    chatRef = await this.db.collection('chats').add(chatData);
                }
                
                await chatRef.collection('messages').add({
                    senderId: this.currentUser.uid,
                    senderName: this.currentUser.displayName || this.currentUser.email,
                    text: message,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    read: false
                });
                
                await chatRef.update({
                    lastMessage: message,
                    lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastMessageBy: this.currentUser.uid
                });
                
                this.showToast('Chat started!', 'success');
                this.closeModal('new-chat-modal');
                await this.loadConversations();
                this.loadChat(chatRef.id);
            });
        }
    }, 100);
}

async startChatWithUser(userId, initialMessage) {
    if (!this.currentUser) {
        this.showToast('Please sign in to start a chat', 'warning');
        if (typeof window.openAuthModal === 'function') window.openAuthModal();
        return;
    }
    
    const existingChat = await this.db.collection('chats')
        .where('participants', 'array-contains', this.currentUser.uid)
        .get();
    
    let chatRef = null;
    for (const doc of existingChat.docs) {
        const participants = doc.data().participants;
        if (participants.includes(userId)) {
            chatRef = doc.ref;
            break;
        }
    }
    
    if (!chatRef) {
        const chatData = {
            participants: [this.currentUser.uid, userId],
            lastMessage: initialMessage,
            lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        chatRef = await this.db.collection('chats').add(chatData);
    }
    
    await chatRef.collection('messages').add({
        senderId: this.currentUser.uid,
        senderName: this.currentUser.displayName || this.currentUser.email,
        text: initialMessage,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        read: false
    });
    
    await chatRef.update({
        lastMessage: initialMessage,
        lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastMessageBy: this.currentUser.uid
    });
    
    this.showToast('Message sent!', 'success');
    await this.loadConversations();
    this.loadChat(chatRef.id);
}
    
    filterAlerts(filter) {
        document.querySelectorAll('.filter-alert-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.style.background = 'var(--light)';
            btn.style.color = 'var(--dark)';
        });
        const activeBtn = document.querySelector(`.filter-alert-btn[data-filter="${filter}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
            activeBtn.style.background = 'var(--primary)';
            activeBtn.style.color = 'white';
        }
        
        document.querySelectorAll('.alert-card').forEach(card => {
            if (filter === 'all' || card.getAttribute('data-type') === filter) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }
    
    switchSafetyCategory(cat) {
        document.querySelectorAll('[data-safety-content]').forEach(content => {
            content.style.display = 'none';
        });
        const selectedContent = document.querySelector(`[data-safety-content="${cat}"]`);
        if (selectedContent) selectedContent.style.display = 'block';
        
        document.querySelectorAll('.safety-cat-btn').forEach(btn => {
            btn.style.background = 'var(--light)';
            btn.style.color = 'var(--dark)';
        });
        const activeBtn = document.querySelector(`.safety-cat-btn[data-cat="${cat}"]`);
        if (activeBtn) {
            activeBtn.style.background = 'var(--primary)';
            activeBtn.style.color = 'white';
        }
    }
    
    switchMoreTab(tabId) {
    console.log('Switching to tab:', tabId);
    
    // ========== CLOSE ANY OPEN CHAT FIRST ==========
    // Close the chat window if it exists
    const chatWindow = document.getElementById('chat-window-container');
    if (chatWindow) {
        // Clean up listeners
        if (this.currentChatUnsubscribe) {
            this.currentChatUnsubscribe();
            this.currentChatUnsubscribe = null;
        }
        if (this.typingUnsubscribe) {
            this.typingUnsubscribe();
            this.typingUnsubscribe = null;
        }
        this.firstMessageDoc = null;
        
        // Remove the chat window
        chatWindow.remove();
    }
    
    // ========== IMPORTANT: Reset messages-content styling ==========
    const messagesContent = document.getElementById('messages-content');
    if (messagesContent) {
        // Remove all inline styles that were added by showChatWindow
        messagesContent.removeAttribute('style');
        // Reset to original HTML
        messagesContent.innerHTML = this.getMessagesHTML();
    }
    
    // Also close any chat-related modals
    const chatModals = document.querySelectorAll('.modal:not(#auth-modal)');
    chatModals.forEach(modal => {
        if (modal.id !== 'auth-modal' && modal.id !== 'rating-modal') {
            modal.remove();
        }
    });
    
    this.currentMoreTab = tabId;
    
    document.querySelectorAll('.more-tab-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.more-tab-btn[data-more-tab="${tabId}"]`);
    if (activeBtn) activeBtn.classList.add('active');
    
    document.querySelectorAll('.more-tab-content').forEach(content => content.classList.remove('active'));
    const targetContent = document.getElementById(`${tabId}-content`);
    if (targetContent) targetContent.classList.add('active');
    
    // Refresh content based on tab
    if (tabId === 'messages') {
        this.loadConversations();
        
        // Re-attach search input listener
        setTimeout(() => {
            const searchInput = document.getElementById('message-search-input');
            if (searchInput) {
                // Remove old listener to avoid duplicates
                const newSearchInput = searchInput.cloneNode(true);
                searchInput.parentNode.replaceChild(newSearchInput, searchInput);
                newSearchInput.addEventListener('input', (e) => {
                    this.filterConversations(e.target.value);
                });
            }
            const newChatBtn = document.querySelector('#messages-content .new-chat-btn');
            if (newChatBtn) {
                const newBtn = newChatBtn.cloneNode(true);
                newChatBtn.parentNode.replaceChild(newBtn, newChatBtn);
                newBtn.addEventListener('click', () => this.startNewChat());
            }
        }, 100);
    }
    if (tabId === 'alerts') this.loadAlerts();
    if (tabId === 'education') {
        this.loadTeachers();
        this.loadInternships();
        this.loadAttachments();
        this.loadTraining();
    }
        if (tabId === 'settings') {
        // Refresh settings to ensure dark mode toggle works
        this.getSettingsHTML().then(html => {
            const settingsContent = document.getElementById('settings-content');
            if (settingsContent) settingsContent.innerHTML = html;
            this.setupEventListeners();
            // Load user points after settings are rendered
            setTimeout(() => {
                this.loadUserPoints();
            }, 100);
        });
    }
}
    
    async showRatingModal() {
        if (!this.currentUser) {
            this.showToast('Please sign in to rate', 'warning');
            if (typeof window.openAuthModal === 'function') window.openAuthModal();
            return;
        }
        
        if (this.hasRated) {
            this.showToast('You have already rated! Thank you!', 'info');
            return;
        }
        
        const modalContent = `
            <div class="modal-content" style="max-width: 400px; text-align: center; z-index: 20002;">
                <div class="modal-header">
                    <div class="modal-title">Rate VikeServe</div>
                    <button class="close-modal-btn">&times;</button>
                </div>
                <div style="padding: 20px;">
                    <p>How would you rate VikeServe app?</p>
                    <div class="rating-stars" style="margin: 20px 0;">
                        <i class="far fa-star" data-rating="1" style="font-size: 2rem; cursor: pointer; margin: 0 5px; color: #f39c12;"></i>
                        <i class="far fa-star" data-rating="2" style="font-size: 2rem; cursor: pointer; margin: 0 5px; color: #f39c12;"></i>
                        <i class="far fa-star" data-rating="3" style="font-size: 2rem; cursor: pointer; margin: 0 5px; color: #f39c12;"></i>
                        <i class="far fa-star" data-rating="4" style="font-size: 2rem; cursor: pointer; margin: 0 5px; color: #f39c12;"></i>
                        <i class="far fa-star" data-rating="5" style="font-size: 2rem; cursor: pointer; margin: 0 5px; color: #f39c12;"></i>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Your Feedback (Optional)</label>
                        <textarea id="rating-feedback" class="form-input" rows="3" placeholder="Tell us what you think..."></textarea>
                    </div>
                    <div class="form-actions" style="display: flex; gap: 10px; margin-top: 20px;">
                        <button class="btn btn-outline close-modal-btn">Cancel</button>
                        <button class="btn btn-primary submit-rating-btn">Submit Rating</button>
                    </div>
                </div>
            </div>
        `;
        
        this.showModalWithContent('rating-modal', modalContent);
        
        let selectedRating = 0;
        const stars = document.querySelectorAll('#rating-modal .rating-stars i');
        
        stars.forEach(star => {
            star.addEventListener('mouseenter', () => {
                const rating = parseInt(star.getAttribute('data-rating'));
                stars.forEach((s, index) => {
                    if (index < rating) s.className = 'fas fa-star';
                    else s.className = 'far fa-star';
                });
            });
            
            star.addEventListener('mouseleave', () => {
                stars.forEach((s, index) => {
                    if (index < selectedRating) s.className = 'fas fa-star';
                    else s.className = 'far fa-star';
                });
            });
            
            star.addEventListener('click', () => {
                selectedRating = parseInt(star.getAttribute('data-rating'));
                stars.forEach((s, index) => {
                    if (index < selectedRating) s.className = 'fas fa-star';
                    else s.className = 'far fa-star';
                });
            });
        });
        
        const submitBtn = document.querySelector('#rating-modal .submit-rating-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', async () => {
                if (!selectedRating) {
                    this.showToast('Please select a rating', 'error');
                    return;
                }
                await this.submitRating(selectedRating);
                this.closeModal('rating-modal');
            });
        }
    }
    
    async submitRating(rating) {
        try {
            await this.db.collection('ratings').add({
                userId: this.currentUser.uid,
                userName: this.currentUser.displayName || this.currentUser.email,
                rating: rating,
                comment: document.getElementById('rating-feedback')?.value || '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            const founderRef = this.db.collection('system_settings').doc('founder');
            await this.db.runTransaction(async (transaction) => {
                const founderDoc = await transaction.get(founderRef);
                const currentData = founderDoc.data() || { totalStars: 0, ratingCount: 0 };
                
                const newTotalStars = (currentData.totalStars || 0) + rating;
                const newCount = (currentData.ratingCount || 0) + 1;
                const newAverage = newTotalStars / newCount;
                
                transaction.update(founderRef, {
                    totalStars: newTotalStars,
                    ratingCount: newCount,
                    averageRating: newAverage,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
            
            this.hasRated = true;
            this.showToast(`✨ Thanks! You've added ${rating} stars! ✨`, 'success');
            
            const settingsContent = document.getElementById('settings-content');
            if (settingsContent) {
                const newSettingsHTML = await this.getSettingsHTML();
                settingsContent.innerHTML = newSettingsHTML;
                this.setupEventListeners();
            }
        } catch (error) {
            console.error('Error submitting rating:', error);
            this.showToast('Error submitting rating', 'error');
        }
    }
    
    async showFounderProfile() {
        const founderDoc = await this.db.collection('system_settings').doc('founder').get();
        const founder = founderDoc.data() || { name: 'Victor Wanyama', totalStars: 0, ratingCount: 0, averageRating: 5.0, email: 'vikeserve426@gmail.com', county: 'Kakamega', country: 'Kenya', schools: 'Kakamega High School, JKUAT', achievements: 'Full Stack Developer, Firebase Expert, App Creator', bio: 'Passionate full-stack developer dedicated to creating solutions that empower local communities.' };
        
        const announcementsSnapshot = await this.db.collection('announcements')
            .orderBy('date', 'desc')
            .limit(10)
            .get();
        const announcements = announcementsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const modalContent = `
            <div class="modal-content" style="max-width: 500px; z-index: 20002;">
                <div class="modal-header">
                    <div class="modal-title"><i class="fas fa-user-tie"></i> Founder's Profile</div>
                    <button class="close-modal-btn">&times;</button>
                </div>
                <div style="padding: 20px; max-height: 60vh; overflow-y: auto;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <div style="width: 100px; height: 100px; background: linear-gradient(135deg, var(--primary), var(--primary-dark)); border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-user-tie" style="font-size: 3rem; color: white;"></i>
                        </div>
                        <h2 style="margin: 0;">${this.escapeHtml(founder.name)}</h2>
                        <p style="color: var(--grey-dark);">Founder & Lead Developer</p>
                        <p><i class="fas fa-envelope"></i> ${this.escapeHtml(founder.email || 'vikeserve426@gmail.com')}</p>
                        
                        <div style="background: var(--light); padding: 15px; border-radius: 12px; margin-top: 10px;">
                            <div style="display: flex; justify-content: space-around;">
                                <div><div style="font-size: 1.5rem; font-weight: bold; color: var(--primary);">${(founder.totalStars || 0).toLocaleString()}</div><div style="font-size: 0.7rem;">Total Stars</div></div>
                                <div><div style="font-size: 1.5rem; font-weight: bold; color: var(--primary);">${(founder.averageRating || 5.0).toFixed(1)}</div><div style="font-size: 0.7rem;">⭐ Rating</div></div>
                                <div><div style="font-size: 1.5rem; font-weight: bold; color: var(--primary);">${(founder.ratingCount || 0).toLocaleString()}</div><div style="font-size: 0.7rem;">Ratings</div></div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Personal Details -->
                    <div style="background: var(--light); border-radius: 12px; padding: 15px; margin-bottom: 15px;">
                        <h4><i class="fas fa-user-circle"></i> Personal Details</h4>
                        <div style="margin-top: 10px;">
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                                <i class="fas fa-map-marker-alt" style="width: 25px; color: var(--primary);"></i>
                                <span><strong>County:</strong> ${this.escapeHtml(founder.county || 'Bungoma')}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                                <i class="fas fa-globe-africa" style="width: 25px; color: var(--primary);"></i>
                                <span><strong>Country:</strong> ${this.escapeHtml(founder.country || 'Kenya')}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Education -->
                    <div style="background: var(--light); border-radius: 12px; padding: 15px; margin-bottom: 15px;">
                        <h4><i class="fas fa-graduation-cap"></i> Education</h4>
                        <p style="margin-top: 10px; font-size: 0.85rem;">${this.escapeHtml(founder.schools || 'Nalondo Boys High School, KYU')}</p>
                    </div>
                    
                    <!-- Achievements -->
                    <div style="background: var(--light); border-radius: 12px; padding: 15px; margin-bottom: 15px;">
                        <h4><i class="fas fa-trophy"></i> Achievements</h4>
                        <p style="margin-top: 10px; font-size: 0.85rem;">${this.escapeHtml(founder.achievements || 'Full Stack Developer, Firebase Expert, App Creator')}</p>
                    </div>
                    
                    <!-- Bio -->
                    <div style="background: var(--light); border-radius: 12px; padding: 15px; margin-bottom: 15px;">
                        <h4><i class="fas fa-info-circle"></i> About</h4>
                        <p style="margin-top: 10px; font-size: 0.85rem;">${this.escapeHtml(founder.bio || 'Passionate full-stack developer dedicated to creating solutions that empower local communities.')}</p>
                    </div>
                    
                    <!-- App Updates & Announcements -->
                    <div style="background: var(--light); border-radius: 12px; padding: 15px;">
                        <h4><i class="fas fa-megaphone"></i> App Updates & Announcements</h4>
                        <div id="announcements-list" style="margin-top: 10px;">
                            ${announcements.map(ann => `
                                <div style="border-bottom: 1px solid var(--grey); padding: 10px 0;">
                                    <strong>${this.escapeHtml(ann.title)}</strong>
                                    <p style="font-size: 0.8rem; margin-top: 5px;">${this.escapeHtml(ann.message)}</p>
                                    <div style="font-size: 0.7rem; color: var(--grey-dark);">${this.formatDate(ann.date)}</div>
                                </div>
                            `).join('')}
                            ${announcements.length === 0 ? '<p style="font-size: 0.8rem;">No announcements yet.</p>' : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.showModalWithContent('founder-profile-modal', modalContent);
    }
    
    handleSettingsAction(action) {
    const actions = {
        'share': () => this.shareApp(),
        'portfolio': () => {
            window.open('https://vike-store.netlify.app/', '_blank');
        },
        'terms': () => this.showTermsPopup(),
        'privacy': () => this.showPrivacyPolicy(),
        'profile': () => {
            if (typeof window.switchTab === 'function') window.switchTab('account-tab');
        }
    };
    if (actions[action]) actions[action]();
    else this.showToast('Feature coming soon', 'info');
}

async showTermsPopup() {
    try {
        const termsDoc = await this.db.collection('system_settings').doc('terms').get();
        let termsContent = '';
        
        if (termsDoc.exists) {
            termsContent = termsDoc.data().content;
        } else {
            termsContent = `
                <h4>1. Acceptance of Terms</h4>
                <p>By using VikeServe, you agree to these terms and conditions.</p>
                
                <h4>2. User Responsibilities</h4>
                <p>You are responsible for the accuracy of information you provide and for your interactions with other users.</p>
                
                <h4>3. Prohibited Activities</h4>
                <p>You may not post false information, spam, or engage in fraudulent activities.</p>
                
                <h4>4. Payments and Fees</h4>
                <p>Service fees apply for promoted ads. All payments are processed securely through IntaSend.</p>
                
                <h4>5. Intellectual Property</h4>
                <p>All content on VikeServe is protected by copyright and may not be used without permission.</p>
                
                <h4>6. Limitation of Liability</h4>
                <p>VikeServe is not responsible for transactions between users. Always verify services before payment.</p>
                
                <h4>7. Termination</h4>
                <p>We reserve the right to suspend accounts that violate these terms.</p>
                
                <h4>8. Changes to Terms</h4>
                <p>We may update terms. Continued use means acceptance of changes.</p>
                
                <h4>9. Contact</h4>
                <p>For questions, contact vikeserve426@gmail.com</p>
            `;
        }
        
        const modalContent = `
            <div class="modal-content" style="max-width: 500px; z-index: 20002;">
                <div class="modal-header">
                    <div class="modal-title">Terms of Service</div>
                    <button class="close-modal-btn">&times;</button>
                </div>
                <div style="padding: 15px; max-height: 60vh; overflow-y: auto;">
                    ${termsContent}
                </div>
                <div class="form-actions" style="padding: 15px;">
                    <button class="btn btn-primary close-modal-btn" style="width: 100%;">I Understand</button>
                </div>
            </div>
        `;
        
        this.showModalWithContent('terms-modal', modalContent);
        
        setTimeout(() => {
            const understandBtn = document.querySelector('#terms-modal .close-modal-btn');
            if (understandBtn) {
                understandBtn.addEventListener('click', () => {
                    this.closeModal('terms-modal');
                });
            }
        }, 100);
        
    } catch (error) {
        console.error('Error loading terms:', error);
        this.showToast('Unable to load terms. Please try again.', 'error');
    }
}

showPrivacyPolicy() {
    const modalContent = `
        <div class="modal-content" style="max-width: 500px; z-index: 20002;">
            <div class="modal-header">
                <div class="modal-title">Privacy Policy</div>
                <button class="close-modal-btn">&times;</button>
            </div>
            <div style="padding: 15px; max-height: 60vh; overflow-y: auto;">
                <h4>Information We Collect</h4>
                <p>We collect your name, email, phone number, location, and usage data to provide better services.</p>
                
                <h4>How We Use Your Information</h4>
                <p>We use your information to connect you with service providers, process payments, and improve our app.</p>
                
                <h4>Data Security</h4>
                <p>We use encryption and secure servers to protect your data. Your payment information is processed securely through IntaSend.</p>
                
                <h4>Third-Party Services</h4>
                <p>We use Firebase for database and authentication, and IntaSend for payment processing.</p>
                
                <h4>Your Rights</h4>
                <p>You can request to view, update, or delete your personal data by contacting us.</p>
                
                <h4>Contact Us</h4>
                <p>For privacy questions, contact vikeserve426@gmail.com</p>
            </div>
            <div class="form-actions" style="padding: 15px;">
                <button class="btn btn-primary close-modal-btn" style="width: 100%;">I Understand</button>
            </div>
        </div>
    `;
    
    this.showModalWithContent('privacy-modal', modalContent);
    
    setTimeout(() => {
        const understandBtn = document.querySelector('#privacy-modal .close-modal-btn');
        if (understandBtn) {
            understandBtn.addEventListener('click', () => {
                this.closeModal('privacy-modal');
            });
        }
    }, 100);
}
    
    async loadDataFromFirestore() {
        await Promise.all([
            this.loadTeachers(),
            this.loadInternships(),
            this.loadAttachments(),
            this.loadTraining(),
            this.loadAlerts(),
            this.loadConversations()
        ]);
    }
    
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            modal.style.zIndex = '20002';
        }
    }
    
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            setTimeout(() => {
                if (modal.parentNode && modal.style.display === 'none') {
                    modal.remove();
                }
            }, 300);
        }
    }
    
    toggleDarkMode(isEnabled) {
        if (isEnabled) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('darkMode', 'enabled');
        } else {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('darkMode', 'disabled');
        }
    }
    
    showModalWithContent(modalId, content) {
        const existingModal = document.getElementById(modalId);
        if (existingModal) {
            existingModal.remove();
        }
        
        const modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal';
        modal.innerHTML = content;
        modal.style.display = 'flex';
        modal.style.zIndex = '20002';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        modal.style.overflowY = 'auto';
        document.body.appendChild(modal);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal(modalId);
            }
        });
    }
    
    shareApp() {
    const appUrl = 'https://vikeserve.pages.dev/';
    if (navigator.share) {
        navigator.share({
            title: 'VikeServe',
            text: 'Check out VikeServe app - your complete daily needs super app!',
            url: appUrl
        });
    } else {
        navigator.clipboard.writeText(appUrl);
        this.showToast('Link copied! Share it with your friends.', 'success');
    }
}
    
    onMenuOpen() {
        if (this.currentMoreTab === 'messages') {
            this.loadConversations();
        } else if (this.currentMoreTab === 'alerts') {
            this.loadAlerts();
        } else if (this.currentMoreTab === 'education') {
            this.loadTeachers();
            this.loadInternships();
            this.loadAttachments();
            this.loadTraining();
        }
    }
    
    onMenuClose() {
        if (this.currentChatUnsubscribe) {
            this.currentChatUnsubscribe();
            this.currentChatUnsubscribe = null;
        }
        if (this.typingUnsubscribe) {
            this.typingUnsubscribe();
            this.typingUnsubscribe = null;
        }
        this.firstMessageDoc = null;
    }
    
    showToast(message, type = 'info') {
        if (window.showToast) window.showToast(message, type);
        else console.log(`${type}: ${message}`);
    }
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

        // ========== LOAD AND DISPLAY USER POINTS ==========
    async loadUserPoints() {
        if (!this.currentUser) return 0;
        
        try {
            let points = 0;
            if (typeof window.reviewsManager !== 'undefined' && window.reviewsManager.getUserPoints) {
                points = await window.reviewsManager.getUserPoints(this.currentUser.uid);
            } else {
                const userDoc = await this.db.collection('users').doc(this.currentUser.uid).get();
                points = userDoc.exists ? (userDoc.data().points || 0) : 0;
            }
            
            const pointsDisplay = document.getElementById('user-points-display');
            if (pointsDisplay) {
                pointsDisplay.textContent = points.toLocaleString();
            }
            
            return points;
        } catch (error) {
            console.error('Error loading user points:', error);
            return 0;
        }
    }
    
    // ========== SHOW POINTS HISTORY MODAL ==========
    async showPointsHistory() {
        if (!this.currentUser) {
            this.showToast('Please sign in to view points history', 'warning');
            if (typeof window.openAuthModal === 'function') window.openAuthModal();
            return;
        }
        
        try {
            let transactions = [];
            if (typeof window.reviewsManager !== 'undefined' && window.reviewsManager.getUserPointsHistory) {
                transactions = await window.reviewsManager.getUserPointsHistory(this.currentUser.uid, 50);
            } else {
                const snapshot = await this.db.collection('points_transactions')
                    .where('userId', '==', this.currentUser.uid)
                    .orderBy('createdAt', 'desc')
                    .limit(50)
                    .get();
                transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }
            
            const historyHtml = transactions.map(t => {
                const date = t.createdAt?.toDate ? this.formatDate(t.createdAt.toDate()) : this.formatDate(t.createdAt);
                const isEarn = t.amount > 0;
                return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--grey);">
                        <div>
                            <div style="font-weight: 600;">${isEarn ? '🎁 Earned' : '💎 Redeemed'}</div>
                            <div style="font-size: 0.7rem; color: var(--grey-dark);">${t.reason || (isEarn ? 'Review received' : 'Ad promotion')}</div>
                            ${t.packageName ? `<div style="font-size: 0.7rem; color: var(--grey-dark);">Package: ${this.escapeHtml(t.packageName)}</div>` : ''}
                            <div style="font-size: 0.65rem; color: var(--grey-dark);">${date}</div>
                        </div>
                        <div style="font-weight: 700; color: ${isEarn ? '#27ae60' : '#e74c3c'};">
                            ${isEarn ? `+${t.amount}` : `${t.amount}`} pts
                        </div>
                    </div>
                `;
            }).join('');
            
            const modalContent = `
                <div class="modal-content" style="max-width: 400px; max-height: 70vh; overflow-y: auto;">
                    <div class="modal-header">
                        <div class="modal-title"><i class="fas fa-history"></i> Points History</div>
                        <button class="close-modal-btn" onclick="closePointsHistoryModal()">&times;</button>
                    </div>
                    <div style="padding: 15px;">
                        ${transactions.length === 0 ? '<div style="text-align: center; padding: 40px;">No points transactions yet.</div>' : historyHtml}
                    </div>
                </div>
            `;
            
            const modal = document.createElement('div');
            modal.id = 'points-history-modal';
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.style.zIndex = '20002';
            modal.innerHTML = modalContent;
            document.body.appendChild(modal);
            
            window.closePointsHistoryModal = () => {
                const m = document.getElementById('points-history-modal');
                if (m) m.remove();
            };
            
        } catch (error) {
            console.error('Error loading points history:', error);
            this.showToast('Error loading points history', 'error');
        }
    }
    
    formatDate(timestamp) {
        if (!timestamp) return 'Recently';
        try {
            let date;
            if (timestamp && timestamp.toDate) {
                date = timestamp.toDate();
            } else if (typeof timestamp === 'string') {
                date = new Date(timestamp);
            } else if (timestamp instanceof Date) {
                date = timestamp;
            } else {
                return 'Recently';
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
}

document.addEventListener('DOMContentLoaded', function() {
    window.moreMenuManager = new MoreMenuManager();
});

// ========== ADMIN FUNCTION TO ADD ANNOUNCEMENTS ==========
// To use: copy and paste in browser console after signing in as admin
window.addAppAnnouncement = async function(title, message) {
    try {
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) {
            console.log('❌ Please sign in first');
            return { success: false, error: 'Not signed in' };
        }
        
        const announcement = {
            title: title,
            message: message,
            date: firebase.firestore.FieldValue.serverTimestamp(),
            isRead: false,
            isGlobal: true,
            createdBy: currentUser.uid,
            createdByName: currentUser.displayName || currentUser.email
        };
        
        await firebase.firestore().collection('announcements').add(announcement);
        console.log(`✅ Announcement added: "${title}"`);
        
        // Refresh the founder profile if open
        const founderModal = document.getElementById('founder-profile-modal');
        if (founderModal && founderModal.style.display === 'flex') {
            window.moreMenuManager.showFounderProfile();
        }
        
        return { success: true };
    } catch (error) {
        console.error('Error adding announcement:', error);
        return { success: false, error: error.message };
    }
};

// Helper function to update founder details from Firebase Console
window.updateFounderDetails = async function(details) {
    try {
        const currentUser = firebase.auth().currentUser;
        if (!currentUser || currentUser.email !== 'vikeserve426@gmail.com') {
            console.log('❌ Only founder can update these details');
            return { success: false, error: 'Admin only' };
        }
        
        const founderRef = firebase.firestore().collection('system_settings').doc('founder');
        await founderRef.update({
            ...details,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('✅ Founder details updated:', details);
        
        // Refresh settings
        const settingsContent = document.getElementById('settings-content');
        if (settingsContent) {
            const newHTML = await window.moreMenuManager.getSettingsHTML();
            settingsContent.innerHTML = newHTML;
            window.moreMenuManager.setupEventListeners();
        }
        
        return { success: true };
    } catch (error) {
        console.error('Error updating founder details:', error);
        return { success: false, error: error.message };
    }
};