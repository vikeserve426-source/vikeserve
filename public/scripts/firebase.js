// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCKLTSRDBJuYjoqu0Mqmyuf2qo2xRYC0R8",
    authDomain: "vikeserve-fb1db.firebaseapp.com",
    projectId: "vikeserve-fb1db",
    storageBucket: "vikeserve-fb1db.firebasestorage.app",
    messagingSenderId: "1004797571845",
    appId: "1:1004797571845:web:1a1ee61c8c018e9d7afd6c"
};

// Initialize Firebase first
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Collection references - COMPLETE VERSIONn
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

// Global variables
let currentUser = null;
let selectedCountry = "Kenya";
let selectedLanguage = "en";

console.log("Firebase initialized successfully!");

// Export everything to global scope
window.firebaseApp = app;
window.firebaseAuth = auth;
window.firebaseDb = db;
window.firebaseStorage = storage;
window.firebaseCollections = collections;

// Aliases for backward compatibility
window.db = db;
window.auth = auth;
window.storage = storage;
window.collections = collections;
window.currentUser = currentUser;

// Initialize app
initializeApp();

async function initializeApp() {
    try {
        console.log("Initializing app...");
        
        // Set up auth state listener
        auth.onAuthStateChanged(async (user) => {
            currentUser = user;
            window.currentUser = user; // Update global reference
            
            if (user) {
                console.log("User signed in:", user.email);
                await ensureUserProfile(user);
            } else {
                console.log("User signed out");
            }
            
            // Update UI
            if (typeof updateAuthUI === 'function') {
                updateAuthUI();
            }
        });
        
    } catch (error) {
        console.error("App initialization error:", error);
    }
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
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log("New user profile created");
        }
    } catch (error) {
        console.error("Error ensuring user profile:", error);
    }
}

// Utility function
function showErrorToUser(message) {
    console.error("User Error:", message);
    if (typeof showToast === 'function') {
        showToast(message, 'error');
    } else {
        alert(message);
    }
}

window.showErrorToUser = showErrorToUser;