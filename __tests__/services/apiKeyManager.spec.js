// __tests__/services/apiKeyManager.spec.js

// Mock para CONFIG e logger antes de importar apiKeyManager
// Isso nos permite controlar as chaves de API para os testes.
const mockConfig = {
    GOOGLE_API_KEYS: [],
    GOOGLE_API_KEY: null,
    // Adicione outras propriedades de CONFIG que apiKeyManager possa vir a usar, se houver
};
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

// Aplicando o mock
jest.mock('../../src/core/config', () => ({
    CONFIG: mockConfig,
    logger: mockLogger,
}));

// Importar o apiKeyManager APÓS o mock
const APIKeyManager = require('../../src/services/apiKeyManager');

describe('Service: APIKeyManager (src/services/apiKeyManager.js)', () => {
    beforeEach(() => {
        // Resetar mocks e o estado do APIKeyManager antes de cada teste
        mockLogger.warn.mockClear();
        APIKeyManager.keys = null; // Força a reinicialização na próxima chamada
        APIKeyManager.invalidKeys.clear();
        APIKeyManager.currentIndex = 0;
        // Resetar as configurações de chaves mockadas
        mockConfig.GOOGLE_API_KEYS = [];
        mockConfig.GOOGLE_API_KEY = null;
    });

    describe('Initialization and Key Retrieval', () => {
        it('should initialize with GOOGLE_API_KEYS if provided', () => {
            mockConfig.GOOGLE_API_KEYS = ['key1', 'key2'];
            APIKeyManager._initializeKeys(); // Chamar explicitamente para teste
            expect(APIKeyManager.getKeyCount()).toBe(2);
            expect(APIKeyManager.keys).toEqual(['key1', 'key2']);
        });

        it('should initialize with GOOGLE_API_KEY if GOOGLE_API_KEYS is empty', () => {
            mockConfig.GOOGLE_API_KEY = 'singleKey';
            APIKeyManager._initializeKeys();
            expect(APIKeyManager.getKeyCount()).toBe(1);
            expect(APIKeyManager.keys).toEqual(['singleKey']);
        });

        it('should initialize with an empty array if no keys are provided', () => {
            APIKeyManager._initializeKeys();
            expect(APIKeyManager.getKeyCount()).toBe(0);
            expect(APIKeyManager.keys).toEqual([]);
        });

        it('getNextKey should return null if no keys are configured', () => {
            expect(APIKeyManager.getNextKey()).toBeNull();
        });

        it('getNextKey should return keys in a round-robin fashion', () => {
            mockConfig.GOOGLE_API_KEYS = ['keyA', 'keyB', 'keyC'];
            expect(APIKeyManager.getNextKey()).toBe('keyA');
            expect(APIKeyManager.getNextKey()).toBe('keyB');
            expect(APIKeyManager.getNextKey()).toBe('keyC');
            expect(APIKeyManager.getNextKey()).toBe('keyA'); // Wraps around
        });
    });

    describe('Key Invalidation and Recovery', () => {
        it('markKeyAsInvalid should add key to invalidKeys set', () => {
            mockConfig.GOOGLE_API_KEYS = ['validKey', 'toBeInvalidated'];
            APIKeyManager.markKeyAsInvalid('toBeInvalidated');
            expect(APIKeyManager.invalidKeys.has('toBeInvalidated')).toBe(true);
        });

        it('getNextKey should skip invalid keys', () => {
            mockConfig.GOOGLE_API_KEYS = ['key1', 'invalidKey', 'key2'];
            APIKeyManager.markKeyAsInvalid('invalidKey');
            expect(APIKeyManager.getNextKey()).toBe('key1');
            expect(APIKeyManager.getNextKey()).toBe('key2');
            expect(APIKeyManager.getNextKey()).toBe('key1'); // Skips 'invalidKey'
        });

        it('getNextKey should clear invalidKeys and retry if all keys are marked invalid', () => {
            mockConfig.GOOGLE_API_KEYS = ['k1', 'k2'];
            APIKeyManager.markKeyAsInvalid('k1');
            APIKeyManager.markKeyAsInvalid('k2');
            
            expect(APIKeyManager.invalidKeys.size).toBe(2);
            const nextKey = APIKeyManager.getNextKey();
            expect(mockLogger.warn).toHaveBeenCalledWith("APIKeyManager: Todas as chaves foram marcadas como inválidas temporariamente.");
            expect(APIKeyManager.invalidKeys.size).toBe(0);
            expect(nextKey).toBe('k1');
            
            expect(APIKeyManager.getNextKey()).toBe('k2'); 
        });

        it('should return null from getNextKey if all keys are invalid and then no keys exist after reset (edge case)', () => {
            mockConfig.GOOGLE_API_KEYS = ['k1'];
            APIKeyManager.markKeyAsInvalid('k1'); 

            expect(APIKeyManager.getNextKey()).toBe('k1');

            APIKeyManager.markKeyAsInvalid('k1');
            APIKeyManager.keys = []; 
            APIKeyManager.invalidKeys.clear(); 
            APIKeyManager.currentIndex = 0;

            expect(APIKeyManager.getNextKey()).toBeNull();
        });
    });

    describe('getKeyCount', () => {
        it('should return the correct number of configured keys', () => {
            mockConfig.GOOGLE_API_KEYS = ['key1', 'key2', 'key3'];
            expect(APIKeyManager.getKeyCount()).toBe(3);
        });

        it('should return 0 if no keys are configured', () => {
            expect(APIKeyManager.getKeyCount()).toBe(0);
        });
    });
});
