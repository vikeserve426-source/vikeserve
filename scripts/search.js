class SearchManager {
    constructor() {
        this.db = db;
        this.auth = auth;
        this.searchData = [];
        this.searchIndex = {};
        this.searchResults = [];
        this.lastSearchTerm = '';
        this.isSearching = false;
        this.searchHistory = this.loadSearchHistory();
        this._searchDebounceTimeout = null;
        this.init();
    }

    async init() {
        console.log("Search Manager initializing...");
        this.setupSearchListeners();
        await this.loadSearchData();
    }

    loadSearchHistory() {
        try {
            const saved = localStorage.getItem('vikeserve_search_history');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    }

    saveToSearchHistory(term) {
        if (!term || term.length < 2) return;
        const t = term.trim();
        const existingIndex = this.searchHistory.indexOf(t);
        if (existingIndex !== -1) this.searchHistory.splice(existingIndex, 1);
        this.searchHistory.unshift(t);
        if (this.searchHistory.length > 10) this.searchHistory.pop();
        localStorage.setItem('vikeserve_search_history', JSON.stringify(this.searchHistory));
    }

    clearSearchHistory() {
        this.searchHistory = [];
        localStorage.removeItem('vikeserve_search_history');
        if (typeof window.showToast === 'function') {
            window.showToast('Search history cleared', 'success');
        }
    }

    async loadSearchData() {
        try {
            console.log("Loading search data from Firebase...");

            const [servicesSnap, jobsSnap, marketSnap, housingSnap] = await Promise.all([
                collections.services().limit(200).get().catch(() => ({ docs: [] })),
                collections.serviceRequests().limit(200).get().catch(() => ({ docs: [] })),
                collections.marketplaceItems().limit(200).get().catch(() => ({ docs: [] })),
                (collections.propertyListings ? collections.propertyListings() : collections.housing ? collections.housing() : null)?.limit(200).get().catch(() => ({ docs: [] }))
            ]);

            this.searchData = [];

            servicesSnap.docs.forEach(doc => {
                const s = doc.data();
                if (s.status && s.status !== 'active' && s.status !== 'pending') return; // skip sold/inactive
                this.searchData.push(this.buildIndexEntry(doc.id, s, 'service'));
            });

            jobsSnap.docs.forEach(doc => {
                const j = doc.data();
                if (j.status && j.status !== 'active') return;
                this.searchData.push(this.buildIndexEntry(doc.id, j, 'job'));
            });

            marketSnap.docs.forEach(doc => {
                const m = doc.data();
                if (m.status && m.status !== 'active') return;
                this.searchData.push(this.buildIndexEntry(doc.id, m, 'marketplace'));
            });

            if (housingSnap && housingSnap.docs) {
                housingSnap.docs.forEach(doc => {
                    const h = doc.data();
                    if (h.status && h.status !== 'active') return;
                    this.searchData.push(this.buildIndexEntry(doc.id, h, 'housing'));
                });
            }

            console.log(`✅ Loaded ${this.searchData.length} items for search`);
            this.buildSearchIndex();

            this.setupRealtimeListeners();

        } catch (error) {
            console.error("Error loading search data:", error);
        }
    }

    buildIndexEntry(id, data, type) {
        const title = data.title || data.name || data.company || data.school || data.organization || 'Untitled';
        const category = data.category || data.serviceType || data.propertyType || data.hotelType || '';
        const location = data.location || '';
        const description = data.description || '';

        return {
            id,
            type,
            title,
            category,
            location,
            description,
            price: data.price || data.salary || data.budget || 0,
            rating: data.rating || data.averageRating || 0,
            urgent: data.urgent === true,
            images: data.images || [],
            userName: data.userName || data.providerName || 'User',
            userId: data.userId || '',
            phone: data.phone || '',
            whatsapp: data.whatsapp || data.phone || '',
            condition: data.condition || '',
            status: data.status || 'active',
            raw: data
        };
    }

    setupRealtimeListeners() {
        try {
            if (window._searchRealtimeAttached) return;
            window._searchRealtimeAttached = true;

            collections.marketplaceItems().limit(1).onSnapshot(() => {
                clearTimeout(this._refreshTimeout);
                this._refreshTimeout = setTimeout(() => this.loadSearchData(), 5000);
            });
        } catch (e) {
            console.warn('Realtime search refresh skipped:', e.message);
        }
    }

    buildSearchIndex() {
        this.searchIndex = {};
        this.searchData.forEach(item => {
            const text = `${item.title} ${item.category} ${item.location} ${item.description} ${item.userName}`.toLowerCase();
            const tokens = [...new Set(text.split(/\s+/).filter(w => w.length > 1))];
            tokens.forEach(word => {
                if (!this.searchIndex[word]) this.searchIndex[word] = [];
                if (!this.searchIndex[word].includes(item.id)) this.searchIndex[word].push(item.id);
            });
        });
        console.log(`Search index built with ${Object.keys(this.searchIndex).length} unique words`);
    }

    setupSearchListeners() {
        const searchInputs = document.querySelectorAll('.search-input');
        
        searchInputs.forEach(input => {
            const newInput = input.cloneNode(true);
            input.parentNode.replaceChild(newInput, input);
            
            newInput.addEventListener('input', (e) => {
                clearTimeout(this._searchDebounceTimeout);
                const value = e.target.value;
                this._searchDebounceTimeout = setTimeout(() => {
                    this.handleGlobalSearch(value);
                }, 350);
            });

            newInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleGlobalSearch(e.target.value, true);
                }
            });
        });
    }

    async handleGlobalSearch(query, force = false) {
        const term = (query || '').trim();
        
        if (term.length < 2) {
            this.hideSearchOverlay();
            return;
        }

        this.lastSearchTerm = term;
        this.saveToSearchHistory(term);
        this.showSearchLoading();

        try {
            const results = await this.searchAll(term);
            this.displaySearchResults(results, term);
        } catch (error) {
            console.error("Search error:", error);
            this.showSearchError("Search failed. Please try again.");
        }
    }

    async searchAll(query) {
        let results = this.performLocalSearch(query);

        if (results.length < 8) {
            const fbResults = await this.searchFirebasePrefix(query);
            results = this.mergeAndDeduplicate(results, fbResults);
        }

        return results;
    }

    performLocalSearch(query) {
        const term = query.toLowerCase();
        const tokens = term.split(/\s+/).filter(t => t.length > 1);
        const matchedIds = new Set();

        this.searchData.forEach(item => {
            const haystack = `${item.title} ${item.category} ${item.location} ${item.description} ${item.userName}`.toLowerCase();
            if (haystack.includes(term)) {
                matchedIds.add(item.id);
                return;
            }
            if (tokens.length > 1 && tokens.every(t => haystack.includes(t))) {
                matchedIds.add(item.id);
            }
        });

        const results = this.searchData
            .filter(item => matchedIds.has(item.id))
            .map(item => ({
                ...item,
                score: this.calculateRelevanceScore(item, term, tokens)
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 40);

        return results;
    }

    async searchFirebasePrefix(query) {
        const term = query.toLowerCase().trim();
        const results = [];

        const searchOne = async (collectionRef, type) => {
            try {
                const snap = await collectionRef
                    .where('title', '>=', term)
                    .where('title', '<=', term + '\uf8ff')
                    .limit(10)
                    .get();

                snap.forEach(doc => {
                    const data = doc.data();
                    results.push({ ...this.buildIndexEntry(doc.id, data, type), score: 8 });
                });
            } catch (e) {
            }
        };

        await Promise.all([
            searchOne(collections.services(), 'service'),
            searchOne(collections.marketplaceItems(), 'marketplace'),
            searchOne(collections.serviceRequests(), 'job')
        ]);

        return results;
    }

    mergeAndDeduplicate(local, remote) {
        const seenIds = new Set(local.map(r => r.id));
        const merged = [...local];
        remote.forEach(r => {
            if (!seenIds.has(r.id)) {
                seenIds.add(r.id);
                merged.push(r);
            }
        });
        return merged.sort((a, b) => b.score - a.score).slice(0, 40);
    }

    calculateRelevanceScore(item, query, tokens) {
        let score = 0;
        const haystack = `${item.title} ${item.category} ${item.location} ${item.description}`.toLowerCase();
        
        if (item.title.toLowerCase().startsWith(query)) score += 20;
        else if (item.title.toLowerCase().includes(query)) score += 12;
        if (haystack.includes(query)) score += 8;
        tokens.forEach(t => { if (haystack.includes(t)) score += 2; });
        if (item.urgent) score += 3;
        
        const created = item.raw?.createdAt?.toDate ? item.raw.createdAt.toDate() : new Date(item.raw?.createdAt || 0);
        const daysAgo = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
        if (daysAgo < 1) score += 3;
        else if (daysAgo < 7) score += 1;

        return score;
    }

    showSearchLoading() {
        const html = `
            <div style="text-align: center; padding: 40px;">
                <div class="loading-spinner"></div>
                <div style="margin-top: 10px;">Searching for "${this.escapeHtml(this.lastSearchTerm)}"...</div>
            </div>
        `;
        this.showSearchOverlay(html);
    }

    showSearchError(message) {
        const html = `
            <div style="text-align: center; padding: 40px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: var(--danger);"></i>
                <div style="margin-top: 10px;">${this.escapeHtml(message)}</div>
                <button class="btn btn-outline retry-search-btn" style="margin-top: 15px;">Try Again</button>
            </div>
        `;
        this.showSearchOverlay(html);
        setTimeout(() => {
            const retry = document.querySelector('.retry-search-btn');
            if (retry) retry.addEventListener('click', () => this.handleGlobalSearch(this.lastSearchTerm));
        }, 100);
    }

    displaySearchResults(results, query) {
        if (results.length === 0) {
            this.showNoResults(query);
            return;
        }

        this.searchResults = results;
        const groups = {
            service: results.filter(r => r.type === 'service'),
            job: results.filter(r => r.type === 'job'),
            marketplace: results.filter(r => r.type === 'marketplace'),
            housing: results.filter(r => r.type === 'housing')
        };

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid var(--border-color);">
                <div>
                    <div style="font-weight: 600;">Results for "${this.escapeHtml(query)}"</div>
                    <div style="font-size: 0.8rem; color: var(--text-tertiary);">${results.length} result${results.length !== 1 ? 's' : ''} found</div>
                </div>
                <button class="btn btn-sm btn-outline search-close-btn" style="padding: 5px 12px;">Close</button>
            </div>
        `;

        if (groups.service.length > 0) html += this.renderSection('Services', 'fa-concierge-bell', groups.service);
        if (groups.job.length > 0) html += this.renderSection('Jobs', 'fa-briefcase', groups.job);
        if (groups.marketplace.length > 0) html += this.renderSection('Marketplace', 'fa-store', groups.marketplace);
        if (groups.housing.length > 0) html += this.renderSection('Housing', 'fa-home', groups.housing);

        this.showSearchOverlay(html);

        setTimeout(() => {
            const closeBtn = document.querySelector('.search-close-btn');
            if (closeBtn) closeBtn.addEventListener('click', () => this.hideSearchOverlay());
            
            document.querySelectorAll('.search-result-row').forEach(row => {
                row.addEventListener('click', () => {
                    const id = row.getAttribute('data-id');
                    const type = row.getAttribute('data-type');
                    this.selectResult(id, type);
                });
            });
        }, 100);
    }

    renderSection(title, icon, items) {
        return `
            <div style="padding: 15px; border-bottom: 1px solid var(--border-color);">
                <div style="font-weight: 600; margin-bottom: 10px;">
                    <i class="fas ${icon}"></i> ${title} (${items.length})
                </div>
                ${items.slice(0, 10).map(item => `
                    <div class="search-result-row" data-id="${item.id}" data-type="${item.type}" style="display: flex; gap: 12px; padding: 10px; border-radius: 8px; cursor: pointer; margin-bottom: 6px; background: var(--bg-tertiary);">
                        <div style="width: 40px; height: 40px; background: var(--primary); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0;">
                            <i class="fas ${icon}"></i>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 600; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(item.title)}</div>
                            <div style="font-size: 0.7rem; color: var(--text-tertiary);">${this.escapeHtml(item.category || '')} • ${this.escapeHtml(item.location || '')}</div>
                            ${item.price ? `<div style="font-size: 0.8rem; font-weight: 600; color: var(--primary); margin-top: 4px;">KES ${item.price}</div>` : ''}
                        </div>
                    </div>
                `).join('')}
                ${items.length > 10 ? `<div style="font-size: 0.7rem; color: var(--text-tertiary); text-align: center; margin-top: 8px;">+${items.length - 10} more...</div>` : ''}
            </div>
        `;
    }

    showNoResults(query) {
        const html = `
            <div style="text-align: center; padding: 60px 20px;">
                <i class="fas fa-search" style="font-size: 3rem; color: var(--text-tertiary);"></i>
                <div style="font-weight: 600; margin-top: 15px;">No results found</div>
                <div style="color: var(--text-tertiary); margin-top: 5px;">We couldn't find "${this.escapeHtml(query)}"</div>
                <div style="margin-top: 20px; font-size: 0.8rem; color: var(--text-tertiary);">
                    Try: check spelling, use fewer words, or search by category
                </div>
                <button class="btn btn-outline close-nr-btn" style="margin-top: 20px;">Close</button>
            </div>
        `;
        this.showSearchOverlay(html);
        setTimeout(() => {
            const btn = document.querySelector('.close-nr-btn');
            if (btn) btn.addEventListener('click', () => this.hideSearchOverlay());
        }, 100);
    }

    showSearchOverlay(innerHTML) {
        let overlay = document.getElementById('search-overlay-modal');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'search-overlay-modal';
            overlay.className = 'modal';
            overlay.style.cssText = 'display: flex !important; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 25000; overflow-y: auto; padding: 20px;';
            document.body.appendChild(overlay);
        }
        overlay.innerHTML = `
            <div class="modal-content" style="max-width: 500px; max-height: 80vh; overflow-y: auto; margin: 40px auto;">
                ${innerHTML}
            </div>
        `;
        overlay.style.display = 'flex';

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.hideSearchOverlay();
        });
    }

    hideSearchOverlay() {
        const overlay = document.getElementById('search-overlay-modal');
        if (overlay) overlay.style.display = 'none';
    }

    async selectResult(itemId, itemType) {
        this.hideSearchOverlay();

        document.querySelectorAll('.search-input').forEach(input => input.value = '');

        if (itemType === 'service' && typeof window.viewServiceDetails === 'function') {
            await window.viewServiceDetails(itemId);
        } else if (itemType === 'job' && typeof window.viewJobDetails === 'function') {
            await window.viewJobDetails(itemId);
        } else if (itemType === 'marketplace' && typeof window.viewListingDetails === 'function') {
            await window.viewListingDetails(itemId);
        } else if (itemType === 'housing' && typeof window.viewHousingDetails === 'function') {
            await window.viewHousingDetails(itemId);
        } else {
            if (typeof window.showToast === 'function') {
                window.showToast('Opening details...', 'info');
            }
        }
    }

    async refreshSearchData() {
        await this.loadSearchData();
        if (typeof window.showToast === 'function') {
            window.showToast('Search index updated', 'success');
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

function initializeSearchManager() {
    window.search = new SearchManager();
    console.log("✅ Search manager initialized");
}

if (typeof db !== 'undefined' && db) {
    initializeSearchManager();
} else {
    document.addEventListener('firebase-ready', initializeSearchManager);
}

window.SearchManager = SearchManager;

window.globalSearch = async function(term) {
    if (!window.search) {
        return { services: [], marketplace: [], alerts: [], housing: [] };
    }
    try {
        const results = await window.search.searchAll(term);
        return {
            services: results.filter(r => r.type === 'service' || r.type === 'job'),
            marketplace: results.filter(r => r.type === 'marketplace'),
            housing: results.filter(r => r.type === 'housing'),
            alerts: []
        };
    } catch (e) {
        console.error('globalSearch error:', e);
        return { services: [], marketplace: [], alerts: [], housing: [] };
    }
};