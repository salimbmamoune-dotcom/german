/**
 * German Vocabulary Learning App
 * Enhanced version with improved structure, performance, and accessibility
 */

// =========================
// Configuration and Constants
// =========================
const CONFIG = {
  PER_DAY: 30,
  CHUNK_SIZE: 20, // Reduced for better performance
  USE_EXTERNAL_TTS: true,
  IMAGE_LAZY_LOAD: true,
  HIDE_TRANSLATION: false,
  SEARCH_DELAY: 200,
  TOAST_DURATION: 3000,
  MAX_RENDER_WORDS: 1000, // Limit for performance
  MAX_AUDIO_CACHE: 50, // Limit audio cache size
  MAX_IMAGE_CACHE: 100, // Limit image cache size
  RETRY_ATTEMPTS: 3, // Retry failed operations
  CACHE_CLEANUP_INTERVAL: 300000, // 5 minutes
  STORAGE_KEYS: {
    WORDS: 'germanWords:v5',
    SETTINGS: 'germanWordsSettings',
    CACHE: 'germanWordsCache'
  }
};

// =========================
// Application State
// =========================
class AppState {
  constructor() {
    this.allWords = [];
    this.filtered = [];
    this.perDay = CONFIG.PER_DAY;
    this.currentDay = 0;
    this.renderedCount = 0;
    this.cacheManager = new CacheManager();
    this.activeFilter = 'all';
    this.showFavoritesOnly = false;
    this.hideTranslation = CONFIG.HIDE_TRANSLATION;
    this.currentEditingWord = null;
    this.isLoading = false;
    this.isOnline = navigator.onLine;
    this.eventListeners = new Map();
  }

  /**
   * Update filtered words based on current filters
   */
  updateFiltered() {
    try {
      let filtered = [...this.allWords];
      
      // Apply favorites filter
      if (this.showFavoritesOnly) {
        filtered = filtered.filter(w => w.isFavorite);
      }
      
      // Apply type filter
      if (this.activeFilter && this.activeFilter !== 'all') {
        if (this.activeFilter === 'favorites') {
          filtered = filtered.filter(w => w.isFavorite);
        } else {
          filtered = filtered.filter(w => w.type === this.activeFilter);
        }
      }
      
      this.filtered = filtered;
      console.log(`🔍 Filtered: ${filtered.length} words (filter: ${this.activeFilter})`);
    } catch (error) {
      console.error('Error updating filtered words:', error);
      this.filtered = [...this.allWords];
    }
  }

  /**
   * Add event listener with tracking
   */
  addEventListener(element, event, handler, options = {}) {
    const key = `${element.id || 'unknown'}_${event}`;
    element.addEventListener(event, handler, options);
    this.eventListeners.set(key, { element, event, handler, options });
  }

  /**
   * Remove event listener
   */
  removeEventListener(element, event, handler) {
    const key = `${element.id || 'unknown'}_${event}`;
    element.removeEventListener(event, handler);
    this.eventListeners.delete(key);
  }

  /**
   * Clean up all event listeners
   */
  cleanupEventListeners() {
    for (const [key, { element, event, handler }] of this.eventListeners) {
      element.removeEventListener(event, handler);
    }
    this.eventListeners.clear();
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.cleanupEventListeners();
    this.cacheManager.stopCleanupTimer();
    this.cacheManager.clearAll();
  }
}

// =========================
// Cache Management System
// =========================
class CacheManager {
  constructor() {
    this.audioCache = new Map();
    this.imageCache = new Map();
    this.cleanupInterval = null;
    this.startCleanupTimer();
  }

  /**
   * Add audio to cache with size limit
   */
  addAudio(url, audio) {
    if (this.audioCache.size >= CONFIG.MAX_AUDIO_CACHE) {
      // Remove oldest entry
      const firstKey = this.audioCache.keys().next().value;
      this.audioCache.delete(firstKey);
    }
    this.audioCache.set(url, {
      audio: audio.cloneNode(),
      timestamp: Date.now()
    });
  }

  /**
   * Get audio from cache
   */
  getAudio(url) {
    const cached = this.audioCache.get(url);
    if (cached) {
      cached.timestamp = Date.now(); // Update access time
      return cached.audio.cloneNode();
    }
    return null;
  }

  /**
   * Add image to cache
   */
  addImage(url, imageData) {
    if (this.imageCache.size >= CONFIG.MAX_IMAGE_CACHE) {
      const firstKey = this.imageCache.keys().next().value;
      this.imageCache.delete(firstKey);
    }
    this.imageCache.set(url, {
      data: imageData,
      timestamp: Date.now()
    });
  }

  /**
   * Get image from cache
   */
  getImage(url) {
    const cached = this.imageCache.get(url);
    if (cached) {
      cached.timestamp = Date.now();
      return cached.data;
    }
    return null;
  }

  /**
   * Clean up old cache entries
   */
  cleanup() {
    const now = Date.now();
    const maxAge = CONFIG.CACHE_CLEANUP_INTERVAL;

    // Clean audio cache
    for (const [url, cached] of this.audioCache.entries()) {
      if (now - cached.timestamp > maxAge) {
        this.audioCache.delete(url);
      }
    }

    // Clean image cache
    for (const [url, cached] of this.imageCache.entries()) {
      if (now - cached.timestamp > maxAge) {
        this.imageCache.delete(url);
      }
    }
  }

  /**
   * Start cleanup timer
   */
  startCleanupTimer() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, CONFIG.CACHE_CLEANUP_INTERVAL);
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clear all caches
   */
  clearAll() {
    this.audioCache.clear();
    this.imageCache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      audioCacheSize: this.audioCache.size,
      imageCacheSize: this.imageCache.size,
      totalMemoryUsage: this.audioCache.size + this.imageCache.size
    };
  }
}

// =========================
// Utility Functions
// =========================
class Utils {
  /**
   * Normalize word type to standard format
   */
  static normalizeType(type) {
    if (!type || typeof type !== 'string' || type.trim() === '') return 'other';
    const s = String(type).trim().toLowerCase();
    
    const typeMap = {
      'nomen': ['nomen', 'noun', 'der', 'die', 'das', 'n', 'nom', 'substantiv'],
      'verb': ['verb', 'verben', 'v'],
      'adjektiv': ['adjektiv', 'adjektive', 'adj', 'a', 'adjective'],
      'redewendung': ['redewendung', 'spruch', 'red', 'phrase', 'expression', 'ausdruck', 'idiom', 'sprichwort', 'p'],
      'adverb': ['adverb', 'adv'],
      'präposition': ['präposition', 'preposition', 'prep'],
      'konjunktion': ['konjunktion', 'conjunction', 'conj'],
      'artikel': ['artikel', 'article'],
      'pronomen': ['pronomen', 'pronoun', 'pron'],
      'numeral': ['numeral', 'number'],
      'interjektion': ['interjektion', 'interjection', 'interj'],
      'abkürzung': ['abkürzung', 'abbreviation', 'abbr', 'abk']
    };
    
    for (const [key, values] of Object.entries(typeMap)) {
      if (values.some(x => s.includes(x))) return key;
    }
    
    return s;
  }

  /**
   * Prettify type for display
   */
  static prettifyType(type) {
    const typeMap = {
      'nomen': 'اسم (Nomen)',
      'verb': 'فعل (Verb)',
      'adjektiv': 'صفة (Adjektiv)',
      'redewendung': 'تعبير (Redewendung)',
      'adverb': 'ظرف (Adverb)',
      'präposition': 'حرف جر (Präposition)',
      'konjunktion': 'أداة ربط (Konjunktion)',
      'artikel': 'أداة تعريف (Artikel)',
      'pronomen': 'ضمير (Pronomen)',
      'numeral': 'عدد (Numeral)',
      'interjektion': 'تعجب (Interjektion)',
      'abkürzung': 'اختصار (Abkürzung)'
    };
    return typeMap[type] || (type ? type.charAt(0).toUpperCase() + type.slice(1) : '');
  }

  /**
   * Debounce function for search
   */
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Safe JSON parse with error handling
   */
  static safeJsonParse(str, defaultValue = null) {
    try {
      return JSON.parse(str);
    } catch (e) {
      console.warn('JSON parse error:', e);
      return defaultValue;
    }
  }

