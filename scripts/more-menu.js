class MoreMenuManager {
    constructor() {
        this.currentMoreTab = 'education';
        this.db = firebase.firestore();
        this.auth = firebase.auth();
        this.currentUser = null;
        this.hasRated = false;
        this.currentChatUnsubscribe = null;
        this.typingUnsubscribe = null;
        this.firstMessageDoc = null;
        this.pendingMessage = null; // Prevent duplicate messages
        this.init();
    }
    
    async init() {
        console.log('More Menu Manager initializing with Firestore...');
        
        this.auth.onAuthStateChanged((user) => {
            this.currentUser = user;
            if (user) {
                this.checkIfUserHasRated();
                this.loadDataFromFirestore();
            }
        });
        
        await this.initializeFirestoreData();
        this.replaceAllTabContent();
        this.setupEventListeners();
        await this.loadDataFromFirestore();
        console.log('✅ More Menu Manager ready with Firestore');
    }
    
    // ... (keep all existing methods until getMessagesHTML, then replace from there)

    getMessagesHTML() {
        return `
            <div class="messages-container" style="display: flex; flex-direction: column; height: 100%; min-height: 400px;">
                <div class="search-bar" style="margin-bottom: 15px;">
                    <i class="fas fa-search search-icon"></i>
                    <input type="text" id="message-search-input" class="search-input" placeholder="Search conversations...">
                </div>
                <div id="conversations-list-container" style="flex: 1; overflow-y: auto; max-height: 400px;">
                    <div class="loading-spinner">Loading conversations...</div>
                </div>
                <div style="text-align: center; margin-top: 20px; flex-shrink: 0;">
                    <button class="new-chat-btn btn btn-primary" style="width: auto; padding: 10px 24px;"><i class="fas fa-plus"></i> Start New Chat</button>
                </div>
            </div>
        `;
    }

    // ========== REPLACE loadConversations() ==========
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
                .limit(50)
                .get();
            
            const conversations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            if (conversations.length === 0) {
                container.innerHTML = '<div class="empty-state">No messages yet. Start a conversation!</div>';
                return;
            }
            
            // Fetch user names for all participants
            const userIds = new Set();
            conversations.forEach(conv => {
                conv.participants.forEach(p => {
                    if (p !== this.currentUser.uid) userIds.add(p);
                });
            });
            
            const userNames = {};
            await Promise.all([...userIds].map(async (uid) => {
                try {
                    const userDoc = await this.db.collection('users').doc(uid).get();
                    if (userDoc.exists) {
                        const data = userDoc.data();
                        userNames[uid] = data.displayName || data.userName || data.name || 'User';
                    } else {
                        userNames[uid] = 'User';
                    }
                } catch (e) {
                    userNames[uid] = 'User';
                }
            }));
            
            // Get unread counts
            const unreadCounts = {};
            for (const conv of conversations) {
                try {
                    const unreadSnapshot = await this.db.collection('chats').doc(conv.id).collection('messages')
                        .where('senderId', '!=', this.currentUser.uid)
                        .where('read', '==', false)
                        .get();
                    unreadCounts[conv.id] = unreadSnapshot.size;
                } catch (e) {
                    unreadCounts[conv.id] = 0;
                }
            }
            
            container.innerHTML = conversations.map(conv => {
                const otherParticipantId = conv.participants.find(p => p !== this.currentUser.uid);
                const otherParticipant = otherParticipantId ? (userNames[otherParticipantId] || 'User') : 'User';
                const unreadCount = unreadCounts[conv.id] || 0;
                const hasUnread = unreadCount > 0;
                const lastMessage = conv.lastMessage || 'No messages';
                const lastMessagePreview = lastMessage.length > 40 ? lastMessage.substring(0, 40) + '...' : lastMessage;
                const time = this.formatDate(conv.lastMessageAt);
                
                return `
                    <div class="conversation-item" data-chat-id="${conv.id}" style="display: flex; align-items: center; gap: 12px; padding: 12px; border-bottom: 1px solid var(--grey); cursor: pointer; ${hasUnread ? 'background: rgba(46, 134, 222, 0.1);' : ''}">
                        <div class="conversation-avatar" style="width: 50px; height: 50px; background: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.2rem; font-weight: bold; flex-shrink: 0;">
                            ${otherParticipant.charAt(0).toUpperCase()}
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div class="conversation-title" style="font-weight: 600; font-size: 0.9rem;">${this.escapeHtml(otherParticipant)}</div>
                            <div class="conversation-last-message" style="font-size: 0.8rem; color: var(--grey-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(lastMessagePreview)}</div>
                        </div>
                        <div style="text-align: right; flex-shrink: 0;">
                            <div class="conversation-time" style="font-size: 0.7rem; color: var(--grey-dark);">${time}</div>
                            ${hasUnread ? `<div class="unread-badge" style="background: var(--primary); color: white; border-radius: 50%; min-width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.6rem; margin-top: 5px; padding: 0 4px;">${unreadCount}</div>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
            
            // Add click handlers
            document.querySelectorAll('.conversation-item').forEach(item => {
                const newItem = item.cloneNode(true);
                item.parentNode.replaceChild(newItem, item);
                newItem.addEventListener('click', () => {
                    this.openChat(newItem.getAttribute('data-chat-id'));
                });
            });
            
        } catch (error) {
            console.error('Error loading conversations:', error);
            container.innerHTML = '<div class="error-state">Error loading messages</div>';
        }
    }

    // ========== REPLACE showChatWindow() ==========
    showChatWindow(chatId, chatData, otherParticipant) {
        const existingContainer = document.getElementById('chat-window-container');
        if (existingContainer) {
            existingContainer.remove();
        }
        
        // Get the other participant's name properly
        let otherName = 'User';
        if (otherParticipant) {
            otherName = otherParticipant.displayName || otherParticipant.userName || otherParticipant.name || 'User';
        } else {
            // Try to get from chatData
            const otherId = chatData.participants?.find(p => p !== this.currentUser?.uid);
            if (otherId) {
                // We'll fetch it
                this.db.collection('users').doc(otherId).get().then(doc => {
                    if (doc.exists) {
                        const data = doc.data();
                        const name = data.displayName || data.userName || data.name || 'User';
                        const nameElement = document.querySelector('#chat-window-container .chat-other-name');
                        if (nameElement) nameElement.textContent = name;
                        const avatarElement = document.querySelector('#chat-window-container .chat-other-avatar');
                        if (avatarElement) avatarElement.textContent = name.charAt(0).toUpperCase();
                    }
                }).catch(() => {});
            }
        }
        
        const otherAvatar = otherName.charAt(0).toUpperCase();
        
        const messagesContent = document.getElementById('messages-content');
        if (messagesContent) {
            messagesContent.innerHTML = '';
            messagesContent.style.overflow = 'hidden';
            messagesContent.style.display = 'flex';
            messagesContent.style.flexDirection = 'column';
            messagesContent.style.height = '100%';
            messagesContent.style.maxHeight = '80vh';
            
            messagesContent.innerHTML = `
                <div id="chat-window-container" style="display: flex; flex-direction: column; height: 100%; background: var(--bg-secondary); border-radius: 12px; overflow: hidden; border: 1px solid var(--border-color);">
                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 15px; background: var(--primary); color: white; flex-shrink: 0;">
                        <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                            <div class="chat-other-avatar" style="width: 40px; height: 40px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.2rem; flex-shrink: 0;">${this.escapeHtml(otherAvatar)}</div>
                            <div style="min-width: 0;">
                                <h3 class="chat-other-name" style="margin: 0; font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(otherName)}</h3>
                                <p id="chat-typing-status" style="font-size: 0.7rem; opacity: 0.8; margin: 0;"></p>
                            </div>
                        </div>
                        <button id="chat-back-btn" style="background: none; border: none; color: white; font-size: 1rem; cursor: pointer; display: flex; align-items: center; gap: 5px; flex-shrink: 0;">
                            <i class="fas fa-arrow-left"></i> Back
                        </button>
                    </div>
                    
                    <div id="chat-messages-area" style="flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 10px; background: var(--bg-tertiary); min-height: 0; max-height: 60vh;">
                        <div class="loading-spinner">Loading messages...</div>
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 10px; padding: 12px 15px; background: var(--bg-secondary); border-top: 1px solid var(--border-color); flex-shrink: 0;">
                        <button id="chat-attach-btn" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--grey-dark); padding: 8px;">
                            <i class="fas fa-paperclip"></i>
                        </button>
                        <textarea id="chat-message-input" placeholder="Type a message..." rows="1" style="flex: 1; border: 1px solid var(--border-color); border-radius: 20px; padding: 10px 15px; resize: none; font-family: inherit; font-size: 0.9rem; background: var(--bg-tertiary); color: var(--text-primary); min-height: 40px; max-height: 100px;"></textarea>
                        <button id="chat-send-btn" style="background: var(--primary); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; flex-shrink: 0;">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            `;
        }
        
        setTimeout(() => {
            const input = document.getElementById('chat-message-input');
            const sendBtn = document.getElementById('chat-send-btn');
            const attachBtn = document.getElementById('chat-attach-btn');
            const backBtn = document.getElementById('chat-back-btn');
            
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        this.sendChatMessage(chatId);
                    }
                });
                
                input.addEventListener('input', function() {
                    this.style.height = 'auto';
                    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
                });
                
                let typingTimeout;
                input.addEventListener('input', () => {
                    this.sendTypingIndicator(chatId, true);
                    clearTimeout(typingTimeout);
                    typingTimeout = setTimeout(() => {
                        this.sendTypingIndicator(chatId, false);
                    }, 1000);
                });
            }
            
            if (sendBtn) {
                const newSendBtn = sendBtn.cloneNode(true);
                sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
                newSendBtn.addEventListener('click', () => this.sendChatMessage(chatId));
            }
            
            if (attachBtn) {
                const newAttachBtn = attachBtn.cloneNode(true);
                attachBtn.parentNode.replaceChild(newAttachBtn, attachBtn);
                newAttachBtn.addEventListener('click', () => this.uploadChatAttachment(chatId));
            }
            
            if (backBtn) {
                const newBackBtn = backBtn.cloneNode(true);
                backBtn.parentNode.replaceChild(newBackBtn, backBtn);
                newBackBtn.addEventListener('click', () => this.closeChatWindow());
            }
        }, 100);
        
        this.loadChatMessages(chatId);
    }

    // ========== REPLACE sendChatMessage() ==========
    async sendChatMessage(chatId) {
        const input = document.getElementById('chat-message-input');
        const message = input?.value.trim();
        
        if (!message) return;
        
        // Prevent duplicate sends
        if (this.pendingMessage === message) {
            console.log('Duplicate message prevented');
            return;
        }
        this.pendingMessage = message;
        
        const sendBtn = document.getElementById('chat-send-btn');
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.innerHTML = '<div class="spinner" style="width: 16px; height: 16px; border: 2px solid white; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block;"></div>';
        }
        
        try {
            const messageData = {
                senderId: this.currentUser.uid,
                senderName: this.currentUser.displayName || this.currentUser.email || 'User',
                text: message,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                read: false
            };
            
            await this.db.collection('chats').doc(chatId).collection('messages').add(messageData);
            
            await this.db.collection('chats').doc(chatId).update({
                lastMessage: message,
                lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessageBy: this.currentUser.uid
            });
            
            input.value = '';
            input.style.height = 'auto';
            this.pendingMessage = null;
            
        } catch (error) {
            console.error('Error sending message:', error);
            this.showToast('Error sending message', 'error');
            this.pendingMessage = null;
        } finally {
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            }
        }
    }

    // ========== REPLACE uploadChatAttachment() ==========
    async uploadChatAttachment(chatId) {
        if (!this.currentUser) {
            this.showToast('Please sign in to upload files', 'warning');
            return;
        }
        
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,application/pdf,.doc,.docx,.txt,.xls,.xlsx';
        input.multiple = true;
        
        input.onchange = async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;
            
            this.showToast(`Uploading ${files.length} file(s)...`, 'info');
            
            const attachments = [];
            let successCount = 0;
            
            for (const file of files) {
                try {
                    if (file.size > 10 * 1024 * 1024) {
                        this.showToast(`${file.name} is too large (max 10MB)`, 'error');
                        continue;
                    }
                    
                    const fileExtension = file.name.split('.').pop();
                    const filename = `chat_attachments/${chatId}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExtension}`;
                    const storageRef = firebase.storage().ref(filename);
                    
                    const uploadTask = await storageRef.put(file);
                    const downloadURL = await uploadTask.ref.getDownloadURL();
                    
                    attachments.push({
                        name: file.name,
                        url: downloadURL,
                        type: file.type,
                        size: file.size,
                        fileType: file.type.startsWith('image/') ? 'image' : 'file'
                    });
                    successCount++;
                } catch (error) {
                    console.error('Error uploading attachment:', error);
                    this.showToast(`Failed to upload ${file.name}`, 'error');
                }
            }
            
            if (attachments.length > 0) {
                const messageData = {
                    senderId: this.currentUser.uid,
                    senderName: this.currentUser.displayName || this.currentUser.email || 'User',
                    attachments: attachments,
                    text: '',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    read: false
                };
                
                await this.db.collection('chats').doc(chatId).collection('messages').add(messageData);
                
                const attachmentText = attachments.length === 1 ? `📎 ${attachments[0].name}` : `📎 ${attachments.length} attachments`;
                
                await this.db.collection('chats').doc(chatId).update({
                    lastMessage: attachmentText,
                    lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastMessageBy: this.currentUser.uid
                });
                
                this.showToast(`${successCount} file(s) uploaded successfully!`, 'success');
                this.loadChatMessages(chatId);
            }
        };
        
        input.click();
    }

    // ========== REPLACE appendNewMessage() ==========
    appendNewMessage(message) {
        const messagesContainer = document.getElementById('chat-messages-area');
        if (!messagesContainer) return;
        
        // Remove empty state if present
        const emptyState = messagesContainer.querySelector('.empty-chat');
        if (emptyState) {
            messagesContainer.innerHTML = '';
        }
        
        // Check if message already exists (prevent duplicates)
        const existingMessages = messagesContainer.querySelectorAll('.chat-message');
        for (const el of existingMessages) {
            if (el.getAttribute('data-message-id') === message.id) {
                return; // Message already exists
            }
        }
        
        const msgElement = this.createMessageElement(message);
        msgElement.setAttribute('data-message-id', message.id || Date.now());
        messagesContainer.appendChild(msgElement);
        this.scrollToBottom(messagesContainer);
    }

    // ========== REPLACE createMessageElement() ==========
    createMessageElement(message) {
        const isCurrentUser = message.senderId === this.currentUser?.uid;
        
        const div = document.createElement('div');
        div.className = `chat-message ${isCurrentUser ? 'user' : 'other'}`;
        div.style.cssText = `display: flex; flex-direction: column; margin-bottom: 12px; ${isCurrentUser ? 'align-items: flex-end;' : 'align-items: flex-start;'} max-width: 100%;`;
        
        let attachmentsHtml = '';
        if (message.attachments && message.attachments.length > 0) {
            attachmentsHtml = '<div style="margin-bottom: 8px; max-width: 100%;">';
            for (const att of message.attachments) {
                const isImage = att.type && att.type.startsWith('image/');
                const fileSize = this.formatFileSize(att.size);
                
                if (isImage) {
                    attachmentsHtml += `
                        <div onclick="window.open('${att.url}', '_blank')" style="margin: 5px 0; cursor: pointer; display: inline-block; max-width: 100%;">
                            <img src="${att.url}" alt="${this.escapeHtml(att.name)}" style="max-width: 200px; max-height: 150px; border-radius: 12px; object-fit: cover;">
                            <div style="font-size: 0.7rem; text-align: center; margin-top: 4px; word-break: break-all;">${this.escapeHtml(att.name)}</div>
                        </div>
                    `;
                } else {
                    attachmentsHtml += `
                        <div onclick="window.open('${att.url}', '_blank')" style="display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: rgba(0,0,0,0.08); border-radius: 10px; margin: 5px 0; cursor: pointer; max-width: 100%;">
                            <div style="font-size: 1.5rem; flex-shrink: 0;"><i class="fas fa-file-${this.getFileIcon(att.name)}"></i></div>
                            <div style="flex: 1; overflow: hidden; min-width: 0;">
                                <div style="font-size: 0.8rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(att.name)}</div>
                                <div style="font-size: 0.65rem; opacity: 0.7;">${fileSize}</div>
                            </div>
                            <div style="flex-shrink: 0;"><i class="fas fa-download"></i></div>
                        </div>
                    `;
                }
            }
            attachmentsHtml += '</div>';
        }
        
        const messageText = message.text ? `<div style="word-wrap: break-word; max-width: 100%;">${this.escapeHtml(message.text)}</div>` : '';
        const messageTime = this.formatChatTime(message.timestamp);
        const statusIcon = isCurrentUser ? 
            `<span style="margin-left: 5px;"><i class="fas ${message.read ? 'fa-check-double' : 'fa-check'}" style="${message.read ? 'color: #4CAF50;' : 'color: #999;'}"></i></span>` : '';
        
        div.innerHTML = `
            <div style="max-width: 85%; padding: 10px 14px; border-radius: 18px; background: ${isCurrentUser ? 'var(--primary)' : 'var(--bg-secondary)'}; color: ${isCurrentUser ? 'white' : 'var(--text-primary)'}; box-shadow: 0 1px 2px rgba(0,0,0,0.1); ${isCurrentUser ? 'border-bottom-right-radius: 4px;' : 'border-bottom-left-radius: 4px;'} word-wrap: break-word; overflow-wrap: break-word; max-width: 100%;">
                ${attachmentsHtml}
                ${messageText}
                <div style="display: flex; justify-content: flex-end; align-items: center; gap: 5px; margin-top: 5px;">
                    <span style="font-size: 0.65rem; opacity: 0.7;">${messageTime}</span>
                    ${statusIcon}
                </div>
            </div>
        `;
        
        return div;
    }

    // ========== REPLACE loadChatMessages() ==========
    async loadChatMessages(chatId, loadMore = false) {
        const messagesContainer = document.getElementById('chat-messages-area');
        if (!messagesContainer) return;
        
        try {
            let query = this.db.collection('chats').doc(chatId).collection('messages')
                .orderBy('timestamp', 'asc');
            
            if (loadMore && this.firstMessageDoc) {
                query = query.endBefore(this.firstMessageDoc);
            }
            
            const snapshot = await query.limit(50).get();
            
            if (snapshot.empty && !loadMore) {
                messagesContainer.innerHTML = `
                    <div class="empty-chat" style="text-align: center; padding: 40px; color: var(--grey-dark);">
                        <i class="fas fa-comments" style="font-size: 3rem; margin-bottom: 15px;"></i>
                        <p>No messages yet. Start the conversation!</p>
                        <p style="font-size: 0.8rem;">You can send text, images, PDFs, and other files.</p>
                    </div>
                `;
                return;
            }
            
            const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            if (snapshot.docs.length > 0 && !loadMore) {
                this.firstMessageDoc = snapshot.docs[0];
            }
            
            // Clear container if not loading more
            if (!loadMore) {
                messagesContainer.innerHTML = '';
            } else {
                // For load more, we need to prepend
                const oldScrollHeight = messagesContainer.scrollHeight;
                const oldScrollTop = messagesContainer.scrollTop;
                
                // Remove existing load more button
                const existingBtn = document.getElementById('chat-load-more-btn');
                if (existingBtn) existingBtn.remove();
                
                // Add messages at the top
                messages.forEach(msg => {
                    const msgElement = this.createMessageElement(msg);
                    msgElement.setAttribute('data-message-id', msg.id || Date.now());
                    messagesContainer.insertBefore(msgElement, messagesContainer.firstChild);
                });
                
                // Restore scroll position
                const newScrollHeight = messagesContainer.scrollHeight;
                messagesContainer.scrollTop = newScrollHeight - oldScrollHeight + oldScrollTop;
                
                // Add load more button again if needed
                if (snapshot.docs.length >= 50) {
                    this.addLoadMoreButton(chatId, messagesContainer);
                }
                return;
            }
            
            // Add messages normally
            messages.forEach(msg => {
                const msgElement = this.createMessageElement(msg);
                msgElement.setAttribute('data-message-id', msg.id || Date.now());
                messagesContainer.appendChild(msgElement);
            });
            
            this.scrollToBottom(messagesContainer);
            
            // Add load more button if there are more messages
            if (snapshot.docs.length >= 50) {
                this.addLoadMoreButton(chatId, messagesContainer);
            }
            
        } catch (error) {
            console.error('Error loading messages:', error);
            messagesContainer.innerHTML = '<div class="error-state" style="text-align: center; padding: 20px; color: var(--danger);">Error loading messages. Please try again.</div>';
        }
    }

    // ========== NEW HELPER: addLoadMoreButton() ==========
    addLoadMoreButton(chatId, container) {
        let loadMoreBtn = document.getElementById('chat-load-more-btn');
        if (!loadMoreBtn) {
            loadMoreBtn = document.createElement('button');
            loadMoreBtn.id = 'chat-load-more-btn';
            loadMoreBtn.className = 'btn btn-sm btn-outline';
            loadMoreBtn.style.margin = '10px auto';
            loadMoreBtn.style.display = 'block';
            loadMoreBtn.innerHTML = '<i class="fas fa-arrow-up"></i> Load Older Messages';
            loadMoreBtn.addEventListener('click', () => this.loadChatMessages(chatId, true));
            container.insertBefore(loadMoreBtn, container.firstChild);
        }
    }

    // ========== REPLACE setupChatListener() ==========
    setupChatListener(chatId) {
        if (this.currentChatUnsubscribe) {
            this.currentChatUnsubscribe();
            this.currentChatUnsubscribe = null;
        }
        
        this.currentChatUnsubscribe = this.db.collection('chats').doc(chatId).collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const message = { id: change.doc.id, ...change.doc.data() };
                        // Check if message is from current user (already displayed) or new
                        const messagesContainer = document.getElementById('chat-messages-area');
                        if (messagesContainer) {
                            // Check if message already exists
                            const existing = messagesContainer.querySelector(`[data-message-id="${message.id}"]`);
                            if (!existing) {
                                this.appendNewMessage(message);
                            }
                        }
                        
                        if (message.senderId !== this.currentUser?.uid && !message.read) {
                            this.markMessageAsRead(chatId, change.doc.id);
                        }
                    }
                });
            }, (error) => {
                console.error('Chat listener error:', error);
            });
        
        // Typing listener
        const typingRef = this.db.collection('chats').doc(chatId).collection('typing').doc('status');
        if (this.typingUnsubscribe) {
            this.typingUnsubscribe();
        }
        this.typingUnsubscribe = typingRef.onSnapshot((doc) => {
            const typingStatus = document.getElementById('chat-typing-status');
            if (typingStatus && doc.exists && doc.data().isTyping && doc.data().userId !== this.currentUser?.uid) {
                typingStatus.textContent = 'typing...';
                typingStatus.style.opacity = '0.7';
                setTimeout(() => {
                    if (typingStatus.textContent === 'typing...') {
                        typingStatus.textContent = '';
                    }
                }, 1500);
            } else if (typingStatus) {
                typingStatus.textContent = '';
            }
        });
    }

    // ========== REPLACE startNewChat() ==========
    async startNewChat() {
        if (!this.currentUser) {
            this.showToast('Please sign in to start a chat', 'warning');
            if (typeof window.openAuthModal === 'function') window.openAuthModal();
            return;
        }
        
        const usersSnapshot = await this.db.collection('users').limit(50).get();
        const users = usersSnapshot.docs
            .filter(doc => doc.id !== this.currentUser.uid)
            .map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    displayName: data.displayName || data.userName || data.name || data.email || 'User'
                };
            });
        
        if (users.length === 0) {
            this.showToast('No other users found', 'info');
            return;
        }
        
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
                            ${users.map(user => `<option value="${user.id}">${this.escapeHtml(user.displayName)}</option>`).join('')}
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
                const newCreateBtn = createBtn.cloneNode(true);
                createBtn.parentNode.replaceChild(newCreateBtn, createBtn);
                newCreateBtn.addEventListener('click', async () => {
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
                    
                    // Check for existing chat
                    const existingChat = await this.db.collection('chats')
                        .where('participants', 'array-contains', this.currentUser.uid)
                        .get();
                    
                    let chatRef = null;
                    for (const doc of existingChat.docs) {
                        const participants = doc.data().participants;
                        if (participants.includes(selectedUserId)) {
                            chatRef = doc.ref;
                            break;
                        }
                    }
                    
                    if (!chatRef) {
                        const chatData = {
                            participants: [this.currentUser.uid, selectedUserId],
                            lastMessage: message,
                            lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        };
                        chatRef = await this.db.collection('chats').add(chatData);
                    }
                    
                    await chatRef.collection('messages').add({
                        senderId: this.currentUser.uid,
                        senderName: this.currentUser.displayName || this.currentUser.email || 'User',
                        text: message,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        read: false
                    });
                    
                    await chatRef.update({
                        lastMessage: message,
                        lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                        lastMessageBy: this.currentUser.uid
                    });
                    
                    this.showToast('Chat started!', 'success');
                    this.closeModal('new-chat-modal');
                    await this.loadConversations();
                    
                    // Switch to messages tab and open chat
                    const messagesTab = document.querySelector('.more-tab-btn[data-more-tab="messages"]');
                    if (messagesTab) {
                        messagesTab.click();
                        setTimeout(() => this.loadChat(chatRef.id), 500);
                    }
                });
            }
        }, 100);
    }

    // ========== REPLACE startChatWithUser() ==========
    async startChatWithUser(userId, initialMessage) {
        if (!this.currentUser) {
            this.showToast('Please sign in to start a chat', 'warning');
            if (typeof window.openAuthModal === 'function') window.openAuthModal();
            return;
        }
        
        if (!userId) {
            this.showToast('Invalid user', 'error');
            return;
        }
        
        // Check for existing chat
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
            senderName: this.currentUser.displayName || this.currentUser.email || 'User',
            text: initialMessage,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            read: false
        });
        
        await chatRef.update({
            lastMessage: initialMessage,
            lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastMessageBy: this.currentUser.uid
        });
        
        this.showToast('Message sent!', 'success');
        await this.loadConversations();
        this.loadChat(chatRef.id);
    }

    // ========== REPLACE closeChatWindow() ==========
    closeChatWindow() {
        if (this.currentChatUnsubscribe) {
            this.currentChatUnsubscribe();
            this.currentChatUnsubscribe = null;
        }
        if (this.typingUnsubscribe) {
            this.typingUnsubscribe();
            this.typingUnsubscribe = null;
        }
        this.firstMessageDoc = null;
        this.pendingMessage = null;
        
        const chatContainer = document.getElementById('chat-window-container');
        if (chatContainer) {
            chatContainer.remove();
        }
        
        const messagesContent = document.getElementById('messages-content');
        if (messagesContent) {
            messagesContent.removeAttribute('style');
            messagesContent.innerHTML = this.getMessagesHTML();
            
            // Re-initialize search and new chat button
            setTimeout(() => {
                const searchInput = document.getElementById('message-search-input');
                if (searchInput) {
                    const newSearchInput = searchInput.cloneNode(true);
                    searchInput.parentNode.replaceChild(newSearchInput, searchInput);
                    newSearchInput.addEventListener('input', (e) => {
                        this.filterConversations(e.target.value);
                    });
                }
                
                const newChatBtn = document.querySelector('#messages-content .new-chat-btn');
                if (newChatBtn) {
                    const newBtn = newChatBtn.cloneNode(true);
                    newChatBtn.parentNode.replaceChild(newBtn, newChatBtn);
                    newBtn.addEventListener('click', () => this.startNewChat());
                }
                
                this.loadConversations();
            }, 100);
        }
    }

    // ========== Keep everything else the same ==========
    // (All other methods remain unchanged: getEducationHTML, getAlertsHTML, getSafetyHTML, 
    // getSettingsHTML, loadTeachers, loadInternships, loadAttachments, loadTraining, 
    // loadAlerts, filterAlerts, switchSafetyCategory, switchMoreTab, showRatingModal, 
    // submitRating, showFounderProfile, handleSettingsAction, showTermsPopup, 
    // showPrivacyPolicy, loadDataFromFirestore, openModal, closeModal, toggleDarkMode, 
    // showModalWithContent, shareApp, onMenuOpen, onMenuClose, showToast, escapeHtml, 
    // loadUserPoints, showPointsHistory, formatDate, etc.)
}

