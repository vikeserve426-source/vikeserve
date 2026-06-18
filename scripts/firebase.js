const firebaseConfig = {
    apiKey: "AIzaSyCKLTSRDBJuYjoqu0Mqmyuf2qo2xRYC0R8",
    authDomain: "vikeserve-fb1db.firebaseapp.com",
    projectId: "vikeserve-fb1db",
    storageBucket: "vikeserve-fb1db.firebasestorage.app",
    messagingSenderId: "1004797571845",
    appId: "1:1004797571845:web:1a1ee61c8c018e9d7afd6c"
};

const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

const collections = {
    users: () => db.collection('users'),
    services: () => db.collection('services'),
    serviceCategories: () => db.collection('service_categories'),
    serviceProviders: () => db.collection('service_providers'),
    serviceRequests: () => db.collection('service_requests'),
    marketplaceItems: () => db.collection('marketplace_items'),
    marketplaceCategories: () => db.collection('marketplace_categories'),
    sellers: () => db.collection('sellers'),
    propertyListings: () => db.collection('property_listings'),
    propertyTypes: () => db.collection('property_types'),
    healthServices: () => db.collection('health_services'),
    healthProviders: () => db.collection('health_providers'),
    emergencyContacts: () => db.collection('emergency_contacts'),
    healthAlerts: () => db.collection('health_alerts'),
    teachers: () => db.collection('teachers'),
    internships: () => db.collection('internships'),
    attachments: () => db.collection('attachments'),
    trainingCourses: () => db.collection('training_courses'),
    communityAlerts: () => db.collection('community_alerts'),
    incidentReports: () => db.collection('incident_reports'),
    communityEvents: () => db.collection('community_events'),
    bookings: () => db.collection('bookings'),
    payments: () => db.collection('payments'),
    transactions: () => db.collection('transactions'),
    reviews: () => db.collection('reviews'),
    ratings: () => db.collection('ratings'),
    verifications: () => db.collection('verifications'),
    ussdSessions: () => db.collection('ussd_sessions'),
    ads: () => db.collection('ads'),
    adPackages: () => db.collection('ad_packages'),
    promotedAds: () => db.collection('promoted_ads'),
    chats: () => db.collection('chats'),
    messages: () => db.collection('messages'),
    adminLogs: () => db.collection('admin_logs'),
    systemSettings: () => db.collection('system_settings'),
    featureToggles: () => db.collection('feature_toggles'),
    notifications: () => db.collection('notifications'),
    reviewRequests: () => db.collection('review_requests'),
    bookingChats: () => db.collection('booking_chats'),
    housing: () => db.collection('housing'),
    favorites: () => db.collection('favorites'),
    fileUploads: () => db.collection('file_uploads'),
    chatMessages: (chatId) => db.collection('chats').doc(chatId).collection('messages')
};

let currentUser = null;
let selectedCountry = localStorage.getItem('vikeserve_country') || "Kenya";
let selectedLanguage = localStorage.getItem('vikeserve_language') || "en";

console.log("Firebase initialized successfully!");

// ========== REMOTE CONFIG (Feature Toggles) ==========
const remoteConfig = firebase.remoteConfig();

// Set default values (used when offline or before fetch)
remoteConfig.defaultConfig = {
    // Feature toggles - set to false to disable features
    'feature_adPromotion': 'false',        // Ad promotion (View Packages, Promote buttons)
    'feature_wifiConnect': 'false',        // VikeServe Connect (WiFi reselling)
    'feature_showComingSoon': 'true',      // Show "Coming Soon" badges
    
    // Main features (always enabled)
    'feature_marketplace': 'true',
    'feature_services': 'true',
    'feature_bookings': 'true',
    'feature_chat': 'true',
    'feature_reviews': 'true',
    'feature_alerts': 'true',
    'feature_education': 'true',
    'feature_safety': 'true',
    'feature_settings': 'true'
};

// Fetch and activate remote config
remoteConfig.fetchAndActivate()
    .then(() => {
        console.log('✅ Remote Config loaded successfully');
        // Dispatch event to notify app that remote config is ready
        window.dispatchEvent(new Event('remoteConfigReady'));
    })
    .catch(error => {
        console.error('Error loading remote config:', error);
    });

// Helper function to check if a feature is enabled
function isFeatureEnabled(featureKey) {
    try {
        const value = remoteConfig.getValue(featureKey);
        return value.asBoolean();
    } catch (error) {
        console.warn('Remote config not available, using default:', featureKey);
        // Fallback defaults
        const defaults = {
            'feature_adPromotion': false,
            'feature_wifiConnect': false,
            'feature_showComingSoon': true,
            'feature_marketplace': true,
            'feature_services': true,
            'feature_bookings': true,
            'feature_chat': true,
            'feature_reviews': true,
            'feature_alerts': true,
            'feature_education': true,
            'feature_safety': true,
            'feature_settings': true
        };
        return defaults[featureKey] || false;
    }
}

