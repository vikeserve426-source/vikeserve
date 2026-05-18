// uploads.js - File Upload System for VikeServe (Updated for Global Firebase Instances)

// Add this at the top of the file
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
if (typeof window.showModal !== 'function') {
    window.showModal = function(id) {
        const modal = document.getElementById(id);
        if (modal) modal.style.display = 'flex';
    };
}

class UploadManager {
    constructor() {
        // Use global Firebase instances instead of imports - FIXED
        this.storage = storage;
        this.db = db;
        this.auth = auth;
        this.currentUploads = new Map();
        
        // Initialize collections using global collections pattern - FIXED
        this.fileUploadsCollection = collections.fileUploads ? collections.fileUploads() : collections.users(); // Fallback
        this.usersCollection = collections.users();
        this.housingCollection = collections.housing();
        this.marketplaceCollection = collections.marketplaceItems();
        
        this.init();
    }

    init() {
        console.log('Upload Manager initialized');
        this.setupUploadListeners();
    }

    setupUploadListeners() {
        // Profile picture upload from user menu
        const userMenuUpload = document.getElementById('user-menu-picture-upload');
        if (userMenuUpload) {
            userMenuUpload.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openImageUploader('profile');
            });
        }

        // Profile picture upload from profile page
        const profileUpload = document.getElementById('profile-picture-upload');
        if (profileUpload) {
            profileUpload.addEventListener('click', () => {
                this.openImageUploader('profile');
            });
        }

        // Property image upload
        const propertyUpload = document.querySelector('.property-image-upload');
        if (propertyUpload) {
            propertyUpload.addEventListener('click', () => {
                this.openImageUploader('property', { multiple: true });
            });
        }

        // Hover effects for upload areas
        this.setupUploadHoverEffects();
    }

    setupUploadHoverEffects() {
        // Hover effects to upload areas
        const uploadAreas = [
            'user-menu-picture-upload',
            'profile-picture-upload'
        ];

        uploadAreas.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                const overlay = element.querySelector('.upload-overlay');
                if (overlay) {
                    element.addEventListener('mouseenter', () => {
                        overlay.style.opacity = '1';
                    });
                    element.addEventListener('mouseleave', () => {
                        overlay.style.opacity = '0';
                    });
                }
            }
        });
    }

    // Open image uploader
    openImageUploader(type, options = {}) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = options.multiple || false;
        
        input.onchange = (e) => {
            const files = Array.from(e.target.files);
            this.handleFileUpload(files, type, options);
        };
        
        input.click();
    }

    // Handle file upload
    async handleFileUpload(files, type, options = {}) {
        const user = this.auth.currentUser;
        if (!user) {
            this.showToast('Please sign in to upload files', 'error');
            return;
        }

        // Validate files
        const validFiles = files.filter(file => this.validateFile(file, type));
        if (validFiles.length === 0) return;

        // Show upload progress for multiple files
        if (validFiles.length > 1) {
            this.showUploadProgress(validFiles, type);
        }

        try {
            const uploadPromises = validFiles.map((file, index) => 
                this.uploadFile(file, type, options, index)
            );

            const results = await Promise.all(uploadPromises);
            const successfulUploads = results.filter(result => result.success);
            
            if (successfulUploads.length > 0) {
                this.handleUploadSuccess(successfulUploads, type, options);
            }

            if (successfulUploads.length < validFiles.length) {
                this.showToast(`Some files failed to upload. ${successfulUploads.length}/${validFiles.length} successful`, 'warning');
            }

        } catch (error) {
            console.error('Upload error:', error);
            this.showToast('Upload failed: ' + error.message, 'error');
        } finally {
            if (validFiles.length > 1) {
                this.hideUploadProgress();
            }
        }
    }

    // Validate file
    validateFile(file, type) {
        const maxSize = this.getMaxFileSize(type);
        const allowedTypes = this.getAllowedFileTypes(type);

        if (file.size > maxSize) {
            this.showToast(`File too large. Maximum size: ${this.formatFileSize(maxSize)}`, 'error');
            return false;
        }

        if (!allowedTypes.includes(file.type)) {
            this.showToast(`File type not allowed. Allowed: ${allowedTypes.join(', ')}`, 'error');
            return false;
        }

        return true;
    }

    // Get maximum file size based on type
    getMaxFileSize(type) {
        const sizes = {
            'profile': 2 * 1024 * 1024, // 2MB
            'property': 5 * 1024 * 1024, // 5MB
            'marketplace': 5 * 1024 * 1024, // 5MB
            'document': 10 * 1024 * 1024, // 10MB
            'default': 5 * 1024 * 1024 // 5MB
        };
        return sizes[type] || sizes.default;
    }

    // Get allowed file types based on upload type
    getAllowedFileTypes(type) {
        const types = {
            'profile': ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
            'property': ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
            'marketplace': ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
            'document': ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            'default': ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
        };
        return types[type] || types.default;
    }

    // Upload single file
    async uploadFile(file, type, options = {}, index = 0) {
        const user = this.auth.currentUser;
        const uploadId = `${type}_${Date.now()}_${index}`;
        
        try {
            // Generate unique filename
            const fileExtension = file.name.split('.').pop();
            const filename = `${type}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExtension}`;
            
            // Determine storage path
            const storagePath = this.getStoragePath(type, user.uid, filename, options);
            
            // Create storage reference using global storage instance - FIXED
            const storageRef = this.storage.ref(storagePath);
            
            // Start progress simulation for multiple files
            if (options.multiple) {
                this.simulateProgress(uploadId, file.name);
            }
            
            // Upload file using compat API - FIXED
            const snapshot = await storageRef.put(file);
            
            // Get download URL using compat API - FIXED
            const downloadURL = await snapshot.ref.getDownloadURL();
            
            // Create file metadata
            const fileData = {
                name: file.name,
                url: downloadURL,
                type: file.type,
                size: file.size,
                storagePath: storagePath,
                uploadedBy: user.uid,
                uploadedAt: new Date(),
                uploadType: type,
                ...options.metadata
            };

            // Store file metadata in Firestore if needed
            if (options.saveToFirestore !== false) {
                await this.saveFileMetadata(fileData);
            }

            if (options.multiple) {
                this.updateUploadProgress(uploadId, 100, file.name, 'Completed');
            }
            
            return {
                success: true,
                data: fileData,
                file: file
            };

        } catch (error) {
            console.error('File upload error:', error);
            if (options.multiple) {
                this.updateUploadProgress(uploadId, -1, file.name, error.message);
            }
            return {
                success: false,
                error: error.message,
                file: file
            };
        }
    }

    // Simulate upload progress (for multiple files)
    simulateProgress(uploadId, fileName) {
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress >= 90) {
                clearInterval(interval);
            } else {
                this.updateUploadProgress(uploadId, progress, fileName);
            }
        }, 200);
        
        // Store interval for cleanup
        this.currentUploads.set(uploadId, interval);
    }

    // Get storage path based on type
    getStoragePath(type, userId, filename, options) {
        const paths = {
            'profile': `users/${userId}/profile-pictures/${filename}`,
            'property': `properties/${options.propertyId || 'temp'}/images/${filename}`,
            'marketplace': `marketplace/${options.itemId || 'temp'}/images/${filename}`,
            'document': `documents/${userId}/${filename}`,
            'default': `uploads/${userId}/${type}/${filename}`
        };
        return paths[type] || paths.default;
    }

    // Save file metadata to Firestore
    async saveFileMetadata(fileData) {
        try {
            await this.fileUploadsCollection.add({
                ...fileData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp() // FIXED: Use compat API
            });
        } catch (error) {
            console.error('Error saving file metadata:', error);
            // Don't throw error - file upload should still succeed
        }
    }

    // Show upload progress for multiple files
    showUploadProgress(files, type) {
        const progressHTML = `
            <div class="upload-progress-modal">
                <div class="modal-header">
                    <h3>Uploading ${files.length} ${type} ${files.length === 1 ? 'file' : 'files'}</h3>
                    <button class="close-modal" onclick="uploadManager.hideUploadProgress()">&times;</button>
                </div>
                <div class="upload-progress-list" id="upload-progress-list">
                    ${files.map((file, index) => `
                        <div class="upload-item" id="upload-${type}_${Date.now()}_${index}">
                            <div class="upload-info">
                                <div class="file-name">${file.name}</div>
                                <div class="file-size">${this.formatFileSize(file.size)}</div>
                            </div>
                            <div class="upload-progress">
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: 0%"></div>
                                </div>
                                <div class="progress-text">0%</div>
                            </div>
                            <div class="upload-status">
                                <i class="fas fa-clock"></i>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="upload-actions">
                    <button class="btn btn-outline" onclick="uploadManager.cancelAllUploads()">
                        <i class="fas fa-times"></i> Cancel All
                    </button>
                </div>
            </div>
        `;

        this.showModal('Upload Progress', progressHTML);
    }

    // Update upload progress
    updateUploadProgress(uploadId, progress, fileName, status = '') {
        const uploadItem = document.getElementById(`upload-${uploadId}`);
        if (!uploadItem) return;

        const progressFill = uploadItem.querySelector('.progress-fill');
        const progressText = uploadItem.querySelector('.progress-text');
        const statusIcon = uploadItem.querySelector('.upload-status i');

        if (progress === -1) {
            // Error
            progressFill.style.width = '100%';
            progressFill.style.background = 'var(--danger)';
            progressText.textContent = 'Failed';
            statusIcon.className = 'fas fa-exclamation-circle';
            statusIcon.style.color = 'var(--danger)';
            if (status) {
                progressText.textContent = status;
            }
        } else if (progress === 100) {
            // Completed
            progressFill.style.width = '100%';
            progressFill.style.background = 'var(--success)';
            progressText.textContent = 'Completed';
            statusIcon.className = 'fas fa-check-circle';
            statusIcon.style.color = 'var(--success)';
        } else {
            // In progress
            progressFill.style.width = `${progress}%`;
            progressText.textContent = `${Math.round(progress)}%`;
            statusIcon.className = 'fas fa-spinner fa-spin';
            statusIcon.style.color = 'var(--primary)';
        }
    }

    // Hide upload progress
    hideUploadProgress() {
        // Clear all intervals
        this.currentUploads.forEach((interval, uploadId) => {
            clearInterval(interval);
        });
        this.currentUploads.clear();
        
        // Close modal
        const modal = document.querySelector('.upload-progress-modal');
        if (modal) {
            modal.closest('.modal').style.display = 'none';
        }
    }

    // Cancel all uploads
    cancelAllUploads() {
        this.showToast('Canceling uploads...', 'info');
        this.hideUploadProgress();
    }

    // Handle upload success
    handleUploadSuccess(uploads, type, options) {
        const successfulFiles = uploads.map(upload => upload.data);

        switch (type) {
            case 'profile':
                this.handleProfilePictureUpload(successfulFiles[0]);
                break;
            case 'property':
                this.handlePropertyImagesUpload(successfulFiles, options);
                break;
            case 'marketplace':
                this.handleMarketplaceImagesUpload(successfulFiles, options);
                break;
            default:
                this.handleGenericUpload(successfulFiles, type);
        }

        this.showToast(`Successfully uploaded ${successfulFiles.length} ${successfulFiles.length === 1 ? 'file' : 'files'}`, 'success');
    }

    // Handle profile picture upload
    async handleProfilePictureUpload(fileData) {
        try {
            const user = this.auth.currentUser;
            
            // Update user profile in Firebase Auth using compat API - FIXED
            await user.updateProfile({
                photoURL: fileData.url
            });

            // Update user document in Firestore using compat API - FIXED
            const userDocRef = this.usersCollection.doc(user.uid);
            await userDocRef.update({
                photoURL: fileData.url,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Update UI
            this.updateProfilePictureInUI(fileData.url);
            
            this.showToast('Profile picture updated successfully', 'success');
        } catch (error) {
            console.error('Error updating profile picture:', error);
            this.showToast('Error updating profile picture: ' + error.message, 'error');
        }
    }

    // Handle property images upload
    async handlePropertyImagesUpload(files, options) {
        try {
            if (options.propertyId) {
                // Update existing property using compat API - FIXED
                const propertyRef = this.housingCollection.doc(options.propertyId);
                
                // Get current images and add new ones
                const currentImages = options.currentImages || [];
                const newImages = files.map(file => file.url);
                const updatedImages = [...currentImages, ...newImages];

                await propertyRef.update({
                    imageUrls: updatedImages,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                this.updatePropertyImagesInUI(updatedImages);
            } else {
                // Store for new property creation
                this.storeTemporaryImages(files, 'property');
            }
        } catch (error) {
            console.error('Error updating property images:', error);
            this.showToast('Error updating property images: ' + error.message, 'error');
        }
    }

    // Handle marketplace images upload
    async handleMarketplaceImagesUpload(files, options) {
        try {
            if (options.itemId) {
                // Update existing marketplace item using compat API - FIXED
                const itemRef = this.marketplaceCollection.doc(options.itemId);
                
                const currentImages = options.currentImages || [];
                const newImages = files.map(file => file.url);
                const updatedImages = [...currentImages, ...newImages];

                await itemRef.update({
                    imageUrls: updatedImages,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                this.updateMarketplaceImagesInUI(updatedImages);
            } else {
                // Store for new marketplace item creation
                this.storeTemporaryImages(files, 'marketplace');
            }
        } catch (error) {
            console.error('Error updating marketplace images:', error);
            this.showToast('Error updating marketplace images: ' + error.message, 'error');
        }
    }

    // Handle generic upload
    handleGenericUpload(files, type) {
        // Store files for later use
        this.storeTemporaryImages(files, type);
        
        console.log(`Generic upload completed for ${type}:`, files);
    }

    // Store temporary images in session storage
    storeTemporaryImages(files, type) {
        const key = `temp_${type}_images`;
        const currentFiles = JSON.parse(sessionStorage.getItem(key) || '[]');
        const updatedFiles = [...currentFiles, ...files];
        sessionStorage.setItem(key, JSON.stringify(updatedFiles));
    }

    // Get temporary images
    getTemporaryImages(type) {
        const key = `temp_${type}_images`;
        return JSON.parse(sessionStorage.getItem(key) || '[]');
    }

    // Clear temporary images
    clearTemporaryImages(type) {
        const key = `temp_${type}_images`;
        sessionStorage.removeItem(key);
    }

    // Update profile picture in UI (single method)
    updateProfilePictureInUI(imageUrl) {
        // Update user menu avatar
        const userMenuAvatar = document.getElementById('user-menu-picture-upload');
        if (userMenuAvatar) {
            const span = userMenuAvatar.querySelector('span');
            if (span) {
                span.textContent = '';
                userMenuAvatar.style.backgroundImage = `url(${imageUrl})`;
                userMenuAvatar.style.backgroundSize = 'cover';
                userMenuAvatar.style.backgroundPosition = 'center';
            }
        }
        
        // Update profile page avatar
        const profileAvatar = document.getElementById('profile-picture-upload');
        if (profileAvatar) {
            const span = profileAvatar.querySelector('span');
            if (span) {
                span.textContent = '';
                profileAvatar.style.backgroundImage = `url(${imageUrl})`;
                profileAvatar.style.backgroundSize = 'cover';
                profileAvatar.style.backgroundPosition = 'center';
            }
        }
        
        // Update profile avatar text
        const profileAvatarText = document.getElementById('profile-avatar');
        if (profileAvatarText) {
            profileAvatarText.textContent = '';
            profileAvatarText.style.backgroundImage = `url(${imageUrl})`;
            profileAvatarText.style.backgroundSize = 'cover';
            profileAvatarText.style.backgroundPosition = 'center';
        }
        
        // Update any other avatar elements
        const avatarElements = document.querySelectorAll('.user-avatar, .profile-avatar');
        avatarElements.forEach(avatar => {
            if (avatar.id !== 'profile-picture-upload' && avatar.id !== 'user-menu-picture-upload') {
                avatar.style.backgroundImage = `url(${imageUrl})`;
                avatar.style.backgroundSize = 'cover';
                avatar.style.backgroundPosition = 'center';
                if (avatar.textContent) {
                    avatar.textContent = '';
                }
            }
        });
    }

    // Update property images in UI
    updatePropertyImagesInUI(imageUrls) {
        const propertyImageContainer = document.getElementById('property-images-container');
        if (propertyImageContainer) {
            propertyImageContainer.innerHTML = imageUrls.map(url => `
                <div class="property-image-preview">
                    <img src="${url}" alt="Property image" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px;">
                    <button class="delete-image" onclick="uploadManager.deletePropertyImage('${url}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('');
        }
    }

    // Update marketplace images in UI
    updateMarketplaceImagesInUI(imageUrls) {
        const marketplaceImageContainer = document.getElementById('marketplace-images-container');
        if (marketplaceImageContainer) {
            marketplaceImageContainer.innerHTML = imageUrls.map(url => `
                <div class="marketplace-image-preview">
                    <img src="${url}" alt="Marketplace item" style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px;">
                    <button class="delete-image" onclick="uploadManager.deleteMarketplaceImage('${url}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('');
        }
    }

    // Delete property image
    async deletePropertyImage(imageUrl) {
        try {
            // Extract storage path from URL or use metadata
            // Create storage reference using global storage instance - FIXED
            const storageRef = this.storage.refFromURL(imageUrl);
            await storageRef.delete();
            
            this.showToast('Image deleted successfully', 'success');
            
            // Update UI - remove the image from display
            const imageElements = document.querySelectorAll(`img[src="${imageUrl}"]`);
            imageElements.forEach(img => {
                const container = img.closest('.property-image-preview');
                if (container) {
                    container.remove();
                }
            });
            
        } catch (error) {
            console.error('Error deleting image:', error);
            this.showToast('Error deleting image: ' + error.message, 'error');
        }
    }

    // Delete marketplace image
    async deleteMarketplaceImage(imageUrl) {
        try {
            // Create storage reference using global storage instance - FIXED
            const storageRef = this.storage.refFromURL(imageUrl);
            await storageRef.delete();
            
            this.showToast('Image deleted successfully', 'success');
            
            // Update UI - remove the image from display
            const imageElements = document.querySelectorAll(`img[src="${imageUrl}"]`);
            imageElements.forEach(img => {
                const container = img.closest('.marketplace-image-preview');
                if (container) {
                    container.remove();
                }
            });
            
        } catch (error) {
            console.error('Error deleting image:', error);
            this.showToast('Error deleting image: ' + error.message, 'error');
        }
    }

    // Utility methods
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showModal(title, content) {
        // Use your existing modal system
        if (typeof window.showModal === 'function') {
            window.showModal(title, content);
        } else {
            // Fallback modal implementation
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'block';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${title}</h3>
                        <span class="close" onclick="this.parentElement.parentElement.parentElement.style.display='none'">&times;</span>
                    </div>
                    <div>${content}</div>
                </div>
            `;
            document.body.appendChild(modal);
        }
    }

    showToast(message, type = 'info') {
        // Use your existing toast system
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            console.log(`${type}: ${message}`);
        }
    }
}

// Initialize upload manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const uploadManager = new UploadManager();
    window.uploadManager = uploadManager;
    console.log('Upload Manager initialized and ready');
});

// Global functions for HTML onclick
function uploadPropertyImages() {
    if (window.uploadManager) {
        window.uploadManager.openImageUploader('property', { multiple: true });
    }
}

function uploadProfilePicture() {
    if (window.uploadManager) {
        window.uploadManager.openImageUploader('profile', { multiple: false });
    }
}

function uploadMarketplaceImages() {
    if (window.uploadManager) {
        window.uploadManager.openImageUploader('marketplace', { multiple: true });
    }
}

// Make functions globally available
window.uploadPropertyImages = uploadPropertyImages;
window.uploadProfilePicture = uploadProfilePicture;
window.uploadMarketplaceImages = uploadMarketplaceImages;