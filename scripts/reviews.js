// reviews.js - Review management system for VikeServe

class ReviewsManager {
    constructor() {
        // OLD: this.reviews = this.loadReviews();
        // NEW: Use Firebase collections
        this.db = db;
        this.reviewsCollection = firebaseCollections.reviews();
        this.usersCollection = firebaseCollections.users();
    }

    // Add a new review
    async addReview(reviewData) {
        try {
            const user = auth.currentUser;
            if (!user) {
                return { success: false, error: 'User must be logged in to add a review' };
            }

            const review = {
                ...reviewData,
                authorId: user.uid,
                authorName: user.displayName || user.email,
                status: 'published',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // OLD: this.reviews.push(review);
            // NEW: Add to Firebase
            const docRef = await this.reviewsCollection.add(review);
            
            // Update user's average rating
            await this.updateUserRating(review.reviewedUserId);
            
            return { success: true, id: docRef.id };
        } catch (error) {
            console.error('Error adding review:', error);
            return { success: false, error: error.message };
        }
    }

    // Get reviews for a specific user
    async getUserReviews(userId) {
        try {
            // OLD: return this.reviews.filter(review => review.reviewedUserId === userId);
            // NEW:
            const snapshot = await this.reviewsCollection
                .where('reviewedUserId', '==', userId)
                .where('status', '==', 'published')
                .orderBy('createdAt', 'desc')
                .get();

            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting user reviews:', error);
            return [];
        }
    }

    // Get reviews written by a specific user
    async getReviewsByUser(userId) {
        try {
            // OLD: return this.reviews.filter(review => review.authorId === userId);
            // NEW:
            const snapshot = await this.reviewsCollection
                .where('authorId', '==', userId)
                .orderBy('createdAt', 'desc')
                .get();

            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting reviews by user:', error);
            return [];
        }
    }

    // Calculate average rating for a user
    async getUserAverageRating(userId) {
        try {
            // OLD: const userReviews = this.getUserReviews(userId);
            // NEW:
            const userReviews = await this.getUserReviews(userId);
            
            if (userReviews.length === 0) return 0;

            const totalRating = userReviews.reduce((sum, review) => sum + review.rating, 0);
            return (totalRating / userReviews.length).toFixed(1);
        } catch (error) {
            console.error('Error calculating average rating:', error);
            return 0;
        }
    }

    // Get review statistics for dashboard
    async getReviewStats(userId) {
        try {
            // OLD: const userReviews = this.getUserReviews(userId);
            // OLD: const reviewsByUser = this.getReviewsByUser(userId);
            // NEW:
            const [userReviews, reviewsByUser] = await Promise.all([
                this.getUserReviews(userId),
                this.getReviewsByUser(userId)
            ]);

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
            breakdown[review.rating]++;
        });
        return breakdown;
    }

