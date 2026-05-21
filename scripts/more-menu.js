// more-menu.js - COMPLETE FIXED VERSION with ALL Features Preserved
// Issues fixed: Firebase integration, message tab, ratings, announcements, validation, etc.

class MoreMenuManager {
    constructor() {
        this.currentMoreTab = 'education';
        this.db = firebase.firestore();
        this.auth = firebase.auth();
        this.currentUser = null;
        this.hasRated = false;
        this.init();
    }
    
    async init() {
        console.log('More Menu Manager initializing with Firestore...');
        
        // Set up auth listener
        this.auth.onAuthStateChanged((user) => {
            this.currentUser = user;
            if (user) {
                this.checkIfUserHasRated();
            }
        });
        
        await this.initializeFirestoreData();
        this.replaceAllTabContent();
        this.setupEventListeners();
        await this.loadDataFromFirestore();
        console.log('✅ More Menu Manager ready with Firestore');
    }
    
    async initializeFirestoreData() {
        // Initialize founder data in Firestore if not exists
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
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        // Initialize default announcements if none exist
        const announcementsSnapshot = await this.db.collection('announcements').limit(1).get();
        if (announcementsSnapshot.empty) {
            const defaultAnnouncements = [
                {
                    id: Date.now(),
                    title: '🎉 Welcome to VikeServe!',
                    message: 'Thank you for using VikeServe! We\'re constantly improving to serve you better. Stay tuned for exciting updates!',
                    date: firebase.firestore.FieldValue.serverTimestamp(),
                    isRead: false,
                    isGlobal: true
                },
                {
                    id: Date.now() + 1,
                    title: '✨ New Feature: Ad Promotion',
                    message: 'You can now promote your ads to reach more customers! Check out the "View Packages" button.',
                    date: firebase.firestore.FieldValue.serverTimestamp(),
                    isRead: false,
                    isGlobal: true
                }
            ];
            
            for (const announcement of defaultAnnouncements) {
                await this.db.collection('announcements').add(announcement);
            }
        }
        
        // Initialize terms and conditions in Firestore
        const termsRef = this.db.collection('system_settings').doc('terms');
        const termsDoc = await termsRef.get();
        if (!termsDoc.exists) {
            await termsRef.set({
                content: this.getDefaultTermsContent(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        // Initialize ad packages in Firestore
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
    
    async checkIfUserHasRated() {
        if (!this.currentUser) return;
        
        const ratingSnapshot = await this.db.collection('ratings')
            .where('userId', '==', this.currentUser.uid)
            .get();
        
        this.hasRated = !ratingSnapshot.empty;
    }
    
    replaceAllTabContent() {
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
        if (settingsContent) settingsContent.innerHTML = this.getSettingsHTML();
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
            <div class="section-title"><i class="fas fa-comments"></i> Messages</div>
            <div class="search-bar" style="margin-bottom: 15px;">
                <i class="fas fa-search search-icon"></i>
                <input type="text" id="message-search-input" class="search-input" placeholder="Search conversations...">
            </div>
            <div id="conversations-list-container">
                <div class="loading-spinner">Loading conversations...</div>
            </div>
            <div style="text-align: center; margin-top: 20px;">
                <button class="new-chat-btn btn btn-primary" style="width: auto; padding: 10px 24px;"><i class="fas fa-plus"></i> Start New Chat</button>
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
                            <div><strong><i class="fas fa-shield-alt"></i> Police Emergency</strong><div style="font-size: 0.8rem; color: #666;">General emergencies, crime reporting</div></div>
                            <button class="btn btn-sm btn-danger emergency-call-btn" data-number="999" style="padding: 8px 16px;">Call 999</button>
                        </div>
                        <div class="emergency-contact-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: white; border-radius: 10px; border-left: 4px solid #e74c3c;">
                            <div><strong><i class="fas fa-phone-alt"></i> Emergency (All Networks)</strong><div style="font-size: 0.8rem; color: #666;">Works even without airtime</div></div>
                            <button class="btn btn-sm btn-danger emergency-call-btn" data-number="112" style="padding: 8px 16px;">Call 112</button>
                        </div>
                        <div class="emergency-contact-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: white; border-radius: 10px; border-left: 4px solid #9b59b6;">
                            <div><strong><i class="fas fa-venus"></i> Gender-Based Violence Hotline</strong><div style="font-size: 0.8rem; color: #666;">24/7 support for GBV survivors</div></div>
                            <button class="btn btn-sm btn-primary emergency-call-btn" data-number="1195" style="padding: 8px 16px;">Call 1195</button>
                        </div>
                        <div class="emergency-contact-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: white; border-radius: 10px; border-left: 4px solid #3498db;">
                            <div><strong><i class="fas fa-child"></i> Child Helpline</strong><div style="font-size: 0.8rem; color: #666;">Report child abuse and neglect</div></div>
                            <button class="btn btn-sm btn-primary emergency-call-btn" data-number="116" style="padding: 8px 16px;">Call 116</button>
                        </div>
                        <div class="emergency-contact-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: white; border-radius: 10px; border-left: 4px solid #2ecc71;">
                            <div><strong><i class="fas fa-brain"></i> Mental Health Helpline</strong><div style="font-size: 0.8rem; color: #666;">Counselling and mental health support</div></div>
                            <button class="btn btn-sm btn-success emergency-call-btn" data-number="1199" style="padding: 8px 16px;">Call 1199</button>
                        </div>
                        <div class="emergency-contact-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--primary); color: white; border-radius: 10px;">
                            <div><strong><i class="fas fa-headset"></i> VikeServe Support</strong><div style="font-size: 0.8rem; opacity: 0.9;">App support and assistance</div></div>
                            <button class="btn btn-sm btn-light vikeserve-support-btn" style="padding: 8px 16px; background: white; color: var(--primary);">Contact Support</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    async getSettingsHTML() {
        // Load founder data from Firestore
        const founderDoc = await this.db.collection('system_settings').doc('founder').get();
        const founder = founderDoc.exists ? founderDoc.data() : { name: 'Victor Wanyama', totalStars: 0, ratingCount: 0, averageRating: 5.0 };
        
        return `
            <div class="section-title"><i class="fas fa-cog"></i> Settings & Preferences</div>
            
            <div style="background: var(--light); border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                <h4><i class="fas fa-palette"></i> App Preferences</h4>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--grey);">
                    <div><strong>Dark Mode</strong><div style="font-size: 0.8rem; color: #666;">Switch between light and dark theme</div></div>
                    <label class="switch"><input type="checkbox" class="dark-mode-toggle-settings" ${localStorage.getItem('darkMode') === 'enabled' ? 'checked' : ''}><span class="slider round"></span></label>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--grey);">
                    <div><strong>Language</strong><div style="font-size: 0.8rem; color: #666;">Change app language</div></div>
                    <button class="btn btn-sm btn-outline language-btn">English</button>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0;">
                    <div><strong>Notifications</strong><div style="font-size: 0.8rem; color: #666;">Receive push notifications</div></div>
                    <label class="switch"><input type="checkbox" class="notifications-toggle" checked><span class="slider round"></span></label>
                </div>
            </div>
            
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 20px; margin-bottom: 20px; color: white;">
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                    <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-crown" style="font-size: 2rem;"></i>
                    </div>
                    <div>
                        <h3 style="margin: 0;">${this.escapeHtml(founder.name)}</h3>
                        <p style="margin: 0; opacity: 0.9;">Founder & Lead Developer</p>
                    </div>
                </div>
                
                <div style="text-align: center; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 12px; margin-bottom: 15px;">
                    <div style="font-size: 2.5rem; font-weight: bold;" id="founder-total-stars">${(founder.totalStars || 0).toLocaleString()}</div>
                    <div style="font-size: 0.8rem; opacity: 0.9;">⭐ Total Stars Earned ⭐</div>
                    <div id="founder-star-rating" style="margin: 10px 0;">
                        ${this.generateStarRatingHTML(founder.averageRating || 5.0)}
                    </div>
                    <div style="font-size: 0.75rem; opacity: 0.8;">⭐ Average Rating: ${(founder.averageRating || 5.0).toFixed(1)} ⭐</div>
                    <div style="font-size: 0.7rem; opacity: 0.7; margin-top: 5px;">Based on ${(founder.ratingCount || 0).toLocaleString()} community ratings</div>
                </div>
                
                <div style="display: flex; gap: 10px;">
                    <button class="btn rate-founder-btn" style="flex: 1; background: white; color: #764ba2;" ${this.hasRated ? 'disabled' : ''}><i class="fas fa-star"></i> ${this.hasRated ? 'Already Rated' : 'Rate Founder'}</button>
                    <button class="btn view-founder-profile-btn" style="flex: 1; background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3);"><i class="fas fa-user-circle"></i> View Profile</button>
                </div>
            </div>
            
            <div style="background: var(--light); border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                <h4><i class="fas fa-question-circle"></i> FAQ & Help Center</h4>
                <div class="faq-item" style="border-bottom: 1px solid var(--grey);">
                    <div class="faq-question" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; cursor: pointer;">
                        <strong>How do I post a service?</strong>
                        <i class="fas fa-chevron-down faq-icon"></i>
                    </div>
                    <div class="faq-answer" style="display: none; padding: 0 0 12px 0; color: #666; font-size: 0.85rem;">
                        Go to Services tab, click "List Your Service", fill in the details, and submit. Your service will appear in the listings.
                    </div>
                </div>
                <div class="faq-item" style="border-bottom: 1px solid var(--grey);">
                    <div class="faq-question" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; cursor: pointer;">
                        <strong>How do I promote my ad?</strong>
                        <i class="fas fa-chevron-down faq-icon"></i>
                    </div>
                    <div class="faq-answer" style="display: none; padding: 0 0 12px 0; color: #666; font-size: 0.85rem;">
                        <a href="#" class="show-promotion-guide" style="color: var(--primary); text-decoration: none;">Click here for detailed step-by-step guide →</a>
                    </div>
                </div>
                <div class="faq-item" style="border-bottom: 1px solid var(--grey);">
                    <div class="faq-question" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; cursor: pointer;">
                        <strong>How do I contact a service provider?</strong>
                        <i class="fas fa-chevron-down faq-icon"></i>
                    </div>
                    <div class="faq-answer" style="display: none; padding: 0 0 12px 0; color: #666; font-size: 0.85rem;">
                        Click on any service or job listing, then click the "Contact" button to call or send a text message.
                    </div>
                </div>
                <div class="faq-item">
                    <div class="faq-question" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; cursor: pointer;">
                        <strong>Is my payment secure?</strong>
                        <i class="fas fa-chevron-down faq-icon"></i>
                    </div>
                    <div class="faq-answer" style="display: none; padding: 0 0 12px 0; color: #666; font-size: 0.85rem;">
                        Yes! We use IntaSend secure payment gateway. All transactions are encrypted and secure.
                    </div>
                </div>
            </div>
            
            <div style="background: var(--light); border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                <h4><i class="fas fa-info-circle"></i> About</h4>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--grey);">
                    <div><strong>About VikeServe</strong><div style="font-size: 0.8rem; color: #666;">Version 1.0.0</div></div>
                    <div>© 2026</div>
                </div>
                <div class="support-option" data-action="portfolio" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; cursor: pointer;">
                    <div><strong>Founder's Portfolio</strong><div style="font-size: 0.8rem; color: #666;">Victor Wanyama - Web Developer</div></div>
                    <i class="fas fa-chevron-right"></i>
                </div>
            </div>
            
            <div style="background: var(--light); border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                <h4><i class="fas fa-shield-alt"></i> Privacy Policy</h4>
                <div class="privacy-item" style="border-bottom: 1px solid var(--grey);">
                    <div class="privacy-question" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; cursor: pointer;">
                        <strong>Information We Collect</strong>
                        <i class="fas fa-chevron-down privacy-icon"></i>
                    </div>
                    <div class="privacy-answer" style="display: none; padding: 0 0 12px 0; color: #666; font-size: 0.85rem;">
                        We collect your name, email, phone number, location, and usage data to provide better services.
                    </div>
                </div>
                <div class="privacy-item">
                    <div class="privacy-question" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; cursor: pointer;">
                        <strong>Data Security</strong>
                        <i class="fas fa-chevron-down privacy-icon"></i>
                    </div>
                    <div class="privacy-answer" style="display: none; padding: 0 0 12px 0; color: #666; font-size: 0.85rem;">
                        We use encryption and secure servers to protect your data. Your payment information is processed securely through IntaSend.
                    </div>
                </div>
            </div>
            
            <div style="background: var(--light); border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                <h4><i class="fas fa-file-contract"></i> Terms of Service</h4>
                <div class="support-option" data-action="terms" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; cursor: pointer;">
                    <div><strong>View Terms & Conditions</strong><div style="font-size: 0.8rem; color: #666;">App usage guidelines</div></div>
                    <i class="fas fa-chevron-right"></i>
                </div>
            </div>
            
            <div style="background: var(--light); border-radius: 12px; padding: 15px; margin-bottom: 20px;">
                <h4><i class="fas fa-share-alt"></i> Share & Support</h4>
                <div class="support-option" data-action="share" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; cursor: pointer; border-bottom: 1px solid var(--grey);">
                    <div><strong>Share VikeServe</strong><div style="font-size: 0.8rem; color: #666;">Invite friends and family</div></div>
                    <i class="fas fa-chevron-right"></i>
                </div>
                <div class="support-option" data-action="rate" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; cursor: pointer;">
                    <div><strong>Rate Our App</strong><div style="font-size: 0.8rem; color: #666;">Share your feedback with us</div></div>
                    <i class="fas fa-chevron-right"></i>
                </div>
            </div>
            
            <div style="text-align: center; margin-top: 20px; padding: 15px; color: #999;">
                <div>VikeServe v1.0.0</div>
                <div>© 2026 VikeServe Ltd. Built with ❤️ by Victor Wanyama</div>
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
        // Tab switching
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
        
        // Use event delegation for better performance
        document.getElementById('more-section')?.addEventListener('click', async (e) => {
            // Education post buttons
            if (e.target.closest('.post-teacher-btn')) this.showSubmitModal('teacher');
            if (e.target.closest('.post-internship-btn')) this.showSubmitModal('internship');
            if (e.target.closest('.offer-attachment-btn')) this.showSubmitModal('attachment');
            if (e.target.closest('.post-training-btn')) this.showSubmitModal('training');
            
            // Promotion guide link
            if (e.target.closest('.show-promotion-guide')) {
                e.preventDefault();
                this.showAdPromotionGuide();
                return;
            }
            
            // Founder profile button
            if (e.target.closest('.view-founder-profile-btn')) {
                this.showFounderProfile();
                return;
            }
            
            // Alert button
            if (e.target.closest('.report-alert-btn')) this.showSubmitModal('alert');
            
            // Message button
            if (e.target.closest('.new-chat-btn')) this.startNewChat();
            
            // Emergency call buttons
            if (e.target.closest('.emergency-call-btn')) {
                const number = e.target.closest('.emergency-call-btn').getAttribute('data-number');
                if (number) window.location.href = `tel:${number}`;
            }
            
            // VikeServe Support button
            if (e.target.closest('.vikeserve-support-btn')) {
                this.showToast('Contact support: vikeserve426@gmail.com or WhatsApp +254 712 809 703', 'info');
                return;
            }
            
            // Filter buttons
            if (e.target.closest('.filter-alert-btn')) {
                const filter = e.target.closest('.filter-alert-btn').getAttribute('data-filter');
                this.filterAlerts(filter);
            }
            
            // Rate founder button
            if (e.target.closest('.rate-founder-btn') && !this.hasRated) {
                this.showRatingModal();
                return;
            }
            
            // FAQ dropdown toggles
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
            
            // Privacy dropdown toggles
            if (e.target.closest('.privacy-question')) {
                const question = e.target.closest('.privacy-question');
                const answer = question.nextElementSibling;
                const icon = question.querySelector('.privacy-icon');
                
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
            
            // Settings buttons
            if (e.target.closest('.dark-mode-toggle-settings')) {
                this.toggleDarkMode(e.target.closest('.dark-mode-toggle-settings').checked);
            }
            if (e.target.closest('.language-btn')) this.showLanguageSelector();
            if (e.target.closest('.support-option')) {
                const action = e.target.closest('.support-option').getAttribute('data-action');
                this.handleSettingsAction(action);
            }
            if (e.target.closest('.notifications-toggle')) {
                const isChecked = e.target.closest('.notifications-toggle').checked;
                this.showToast(isChecked ? 'Notifications enabled' : 'Notifications disabled', 'info');
            }
            
            // Safety category buttons
            if (e.target.closest('.safety-cat-btn')) {
                const cat = e.target.closest('.safety-cat-btn').getAttribute('data-cat');
                this.switchSafetyCategory(cat);
            }
        });
        
        // Load initial data
        this.loadTeachers();
        this.loadInternships();
        this.loadAttachments();
        this.loadTraining();
        this.loadAlerts();
        this.loadConversations();
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
        
        // Validate required fields
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
                const fieldName = input.id.replace(`${type}-`, '');
                data[fieldName] = input.value;
            }
        });
        
        data.userId = this.currentUser.uid;
        data.userName = this.currentUser.displayName || this.currentUser.email;
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        data.status = 'active';
        
        try {
            await this.db.collection(collection).add(data);
            this.showToast(`${type} posted successfully!`, 'success');
            this.closeModal(`${type}-modal`);
            
            // Refresh the appropriate list
            switch(type) {
                case 'teacher': this.loadTeachers(); break;
                case 'internship': this.loadInternships(); break;
                case 'attachment': this.loadAttachments(); break;
                case 'training': this.loadTraining(); break;
                case 'alert': this.loadAlerts(); break;
            }
        } catch (error) {
            console.error('Error posting:', error);
            this.showToast('Error posting: ' + error.message, 'error');
        }
    }
    
    async loadTeachers() { await this.loadCollection('teachers', 'teachers-list-container', 'teacher'); }
    async loadInternships() { await this.loadCollection('internships', 'internships-list-container', 'internship'); }
    async loadAttachments() { await this.loadCollection('attachments', 'attachments-list-container', 'attachment'); }
    async loadTraining() { await this.loadCollection('training_courses', 'training-list-container', 'training'); }
    
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
            
            container.innerHTML = items.map(item => `
                <div class="list-item">
                    <div class="list-item-title">${this.escapeHtml(item.title || item.name || item.company || item.school || 'Untitled')}</div>
                    <div class="list-item-subtitle">${this.escapeHtml(item.company || item.organization || item.provider || item.school || '')}</div>
                    <div class="list-item-description">${this.escapeHtml((item.description || '').substring(0, 100))}...</div>
                    <div class="list-item-date">Posted: ${this.formatDate(item.createdAt)}</div>
                    ${item.email ? `<div class="list-item-contact"><i class="fas fa-envelope"></i> ${this.escapeHtml(item.email)}</div>` : ''}
                </div>
            `).join('');
        } catch (error) {
            console.error(`Error loading ${collectionName}:`, error);
            container.innerHTML = `<div class="error-state">Error loading ${typeName}s</div>`;
        }
    }
    
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
            
            container.innerHTML = alerts.map(alert => `
                <div class="alert-card" data-type="${alert.type || 'info'}">
                    <div class="alert-header">
                        <div class="alert-title"><i class="fas ${alert.type === 'emergency' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i> ${this.escapeHtml(alert.title)}</div>
                        <div class="alert-time">${this.formatDate(alert.createdAt)}</div>
                    </div>
                    <div class="alert-content">${this.escapeHtml(alert.description)}</div>
                    <div class="alert-location"><i class="fas fa-map-marker-alt"></i> ${this.escapeHtml(alert.location || 'Unknown')}</div>
                    ${alert.urgency === 'high' ? '<div class="alert-urgent"><span class="urgent-badge">URGENT</span></div>' : ''}
                    ${this.currentUser ? `<button class="btn btn-sm btn-outline contact-reporter-btn" data-alert-id="${alert.id}" data-reporter-id="${alert.userId}">Contact Reporter</button>` : ''}
                </div>
            `).join('');
            
            // Add contact reporter handlers
            document.querySelectorAll('.contact-reporter-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.startChatWithUser(btn.getAttribute('data-reporter-id'), 'Regarding your alert');
                });
            });
        } catch (error) {
            console.error('Error loading alerts:', error);
            container.innerHTML = '<div class="error-state">Error loading alerts</div>';
        }
    }
    
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
                .limit(30)
                .get();
            
            const conversations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            if (conversations.length === 0) {
                container.innerHTML = '<div class="empty-state">No messages yet. Start a conversation!</div>';
                return;
            }
            
            container.innerHTML = conversations.map(conv => {
                const otherParticipant = conv.participants.find(p => p !== this.currentUser.uid);
                return `
                    <div class="conversation-item" data-chat-id="${conv.id}" style="display: flex; align-items: center; gap: 12px; padding: 12px; border-bottom: 1px solid var(--grey); cursor: pointer;">
                        <div class="conversation-avatar" style="width: 50px; height: 50px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white;">
                            <i class="fas fa-user"></i>
                        </div>
                        <div style="flex: 1;">
                            <div class="conversation-title" style="font-weight: 600;">${conv.listingTitle || 'Chat'}</div>
                            <div class="conversation-last-message" style="font-size: 0.8rem; color: var(--grey-dark);">${this.escapeHtml(conv.lastMessage || 'No messages')}</div>
                        </div>
                        <div class="conversation-time" style="font-size: 0.7rem; color: var(--grey-dark);">${this.formatDate(conv.lastMessageAt)}</div>
                    </div>
                `;
            }).join('');
            
            document.querySelectorAll('.conversation-item').forEach(item => {
                item.addEventListener('click', () => this.openChat(item.getAttribute('data-chat-id')));
            });
        } catch (error) {
            console.error('Error loading conversations:', error);
            container.innerHTML = '<div class="error-state">Error loading messages</div>';
        }
    }
    
    async startNewChat() {
        if (!this.currentUser) {
            this.showToast('Please sign in to start a chat', 'warning');
            if (typeof window.openAuthModal === 'function') window.openAuthModal();
            return;
        }
        
        const usersSnapshot = await this.db.collection('users').limit(20).get();
        const users = usersSnapshot.docs.filter(doc => doc.id !== this.currentUser.uid).map(doc => ({ id: doc.id, ...doc.data() }));
        
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
                    
                    const chatData = {
                        participants: [this.currentUser.uid, selectedUserId],
                        lastMessage: message,
                        lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    
                    const chatRef = await this.db.collection('chats').add(chatData);
                    await chatRef.collection('messages').add({
                        senderId: this.currentUser.uid,
                        text: message,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    this.showToast('Chat started!', 'success');
                    this.closeModal('new-chat-modal');
                    await this.loadConversations();
                });
            }
        }, 100);
    }
    
    async startChatWithUser(userId, initialMessage) {
        // Check if chat already exists
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
            text: initialMessage,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        await chatRef.update({
            lastMessage: initialMessage,
            lastMessageAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        this.showToast('Message sent!', 'success');
        await this.loadConversations();
    }
    
    openChat(chatId) {
        this.showToast('Opening chat... Feature coming soon', 'info');
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
        this.currentMoreTab = tabId;
        
        document.querySelectorAll('.more-tab-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`.more-tab-btn[data-more-tab="${tabId}"]`);
        if (activeBtn) activeBtn.classList.add('active');
        
        document.querySelectorAll('.more-tab-content').forEach(content => content.classList.remove('active'));
        const targetContent = document.getElementById(`${tabId}-content`);
        if (targetContent) targetContent.classList.add('active');
        
        if (tabId === 'messages') this.loadConversations();
        if (tabId === 'alerts') this.loadAlerts();
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
            // Save individual rating
            await this.db.collection('ratings').add({
                userId: this.currentUser.uid,
                userName: this.currentUser.displayName || this.currentUser.email,
                rating: rating,
                comment: document.getElementById('rating-feedback')?.value || '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Update founder stats using transaction
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
            
            // Refresh the settings display
            const settingsContent = document.getElementById('settings-content');
            if (settingsContent) {
                settingsContent.innerHTML = await this.getSettingsHTML();
                this.setupEventListeners();
            }
        } catch (error) {
            console.error('Error submitting rating:', error);
            this.showToast('Error submitting rating', 'error');
        }
    }
    
    async showFounderProfile() {
        const founderDoc = await this.db.collection('system_settings').doc('founder').get();
        const founder = founderDoc.data() || { name: 'Victor Wanyama', totalStars: 0, ratingCount: 0, averageRating: 5.0 };
        
        const announcementsSnapshot = await this.db.collection('announcements')
            .orderBy('date', 'desc')
            .limit(10)
            .get();
        const announcements = announcementsSnapshot.docs.map(doc => doc.data());
        
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
                        <div style="background: var(--light); padding: 15px; border-radius: 12px; margin-top: 10px;">
                            <div style="display: flex; justify-content: space-around;">
                                <div><div style="font-size: 1.5rem; font-weight: bold; color: var(--primary);">${(founder.totalStars || 0).toLocaleString()}</div><div style="font-size: 0.7rem;">Total Stars</div></div>
                                <div><div style="font-size: 1.5rem; font-weight: bold; color: var(--primary);">${(founder.averageRating || 5.0).toFixed(1)}</div><div style="font-size: 0.7rem;">⭐ Rating</div></div>
                                <div><div style="font-size: 1.5rem; font-weight: bold; color: var(--primary);">${(founder.ratingCount || 0).toLocaleString()}</div><div style="font-size: 0.7rem;">Ratings</div></div>
                            </div>
                        </div>
                    </div>
                    
                    <div style="background: var(--light); border-radius: 12px; padding: 15px; margin-bottom: 15px;">
                        <h4><i class="fas fa-info-circle"></i> About the Founder</h4>
                        <p style="font-size: 0.85rem;">Victor Wanyama is a passionate full-stack developer dedicated to creating solutions that empower local communities. VikeServe was built to connect service providers with customers in Kenya and across the World.</p>
                    </div>
                    
                    <div style="background: var(--light); border-radius: 12px; padding: 15px;">
                        <h4><i class="fas fa-megaphone"></i> App Updates & Announcements</h4>
                        ${announcements.map(ann => `
                            <div style="border-bottom: 1px solid var(--grey); padding: 10px 0;">
                                <strong>${this.escapeHtml(ann.title)}</strong>
                                <p style="font-size: 0.8rem; margin-top: 5px;">${this.escapeHtml(ann.message)}</p>
                                <div style="font-size: 0.7rem; color: var(--grey-dark);">${this.formatDate(ann.date)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        this.showModalWithContent('founder-profile-modal', modalContent);
    }
    
    async showTermsPopup() {
        const termsDoc = await this.db.collection('system_settings').doc('terms').get();
        const termsContent = termsDoc.exists ? termsDoc.data().content : this.getDefaultTermsContent();
        
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
                    <button class="btn btn-primary close-modal-btn">I Understand</button>
                </div>
            </div>
        `;
        
        this.showModalWithContent('terms-modal', modalContent);
    }
    
    async showAdPromotionGuide() {
        const packagesSnapshot = await this.db.collection('ad_packages').get();
        const packages = packagesSnapshot.docs.map(doc => doc.data());
        
        const modalContent = `
            <div class="modal-content" style="max-width: 500px; z-index: 20002;">
                <div class="modal-header">
                    <div class="modal-title"><i class="fas fa-rocket"></i> How to Promote Your Ad</div>
                    <button class="close-modal-btn">&times;</button>
                </div>
                <div style="padding: 20px; max-height: 60vh; overflow-y: auto;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <i class="fas fa-bullhorn" style="font-size: 3rem; color: var(--primary);"></i>
                    </div>
                    
                    <h4 style="color: var(--primary); margin-bottom: 15px;">Step-by-Step Guide to Promote Your Ad</h4>
                    
                    <div style="margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px;">
                            <div style="width: 30px; height: 30px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">1</div>
                            <div><strong>Sign In to Your Account</strong></div>
                        </div>
                        <p style="margin-left: 42px; color: #666; font-size: 0.9rem;">Click on the user profile icon and sign in with your email or Google account.</p>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px;">
                            <div style="width: 30px; height: 30px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">2</div>
                            <div><strong>Go to "My Ads"</strong></div>
                        </div>
                        <p style="margin-left: 42px; color: #666; font-size: 0.9rem;">Tap the user profile icon, then select <strong>"My Ads"</strong> from the menu.</p>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px;">
                            <div style="width: 30px; height: 30px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">3</div>
                            <div><strong>Create Your First Ad</strong></div>
                        </div>
                        <p style="margin-left: 42px; color: #666; font-size: 0.9rem;">If you don't have any ads yet, click <strong>"Post New Ad"</strong> and fill in your product or service details.</p>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px;">
                            <div style="width: 30px; height: 30px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">4</div>
                            <div><strong>Select Your Promotion Package</strong></div>
                        </div>
                        <p style="margin-left: 42px; color: #666; font-size: 0.9rem;">Choose from our available packages:</p>
                        <ul style="margin-left: 60px; color: #666; font-size: 0.85rem;">
                            ${packages.map(pkg => `<li>⭐ <strong>${pkg.name} (${pkg.duration} days)</strong> - KES ${pkg.price}</li>`).join('')}
                        </ul>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px;">
                            <div style="width: 30px; height: 30px; background: var(--success); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">✓</div>
                            <div><strong>Complete Payment</strong></div>
                        </div>
                        <p style="margin-left: 42px; color: #666; font-size: 0.9rem;">Select M-Pesa, Airtel Money, Credit Card, or PayPal to complete payment.</p>
                    </div>
                    
                    <div style="background: #e8f4fd; border-radius: 10px; padding: 15px; margin-top: 15px;">
                        <i class="fas fa-lightbulb" style="color: var(--primary);"></i>
                        <strong style="margin-left: 8px;">Pro Tip:</strong>
                        <p style="margin-top: 8px; font-size: 0.85rem; color: #555;">Promoted ads appear at the top of search results and get up to 5x more views!</p>
                    </div>
                </div>
                <div class="form-actions" style="padding: 15px;">
                    <button class="btn btn-primary close-modal-btn" style="width: 100%;">Got it! ✓</button>
                </div>
            </div>
        `;
        
        this.showModalWithContent('promotion-guide-modal', modalContent);
    }
    
    handleSettingsAction(action) {
        const actions = {
            'share': () => this.shareApp(),
            'rate': () => this.showRatingModal(),
            'portfolio': () => window.open('https://vike-store.netlify.app/', '_blank'),
            'terms': () => this.showTermsPopup(),
            'profile': () => {
                if (typeof window.switchTab === 'function') window.switchTab('account-tab');
                this.showToast('Edit your profile', 'info');
            }
        };
        if (actions[action]) actions[action]();
        else this.showToast('Feature coming soon', 'info');
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
        if (modal) modal.style.display = 'none';
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
    
    showLanguageSelector() {
        const languages = ['English', 'Kiswahili', 'French'];
        let modalContent = `<div class="modal-content" style="z-index: 20002;"><div class="modal-header"><div class="modal-title">Select Language</div><button class="close-modal-btn">&times;</button></div><div class="language-list">`;
        languages.forEach(lang => {
            modalContent += `<div class="language-option" data-lang="${lang}" style="padding: 12px; cursor: pointer; border-bottom: 1px solid var(--grey);">${lang}</div>`;
        });
        modalContent += `</div></div>`;
        
        this.showModalWithContent('language-modal', modalContent);
        
        document.querySelectorAll('.language-option').forEach(opt => {
            opt.addEventListener('click', () => {
                this.showToast(`Language changed to ${opt.getAttribute('data-lang')}`, 'success');
                this.closeModal('language-modal');
            });
        });
    }
    
    showModalWithContent(modalId, content) {
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal';
            document.body.appendChild(modal);
        }
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
    }
    
    shareApp() {
        if (navigator.share) {
            navigator.share({ title: 'VikeServe', text: 'Check out VikeServe app!', url: 'https://vikeserve.com' });
        } else {
            navigator.clipboard.writeText('Check out VikeServe app!');
            this.showToast('Link copied!', 'success');
        }
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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    window.moreMenuManager = new MoreMenuManager();
    console.log('✅ More Menu Manager fully loaded with Firestore integration');
});