document.addEventListener('DOMContentLoaded', function() {
    window.moreMenuManager = new MoreMenuManager();
});

window.addAppAnnouncement = async function(title, message) {
    try {
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) {
            console.log('❌ Please sign in first');
            return { success: false, error: 'Not signed in' };
        }
        
        const announcement = {
            title: title,
            message: message,
            date: firebase.firestore.FieldValue.serverTimestamp(),
            isRead: false,
            isGlobal: true,
            createdBy: currentUser.uid,
            createdByName: currentUser.displayName || currentUser.email
        };
        
        await firebase.firestore().collection('announcements').add(announcement);
        console.log(`✅ Announcement added: "${title}"`);
        
        const founderModal = document.getElementById('founder-profile-modal');
        if (founderModal && founderModal.style.display === 'flex') {
            window.moreMenuManager.showFounderProfile();
        }
        
        return { success: true };
    } catch (error) {
        console.error('Error adding announcement:', error);
        return { success: false, error: error.message };
    }
};

window.updateFounderDetails = async function(details) {
    try {
        const currentUser = firebase.auth().currentUser;
        if (!currentUser || currentUser.email !== 'vikeserve426@gmail.com') {
            console.log('❌ Only founder can update these details');
            return { success: false, error: 'Admin only' };
        }
        
        const founderRef = firebase.firestore().collection('system_settings').doc('founder');
        await founderRef.update({
            ...details,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('✅ Founder details updated:', details);
        
        const settingsContent = document.getElementById('settings-content');
        if (settingsContent) {
            const newHTML = await window.moreMenuManager.getSettingsHTML();
            settingsContent.innerHTML = newHTML;
            window.moreMenuManager.setupEventListeners();
        }
        
        return { success: true };
    } catch (error) {
        console.error('Error updating founder details:', error);
        return { success: false, error: error.message };
    }
};