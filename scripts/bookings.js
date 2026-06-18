if (typeof window.showToast !== 'function') {
    window.showToast = console.log;
}
if (typeof window.showModalWithContent !== 'function') {
    window.showModalWithContent = function(id, content) {
        const modal = document.createElement('div');
        modal.id = id;
        modal.className = 'modal';
        modal.innerHTML = content;
        document.body.appendChild(modal);
        modal.style.display = 'block';

        const closeBtn = modal.querySelector('.close-modal-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.remove();
            });
        }
    };
}

class BookingsManager {
    constructor() {
        this.db = db;
        this.storage = storage;
        this.currentListeners = {};

        this.bookingsCollection = collections.bookings();
        this.usersCollection = collections.users();
        this.servicesCollection = collections.services();
        this.paymentsCollection = collections.payments();
        this.notificationsCollection = collections.notifications();
        this.reviewsCollection = collections.reviews();
        this.reviewRequestsCollection = collections.reviewRequests();
        this.bookingChatsCollection = collections.bookingChats();
    }

    async createBooking(bookingData) {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('User must be logged in to create a booking');

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

            const docRef = await this.bookingsCollection.add(bookingWithMetadata);

            if (bookingData.providerId) {
                await this.notifyProvider(bookingData.providerId, docRef.id);
            }

            await this.createBookingChat(docRef.id, [user.uid, bookingData.providerId]);
            
            return { success: true, id: docRef.id };
        } catch (error) {
            console.error('Error creating booking:', error);
            return { success: false, error: error.message };
        }
    }

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
            
            return true;
        } catch (error) {
            console.error('Error checking provider availability:', error);
            return true;
        }
    }

    async getUserBookings(userId, filters = {}, limit = 20, startAfter = null) {
        try {
            let query;
            
            if (filters.role === 'customer') {
                query = this.bookingsCollection
                    .where('customerId', '==', userId)
                    .orderBy('createdAt', 'desc');
                    
                if (filters.status) {
                    query = query.where('status', '==', filters.status);
                }
                
                if (startAfter) {
                    query = query.startAfter(startAfter);
                }
                
                const snapshot = await query.limit(limit).get();
                const lastVisible = snapshot.docs[snapshot.docs.length - 1];
                const bookings = snapshot.docs.map(doc => ({ 
                    id: doc.id, 
                    ...doc.data(), 
                    role: 'customer' 
                }));
                
                return { bookings, lastVisible };
                
            } else if (filters.role === 'provider') {
                query = this.bookingsCollection
                    .where('providerId', '==', userId)
                    .orderBy('createdAt', 'desc');
                    
                if (filters.status) {
                    query = query.where('status', '==', filters.status);
                }
                
                if (startAfter) {
                    query = query.startAfter(startAfter);
                }
                
                const snapshot = await query.limit(limit).get();
                const lastVisible = snapshot.docs[snapshot.docs.length - 1];
                const bookings = snapshot.docs.map(doc => ({ 
                    id: doc.id, 
                    ...doc.data(), 
                    role: 'provider' 
                }));
                
                return { bookings, lastVisible };
                
            } else {
                const [customerBookings, providerBookings] = await Promise.all([
                    this.bookingsCollection
                        .where('customerId', '==', userId)
                        .orderBy('createdAt', 'desc')
                        .limit(limit)
                        .get(),
                    this.bookingsCollection
                        .where('providerId', '==', userId)
                        .orderBy('createdAt', 'desc')
                        .limit(limit)
                        .get()
                ]);
                
                const allBookings = [
                    ...customerBookings.docs.map(doc => ({ id: doc.id, ...doc.data(), role: 'customer' })),
                    ...providerBookings.docs.map(doc => ({ id: doc.id, ...doc.data(), role: 'provider' }))
                ];
                
                allBookings.sort((a, b) => {
                    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
                    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
                    return dateB - dateA;
                });
                
                let filteredBookings = allBookings;
                if (filters.status) {
                    filteredBookings = allBookings.filter(b => b.status === filters.status);
                }

                if (limit && filteredBookings.length > limit) {
                    filteredBookings = filteredBookings.slice(0, limit);
                }
                
                return { bookings: filteredBookings, lastVisible: null };
            }
        } catch (error) {
            console.error('Error getting user bookings:', error);
            return { bookings: [], lastVisible: null };
        }
    }

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
            
            if (booking.providerId) {
                const providerDoc = await this.usersCollection.doc(booking.providerId).get();
                if (providerDoc.exists) {
                    booking.provider = providerDoc.data();
                }
            }
            
            return booking;
        } catch (error) {
            console.error('Error getting booking details:', error);
            throw error;
        }
    }

    async updateBookingStatus(bookingId, status, notes = null) {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('User must be logged in to update booking status');

            const bookingDoc = await this.bookingsCollection.doc(bookingId).get();
            if (!bookingDoc.exists) {
                throw new Error('Booking not found');
            }

            const booking = bookingDoc.data();
            
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
            
            return { success: true };
        } catch (error) {
            console.error('Error updating booking status:', error);
            return { success: false, error: error.message };
        }
    }

    async updateProviderRating(providerId, newRating) {
        try {
            const providerDoc = await this.usersCollection.doc(providerId).get();
            if (!providerDoc.exists) {
                await this.usersCollection.doc(providerId).set({
                    ratingSum: newRating,
                    ratingCount: 1,
                    averageRating: newRating
                }, { merge: true });
                return { success: true, rating: newRating, count: 1 };
            }
            
            const providerData = providerDoc.data();
            const currentSum = providerData.ratingSum || 0;
            const currentCount = providerData.ratingCount || 0;
            
            const newSum = currentSum + newRating;
            const newCount = currentCount + 1;
            const newAverage = newSum / newCount;
            
            await this.usersCollection.doc(providerId).update({
                ratingSum: firebase.firestore.FieldValue.increment(newRating),
                ratingCount: firebase.firestore.FieldValue.increment(1),
                averageRating: newAverage,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            return { success: true, rating: newAverage, count: newCount };
        } catch (error) {
            console.error('Error updating provider rating:', error);
            return { success: false, error: error.message };
        }
    }

    async submitReview(bookingId, rating, comment, photos = []) {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('User must be logged in to submit review');

            const booking = await this.getBookingDetails(bookingId);
            if (booking.customerId !== user.uid) {
                throw new Error('Only the customer can submit reviews');
            }
            
            const existingReview = await this.reviewsCollection
                .where('bookingId', '==', bookingId)
                .where('customerId', '==', user.uid)
                .get();
            
            if (!existingReview.empty) {
                throw new Error('You have already reviewed this booking');
            }

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

            await this.reviewsCollection.add(reviewData);
            
            await this.updateProviderRating(booking.providerId, rating);
            
            await this.markReviewAsCompleted(bookingId);
            
            return { success: true };
        } catch (error) {
            console.error('Error submitting review:', error);
            return { success: false, error: error.message };
        }
    }

    async uploadReviewPhoto(file, bookingId) {
        try {
            const fileExtension = file.name.split('.').pop();
            const filename = `review-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExtension}`;
            
            const storageRef = this.storage.ref(`review-photos/${bookingId}/${filename}`);
            const snapshot = await storageRef.put(file);
            const downloadURL = await snapshot.ref.getDownloadURL();
            
            return { success: true, url: downloadURL };
        } catch (error) {
            console.error('Error uploading review photo:', error);
            return { success: false, error: error.message };
        }
    }

    async markReviewAsCompleted(bookingId) {
        try {
            const reviewRequestSnapshot = await this.reviewRequestsCollection
                .where('bookingId', '==', bookingId)
                .where('status', '==', 'pending')
                .get();

            if (!reviewRequestSnapshot.empty) {
                const requestDoc = reviewRequestSnapshot.docs[0];
                await this.reviewRequestsCollection.doc(requestDoc.id).update({
                    status: 'completed',
                    completedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        } catch (error) {
            console.error('Error marking review as completed:', error);
        }
    }

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
            
            await this.reviewRequestsCollection.add(reviewRequest);

            await this.notifyCustomer(booking.customerId, bookingId, 'review_request');
            
            return true;
        } catch (error) {
            console.error('Error requesting review:', error);
            return false;
        }
    }

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
            
            await this.notificationsCollection.add(notificationData);
            
            await this.sendPushNotification(providerId, 'New Booking', 'You have a new booking request');
            
            return true;
        } catch (error) {
            console.error('Error notifying provider:', error);
            return false;
        }
    }

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
                case 'review_request':
                    title = 'Leave a Review';
                    message = 'Please rate your experience';
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
            
            await this.notificationsCollection.add(notificationData);
            await this.sendPushNotification(customerId, title, message);
            
            return true;
        } catch (error) {
            console.error('Error notifying customer:', error);
            return false;
        }
    }

    async notifyUser(userId, bookingId, type) {
        try {
            const notificationData = {
                userId: userId,
                type: type,
                title: type === 'cancelled' ? 'Booking Cancelled' : 'Booking Update',
                message: type === 'cancelled' ? 'A booking has been cancelled' : 'Your booking has been updated',
                bookingId: bookingId,
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await this.notificationsCollection.add(notificationData);
            await this.sendPushNotification(userId, notificationData.title, notificationData.message);
            
            return true;
        } catch (error) {
            console.error('Error notifying user:', error);
            return false;
        }
    }

    async sendPushNotification(userId, title, message) {
        try {
            const userDoc = await this.usersCollection.doc(userId).get();
            const fcmToken = userDoc.exists ? userDoc.data().fcmToken : null;
            
            if (fcmToken && typeof firebase.messaging !== 'undefined') {
                console.log(`📱 Push notification to ${userId}: ${title} - ${message}`);
            }

            window.dispatchEvent(new CustomEvent('newNotification', {
                detail: { userId, title, message, timestamp: new Date() }
            }));
        } catch (error) {
            console.log('Push notification not sent (FCM not configured):', error.message);
        }
        
        return { success: true };
    }

    async createBookingChat(bookingId, participants) {
        try {
            const chatData = {
                bookingId: bookingId,
                participants: participants,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessageAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await this.bookingChatsCollection.add(chatData);
            return { success: true };
        } catch (error) {
            console.error('Error creating booking chat:', error);
            return { success: false, error: error.message };
        }
    }

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

const bookingsManager = new BookingsManager();

async function loadUserBookings(filters = {}) {
    if (!auth.currentUser) return;
    
    const bookingsContainer = document.getElementById('user-bookings-container');
    if (!bookingsContainer) return;
    
    bookingsContainer.innerHTML = '<div class="loading-spinner">Loading bookings...</div>';
    
    const result = await bookingsManager.getUserBookings(auth.currentUser.uid, filters, 20);
    
    if (result.bookings.length === 0) {
        bookingsContainer.innerHTML = `
            <div class="no-bookings" style="text-align: center; padding: 40px;">
                <i class="fas fa-calendar-times" style="font-size: 2rem; margin-bottom: 10px;"></i>
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
    
    window.lastBooking = result.lastVisible;
}

function createBookingElement(booking) {
    const statusOptions = bookingsManager.getStatusOptions();
    const status = statusOptions.find(s => s.id === booking.status) || statusOptions[0];
    const isProvider = booking.role === 'provider';
    
    const div = document.createElement('div');
    div.className = 'booking-item';
    div.setAttribute('data-booking-id', booking.id);
    div.innerHTML = `
        <div class="booking-header">
            <div class="booking-title">
                <i class="fas ${isProvider ? 'fa-user' : 'fa-tools'}"></i>
                ${escapeHtml(booking.serviceName || booking.title || 'Unknown Service')}
            </div>
            <div class="booking-status ${booking.status}">
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
                (booking.provider?.displayName || booking.providerName || 'Unknown')}
        </div>
        <div class="booking-actions">
            <button class="btn btn-sm btn-outline view-booking-detail-btn" data-id="${booking.id}">
                <i class="fas fa-eye"></i> Details
            </button>
            ${booking.status === 'pending' && isProvider ? `
                <button class="btn btn-sm btn-success confirm-booking-btn" data-id="${booking.id}">
                    <i class="fas fa-check"></i> Confirm
                </button>
                <button class="btn btn-sm btn-danger reject-booking-btn" data-id="${booking.id}">
                    <i class="fas fa-times"></i> Reject
                </button>
            ` : ''}
            ${booking.status === 'confirmed' && isProvider ? `
                <button class="btn btn-sm btn-primary start-booking-btn" data-id="${booking.id}">
                    <i class="fas fa-play"></i> Start
                </button>
            ` : ''}
            ${booking.status === 'in_progress' && isProvider ? `
                <button class="btn btn-sm btn-success complete-booking-btn" data-id="${booking.id}">
                    <i class="fas fa-check-double"></i> Complete
                </button>
            ` : ''}
            ${['pending', 'confirmed'].includes(booking.status) ? `
                <button class="btn btn-sm btn-danger cancel-booking-btn" data-id="${booking.id}">
                    <i class="fas fa-times"></i> Cancel
                </button>
            ` : ''}
        </div>
    `;
    
    const detailBtn = div.querySelector('.view-booking-detail-btn');
    if (detailBtn) {
        detailBtn.addEventListener('click', () => viewBookingDetails(booking.id));
    }
    
    const confirmBtn = div.querySelector('.confirm-booking-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => confirmBooking(booking.id));
    }
    
    const rejectBtn = div.querySelector('.reject-booking-btn');
    if (rejectBtn) {
        rejectBtn.addEventListener('click', () => rejectBooking(booking.id));
    }
    
    const startBtn = div.querySelector('.start-booking-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => startBooking(booking.id));
    }
    
    const completeBtn = div.querySelector('.complete-booking-btn');
    if (completeBtn) {
        completeBtn.addEventListener('click', () => completeBooking(booking.id));
    }
    
    const cancelBtn = div.querySelector('.cancel-booking-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => cancelBooking(booking.id));
    }
    
    return div;
}

function formatDate(dateString) {
    if (!dateString) return 'Date not set';
    
    try {
        let date;
        if (typeof dateString === 'object' && dateString.toDate) {
            date = dateString.toDate();
        } else {
            date = new Date(dateString);
        }
        
        if (isNaN(date.getTime())) return 'Date not set';
        
        return date.toLocaleDateString('en-KE', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return 'Date not set';
    }
}

function formatTime(date) {
    if (!date) return '';
    try {
        let d;
        if (typeof date === 'object' && date.toDate) {
            d = date.toDate();
        } else {
            d = new Date(date);
        }
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString('en-KE', {
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return '';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showReasonModal(title, callback) {
    const modalContent = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <div class="modal-title">${title}</div>
                <button class="close-modal-btn">&times;</button>
            </div>
            <div style="padding: 20px;">
                <div class="form-group">
                    <label class="form-label">Reason</label>
                    <textarea id="reason-text" class="form-input" rows="3" placeholder="Please provide a reason..."></textarea>
                </div>
                <div class="form-actions" style="display: flex; gap: 10px; margin-top: 20px;">
                    <button class="btn btn-outline close-modal-btn">Cancel</button>
                    <button class="btn btn-primary" id="submit-reason-btn">Submit</button>
                </div>
            </div>
        </div>
    `;
    
    if (typeof window.showModalWithContent === 'function') {
        window.showModalWithContent('reason-modal', modalContent);
    }
    
    setTimeout(() => {
        const submitBtn = document.getElementById('submit-reason-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                const reason = document.getElementById('reason-text')?.value;
                if (typeof window.closeModal === 'function') {
                    window.closeModal('reason-modal');
                }
                if (callback) callback(reason);
            });
        }
        
        const closeBtns = document.querySelectorAll('#reason-modal .close-modal-btn');
        closeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (typeof window.closeModal === 'function') {
                    window.closeModal('reason-modal');
                }
                if (callback) callback(null);
            });
        });
    }, 100);
}

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
    showReasonModal('Cancel Booking', async (reason) => {
        if (!reason) {
            showToast('Cancellation cancelled', 'info');
            return;
        }
        const result = await bookingsManager.updateBookingStatus(bookingId, 'cancelled', reason);
        if (result.success) {
            showToast('Booking cancelled!', 'success');
            loadUserBookings();
        } else {
            showToast('Error cancelling booking: ' + result.error, 'error');
        }
    });
}

