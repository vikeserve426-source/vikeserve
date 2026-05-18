if (typeof window.showToast !== 'function') {
    window.showToast = console.log;
}
if (typeof window.showModalWithContent !== 'function') {
    window.showModalWithContent = function(id, content) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = content;
        document.body.appendChild(modal);
        modal.style.display = 'block';
    };
}

class BookingsManager {
    constructor() {
        this.db = db;
        this.storage = storage;
        this.currentListeners = {};
        
        // Use the new collection system - FIXED: Remove firebaseCollections prefix
        this.bookingsCollection = collections.bookings();
        this.usersCollection = collections.users();
        this.servicesCollection = collections.services();
        this.paymentsCollection = collections.payments();
        this.notificationsCollection = collections.notifications();
        this.reviewsCollection = collections.reviews();
        this.reviewRequestsCollection = collections.reviewRequests();
        this.bookingChatsCollection = collections.bookingChats();
    }

    // Create a new booking
    async createBooking(bookingData) {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('User must be logged in to create a booking');

            // Check provider availability
            if (bookingData.providerId && bookingData.date && bookingData.time) {
                const isAvailable = await this.checkProviderAvailability(
                    bookingData.providerId, 
                    bookingData.date, 
                    bookingData.time
                );
                
                if (!isAvailable) {
                    return { 
                        success: false, 
                        error: 'Provider is not available at the selected time' 
                    };
                }
            }

            const bookingWithMetadata = {
                ...bookingData,
                customerId: user.uid,
                customerName: user.displayName || user.email,
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                paymentStatus: 'pending'
            };

            // Use collections pattern
            const docRef = await this.bookingsCollection.add(bookingWithMetadata);
            
            // Notify the service provider about the new booking
            if (bookingData.providerId) {
                await this.notifyProvider(bookingData.providerId, docRef.id);
            }
            
            // Create chat for this booking
            await this.createBookingChat(docRef.id, [user.uid, bookingData.providerId]);
            
            return { success: true, id: docRef.id };
        } catch (error) {
            console.error('Error creating booking:', error);
            return { success: false, error: error.message };
        }
    }

    // Check provider availability
    async checkProviderAvailability(providerId, date, time) {
        try {

            const snapshot = await this.bookingsCollection
                .where('providerId', '==', providerId)
                .where('date', '==', date)
                .where('time', '==', time)
                .where('status', 'in', ['pending', 'confirmed', 'in_progress'])
                .get();
            
            if (!snapshot.empty) {
                return false;
            }
            

            const providerDoc = await this.usersCollection.doc(providerId).get();
            if (providerDoc.exists) {
                const providerData = providerDoc.data();
                if (providerData.availability && providerData.availability[date]) {
                    return providerData.availability[date].includes(time);
                }
            }
            
            return true; // Default to available if no schedule set
        } catch (error) {
            console.error('Error checking provider availability:', error);
            return true; // Assume available on error
        }
    }

    // Get user bookings with filters and pagination
    async getUserBookings(userId, filters = {}, limit = 20, startAfter = null) {
        try {
            let query;
            
            if (filters.role === 'customer') {
                query = this.bookingsCollection
                    .where('customerId', '==', userId);
            } else if (filters.role === 'provider') {
                query = this.bookingsCollection
                    .where('providerId', '==', userId);
            } else {
                const customerBookings = await this.bookingsCollection
                    .where('customerId', '==', userId)
                    .get();
                    
                const providerBookings = await this.bookingsCollection
                    .where('providerId', '==', userId)
                    .get();
                    
                const bookings = [
                    ...customerBookings.docs.map(doc => ({ 
                        id: doc.id, 
                        ...doc.data(), 
                        role: 'customer' 
                    })),
                    ...providerBookings.docs.map(doc => ({ 
                        id: doc.id, 
                        ...doc.data(), 
                        role: 'provider' 
                    }))
                ];
                
                // Apply filters
                let filteredBookings = bookings;
                if (filters.status) {
                    filteredBookings = filteredBookings.filter(b => b.status === filters.status);
                }
                if (filters.date) {
                    filteredBookings = filteredBookings.filter(b => b.date === filters.date);
                }
                
                // Sort by date
                filteredBookings.sort((a, b) => new Date(b.createdAt?.toDate()) - new Date(a.createdAt?.toDate()));
                return limit ? filteredBookings.slice(0, limit) : filteredBookings;
            }
            
            // Apply filters to Firestore query
            if (filters.status) {
                query = query.where('status', '==', filters.status);
            }
            if (filters.date) {
                query = query.where('date', '==', filters.date);
            }
            
            if (startAfter) {
                query = query.startAfter(startAfter);
            }

            const snapshot = await query
                .orderBy('createdAt', 'desc')
                .limit(limit)
                .get();
                
            const lastVisible = snapshot.docs[snapshot.docs.length - 1];
            const bookings = snapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data(), 
                role: filters.role 
            }));
            
            return { bookings, lastVisible };
        } catch (error) {
            console.error('Error getting user bookings:', error);
            return { bookings: [], lastVisible: null };
        }
    }

    // Get booking details with enriched information
    async getBookingDetails(bookingId) {
        try {
            const bookingDoc = await this.bookingsCollection.doc(bookingId).get();
            if (!bookingDoc.exists) {
                throw new Error('Booking not found');
            }
            
            const booking = { id: bookingDoc.id, ...bookingDoc.data() };
            
            if (booking.customerId) {
                const customerDoc = await this.usersCollection.doc(booking.customerId).get();
                if (customerDoc.exists) {
                    booking.customer = customerDoc.data();
                }
            }
            
            // Get provider details
            if (booking.providerId) {
                const providerDoc = await this.usersCollection.doc(booking.providerId).get();
                if (providerDoc.exists) {
                    booking.provider = providerDoc.data();
                }
            }
            
            if (booking.serviceId) {
                const serviceDoc = await this.servicesCollection.doc(booking.serviceId).get();
                if (serviceDoc.exists) {
                    booking.service = serviceDoc.data();
                }
            }
            
            // Get latest messages
            booking.messages = await this.getBookingMessages(bookingId, 10);
            
            if (booking.paymentId) {
                const paymentDoc = await this.paymentsCollection.doc(booking.paymentId).get();
                if (paymentDoc.exists) {
                    booking.payment = paymentDoc.data();
                }
            }
            
            return booking;
        } catch (error) {
            console.error('Error getting booking details:', error);
            throw error;
        }
    }

    // Update booking status
    async updateBookingStatus(bookingId, status, notes = null) {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('User must be logged in to update booking status');

            const bookingDoc = await this.bookingsCollection.doc(bookingId).get();
            if (!bookingDoc.exists) {
                throw new Error('Booking not found');
            }

            const booking = bookingDoc.data();
            
            // Verify user has permission to update status
            if (booking.customerId !== user.uid && booking.providerId !== user.uid) {
                throw new Error('You do not have permission to update this booking');
            }

            const updates = {
                status,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            if (notes) {
                updates.notes = notes;
                updates.lastNoteBy = user.uid;
                updates.lastNoteAt = firebase.firestore.FieldValue.serverTimestamp();
            }
            
            // Add timestamps for status changes
            if (status === 'confirmed') {
                updates.confirmedAt = firebase.firestore.FieldValue.serverTimestamp();
                updates.confirmedBy = user.uid;
            } else if (status === 'in_progress') {
                updates.startedAt = firebase.firestore.FieldValue.serverTimestamp();
                updates.startedBy = user.uid;
            } else if (status === 'completed') {
                updates.completedAt = firebase.firestore.FieldValue.serverTimestamp();
                updates.completedBy = user.uid;
            } else if (status === 'cancelled') {
                updates.cancelledAt = firebase.firestore.FieldValue.serverTimestamp();
                updates.cancelledBy = user.uid;
                updates.cancellationReason = notes || 'No reason provided';
            }
            
            await this.bookingsCollection.doc(bookingId).update(updates);
            
            // Notify the other party about status change
            if (status === 'confirmed') {
                await this.notifyCustomer(booking.customerId, bookingId, 'confirmed');
            } else if (status === 'cancelled') {
                const notifyUserId = user.uid === booking.customerId ? 
                    booking.providerId : booking.customerId;
                await this.notifyUser(notifyUserId, bookingId, 'cancelled');
            } else if (status === 'completed') {
                await this.notifyCustomer(booking.customerId, bookingId, 'completed');
                await this.requestReview(bookingId);
            }
            
            // Add status change message to chat
            const statusMessage = `Booking status changed to ${status}${notes ? ': ' + notes : ''}`;
            await this.addSystemMessage(bookingId, statusMessage);
            
            return { success: true };
        } catch (error) {
            console.error('Error updating booking status:', error);
            return { success: false, error: error.message };
        }
    }

    // Add message to booking chat
    async addBookingMessage(bookingId, message, attachments = []) {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('User must be logged in to send messages');

            // Upload attachments if any
            let attachmentUrls = [];
            if (attachments.length > 0) {
                for (const file of attachments) {
                    const result = await this.uploadAttachment(file, bookingId);
                    if (result.success) {
                        attachmentUrls.push(result);
                    }
                }
            }

            const messageData = {
                senderId: user.uid,
                senderName: user.displayName || user.email,
                text: message,
                attachments: attachmentUrls,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                type: 'user'
            };

            await this.bookingsCollection.doc(bookingId)
                .collection('messages').add(messageData);
                
            // Update booking last activity
            // FIXED: Use collections pattern
            await this.bookingsCollection.doc(bookingId).update({
                lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessage: message.substring(0, 100), // Preview
                lastMessageBy: user.uid
            });
            
            // Notify the other participant
            const booking = await this.getBookingDetails(bookingId);
            const otherUserId = user.uid === booking.customerId ? booking.providerId : booking.customerId;
            await this.notifyNewMessage(otherUserId, bookingId);
            
            return { success: true };
        } catch (error) {
            console.error('Error adding booking message:', error);
            return { success: false, error: error.message };
        }
    }

    // Add system message to booking chat
    async addSystemMessage(bookingId, message) {
        try {
            const messageData = {
                senderId: 'system',
                senderName: 'System',
                text: message,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                type: 'system'
            };

            // FIXED: Use collections pattern
            await this.bookingsCollection.doc(bookingId)
                .collection('messages').add(messageData);
                
            return { success: true };
        } catch (error) {
            console.error('Error adding system message:', error);
            return { success: false, error: error.message };
        }
    }

    // Upload attachment
    async uploadAttachment(file, bookingId) {
        try {
            // Generate unique filename
            const fileExtension = file.name.split('.').pop();
            const filename = `attachment-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExtension}`;
            
            const storageRef = this.storage.ref(`booking-attachments/${bookingId}/${filename}`);
            const snapshot = await storageRef.put(file);
            const downloadURL = await snapshot.ref.getDownloadURL();
            
            return { 
                success: true, 
                url: downloadURL, 
                name: file.name, 
                type: file.type,
                size: file.size
            };
        } catch (error) {
            console.error('Error uploading attachment:', error);
            return { success: false, error: error.message };
        }
    }

    // Get booking messages
    async getBookingMessages(bookingId, limit = 50, startAfter = null) {
        try {
            // FIXED: Use collections pattern
            let query = this.bookingsCollection.doc(bookingId)
                .collection('messages')
                .orderBy('timestamp', 'desc')
                .limit(limit);

            if (startAfter) {
                query = query.startAfter(startAfter);
            }

            const snapshot = await query.get();
            const lastVisible = snapshot.docs[snapshot.docs.length - 1];
            const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse();
            
            return { messages, lastVisible };
        } catch (error) {
            console.error('Error getting booking messages:', error);
            return { messages: [], lastVisible: null };
        }
    }

    // Create booking chat
    async createBookingChat(bookingId, participants) {
        try {
            const chatData = {
                bookingId: bookingId,
                participants: participants,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessageAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // FIXED: Use collections pattern
            await this.bookingChatsCollection.add(chatData);
            return { success: true };
        } catch (error) {
            console.error('Error creating booking chat:', error);
            return { success: false, error: error.message };
        }
    }

    // Set up real-time message listener
    setupMessageListener(bookingId, callback) {
        // Remove existing listener for this booking
        if (this.currentListeners[bookingId]) {
            this.currentListeners[bookingId]();
        }

        // FIXED: Use collections pattern
        const unsubscribe = this.bookingsCollection
            .doc(bookingId)
            .collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const message = { id: change.doc.id, ...change.doc.data() };
                        callback(message);
                    }
                });
            }, error => {
                console.error('Message listener error:', error);
            });

        this.currentListeners[bookingId] = unsubscribe;
        return unsubscribe;
    }

    // Set up real-time booking listener
    setupBookingsListener(userId, role, callback) {
        const listenerKey = `bookings-${userId}-${role}`;
        
        // Remove existing listener
        if (this.currentListeners[listenerKey]) {
            this.currentListeners[listenerKey]();
        }

        let query;
        if (role === 'customer') {
            // FIXED: Use collections pattern
            query = this.bookingsCollection
                .where('customerId', '==', userId);
        } else {
            // FIXED: Use collections pattern
            query = this.bookingsCollection
                .where('providerId', '==', userId);
        }

        const unsubscribe = query
            .orderBy('updatedAt', 'desc')
            .onSnapshot(snapshot => {
                const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                callback(bookings);
            }, error => {
                console.error('Bookings listener error:', error);
            });

        this.currentListeners[listenerKey] = unsubscribe;
        return unsubscribe;
    }

    // Remove all listeners
    removeAllListeners() {
        Object.values(this.currentListeners).forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.currentListeners = {};
    }

    // Notify provider about new booking
    async notifyProvider(providerId, bookingId) {
        try {
            const notificationData = {
                userId: providerId,
                type: 'new_booking',
                title: 'New Booking Request',
                message: 'You have a new booking request',
                bookingId: bookingId,
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // FIXED: Use collections pattern
            await this.notificationsCollection.add(notificationData);
            
            // Send push notification (would integrate with FCM)
            await this.sendPushNotification(providerId, 'New Booking', 'You have a new booking request');
            
            return true;
        } catch (error) {
            console.error('Error notifying provider:', error);
            return false;
        }
    }

    // Notify customer about booking confirmation
    async notifyCustomer(customerId, bookingId, status) {
        try {
            let title, message;
            
            switch (status) {
                case 'confirmed':
                    title = 'Booking Confirmed';
                    message = 'Your booking has been confirmed';
                    break;
                case 'cancelled':
                    title = 'Booking Cancelled';
                    message = 'Your booking has been cancelled';
                    break;
                case 'completed':
                    title = 'Service Completed';
                    message = 'Your service has been completed';
                    break;
                default:
                    title = 'Booking Update';
                    message = 'Your booking status has been updated';
            }
            
            const notificationData = {
                userId: customerId,
                type: 'booking_update',
                title: title,
                message: message,
                bookingId: bookingId,
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // FIXED: Use collections pattern
            await this.notificationsCollection.add(notificationData);
            await this.sendPushNotification(customerId, title, message);
            
            return true;
        } catch (error) {
            console.error('Error notifying customer:', error);
            return false;
        }
    }

    // Notify user about new message
    async notifyNewMessage(userId, bookingId) {
        try {
            const notificationData = {
                userId: userId,
                type: 'new_message',
                title: 'New Message',
                message: 'You have a new message in your booking',
                bookingId: bookingId,
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // FIXED: Use collections pattern
            await this.notificationsCollection.add(notificationData);
            await this.sendPushNotification(userId, 'New Message', 'You have a new message');
            
            return true;
        } catch (error) {
            console.error('Error notifying user:', error);
            return false;
        }
    }

    // Request review from customer
    async requestReview(bookingId) {
        try {
            const booking = await this.getBookingDetails(bookingId);
            
            const reviewRequest = {
                bookingId: bookingId,
                customerId: booking.customerId,
                providerId: booking.providerId,
                serviceId: booking.serviceId,
                requestedAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'pending'
            };
            
            // FIXED: Use collections pattern
            await this.reviewRequestsCollection.add(reviewRequest);
            
            // Notify customer to leave a review
            await this.notifyCustomer(
                booking.customerId, 
                bookingId, 
                'review_request'
            );
            
            return true;
        } catch (error) {
            console.error('Error requesting review:', error);
            return false;
        }
    }

    // Submit review
    async submitReview(bookingId, rating, comment, photos = []) {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('User must be logged in to submit review');

            const booking = await this.getBookingDetails(bookingId);
            if (booking.customerId !== user.uid) {
                throw new Error('Only the customer can submit reviews');
            }

            // Upload review photos
            let photoUrls = [];
            for (const photo of photos) {
                const result = await this.uploadReviewPhoto(photo, bookingId);
                if (result.success) {
                    photoUrls.push(result.url);
                }
            }

            const reviewData = {
                bookingId: bookingId,
                customerId: user.uid,
                providerId: booking.providerId,
                serviceId: booking.serviceId,
                rating: rating,
                comment: comment,
                photos: photoUrls,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // FIXED: Use collections pattern
            await this.reviewsCollection.add(reviewData);
            
            // Update provider rating
            await this.updateProviderRating(booking.providerId, rating);
            
            // Update review request status
            await this.markReviewAsCompleted(bookingId);
            
            return { success: true };
        } catch (error) {
            console.error('Error submitting review:', error);
            return { success: false, error: error.message };
        }
    }

    // Update provider rating
    async updateProviderRating(providerId, newRating) {
        try {
            // Get all reviews for this provider
            // FIXED: Use collections pattern
            const snapshot = await this.reviewsCollection
                .where('providerId', '==', providerId)
                .get();

            let totalRating = 0;
            let reviewCount = 0;

            snapshot.forEach(doc => {
                totalRating += doc.data().rating;
                reviewCount++;
            });

            const averageRating = reviewCount > 0 ? totalRating / reviewCount : newRating;

            // Update provider's rating
            // FIXED: Use collections pattern
            await this.usersCollection.doc(providerId).update({
                rating: averageRating,
                reviewCount: reviewCount
            });

            return { success: true, rating: averageRating, count: reviewCount };
        } catch (error) {
            console.error('Error updating provider rating:', error);
            return { success: false, error: error.message };
        }
    }

    // Mark review as completed
    async markReviewAsCompleted(bookingId) {
        try {
            // FIXED: Use collections pattern
            const reviewRequestSnapshot = await this.reviewRequestsCollection
                .where('bookingId', '==', bookingId)
                .where('status', '==', 'pending')
                .get();

            if (!reviewRequestSnapshot.empty) {
                const requestDoc = reviewRequestSnapshot.docs[0];
                // FIXED: Use collections pattern
                await this.reviewRequestsCollection.doc(requestDoc.id).update({
                    status: 'completed',
                    completedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        } catch (error) {
            console.error('Error marking review as completed:', error);
        }
    }

    // Upload review photo
    async uploadReviewPhoto(file, bookingId) {
        try {
            const fileExtension = file.name.split('.').pop();
            const filename = `review-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExtension}`;
            
            const storageRef = this.storage.ref(`review-photos/${bookingId}/${filename}`);
            const snapshot = await storageRef.put(file);
            const downloadURL = await snapshot.ref.getDownloadURL();
            
            return { 
                success: true, 
                url: downloadURL
            };
        } catch (error) {
            console.error('Error uploading review photo:', error);
            return { success: false, error: error.message };
        }
    }

    // Send push notification (placeholder)
    async sendPushNotification(userId, title, message) {
        // This would integrate with Firebase Cloud Messaging
        console.log(`Push notification to ${userId}: ${title} - ${message}`);
        return { success: true };
    }

    // Get booking status options
    getStatusOptions() {
        return [
            { id: 'pending', name: 'Pending', color: 'warning', icon: 'fas fa-clock' },
            { id: 'confirmed', name: 'Confirmed', color: 'success', icon: 'fas fa-check-circle' },
            { id: 'in_progress', name: 'In Progress', color: 'info', icon: 'fas fa-tools' },
            { id: 'completed', name: 'Completed', color: 'primary', icon: 'fas fa-check-double' },
            { id: 'cancelled', name: 'Cancelled', color: 'danger', icon: 'fas fa-times-circle' },
            { id: 'rejected', name: 'Rejected', color: 'secondary', icon: 'fas fa-ban' }
        ];
    }

    // Get booking filters
    getBookingFilters() {
        return [
            { id: 'all', name: 'All Bookings', icon: 'fas fa-list' },
            { id: 'pending', name: 'Pending', icon: 'fas fa-clock' },
            { id: 'confirmed', name: 'Upcoming', icon: 'fas fa-calendar-check' },
            { id: 'in_progress', name: 'In Progress', icon: 'fas fa-tools' },
            { id: 'completed', name: 'Completed', icon: 'fas fa-check-double' },
            { id: 'cancelled', name: 'Cancelled', icon: 'fas fa-times-circle' }
        ];
    }
}

// Initialize bookings manager
const bookingsManager = new BookingsManager();

// Load user bookings with filters
async function loadUserBookings(filters = {}) {
    if (!auth.currentUser) return;
    
    const bookingsContainer = document.getElementById('user-bookings-container');
    if (!bookingsContainer) return;
    
    bookingsContainer.innerHTML = '<div class="loading-spinner">Loading bookings...</div>';
    
    const result = await bookingsManager.getUserBookings(auth.currentUser.uid, filters, 20);
    
    if (result.bookings.length === 0) {
        bookingsContainer.innerHTML = `
            <div class="no-bookings">
                <i class="fas fa-calendar-times"></i>
                <h3>No bookings found</h3>
                <p>${filters.status ? `No ${filters.status} bookings` : 'You don\'t have any bookings yet'}</p>
            </div>
        `;
        return;
    }
    
    bookingsContainer.innerHTML = '';
    result.bookings.forEach(booking => {
        const bookingElement = createBookingElement(booking);
        bookingsContainer.appendChild(bookingElement);
    });
    
    // Store for pagination
    window.lastBooking = result.lastVisible;
}

// Create HTML element for a booking
function createBookingElement(booking) {
    const statusOptions = bookingsManager.getStatusOptions();
    const status = statusOptions.find(s => s.id === booking.status) || statusOptions[0];
    const isProvider = booking.role === 'provider';
    
    const div = document.createElement('div');
    div.className = 'booking-item';
    div.innerHTML = `
        <div class="booking-header">
            <div class="booking-title">
                <i class="fas ${isProvider ? 'fa-user' : 'fa-tools'}"></i>
                ${booking.serviceName || 'Unknown Service'}
            </div>
            <div class="booking-status ${status.color}">
                <i class="${status.icon}"></i> ${status.name}
            </div>
        </div>
        <div class="booking-details">
            <div class="booking-date">
                <i class="fas fa-calendar"></i> ${formatDate(booking.date)}
            </div>
            <div class="booking-time">
                <i class="fas fa-clock"></i> ${booking.time || 'Anytime'}
            </div>
            <div class="booking-price">
                <i class="fas fa-money-bill-wave"></i> ${booking.price ? `KES ${booking.price.toLocaleString()}` : 'Price not set'}
            </div>
        </div>
        <div class="booking-with">
            <i class="fas ${isProvider ? 'fa-user' : 'fa-tools'}"></i>
            <strong>${isProvider ? 'Customer' : 'Provider'}:</strong>
            ${isProvider ? 
                (booking.customerName || 'Unknown') : 
                (booking.provider?.displayName || 'Unknown')}
        </div>
        <div class="booking-actions">
            <button class="btn btn-sm btn-outline" onclick="viewBookingDetails('${booking.id}')">
                <i class="fas fa-eye"></i> Details
            </button>
            ${booking.status === 'pending' && isProvider ? `
                <button class="btn btn-sm btn-success" onclick="confirmBooking('${booking.id}')">
                    <i class="fas fa-check"></i> Confirm
                </button>
                <button class="btn btn-sm btn-danger" onclick="rejectBooking('${booking.id}')">
                    <i class="fas fa-times"></i> Reject
                </button>
            ` : ''}
            ${booking.status === 'confirmed' && isProvider ? `
                <button class="btn btn-sm btn-primary" onclick="startBooking('${booking.id}')">
                    <i class="fas fa-play"></i> Start
                </button>
            ` : ''}
            ${booking.status === 'in_progress' && isProvider ? `
                <button class="btn btn-sm btn-success" onclick="completeBooking('${booking.id}')">
                    <i class="fas fa-check-double"></i> Complete
                </button>
            ` : ''}
            ${['pending', 'confirmed'].includes(booking.status) ? `
                <button class="btn btn-sm btn-danger" onclick="cancelBooking('${booking.id}')">
                    <i class="fas fa-times"></i> Cancel
                </button>
            ` : ''}
            ${booking.status === 'completed' && !isProvider && !booking.reviewSubmitted ? `
                <button class="btn btn-sm btn-warning" onclick="showReviewForm('${booking.id}')">
                    <i class="fas fa-star"></i> Review
                </button>
            ` : ''}
        </div>
    `;
    return div;
}

// Format date for display
function formatDate(dateString) {
    if (!dateString) return 'Date not set';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-KE', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Format time for display
function formatTime(date) {
    if (!date) return '';
    return date.toLocaleTimeString('en-KE', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// View booking details
async function viewBookingDetails(bookingId) {
    try {
        const booking = await bookingsManager.getBookingDetails(bookingId);
        const isProvider = booking.providerId === auth.currentUser.uid;
        
        const modalContent = `
            <div class="booking-details-modal">
                <div class="booking-header-modal">
                    <h3>${booking.serviceName || 'Booking Details'}</h3>
                    <span class="status-${booking.status}">
                        <i class="${bookingsManager.getStatusOptions().find(s => s.id === booking.status)?.icon}"></i>
                        ${booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                    </span>
                </div>
                
                <div class="booking-info-grid">
                    <div class="info-item">
                        <i class="fas fa-calendar"></i>
                        <div>
                            <strong>Date</strong>
                            <span>${formatDate(booking.date)}</span>
                        </div>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-clock"></i>
                        <div>
                            <strong>Time</strong>
                            <span>${booking.time || 'Not specified'}</span>
                        </div>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-money-bill-wave"></i>
                        <div>
                            <strong>Price</strong>
                            <span>${booking.price ? `KES ${booking.price.toLocaleString()}` : 'Not specified'}</span>
                        </div>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <div>
                            <strong>Location</strong>
                            <span>${booking.location || 'Not specified'}</span>
                        </div>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-user"></i>
                        <div>
                            <strong>Customer</strong>
                            <span>${booking.customer?.displayName || booking.customerName || 'Unknown'}</span>
                        </div>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-tools"></i>
                        <div>
                            <strong>Provider</strong>
                            <span>${booking.provider?.displayName || 'Unknown'}</span>
                        </div>
                    </div>
                </div>
                
                ${booking.notes ? `
                    <div class="booking-notes">
                        <h4><i class="fas fa-sticky-note"></i> Notes</h4>
                        <p>${booking.notes}</p>
                    </div>
                ` : ''}
                
                <div class="booking-chat-section">
                    <h4><i class="fas fa-comments"></i> Messages</h4>
                    <div class="chat-messages" id="booking-chat-messages">
                        <div class="loading-spinner">Loading messages...</div>
                    </div>
                    <div class="chat-input-container">
                        <input type="text" id="booking-chat-input" placeholder="Type a message...">
                        <label for="booking-chat-attachment" class="attachment-btn">
                            <i class="fas fa-paperclip"></i>
                            <input type="file" id="booking-chat-attachment" style="display: none;" multiple>
                        </label>
                        <button onclick="sendBookingMessage('${bookingId}')">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
                
                <div class="booking-actions-modal">
                    ${booking.status === 'pending' && isProvider ? `
                        <button class="btn btn-success" onclick="confirmBooking('${bookingId}')">
                            <i class="fas fa-check"></i> Confirm Booking
                        </button>
                        <button class="btn btn-danger" onclick="rejectBooking('${bookingId}')">
                            <i class="fas fa-times"></i> Reject Booking
                        </button>
                    ` : ''}
                    ${booking.status === 'confirmed' && isProvider ? `
                        <button class="btn btn-primary" onclick="startBooking('${bookingId}')">
                            <i class="fas fa-play"></i> Start Service
                        </button>
                    ` : ''}
                    ${booking.status === 'in_progress' && isProvider ? `
                        <button class="btn btn-success" onclick="completeBooking('${bookingId}')">
                            <i class="fas fa-check-double"></i> Mark as Complete
                        </button>
                    ` : ''}
                    ${['pending', 'confirmed'].includes(booking.status) ? `
                        <button class="btn btn-danger" onclick="cancelBooking('${bookingId}')">
                            <i class="fas fa-times"></i> Cancel Booking
                        </button>
                    ` : ''}
                    ${booking.status === 'completed' && !isProvider && !booking.reviewSubmitted ? `
                        <button class="btn btn-warning" onclick="showReviewForm('${bookingId}')">
                            <i class="fas fa-star"></i> Leave Review
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        
        showModal('Booking Details', modalContent);
        
        // Load chat messages
        loadBookingChatMessages(bookingId);
        
        // Set up real-time message listener
        bookingsManager.setupMessageListener(bookingId, (message) => {
            addMessageToBookingChat(message);
            scrollBookingChatToBottom();
        });
    } catch (error) {
        showToast('Error loading booking details: ' + error.message, 'error');
    }
}

// Load booking chat messages
async function loadBookingChatMessages(bookingId, loadMore = false) {
    const messagesContainer = document.getElementById('booking-chat-messages');
    if (!messagesContainer) return;
    
    const startAfter = loadMore ? window.lastBookingMessage : null;
    const result = await bookingsManager.getBookingMessages(bookingId, 50, startAfter);
    
    if (result.messages.length === 0 && !loadMore) {
        messagesContainer.innerHTML = '<div class="no-messages">No messages yet. Start the conversation!</div>';
        return;
    }

    if (loadMore) {
        // Prepend older messages
        const fragment = document.createDocumentFragment();
        result.messages.forEach(message => {
            const messageElement = createChatMessageElement(message);
            fragment.appendChild(messageElement);
        });
        messagesContainer.insertBefore(fragment, messagesContainer.firstChild);
    } else {
        // Load initial messages
        messagesContainer.innerHTML = '';
        result.messages.forEach(message => {
            const messageElement = createChatMessageElement(message);
            messagesContainer.appendChild(messageElement);
        });
        scrollBookingChatToBottom();
    }
    
    // Store for pagination
    window.lastBookingMessage = result.lastVisible;
}

// Create chat message element
function createChatMessageElement(message) {
    const isCurrentUser = message.senderId === auth.currentUser.uid;
    const isSystem = message.senderId === 'system';
    
    const div = document.createElement('div');
    div.className = `chat-message ${isSystem ? 'system-message' : isCurrentUser ? 'own-message' : 'other-message'}`;
    
    let messageContent = '';
    if (message.attachments && message.attachments.length > 0) {
        messageContent = message.attachments.map(attachment => {
            if (attachment.type.startsWith('image/')) {
                return `<div class="message-attachment">
                    <img src="${attachment.url}" alt="${attachment.name}" onclick="viewImage('${attachment.url}')">
                    <div class="attachment-name">${attachment.name}</div>
                </div>`;
            } else {
                return `<div class="message-attachment file">
                    <i class="fas fa-file"></i>
                    <div class="attachment-info">
                        <div class="attachment-name">${attachment.name}</div>
                        <div class="attachment-size">${formatFileSize(attachment.size)}</div>
                    </div>
                    <a href="${attachment.url}" download="${attachment.name}" class="download-btn">
                        <i class="fas fa-download"></i>
                    </a>
                </div>`;
            }
        }).join('');
    }
    
    if (message.text) {
        messageContent += `<div class="message-text">${escapeHtml(message.text)}</div>`;
    }
    
    div.innerHTML = `
        ${!isSystem ? `
            <div class="message-sender">${message.senderName}</div>
        ` : ''}
        <div class="message-content">
            ${messageContent}
        </div>
        <div class="message-time">
            ${formatTime(message.timestamp?.toDate())}
        </div>
    `;
    
    return div;
}

// Add message to booking chat (for real-time updates)
function addMessageToBookingChat(message) {
    const messagesContainer = document.getElementById('booking-chat-messages');
    if (!messagesContainer) return;

    const messageElement = createChatMessageElement(message);
    messagesContainer.appendChild(messageElement);
    scrollBookingChatToBottom();
}

// Scroll to bottom of booking chat
function scrollBookingChatToBottom() {
    const messagesContainer = document.getElementById('booking-chat-messages');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// Send booking message
async function sendBookingMessage(bookingId) {
    const input = document.getElementById('booking-chat-input');
    const fileInput = document.getElementById('booking-chat-attachment');
    const message = input.value.trim();
    const files = fileInput.files;
    
    if (!message && files.length === 0) return;
    
    const result = await bookingsManager.addBookingMessage(bookingId, message, Array.from(files));
    
    if (result.success) {
        input.value = '';
        fileInput.value = '';
    } else {
        showToast('Error sending message: ' + result.error, 'error');
    }
}

// Show review form
function showReviewForm(bookingId) {
    const formContent = `
        <div class="review-form">
            <h3><i class="fas fa-star"></i> Leave a Review</h3>
            <div class="form-group">
                <label>Rating</label>
                <div class="rating-stars">
                    ${[1, 2, 3, 4, 5].map(star => `
                        <i class="fas fa-star" data-rating="${star}" onclick="setRating(${star})"></i>
                    `).join('')}
                </div>
            </div>
            <div class="form-group">
                <label for="review-comment">Comment</label>
                <textarea id="review-comment" class="form-input" placeholder="Share your experience..." rows="4"></textarea>
            </div>
            <div class="form-group">
                <label for="review-photos">Photos (optional)</label>
                <input type="file" id="review-photos" class="form-input" multiple accept="image/*">
            </div>
            <button class="btn btn-primary" onclick="submitReview('${bookingId}')">Submit Review</button>
        </div>
    `;
    
    showModal('Leave a Review', formContent);
}

// Set rating
function setRating(rating) {
    const stars = document.querySelectorAll('.rating-stars .fa-star');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.add('selected');
        } else {
            star.classList.remove('selected');
        }
    });
    window.currentRating = rating;
}

// Submit review
async function submitReview(bookingId) {
    const rating = window.currentRating;
    const comment = document.getElementById('review-comment').value;
    const photoInput = document.getElementById('review-photos');
    const photos = photoInput.files;
    
    if (!rating) {
        showToast('Please select a rating', 'error');
        return;
    }
    
    const result = await bookingsManager.submitReview(bookingId, rating, comment, Array.from(photos));
    
    if (result.success) {
        showToast('Review submitted successfully!', 'success');
        closeModal();
        loadUserBookings(); // Refresh bookings
    } else {
        showToast('Error submitting review: ' + result.error, 'error');
    }
}

// Booking action functions
async function confirmBooking(bookingId) {
    const result = await bookingsManager.updateBookingStatus(bookingId, 'confirmed');
    if (result.success) {
        showToast('Booking confirmed successfully!', 'success');
        loadUserBookings();
    } else {
        showToast('Error confirming booking: ' + result.error, 'error');
    }
}

async function startBooking(bookingId) {
    const result = await bookingsManager.updateBookingStatus(bookingId, 'in_progress');
    if (result.success) {
        showToast('Service started!', 'success');
        loadUserBookings();
    } else {
        showToast('Error starting service: ' + result.error, 'error');
    }
}

async function completeBooking(bookingId) {
    const result = await bookingsManager.updateBookingStatus(bookingId, 'completed');
    if (result.success) {
        showToast('Service completed!', 'success');
        loadUserBookings();
    } else {
        showToast('Error completing service: ' + result.error, 'error');
    }
}

async function cancelBooking(bookingId) {
    const reason = prompt('Please provide a reason for cancellation:');
    if (reason === null) return;
    
    const result = await bookingsManager.updateBookingStatus(bookingId, 'cancelled', reason);
    if (result.success) {
        showToast('Booking cancelled!', 'success');
        loadUserBookings();
    } else {
        showToast('Error cancelling booking: ' + result.error, 'error');
    }
}

async function rejectBooking(bookingId) {
    const reason = prompt('Please provide a reason for rejection:');
    if (reason === null) return;
    
    const result = await bookingsManager.updateBookingStatus(bookingId, 'rejected', reason);
    if (result.success) {
        showToast('Booking rejected!', 'success');
        loadUserBookings();
    } else {
        showToast('Error rejecting booking: ' + result.error, 'error');
    }
}

// Make it available globally
window.bookingsManager = bookingsManager;
window.loadUserBookings = loadUserBookings;
window.viewBookingDetails = viewBookingDetails;
window.sendBookingMessage = sendBookingMessage;
window.showReviewForm = showReviewForm;
window.setRating = setRating;
window.submitReview = submitReview;
window.confirmBooking = confirmBooking;
window.startBooking = startBooking;
window.completeBooking = completeBooking;
window.cancelBooking = cancelBooking;
window.rejectBooking = rejectBooking;
window.viewImage = function(url) {
    window.open(url, '_blank');
};