// Get all feature toggles at once (useful for debugging)
function getAllFeatures() {
    const features = {};
    const keys = [
        'feature_adPromotion',
        'feature_wifiConnect',
        'feature_showComingSoon',
        'feature_marketplace',
        'feature_services',
        'feature_bookings',
        'feature_chat',
        'feature_reviews',
        'feature_alerts',
        'feature_education',
        'feature_safety',
        'feature_settings'
    ];
    keys.forEach(key => {
        features[key] = isFeatureEnabled(key);
    });
    return features;
}

// Export to global
window.remoteConfig = remoteConfig;
window.isFeatureEnabled = isFeatureEnabled;
window.getAllFeatures = getAllFeatures;

console.log('✅ Remote Config initialized');

// ========== USER PREFERENCES ==========
function saveUserPreferences(country, language) {
    selectedCountry = country;
    selectedLanguage = language;
    localStorage.setItem('vikeserve_country', country);
    localStorage.setItem('vikeserve_language', language);
    console.log('Preferences saved:', { country, language });
}
window.saveUserPreferences = saveUserPreferences;

function getCurrentUserId() {
    return currentUser ? currentUser.uid : null;
}
window.getCurrentUserId = getCurrentUserId;

function isAuthenticated() {
    return !!currentUser;
}
window.isAuthenticated = isAuthenticated;

let cachedUserRole = null;

async function getUserRole() {
    if (!currentUser) return null;
    if (cachedUserRole) return cachedUserRole;
    
    try {
        const userDoc = await collections.users().doc(currentUser.uid).get();
        cachedUserRole = userDoc.exists ? userDoc.data().role : 'general-user';
        return cachedUserRole;
    } catch (error) {
        console.error("Error getting user role:", error);
        return 'general-user';
    }
}
window.getUserRole = getUserRole;

function clearUserCache() {
    cachedUserRole = null;
    console.log('User cache cleared');
}
window.clearUserCache = clearUserCache;

function getCurrentPreferences() {
    return {
        country: selectedCountry,
        language: selectedLanguage
    };
}
window.getCurrentPreferences = getCurrentPreferences;

async function updateUserLocation(userId, locationData) {
    if (!userId) return false;
    try {
        await collections.users().doc(userId).update({
            location: locationData,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error('Error updating location:', error);
        return false;
    }
}
window.updateUserLocation = updateUserLocation;

async function logoutAndCleanup() {
    try {
        clearUserCache();
        await firebase.auth().signOut();
        console.log('User signed out and cache cleared');
        return true;
    } catch (error) {
        console.error('Logout error:', error);
        return false;
    }
}
window.logoutAndCleanup = logoutAndCleanup;

window.firebaseApp = app;
window.firebaseAuth = auth;
window.firebaseDb = db;
window.firebaseStorage = storage;
window.firebaseCollections = collections;

window.db = db;
window.auth = auth;
window.storage = storage;
window.collections = collections;
window.currentUser = currentUser;

initializeApp();

async function initializeApp() {
    try {
        console.log("Initializing app...");
        
        auth.onAuthStateChanged(async (user) => {
            currentUser = user;
            window.currentUser = user;

            if (!user) {
                if (typeof window.clearUserCache === 'function') {
                    window.clearUserCache();
                }
            }
            
            if (user) {
                console.log("User signed in:", user.email);
                await ensureUserProfile(user);
            } else {
                console.log("User signed out");
            }
            
            if (typeof updateAuthUI === 'function') {
                updateAuthUI();
            }
            
            window.dispatchEvent(new CustomEvent('authStateChanged', { 
                detail: { user: user, isLoggedIn: !!user } 
            }));
        });
        
    } catch (error) {
        console.error("App initialization error:", error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initializeApp());
} else {
    initializeApp();
}

async function ensureUserProfile(user) {
    try {
        const userDoc = await collections.users().doc(user.uid).get();
        
        if (!userDoc.exists) {
            await collections.users().doc(user.uid).set({
                uid: user.uid,
                displayName: user.displayName || 'User',
                email: user.email,
                role: 'general-user',
                country: selectedCountry,
                language: selectedLanguage,
                points: 0,
                totalPointsEarned: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log("New user profile created with points");
        } else {
            // Ensure points field exists for existing users
            const userData = userDoc.data();
            if (userData.points === undefined) {
                await collections.users().doc(user.uid).update({
                    points: 0,
                    totalPointsEarned: userData.totalPointsEarned || 0
                });
            }
            await collections.users().doc(user.uid).update({
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(() => {});
        }
    } catch (error) {
        console.error("Error ensuring user profile:", error);
    }
}

function showErrorToUser(message) {
    console.error("User Error:", message);
    if (typeof showToast === 'function') {
        showToast(message, 'error');
    } else {
        alert(message);
    }
}

window.showErrorToUser = showErrorToUser;