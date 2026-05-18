// search.js - Search functionality for VikeServe - FIXED FIREBASE PATTERN
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
        this.init();
    }

    async init() {
        await this.loadSearchData();
        this.setupSearchListeners();
    }

    // Load data from Firebase collections
    async loadSearchData() {
        try {
            console.log("Loading search data from Firebase...");
            
            // Load data from multiple collections in parallel
            const [servicesSnapshot, jobsSnapshot, marketplaceSnapshot] = await Promise.all([
                collections.services().limit(20).get(),
                collections.serviceRequests().where('type', '==', 'job').limit(20).get(),
                collections.marketplaceItems().limit(20).get()
            ]);

            this.searchData = [];

            // Process services
            servicesSnapshot.forEach(doc => {
                const service = doc.data();
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
                    urgent: service.urgent || false
                });
            });

            // Process jobs
            jobsSnapshot.forEach(doc => {
                const job = doc.data();
                this.searchData.push({
                    id: doc.id,
                    type: 'job',
                    title: job.title || 'Job Opportunity',
                    category: job.category || job.serviceType || 'general',
                    location: job.location || 'Nairobi',
                    salary: job.salary || job.budget || 0,
                    description: job.description || '',
                    urgent: job.urgent || false,
                    createdAt: job.createdAt
                });
            });

            // Process marketplace items
            marketplaceSnapshot.forEach(doc => {
                const item = doc.data();
                this.searchData.push({
                    id: doc.id,
                    type: 'marketplace',
                    title: item.title || item.name || 'Item',
                    category: item.category || 'general',
                    location: item.location || 'Nairobi',
                    price: item.price || 0,
                    description: item.description || '',
                    condition: item.condition,
                    createdAt: item.createdAt
                });
            });

            console.log(`Loaded ${this.searchData.length} items for search`);
            this.buildSearchIndex();

        } catch (error) {
            console.error("Error loading search data from Firebase:", error);
            // Fallback to sample data if Firebase fails
            await this.loadSampleData();
        }
    }

    // Fallback sample data
    async loadSampleData() {
        console.log("Loading sample search data...");
        this.searchData = [
            // Services
            { id: '1', type: 'service', title: 'Boda Boda Transport', category: 'transport', location: 'Nairobi', rating: 4.5, price: 100 },
            { id: '2', type: 'service', title: 'Plumbing Services', category: 'home-services', location: 'Nairobi', rating: 4.2, price: 500 },
            { id: '3', type: 'service', title: 'House Cleaning', category: 'home-services', location: 'Nairobi', rating: 4.7, price: 300 },
            { id: '4', type: 'service', title: 'Electrical Repair', category: 'home-services', location: 'Nairobi', rating: 4.3, price: 400 },
            
            // Jobs
            { id: '5', type: 'job', title: 'Construction Worker Needed', category: 'construction', location: 'Nairobi', salary: 800, urgent: true },
            { id: '6', type: 'job', title: 'Delivery Rider Position', category: 'delivery', location: 'Nairobi', salary: 600, urgent: false },
            { id: '7', type: 'job', title: 'Farm Assistant', category: 'agriculture', location: 'Kiambu', salary: 500, urgent: true },
            
            // Marketplace Items
            { id: '8', type: 'marketplace', title: 'Quality Mitumba Clothes', category: 'clothing', location: 'Gikomba', price: 200 },
            { id: '9', type: 'marketplace', title: 'Secondhand Smartphone', category: 'electronics', location: 'Nairobi', price: 5000 },
            { id: '10', type: 'marketplace', title: 'Fresh Fruits Basket', category: 'food', location: 'Nairobi', price: 150 }
        ];

        this.buildSearchIndex();
    }

    // Build search index for faster searching
    buildSearchIndex() {
        this.searchIndex = {};
        this.searchData.forEach(item => {
            const words = this.tokenize(item.title + ' ' + item.category + ' ' + item.location + ' ' + (item.description || ''));
            words.forEach(word => {
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
            // Real-time search as user types with debounce
            let timeout;
            input.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    this.handleSearch(e.target.value);
                }, 300);
            });

            // Search on Enter key
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleSearch(e.target.value);
                }
            });

            // Clear search on escape
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.hideSearchResults();
                    e.target.value = '';
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
        this.showSearchLoading();

        try {
            const results = await this.search(this.lastSearchTerm);
            this.displaySearchResults(results, this.lastSearchTerm);
        } catch (error) {
            console.error("Search error:", error);
            this.showSearchError("Search failed. Please try again.");
        }
    }

    // Perform search with Firebase fallback
    async search(query) {
        // First try local search
        let results = this.performLocalSearch(query);
        
        // If few results, try searching Firebase directly
        if (results.length < 5) {
            try {
                const firebaseResults = await this.searchFirebase(query);
                results = this.mergeAndDeduplicateResults(results, firebaseResults);
            } catch (error) {
                console.warn("Firebase search failed, using local results only:", error);
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

        // Convert IDs back to full objects and score them
        resultIds.forEach(id => {
            const item = this.searchData.find(d => d.id === id);
            if (item) {
                const score = this.calculateRelevanceScore(item, query, tokens);
                scoredResults.push({ ...item, score });
            }
        });

        // Sort by relevance score
        return scoredResults.sort((a, b) => b.score - a.score);
    }

    // Search Firebase directly for more comprehensive results
    async searchFirebase(query) {
        const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
        const results = [];

        // Search across multiple collections
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
        
        // Create query for each search term and combine results
        for (const term of searchTerms) {
            try {
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
                console.warn(`Search in ${type} collection failed for term "${term}":`, error);
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
            fromFirebase: true
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

    // Merge and deduplicate search results
    mergeAndDeduplicateResults(localResults, firebaseResults) {
        const merged = [...localResults];
        const localIds = new Set(localResults.map(r => r.id));

        firebaseResults.forEach(firebaseItem => {
            if (!localIds.has(firebaseItem.id)) {
                // Add slight penalty for Firebase results to prioritize local matches
                merged.push({ ...firebaseItem, score: (firebaseItem.score || 0) * 0.8 });
            }
        });

        return merged.sort((a, b) => b.score - a.score);
    }

    // Calculate relevance score for sorting
    calculateRelevanceScore(item, query, tokens) {
        let score = 0;
        const searchText = (item.title + ' ' + item.category + ' ' + item.location + ' ' + (item.description || '')).toLowerCase();
        const queryLower = query.toLowerCase();

        // Exact match bonus
        if (searchText.includes(queryLower)) {
            score += 10;
        }

        // Title match bonus
        if (item.title.toLowerCase().includes(queryLower)) {
            score += 5;
        }

        // Token matches
        tokens.forEach(token => {
            if (searchText.includes(token)) {
                score += 2;
            }
        });

        // Urgent items get bonus
        if (item.urgent) {
            score += 3;
        }

        // Higher rated items get bonus
        if (item.rating) {
            score += (item.rating - 3); // Bonus for ratings above 3
        }

        // Recent items get slight bonus
        if (item.createdAt) {
            const daysAgo = (new Date() - new Date(item.createdAt)) / (1000 * 60 * 60 * 24);
            if (daysAgo < 7) score += 1; // Items from last week
            if (daysAgo < 1) score += 2; // Items from today
        }

        return score;
    }

    // Show loading state
    showSearchLoading() {
        const loadingHTML = `
            <div class="search-results-loading">
                <div class="loading-spinner"></div>
                <div class="loading-text">Searching for "${this.lastSearchTerm}"...</div>
            </div>
        `;
        this.showSearchResults(loadingHTML);
    }

    // Show search error
    showSearchError(message) {
        const errorHTML = `
            <div class="search-results-error">
                <div class="error-icon"><i class="fas fa-exclamation-triangle"></i></div>
                <div class="error-message">${message}</div>
                <button class="btn btn-outline" onclick="search.retrySearch()">Try Again</button>
            </div>
        `;
        this.showSearchResults(errorHTML);
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
        // Group results by type
        const groupedResults = {
            service: results.filter(r => r.type === 'service'),
            job: results.filter(r => r.type === 'job'),
            marketplace: results.filter(r => r.type === 'marketplace')
        };

        let html = `
            <div class="search-results-header">
                <div class="search-query">Results for "${query}"</div>
                <div class="search-count">${results.length} results found</div>
                <button class="search-close" onclick="search.hideSearchResults()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // Services section
        if (groupedResults.service.length > 0) {
            html += this.generateSectionHTML('Services', groupedResults.service, 'service');
        }

        // Jobs section
        if (groupedResults.job.length > 0) {
            html += this.generateSectionHTML('Jobs', groupedResults.job, 'job');
        }

        // Marketplace section
        if (groupedResults.marketplace.length > 0) {
            html += this.generateSectionHTML('Marketplace', groupedResults.marketplace, 'marketplace');
        }

        return html;
    }

    // Generate HTML for a results section
    generateSectionHTML(title, items, type) {
        return `
            <div class="search-results-section">
                <div class="section-title">
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
            <div class="search-result-item ${type}-item" data-id="${item.id}" onclick="search.selectResult('${item.id}', '${type}')">
                <div class="result-icon"><i class="fas ${this.getSectionIcon(type)}"></i></div>
                <div class="result-content">
                    <div class="result-title">${this.escapeHtml(item.title)}</div>
                    <div class="result-meta">
                        <span class="result-category">${this.escapeHtml(item.category)}</span>
                        <span class="result-location"><i class="fas fa-map-marker-alt"></i> ${this.escapeHtml(item.location)}</span>
                    </div>
                    ${item.description ? `<div class="result-description">${this.escapeHtml(item.description.substring(0, 100))}...</div>` : ''}
        `;

        switch (type) {
            case 'service':
                return baseHTML + `
                    <div class="result-rating">
                        ${this.generateStars(item.rating)}
                        <span class="rating-value">${item.rating}</span>
                    </div>
                    <div class="result-price">KSh ${item.price}</div>
                </div>
            </div>`;

            case 'job':
                return baseHTML + `
                    <div class="result-salary">KSh ${item.salary}/month</div>
                    ${item.urgent ? '<div class="result-badge urgent">Urgent</div>' : ''}
                </div>
            </div>`;

            case 'marketplace':
                return baseHTML + `
                    <div class="result-price">KSh ${item.price}</div>
                    ${item.condition ? `<div class="result-condition">${item.condition}</div>` : ''}
                </div>
            </div>`;

            default:
                return baseHTML + `</div></div>`;
        }
    }

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Generate star rating HTML
    generateStars(rating) {
        if (!rating) return '<span class="no-rating">No ratings</span>';
        
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= rating) {
                stars += '<i class="fas fa-star"></i>';
            } else if (i - 0.5 <= rating) {
                stars += '<i class="fas fa-star-half-alt"></i>';
            } else {
                stars += '<i class="far fa-star"></i>';
            }
        }
        return stars;
    }

    // Show "no results" message
    showNoResults(query) {
        const noResultsHTML = `
            <div class="search-no-results">
                <div class="no-results-icon"><i class="fas fa-search"></i></div>
                <div class="no-results-title">No results found</div>
                <div class="no-results-message">We couldn't find any results for "${query}"</div>
                <div class="no-results-suggestions">
                    <p>Try adjusting your search:</p>
                    <ul>
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
            
            // Insert after the first search bar
            const firstSearchBar = document.querySelector('.search-bar');
            if (firstSearchBar) {
                firstSearchBar.parentNode.insertBefore(resultsContainer, firstSearchBar.nextSibling);
            }

            // CSS styles if not already present
            this.injectSearchStyles();
        }

        resultsContainer.innerHTML = html;
        resultsContainer.style.display = 'block';

        // Click outside to close
        setTimeout(() => {
            document.addEventListener('click', this.handleClickOutside.bind(this));
        }, 100);
    }

    // Inject search results CSS
    injectSearchStyles() {
        if (document.getElementById('search-results-styles')) return;

        const styles = `
            <style id="search-results-styles">
                .search-results-container {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    background: white;
                    border-radius: 0 0 10px 10px;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                    max-height: 400px;
                    overflow-y: auto;
                    z-index: 1000;
                    display: none;
                }
                .search-results-header {
                    padding: 15px;
                    border-bottom: 1px solid #eee;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .search-results-section {
                    padding: 15px;
                    border-bottom: 1px solid #f5f5f5;
                }
                .search-result-item {
                    display: flex;
                    padding: 10px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .search-result-item:hover {
                    background-color: #f8f9fa;
                }
                .result-icon {
                    width: 40px;
                    height: 40px;
                    background: #2E86DE;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    margin-right: 12px;
                }
                .result-content {
                    flex: 1;
                }
                .result-title {
                    font-weight: 600;
                    margin-bottom: 5px;
                }
                .result-meta {
                    display: flex;
                    gap: 10px;
                    font-size: 0.8rem;
                    color: #666;
                    margin-bottom: 5px;
                }
                .search-results-loading,
                .search-results-error,
                .search-no-results {
                    padding: 40px 20px;
                    text-align: center;
                }
                .loading-spinner {
                    border: 3px solid #f3f3f3;
                    border-top: 3px solid #2E86DE;
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 15px;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        document.head.insertAdjacentHTML('beforeend', styles);
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

        // Clear search input
        document.querySelectorAll('.search-input').forEach(input => {
            input.value = '';
        });

        // Show appropriate tab based on item type
        switch (itemType) {
            case 'service':
                switchTab('services-tab');
                showToast(`Opening service details`, 'success');
                break;
            case 'job':
                switchTab('services-tab');
                showToast(`Viewing job opportunity`, 'success');
                break;
            case 'marketplace':
                switchTab('marketplace-tab');
                showToast(`Viewing marketplace item`, 'success');
                break;
        }

        // In a real implementation, you would:
        // 1. Navigate to the item detail page
        // 2. Load full item details from Firebase
        // 3. Update UI accordingly
        console.log('Selected item:', { id: itemId, type: itemType });
    }

    // Advanced search with filters
    async advancedSearch(query, filters = {}) {
        this.currentFilters = filters;
        let results = await this.search(query);
        
        // Apply filters
        if (filters.category) {
            results = results.filter(item => 
                item.category.toLowerCase().includes(filters.category.toLowerCase())
            );
        }
        
        if (filters.location) {
            results = results.filter(item => 
                item.location.toLowerCase().includes(filters.location.toLowerCase())
            );
        }
        
        if (filters.minPrice) {
            results = results.filter(item => item.price >= filters.minPrice);
        }
        
        if (filters.maxPrice) {
            results = results.filter(item => item.price <= filters.maxPrice);
        }

        if (filters.type) {
            results = results.filter(item => item.type === filters.type);
        }

        return results;
    }

    // Refresh search data (useful when new items are added)
    async refreshSearchData() {
        await this.loadSearchData();
        showToast('Search index updated', 'success');
    }
}

// Initialize search manager when Firebase is ready
function initializeSearchManager() {
    window.search = new SearchManager();
    console.log("Search manager initialized with Firebase integration");
}

// Make sure Firebase is initialized before creating search manager
if (typeof db !== 'undefined' && db) {
    initializeSearchManager();
} else {
    // Wait for Firebase to be ready
    document.addEventListener('firebase-ready', initializeSearchManager);
}

// Make available globally
window.SearchManager = SearchManager;