  /**
   * Safe localStorage operations with retry
   */
  static safeStorage = {
    getItem: (key) => {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        console.warn('localStorage get error:', e);
        return null;
      }
    },
    setItem: (key, value) => {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (e) {
        console.warn('localStorage set error:', e);
        // Try to clear some space if quota exceeded
        if (e.name === 'QuotaExceededError') {
          Utils.clearOldData();
          try {
            localStorage.setItem(key, value);
            return true;
          } catch (e2) {
            console.error('Failed to save after cleanup:', e2);
            return false;
          }
        }
        return false;
      }
    },
    removeItem: (key) => {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (e) {
        console.warn('localStorage remove error:', e);
        return false;
      }
    }
  };

  /**
   * Clear old data to free up space
   */
  static clearOldData() {
    try {
      // Clear old cache data
      const keys = Object.keys(localStorage);
      const oldKeys = keys.filter(key => 
        key.includes('cache') || 
        key.includes('temp') ||
        (key.includes('germanWords') && !key.includes('v5'))
      );
      
      oldKeys.forEach(key => localStorage.removeItem(key));
      console.log(`Cleared ${oldKeys.length} old entries`);
    } catch (e) {
      console.error('Error clearing old data:', e);
    }
  }

  /**
   * Retry mechanism for async operations
   */
  static async retry(fn, maxAttempts = CONFIG.RETRY_ATTEMPTS, delay = 1000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        console.warn(`Attempt ${attempt} failed:`, error);
        
        if (attempt === maxAttempts) {
          throw error;
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }

  /**
   * Enhanced error handling with context
   */
  static handleError(error, context = 'Unknown operation') {
    const errorInfo = {
      message: error.message || 'Unknown error',
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      stack: error.stack || 'No stack trace available'
    };
    
    console.error('Application Error:', errorInfo);
    
    // Store error for debugging
    try {
      const errors = JSON.parse(localStorage.getItem('appErrors') || '[]');
      errors.push(errorInfo);
      if (errors.length > 10) errors.shift(); // Keep only last 10 errors
      localStorage.setItem('appErrors', JSON.stringify(errors));
    } catch (e) {
      console.warn('Could not store error info:', e);
    }
    
    // Send to server for centralized monitoring (if available)
    this.sendErrorToServer(errorInfo);
    
    return errorInfo;
  }

  /**
   * Send error to server for centralized monitoring
   */
  static async sendErrorToServer(errorInfo) {
    try {
      // Only send if we have a server endpoint configured
      if (window.APP_CONFIG && window.APP_CONFIG.errorEndpoint) {
        await fetch(window.APP_CONFIG.errorEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(errorInfo)
        });
      }
    } catch (e) {
      // Silently fail - don't create error loops
      console.debug('Could not send error to server:', e);
    }
  }

  /**
   * Validate word object with comprehensive checks
   */
  static validateWord(word) {
    if (!word || typeof word !== 'object') return false;
    
    // Check required fields
    if (!word.german || !word.arabic) return false;
    
    // Sanitize and validate text content
    const german = String(word.german).trim();
    const arabic = String(word.arabic).trim();
    
    if (!german || !arabic || german.length > 200 || arabic.length > 200) {
      return false;
    }
    
    // Type is optional, but if present should be a string
    if (word.type !== undefined && word.type !== null) {
      if (typeof word.type !== 'string') return false;
    }
    
    // Validate boolean fields
    if (word.isLearned !== undefined && typeof word.isLearned !== 'boolean') return false;
    if (word.isFavorite !== undefined && typeof word.isFavorite !== 'boolean') return false;
    
    // Validate image URL if present
    if (word.image_url && typeof word.image_url === 'string') {
      try {
        new URL(word.image_url);
      } catch (e) {
        return false; // Invalid URL
      }
    }
    
    return true;
  }

  /**
   * Sanitize word data
   */
  static sanitizeWord(word) {
    return {
      german: String(word.german || '').trim().substring(0, 200),
      arabic: String(word.arabic || '').trim().substring(0, 200),
      type: word.type ? String(word.type).trim().substring(0, 50) : 'other',
      image_url: word.image_url ? String(word.image_url).trim() : '',
      isLearned: Boolean(word.isLearned),
      isFavorite: Boolean(word.isFavorite)
    };
  }

  /**
   * Validate import data structure
   */
  static validateImportData(data) {
    if (!data) return { valid: false, error: 'No data provided' };
    
    if (typeof data !== 'object') {
      return { valid: false, error: 'Data must be an object' };
    }
    
    let words = [];
    if (Array.isArray(data)) {
      words = data;
    } else if (Array.isArray(data.words)) {
      words = data.words;
    } else {
      return { valid: false, error: 'No words array found' };
    }
    
    if (words.length === 0) {
      return { valid: false, error: 'No words in data' };
    }
    
    if (words.length > 10000) {
      return { valid: false, error: 'Too many words (max 10,000)' };
    }
    
    // Validate each word
    const validWords = [];
    const errors = [];
    
    words.forEach((word, index) => {
      if (Utils.validateWord(word)) {
        validWords.push(Utils.sanitizeWord(word));
      } else {
        errors.push(`Invalid word at index ${index}: ${word.german || 'unknown'}`);
      }
    });
    
    return {
      valid: validWords.length > 0,
      words: validWords,
      errors: errors,
      totalWords: words.length,
      validWords: validWords.length,
      invalidWords: errors.length
    };
  }

  /**
   * Sanitize URL for image loading
   */
  static sanitizeImageUrl(url) {
    if (!url || typeof url !== 'string') return '';
    
    let cleanUrl = url.trim();
    
    // Handle DuckDuckGo URLs - extract actual image URL from iai parameter
    if (cleanUrl.includes('duckduckgo.com') && cleanUrl.includes('iai=')) {
      try {
        const urlParams = new URLSearchParams(cleanUrl.split('?')[1]);
        const imageUrl = urlParams.get('iai');
        if (imageUrl) {
          cleanUrl = decodeURIComponent(imageUrl);
          console.log('Extracted image URL from DuckDuckGo:', cleanUrl);
        }
      } catch (e) {
        console.warn('Error parsing DuckDuckGo URL:', e);
        return cleanUrl; // Return original if parsing fails
      }
    }
    
    // Validate URL format
    try {
      new URL(cleanUrl);
      return cleanUrl;
    } catch (e) {
      console.warn('Invalid image URL:', cleanUrl);
      return url; // Return original URL instead of empty string
    }
  }

  /**
   * Test image URL accessibility with CORS handling
   */
  static async testImageUrl(url) {
    return new Promise((resolve) => {
      const img = new Image();
      const timeout = setTimeout(() => {
        console.warn('Image load timeout:', url);
        resolve(false);
      }, 15000);
      
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        clearTimeout(timeout);
        console.log('Image loaded successfully:', url);
        resolve(true);
      };
      
      img.onerror = (error) => {
        clearTimeout(timeout);
        console.warn('Image load error:', url, error);
        resolve(false);
      };
      
      // Try to load the image
      try {
        img.src = url;
      } catch (error) {
        clearTimeout(timeout);
        console.warn('Error setting image src:', error);
        resolve(false);
      }
    });
  }

  /**
   * Test image URL with fetch (alternative method)
   */
  static async testImageUrlWithFetch(url) {
    try {
      // Use a simple GET request instead of HEAD for better compatibility
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache'
      });
      
      // Check if response is ok and content type is image
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        return contentType && contentType.startsWith('image/');
      }
      
      return false;
    } catch (error) {
      console.warn('Fetch test failed:', error);
      return false;
    }
  }
}

// =========================
// Core Application Class
// =========================
class GermanLearningApp {
  constructor() {
    this.state = new AppState();
    this.initialWords = [];
    this.imageObserver = null;
    this.searchDebounced = Utils.debounce(this.handleSearch.bind(this), CONFIG.SEARCH_DELAY);
    this.performanceObserver = null;
    this.offlineHandler = null;
    
    this.init();
  }

  /**
   * Get initial words data
   */
  async getInitialWords() {
    try {
      const response = await fetch('./vocab_with_types.json?t=' + Date.now());
      const data = await response.json();
      console.log('Loaded vocabulary from JSON:', data.length, 'words');
      return data;
    } catch (error) {
      console.error('Error loading vocabulary:', error);
      return [];
    }
  }

  /**
   * Initialize the application
   */
  async init() {
    try {
      console.log('🚀 Initializing German Learning App...');
      
      console.log('📊 Setting up performance monitoring...');
      this.setupPerformanceMonitoring();
      
      console.log('🌐 Setting up offline detection...');
      this.setupOfflineDetection();
      
      console.log('👁️ Setting up image observer...');
      this.setupImageObserver();
      
      console.log('📚 Loading vocabulary data...');
      this.initialWords = await this.getInitialWords();
      
      console.log('💾 Loading app data...');
      await this.loadData();
      
      console.log('⚙️ Loading settings...');
      this.loadSettings();
      
      console.log('🎯 Setting up event listeners...');
      this.setupEventListeners();
      
      console.log('🎨 Rendering UI...');
      this.render();
      
      console.log('✅ App initialization completed successfully');
      this.showToast('تم تحميل التطبيق بنجاح', 'success');
    } catch (error) {
      console.error('❌ App initialization failed at step:', error.message);
      console.error('Full error:', error);
      
      // Show error toast
      this.showToast('حدث خطأ في تحميل التطبيق: ' + error.message, 'error');
      
      // Try to recover with minimal functionality
      try {
        console.log('🔄 Attempting recovery...');
        await this.recoverFromError();
      } catch (recoveryError) {
        console.error('💥 Recovery failed:', recoveryError);
        throw error; // Re-throw original error
      }
    }
  }

