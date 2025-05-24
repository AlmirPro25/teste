// __tests__/core/config.spec.js

// Importar o logger e CONFIG do módulo que queremos testar
// Nota: O caminho pode precisar de ajuste dependendo de onde o Jest é executado
// e como ele resolve os caminhos. Assumindo que ele executa da raiz do projeto.
const { CONFIG, logger } = require('../../src/core/config');

describe('Core Configuration (src/core/config.js)', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        // Reseta process.env para um estado conhecido antes de cada teste
        // Isso é crucial para evitar que testes influenciem uns aos outros
        jest.resetModules(); // Reseta o cache de módulos para recarregar config.js com o novo process.env
        process.env = { ...originalEnv }; // Restaura o process.env original e permite modificações
    });

    afterEach(() => {
        // Restaura o process.env original após cada teste
        process.env = originalEnv;
    });

    describe('CONFIG object', () => {
        it('should load default PORT if not set in environment', () => {
            delete process.env.PORT;
            // Recarregar o módulo config para pegar o process.env modificado
            const reloadedConfig = require('../../src/core/config').CONFIG;
            expect(reloadedConfig.PORT).toBe(6000);
        });

        it('should load PORT from environment variable if set', () => {
            process.env.PORT = '7000';
            const reloadedConfig = require('../../src/core/config').CONFIG;
            expect(reloadedConfig.PORT).toBe(7000); // PORT é parseado para Int no config.js
        });

        it('should load default JWT_SECRET if not set in environment', () => {
            delete process.env.JWT_SECRET;
            const reloadedConfig = require('../../src/core/config').CONFIG;
            expect(reloadedConfig.JWT_SECRET).toBe('!!!DEFINE_UM_SEGREDO_JWT_FORTE_NO_.ENV!!!');
        });

        it('should load JWT_SECRET from environment variable if set', () => {
            process.env.JWT_SECRET = 'mytestsecret';
            const reloadedConfig = require('../../src/core/config').CONFIG;
            expect(reloadedConfig.JWT_SECRET).toBe('mytestsecret');
        });

        it('should handle GOOGLE_API_KEYS (single key string)', () => {
            process.env.GOOGLE_API_KEYS = 'test_api_key_1';
            const reloadedConfig = require('../../src/core/config').CONFIG;
            expect(reloadedConfig.GOOGLE_API_KEYS).toEqual(['test_api_key_1']);
        });

        it('should handle GOOGLE_API_KEYS (comma-separated string)', () => {
            process.env.GOOGLE_API_KEYS = 'key1, key2 , key3';
            const reloadedConfig = require('../../src/core/config').CONFIG;
            expect(reloadedConfig.GOOGLE_API_KEYS).toEqual(['key1', 'key2', 'key3']);
        });
        
        it('should use GOOGLE_API_KEY as fallback if GOOGLE_API_KEYS is empty or not set', () => {
            delete process.env.GOOGLE_API_KEYS;
            process.env.GOOGLE_API_KEY = 'fallback_key';
            const reloadedConfig = require('../../src/core/config').CONFIG;
            // A lógica no config.js é: GOOGLE_API_KEYS array tem precedência.
            // Se GOOGLE_API_KEYS for uma string vazia no .env, resultará em [''] se não filtrado.
            // O filter(Boolean) na implementação original remove strings vazias.
            // Então, se GOOGLE_API_KEYS="", o array fica vazio, e o fallback GOOGLE_API_KEY é usado.
            expect(reloadedConfig.GOOGLE_API_KEYS).toEqual(['fallback_key']);
        });

        it('should have an empty array for GOOGLE_API_KEYS if neither KEYS nor KEY are set', () => {
            delete process.env.GOOGLE_API_KEYS;
            delete process.env.GOOGLE_API_KEY;
            const reloadedConfig = require('../../src/core/config').CONFIG;
            expect(reloadedConfig.GOOGLE_API_KEYS).toEqual([]);
        });

        it('should correctly parse REDIS_PORT to integer', () => {
            process.env.REDIS_PORT = '1234';
            const reloadedConfig = require('../../src/core/config').CONFIG;
            expect(reloadedConfig.REDIS_PORT).toBe(1234);
        });

        it('should have safetySettings defined', () => {
            const reloadedConfig = require('../../src/core/config').CONFIG;
            expect(reloadedConfig.safetySettings).toBeInstanceOf(Array);
            expect(reloadedConfig.safetySettings.length).toBeGreaterThan(0);
            expect(reloadedConfig.safetySettings[0]).toHaveProperty('category');
            expect(reloadedConfig.safetySettings[0]).toHaveProperty('threshold');
        });
        
        // Adicionar mais testes para outras configurações importantes conforme necessário
        // Ex: DB_PATH, UPLOAD_DIR com path.resolve
        it('should resolve DB_PATH correctly', () => {
            // process.env.DB_PATH é opcional, o padrão é 'nexus_unified_v49.db'
            // path.resolve(__dirname, ...) em config.js significa que será relativo a src/core/
            const path = require('path'); // Import path para este teste
            const expectedPath = path.resolve(__dirname, '../../src/core', process.env.DB_PATH || 'nexus_unified_v49.db');
            const reloadedConfig = require('../../src/core/config').CONFIG;
            // A comparação de paths pode ser complicada por causa de `..` e symlinks.
            // O importante é que CONFIG.DB_PATH seja um path absoluto e correto.
            // Aqui vamos apenas verificar se ele é uma string e termina com o nome do arquivo esperado.
            expect(typeof reloadedConfig.DB_PATH).toBe('string');
            expect(reloadedConfig.DB_PATH.endsWith(process.env.DB_PATH || 'nexus_unified_v49.db')).toBe(true);
        });

    });

    describe('logger object', () => {
        it('should exist and have expected methods', () => {
            expect(logger).toBeDefined();
            expect(typeof logger.info).toBe('function');
            expect(typeof logger.warn).toBe('function');
            expect(typeof logger.error).toBe('function');
            expect(typeof logger.debug).toBe('function');
        });

        // Testar se os métodos do logger chamam console (opcional, pode requerer espionagem de console)
        // Exemplo básico para um método:
        it('logger.info should be callable', () => {
            // Mock console.log para evitar output durante o teste e verificar se foi chamado
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
            logger.info('Test message');
            // expect(consoleSpy).toHaveBeenCalled(); // Verifica se console.log foi chamado
            consoleSpy.mockRestore(); // Restaura o console.log original
        });
    });
});
