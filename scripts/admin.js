// ========== ADMIN MANAGEMENT SYSTEM ==========
// Roles hierarchy: founder (level 100) > cofounder (level 90) > admin (level 80) > moderator (level 50) > user (level 10)

const ROLES = {
    founder: { 
        name: 'Founder', 
        level: 100, 
        icon: 'fa-crown', 
        color: '#f1c40f',
        permissions: ['all']
    },
    cofounder: { 
        name: 'Co-Founder', 
        level: 90, 
        icon: 'fa-handshake', 
        color: '#9b59b6',
        permissions: ['manage_admins', 'manage_users', 'manage_posts', 'view_reports', 'manage_settings', 'view_analytics']
    },
    admin: { 
        name: 'Admin', 
        level: 80, 
        icon: 'fa-shield-alt', 
        color: '#3498db',
        permissions: ['manage_users', 'manage_posts', 'view_reports', 'view_analytics']
    },
    moderator: { 
        name: 'Moderator', 
        level: 50, 
        icon: 'fa-gavel', 
        color: '#2ecc71',
        permissions: ['manage_posts', 'view_reports']
    },
    user: { 
        name: 'User', 
        level: 10, 
        icon: 'fa-user', 
        color: '#2c3e50',
        permissions: []
    }
};

// ========== ADMIN MANAGER CLASS ==========
class AdminManager {
    constructor() {
        this.db = db;
        this.auth = auth;
        this.currentUserRole = null;
        this.init();
    }

    async init() {
        await this.loadCurrentUserRole();
        this.setupAdminListeners();
    }

    async loadCurrentUserRole() {
        const user = this.auth.currentUser;
        if (!user) return;
        
        try {
            const userDoc = await collections.users().doc(user.uid).get();
            if (userDoc.exists) {
                this.currentUserRole = userDoc.data().role || 'user';
            }
        } catch (error) {
            console.error('Error loading user role:', error);
            this.currentUserRole = 'user';
        }
    }

    // Check if user has permission
    hasPermission(permission) {
        if (!this.currentUserRole) return false;
        const roleConfig = ROLES[this.currentUserRole];
        if (!roleConfig) return false;
        return roleConfig.permissions.includes('all') || roleConfig.permissions.includes(permission);
    }

    // Check if user can perform action on target user
    canManageUser(targetUserId, targetRole) {
        const currentLevel = ROLES[this.currentUserRole]?.level || 0;
        const targetLevel = ROLES[targetRole]?.level || 0;
        
        // Founder cannot be managed by anyone
        if (targetRole === 'founder') return false;
        
        // Co-founder can manage admins and below, but not founder
        if (this.currentUserRole === 'cofounder' && targetRole !== 'founder') return true;
        
        // Admin can manage moderators and users
        if (this.currentUserRole === 'admin' && (targetRole === 'moderator' || targetRole === 'user')) return true;
        
        // Users cannot manage anyone
        return currentLevel > targetLevel;
    }

    // Get all users with admin roles
    async getAdminUsers() {
        try {
            const snapshot = await collections.users()
                .where('role', 'in', ['founder', 'cofounder', 'admin', 'moderator'])
                .get();
            
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting admin users:', error);
            return [];
        }
    }

    // Get all users (with pagination)
    async getAllUsers(limit = 20, startAfter = null) {
        try {
            let query = collections.users().orderBy('createdAt', 'desc').limit(limit);
            if (startAfter) {
                query = query.startAfter(startAfter);
            }
            const snapshot = await query.get();
            const lastVisible = snapshot.docs[snapshot.docs.length - 1];
            
            return {
                users: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
                lastVisible
            };
        } catch (error) {
            console.error('Error getting users:', error);
            return { users: [], lastVisible: null };
        }
    }

