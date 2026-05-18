// admin.js - Admin and Founder Management System

const ROLES = {
    founder: { name: 'Founder', level: 100, icon: 'fa-crown', color: '#f1c40f' },
    cofounder: { name: 'Co-Founder', level: 90, icon: 'fa-handshake', color: '#9b59b6' },
    admin: { name: 'Admin', level: 80, icon: 'fa-shield-alt', color: '#3498db' },
    moderator: { name: 'Moderator', level: 50, icon: 'fa-gavel', color: '#2ecc71' },
    user: { name: 'User', level: 10, icon: 'fa-user', color: '#2c3e50' }
};

let systemUsers = [
    { id: 'founder_001', name: 'Victor Wanyama', email: 'vikeserve426@gmail.com', role: 'founder', rating: 5.0, avatar: 'V' }
];

function loadAdminTab() {
    const adminContainer = document.getElementById('admin-tab');
    if (!adminContainer) return;
    
    adminContainer.innerHTML = `
        <div class="section-title"><i class="fas fa-tools"></i> Admin Dashboard</div>
        <div class="module-card">
            <div class="card-header">
                <div class="card-title"><i class="fas fa-user-shield"></i> Administrators</div>
            </div>
            <div id="admins-list">
                ${systemUsers.filter(u => u.role === 'admin' || u.role === 'founder').map(admin => `
                    <div class="user-card" style="background: var(--light); border-radius: 12px; padding: 12px; margin-bottom: 10px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 40px; height: 40px; border-radius: 50%; background: ${ROLES[admin.role]?.color || '#3498db'}; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">${admin.avatar || admin.name.charAt(0)}</div>
                            <div><strong>${admin.name}</strong><div style="font-size: 0.75rem;">${admin.email}</div></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function loadFounderTab() {
    const founderContainer = document.getElementById('founder-tab');
    if (!founderContainer) return;
    
    founderContainer.innerHTML = `
        <div class="section-title"><i class="fas fa-crown"></i> Founder Control Panel</div>
        <div class="module-card">
            <div class="card-header">
                <div class="card-title"><i class="fas fa-handshake"></i> Platform Settings</div>
            </div>
            <div class="settings-grid">
                <div class="setting-item" style="margin-bottom: 15px;">
                    <label style="display: flex; justify-content: space-between;">
                        <span>Maintenance Mode</span>
                        <label class="switch"><input type="checkbox" id="maintenance-mode"><span class="slider round"></span></label>
                    </label>
                </div>
                <button class="btn btn-primary" onclick="savePlatformSettings()">Save Settings</button>
            </div>
        </div>
    `;
}

function savePlatformSettings() {
    if (typeof showToast === 'function') showToast('Platform settings saved!', 'success');
}

window.loadAdminTab = loadAdminTab;
window.loadFounderTab = loadFounderTab;
window.savePlatformSettings = savePlatformSettings;

console.log('✅ Admin & Founder system loaded');