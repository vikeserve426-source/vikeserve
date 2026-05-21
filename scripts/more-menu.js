// more-menu.js - COMPLETE VERSION with All Features PRESERVED

class MoreMenuManager {
    constructor() {
        this.currentMoreTab = 'education';
        this.init();
    }
    
    init() {
        console.log('More Menu Manager initializing...');
        this.initializeFounderData();
        this.replaceAllTabContent();
        this.setupEventListeners();
        this.loadDataFromStorage();
        console.log('✅ More Menu Manager ready');
    }
    
    initializeFounderData() {
        // Initialize founder data if not exists
        if (!localStorage.getItem('vikeserve_founder_total_stars')) {
            localStorage.setItem('vikeserve_founder_total_stars', '0');
            localStorage.setItem('vikeserve_founder_rating_count', '0');
            localStorage.setItem('vikeserve_founder_rating', '5.0');
        }
        
        // Add welcome announcement if none exist
        if (!localStorage.getItem('vikeserve_announcements')) {
            const defaultAnnouncements = [
                {
                    id: Date.now(),
                    title: '🎉 Welcome to VikeServe!',
                    message: 'Thank you for using VikeServe! We\'re constantly improving to serve you better. Stay tuned for exciting updates!',
                    date: new Date().toISOString(),
                    isRead: false
                },
                {
                    id: Date.now() + 1,
                    title: '✨ New Feature: Ad Promotion',
                    message: 'You can now promote your ads to reach more customers! Check out the "View Packages" button.',
                    date: new Date().toISOString(),
                    isRead: false
                }
            ];
            localStorage.setItem('vikeserve_announcements', JSON.stringify(defaultAnnouncements));
        }
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
            <div style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
                <button class="post-teacher-btn btn btn-primary" style="flex: 1; padding: 12px;"><i class="fas fa-school"></i> Post Teaching Position</button>
                <button class="post-internship-btn btn btn-outline" style="flex: 1; padding: 12px;"><i class="fas fa-briefcase"></i> Post Internship</button>
                <button class="offer-attachment-btn btn btn-outline" style="flex: 1; padding: 12px;"><i class="fas fa-user-graduate"></i> Offer Attachment</button>
                <button class="post-training-btn btn btn-outline" style="flex: 1; padding: 12px;"><i class="fas fa-tools"></i> Offer Training</button>
            </div>
            
            <div style="margin-bottom: 25px;">
                <h3 style="margin-bottom: 10px;"><i class="fas fa-chalkboard-teacher"></i> Teachers Available</h3>
                <div id="teachers-list-container" class="teachers-list">
                    <div class="empty-state" style="text-align: center; padding: 30px; background: var(--light); border-radius: 12px;">
                        <i class="fas fa-chalkboard-teacher" style="font-size: 2rem; color: var(--grey-dark);"></i>
                        <p style="margin-top: 10px;">No teachers available yet.</p>
                        <p style="font-size: 0.8rem; color: var(--grey-dark);">Click "Post Teaching Position" to add a teacher.</p>
                    </div>
                </div>
            </div>
            
            <div style="margin-bottom: 25px;">
                <h3 style="margin-bottom: 10px;"><i class="fas fa-briefcase"></i> Internship Opportunities</h3>
                <div id="internships-list-container" class="internships-list">
                    <div class="empty-state" style="text-align: center; padding: 30px; background: var(--light); border-radius: 12px;">
                        <i class="fas fa-briefcase" style="font-size: 2rem; color: var(--grey-dark);"></i>
                        <p style="margin-top: 10px;">No internships posted yet.</p>
                        <p style="font-size: 0.8rem; color: var(--grey-dark);">Click "Post Internship" to add an opportunity.</p>
                    </div>
                </div>
            </div>
            
            <div style="margin-bottom: 25px;">
                <h3 style="margin-bottom: 10px;"><i class="fas fa-user-graduate"></i> Attachment Positions</h3>
                <div id="attachments-list-container" class="attachments-list">
                    <div class="empty-state" style="text-align: center; padding: 30px; background: var(--light); border-radius: 12px;">
                        <i class="fas fa-user-graduate" style="font-size: 2rem; color: var(--grey-dark);"></i>
                        <p style="margin-top: 10px;">No attachment positions available.</p>
                        <p style="font-size: 0.8rem; color: var(--grey-dark);">Click "Offer Attachment" to add a position.</p>
                    </div>
                </div>
            </div>
            
            <div style="margin-bottom: 25px;">
                <h3 style="margin-bottom: 10px;"><i class="fas fa-tools"></i> Training Programs</h3>
                <div id="training-list-container" class="training-list">
                    <div class="empty-state" style="text-align: center; padding: 30px; background: var(--light); border-radius: 12px;">
                        <i class="fas fa-tools" style="font-size: 2rem; color: var(--grey-dark);"></i>
                        <p style="margin-top: 10px;">No training programs available.</p>
                        <p style="font-size: 0.8rem; color: var(--grey-dark);">Click "Offer Training" to add a program.</p>
                    </div>
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
                <div class="empty-state" style="text-align: center; padding: 40px; background: var(--light); border-radius: 12px;">
                    <i class="fas fa-bell-slash" style="font-size: 2rem; color: var(--grey-dark);"></i>
                    <p style="margin-top: 10px;">No alerts reported yet.</p>
                    <p style="font-size: 0.8rem; color: var(--grey-dark);">Click "Report Community Alert" to share important information.</p>
                </div>
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
                <div class="empty-state" style="text-align: center; padding: 40px; background: var(--light); border-radius: 12px;">
                    <i class="fas fa-comments" style="font-size: 2rem; color: var(--grey-dark);"></i>
                    <p style="margin-top: 10px;">No messages yet.</p>
                    <p style="font-size: 0.8rem; color: var(--grey-dark);">Start a conversation with service providers.</p>
                </div>
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
            
            <div id="payment-safety-content" class="safety-content-active">
                <div style="background: var(--light); padding: 15px; border-radius: 12px; margin-bottom: 10px;">
                    <strong><i class="fas fa-check-circle" style="color: #27ae60;"></i> DO: Meet in person before payment</strong>
                    <p style="margin-top: 5px;">Always verify the service or product quality before making any payments.</p>
                </div>
                <div style="background: var(--light); padding: 15px; border-radius: 12px; margin-bottom: 10px;">
                    <strong><i class="fas fa-times-circle" style="color: #e74c3c;"></i> DON'T: Send money to unknown accounts</strong>
                    <p style="margin-top: 5px;">Avoid sending money to personal accounts without proper verification.</p>
                </div>
            </div>
            
            <div id="personal-safety-content" style="display: none;">
                <div style="background: var(--light); padding: 15px; border-radius: 12px; margin-bottom: 10px;">
                    <strong><i class="fas fa-check-circle" style="color: #27ae60;"></i> Meet in public places</strong>
                    <p style="margin-top: 5px;">Always arrange to meet in well-lit, public areas for the first meeting.</p>
                </div>
                <div style="background: var(--light); padding: 15px; border-radius: 12px; margin-bottom: 10px;">
                    <strong><i class="fas fa-check-circle" style="color: #27ae60;"></i> Tell someone about your meeting</strong>
                    <p style="margin-top: 5px;">Always inform a friend or family member about your meeting plans.</p>
                </div>
            </div>
            
            <div id="home-safety-content" style="display: none;">
                <div style="background: var(--light); padding: 15px; border-radius: 12px; margin-bottom: 10px;">
                    <strong><i class="fas fa-check-circle" style="color: #27ae60;"></i> Verify service providers</strong>
                    <p style="margin-top: 5px;">Always check credentials, reviews, and ratings before allowing anyone into your home.</p>
                </div>
            </div>
            
            <div id="transport-safety-content" style="display: none;">
                <div style="background: var(--light); padding: 15px; border-radius: 12px; margin-bottom: 10px;">
                    <strong><i class="fas fa-check-circle" style="color: #27ae60;"></i> Use registered services</strong>
                    <p style="margin-top: 5px;">Only use registered transport providers with verified credentials.</p>
                </div>
            </div>
            
            <div id="online-safety-content" style="display: none;">
                <div style="background: var(--light); padding: 15px; border-radius: 12px; margin-bottom: 10px;">
                    <strong><i class="fas fa-check-circle" style="color: #27ae60;"></i> Use strong passwords</strong>
                    <p style="margin-top: 5px;">Create unique, strong passwords for your VikeServe account.</p>
                </div>
            </div>
            
            <div id="emergency-safety-content" style="display: none;">
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
    
    getSettingsHTML() {
        let founderRating = localStorage.getItem('vikeserve_founder_rating');
        let founderRatingCount = localStorage.getItem('vikeserve_founder_rating_count');
        let founderTotalStars = localStorage.getItem('vikeserve_founder_total_stars');
        
        if (!founderRating) {
            founderRating = '5.0';
            founderRatingCount = '0';
            founderTotalStars = '0';
            localStorage.setItem('vikeserve_founder_rating', '5.0');
            localStorage.setItem('vikeserve_founder_rating_count', '0');
            localStorage.setItem('vikeserve_founder_total_stars', '0');
        }
        
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
                        <h3 style="margin: 0;">Victor Wanyama</h3>
                        <p style="margin: 0; opacity: 0.9;">Founder & Lead Developer</p>
                    </div>
                </div>
                
                <div style="text-align: center; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 12px; margin-bottom: 15px;">
                    <div style="font-size: 2.5rem; font-weight: bold;" id="founder-total-stars">${parseInt(founderTotalStars).toLocaleString()}</div>
                    <div style="font-size: 0.8rem; opacity: 0.9;">⭐ Total Stars Earned ⭐</div>
                    <div id="founder-star-rating" style="margin: 10px 0;">
                        ${this.generateStarRatingHTML(parseFloat(founderRating))}
                    </div>
                    <div style="font-size: 0.75rem; opacity: 0.8;">⭐ Average Rating: ${founderRating} ⭐</div>
                    <div style="font-size: 0.7rem; opacity: 0.7; margin-top: 5px;">Based on ${parseInt(founderRatingCount).toLocaleString()} community ratings</div>
                </div>
                
                <div style="display: flex; gap: 10px;">
                    <button class="btn rate-founder-btn" style="flex: 1; background: white; color: #764ba2;"><i class="fas fa-star"></i> Rate Founder</button>
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
        
        document.addEventListener('click', (e) => {
            // Education post buttons
            if (e.target.closest('.post-teacher-btn')) this.openModal('teacher-post-modal');
            if (e.target.closest('.post-internship-btn')) this.openModal('internship-post-modal');
            if (e.target.closest('.offer-attachment-btn')) this.openModal('attachment-post-modal');
            if (e.target.closest('.post-training-btn')) this.openModal('training-post-modal');
            
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
            if (e.target.closest('.report-alert-btn')) this.openModal('alert-post-modal');
            
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
            if (e.target.closest('.rate-founder-btn')) {
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
        
        this.loadSavedTeachers();
        this.loadSavedInternships();
        this.loadSavedAttachments();
        this.loadSavedTraining();
        this.loadSavedAlerts();
        this.loadSavedMessages();
    }
    
    showRatingModal() {
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
                    if (index < rating) {
                        s.className = 'fas fa-star';
                    } else {
                        s.className = 'far fa-star';
                    }
                });
            });
            
            star.addEventListener('mouseleave', () => {
                stars.forEach((s, index) => {
                    if (index < selectedRating) {
                        s.className = 'fas fa-star';
                    } else {
                        s.className = 'far fa-star';
                    }
                });
            });
            
            star.addEventListener('click', () => {
                selectedRating = parseInt(star.getAttribute('data-rating'));
                stars.forEach((s, index) => {
                    if (index < selectedRating) {
                        s.className = 'fas fa-star';
                    } else {
                        s.className = 'far fa-star';
                    }
                });
            });
        });
        
        const submitBtn = document.querySelector('#rating-modal .submit-rating-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                if (!selectedRating) {
                    this.showToast('Please select a rating', 'error');
                    return;
                }
                this.submitRating(selectedRating);
                this.closeModal('rating-modal');
            });
        }
        
        const closeBtn = document.querySelector('#rating-modal .close-modal-btn');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal('rating-modal'));
    }
    
    submitRating(rating) {
        // Get current cumulative stars (total stars earned, not average)
        let currentTotalStars = parseInt(localStorage.getItem('vikeserve_founder_total_stars') || '0');
        let currentRatingCount = parseInt(localStorage.getItem('vikeserve_founder_rating_count') || '0');
        
        // Add the new rating to total stars
        const newTotalStars = currentTotalStars + rating;
        const newCount = currentRatingCount + 1;
        
        // Calculate average for display (optional)
        const newAverage = (newTotalStars / newCount).toFixed(1);
        
        // Save to localStorage
        localStorage.setItem('vikeserve_founder_total_stars', newTotalStars.toString());
        localStorage.setItem('vikeserve_founder_rating_count', newCount.toString());
        localStorage.setItem('vikeserve_founder_rating', newAverage);
        
        // Show success message with cumulative info
        this.showToast(`✨ Thanks! You've added ${rating} stars. Founder has ${newTotalStars.toLocaleString()} total stars! ✨`, 'success');
        
        // Update display
        const totalStarsDisplay = document.getElementById('founder-total-stars');
        const ratingCountDisplay = document.getElementById('founder-rating-count');
        const starsDisplay = document.getElementById('founder-star-rating');
        
        if (totalStarsDisplay) totalStarsDisplay.textContent = newTotalStars.toLocaleString();
        if (ratingCountDisplay) ratingCountDisplay.textContent = newCount.toLocaleString();
        if (starsDisplay) starsDisplay.innerHTML = this.generateStarRatingHTML(parseFloat(newAverage));
    }
    
    showFounderProfile() {
        const totalStars = parseInt(localStorage.getItem('vikeserve_founder_total_stars') || '0');
        const ratingCount = parseInt(localStorage.getItem('vikeserve_founder_rating_count') || '0');
        const avgRating = parseFloat(localStorage.getItem('vikeserve_founder_rating') || '5.0');
        
        // Get announcements from localStorage
        const announcements = JSON.parse(localStorage.getItem('vikeserve_announcements') || '[]');
        
        const modalContent = `
            <div class="modal-content" style="max-width: 500px; z-index: 20002;">
                <div class="modal-header">
                    <div class="modal-title"><i class="fas fa-user-tie"></i> Founder's Profile</div>
                    <button class="close-modal-btn">&times;</button>
                </div>
                <div style="padding: 20px; max-height: 60vh; overflow-y: auto;">
                    <!-- Founder Info -->
                    <div style="text-align: center; margin-bottom: 20px;">
                        <div style="width: 100px; height: 100px; background: linear-gradient(135deg, var(--primary), var(--primary-dark)); border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-user-tie" style="font-size: 3rem; color: white;"></i>
                        </div>
                        <h2 style="margin: 0;">Victor Wanyama</h2>
                        <p style="color: var(--grey-dark);">Founder & Lead Developer</p>
                        <div style="background: var(--light); padding: 15px; border-radius: 12px; margin-top: 10px;">
                            <div style="display: flex; justify-content: space-around;">
                                <div>
                                    <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary);">${totalStars.toLocaleString()}</div>
                                    <div style="font-size: 0.7rem;">Total Stars</div>
                                </div>
                                <div>
                                    <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary);">${avgRating}</div>
                                    <div style="font-size: 0.7rem;">⭐ Rating</div>
                                </div>
                                <div>
                                    <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary);">${ratingCount.toLocaleString()}</div>
                                    <div style="font-size: 0.7rem;">Ratings</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Bio -->
                    <div style="background: var(--light); border-radius: 12px; padding: 15px; margin-bottom: 15px;">
                        <h4><i class="fas fa-info-circle"></i> About the Founder</h4>
                        <p style="font-size: 0.85rem; line-height: 1.5;">Victor Wanyama is a passionate full-stack developer dedicated to creating solutions that empower local communities. VikeServe was built to connect service providers with customers in Kenya and across the World.</p>
                    </div>
                    
                    <!-- App Announcements -->
                    <div style="background: var(--light); border-radius: 12px; padding: 15px; margin-bottom: 15px;">
                        <h4><i class="fas fa-megaphone"></i> App Updates & Announcements</h4>
                        <div id="announcements-list">
                            ${announcements.length === 0 ? '<p style="text-align: center; color: var(--grey-dark); font-size: 0.8rem;">No announcements yet. Check back soon!</p>' : ''}
                            ${announcements.map(announcement => `
                                <div style="border-bottom: 1px solid var(--grey); padding: 10px 0;">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <strong style="font-size: 0.85rem;">${this.escapeHtml(announcement.title)}</strong>
                                        <span style="font-size: 0.65rem; color: var(--grey-dark);">${this.formatDate(announcement.date)}</span>
                                    </div>
                                    <p style="font-size: 0.75rem; margin-top: 5px; color: #666;">${this.escapeHtml(announcement.message)}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <!-- Social Links -->
                    <div style="background: var(--light); border-radius: 12px; padding: 15px;">
                        <h4><i class="fas fa-link"></i> Connect</h4>
                        <div style="display: flex; gap: 15px; justify-content: center; margin-top: 10px;">
                            <a href="#" class="founder-social" data-platform="github" style="color: var(--dark); text-decoration: none; font-size: 1.5rem;"><i class="fab fa-github"></i></a>
                            <a href="#" class="founder-social" data-platform="linkedin" style="color: var(--dark); text-decoration: none; font-size: 1.5rem;"><i class="fab fa-linkedin"></i></a>
                            <a href="#" class="founder-social" data-platform="twitter" style="color: var(--dark); text-decoration: none; font-size: 1.5rem;"><i class="fab fa-twitter"></i></a>
                            <a href="#" class="founder-social" data-platform="portfolio" style="color: var(--dark); text-decoration: none; font-size: 1.5rem;"><i class="fas fa-briefcase"></i></a>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.showModalWithContent('founder-profile-modal', modalContent);
        
        setTimeout(() => {
            const closeBtn = document.querySelector('#founder-profile-modal .close-modal-btn');
            if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal('founder-profile-modal'));
            
            document.querySelectorAll('.founder-social').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const platform = link.getAttribute('data-platform');
                    // UPDATED: Your actual portfolio URL
                    const urls = {
                        github: 'https://github.com/yourusername',
                        linkedin: 'https://linkedin.com/in/yourusername',
                        twitter: 'https://twitter.com/yourusername',
                        portfolio: 'https://vike-store.netlify.app/'  // Your actual portfolio link
                    };
                    if (urls[platform]) window.open(urls[platform], '_blank');
                });
            });
        }, 100);
    }
    
    sendFounderAnnouncement(title, message) {
        const announcements = JSON.parse(localStorage.getItem('vikeserve_announcements') || '[]');
        announcements.unshift({
            id: Date.now(),
            title: title,
            message: message,
            date: new Date().toISOString(),
            isRead: false
        });
        // Keep only last 20 announcements
        if (announcements.length > 20) announcements.pop();
        localStorage.setItem('vikeserve_announcements', JSON.stringify(announcements));
        this.showToast('📢 Announcement sent to all users!', 'success');
    }
    
    showTermsPopup() {
        const modalContent = `
            <div class="modal-content" style="max-width: 500px; z-index: 20002;">
                <div class="modal-header">
                    <div class="modal-title">Terms of Service</div>
                    <button class="close-modal-btn">&times;</button>
                </div>
                <div style="padding: 15px; max-height: 60vh; overflow-y: auto;">
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
                </div>
                <div class="form-actions">
                    <button class="btn btn-primary close-modal-btn">I Understand</button>
                </div>
            </div>
        `;
        
        this.showModalWithContent('terms-modal', modalContent);
        
        const closeBtn = document.querySelector('#terms-modal .close-modal-btn');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal('terms-modal'));
    }
    
    openPortfolio() {
        window.open('https://vike-store.netlify.app/', '_blank');  // UPDATED: Your actual portfolio link
    }

    showAdPromotionGuide() {
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
                            <div><strong>Navigate to Promotion Options</strong></div>
                        </div>
                        <p style="margin-left: 42px; color: #666; font-size: 0.9rem;">On your ad listing page, tap the <strong>"Promote"</strong> button or go to the <strong>"Post an Ad"</strong> / <strong>"View Packages"</strong> buttons.</p>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px;">
                            <div style="width: 30px; height: 30px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">5</div>
                            <div><strong>Select Your Promotion Package</strong></div>
                        </div>
                        <p style="margin-left: 42px; color: #666; font-size: 0.9rem;">Choose from our available packages:</p>
                        <ul style="margin-left: 60px; color: #666; font-size: 0.85rem;">
                            <li>⭐ <strong>Basic Boost (3 days)</strong> - KES 100</li>
                            <li>⭐ <strong>Premium Reach (7 days)</strong> - KES 250</li>
                            <li>⭐ <strong>Pro Featured (14 days)</strong> - KES 500</li>
                            <li>⭐ <strong>VIP Spotlight (30 days)</strong> - KES 1000</li>
                        </ul>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px;">
                            <div style="width: 30px; height: 30px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">6</div>
                            <div><strong>Configure Ad Action</strong></div>
                        </div>
                        <p style="margin-left: 42px; color: #666; font-size: 0.9rem;">Choose what happens when someone clicks your ad:</p>
                        <ul style="margin-left: 60px; color: #666; font-size: 0.85rem;">
                            <li>📞 <strong>Phone Call</strong> - Direct call to your number</li>
                            <li>💬 <strong>WhatsApp</strong> - Start a WhatsApp chat</li>
                            <li>✉️ <strong>Email</strong> - Send an email inquiry</li>
                            <li>🔗 <strong>Website Link</strong> - Redirect to your website</li>
                        </ul>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px;">
                            <div style="width: 30px; height: 30px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">7</div>
                            <div><strong>Complete Payment</strong></div>
                        </div>
                        <p style="margin-left: 42px; color: #666; font-size: 0.9rem;">Select your preferred payment method:</p>
                        <ul style="margin-left: 60px; color: #666; font-size: 0.85rem;">
                            <li>💰 <strong>M-Pesa</strong> (Kenya)</li>
                            <li>💰 <strong>Airtel Money</strong> (Kenya/Uganda)</li>
                            <li>💰 <strong>MTN Mobile Money</strong> (Uganda)</li>
                            <li>💳 <strong>Credit/Debit Card</strong> (Global)</li>
                            <li>🌍 <strong>PayPal</strong> (Global)</li>
                        </ul>
                        <p style="margin-left: 42px; color: #666; font-size: 0.85rem; margin-top: 8px;">For M-Pesa/Airtel, you'll receive a prompt on your phone to enter your PIN.</p>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px;">
                            <div style="width: 30px; height: 30px; background: var(--success); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">✓</div>
                            <div><strong>Ad Activation</strong></div>
                        </div>
                        <p style="margin-left: 42px; color: #666; font-size: 0.9rem;">Once payment is confirmed, your ad will be promoted immediately! A <strong>"PROMOTED"</strong> badge will appear on your listing.</p>
                    </div>
                    
                    <div style="background: #e8f4fd; border-radius: 10px; padding: 15px; margin-top: 15px;">
                        <i class="fas fa-lightbulb" style="color: var(--primary);"></i>
                        <strong style="margin-left: 8px;">Pro Tip:</strong>
                        <p style="margin-top: 8px; font-size: 0.85rem; color: #555;">Promoted ads appear at the top of search results and get up to 5x more views! Choose a longer package for better visibility and ROI.</p>
                    </div>
                </div>
                <div class="form-actions" style="padding: 15px;">
                    <button class="btn btn-primary close-modal-btn" style="width: 100%;">Got it! ✓</button>
                </div>
            </div>
        `;
        
        this.showModalWithContent('promotion-guide-modal', modalContent);
        
        const closeBtn = document.querySelector('#promotion-guide-modal .close-modal-btn');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal('promotion-guide-modal'));
    }
    
    handleSettingsAction(action) {
        const actions = {
            'share': () => this.shareApp(),
            'rate': () => this.showRatingModal(),
            'portfolio': () => window.open('https://vike-store.netlify.app/', '_blank'),  // UPDATED: Your actual portfolio link
            'terms': () => this.showTermsPopup(),
            'profile': () => {
                if (typeof window.switchTab === 'function') window.switchTab('account-tab');
                this.showToast('Edit your profile', 'info');
            }
        };
        if (actions[action]) actions[action]();
        else this.showToast('Feature coming soon', 'info');
    }
    
    switchSafetyCategory(cat) {
        document.querySelectorAll('[id$="-safety-content"]').forEach(content => {
            content.style.display = 'none';
        });
        const selectedContent = document.getElementById(`${cat}-safety-content`);
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
    
    switchMoreTab(tabId) {
        console.log('Switching to tab:', tabId);
        this.currentMoreTab = tabId;
        
        document.querySelectorAll('.more-tab-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`.more-tab-btn[data-more-tab="${tabId}"]`);
        if (activeBtn) activeBtn.classList.add('active');
        
        document.querySelectorAll('.more-tab-content').forEach(content => content.classList.remove('active'));
        const targetContent = document.getElementById(`${tabId}-content`);
        if (targetContent) targetContent.classList.add('active');
        
        if (tabId === 'messages') this.loadSavedMessages();
        if (tabId === 'alerts') this.loadSavedAlerts();
    }
    
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            modal.style.zIndex = '20002';  // FIXED: Increased z-index so modals appear on top
            
            const closeBtn = modal.querySelector('.close-modal-btn');
            if (closeBtn) {
                const newCloseBtn = closeBtn.cloneNode(true);
                closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
                newCloseBtn.addEventListener('click', () => modal.style.display = 'none');
            }
            
            const cancelBtn = modal.querySelector('.btn-outline');
            if (cancelBtn) {
                const newCancelBtn = cancelBtn.cloneNode(true);
                cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
                newCancelBtn.addEventListener('click', () => modal.style.display = 'none');
            }
        } else {
            this.showToast('Form not available yet', 'info');
        }
    }
    
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'none';
    }
    
    startNewChat() {
        this.showToast('Starting new chat session...', 'info');
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
        
        const closeBtn = document.querySelector('#language-modal .close-modal-btn');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal('language-modal'));
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
        modal.style.zIndex = '20002';  // FIXED: Increased z-index
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
        if (!timestamp) return 'Date unknown';
        let date;
        if (typeof timestamp === 'string') date = new Date(timestamp);
        else if (timestamp.toDate) date = timestamp.toDate();
        else date = new Date(timestamp);
        if (isNaN(date.getTime())) return 'Invalid date';
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const postDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const diffDays = Math.floor((today - postDate) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }
    
    renderTeachers(teachers) {
        const container = document.getElementById('teachers-list-container');
        if (!container) return;
        if (!teachers || teachers.length === 0) {
            container.innerHTML = `<div class="empty-state" style="text-align: center; padding: 30px;"><i class="fas fa-chalkboard-teacher" style="font-size: 2rem;"></i><p>No teachers available yet.</p></div>`;
            return;
        }
        container.innerHTML = teachers.map(teacher => `
            <div class="teacher-card" style="background: white; border-radius: 10px; padding: 12px; margin-bottom: 10px; display: flex; align-items: center; gap: 12px;">
                <div style="width: 45px; height: 45px; background: linear-gradient(135deg, var(--primary), var(--primary-dark)); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">${teacher.avatar || teacher.name.charAt(0)}</div>
                <div style="flex: 1;"><div style="font-weight: 600;">${this.escapeHtml(teacher.name)}</div><div style="font-size: 0.8rem; color: #666;">${this.escapeHtml(teacher.subject)} • ${this.escapeHtml(teacher.level)}</div><div style="font-size: 0.7rem; color: #999;">Posted: ${this.formatDate(teacher.timestamp)}</div></div>
            </div>
        `).join('');
    }
    
    renderAlerts(alerts) {
        const container = document.getElementById('alerts-list-container');
        if (!container) return;
        if (!alerts || alerts.length === 0) {
            container.innerHTML = `<div class="empty-state" style="text-align: center; padding: 40px;"><i class="fas fa-bell-slash" style="font-size: 2rem;"></i><p>No alerts reported yet.</p></div>`;
            return;
        }
        container.innerHTML = alerts.map(alert => `
            <div class="alert-card" data-type="${alert.type}" style="background: white; border-radius: 12px; padding: 15px; margin-bottom: 15px; border-left: 4px solid ${alert.type === 'emergency' ? '#e74c3c' : '#f39c12'};">
                <div style="display: flex; justify-content: space-between;"><strong>${this.escapeHtml(alert.title)}</strong><span style="font-size: 0.7rem;">${this.formatDate(alert.timestamp)}</span></div>
                <div style="font-size: 0.9rem; margin: 8px 0;">${this.escapeHtml(alert.description)}</div>
                <div style="font-size: 0.8rem;"><i class="fas fa-map-marker-alt"></i> ${this.escapeHtml(alert.location)}</div>
                ${alert.urgent ? '<div style="margin-top: 8px;"><span style="background: #e74c3c; color: white; padding: 2px 8px; border-radius: 12px;">URGENT</span></div>' : ''}
            </div>
        `).join('');
    }
    
    renderInternships(internships) { this.renderSimpleList('internships-list-container', internships, 'internship'); }
    renderAttachments(attachments) { this.renderSimpleList('attachments-list-container', attachments, 'attachment'); }
    renderTraining(trainings) { this.renderSimpleList('training-list-container', trainings, 'training'); }
    
    renderSimpleList(containerId, items, type) {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (!items || items.length === 0) {
            container.innerHTML = `<div class="empty-state"><i class="fas fa-${type === 'internship' ? 'briefcase' : type === 'attachment' ? 'user-graduate' : 'tools'}" style="font-size: 2rem;"></i><p>No ${type}s available.</p></div>`;
            return;
        }
        container.innerHTML = items.map(item => `<div style="background: white; border-radius: 10px; padding: 12px; margin-bottom: 10px;"><div style="font-weight: 600;">${this.escapeHtml(item.title)}</div><div style="font-size: 0.8rem; color: #666;">${this.escapeHtml(item.company || item.organization || item.provider)}</div><div style="font-size: 0.7rem; color: #999;">Posted: ${this.formatDate(item.timestamp)}</div></div>`).join('');
    }
    
    loadSavedMessages() {
        const container = document.getElementById('conversations-list-container');
        if (!container) return;
        container.innerHTML = `<div class="empty-state" style="text-align: center; padding: 40px;"><i class="fas fa-comments" style="font-size: 2rem;"></i><p>No messages yet.</p></div>`;
    }
    
    loadSavedTeachers() { this.loadAndRender('vikeserve_teachers', this.renderTeachers.bind(this)); }
    loadSavedInternships() { this.loadAndRender('vikeserve_internships', this.renderInternships.bind(this)); }
    loadSavedAttachments() { this.loadAndRender('vikeserve_attachments', this.renderAttachments.bind(this)); }
    loadSavedTraining() { this.loadAndRender('vikeserve_training', this.renderTraining.bind(this)); }
    loadSavedAlerts() { this.loadAndRender('vikeserve_alerts', this.renderAlerts.bind(this)); }
    
    loadAndRender(key, renderFn) {
        const saved = localStorage.getItem(key);
        const data = saved ? JSON.parse(saved) : [];
        renderFn(data);
    }
    
    loadDataFromStorage() {
        this.loadSavedTeachers();
        this.loadSavedInternships();
        this.loadSavedAttachments();
        this.loadSavedTraining();
        this.loadSavedAlerts();
        this.loadSavedMessages();
    }
    
    submitTeacherPost(event) { this.submitPost(event, 'vikeserve_teachers', 'teacher-post-modal', 'Teaching position posted successfully!'); }
    submitInternshipPost(event) { this.submitPost(event, 'vikeserve_internships', 'internship-post-modal', 'Internship posted successfully!'); }
    submitAttachmentPost(event) { this.submitPost(event, 'vikeserve_attachments', 'attachment-post-modal', 'Attachment position posted successfully!'); }
    submitTrainingPost(event) { this.submitPost(event, 'vikeserve_training', 'training-post-modal', 'Training program posted successfully!'); }
    submitAlertPost(event) { this.submitPost(event, 'vikeserve_alerts', 'alert-post-modal', 'Alert reported successfully!'); }
    
    submitPost(event, storageKey, modalId, successMsg) {
        event.preventDefault();
        const inputs = event.target.closest('.modal').querySelectorAll('input, select, textarea');
        const data = { id: Date.now(), timestamp: new Date().toISOString() };
        inputs.forEach(input => { if (input.id) data[input.id.replace(modalId.replace('-modal', ''), '').replace(/^[a-z]+-/, '')] = input.value; });
        const saved = localStorage.getItem(storageKey);
        const items = saved ? JSON.parse(saved) : [];
        items.unshift(data);
        localStorage.setItem(storageKey, JSON.stringify(items));
        this.showToast(successMsg, 'success');
        this.closeModal(modalId);
        if (storageKey === 'vikeserve_teachers') this.loadSavedTeachers();
        else if (storageKey === 'vikeserve_internships') this.loadSavedInternships();
        else if (storageKey === 'vikeserve_attachments') this.loadSavedAttachments();
        else if (storageKey === 'vikeserve_training') this.loadSavedTraining();
        else if (storageKey === 'vikeserve_alerts') this.loadSavedAlerts();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    window.moreMenuManager = new MoreMenuManager();
    console.log('✅ More Menu Manager fully loaded');
});