    // Update user role (only for co-founder and above)
    async updateUserRole(userId, newRole, updatedBy) {
        try {
            // Get target user's current role
            const targetUserDoc = await collections.users().doc(userId).get();
            if (!targetUserDoc.exists) {
                return { success: false, error: 'User not found' };
            }
            
            const currentRole = targetUserDoc.data().role || 'user';
            
            // Permission check
            if (!this.canManageUser(userId, currentRole)) {
                return { success: false, error: 'You do not have permission to manage this user' };
            }
            
            // Cannot demote founder
            if (currentRole === 'founder') {
                return { success: false, error: 'Cannot modify founder role' };
            }
            
            // Update role
            await collections.users().doc(userId).update({
                role: newRole,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                roleUpdatedBy: updatedBy,
                roleUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Log the action
            await this.logAdminAction({
                action: 'update_role',
                targetUserId: userId,
                oldRole: currentRole,
                newRole: newRole,
                performedBy: updatedBy,
                timestamp: new Date().toISOString()
            });
            
            return { success: true };
        } catch (error) {
            console.error('Error updating user role:', error);
            return { success: false, error: error.message };
        }
    }

    // Remove admin role (demote to user)
    async removeAdminRole(userId, updatedBy) {
        return this.updateUserRole(userId, 'user', updatedBy);
    }

    // Get all reported posts
    async getReportedPosts(limit = 20) {
        try {
            const snapshot = await collections.marketplaceItems()
                .where('reported', '==', true)
                .orderBy('reportedAt', 'desc')
                .limit(limit)
                .get();
            
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting reported posts:', error);
            return [];
        }
    }

    // Moderate a post (delete or hide)
    async moderatePost(postId, action, reason, moderatedBy) {
        try {
            const postRef = collections.marketplaceItems().doc(postId);
            const postDoc = await postRef.get();
            
            if (!postDoc.exists) {
                return { success: false, error: 'Post not found' };
            }
            
            if (action === 'delete') {
                await postRef.update({
                    status: 'deleted',
                    deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    deletedBy: moderatedBy,
                    deletionReason: reason
                });
            } else if (action === 'hide') {
                await postRef.update({
                    status: 'hidden',
                    hiddenAt: firebase.firestore.FieldValue.serverTimestamp(),
                    hiddenBy: moderatedBy,
                    hideReason: reason
                });
            } else if (action === 'approve') {
                await postRef.update({
                    status: 'active',
                    approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    approvedBy: moderatedBy
                });
            }
            
            // Log moderation action
            await this.logAdminAction({
                action: 'moderate_post',
                targetPostId: postId,
                moderationAction: action,
                reason: reason,
                performedBy: moderatedBy,
                timestamp: new Date().toISOString()
            });
            
            return { success: true };
        } catch (error) {
            console.error('Error moderating post:', error);
            return { success: false, error: error.message };
        }
    }

    // Get admin action logs
    async getAdminLogs(limit = 50) {
        try {
            const snapshot = await collections.adminLogs()
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();
            
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting admin logs:', error);
            return [];
        }
    }

    // Log admin action
    async logAdminAction(logData) {
        try {
            await collections.adminLogs().add({
                ...logData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error logging admin action:', error);
        }
    }

    // Get platform statistics
    async getPlatformStats() {
        try {
            const [usersSnapshot, postsSnapshot, bookingsSnapshot] = await Promise.all([
                collections.users().get(),
                collections.marketplaceItems().where('status', '==', 'active').get(),
                collections.bookings().get()
            ]);
            
            return {
                totalUsers: usersSnapshot.size,
                totalActivePosts: postsSnapshot.size,
                totalBookings: bookingsSnapshot.size,
                adminsCount: (await this.getAdminUsers()).length
            };
        } catch (error) {
            console.error('Error getting platform stats:', error);
            return {
                totalUsers: 0,
                totalActivePosts: 0,
                totalBookings: 0,
                adminsCount: 0
            };
        }
    }

    setupAdminListeners() {
        // Listen for auth changes to update role
        this.auth.onAuthStateChanged(async (user) => {
            await this.loadCurrentUserRole();
            // Dispatch event for UI updates
            window.dispatchEvent(new CustomEvent('adminRoleChanged', { 
                detail: { role: this.currentUserRole } 
            }));
        });
    }
}

// ========== INITIALIZE ADMIN MANAGER ==========
let adminManager = null;

function initAdminManager() {
    if (!adminManager) {
        adminManager = new AdminManager();
        window.adminManager = adminManager;
        console.log('✅ Admin Manager initialized');
    }
    return adminManager;
}

// ========== FOUNDER PANEL UI ==========
async function loadFounderPanel() {
    const founderContainer = document.getElementById('founder-tab');
    if (!founderContainer) return;
    
    const stats = await adminManager.getPlatformStats();
    const admins = await adminManager.getAdminUsers();
    const logs = await adminManager.getAdminLogs(20);
    
    founderContainer.innerHTML = `
        <div class="section-title"><i class="fas fa-crown"></i> Founder Control Panel</div>
        
        <!-- Stats Cards -->
        <div class="stats-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">
            <div class="stat-card" style="background: var(--light); padding: 15px; border-radius: 12px; text-align: center;">
                <div style="font-size: 2rem; font-weight: bold; color: var(--primary);">${stats.totalUsers}</div>
                <div style="font-size: 0.8rem;">Total Users</div>
            </div>
            <div class="stat-card" style="background: var(--light); padding: 15px; border-radius: 12px; text-align: center;">
                <div style="font-size: 2rem; font-weight: bold; color: var(--primary);">${stats.totalActivePosts}</div>
                <div style="font-size: 0.8rem;">Active Posts</div>
            </div>
            <div class="stat-card" style="background: var(--light); padding: 15px; border-radius: 12px; text-align: center;">
                <div style="font-size: 2rem; font-weight: bold; color: var(--primary);">${stats.totalBookings}</div>
                <div style="font-size: 0.8rem;">Total Bookings</div>
            </div>
            <div class="stat-card" style="background: var(--light); padding: 15px; border-radius: 12px; text-align: center;">
                <div style="font-size: 2rem; font-weight: bold; color: var(--primary);">${admins.length}</div>
                <div style="font-size: 0.8rem;">Team Members</div>
            </div>
        </div>
        
        <!-- Admin Management -->
        <div class="module-card">
            <div class="card-header">
                <div class="card-title"><i class="fas fa-users-cog"></i> Team Management</div>
                <button class="btn btn-sm btn-primary" onclick="showAddAdminModal()">+ Add Admin</button>
            </div>
            <div id="admins-list-container">
                ${admins.map(admin => `
                    <div class="admin-card" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid var(--grey);">
                        <div>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <i class="${ROLES[admin.role]?.icon || 'fa-user-shield'}" style="color: ${ROLES[admin.role]?.color || '#3498db'};"></i>
                                <strong>${escapeHtml(admin.displayName || admin.email)}</strong>
                                <span style="background: ${ROLES[admin.role]?.color || '#3498db'}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem;">${ROLES[admin.role]?.name || admin.role}</span>
                            </div>
                            <div style="font-size: 0.7rem; color: var(--grey-dark);">${admin.email}</div>
                        </div>
                        ${admin.role !== 'founder' ? `
                            <div class="admin-actions">
                                <button class="btn btn-sm btn-outline" onclick="showEditAdminRoleModal('${admin.id}', '${admin.role}')">Edit Role</button>
                                <button class="btn btn-sm btn-danger" onclick="removeAdmin('${admin.id}')">Remove</button>
                            </div>
                        ` : '<span style="font-size: 0.7rem; color: var(--warning);"><i class="fas fa-crown"></i> Founder</span>'}
                    </div>
                `).join('')}
            </div>
        </div>
        
        <!-- Reported Posts -->
        <div class="module-card">
            <div class="card-header">
                <div class="card-title"><i class="fas fa-flag"></i> Reported Content</div>
                <button class="btn btn-sm btn-outline" onclick="loadReportedPosts()">Refresh</button>
            </div>
            <div id="reported-posts-container">
                <div class="loading-spinner">Loading reported posts...</div>
            </div>
        </div>
        
        <!-- Admin Activity Log -->
        <div class="module-card">
            <div class="card-header">
                <div class="card-title"><i class="fas fa-history"></i> Admin Activity Log</div>
            </div>
            <div id="admin-logs-container" style="max-height: 300px; overflow-y: auto;">
                ${logs.map(log => `
                    <div style="padding: 8px; border-bottom: 1px solid var(--grey); font-size: 0.75rem;">
                        <strong>${log.action}</strong> - ${log.details || ''}
                        <div style="font-size: 0.65rem; color: var(--grey-dark);">${new Date(log.timestamp).toLocaleString()}</div>
                    </div>
                `).join('')}
                ${logs.length === 0 ? '<div style="padding: 20px; text-align: center;">No logs yet</div>' : ''}
            </div>
        </div>
        
        <!-- Platform Settings -->
        <div class="module-card">
            <div class="card-header">
                <div class="card-title"><i class="fas fa-sliders-h"></i> Platform Settings</div>
            </div>
            <div class="settings-item" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <div>
                    <strong>Maintenance Mode</strong>
                    <div style="font-size: 0.7rem;">Disable new posts during maintenance</div>
                </div>
                <label class="switch">
                    <input type="checkbox" id="maintenance-mode-toggle" onchange="toggleMaintenanceMode(this.checked)">
                    <span class="slider round"></span>
                </label>
            </div>
            <button class="btn btn-primary" onclick="savePlatformSettings()">Save All Settings</button>
        </div>
    `;
    
    // Load reported posts
    loadReportedPosts();
}

// ========== ADMIN PANEL UI ==========
async function loadAdminPanel() {
    const adminContainer = document.getElementById('admin-tab');
    if (!adminContainer) return;
    
    const stats = await adminManager.getPlatformStats();
    const reportedPosts = await adminManager.getReportedPosts(10);
    
    adminContainer.innerHTML = `
        <div class="section-title"><i class="fas fa-shield-alt"></i> Admin Dashboard</div>
        
        <div class="stats-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px;">
            <div class="stat-card" style="background: var(--light); padding: 15px; border-radius: 12px; text-align: center;">
                <div style="font-size: 2rem; font-weight: bold; color: var(--primary);">${stats.totalUsers}</div>
                <div style="font-size: 0.8rem;">Total Users</div>
            </div>
            <div class="stat-card" style="background: var(--light); padding: 15px; border-radius: 12px; text-align: center;">
                <div style="font-size: 2rem; font-weight: bold; color: var(--primary);">${stats.totalActivePosts}</div>
                <div style="font-size: 0.8rem;">Active Posts</div>
            </div>
        </div>
        
        <div class="module-card">
            <div class="card-header">
                <div class="card-title"><i class="fas fa-flag"></i> Reported Content (${reportedPosts.length})</div>
            </div>
            <div id="admin-reported-posts">
                ${reportedPosts.length === 0 ? '<div style="padding: 20px; text-align: center;">No reported posts</div>' : ''}
                ${reportedPosts.map(post => `
                    <div style="padding: 12px; border-bottom: 1px solid var(--grey);">
                        <div><strong>${escapeHtml(post.title)}</strong></div>
                        <div style="font-size: 0.8rem;">Reported: ${post.reportReason || 'No reason'}</div>
                        <div class="post-actions" style="margin-top: 8px;">
                            <button class="btn btn-sm btn-danger" onclick="moderatePost('${post.id}', 'delete')">Delete</button>
                            <button class="btn btn-sm btn-warning" onclick="moderatePost('${post.id}', 'hide')">Hide</button>
                            <button class="btn btn-sm btn-success" onclick="moderatePost('${post.id}', 'approve')">Approve</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// ========== MODAL FUNCTIONS ==========
async function showAddAdminModal() {
    const users = await adminManager.getAllUsers(50);
    
    const modalContent = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <div class="modal-title">Add Team Member</div>
                <button class="close-modal-btn">&times;</button>
            </div>
            <div style="padding: 20px;">
                <div class="form-group">
                    <label class="form-label">Select User</label>
                    <select id="new-admin-user" class="form-input">
                        <option value="">-- Select User --</option>
                        ${users.users.map(user => `
                            <option value="${user.id}">${escapeHtml(user.displayName || user.email)} (Current: ${user.role || 'user'})</option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Assign Role</label>
                    <select id="new-admin-role" class="form-input">
                        <option value="moderator">Moderator - Can manage posts</option>
                        <option value="admin">Admin - Can manage users and posts</option>
                        <option value="cofounder">Co-Founder - Full access except removing founder</option>
                    </select>
                </div>
                <div class="form-actions">
                    <button class="btn btn-outline close-modal-btn">Cancel</button>
                    <button class="btn btn-primary" onclick="addNewAdmin()">Add Team Member</button>
                </div>
            </div>
        </div>
    `;
    
    showModalWithContent('add-admin-modal', modalContent);
}

async function addNewAdmin() {
    const userId = document.getElementById('new-admin-user')?.value;
    const newRole = document.getElementById('new-admin-role')?.value;
    
    if (!userId) {
        showToast('Please select a user', 'error');
        return;
    }
    
    const user = auth.currentUser;
    if (!user) {
        showToast('Please sign in', 'error');
        return;
    }
    
    const result = await adminManager.updateUserRole(userId, newRole, user.uid);
    
    if (result.success) {
        showToast('Team member added successfully!', 'success');
        closeModal();
        loadFounderPanel();
    } else {
        showToast('Error: ' + result.error, 'error');
    }
}

function showEditAdminRoleModal(userId, currentRole) {
    const modalContent = `
        <div class="modal-content" style="max-width: 400px;">
            <div class="modal-header">
                <div class="modal-title">Edit Team Member Role</div>
                <button class="close-modal-btn">&times;</button>
            </div>
            <div style="padding: 20px;">
                <div class="form-group">
                    <label class="form-label">New Role</label>
                    <select id="edit-role-select" class="form-input">
                        <option value="moderator" ${currentRole === 'moderator' ? 'selected' : ''}>Moderator</option>
                        <option value="admin" ${currentRole === 'admin' ? 'selected' : ''}>Admin</option>
                        <option value="cofounder" ${currentRole === 'cofounder' ? 'selected' : ''}>Co-Founder</option>
                        <option value="user" ${currentRole === 'user' ? 'selected' : ''}>Remove (Demote to User)</option>
                    </select>
                </div>
                <div class="form-actions">
                    <button class="btn btn-outline close-modal-btn">Cancel</button>
                    <button class="btn btn-primary" onclick="updateAdminRole('${userId}')">Update Role</button>
                </div>
            </div>
        </div>
    `;
    
    showModalWithContent('edit-role-modal', modalContent);
}

async function updateAdminRole(userId) {
    const newRole = document.getElementById('edit-role-select')?.value;
    const user = auth.currentUser;
    
    if (!newRole) {
        showToast('Please select a role', 'error');
        return;
    }
    
    const result = await adminManager.updateUserRole(userId, newRole, user.uid);
    
    if (result.success) {
        showToast('Role updated successfully!', 'success');
        closeModal();
        loadFounderPanel();
    } else {
        showToast('Error: ' + result.error, 'error');
    }
}

async function removeAdmin(userId) {
    if (!confirm('Are you sure you want to remove this team member? They will become a regular user.')) return;
    
    const user = auth.currentUser;
    const result = await adminManager.updateUserRole(userId, 'user', user.uid);
    
    if (result.success) {
        showToast('Team member removed successfully', 'success');
        loadFounderPanel();
    } else {
        showToast('Error: ' + result.error, 'error');
    }
}

async function loadReportedPosts() {
    const container = document.getElementById('reported-posts-container');
    if (!container) return;
    
    const reportedPosts = await adminManager.getReportedPosts(20);
    
    if (reportedPosts.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center;">No reported posts</div>';
        return;
    }
    
    container.innerHTML = reportedPosts.map(post => `
        <div style="padding: 12px; border-bottom: 1px solid var(--grey);">
            <div><strong>${escapeHtml(post.title)}</strong></div>
            <div style="font-size: 0.8rem;">Category: ${post.category}</div>
            <div style="font-size: 0.8rem;">Reported: ${post.reportReason || 'No reason provided'}</div>
            <div style="font-size: 0.7rem; color: var(--grey-dark);">By: ${post.reportedBy || 'Anonymous'}</div>
            <div class="post-actions" style="margin-top: 8px; display: flex; gap: 8px;">
                <button class="btn btn-sm btn-danger" onclick="moderatePost('${post.id}', 'delete')">Delete</button>
                <button class="btn btn-sm btn-warning" onclick="moderatePost('${post.id}', 'hide')">Hide</button>
                <button class="btn btn-sm btn-success" onclick="moderatePost('${post.id}', 'approve')">Approve</button>
            </div>
        </div>
    `).join('');
}

async function moderatePost(postId, action) {
    let reason = '';
    if (action === 'delete' || action === 'hide') {
        reason = prompt(`Please provide a reason for ${action}ing this post:`);
        if (!reason) return;
    }
    
    const user = auth.currentUser;
    const result = await adminManager.moderatePost(postId, action, reason, user.uid);
    
    if (result.success) {
        showToast(`Post ${action}d successfully!`, 'success');
        loadReportedPosts();
        if (typeof loadFounderPanel === 'function') loadFounderPanel();
    } else {
        showToast('Error: ' + result.error, 'error');
    }
}

function toggleMaintenanceMode(enabled) {
    showToast(enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled', 'info');
}

async function savePlatformSettings() {
    const maintenanceMode = document.getElementById('maintenance-mode-toggle')?.checked || false;
    
    // Save to Firestore
    try {
        await collections.systemSettings().doc('platform').set({
            maintenanceMode: maintenanceMode,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: auth.currentUser?.uid
        }, { merge: true });
        
        showToast('Platform settings saved!', 'success');
    } catch (error) {
        console.error('Error saving settings:', error);
        showToast('Error saving settings', 'error');
    }
}

// ========== HELPER FUNCTIONS ==========
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== GLOBAL EXPORTS ==========
window.ROLES = ROLES;
window.adminManager = adminManager;
window.initAdminManager = initAdminManager;
window.loadFounderPanel = loadFounderPanel;
window.loadAdminPanel = loadAdminPanel;
window.showAddAdminModal = showAddAdminModal;
window.addNewAdmin = addNewAdmin;
window.showEditAdminRoleModal = showEditAdminRoleModal;
window.updateAdminRole = updateAdminRole;
window.removeAdmin = removeAdmin;
window.loadReportedPosts = loadReportedPosts;
window.moderatePost = moderatePost;
window.toggleMaintenanceMode = toggleMaintenanceMode;
window.savePlatformSettings = savePlatformSettings;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    initAdminManager();
    
    // Load founder panel if user is founder/co-founder/admin
    setTimeout(() => {
        if (adminManager && adminManager.currentUserRole) {
            if (adminManager.currentUserRole === 'founder' || adminManager.currentUserRole === 'cofounder') {
                loadFounderPanel();
            } else if (adminManager.currentUserRole === 'admin') {
                loadAdminPanel();
            }
        }
    }, 1000);
});

console.log('✅ Admin system loaded with role management');