    // Update user's average rating in Firebase
    async updateUserRating(userId) {
        try {
            const userReviews = await this.getUserReviews(userId);
            
            if (userReviews.length === 0) {
                // OLD: Update localStorage
                // NEW: Update Firebase user document
                await this.usersCollection.doc(userId).update({
                    averageRating: 0,
                    totalReviews: 0,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                return;
            }

            const totalRating = userReviews.reduce((sum, review) => sum + review.rating, 0);
            const averageRating = totalRating / userReviews.length;

            // OLD: Update localStorage
            // NEW: Update Firebase user document
            await this.usersCollection.doc(userId).update({
                averageRating: averageRating,
                totalReviews: userReviews.length,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error updating user rating:', error);
        }
    }

    // Update review stats in UI
    async updateReviewStats() {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        try {
            const stats = await this.getReviewStats(currentUser.uid);
            
            // Update the review count in profile
            const reviewCountElement = document.querySelector('.profile-stat-value');
            if (reviewCountElement) {
                reviewCountElement.textContent = stats.totalReceived;
            }

            // Update rating display if exists
            const ratingElement = document.querySelector('.rating span');
            if (ratingElement) {
                ratingElement.textContent = stats.averageRating;
            }

            // Update star rating display
            const starRatingElement = document.querySelector('.star-rating');
            if (starRatingElement) {
                starRatingElement.innerHTML = this.renderStars(parseFloat(stats.averageRating));
            }
        } catch (error) {
            console.error('Error updating review stats:', error);
        }
    }

    // Render reviews in a container
    async renderReviews(containerId, userId = null, type = 'received') {
        const container = document.getElementById(containerId);
        if (!container) return;

        try {
            let reviews = [];
            if (type === 'received' && userId) {
                reviews = await this.getUserReviews(userId);
            } else if (type === 'given' && userId) {
                reviews = await this.getReviewsByUser(userId);
            } else {
                // Get current user's reviews
                const currentUser = auth.currentUser;
                if (currentUser) {
                    reviews = type === 'given' 
                        ? await this.getReviewsByUser(currentUser.uid)
                        : await this.getUserReviews(currentUser.uid);
                }
            }

            if (reviews.length === 0) {
                container.innerHTML = `
                    <div class="no-reviews">
                        <i class="fas fa-comment-slash"></i>
                        <p>No reviews yet.</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = reviews.map(review => `
                <div class="review-item">
                    <div class="review-header">
                        <div class="review-author-info">
                            <div class="review-author">${review.authorName}</div>
                            <div class="review-context">${review.context || 'General'}</div>
                        </div>
                        <div class="review-rating">
                            ${this.renderStars(review.rating)}
                            <span class="review-date">${review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString() : 'Recent'}</span>
                        </div>
                    </div>
                    <div class="review-content">${review.comment}</div>
                    ${review.response ? `
                        <div class="review-response">
                            <strong>Response from ${review.reviewedUserName}:</strong>
                            <p>${review.response}</p>
                        </div>
                    ` : ''}
                </div>
            `).join('');
        } catch (error) {
            console.error('Error rendering reviews:', error);
            container.innerHTML = '<p>Error loading reviews.</p>';
        }
    }

    // Render star rating
    renderStars(rating) {
        const numericRating = typeof rating === 'string' ? parseFloat(rating) : rating;
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

    // Show review modal for writing a review
    showReviewModal(reviewedUserId, reviewedUserName, context = 'service') {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            showToast('Please sign in to leave a review', 'warning');
            return;
        }

        const modalContent = `
            <div class="review-modal-content">
                <div class="modal-header">
                    <h3>Review ${reviewedUserName}</h3>
                    <button class="close-modal" onclick="closeModal()">&times;</button>
                </div>
                <form id="review-form">
                    <div class="form-group">
                        <label>Rating</label>
                        <div class="star-rating-input">
                            ${[1,2,3,4,5].map(i => `
                                <i class="far fa-star" data-rating="${i}" onmouseover="reviews.hoverRating(${i})" 
                                   onmouseout="reviews.resetRating()" onclick="reviews.setRating(${i})"></i>
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
                    <div class="form-actions">
                        <button type="button" class="btn btn-outline" onclick="closeModal()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Submit Review</button>
                    </div>
                </form>
            </div>
        `;

        showModal('Write a Review', modalContent);
        this.setupReviewForm();
    }

    // Hover effect for star rating
    hoverRating(rating) {
        const stars = document.querySelectorAll('.star-rating-input i');
        stars.forEach((star, index) => {
            if (index < rating) {
                star.className = 'fas fa-star';
            } else {
                star.className = 'far fa-star';
            }
        });
    }

    // Reset star rating to selected value
    resetRating() {
        const currentRating = parseInt(document.getElementById('review-rating').value) || 0;
        this.setRating(currentRating);
    }

    // Set rating in review form
    setRating(rating) {
        const stars = document.querySelectorAll('.star-rating-input i');
        stars.forEach((star, index) => {
            if (index < rating) {
                star.className = 'fas fa-star';
            } else {
                star.className = 'far fa-star';
            }
        });
        document.getElementById('review-rating').value = rating;
    }

    // Setup review form submission
    setupReviewForm() {
        const form = document.getElementById('review-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const rating = parseInt(document.getElementById('review-rating').value);
            const comment = document.getElementById('review-comment').value;
            const reviewedUserId = document.getElementById('reviewed-user-id').value;
            const reviewedUserName = document.getElementById('reviewed-user-name').value;
            const context = document.getElementById('review-context').value;

            if (rating === 0) {
                showToast('Please select a rating', 'error');
                return;
            }

            if (!comment.trim()) {
                showToast('Please write a review comment', 'error');
                return;
            }

            const result = await this.addReview({
                reviewedUserId: reviewedUserId,
                reviewedUserName: reviewedUserName,
                rating: rating,
                comment: comment.trim(),
                context: context
            });

            if (result.success) {
                showToast('Review submitted successfully!', 'success');
                closeModal();
                
                // Refresh reviews if on a profile page
                if (document.getElementById('user-reviews-container')) {
                    this.renderReviews('user-reviews-container', reviewedUserId, 'received');
                }
                
                // Update stats
                this.updateReviewStats();
            } else {
                showToast('Error submitting review: ' + result.error, 'error');
            }
        });
    }

    // Add response to a review
    async addReviewResponse(reviewId, response) {
        try {
            const user = auth.currentUser;
            if (!user) {
                return { success: false, error: 'User must be logged in to respond to reviews' };
            }

            // OLD: Update localStorage
            // NEW: Update Firebase review document
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

    // Get recent reviews for dashboard
    async getRecentReviews(limit = 10) {
        try {
            // OLD: return this.reviews.slice(0, limit);
            // NEW:
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

    // Check if user can review (hasn't reviewed before for same context)
    async canUserReview(reviewedUserId, context = 'service') {
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) return false;

            // OLD: Check localStorage
            // NEW: Check Firebase
            const snapshot = await this.reviewsCollection
                .where('authorId', '==', currentUser.uid)
                .where('reviewedUserId', '==', reviewedUserId)
                .where('context', '==', context)
                .get();

            return snapshot.empty;
        } catch (error) {
            console.error('Error checking if user can review:', error);
            return false;
        }
    }

    // Delete a review (author only)
    async deleteReview(reviewId) {
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                return { success: false, error: 'User must be logged in to delete reviews' };
            }

            // Check if user owns the review
            const reviewDoc = await this.reviewsCollection.doc(reviewId).get();
            if (!reviewDoc.exists) {
                return { success: false, error: 'Review not found' };
            }

            if (reviewDoc.data().authorId !== currentUser.uid) {
                return { success: false, error: 'You can only delete your own reviews' };
            }

            // OLD: Remove from localStorage
            // NEW: Delete from Firebase
            await this.reviewsCollection.doc(reviewId).delete();
            
            // Update the reviewed user's rating
            await this.updateUserRating(reviewDoc.data().reviewedUserId);

            return { success: true };
        } catch (error) {
            console.error('Error deleting review:', error);
            return { success: false, error: error.message };
        }
    }
}

// Initialize reviews system
const reviewsManager = new ReviewsManager();

// Make it available globally
window.reviewsManager = reviewsManager;
window.reviews = reviewsManager; // Backward compatibility

// Global functions for UI interactions
window.showReviewModal = function(reviewedUserId, reviewedUserName, context = 'service') {
    reviewsManager.showReviewModal(reviewedUserId, reviewedUserName, context);
};

window.setRating = function(rating) {
    reviewsManager.setRating(rating);
};

window.hoverRating = function(rating) {
    reviewsManager.hoverRating(rating);
};

window.resetRating = function() {
    reviewsManager.resetRating();
};

// Initialize when auth state changes
auth.onAuthStateChanged(user => {
    if (user) {
        // Load reviews for current user
        reviewsManager.updateReviewStats();
    }
});