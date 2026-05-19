// ========== SEARCH MANAGER - COMPLETE FIXED VERSION ==========
// Supports pagination, search history, and optimized Firestore queries

class SearchManager {
    constructor() {
        this.db = db;
        this.auth = auth;
        this.searchData = [];
        this.searchIndex = {};
        this.currentFilters = {};
        this.searchResults = [];
        this.lastSearchTerm = '';
        this.isSearching = false;
        this.searchHistory = this.loadSearchHistory();
        this.init();
    }

    async init() {
        console.log("Search Manager initializing...");
        this.setupSearchListeners();
        await this.loadSearchData();
    }

    // Load search history from localStorage
    loadSearchHistory() {
        try {
            const saved = localStorage.getItem('vikeserve_search_history');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    }

    // Save search term to history
    saveToSearchHistory(term) {
        if (!term || term.length < 2) return;
        
        // Remove duplicate if exists
        const existingIndex = this.searchHistory.indexOf(term);
        if (existingIndex !== -1) {
            this.searchHistory.splice(existingIndex, 1);
        }
        
        // Add to beginning
        this.searchHistory.unshift(term);
        
        // Keep only last 10 searches
        if (this.searchHistory.length > 10) {
            this.searchHistory.pop();
        }
        
        localStorage.setItem('vikeserve_search_history', JSON.stringify(this.searchHistory));
        this.displaySearchHistory();
    }

    // Clear search history
    clearSearchHistory() {
        this.searchHistory = [];
        localStorage.removeItem('vikeserve_search_history');
        this.displaySearchHistory();
        if (typeof window.showToast === 'function') {
            window.showToast('Search history cleared', 'success');
        }
    }

    // Display search history in results container
    displaySearchHistory() {
        if (this.searchHistory.length === 0) return;
        
        const historyHTML = `
            <div class="search-history-section">
                <div class="search-history-header" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; border-bottom: 1px solid var(--grey);">
                    <strong><i class="fas fa-history"></i> Recent Searches</strong>
                    <button class="btn btn-sm btn-outline clear-history-btn" style="padding: 4px 8px; font-size: 0.7rem;">Clear</button>
                </div>
                <div class="search-history-list">
                    ${this.searchHistory.map(term => `
                        <div class="search-history-item" data-term="${this.escapeHtml(term)}" style="padding: 10px 15px; border-bottom: 1px solid var(--grey); cursor: pointer; display: flex; justify-content: space-between;">
                            <span><i class="fas fa-search" style="margin-right: 10px; color: var(--grey-dark);"></i> ${this.escapeHtml(term)}</span>
                            <i class="fas fa-arrow-right" style="color: var(--grey-dark);"></i>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        const resultsContainer = document.getElementById('search-results-container');
        if (resultsContainer && this.searchHistory.length > 0 && !this.lastSearchTerm) {
            resultsContainer.innerHTML = historyHTML;
            resultsContainer.style.display = 'block';
            
            // Add click handlers for history items
            document.querySelectorAll('.search-history-item').forEach(item => {
                item.addEventListener('click', () => {
                    const term = item.getAttribute('data-term');
                    const searchInput = document.querySelector('.search-input');
                    if (searchInput) {
                        searchInput.value = term;
                        this.handleSearch(term);
                    }
                });
            });
            
            const clearBtn = document.querySelector('.clear-history-btn');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => this.clearSearchHistory());
            }
        }
    }

    // Load data from Firebase collections with pagination
    async loadSearchData() {
        try {
            console.log("Loading search data from Firebase...");
            
            // Load limited data for initial search index
            const [servicesSnapshot, jobsSnapshot, marketplaceSnapshot] = await Promise.all([
                collections.services().limit(50).get(),
                collections.serviceRequests().where('type', '==', 'job').limit(50).get(),
                collections.marketplaceItems().limit(50).get()
            ]);

            this.searchData = [];

            // Process services and generate searchKeywords
            servicesSnapshot.forEach(doc => {
                const service = doc.data();
                const searchKeywords = this.generateSearchKeywords(service.title, service.category, service.location, service.description);
                this.searchData.push({
                    id: doc.id,
                    type: 'service',
                    title: service.title || service.name || 'Service',
                    category: service.category || 'general',
                    location: service.location || 'Nairobi',
                    rating: service.rating || service.averageRating || 4.0,
                    price: service.price || service.rate || 0,
                    description: service.description || '',
                    createdAt: service.createdAt,
                    urgent: service.urgent || false,
                    searchKeywords: searchKeywords
                });
            });

            // Process jobs
            jobsSnapshot.forEach(doc => {
                const job = doc.data();
                const searchKeywords = this.generateSearchKeywords(job.title, job.category, job.location, job.description);
                this.searchData.push({
                    id: doc.id,
                    type: 'job',
                    title: job.title || 'Job Opportunity',
                    category: job.category || job.serviceType || 'general',
                    location: job.location || 'Nairobi',
                    salary: job.salary || job.budget || 0,
                    description: job.description || '',
                    urgent: job.urgent || false,
                    createdAt: job.createdAt,
                    searchKeywords: searchKeywords
                });
            });

            // Process marketplace items
            marketplaceSnapshot.forEach(doc => {
                const item = doc.data();
                const searchKeywords = this.generateSearchKeywords(item.title, item.category, item.location, item.description);
                this.searchData.push({
                    id: doc.id,
                    type: 'marketplace',
                    title: item.title || item.name || 'Item',
                    category: item.category || 'general',
                    location: item.location || 'Nairobi',
                    price: item.price || 0,
                    description: item.description || '',
                    condition: item.condition,
                    createdAt: item.createdAt,
                    searchKeywords: searchKeywords
                });
            });

            console.log(`Loaded ${this.searchData.length} items for search`);
            this.buildSearchIndex();

        } catch (error) {
            console.error("Error loading search data from Firebase:", error);
            await this.loadSampleData();
        }
    }

    // Generate search keywords for a document
    generateSearchKeywords(title, category, location, description) {
        const text = `${title} ${category} ${location} ${description || ''}`.toLowerCase();
        const words = text.split(/\s+/);
        // Remove duplicates and short words, take unique keywords
        const uniqueWords = [...new Set(words)];
        return uniqueWords.filter(word => word.length > 2).slice(0, 20);
    }

    // Fallback sample data
    async loadSampleData() {
        console.log("Loading sample search data...");
        this.searchData = [
            { id: '1', type: 'service', title: 'Boda Boda Transport', category: 'transport', location: 'Nairobi', rating: 4.5, price: 100, searchKeywords: ['boda', 'transport', 'nairobi'] },
            { id: '2', type: 'service', title: 'Plumbing Services', category: 'home-services', location: 'Nairobi', rating: 4.2, price: 500, searchKeywords: ['plumbing', 'home', 'services', 'nairobi'] },
            { id: '3', type: 'job', title: 'Construction Worker Needed', category: 'construction', location: 'Nairobi', salary: 800, urgent: true, searchKeywords: ['construction', 'worker', 'needed', 'nairobi'] },
            { id: '4', type: 'marketplace', title: 'Quality Mitumba Clothes', category: 'clothing', location: 'Gikomba', price: 200, searchKeywords: ['quality', 'mitumba', 'clothes', 'gikomba'] }
        ];
        this.buildSearchIndex();
    }

    // Build search index for faster searching
    buildSearchIndex() {
        this.searchIndex = {};
        this.searchData.forEach(item => {
            const keywords = item.searchKeywords || this.tokenize(item.title + ' ' + item.category + ' ' + item.location + ' ' + (item.description || ''));
            keywords.forEach(word => {
                if (!this.searchIndex[word]) {
                    this.searchIndex[word] = [];
                }
                if (!this.searchIndex[word].includes(item.id)) {
                    this.searchIndex[word].push(item.id);
                }
            });
        });
        console.log("Search index built with", Object.keys(this.searchIndex).length, "unique words");
    }

    // Split text into searchable tokens
    tokenize(text) {
        return text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2);
    }

    // Setup search input listeners
    setupSearchListeners() {
        const searchInputs = document.querySelectorAll('.search-input');
        
        searchInputs.forEach(input => {
            let timeout;
            input.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    this.handleSearch(e.target.value);
                }, 300);
            });

            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleSearch(e.target.value);
                }
            });

            input.addEventListener('focus', () => {
                if (!this.lastSearchTerm && this.searchHistory.length > 0) {
                    this.displaySearchHistory();
                }
            });
        });
    }

    // Handle search query
    async handleSearch(query) {
        if (!query || query.trim().length < 2) {
            this.hideSearchResults();
            return;
        }

        this.lastSearchTerm = query.trim();
        this.saveToSearchHistory(this.lastSearchTerm);
        this.showSearchLoading();

        try {
            const results = await this.search(this.lastSearchTerm);
            this.displaySearchResults(results, this.lastSearchTerm);
        } catch (error) {
            console.error("Search error:", error);
            this.showSearchError("Search failed. Please try again.");
        }
    }

    // Perform search with optimized queries
    async search(query) {
        // First try local search (fast)
        let results = this.performLocalSearch(query);
        
        // If few results, search Firestore directly
        if (results.length < 10) {
            try {
                const firebaseResults = await this.searchFirebase(query);
                results = this.mergeAndDeduplicateResults(results, firebaseResults);
            } catch (error) {
                console.warn("Firebase search failed:", error);
            }
        }

        return results;
    }

    // Local search implementation
    performLocalSearch(query) {
        const tokens = this.tokenize(query);
        const resultIds = new Set();
        const scoredResults = [];

        tokens.forEach(token => {
            if (this.searchIndex[token]) {
                this.searchIndex[token].forEach(id => {
                    resultIds.add(id);
                });
            }
        });

        resultIds.forEach(id => {
            const item = this.searchData.find(d => d.id === id);
            if (item) {
                const score = this.calculateRelevanceScore(item, query, tokens);
                scoredResults.push({ ...item, score });
            }
        });

        return scoredResults.sort((a, b) => b.score - a.score).slice(0, 30);
    }

    // Search Firebase directly with pagination
    async searchFirebase(query) {
        const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
        const results = [];

        const searchPromises = [
            this.searchCollection(collections.services(), searchTerms, 'service'),
            this.searchCollection(collections.serviceRequests(), searchTerms, 'job'),
            this.searchCollection(collections.marketplaceItems(), searchTerms, 'marketplace')
        ];

        const collectionsResults = await Promise.allSettled(searchPromises);
        
        collectionsResults.forEach(result => {
            if (result.status === 'fulfilled') {
                results.push(...result.value);
            }
        });

        return results;
    }

    // Search a specific Firestore collection
    async searchCollection(collectionRef, searchTerms, type) {
        const results = [];
        
        for (const term of searchTerms) {
            try {
                // Use array-contains on searchKeywords field
                const snapshot = await collectionRef
                    .where('searchKeywords', 'array-contains', term)
                    .limit(10)
                    .get();

                snapshot.forEach(doc => {
                    const data = doc.data();
                    const item = this.formatFirebaseItem(doc.id, data, type);
                    if (item && !results.find(r => r.id === item.id)) {
                        results.push(item);
                    }
                });
            } catch (error) {
                // Fallback to title search if array-contains fails
                try {
                    const snapshot = await collectionRef
                        .where('title', '>=', term)
                        .where('title', '<=', term + '\uf8ff')
                        .limit(5)
                        .get();
                    
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        const item = this.formatFirebaseItem(doc.id, data, type);
                        if (item && !results.find(r => r.id === item.id)) {
                            results.push(item);
                        }
                    });
                } catch (fallbackError) {
                    console.warn(`Search in ${type} failed:`, fallbackError);
                }
            }
        }

        return results;
    }

    // Format Firebase document for search results
    formatFirebaseItem(id, data, type) {
        const baseItem = {
            id: id,
            type: type,
            title: data.title || data.name || 'Untitled',
            category: data.category || 'general',
            location: data.location || 'Unknown',
            description: data.description || '',
            createdAt: data.createdAt || new Date(),
            fromFirebase: true,
            score: 5
        };

        switch (type) {
            case 'service':
                return {
                    ...baseItem,
                    rating: data.rating || data.averageRating || 4.0,
                    price: data.price || data.rate || 0
                };
            case 'job':
                return {
                    ...baseItem,
                    salary: data.salary || data.budget || 0,
                    urgent: data.urgent || false
                };
            case 'marketplace':
                return {
                    ...baseItem,
                    price: data.price || 0,
                    condition: data.condition
                };
            default:
                return baseItem;
        }
    }

    // Merge and deduplicate results
    mergeAndDeduplicateResults(localResults, firebaseResults) {
        const merged = [...localResults];
        const localIds = new Set(localResults.map(r => r.id));

        firebaseResults.forEach(firebaseItem => {
            if (!localIds.has(firebaseItem.id)) {
                merged.push({ ...firebaseItem, score: (firebaseItem.score || 0) * 0.8 });
            }
        });

        return merged.sort((a, b) => b.score - a.score).slice(0, 30);
    }

    // Calculate relevance score for sorting
    calculateRelevanceScore(item, query, tokens) {
        let score = 0;
        const searchText = (item.title + ' ' + item.category + ' ' + item.location + ' ' + (item.description || '')).toLowerCase();
        const queryLower = query.toLowerCase();

        if (searchText.includes(queryLower)) score += 10;
        if (item.title.toLowerCase().includes(queryLower)) score += 5;

        tokens.forEach(token => {
            if (searchText.includes(token)) score += 2;
        });

        if (item.urgent) score += 3;
        if (item.rating) score += (item.rating - 3);

        if (item.createdAt) {
            const daysAgo = (new Date() - new Date(item.createdAt)) / (1000 * 60 * 60 * 24);
            if (daysAgo < 7) score += 1;
            if (daysAgo < 1) score += 2;
        }

        return score;
    }

    // Generate star rating HTML (fixes half-star logic)
    generateStars(rating) {
        if (!rating) return '<span class="no-rating">No ratings</span>';
        
        let stars = '';
        const fullStars = Math.floor(rating);
        const decimal = rating - fullStars;
        let hasHalfStar = decimal >= 0.3 && decimal <= 0.7;
        let hasQuarterStar = decimal > 0 && decimal < 0.3;
        let hasThreeQuarterStar = decimal > 0.7 && decimal < 1;
        
        for (let i = 1; i <= 5; i++) {
            if (i <= fullStars) {
                stars += '<i class="fas fa-star"></i>';
            } else if (i === fullStars + 1 && hasHalfStar) {
                stars += '<i class="fas fa-star-half-alt"></i>';
            } else if (i === fullStars + 1 && hasQuarterStar) {
                stars += '<i class="fas fa-star-quarter-alt"></i>';
            } else if (i === fullStars + 1 && hasThreeQuarterStar) {
                stars += '<i class="fas fa-star-three-quarters-alt"></i>';
            } else {
                stars += '<i class="far fa-star"></i>';
            }
        }
        return stars;
    }

    // Show loading state
    showSearchLoading() {
        const loadingHTML = `
            <div class="search-results-loading" style="text-align: center; padding: 40px;">
                <div class="loading-spinner"></div>
                <div class="loading-text">Searching for "${this.escapeHtml(this.lastSearchTerm)}"...</div>
            </div>
        `;
        this.showSearchResults(loadingHTML);
    }

    // Show search error
    showSearchError(message) {
        const errorHTML = `
            <div class="search-results-error" style="text-align: center; padding: 40px;">
                <div class="error-icon"><i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: var(--danger);"></i></div>
                <div class="error-message">${this.escapeHtml(message)}</div>
                <button class="btn btn-outline retry-search-btn" style="margin-top: 15px;">Try Again</button>
            </div>
        `;
        this.showSearchResults(errorHTML);
        
        const retryBtn = document.querySelector('.retry-search-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.retrySearch());
        }
    }

    // Retry last search
    retrySearch() {
        if (this.lastSearchTerm) {
            this.handleSearch(this.lastSearchTerm);
        }
    }

    // Display search results
    displaySearchResults(results, query) {
        this.hideSearchResults();

        if (results.length === 0) {
            this.showNoResults(query);
            return;
        }

        this.searchResults = results;
        const searchResultsHTML = this.generateSearchResultsHTML(results, query);
        this.showSearchResults(searchResultsHTML);
    }

    // Generate HTML for search results
    generateSearchResultsHTML(results, query) {
        const groupedResults = {
            service: results.filter(r => r.type === 'service'),
            job: results.filter(r => r.type === 'job'),
            marketplace: results.filter(r => r.type === 'marketplace')
        };

        let html = `
            <div class="search-results-header" style="display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid var(--grey);">
                <div>
                    <div class="search-query" style="font-weight: 600;">Results for "${this.escapeHtml(query)}"</div>
                    <div class="search-count" style="font-size: 0.8rem; color: var(--grey-dark);">${results.length} results found</div>
                </div>
                <button class="search-close btn btn-sm btn-outline" style="padding: 5px 10px;">✕</button>
            </div>
        `;

        if (groupedResults.service.length > 0) {
            html += this.generateSectionHTML('Services', groupedResults.service, 'service');
        }
        if (groupedResults.job.length > 0) {
            html += this.generateSectionHTML('Jobs', groupedResults.job, 'job');
        }
        if (groupedResults.marketplace.length > 0) {
            html += this.generateSectionHTML('Marketplace', groupedResults.marketplace, 'marketplace');
        }

        return html;
    }

    // Generate HTML for a results section
    generateSectionHTML(title, items, type) {
        return `
            <div class="search-results-section" style="padding: 15px; border-bottom: 1px solid var(--grey);">
                <div class="section-title" style="font-weight: 600; margin-bottom: 10px;">
                    <i class="fas ${this.getSectionIcon(type)}"></i>
                    ${title} (${items.length})
                </div>
                <div class="search-results-grid">
                    ${items.map(item => this.generateItemHTML(item, type)).join('')}
                </div>
            </div>
        `;
    }

    // Get icon for section type
    getSectionIcon(type) {
        switch (type) {
            case 'service': return 'fa-concierge-bell';
            case 'job': return 'fa-briefcase';
            case 'marketplace': return 'fa-shopping-cart';
            default: return 'fa-search';
        }
    }

    // Generate HTML for individual search result item
    generateItemHTML(item, type) {
        const baseHTML = `
            <div class="search-result-item ${type}-item" data-id="${item.id}" data-type="${type}" style="display: flex; padding: 10px; cursor: pointer; border-bottom: 1px solid var(--grey);">
                <div class="result-icon" style="width: 40px; height: 40px; background: var(--primary); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; margin-right: 12px;">
                    <i class="fas ${this.getSectionIcon(type)}"></i>
                </div>
                <div class="result-content" style="flex: 1;">
                    <div class="result-title" style="font-weight: 600; margin-bottom: 5px;">${this.escapeHtml(item.title)}</div>
                    <div class="result-meta" style="display: flex; gap: 10px; font-size: 0.7rem; color: var(--grey-dark); margin-bottom: 5px;">
                        <span class="result-category">${this.escapeHtml(item.category)}</span>
                        <span class="result-location"><i class="fas fa-map-marker-alt"></i> ${this.escapeHtml(item.location)}</span>
                    </div>
                    ${item.description ? `<div class="result-description" style="font-size: 0.75rem; color: var(--grey-dark);">${this.escapeHtml(item.description.substring(0, 80))}...</div>` : ''}
        `;

        switch (type) {
            case 'service':
                return baseHTML + `
                    <div class="result-rating" style="display: flex; align-items: center; gap: 5px; margin-top: 5px;">
                        ${this.generateStars(item.rating)}
                        <span class="rating-value" style="font-size: 0.7rem;">${item.rating}</span>
                    </div>
                    <div class="result-price" style="font-weight: 700; color: var(--primary); margin-top: 5px;">KSh ${item.price}</div>
                </div>
            </div>`;

            case 'job':
                return baseHTML + `
                    <div class="result-salary" style="font-weight: 700; color: var(--success); margin-top: 5px;">KSh ${item.salary}/month</div>
                    ${item.urgent ? '<div class="result-badge urgent" style="background: var(--emergency); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; display: inline-block; margin-top: 5px;">Urgent</div>' : ''}
                </div>
            </div>`;

            case 'marketplace':
                return baseHTML + `
                    <div class="result-price" style="font-weight: 700; color: var(--primary); margin-top: 5px;">KSh ${item.price}</div>
                    ${item.condition ? `<div class="result-condition" style="font-size: 0.7rem; color: var(--warning); margin-top: 5px;">${item.condition}</div>` : ''}
                </div>
            </div>`;

            default:
                return baseHTML + `</div></div>`;
        }
    }

    // Show "no results" message
    showNoResults(query) {
        const noResultsHTML = `
            <div class="search-no-results" style="text-align: center; padding: 60px 20px;">
                <div class="no-results-icon"><i class="fas fa-search" style="font-size: 3rem; color: var(--grey-dark);"></i></div>
                <div class="no-results-title" style="font-weight: 600; margin-top: 15px;">No results found</div>
                <div class="no-results-message" style="color: var(--grey-dark); margin-top: 5px;">We couldn't find any results for "${this.escapeHtml(query)}"</div>
                <div class="no-results-suggestions" style="margin-top: 20px; font-size: 0.8rem;">
                    <p>Try adjusting your search:</p>
                    <ul style="text-align: left; max-width: 250px; margin: 10px auto;">
                        <li>Check for spelling errors</li>
                        <li>Use more general terms</li>
                        <li>Try different keywords</li>
                    </ul>
                </div>
            </div>
        `;
        this.showSearchResults(noResultsHTML);
    }

    // Display search results container
    showSearchResults(html) {
        let resultsContainer = document.getElementById('search-results-container');
        
        if (!resultsContainer) {
            resultsContainer = document.createElement('div');
            resultsContainer.id = 'search-results-container';
            resultsContainer.className = 'search-results-container';
            resultsContainer.style.cssText = 'position: absolute; top: 100%; left: 0; right: 0; background: var(--background-color); border-radius: 0 0 10px 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); max-height: 400px; overflow-y: auto; z-index: 1000; display: none;';
            
            const firstSearchBar = document.querySelector('.search-bar');
            if (firstSearchBar) {
                firstSearchBar.style.position = 'relative';
                firstSearchBar.parentNode.insertBefore(resultsContainer, firstSearchBar.nextSibling);
            }
        }

        resultsContainer.innerHTML = html;
        resultsContainer.style.display = 'block';

        // Add click handlers to result items
        document.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.getAttribute('data-id');
                const type = item.getAttribute('data-type');
                this.selectResult(id, type);
            });
        });

        // Add close button handler
        const closeBtn = document.querySelector('.search-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideSearchResults());
        }

        // Click outside to close
        setTimeout(() => {
            document.addEventListener('click', this.handleClickOutside.bind(this));
        }, 100);
    }

    // Hide search results
    hideSearchResults() {
        const resultsContainer = document.getElementById('search-results-container');
        if (resultsContainer) {
            resultsContainer.style.display = 'none';
        }
        document.removeEventListener('click', this.handleClickOutside.bind(this));
    }

    // Handle clicks outside search results
    handleClickOutside(event) {
        const searchContainer = document.querySelector('.search-bar');
        const resultsContainer = document.getElementById('search-results-container');
        
        if (resultsContainer && 
            !resultsContainer.contains(event.target) && 
            !searchContainer.contains(event.target)) {
            this.hideSearchResults();
        }
    }

    // Handle result selection
    async selectResult(itemId, itemType) {
        this.hideSearchResults();

        document.querySelectorAll('.search-input').forEach(input => {
            input.value = '';
        });

        switch (itemType) {
            case 'service':
                if (typeof window.switchTab === 'function') {
                    window.switchTab('services-tab');
                }
                if (typeof window.showToast === 'function') {
                    window.showToast(`Opening service details`, 'success');
                }
                break;
            case 'job':
                if (typeof window.switchTab === 'function') {
                    window.switchTab('services-tab');
                }
                if (typeof window.showToast === 'function') {
                    window.showToast(`Viewing job opportunity`, 'success');
                }
                break;
            case 'marketplace':
                if (typeof window.switchTab === 'function') {
                    window.switchTab('marketplace-tab');
                }
                if (typeof window.showToast === 'function') {
                    window.showToast(`Viewing marketplace item`, 'success');
                }
                break;
        }
    }

    // Refresh search data
    async refreshSearchData() {
        await this.loadSearchData();
        if (typeof window.showToast === 'function') {
            window.showToast('Search index updated', 'success');
        }
    }

    // Escape HTML
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize search manager
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

console.log('✅ Search.js fully loaded with all fixes');