  /**
   * Setup performance monitoring
   */
  setupPerformanceMonitoring() {
    if ('PerformanceObserver' in window) {
      try {
        this.performanceObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            if (entry.entryType === 'measure' && entry.duration > 1000) {
              console.warn(`Slow operation detected: ${entry.name} took ${entry.duration}ms`);
            }
          });
        });
        this.performanceObserver.observe({ entryTypes: ['measure'] });
      } catch (e) {
        console.warn('Performance monitoring not available:', e);
      }
    }
  }

  /**
   * Setup offline detection
   */
  setupOfflineDetection() {
    this.offlineHandler = () => {
      this.state.isOnline = navigator.onLine;
      if (!this.state.isOnline) {
        this.showToast('تم فقدان الاتصال بالإنترنت', 'warning');
      } else {
        this.showToast('تم استعادة الاتصال بالإنترنت', 'success');
      }
    };
    
    window.addEventListener('online', this.offlineHandler);
    window.addEventListener('offline', this.offlineHandler);
  }

  /**
   * Recover from errors
   */
  async recoverFromError() {
    try {
      // Clear potentially corrupted data
      this.state.cleanup();
      
      // Try to load with minimal data
      this.state.allWords = this.initialWords || [];
      this.state.updateFiltered();
      
      // Re-render with basic functionality
      this.render();
      
      this.showToast('تم استعادة التطبيق بنجاح', 'success');
    } catch (e) {
      throw new Error('Recovery failed: ' + e.message);
    }
  }

  /**
   * Setup Intersection Observer for lazy image loading
   */
  setupImageObserver() {
    if (!('IntersectionObserver' in window)) {
      console.warn('IntersectionObserver not supported');
      return;
    }

    this.imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          
          // Check if image has data-src and hasn't been loaded yet
          if (img.dataset && img.dataset.src && !img.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
          } else if (img.src) {
            // Image already loaded, stop observing
            this.imageObserver.unobserve(img);
            return;
          }
          
          this.imageObserver.unobserve(img);
        }
      });
    }, { 
      root: null, 
      rootMargin: '200px', 
      threshold: 0.01 
    });
  }

  /**
   * Load words data from localStorage or use initial data
   */
  loadData() {
    try {
      console.log('📊 Loading data...');
      
      // Try to load from localStorage first
      const savedData = Utils.safeStorage.getItem(CONFIG.STORAGE_KEYS.WORDS);
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.state.allWords = parsed;
            console.log(`✅ Loaded ${parsed.length} words from localStorage`);
            this.state.updateFiltered();
            return;
          }
        } catch (e) {
          console.warn('Failed to parse saved data:', e);
        }
      }
      
      // If no saved data, load from JSON
      console.log('Initial words count:', this.initialWords ? this.initialWords.length : 0);
      
      const initialWords = Array.isArray(this.initialWords) ? 
        this.initialWords : 
        (this.initialWords && this.initialWords.words ? this.initialWords.words : []);

      console.log('Processed initial words count:', initialWords.length);

      if (initialWords.length === 0) {
        console.warn('⚠️ No initial words found, using empty array');
        this.state.allWords = [];
        this.state.updateFiltered();
        return;
      }

      // Normalize words
      const allWords = [];
      let validCount = 0;
      let invalidCount = 0;
      const typeStats = {};
      
      initialWords.forEach((word, index) => {
        try {
          if (Utils.validateWord(word)) {
            const normalized = this.normalizeWord(word);
            allWords.push(normalized);
            validCount++;
            
            typeStats[normalized.type] = (typeStats[normalized.type] || 0) + 1;
          } else {
            invalidCount++;
            console.warn(`Invalid word at index ${index}:`, word);
          }
        } catch (wordError) {
          invalidCount++;
          console.warn(`Error processing word at index ${index}:`, wordError, word);
        }
      });

      this.state.allWords = allWords;
      console.log(`✅ Data loaded: ${validCount} valid, ${invalidCount} invalid, ${this.state.allWords.length} total`);
      console.log('📊 Type statistics:', typeStats);
      
      // Save to localStorage
      this.saveState();
      this.state.updateFiltered();
    } catch (error) {
      console.error('❌ Error in loadData:', error);
      this.state.allWords = [];
      this.state.updateFiltered();
      throw new Error('Failed to load vocabulary data: ' + error.message);
    }
  }

  /**
   * Normalize word object
   */
  normalizeWord(word) {
    const type = word.type || word.Type || '';
    return {
      german: (word.german || '').trim(),
      arabic: (word.arabic || '').trim(),
      type: Utils.normalizeType(type),
      image_url: word.image_url || '',
      isLearned: !!word.isLearned,
      isFavorite: !!word.isFavorite
    };
  }

  /**
   * Load settings from localStorage
   */
  loadSettings() {
    const settings = Utils.safeJsonParse(
      Utils.safeStorage.getItem(CONFIG.STORAGE_KEYS.SETTINGS), 
      {}
    );

    if (settings.hideTranslation !== undefined) {
      this.state.hideTranslation = settings.hideTranslation;
      this.updateHideTranslationButton();
    }

    if (settings.showFavoritesOnly !== undefined) {
      this.state.showFavoritesOnly = settings.showFavoritesOnly;
      this.updateFavoritesButton();
    }

    // Load dark mode
    if (Utils.safeStorage.getItem('appDark') === '1') {
      document.body.classList.add('dark-mode');
    }
  }

  /**
   * Setup all event listeners with accessibility
   */
  setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Search with enhanced accessibility
    const searchInput = document.getElementById('search');
    if (searchInput) {
      this.state.addEventListener(searchInput, 'input', this.searchDebounced);
      this.state.addEventListener(searchInput, 'keydown', (e) => {
        if (e.key === 'Escape') {
          searchInput.value = '';
          this.handleSearch();
        }
      });
      console.log('✓ Search input listeners attached');
    } else {
      console.warn('❌ Search input not found');
    }

    // Filter tabs with ARIA support
    const filterTabs = document.querySelectorAll('.filter-tab');
    console.log(`Found ${filterTabs.length} filter tabs`);
    filterTabs.forEach((tab, index) => {
      this.state.addEventListener(tab, 'click', (e) => this.handleFilterClick(e));
      this.state.addEventListener(tab, 'keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.handleFilterClick(e);
        }
      });
      console.log(`✓ Filter tab ${index + 1} listeners attached`);
    });

    // Control buttons
    this.setupControlButtons();
    
    // Modal events
    this.setupModalEvents();
    
    // Enhanced keyboard shortcuts
    this.setupKeyboardShortcuts();
    
    // Accessibility improvements
    this.setupAccessibilityFeatures();
    
    // Save state before unload
    window.addEventListener('beforeunload', () => this.saveState());
    
    console.log('✓ All event listeners setup completed');
  }

  /**
   * Setup accessibility features
   */
  setupAccessibilityFeatures() {
    // Add ARIA live region for announcements
    if (!document.getElementById('aria-live')) {
      const liveRegion = document.createElement('div');
      liveRegion.id = 'aria-live';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.style.position = 'absolute';
      liveRegion.style.left = '-10000px';
      liveRegion.style.width = '1px';
      liveRegion.style.height = '1px';
      liveRegion.style.overflow = 'hidden';
      document.body.appendChild(liveRegion);
    }

    // Add skip links
    this.addSkipLinks();
    
    // Enhance focus management
    this.setupFocusManagement();
  }

  /**
   * Add skip links for keyboard navigation
   */
  addSkipLinks() {
    const skipLinks = document.createElement('div');
    skipLinks.className = 'skip-links';
    skipLinks.innerHTML = `
      <a href="#main-content" class="skip-link">تخطي إلى المحتوى الرئيسي</a>
      <a href="#search" class="skip-link">تخطي إلى البحث</a>
      <a href="#days-list" class="skip-link">تخطي إلى قائمة الأيام</a>
    `;
    document.body.insertBefore(skipLinks, document.body.firstChild);
  }

  /**
   * Setup focus management
   */
  setupFocusManagement() {
    // Trap focus in modals
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
      this.state.addEventListener(modal, 'keydown', (e) => {
        if (e.key === 'Tab') {
          this.trapFocus(modal, e);
        }
      });
    });
  }

  /**
   * Trap focus within modal
   */
  trapFocus(modal, event) {
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus();
        event.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus();
        event.preventDefault();
      }
    }
  }

  /**
   * Announce to screen readers
   */
  announceToScreenReader(message) {
    const liveRegion = document.getElementById('aria-live');
    if (liveRegion) {
      liveRegion.textContent = message;
    }
  }

  /**
   * Setup control button event listeners
   */
  setupControlButtons() {
    console.log('🎯 Setting up control buttons...');
    
    // Define all button handlers
    const buttonHandlers = {
      'btn-import': () => this.handleImport(),
      'btn-export': () => this.handleExport(),
      'btn-export-filtered': () => this.exportFiltered(),
      'btn-add-image': () => this.handleAddImage(),
      'bulk-mark-learned': () => this.bulkMarkLearned(),
      'bulk-add-favorites': () => this.bulkAddToFavorites(),
      'clear-learned': () => this.clearLearnedWords(),
      'toggle-dark': () => this.toggleDarkMode(),
      'toggle-tts': () => this.toggleTTS(),
      'toggle-favorites': () => this.toggleFavorites(),
      'toggle-hide-translation': () => this.toggleHideTranslation(),
      'loadMore': () => this.loadMoreWords(),
      'settings-toggle': () => this.toggleSettingsPanel(),
      'close-settings': () => this.closeSettingsPanel(),
      'searchImage': () => this.searchForImage(),
      'saveImage': () => this.saveImage(),
      'cancelImage': () => this.closeImageModal(),
      'closeImageModal': () => this.closeImageModal()
    };

    // Attach event listeners to buttons
    Object.entries(buttonHandlers).forEach(([id, handler]) => {
      const element = document.getElementById(id);
      if (element) {
        // Remove any existing listeners by cloning
        const newElement = element.cloneNode(true);
        element.parentNode.replaceChild(newElement, element);
        
        // Create a new handler that prevents default behavior
        const clickHandler = (e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            handler();
          } catch (error) {
            console.error(`Error in ${id} handler:`, error);
            this.showToast('حدث خطأ في تنفيذ العملية', 'error');
          }
        };
        
        // Add new listener
        newElement.addEventListener('click', clickHandler);
        console.log(`✓ ${id}`);
      } else {
        console.warn(`❌ ${id}`);
      }
    });
    
    console.log('✅ Control buttons setup completed');
  }

  /**
   * Toggle settings panel
   */
  toggleSettingsPanel() {
    try {
      console.log('⚙️ Toggling settings panel...');
      const panel = document.getElementById('settings-panel');
      if (panel) {
        const isVisible = panel.classList.contains('show');
        if (isVisible) {
          panel.classList.remove('show');
          panel.setAttribute('aria-hidden', 'true');
          console.log('✓ Settings panel closed');
        } else {
          panel.classList.add('show');
          panel.setAttribute('aria-hidden', 'false');
          console.log('✓ Settings panel opened');
        }
      } else {
        console.error('❌ Settings panel not found');
      }
    } catch (error) {
      console.error('Error toggling settings panel:', error);
    }
  }

  /**
   * Close settings panel
   */
  closeSettingsPanel() {
    const panel = document.getElementById('settings-panel');
    if (panel) {
      panel.classList.remove('show');
      panel.setAttribute('aria-hidden', 'true');
    }
  }

  /**
   * Handle add image button
   */
  handleAddImage() {
    this.showToast('اضغط على أي كلمة لإضافة صورة لها', 'info');
  }

  /**
   * Validate and provide feedback for image URLs
   */
  validateImageUrl(url) {
    if (!url || typeof url !== 'string') {
      return { valid: false, message: 'يرجى إدخال رابط صورة' };
    }

    const trimmedUrl = url.trim();
    
    // Check for common image extensions
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
    const hasImageExtension = imageExtensions.some(ext => 
      trimmedUrl.toLowerCase().includes(ext)
    );

    // Check for common image hosting services
    const imageHosts = [
      'imgur.com', 'flickr.com', 'unsplash.com', 'pixabay.com',
      'pexels.com', 'google.com/images', 'bing.com/images',
      'duckduckgo.com', 'images.google.com'
    ];
    const hasImageHost = imageHosts.some(host => 
      trimmedUrl.toLowerCase().includes(host)
    );

    if (!hasImageExtension && !hasImageHost) {
      return { 
        valid: false, 
        message: 'الرابط لا يبدو كرابط صورة. تأكد من أن الرابط يحتوي على صورة.' 
      };
    }

    // Check URL format
    try {
      new URL(trimmedUrl);
      return { valid: true, message: 'الرابط يبدو صحيحاً' };
    } catch (error) {
      return { valid: false, message: 'رابط غير صالح' };
    }
  }

  /**
   * Setup modal event listeners
   */
  setupModalEvents() {
    console.log('Setting up modal events...');
    const modal = document.getElementById('imageModal');
    if (!modal) {
      console.warn('❌ Image modal not found');
      return;
    }

    // Close modal events - using the same approach as control buttons
    const modalButtons = {
      'closeImageModal': () => this.closeImageModal(),
      'cancelImage': () => this.closeImageModal(),
      'saveImage': () => this.saveImage(),
      'searchImage': () => this.searchForImage(),
      'pasteUrl': () => this.pasteImageUrl()
    };

    Object.entries(modalButtons).forEach(([id, handler]) => {
      const element = document.getElementById(id);
      if (element) {
        // Remove existing listeners by cloning
        const newElement = element.cloneNode(true);
        element.parentNode.replaceChild(newElement, element);
        
        newElement.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            handler();
          } catch (error) {
            console.error(`Error in ${id}:`, error);
          }
        });
        console.log(`✓ ${id}`);
      } else {
        console.warn(`❌ ${id}`);
      }
    });

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeImageModal();
      }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('show')) {
        this.closeImageModal();
      }
    });

    console.log('✓ Modal events setup completed');
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Only handle shortcuts when not in input fields
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case 'd':
        case 'D':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.toggleDarkMode();
          }
          break;
        case 'f':
        case 'F':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            document.getElementById('search')?.focus();
          }
          break;
        case 'Escape':
          this.closeImageModal();
          break;
      }
    });
  }

  /**
   * Handle search input
   */
  handleSearch() {
    const searchInput = document.getElementById('search');
    if (!searchInput) return;

    const query = searchInput.value.trim().toLowerCase();
    
    if (!query) {
      this.state.updateFiltered();
    } else {
      const filtered = this.state.allWords.filter(word => 
        (word.german || '').toLowerCase().includes(query) || 
        (word.arabic || '').toLowerCase().includes(query) || 
        (word.type || '').toLowerCase().includes(query)
      );
      
      this.state.filtered = filtered;
    }

    this.state.currentDay = 0;
    this.state.renderedCount = 0;
    this.render();
  }

  /**
   * Handle filter tab clicks
   */
  handleFilterClick(e) {
    try {
      const tab = e.target.closest('.filter-tab');
      if (!tab) return;
      
      const filter = tab.dataset.filter;
      if (!filter) return;

      console.log(`🔍 Filter clicked: ${filter}`);

      // Update active tab
      document.querySelectorAll('.filter-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      // Update state
      this.state.activeFilter = filter;
      this.state.updateFiltered();
      this.state.currentDay = 0;
      this.state.renderedCount = 0;
      
      this.render();
      this.showToast(`تم تطبيق فلتر: ${this.getFilterName(filter)}`, 'info');
    } catch (error) {
      console.error('Error in handleFilterClick:', error);
    }
  }
  
  /**
   * Get filter display name
   */
  getFilterName(filter) {
    const names = {
      'all': 'جميع الكلمات',
      'nomen': 'الأسماء',
      'verb': 'الأفعال', 
      'adjektiv': 'الصفات',
      'redewendung': 'التعبيرات',
      'favorites': 'المفضلة'
    };
    return names[filter] || filter;
  }

  /**
   * Handle import button click
   */
  handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Show loading state
      this.state.isLoading = true;
      this.showToast('جاري الاستيراد...', 'info');
      this.updateLoadingState();

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = Utils.safeJsonParse(ev.target.result);
          
          // Validate import data
          const validation = Utils.validateImportData(data);
          
          if (!validation.valid) {
            throw new Error(validation.error || 'ملف غير صالح');
          }

          // Show validation results
          if (validation.invalidWords > 0) {
            this.showToast(`تم العثور على ${validation.invalidWords} كلمة غير صالحة`, 'warning');
          }

          // Process words in chunks to avoid blocking UI
          this.processImportWords(validation.words, validation);
        } catch (error) {
          const errorInfo = Utils.handleError(error, 'Import operation');
          this.state.isLoading = false;
          this.updateLoadingState();
          this.showToast('خطأ في الاستيراد: ' + (error.message || error), 'error');
        }
      };
      
      reader.readAsText(file, 'utf-8');
    };
    
    input.click();
  }

  /**
   * Process imported words in chunks with enhanced validation
   */
  async processImportWords(words, validation = null) {
    const CHUNK_SIZE = 100;
    let processed = 0;
    let validWords = 0;
    const newWords = [];
    
    for (let i = 0; i < words.length; i += CHUNK_SIZE) {
      const chunk = words.slice(i, i + CHUNK_SIZE);
      
      chunk.forEach(word => {
        const normalized = this.normalizeWord(word);
        newWords.push(normalized);
        validWords++;
        processed++;
      });
      
      // Update progress
      const progress = Math.round((processed / words.length) * 100);
      this.showToast(`جاري الاستيراد... ${progress}%`, 'info');
      
      // Allow UI to update
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    this.state.allWords = newWords;
    this.state.updateFiltered();
    this.saveState();
    this.updateStats();
    this.render();
    
    this.state.isLoading = false;
    this.updateLoadingState();
    
    // Show detailed results
    let message = `تم الاستيراد بنجاح ✓ - ${validWords} كلمة`;
    if (validation && validation.invalidWords > 0) {
      message += ` (${validation.invalidWords} غير صالحة تم تجاهلها)`;
    }
    
    this.showToast(message, 'success');
  }

  /**
   * Update loading state
   */
  updateLoadingState() {
    const app = document.getElementById('app');
    if (this.state.isLoading) {
      app.classList.add('loading');
    } else {
      app.classList.remove('loading');
    }
  }

  /**
   * Bulk mark words as learned
   */
  bulkMarkLearned() {
    const currentDayWords = this.getDays()[this.state.currentDay] || [];
    const unlearnedWords = currentDayWords.filter(w => !w.isLearned);
    
    if (unlearnedWords.length === 0) {
      this.showToast('جميع كلمات اليوم تم تعلمها بالفعل', 'info');
      return;
    }
    
    if (confirm(`هل تريد تعليم جميع كلمات اليوم (${unlearnedWords.length} كلمة)؟`)) {
      unlearnedWords.forEach(word => {
        word.isLearned = true;
      });
      
      this.saveState();
      this.updateStats();
      this.renderCurrentDay();
      this.renderDaysList();
      this.showToast(`تم تعليم ${unlearnedWords.length} كلمة`, 'success');
    }
  }

  /**
   * Bulk add to favorites
   */
  bulkAddToFavorites() {
    try {
      const currentDayWords = this.getDays()[this.state.currentDay] || [];
      const nonFavoriteWords = currentDayWords.filter(w => !w.isFavorite);
      
      if (nonFavoriteWords.length === 0) {
        this.showToast('جميع كلمات اليوم في المفضلة بالفعل', 'info');
        return;
      }
      
      if (confirm(`هل تريد إضافة جميع كلمات اليوم إلى المفضلة (${nonFavoriteWords.length} كلمة)؟`)) {
        nonFavoriteWords.forEach(word => {
          word.isFavorite = true;
        });
        
        this.saveState();
        this.updateStats();
        this.renderCurrentDay();
        this.showToast(`تم إضافة ${nonFavoriteWords.length} كلمة إلى المفضلة`, 'success');
      }
    } catch (error) {
      console.error('Error in bulkAddToFavorites:', error);
      this.showToast('حدث خطأ في إضافة الكلمات للمفضلة', 'error');
    }
  }

  /**
   * Clear all learned words
   */
  clearLearnedWords() {
    const learnedCount = this.state.allWords.filter(w => w.isLearned).length;
    
    if (learnedCount === 0) {
      this.showToast('لا توجد كلمات تم تعلمها', 'info');
      return;
    }
    
    if (confirm(`هل تريد إعادة تعيين جميع الكلمات المتعلمة (${learnedCount} كلمة)؟`)) {
      this.state.allWords.forEach(word => {
        word.isLearned = false;
      });
      
      this.saveState();
      this.updateStats();
      this.render();
      this.showToast(`تم إعادة تعيين ${learnedCount} كلمة`, 'success');
    }
  }

  /**
   * Export filtered words only
   */
  exportFiltered() {
    try {
      const data = JSON.stringify({ words: this.state.filtered }, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `german_words_filtered_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast(`تم تصدير ${this.state.filtered.length} كلمة ✓`, 'success');
        } catch (error) {
      console.error('Export error:', error);
      this.showToast('خطأ في التصدير', 'error');
    }
  }

  /**
   * Get statistics for current filter
   */
  getFilterStats() {
    const total = this.state.filtered.length;
    const learned = this.state.filtered.filter(w => w.isLearned).length;
    const favorites = this.state.filtered.filter(w => w.isFavorite).length;
    const withImages = this.state.filtered.filter(w => w.image_url).length;
    
    return { total, learned, favorites, withImages };
  }

  /**
   * Handle export button click
   */
  handleExport() {
    try {
      const data = JSON.stringify({ words: this.state.allWords }, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'german_words_export.json';
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('تم التصدير بنجاح ✓', 'success');
    } catch (error) {
      console.error('Export error:', error);
      this.showToast('خطأ في التصدير', 'error');
    }
  }

  /**
   * Handle add image button click
   */
  handleAddImage() {
    const days = this.getDays();
    if (days.length > 0 && days[this.state.currentDay].length > 0) {
      this.openImageModal(days[this.state.currentDay][0]);
    } else {
      this.showToast('لا توجد كلمات لإضافة الصور', 'warning');
    }
  }

  /**
   * Toggle dark mode
   */
  toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    Utils.safeStorage.setItem('appDark', isDark ? '1' : '0');
    this.showToast(isDark ? 'تم تفعيل الوضع المظلم' : 'تم إيقاف الوضع المظلم', 'info');
  }

  /**
   * Toggle TTS mode
   */
  toggleTTS() {
    CONFIG.USE_EXTERNAL_TTS = !CONFIG.USE_EXTERNAL_TTS;
    const button = document.getElementById('toggle-tts');
    if (button) {
      button.textContent = '🔊 TTS: ' + (CONFIG.USE_EXTERNAL_TTS ? 'خارجي' : 'مستعرض');
    }
    this.showToast('تم تغيير وضع النطق', 'info');
  }

  /**
   * Toggle favorites filter
   */
  toggleFavorites() {
    try {
      this.state.showFavoritesOnly = !this.state.showFavoritesOnly;
      this.updateFavoritesButton();
      this.state.updateFiltered();
      this.state.currentDay = 0;
      this.state.renderedCount = 0;
      this.render();
      this.saveSettings();
      
      const message = this.state.showFavoritesOnly ? 'عرض المفضلة فقط' : 'عرض جميع الكلمات';
      this.showToast(message, 'info');
    } catch (error) {
      console.error('Error in toggleFavorites:', error);
    }
  }

  /**
   * Toggle hide translation
   */
  toggleHideTranslation() {
    this.state.hideTranslation = !this.state.hideTranslation;
    this.updateHideTranslationButton();
    
    // Update all existing cards
    document.querySelectorAll('.arabic').forEach(el => {
      el.classList.toggle('hidden', this.state.hideTranslation);
    });
    
    // Update all hide translation buttons in cards
    document.querySelectorAll('.hide-translation-btn').forEach(btn => {
      btn.classList.toggle('active', this.state.hideTranslation);
      btn.innerHTML = this.state.hideTranslation ? '👁️‍🗨️' : '👁️';
      btn.title = this.state.hideTranslation ? 'إظهار الترجمة' : 'إخفاء الترجمة';
    });
    
    this.saveSettings();
  }

  /**
   * Update favorites button text
   */
  updateFavoritesButton() {
    const button = document.getElementById('toggle-favorites');
    if (button) {
      const icon = button.querySelector('.btn-icon');
      const text = button.querySelector('.btn-text');
      
      if (icon && text) {
        text.textContent = this.state.showFavoritesOnly ? 'الكل' : 'المفضلة فقط';
      } else {
        button.innerHTML = `
          <span class="btn-icon">⭐</span>
          <span class="btn-text">${this.state.showFavoritesOnly ? 'الكل' : 'المفضلة فقط'}</span>
        `;
      }
    }
  }

  /**
   * Update hide translation button text
   */
  updateHideTranslationButton() {
    const button = document.getElementById('toggle-hide-translation');
    if (button) {
      const icon = button.querySelector('.btn-icon');
      const text = button.querySelector('.btn-text');
      
      if (icon && text) {
        text.textContent = this.state.hideTranslation ? 'إظهار الترجمة' : 'إخفاء الترجمة';
      } else {
        button.innerHTML = `
          <span class="btn-icon">👁️</span>
          <span class="btn-text">${this.state.hideTranslation ? 'إظهار الترجمة' : 'إخفاء الترجمة'}</span>
        `;
      }
    }
  }

  /**
   * Load more words for current day
   */
  loadMoreWords() {
    this.renderCurrentDay();
  }

  /**
   * Get days array from filtered words
   */
  getDays() {
    const days = [];
    for (let i = 0; i < this.state.filtered.length; i += this.state.perDay) {
      days.push(this.state.filtered.slice(i, i + this.state.perDay));
    }
    return days;
  }

  /**
   * Render the entire application
   */
  render() {
    this.updateStats();
    this.renderDaysList();
    this.renderCurrentDay(true);
  }

  /**
   * Update statistics
   */
  updateStats() {
    const total = this.state.allWords.length;
    const learned = this.state.allWords.filter(w => w.isLearned).length;
    const images = this.state.allWords.filter(w => w.image_url).length;
    const favorites = this.state.allWords.filter(w => w.isFavorite).length;
    
    this.updateElement('totalWords', total);
    this.updateElement('learnedCount', learned);
    this.updateElement('remainingCount', total - learned);
    this.updateElement('imagesCount', images);
    this.updateElement('favoritesCount', favorites);
    
    const percentage = total ? Math.round(learned / total * 100) : 0;
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
      progressBar.style.width = percentage + '%';
      progressBar.textContent = percentage + '%';
      progressBar.setAttribute('aria-valuenow', percentage);
    }
  }

  /**
   * Update element text content safely
   */
  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  /**
   * Render days list in sidebar
   */
  renderDaysList() {
    const daysListEl = document.getElementById('days-list');
    if (!daysListEl) return;

    daysListEl.innerHTML = '';
    const days = this.getDays();
    
    days.forEach((dayWords, index) => {
      const item = document.createElement('div');
      item.className = 'day-item fade-in' + (index === this.state.currentDay ? ' active' : '');
      item.setAttribute('data-day-index', index);
      item.setAttribute('role', 'tab');
      item.setAttribute('aria-selected', index === this.state.currentDay);
      
      item.innerHTML = `
        <div style="text-align:right">اليوم ${index + 1}</div>
        <small>${dayWords.length} كلمة</small>
      `;
      
      if (dayWords.every(w => w.isLearned)) {
        item.classList.add('completed');
      }
      
      item.addEventListener('click', () => {
        this.state.currentDay = index;
        this.state.renderedCount = 0;
        document.querySelectorAll('.day-item').forEach(d => d.classList.remove('active'));
        item.classList.add('active');
        this.renderCurrentDay(true);
      });
      
      daysListEl.appendChild(item);
    });
    
    if (days.length === 0) {
      daysListEl.innerHTML = `
        <div class="empty" style="padding:8px">
          لا توجد كلمات. استورد ملف JSON أو أضف كلمات.
        </div>
      `;
    }
  }

  /**
   * Render current day words with virtual scrolling
   */
  renderCurrentDay(reset = false) {
    const wordCardsEl = document.getElementById('wordCards');
    const loadMoreBtn = document.getElementById('loadMore');
    const emptyEl = document.getElementById('empty');
    
    if (!wordCardsEl) return;

    if (reset) {
      wordCardsEl.innerHTML = '';
      this.state.renderedCount = 0;
    }
    
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'none';
    
    const days = this.getDays();
    if (days.length === 0) {
      if (emptyEl) emptyEl.style.display = 'block';
      this.updateElement('dayTitle', '');
      return;
    }
    
    const dayWords = days[this.state.currentDay] || [];
    this.updateElement('dayTitle', `اليوم ${this.state.currentDay + 1} — ${dayWords.length} كلمة`);
    
    // Use virtual scrolling for large lists
    if (dayWords.length > CONFIG.MAX_RENDER_WORDS) {
      this.renderVirtualScrolling(dayWords, wordCardsEl, loadMoreBtn);
    } else {
    this.renderWordChunk(dayWords, wordCardsEl, loadMoreBtn);
    }
  }

  /**
   * Render with virtual scrolling for performance
   */
  renderVirtualScrolling(dayWords, container, loadMoreBtn) {
    const start = this.state.renderedCount;
    const end = Math.min(start + CONFIG.CHUNK_SIZE, dayWords.length);
    
    // Use requestIdleCallback for better performance
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        this.renderWordChunk(dayWords, container, loadMoreBtn);
      });
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => {
        this.renderWordChunk(dayWords, container, loadMoreBtn);
      }, 0);
    }
  }

  /**
   * Render a chunk of words
   */
  renderWordChunk(dayWords, container, loadMoreBtn) {
    if (this.state.renderedCount >= dayWords.length) {
      if (loadMoreBtn) loadMoreBtn.style.display = 'none';
      return;
    }
    
    const start = this.state.renderedCount;
    const end = Math.min(start + CONFIG.CHUNK_SIZE, dayWords.length);
    
    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    
    for (let i = start; i < end; i++) {
      const word = dayWords[i];
      const card = this.createWordCard(word);
      fragment.appendChild(card);
    }
    
    container.appendChild(fragment);
    this.state.renderedCount = end;
    
    if (loadMoreBtn) {
      loadMoreBtn.style.display = (this.state.renderedCount < dayWords.length) ? 'block' : 'none';
    }
  }

  /**
   * Create a word card element with modern design
   */
  createWordCard(word) {
    const card = document.createElement('article');
    card.className = 'word-card fade-in';
    card.setAttribute('data-type', word.type);
    card.setAttribute('data-learned', word.isLearned ? 'true' : 'false');
    card.setAttribute('data-favorite', word.isFavorite ? 'true' : 'false');
    card.setAttribute('role', 'gridcell');

    // Card header with German word and action buttons
    const header = document.createElement('div');
    header.className = 'card-header';
    
    const german = document.createElement('h3');
    german.className = 'german-word';
    german.textContent = word.german || '—';
    
    const actionButtons = document.createElement('div');
    actionButtons.className = 'card-action-buttons';
    
    // Sound button
    const soundBtn = document.createElement('button');
    soundBtn.className = 'action-btn sound-btn';
    soundBtn.title = 'استمع للنطق';
    soundBtn.innerHTML = '🔊';
    soundBtn.setAttribute('aria-label', `استمع لنطق ${word.german}`);
    soundBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.playWordAudio(word.german);
    });
    
    // Google Images search button
    const googleImagesBtn = document.createElement('button');
    googleImagesBtn.className = 'action-btn google-images-btn';
    googleImagesBtn.title = 'بحث في Google Images';
    googleImagesBtn.innerHTML = '🖼️';
    googleImagesBtn.setAttribute('aria-label', `بحث عن صورة للكلمة ${word.german} في Google`);
    googleImagesBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.searchImageOnGoogle(word.german);
    });
    
    actionButtons.appendChild(soundBtn);
    actionButtons.appendChild(googleImagesBtn);
    
    header.appendChild(german);
    header.appendChild(actionButtons);

    // Arabic translation
    const arabic = document.createElement('p');
    arabic.className = 'arabic-translation' + (this.state.hideTranslation ? ' hidden' : '');
    arabic.textContent = word.arabic || '';

    const imageContainer = this.createImageContainer(word);
    const controls = this.createCardControls(word, card, arabic);

    card.appendChild(header);
    card.appendChild(arabic);
    card.appendChild(imageContainer);
    card.appendChild(controls);

    return card;
  }

  /**
   * Open Google Images search for the given word
   */
  searchImageOnGoogle(germanWord) {
    if (!germanWord) return;
    
    // Clean the word for search
    const searchTerm = germanWord.replace(/^(der|die|das)\s+/i, '').trim();
    const encodedTerm = encodeURIComponent(searchTerm);
    const googleImagesUrl = `https://www.google.com/search?tbm=isch&q=${encodedTerm}+german`;
    
    window.open(googleImagesUrl, '_blank', 'noopener,noreferrer');
    this.showToast('تم فتح صفحة البحث عن الصور في نافذة جديدة', 'info');
  }

  /**
   * Create image container for word card
   */
  createImageContainer(word) {
    const imgWrap = document.createElement('div');
    imgWrap.className = 'card-image';
    
    if (word.image_url) {
      const imageUrl = Utils.sanitizeImageUrl(word.image_url);
      
      if (imageUrl) {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = word.german;
        img.loading = 'lazy';
        
        // Error handling - must be set BEFORE appending
        img.addEventListener('error', () => {
          console.warn('Failed to load image:', imageUrl);
          
          // Clear and rebuild
          imgWrap.innerHTML = '';
          
          const placeholder = document.createElement('div');
          placeholder.className = 'image-placeholder';
          placeholder.innerHTML = '<div style="color: #dc3545; font-size: 0.8rem; margin-bottom: 8px;">تعذر تحميل الصورة</div>';
          
          const btnContainer = document.createElement('div');
          btnContainer.style.cssText = 'display: flex; gap: 8px; justify-content: center;';
          
          const retryBtn = document.createElement('button');
          retryBtn.className = 'btn btn-outline btn-sm';
          retryBtn.textContent = 'إعادة المحاولة';
          retryBtn.onclick = (e) => {
            e.stopPropagation();
            this.openImageModal(word);
          };
          
          const removeBtn = document.createElement('button');
          removeBtn.className = 'btn btn-danger btn-sm';
          removeBtn.textContent = 'حذف';
          removeBtn.onclick = (e) => {
            e.stopPropagation();
            this.removeImage(word);
          };
          
          btnContainer.appendChild(retryBtn);
          btnContainer.appendChild(removeBtn);
          placeholder.appendChild(btnContainer);
          imgWrap.appendChild(placeholder);
        });
        
        imgWrap.appendChild(img);
        
        // Add image action buttons
        const imageActions = this.createImageActions(word);
        imgWrap.appendChild(imageActions);
      } else {
        imgWrap.innerHTML = '<div class="image-placeholder">رابط صورة غير صالح</div>';
        const addBtn = document.createElement('button');
        addBtn.className = 'btn btn-outline btn-sm';
        addBtn.textContent = 'إضافة رابط جديد';
        addBtn.style.marginTop = '8px';
        addBtn.onclick = (e) => {
          e.stopPropagation();
          this.openImageModal(word);
        };
        imgWrap.appendChild(addBtn);
      }
    } else {
      const addImageBtn = document.createElement('button');
      addImageBtn.className = 'btn btn-ghost btn-sm';
      addImageBtn.innerHTML = '➕ إضافة صورة';
      addImageBtn.title = 'إضافة صورة';
      addImageBtn.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);';
      addImageBtn.onclick = (e) => {
        e.stopPropagation();
        this.openImageModal(word);
      };
      
      imgWrap.innerHTML = '<div class="image-placeholder">لا توجد صورة</div>';
      imgWrap.appendChild(addImageBtn);
    }
    
    return imgWrap;
  }

  /**
   * Create image action buttons
   */
  createImageActions(word) {
    const imageActions = document.createElement('div');
    imageActions.className = 'image-actions';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'image-action-btn';
    editBtn.innerHTML = '✏️';
    editBtn.title = 'تعديل الصورة';
    editBtn.setAttribute('aria-label', 'تعديل صورة الكلمة');
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openImageModal(word);
    });
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'image-action-btn';
    removeBtn.innerHTML = '🗑️';
    removeBtn.title = 'حذف الصورة';
    removeBtn.setAttribute('aria-label', 'حذف صورة الكلمة');
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeImage(word);
    });
    
    imageActions.appendChild(editBtn);
    imageActions.appendChild(removeBtn);
    
    return imageActions;
  }

  /**
   * Create card control buttons
   */
  createCardControls(word, card, arabicElement) {
    const controls = document.createElement('div');
    controls.className = 'card-controls';
    
    const leftGroup = document.createElement('div');
    leftGroup.className = 'control-group';
    
    // Favorite button
    const favoriteBtn = this.createFavoriteButton(word, card);
    
    // Hide translation button
    const hideTranslationBtn = this.createHideTranslationButton(arabicElement);
    
    // Learn button
    const learnBtn = this.createLearnButton(word, card);
    
    leftGroup.appendChild(favoriteBtn);
    leftGroup.appendChild(hideTranslationBtn);
    leftGroup.appendChild(learnBtn);
    
    const rightGroup = document.createElement('div');
    rightGroup.className = 'control-group';
    rightGroup.appendChild(this.createBadge(word.type));
    
    controls.appendChild(leftGroup);
    controls.appendChild(rightGroup);
    
    return controls;
  }

  /**
   * Create favorite button
   */
  createFavoriteButton(word, card) {
    const favoriteBtn = document.createElement('button');
    favoriteBtn.className = 'control-btn' + (word.isFavorite ? ' active' : '');
    favoriteBtn.innerHTML = word.isFavorite ? '★' : '☆';
    favoriteBtn.title = word.isFavorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة';
    favoriteBtn.setAttribute('aria-label', word.isFavorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة');
    
    favoriteBtn.addEventListener('click', () => {
      word.isFavorite = !word.isFavorite;
      this.saveState();
      this.updateStats();
      card.setAttribute('data-favorite', word.isFavorite ? 'true' : 'false');
      favoriteBtn.className = 'control-btn' + (word.isFavorite ? ' active' : '');
      favoriteBtn.innerHTML = word.isFavorite ? '★' : '☆';
      favoriteBtn.title = word.isFavorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة';
      favoriteBtn.setAttribute('aria-label', word.isFavorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة');
      this.showToast(word.isFavorite ? 'تمت الإضافة إلى المفضلة' : 'تمت الإزالة من المفضلة', 'success');
    });
    
    return favoriteBtn;
  }

  /**
   * Create hide translation button
   */
  createHideTranslationButton(arabicElement) {
    const hideTranslationBtn = document.createElement('button');
    hideTranslationBtn.className = 'control-btn' + (this.state.hideTranslation ? ' active' : '');
    hideTranslationBtn.innerHTML = this.state.hideTranslation ? '👁️‍🗨️' : '👁️';
    hideTranslationBtn.title = this.state.hideTranslation ? 'إظهار الترجمة' : 'إخفاء الترجمة';
    hideTranslationBtn.setAttribute('aria-label', this.state.hideTranslation ? 'إظهار الترجمة' : 'إخفاء الترجمة');
    
    hideTranslationBtn.addEventListener('click', () => {
      this.state.hideTranslation = !this.state.hideTranslation;
      arabicElement.classList.toggle('hidden', this.state.hideTranslation);
      hideTranslationBtn.className = 'control-btn' + (this.state.hideTranslation ? ' active' : '');
      hideTranslationBtn.innerHTML = this.state.hideTranslation ? '👁️‍🗨️' : '👁️';
      hideTranslationBtn.title = this.state.hideTranslation ? 'إظهار الترجمة' : 'إخفاء الترجمة';
      hideTranslationBtn.setAttribute('aria-label', this.state.hideTranslation ? 'إظهار الترجمة' : 'إخفاء الترجمة');
      this.updateHideTranslationButton();
      this.saveSettings();
    });
    
    return hideTranslationBtn;
  }

  /**
   * Create learn button
   */
  createLearnButton(word, card) {
    const learnBtn = document.createElement('button');
    learnBtn.className = 'learn-btn ' + (word.isLearned ? 'yes' : 'not');
    learnBtn.textContent = word.isLearned ? 'تم التعلم' : 'تعلمت';
    learnBtn.setAttribute('aria-label', word.isLearned ? 'تم تعلم هذه الكلمة' : 'تعلم هذه الكلمة');
    
    learnBtn.addEventListener('click', () => {
      word.isLearned = !word.isLearned;
      this.saveState();
      this.updateStats();
      card.setAttribute('data-learned', word.isLearned ? 'true' : 'false');
      learnBtn.className = 'learn-btn ' + (word.isLearned ? 'yes' : 'not');
      learnBtn.textContent = word.isLearned ? 'تم التعلم' : 'تعلمت';
      learnBtn.setAttribute('aria-label', word.isLearned ? 'تم تعلم هذه الكلمة' : 'تعلم هذه الكلمة');
      this.renderDaysList();
    });
    
    return learnBtn;
  }

  /**
   * Create type badge
   */
  createBadge(type) {
    const badge = document.createElement('div');
    badge.className = 'type-badge';
    badge.setAttribute('data-type', type);
    badge.textContent = Utils.prettifyType(type);
    return badge;
  }

  /**
   * Open image modal
   */
  openImageModal(word) {
    this.state.currentEditingWord = word;
    const modal = document.getElementById('imageModal');
    const title = document.getElementById('imageModalTitle');
    const urlInput = document.getElementById('imageUrl');
    const searchInput = document.getElementById('imageSearch');
    
    if (!modal || !title || !urlInput || !searchInput) return;
    
    title.textContent = `إضافة صورة للكلمة: ${word.german}`;
    urlInput.value = word.image_url || '';
    searchInput.value = word.german;
    
    // Add real-time preview
    urlInput.addEventListener('input', (e) => {
      const url = e.target.value.trim();
      if (url) {
        this.showImagePreview(url);
      } else {
        this.hideImagePreview();
      }
    });
    
    if (word.image_url) {
      this.showImagePreview(word.image_url);
    } else {
      this.hideImagePreview();
    }
    
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    urlInput.focus();
  }

  /**
   * Close image modal
   */
  closeImageModal() {
    const modal = document.getElementById('imageModal');
    if (modal) {
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
    }
    this.state.currentEditingWord = null;
    this.hideImagePreview();
  }

  /**
   * Show image preview with validation
   */
  showImagePreview(url) {
    const preview = document.getElementById('imagePreview');
    const img = document.getElementById('previewImg');
    
    if (!preview || !img) return;
    
    const imageUrl = Utils.sanitizeImageUrl(url);
    
    if (!imageUrl) {
      preview.innerHTML = '<div class="image-placeholder" style="color: var(--danger);">رابط صورة غير صالح</div>';
      preview.style.display = 'block';
      return;
    }
    
    // Show loading state
    preview.innerHTML = '<div class="image-placeholder">جاري تحميل المعاينة...</div>';
    preview.style.display = 'block';
    
    // Create new image for testing
    const testImg = new Image();
    testImg.onload = () => {
      img.src = imageUrl;
      img.onerror = () => {
        preview.innerHTML = '<div class="image-placeholder" style="color: var(--danger);">تعذر تحميل الصورة للمعاينة</div>';
      };
    };
    
    testImg.onerror = () => {
      preview.innerHTML = '<div class="image-placeholder" style="color: var(--danger);">لا يمكن الوصول إلى الصورة</div>';
    };
    
    testImg.src = imageUrl;
  }

  /**
   * Hide image preview
   */
  hideImagePreview() {
    const preview = document.getElementById('imagePreview');
    if (preview) {
      preview.style.display = 'none';
    }
  }

  /**
   * Save image with validation
   */
  async saveImage() {
    if (!this.state.currentEditingWord) return;
    
    const urlInput = document.getElementById('imageUrl');
    if (!urlInput) return;
    
    const imageUrl = urlInput.value.trim();
    
    if (!imageUrl) {
      this.showToast('يرجى إدخال رابط صورة', 'warning');
      return;
    }
    
    // Sanitize URL (extract from DuckDuckGo if needed)
    const sanitizedUrl = Utils.sanitizeImageUrl(imageUrl);
    if (!sanitizedUrl) {
      this.showToast('رابط الصورة غير صالح', 'error');
      return;
    }
    
    console.log('Saving image URL:', sanitizedUrl);
    
    // Save directly without extensive validation
    this.state.currentEditingWord.image_url = sanitizedUrl;
    this.saveState();
    this.updateStats();
    this.render(); // Re-render everything to show the image
    this.showToast('تم حفظ الصورة بنجاح ✓', 'success');
    this.closeImageModal();
  }

  /**
   * Remove image
   */
  removeImage(word) {
    word.image_url = '';
    this.saveState();
    this.updateStats();
    this.render();
    this.showToast('تم حذف الصورة بنجاح', 'success');
  }

  /**
   * Paste image URL from clipboard
   */
  async pasteImageUrl() {
    try {
      const text = await navigator.clipboard.readText();
      const urlInput = document.getElementById('imageUrl');
      if (urlInput && text) {
        urlInput.value = text;
        this.showImagePreview(text);
        this.showToast('تم لصق الرابط', 'success');
      }
    } catch (error) {
      console.error('Failed to read clipboard:', error);
      this.showToast('فشل اللصق. استخدم Ctrl+V', 'error');
    }
  }

  /**
   * Search for image
   */
  searchForImage() {
    const searchInput = document.getElementById('imageSearch');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.trim();
    
    if (!searchTerm) {
      this.showToast('يرجى إدخال مصطلح للبحث', 'warning');
      return;
    }
    
    const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(searchTerm)}&t=brave&iar=images&iax=images&ia=images`;
    window.open(searchUrl, '_blank');
    this.showToast('تم فتح صفحة البحث عن الصور في نافذة جديدة', 'info');
  }

  /**
   * Play word audio
   */
  async playWordAudio(text) {
    if (!text) return;
    
    try {
      if (CONFIG.USE_EXTERNAL_TTS) {
        const chunks = this.splitTextChunks(text, 120);
        for (const chunk of chunks) {
          await this.playExternalTTSChunk(chunk);
        }
      } else {
        await this.speakBrowser(text);
      }
    } catch (error) {
      console.error('Audio playback error:', error);
      this.showToast('خطأ في تشغيل الصوت', 'error');
    }
  }

  /**
   * Split text into chunks for TTS
   */
  splitTextChunks(text, maxLen = 120) {
    if (text.length <= maxLen) return [text];
    
    const words = text.split(' ');
    const parts = [];
    let current = '';
    
    for (const word of words) {
      if ((current + ' ' + word).trim().length > maxLen) {
        if (current) parts.push(current.trim());
        current = word;
      } else {
        current = (current + ' ' + word).trim();
      }
    }
    
    if (current) parts.push(current.trim());
    return parts;
  }

  /**
   * Play external TTS chunk with retry and cache management
   */
  async playExternalTTSChunk(chunk) {
      const url = `https://api.streamelements.com/kappa/v2/speech?voice=Vicki&text=${encodeURIComponent(chunk)}`;
      
    // Check cache first
    const cachedAudio = this.state.cacheManager.getAudio(url);
    if (cachedAudio) {
      return this.playAudioWithErrorHandling(cachedAudio);
    }
    
    // Try to load with retry mechanism
    try {
      const audio = await Utils.retry(async () => {
        if (!this.state.isOnline) {
          throw new Error('Offline - cannot load audio');
        }
        
        const audio = new Audio(url);
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Audio load timeout')), 10000);
          
          audio.oncanplaythrough = () => {
            clearTimeout(timeout);
            resolve(audio);
          };
          
          audio.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Audio load failed'));
          };
          
          audio.load();
        });
      });
      
      // Cache the audio
      this.state.cacheManager.addAudio(url, audio);
      
      return this.playAudioWithErrorHandling(audio);
    } catch (error) {
      console.warn('TTS failed, falling back to browser speech:', error);
      return this.speakBrowser(chunk);
    }
  }

  /**
   * Play audio with error handling
   */
  playAudioWithErrorHandling(audio) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.warn('Audio playback timeout');
        resolve();
      }, 15000);
      
      audio.onended = () => {
        clearTimeout(timeout);
        resolve();
      };
      
      audio.onerror = () => {
        clearTimeout(timeout);
        console.warn('Audio playback error');
        resolve();
      };
      
      audio.play().catch((e) => {
        clearTimeout(timeout);
        console.warn('Audio play failed:', e);
        resolve();
      });
    });
  }

  /**
   * Browser speech synthesis
   */
  speakBrowser(text) {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        resolve();
        return;
      }
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'de-DE';
      
      const voices = speechSynthesis.getVoices();
      if (voices && voices.length) {
        const germanVoice = voices.find(v => /de/i.test(v.lang) || /de/i.test(v.name));
        if (germanVoice) utterance.voice = germanVoice;
      }
      
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    });
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info') {
    try {
      const toast = document.getElementById('toast');
      if (!toast) {
        console.warn('Toast element not found');
        return;
      }
      
      // Clear any existing timeout
      if (this.toastTimeout) {
        clearTimeout(this.toastTimeout);
      }
      
      toast.textContent = message;
      toast.className = `toast ${type} show`;
      
      this.toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
      }, CONFIG.TOAST_DURATION);
      
      console.log(`📢 Toast: ${message} (${type})`);
    } catch (error) {
      console.error('Error showing toast:', error);
    }
  }

  /**
   * Save state to localStorage
   */
  saveState() {
    Utils.safeStorage.setItem(CONFIG.STORAGE_KEYS.WORDS, JSON.stringify(this.state.allWords));
  }

  /**
   * Save settings to localStorage
   */
  saveSettings() {
    const settings = {
      hideTranslation: this.state.hideTranslation,
      showFavoritesOnly: this.state.showFavoritesOnly
    };
    Utils.safeStorage.setItem(CONFIG.STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }

  /**
   * Cleanup resources and event listeners
   */
  cleanup() {
    try {
      // Cleanup state
      this.state.cleanup();
      
      // Cleanup observers
      if (this.imageObserver) {
        this.imageObserver.disconnect();
        this.imageObserver = null;
      }
      
      if (this.performanceObserver) {
        this.performanceObserver.disconnect();
        this.performanceObserver = null;
      }
      
      // Cleanup offline handlers
      if (this.offlineHandler) {
        window.removeEventListener('online', this.offlineHandler);
        window.removeEventListener('offline', this.offlineHandler);
        this.offlineHandler = null;
      }
      
      console.log('Application cleanup completed');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

// =========================
// Initialize Application
// =========================
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded - Starting app initialization...');
  
  try {
    // Check if required elements exist
    const requiredElements = ['app', 'wordCards', 'search', 'settings-panel'];
    const missingElements = [];
    
    requiredElements.forEach(id => {
      if (!document.getElementById(id)) {
        missingElements.push(id);
      }
    });
    
    if (missingElements.length > 0) {
      throw new Error(`Missing required elements: ${missingElements.join(', ')}`);
    }
    
    console.log('✓ All required DOM elements found');
    
    window.germanApp = new GermanLearningApp();
    console.log('✓ App instance created successfully');
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      if (window.germanApp) {
        window.germanApp.cleanup();
      }
    });
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && window.germanApp) {
        // Save state when page becomes hidden
        window.germanApp.saveState();
      }
    });
    
    console.log('✓ App initialization completed successfully');
    
  } catch (error) {
    console.error('❌ Failed to initialize app:', error);
    
    // Show user-friendly error message
    const errorContainer = document.createElement('div');
    errorContainer.innerHTML = `
      <div style="text-align: center; padding: 50px; color: #dc3545; font-family: Arial, sans-serif;">
        <h2>خطأ في تحميل التطبيق</h2>
        <p>حدث خطأ غير متوقع. يرجى إعادة تحميل الصفحة.</p>
        <p style="color: #666; font-size: 14px;">خطأ: ${error.message}</p>
        <button onclick="location.reload()" style="padding: 10px 20px; margin-top: 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
          إعادة تحميل الصفحة
        </button>
      </div>
    `;
    
    document.body.innerHTML = '';
    document.body.appendChild(errorContainer);
  }
});