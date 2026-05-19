// ========== REVIEWS MANAGER - COMPLETE FIXED VERSION ==========
// Uses Firestore collections pattern (collections.reviews(), collections.users())

class ReviewsManager {
    constructor() {
        // FIXED: Use collections pattern (not firebaseCollections)
        this.db = db;
        this.reviewsCollection = collections.reviews();
        this.usersCollection = collections.users();
        this.bookingsCollection = collections.bookings();
    }

    // Add a new review with validation
    async addReview(reviewData) {
        try {
            const user = auth.currentUser;
            if (!user) {
                return { success: false, error: 'User must be logged in to add a review' };
            }

            // Validate rating range (1-5)
            if (!reviewData.rating || reviewData.rating < 1 || reviewData.rating > 5) {
                return { success: false, error: 'Rating must be between 1 and 5' };
            }

            // Check for duplicate review (same user, same reviewed user, same context)
            const existingReview = await this.reviewsCollection
                .where('authorId', '==', user.uid)
                .where('reviewedUserId', '==', reviewData.reviewedUserId)
                .where('context', '==', reviewData.context || 'general')
                .get();

            if (!existingReview.empty) {
                return { success: false, error: 'You have already reviewed this user/service' };
            }

            const review = {
                ...reviewData,
                authorId: user.uid,
                authorName: user.displayName || user.email,
                status: 'published',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await this.reviewsCollection.add(review);
            
            // Update user's average rating
            await this.updateUserRating(reviewData.reviewedUserId);
            
            return { success: true, id: docRef.id };
        } catch (error) {
            console.error('Error adding review:', error);
            return { success: false, error: error.message };
        }
    }

    // Get reviews for a specific user with pagination
    async getUserReviews(userId, limit = 10, startAfter = null) {
        try {
            let query = this.reviewsCollection
                .where('reviewedUserId', '==', userId)
                .where('status', '==', 'published')
                .orderBy('createdAt', 'desc')
                .limit(limit);

            if (startAfter) {
                query = query.startAfter(startAfter);
            }

            const snapshot = await query.get();
            const lastVisible = snapshot.docs[snapshot.docs.length - 1];
            
            return {
                reviews: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
                lastVisible: lastVisible || null
            };
        } catch (error) {
            console.error('Error getting user reviews:', error);
            return { reviews: [], lastVisible: null };
        }
    }

    // Get reviews written by a specific user with pagination
    async getReviewsByUser(userId, limit = 10, startAfter = null) {
        try {
            let query = this.reviewsCollection
                .where('authorId', '==', userId)
                .orderBy('createdAt', 'desc')
                .limit(limit);

            if (startAfter) {
                query = query.startAfter(startAfter);
            }

            const snapshot = await query.get();
            const lastVisible = snapshot.docs[snapshot.docs.length - 1];
            
            return {
                reviews: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
                lastVisible: lastVisible || null
            };
        } catch (error) {
            console.error('Error getting reviews by user:', error);
            return { reviews: [], lastVisible: null };
        }
    }

    // Calculate average rating for a user (returns number)
    async getUserAverageRating(userId) {
        try {
            const result = await this.getUserReviews(userId, 100); // Get up to 100 reviews
            const userReviews = result.reviews;
            
            if (userReviews.length === 0) return 0;

            const totalRating = userReviews.reduce((sum, review) => sum + (review.rating || 0), 0);
            // Return as number, not string
            return parseFloat((totalRating / userReviews.length).toFixed(1));
        } catch (error) {
            console.error('Error calculating average rating:', error);
            return 0;
        }
    }

    // Get review statistics for dashboard
    async getReviewStats(userId) {
        try {
            const [userReviewsResult, reviewsByUserResult] = await Promise.all([
                this.getUserReviews(userId, 100),
                this.getReviewsByUser(userId, 100)
            ]);

            const userReviews = userReviewsResult.reviews;
            const reviewsByUser = reviewsByUserResult.reviews;
            const averageRating = await this.getUserAverageRating(userId);

            return {
                totalReceived: userReviews.length,
                totalGiven: reviewsByUser.length,
                averageRating: averageRating,
                ratingBreakdown: this.getRatingBreakdown(userReviews)
            };
        } catch (error) {
            console.error('Error getting review stats:', error);
            return {
                totalReceived: 0,
                totalGiven: 0,
                averageRating: 0,
                ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
            };
        }
    }

    // Get rating distribution
    getRatingBreakdown(reviews) {
        const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        reviews.forEach(review => {
            if (review.rating && breakdown[review.rating] !== undefined) {
                breakdown[review.rating]++;
            }
        });
        return breakdown;
    }

    // Update user's average rating in Firebase (using merge to avoid overwrite)
    async updateUserRating(userId) {
        try {
            const averageRating = await this.getUserAverageRating(userId);
            const userReviewsResult = await this.getUserReviews(userId, 100);
            const reviewCount = userReviewsResult.reviews.length;

            // FIXED: Use set with merge instead of update (prevents errors if doc doesn't exist)
            await this.usersCollection.doc(userId).set({
                averageRating: averageRating,
                totalReviews: reviewCount,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            console.log(`Updated rating for user ${userId}: ${averageRating} (${reviewCount} reviews)`);
        } catch (error) {
            console.error('Error updating user rating:', error);
        }
    }

    // Render stars (handles invalid ratings)
    renderStars(rating) {
        // Handle invalid input
        let numericRating = typeof rating === 'string' ? parseFloat(rating) : rating;
        if (isNaN(numericRating)) numericRating = 0;
        
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= numericRating) {
                stars += '<i class="fas fa-star"></i>';
            } else if (i - 0.5 <= numericRating) {
                stars += '<i class="fas fa-star-half-alt"></i>';
            } else {
                stars += '<i class="far fa-star"></i>';
            }
        }
        return stars;
    }

    // Render reviews in a container with pagination
    async renderReviews(containerId, userId = null, type = 'received', limit = 10, loadMore = false) {
        const container = document.getElementById(containerId);
        if (!container) return;

        try {
            let result;
            if (type === 'received' && userId) {
                result = await this.getUserReviews(userId, limit, loadMore ? window.lastReviewDoc : null);
            } else if (type === 'given' && userId) {
                result = await this.getReviewsByUser(userId, limit, loadMore ? window.lastReviewDoc : null);
            } else {
                const currentUser = auth.currentUser;
                if (!currentUser) {
                    container.innerHTML = '<div class="no-reviews">Sign in to see your reviews</div>';
                    return;
                }
                result = type === 'given' 
                    ? await this.getReviewsByUser(currentUser.uid, limit, loadMore ? window.lastReviewDoc : null)
                    : await this.getUserReviews(currentUser.uid, limit, loadMore ? window.lastReviewDoc : null);
            }

            const reviews = result.reviews;
            window.lastReviewDoc = result.lastVisible;

            if (!loadMore) {
                if (reviews.length === 0) {
                    container.innerHTML = `
                        <div class="no-reviews">
                            <i class="fas fa-comment-slash"></i>
                            <p>No reviews yet.</p>
                        </div>
                    `;
                    return;
                }
                container.innerHTML = '';
            }

            reviews.forEach(review => {
                const reviewElement = this.createReviewElement(review, type);
                container.appendChild(reviewElement);
            });

            // Add "Load More" button if there are more reviews
            if (result.lastVisible) {
                let loadMoreBtn = document.getElementById(`load-more-${containerId}`);
                if (!loadMoreBtn) {
                    loadMoreBtn = document.createElement('button');
                    loadMoreBtn.id = `load-more-${containerId}`;
                    loadMoreBtn.className = 'btn btn-outline';
                    loadMoreBtn.style.margin = '20px auto';
                    loadMoreBtn.style.display = 'block';
                    loadMoreBtn.innerHTML = '<i class="fas fa-arrow-down"></i> Load More Reviews';
                    loadMoreBtn.addEventListener('click', () => {
                        this.renderReviews(containerId, userId, type, limit, true);
                    });
                    container.appendChild(loadMoreBtn);
                }
            } else {
                const loadMoreBtn = document.getElementById(`load-more-${containerId}`);
                if (loadMoreBtn) loadMoreBtn.remove();
            }
        } catch (error) {
            console.error('Error rendering reviews:', error);
            container.innerHTML = '<p>Error loading reviews.</p>';
        }
    }

    // Create individual review element
    createReviewElement(review, type) {
        const div = document.createElement('div');
        div.className = 'review-item';
        div.innerHTML = `
            <div class="review-header">
                <div class="review-author-info">
                    <div class="review-author">${this.escapeHtml(review.authorName || 'Anonymous')}</div>
                    <div class="review-context">${this.escapeHtml(review.context || 'General')}</div>
                </div>
                <div class="review-rating">
                    ${this.renderStars(review.rating)}
                    <span class="review-date">${this.formatDate(review.createdAt)}</span>
                </div>
            </div>
            <div class="review-content">${this.escapeHtml(review.comment || 'No comment provided.')}</div>
            ${review.response ? `
                <div class="review-response">
                    <strong>Response:</strong>
                    <p>${this.escapeHtml(review.response)}</p>
                </div>
            ` : ''}
            ${type === 'received' && !review.response ? `
                <div class="review-actions">
                    <button class="btn btn-sm btn-outline respond-review-btn" data-review-id="${review.id}">Respond</button>
                </div>
            ` : ''}
        `;

        const respondBtn = div.querySelector('.respond-review-btn');
        if (respondBtn) {
            respondBtn.addEventListener('click', () => {
                this.showRespondModal(review.id, review.authorName);
            });
        }

        return div;
    }

    // Show respond modal
    showRespondModal(reviewId, authorName) {
        const modalContent = `
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <div class="modal-title">Respond to ${this.escapeHtml(authorName)}</div>
                    <button class="close-modal-btn">&times;</button>
                </div>
                <div style="padding: 20px;">
                    <div class="form-group">
                        <label class="form-label">Your Response</label>
                        <textarea id="response-text" class="form-input" rows="4" placeholder="Thank you for your feedback..."></textarea>
                    </div>
                    <div class="form-actions" style="display: flex; gap: 10px; margin-top: 20px;">
                        <button class="btn btn-outline close-modal-btn">Cancel</button>
                        <button class="btn btn-primary" id="submit-response-btn">Submit Response</button>
                    </div>
                </div>
            </div>
        `;
        
        if (typeof window.showModalWithContent === 'function') {
            window.showModalWithContent('respond-modal', modalContent);
        }
        
        setTimeout(() => {
            const submitBtn = document.getElementById('submit-response-btn');
            if (submitBtn) {
                submitBtn.addEventListener('click', async () => {
                    const response = document.getElementById('response-text')?.value;
                    if (!response) {
                        this.showToast('Please enter a response', 'error');
                        return;
                    }
                    const result = await this.addReviewResponse(reviewId, response);
                    if (result.success) {
                        this.showToast('Response added!', 'success');
                        if (typeof window.closeModal === 'function') {
                            window.closeModal('respond-modal');
                        }
                        // Refresh reviews display
                        const containerId = 'user-reviews-container';
                        const currentUser = auth.currentUser;
                        if (currentUser) {
                            this.renderReviews(containerId, currentUser.uid, 'received', 10);
                        }
                    } else {
                        this.showToast('Error: ' + result.error, 'error');
                    }
                });
            }
        }, 100);
    }

    // Add response to a review
    async addReviewResponse(reviewId, response) {
        try {
            const user = auth.currentUser;
            if (!user) {
                return { success: false, error: 'User must be logged in to respond to reviews' };
            }

            await this.reviewsCollection.doc(reviewId).update({
                response: response,
                respondedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            return { success: true };
        } catch (error) {
            console.error('Error adding review response:', error);
            return { success: false, error: error.message };
        }
    }

    // Show review modal for writing a review (with pre-submission check)
    async showReviewModal(reviewedUserId, reviewedUserName, context = 'service', bookingId = null) {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            this.showToast('Please sign in to leave a review', 'warning');
            if (typeof window.openAuthModal === 'function') window.openAuthModal();
            return;
        }

        // Check if user can review (pre-submission check)
        const canReview = await this.canUserReview(reviewedUserId, context, bookingId);
        if (!canReview) {
            this.showToast('You have already reviewed this user/service', 'warning');
            return;
        }

        const modalContent = `
            <div class="review-modal-content">
                <div class="modal-header">
                    <div class="modal-title">Review ${this.escapeHtml(reviewedUserName)}</div>
                    <button class="close-modal-btn">&times;</button>
                </div>
                <div style="padding: 20px;">
                    <div class="form-group">
                        <label>Rating</label>
                        <div class="star-rating-input">
                            ${[1,2,3,4,5].map(i => `
                                <i class="far fa-star" data-rating="${i}" style="font-size: 1.5rem; cursor: pointer; color: var(--warning);"></i>
                            `).join('')}
                        </div>
                        <input type="hidden" id="review-rating" value="0" required>
                    </div>
                    <div class="form-group">
                        <label for="review-comment">Your Review</label>
                        <textarea id="review-comment" class="form-input" placeholder="Share your experience..." rows="4" required></textarea>
                    </div>
                    <input type="hidden" id="reviewed-user-id" value="${reviewedUserId}">
                    <input type="hidden" id="reviewed-user-name" value="${reviewedUserName}">
                    <input type="hidden" id="review-context" value="${context}">
                    ${bookingId ? `<input type="hidden" id="review-booking-id" value="${bookingId}">` : ''}
                    <div class="form-actions" style="display: flex; gap: 10px; margin-top: 20px;">
                        <button class="btn btn-outline close-modal-btn">Cancel</button>
                        <button class="btn btn-primary" id="submit-review-btn">Submit Review</button>
                    </div>
                </div>
            </div>
        `;
        
        if (typeof window.showModalWithContent === 'function') {
            window.showModalWithContent('review-modal', modalContent);
        }

        // Setup star rating
        let selectedRating = 0;
        const stars = document.querySelectorAll('#review-modal .star-rating-input i');
        
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
                document.getElementById('review-rating').value = selectedRating;
            });
        });

        // Setup form submission
        const submitBtn = document.getElementById('submit-review-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', async () => {
                const rating = parseInt(document.getElementById('review-rating').value);
                const comment = document.getElementById('review-comment').value;
                
                if (!rating || rating === 0) {
                    this.showToast('Please select a rating', 'error');
                    return;
                }
                if (!comment.trim()) {
                    this.showToast('Please write a review comment', 'error');
                    return;
                }

                const result = await this.addReview({
                    reviewedUserId: reviewedUserId,
                    reviewedUserName: reviewedUserName,
                    rating: rating,
                    comment: comment.trim(),
                    context: context,
                    bookingId: bookingId
                });

                if (result.success) {
                    this.showToast('Review submitted successfully!', 'success');
                    if (typeof window.closeModal === 'function') {
                        window.closeModal('review-modal');
                    }
                    
                    // Refresh reviews display
                    const container = document.getElementById('user-reviews-container');
                    if (container && reviewedUserId === auth.currentUser?.uid) {
                        this.renderReviews('user-reviews-container', reviewedUserId, 'received', 10);
                    }
                    
                    // Update stats
                    this.updateReviewStats();
                } else {
                    this.showToast('Error: ' + result.error, 'error');
                }
            });
        }
    }

    // Check if user can review (hasn't reviewed before for same context)
    async canUserReview(reviewedUserId, context = 'service', bookingId = null) {
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) return false;

            let query = this.reviewsCollection
                .where('authorId', '==', currentUser.uid)
                .where('reviewedUserId', '==', reviewedUserId)
                .where('context', '==', context);

            // If bookingId is provided, use it for more specific check
            if (bookingId) {
                query = query.where('bookingId', '==', bookingId);
            }

            const snapshot = await query.get();
            return snapshot.empty;
        } catch (error) {
            console.error('Error checking if user can review:', error);
            return false;
        }
    }

    // Get recent reviews for dashboard
    async getRecentReviews(limit = 10) {
        try {
            const snapshot = await this.reviewsCollection
                .where('status', '==', 'published')
                .orderBy('createdAt', 'desc')
                .limit(limit)
                .get();

            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting recent reviews:', error);
            return [];
        }
    }

    // Delete a review (author only)
    async deleteReview(reviewId) {
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                return { success: false, error: 'User must be logged in to delete reviews' };
            }

            const reviewDoc = await this.reviewsCollection.doc(reviewId).get();
            if (!reviewDoc.exists) {
                return { success: false, error: 'Review not found' };
            }

            if (reviewDoc.data().authorId !== currentUser.uid) {
                return { success: false, error: 'You can only delete your own reviews' };
            }

            await this.reviewsCollection.doc(reviewId).delete();
            
            // Update the reviewed user's rating
            await this.updateUserRating(reviewDoc.data().reviewedUserId);

            return { success: true };
        } catch (error) {
            console.error('Error deleting review:', error);
            return { success: false, error: error.message };
        }
    }

    // Update review stats in UI
    async updateReviewStats() {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        try {
            const stats = await this.getReviewStats(currentUser.uid);
            
            // Update review count in profile
            const reviewCountElements = document.querySelectorAll('.profile-stat-value');
            if (reviewCountElements.length >= 3) {
                reviewCountElements[2].textContent = stats.totalReceived;
            }

            // Update rating display
            const ratingElement = document.querySelector('.profile-rating-value');
            if (ratingElement) {
                ratingElement.textContent = stats.averageRating.toFixed(1);
            }

            // Update star rating display
            const starRatingElement = document.querySelector('.profile-star-rating');
            if (starRatingElement) {
                starRatingElement.innerHTML = this.renderStars(stats.averageRating);
            }
        } catch (error) {
            console.error('Error updating review stats:', error);
        }
    }

    // Helper: Escape HTML
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Helper: Format date
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

    // Helper: Show toast
    showToast(message, type) {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            console.log(`${type}: ${message}`);
        }
    }
}

// ========== GLOBAL FUNCTIONS ==========
const reviewsManager = new ReviewsManager();

// Make available globally
window.reviewsManager = reviewsManager;
window.reviews = reviewsManager; // Backward compatibility

// Global functions for UI interactions
window.showReviewModal = function(reviewedUserId, reviewedUserName, context = 'service', bookingId = null) {
    reviewsManager.showReviewModal(reviewedUserId, reviewedUserName, context, bookingId);
};

// Initialize when auth state changes
auth.onAuthStateChanged(user => {
    if (user) {
        reviewsManager.updateReviewStats();
    }
});

console.log('✅ Reviews.js fully loaded with all fixes');