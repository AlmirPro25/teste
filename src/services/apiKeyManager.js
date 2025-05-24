const { logger } = require('../core/config');
const { CONFIG } = require('../core/config');

const APIKeyManager = {
    keys: null, // Placeholder to be filled dynamically by _initializeKeys
    invalidKeys: new Set(),
    currentIndex: 0,
    
    _initializeKeys: function() {
        if (!this.keys) { // Initialize only once
            const effectiveApiKeys = CONFIG.GOOGLE_API_KEYS && CONFIG.GOOGLE_API_KEYS.length > 0 
                ? CONFIG.GOOGLE_API_KEYS 
                : (CONFIG.GOOGLE_API_KEY ? [CONFIG.GOOGLE_API_KEY] : []);
            this.keys = [...effectiveApiKeys];
            // Reset currentIndex if keys are re-initialized (e.g., after all were invalid)
            // though current logic in getNextKey handles reset if validKeys is empty.
            this.currentIndex = 0; 
        }
    },

    getKeyCount: function () {
        this._initializeKeys(); // Ensure keys are initialized
        return this.keys.length;
    },

    getNextKey: function () {
        this._initializeKeys(); // Ensure keys are initialized
        if (this.keys.length === 0) {
            logger.warn("APIKeyManager: No API keys available.");
            return null;
        }
        
        const validKeys = this.keys.filter(k => !this.invalidKeys.has(k));
        
        if (validKeys.length === 0) {
            logger.warn("APIKeyManager: All API keys have been marked as invalid temporarily. Clearing invalid set and retrying.");
            this.invalidKeys.clear();
            // After clearing, all original keys are considered valid again for a retry cycle.
            // If there are still no keys (original list was empty), this won't help.
            if (this.keys.length > 0) {
                 this.currentIndex = 0; // Reset the index to try the first key of the original list
                 return this.keys[this.currentIndex]; // Return the first key
            }
            logger.warn("APIKeyManager: Still no API keys after attempting to reset invalid keys.");
            return null; // No keys to begin with
        }
        
        // If currentIndex is out of bounds for validKeys (e.g. after some keys became invalid), reset it.
        // Or, simply use modulo arithmetic that handles the current validKeys length.
        this.currentIndex = this.currentIndex % validKeys.length; 
        const keyToReturn = validKeys[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % validKeys.length; // Advance for next call
        
        return keyToReturn;
    },

    markKeyAsInvalid: function (key) {
        this._initializeKeys(); // Ensure keys are initialized, though less critical here
        if (key) {
            logger.warn(`APIKeyManager: Marking key ${key.substring(0, 5)}... as invalid.`);
            this.invalidKeys.add(key);
        }
    }
};

module.exports = APIKeyManager;