async function rejectBooking(bookingId) {
    showReasonModal('Reject Booking', async (reason) => {
        if (!reason) {
            showToast('Rejection cancelled', 'info');
            return;
        }
        const result = await bookingsManager.updateBookingStatus(bookingId, 'rejected', reason);
        if (result.success) {
            showToast('Booking rejected!', 'success');
            loadUserBookings();
        } else {
            showToast('Error rejecting booking: ' + result.error, 'error');
        }
    });
}

async function viewBookingDetails(bookingId) {
    try {
        const booking = await bookingsManager.getBookingDetails(bookingId);
        const isProvider = booking.providerId === auth.currentUser?.uid;
        
        const modalContent = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <div class="modal-title">${escapeHtml(booking.serviceName || 'Booking Details')}</div>
                    <button class="close-modal-btn">&times;</button>
                </div>
                <div style="padding: 20px;">
                    <div><strong>Status:</strong> ${booking.status}</div>
                    <div><strong>Date:</strong> ${formatDate(booking.date)}</div>
                    <div><strong>Time:</strong> ${booking.time || 'Not specified'}</div>
                    <div><strong>Price:</strong> ${booking.price ? `KES ${booking.price.toLocaleString()}` : 'Not specified'}</div>
                    <div><strong>Location:</strong> ${escapeHtml(booking.location || 'Not specified')}</div>
                    <div><strong>${isProvider ? 'Customer' : 'Provider'}:</strong> ${escapeHtml(isProvider ? booking.customerName : booking.provider?.displayName)}</div>
                    ${booking.notes ? `<div><strong>Notes:</strong> ${escapeHtml(booking.notes)}</div>` : ''}
                </div>
            </div>
        `;
        
        if (typeof window.showModalWithContent === 'function') {
            window.showModalWithContent('booking-details-modal', modalContent);
        }
    } catch (error) {
        showToast('Error loading booking details', 'error');
    }
}

function showReviewForm(bookingId) {
    const formContent = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <div class="modal-title"><i class="fas fa-star"></i> Leave a Review</div>
                <button class="close-modal-btn">&times;</button>
            </div>
            <div style="padding: 20px;">
                <div class="form-group">
                    <label>Rating</label>
                    <div class="rating-stars">
                        ${[1, 2, 3, 4, 5].map(star => `
                            <i class="far fa-star" data-rating="${star}" style="font-size: 1.5rem; cursor: pointer; color: var(--warning);"></i>
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
                <div class="form-actions" style="display: flex; gap: 10px; margin-top: 20px;">
                    <button class="btn btn-outline close-modal-btn">Cancel</button>
                    <button class="btn btn-primary" id="submit-review-btn">Submit Review</button>
                </div>
            </div>
        </div>
    `;
    
    if (typeof window.showModalWithContent === 'function') {
        window.showModalWithContent('review-modal', formContent);
    }
    
    let selectedRating = 0;
    const stars = document.querySelectorAll('#review-modal .rating-stars i');
    stars.forEach(star => {
        star.addEventListener('click', () => {
            selectedRating = parseInt(star.getAttribute('data-rating'));
            stars.forEach(s => {
                const rating = parseInt(s.getAttribute('data-rating'));
                if (rating <= selectedRating) {
                    s.className = 'fas fa-star';
                } else {
                    s.className = 'far fa-star';
                }
            });
        });
    });
    
    const submitBtn = document.getElementById('submit-review-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            if (selectedRating === 0) {
                showToast('Please select a rating', 'error');
                return;
            }
            const comment = document.getElementById('review-comment')?.value || '';
            const photoInput = document.getElementById('review-photos');
            const photos = photoInput?.files ? Array.from(photoInput.files) : [];
            
            const result = await bookingsManager.submitReview(bookingId, selectedRating, comment, photos);
            if (result.success) {
                showToast('Review submitted successfully!', 'success');
                if (typeof window.closeModal === 'function') {
                    window.closeModal('review-modal');
                }
                loadUserBookings();
            } else {
                showToast('Error: ' + result.error, 'error');
            }
        });
    }
}

window.bookingsManager = bookingsManager;
window.loadUserBookings = loadUserBookings;
window.viewBookingDetails = viewBookingDetails;
window.showReviewForm = showReviewForm;
window.confirmBooking = confirmBooking;
window.startBooking = startBooking;
window.completeBooking = completeBooking;
window.cancelBooking = cancelBooking;
window.rejectBooking = rejectBooking;