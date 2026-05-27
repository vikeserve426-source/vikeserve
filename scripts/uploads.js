// ========== UPLOAD MANAGER - COMPLETE FIXED VERSION ==========
// Handles file uploads to Firebase Storage with compression and progress tracking

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
if (typeof window.showModal !== 'function') {
    window.showModal = function(id) {
        const modal = document.getElementById(id);
        if (modal) modal.style.display = 'flex';
    };
}

class UploadManager {
    constructor() {
        this.storage = storage;
        this.db = db;
        this.auth = auth;
        this.currentUploads = new Map();
        
        // FIXED: Use propertyListings instead of housing
        this.fileUploadsCollection = collections.fileUploads ? collections.fileUploads() : null;
        this.usersCollection = collections.users();
        this.propertyCollection = collections.propertyListings(); // FIXED
        this.marketplaceCollection = collections.marketplaceItems();
        
        this.init();
    }

    init() {
        console.log('Upload Manager initialized with Firebase Storage');
        this.setupUploadListeners();
    }

    setupUploadListeners() {
        const userMenuUpload = document.getElementById('user-menu-picture-upload');
        if (userMenuUpload) {
            userMenuUpload.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openImageUploader('profile');
            });
        }

        const profileUpload = document.getElementById('profile-picture-upload');
        if (profileUpload) {
            profileUpload.addEventListener('click', () => {
                this.openImageUploader('profile');
            });
        }

        const propertyUpload = document.querySelector('.property-image-upload');
        if (propertyUpload) {
            propertyUpload.addEventListener('click', () => {
                this.openImageUploader('property', { multiple: true });
            });
        }

        this.setupUploadHoverEffects();
    }

    setupUploadHoverEffects() {
        const uploadAreas = ['user-menu-picture-upload', 'profile-picture-upload'];

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

    openImageUploader(type, options = {}) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/jpeg,image/jpg,image/png,image/gif,image/webp';
        input.multiple = options.multiple || false;
        
        input.onchange = (e) => {
            const files = Array.from(e.target.files);
            this.handleFileUpload(files, type, options);
        };
        
        input.click();
    }

    // Compress image before upload
    async compressImage(file, maxWidth = 1024, maxHeight = 1024, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                    
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    canvas.toBlob((blob) => {
                        const compressedFile = new File([blob], file.name, {
                            type: file.type,
                            lastModified: Date.now()
                        });
                        resolve(compressedFile);
                    }, file.type, quality);
                };
                img.onerror = reject;
            };
            reader.onerror = reject;
        });
    }

    async handleFileUpload(files, type, options = {}) {
        const user = this.auth.currentUser;
        if (!user) {
            this.showToast('Please sign in to upload files', 'error');
            return;
        }

        // Validate files
        const validFiles = [];
        for (const file of files) {
            const validation = this.validateFile(file, type);
            if (validation.valid) {
                // Compress image before adding to valid files
                if (file.type.startsWith('image/')) {
                    try {
                        const compressed = await this.compressImage(file);
                        validFiles.push(compressed);
                    } catch (error) {
                        console.error('Compression failed, using original:', error);
                        validFiles.push(file);
                    }
                } else {
                    validFiles.push(file);
                }
            } else {
                this.showToast(validation.message, 'error');
            }
        }
        
        if (validFiles.length === 0) return;

        // Show upload progress
        this.showUploadProgress(validFiles, type);

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
            this.hideUploadProgress();
        }
    }

    validateFile(file, type) {
        const maxSize = this.getMaxFileSize(type);
        const allowedTypes = this.getAllowedFileTypes(type);

        if (file.size > maxSize) {
            return { valid: false, message: `File too large. Maximum size: ${this.formatFileSize(maxSize)}` };
        }

        if (!allowedTypes.includes(file.type)) {
            return { valid: false, message: `File type not allowed. Allowed: ${allowedTypes.map(t => t.split('/')[1]).join(', ')}` };
        }

        return { valid: true, message: '' };
    }

    getMaxFileSize(type) {
        const sizes = {
            'profile': 2 * 1024 * 1024,
            'property': 5 * 1024 * 1024,
            'marketplace': 5 * 1024 * 1024,
            'document': 10 * 1024 * 1024,
            'default': 5 * 1024 * 1024
        };
        return sizes[type] || sizes.default;
    }

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

    async uploadFile(file, type, options = {}, index = 0) {
        const user = this.auth.currentUser;
        const uploadId = `${type}_${Date.now()}_${index}`;
        
        try {
            const fileExtension = file.name.split('.').pop();
            const filename = `${type}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExtension}`;
            
            // FIXED: Include userId in temp path to avoid collisions
            const storagePath = this.getStoragePath(type, user.uid, filename, options);
            
            const storageRef = this.storage.ref(storagePath);
            
            if (options.multiple) {
                this.simulateProgress(uploadId, file.name);
            } else {
                this.updateSingleFileProgress(0, file.name);
            }
            
            const snapshot = await storageRef.put(file);
            const downloadURL = await snapshot.ref.getDownloadURL();
            
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

            if (options.saveToFirestore !== false && this.fileUploadsCollection) {
                await this.saveFileMetadata(fileData);
            }

            if (options.multiple) {
                this.updateUploadProgress(uploadId, 100, file.name, 'Completed');
            } else {
                this.updateSingleFileProgress(100, file.name);
            }
            
            return { success: true, data: fileData, file: file };

        } catch (error) {
            console.error('File upload error:', error);
            if (options.multiple) {
                this.updateUploadProgress(uploadId, -1, file.name, error.message);
            } else {
                this.updateSingleFileProgress(-1, file.name);
            }
            return { success: false, error: error.message, file: file };
        }
    }

    updateSingleFileProgress(progress, fileName) {
        const progressContainer = document.getElementById('single-upload-progress');
        if (!progressContainer) {
            const container = document.createElement('div');
            container.id = 'single-upload-progress';
            container.style.cssText = 'position: fixed; bottom: 100px; left: 20px; right: 20px; background: white; border-radius: 10px; padding: 15px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); z-index: 10001;';
            container.innerHTML = `
                <div style="font-size: 0.8rem; margin-bottom: 8px;">Uploading: <span id="upload-filename">${fileName}</span></div>
                <div class="progress-bar" style="height: 8px; background: var(--grey); border-radius: 4px; overflow: hidden;">
                    <div class="progress-fill" style="width: 0%; height: 100%; background: var(--primary); transition: width 0.3s;"></div>
                </div>
                <div class="progress-text" style="font-size: 0.7rem; margin-top: 5px;">0%</div>
            `;
            document.body.appendChild(container);
        }
        
        const progressFill = document.querySelector('#single-upload-progress .progress-fill');
        const progressText = document.querySelector('#single-upload-progress .progress-text');
        const filenameSpan = document.getElementById('upload-filename');
        
        if (filenameSpan) filenameSpan.textContent = fileName;
        
        if (progress === -1) {
            if (progressFill) progressFill.style.background = 'var(--danger)';
            if (progressText) progressText.textContent = 'Failed';
            setTimeout(() => {
                const container = document.getElementById('single-upload-progress');
                if (container) container.remove();
            }, 2000);
        } else if (progress === 100) {
            if (progressFill) progressFill.style.width = '100%';
            if (progressFill) progressFill.style.background = 'var(--success)';
            if (progressText) progressText.textContent = 'Complete!';
            setTimeout(() => {
                const container = document.getElementById('single-upload-progress');
                if (container) container.remove();
            }, 1500);
        } else {
            if (progressFill) progressFill.style.width = `${progress}%`;
            if (progressText) progressText.textContent = `${Math.round(progress)}%`;
        }
    }

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
        
        this.currentUploads.set(uploadId, interval);
    }

    getStoragePath(type, userId, filename, options) {
        // FIXED: Include userId in all paths to avoid collisions
        const paths = {
            'profile': `users/${userId}/profile-pictures/${filename}`,
            'property': `properties/${options.propertyId || `temp_${userId}`}/images/${filename}`,
            'marketplace': `marketplace/${options.itemId || `temp_${userId}`}/images/${filename}`,
            'document': `documents/${userId}/${filename}`,
            'default': `uploads/${userId}/${type}/${filename}`
        };
        return paths[type] || paths.default;
    }

    async saveFileMetadata(fileData) {
        try {
            await this.fileUploadsCollection.add({
                ...fileData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error saving file metadata:', error);
        }
    }

    showUploadProgress(files, type) {
        const progressHTML = `
            <div class="upload-progress-modal" style="padding: 20px;">
                <div class="modal-header">
                    <h3>Uploading ${files.length} ${type} ${files.length === 1 ? 'file' : 'files'}</h3>
                    <button class="close-modal" onclick="uploadManager.hideUploadProgress()">&times;</button>
                </div>
                <div class="upload-progress-list" id="upload-progress-list" style="max-height: 300px; overflow-y: auto;">
                    ${files.map((file, index) => `
                        <div class="upload-item" id="upload-${type}_${Date.now()}_${index}" style="padding: 10px; border-bottom: 1px solid var(--grey);">
                            <div class="upload-info" style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <div class="file-name">${this.escapeHtml(file.name)}</div>
                                <div class="file-size">${this.formatFileSize(file.size)}</div>
                            </div>
                            <div class="upload-progress" style="display: flex; align-items: center; gap: 10px;">
                                <div class="progress-bar" style="flex: 1; height: 8px; background: var(--grey); border-radius: 4px; overflow: hidden;">
                                    <div class="progress-fill" style="width: 0%; height: 100%; background: var(--primary); transition: width 0.3s;"></div>
                                </div>
                                <div class="progress-text" style="font-size: 0.7rem; min-width: 45px;">0%</div>
                            </div>
                            <div class="upload-status" style="margin-top: 5px;">
                                <i class="fas fa-clock"></i>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="upload-actions" style="margin-top: 15px;">
                    <button class="btn btn-outline" onclick="uploadManager.cancelAllUploads()">Cancel All</button>
                </div>
            </div>
        `;

        this.showModalWithContent('upload-progress-modal', progressHTML);
    }

    updateUploadProgress(uploadId, progress, fileName, status = '') {
        const uploadItem = document.getElementById(`upload-${uploadId}`);
        if (!uploadItem) return;

        const progressFill = uploadItem.querySelector('.progress-fill');
        const progressText = uploadItem.querySelector('.progress-text');
        const statusIcon = uploadItem.querySelector('.upload-status i');

        if (progress === -1) {
            if (progressFill) {
                progressFill.style.width = '100%';
                progressFill.style.background = 'var(--danger)';
            }
            if (progressText) progressText.textContent = 'Failed';
            if (statusIcon) {
                statusIcon.className = 'fas fa-exclamation-circle';
                statusIcon.style.color = 'var(--danger)';
            }
            if (status && progressText) progressText.textContent = status;
        } else if (progress === 100) {
            if (progressFill) {
                progressFill.style.width = '100%';
                progressFill.style.background = 'var(--success)';
            }
            if (progressText) progressText.textContent = 'Completed';
            if (statusIcon) {
                statusIcon.className = 'fas fa-check-circle';
                statusIcon.style.color = 'var(--success)';
            }
        } else {
            if (progressFill) progressFill.style.width = `${progress}%`;
            if (progressText) progressText.textContent = `${Math.round(progress)}%`;
            if (statusIcon) {
                statusIcon.className = 'fas fa-spinner fa-spin';
                statusIcon.style.color = 'var(--primary)';
            }
        }
    }

    hideUploadProgress() {
        this.currentUploads.forEach((interval) => {
            clearInterval(interval);
        });
        this.currentUploads.clear();
        
        const modal = document.getElementById('upload-progress-modal');
        if (modal) {
            modal.remove();
        }
    }

    cancelAllUploads() {
        this.showToast('Canceling uploads...', 'info');
        this.hideUploadProgress();
    }

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

    async handleProfilePictureUpload(fileData) {
        try {
            const user = this.auth.currentUser;
            
            await user.updateProfile({
                photoURL: fileData.url
            });

            const userDocRef = this.usersCollection.doc(user.uid);
            await userDocRef.update({
                photoURL: fileData.url,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            this.updateProfilePictureInUI(fileData.url);
            this.showToast('Profile picture updated successfully', 'success');
        } catch (error) {
            console.error('Error updating profile picture:', error);
            this.showToast('Error updating profile picture: ' + error.message, 'error');
        }
    }

    async handlePropertyImagesUpload(files, options) {
        try {
            if (options.propertyId) {
                const propertyRef = this.propertyCollection.doc(options.propertyId);
                const currentImages = options.currentImages || [];
                const newImages = files.map(file => file.url);
                const updatedImages = [...currentImages, ...newImages];

                await propertyRef.update({
                    images: updatedImages,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                this.updatePropertyImagesInUI(updatedImages);
            } else {
                this.storeTemporaryImages(files, 'property');
            }
        } catch (error) {
            console.error('Error updating property images:', error);
            this.showToast('Error updating property images: ' + error.message, 'error');
        }
    }

    async handleMarketplaceImagesUpload(files, options) {
        try {
            if (options.itemId) {
                const itemRef = this.marketplaceCollection.doc(options.itemId);
                const currentImages = options.currentImages || [];
                const newImages = files.map(file => file.url);
                const updatedImages = [...currentImages, ...newImages];

                await itemRef.update({
                    images: updatedImages,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                this.updateMarketplaceImagesInUI(updatedImages);
            } else {
                this.storeTemporaryImages(files, 'marketplace');
            }
        } catch (error) {
            console.error('Error updating marketplace images:', error);
            this.showToast('Error updating marketplace images: ' + error.message, 'error');
        }
    }

    handleGenericUpload(files, type) {
        this.storeTemporaryImages(files, type);
        console.log(`Generic upload completed for ${type}:`, files);
    }

    storeTemporaryImages(files, type) {
        const key = `temp_${type}_images`;
        const currentFiles = JSON.parse(sessionStorage.getItem(key) || '[]');
        const updatedFiles = [...currentFiles, ...files];
        sessionStorage.setItem(key, JSON.stringify(updatedFiles));
    }

    getTemporaryImages(type) {
        const key = `temp_${type}_images`;
        return JSON.parse(sessionStorage.getItem(key) || '[]');
    }

    clearTemporaryImages(type) {
        const key = `temp_${type}_images`;
        sessionStorage.removeItem(key);
    }

    updateProfilePictureInUI(imageUrl) {
        const userMenuAvatar = document.getElementById('user-menu-picture-upload');
        if (userMenuAvatar) {
            const span = userMenuAvatar.querySelector('span');
            if (span) {
                span.textContent = '';
                span.style.display = 'none';
            }
            userMenuAvatar.style.backgroundImage = `url(${imageUrl})`;
            userMenuAvatar.style.backgroundSize = 'cover';
            userMenuAvatar.style.backgroundPosition = 'center';
        }
        
        const profileAvatar = document.getElementById('profile-picture-upload');
        if (profileAvatar) {
            const span = profileAvatar.querySelector('span');
            if (span) {
                span.textContent = '';
                span.style.display = 'none';
            }
            profileAvatar.style.backgroundImage = `url(${imageUrl})`;
            profileAvatar.style.backgroundSize = 'cover';
            profileAvatar.style.backgroundPosition = 'center';
        }
        
        const profileAvatarText = document.getElementById('profile-avatar');
        if (profileAvatarText) {
            profileAvatarText.textContent = '';
            profileAvatarText.style.backgroundImage = `url(${imageUrl})`;
            profileAvatarText.style.backgroundSize = 'cover';
            profileAvatarText.style.backgroundPosition = 'center';
            profileAvatarText.style.color = 'transparent';
        }
        
        const avatarElements = document.querySelectorAll('.user-avatar, .profile-avatar');
        avatarElements.forEach(avatar => {
            if (avatar.id !== 'profile-picture-upload' && avatar.id !== 'user-menu-picture-upload') {
                avatar.style.backgroundImage = `url(${imageUrl})`;
                avatar.style.backgroundSize = 'cover';
                avatar.style.backgroundPosition = 'center';
                avatar.style.color = 'transparent';
                if (avatar.textContent) avatar.textContent = '';
            }
        });
    }

    updatePropertyImagesInUI(imageUrls) {
        const propertyImageContainer = document.getElementById('property-images-container');
        if (propertyImageContainer) {
            propertyImageContainer.innerHTML = imageUrls.map((url, index) => `
                <div class="image-preview-item" data-index="${index}" data-url="${url}">
                    <img src="${url}" alt="Property image" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;">
                    <button type="button" class="remove-image-btn" onclick="uploadManager.deletePropertyImage('${url}')">&times;</button>
                </div>
            `).join('');
        }
    }

    updateMarketplaceImagesInUI(imageUrls) {
        const marketplaceImageContainer = document.getElementById('marketplace-images-container');
        if (marketplaceImageContainer) {
            marketplaceImageContainer.innerHTML = imageUrls.map((url, index) => `
                <div class="image-preview-item" data-index="${index}" data-url="${url}">
                    <img src="${url}" alt="Marketplace item" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;">
                    <button type="button" class="remove-image-btn" onclick="uploadManager.deleteMarketplaceImage('${url}')">&times;</button>
                </div>
            `).join('');
        }
    }

    // FIXED: Delete image and remove from Firestore
    async deletePropertyImage(imageUrl) {
        try {
            const storageRef = this.storage.refFromURL(imageUrl);
            await storageRef.delete();
            
            // Also remove from Firestore if associated with a property
            const propertyId = this.getCurrentPropertyId();
            if (propertyId) {
                const propertyRef = this.propertyCollection.doc(propertyId);
                const propertyDoc = await propertyRef.get();
                if (propertyDoc.exists) {
                    const currentImages = propertyDoc.data().images || [];
                    const updatedImages = currentImages.filter(img => img !== imageUrl);
                    await propertyRef.update({
                        images: updatedImages,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    this.updatePropertyImagesInUI(updatedImages);
                }
            }
            
            this.showToast('Image deleted successfully', 'success');
            
            const imageElements = document.querySelectorAll(`img[src="${imageUrl}"]`);
            imageElements.forEach(img => {
                const container = img.closest('.image-preview-item');
                if (container) container.remove();
            });
            
        } catch (error) {
            console.error('Error deleting image:', error);
            this.showToast('Error deleting image: ' + error.message, 'error');
        }
    }

    async deleteMarketplaceImage(imageUrl) {
        try {
            const storageRef = this.storage.refFromURL(imageUrl);
            await storageRef.delete();
            
            const itemId = this.getCurrentMarketplaceId();
            if (itemId) {
                const itemRef = this.marketplaceCollection.doc(itemId);
                const itemDoc = await itemRef.get();
                if (itemDoc.exists) {
                    const currentImages = itemDoc.data().images || [];
                    const updatedImages = currentImages.filter(img => img !== imageUrl);
                    await itemRef.update({
                        images: updatedImages,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    this.updateMarketplaceImagesInUI(updatedImages);
                }
            }
            
            this.showToast('Image deleted successfully', 'success');
            
            const imageElements = document.querySelectorAll(`img[src="${imageUrl}"]`);
            imageElements.forEach(img => {
                const container = img.closest('.image-preview-item');
                if (container) container.remove();
            });
            
        } catch (error) {
            console.error('Error deleting image:', error);
            this.showToast('Error deleting image: ' + error.message, 'error');
        }
    }

    getCurrentPropertyId() {
        const propertyModal = document.getElementById('property-post-modal');
        if (propertyModal && propertyModal.style.display === 'flex') {
            return propertyModal.getAttribute('data-property-id') || null;
        }
        return null;
    }

    getCurrentMarketplaceId() {
        const marketplaceModal = document.getElementById('marketplace-post-modal');
        if (marketplaceModal && marketplaceModal.style.display === 'flex') {
            return marketplaceModal.getAttribute('data-item-id') || null;
        }
        return null;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showModal(title, content) {
        if (typeof window.showModal === 'function') {
            window.showModal(title, content);
        } else {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'block';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${this.escapeHtml(title)}</h3>
                        <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                    </div>
                    <div>${content}</div>
                </div>
            `;
            document.body.appendChild(modal);
        }
    }

    showModalWithContent(id, content) {
        if (typeof window.showModalWithContent === 'function') {
            window.showModalWithContent(id, content);
        } else {
            let modal = document.getElementById(id);
            if (!modal) {
                modal = document.createElement('div');
                modal.id = id;
                modal.className = 'modal';
                document.body.appendChild(modal);
            }
            modal.innerHTML = content;
            modal.style.display = 'flex';
        }
    }

    showToast(message, type = 'info') {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            console.log(`${type}: ${message}`);
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize upload manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const uploadManager = new UploadManager();
    window.uploadManager = uploadManager;
    console.log('✅ Upload Manager initialized and ready');
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

window.uploadPropertyImages = uploadPropertyImages;
window.uploadProfilePicture = uploadProfilePicture;
window.uploadMarketplaceImages = uploadMarketplaceImages;

console.log('✅ Uploads.js fully loaded with all fixes');