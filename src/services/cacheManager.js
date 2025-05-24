const { logger } = require('../core/config');
const { CONFIG } = require('../core/config');

const CacheManager = {
    // client: redisClient, // Será substituído por placeholder/TODO
    client: null, // TODO: Injete ou importe o redisClient real aqui
    ttl: CONFIG.cacheTTL, // seconds
    async get(key) {
        if (!this.client) {
            logger.warn("CacheManager: Cliente Redis não inicializado.");
            return null;
        }
        try {
            const data = await this.client.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            logger.error(`CacheManager: Erro ao buscar chave '${key}'`, error);
            return null;
        }
    },
    async set(key, value, ttl = this.ttl) {
        if (!this.client) {
            logger.warn("CacheManager: Cliente Redis não inicializado.");
            return;
        }
        try {
            await this.client.set(key, JSON.stringify(value), 'EX', ttl);
        } catch (error) {
            logger.error(`CacheManager: Erro ao definir chave '${key}'`, error);
        }
    },
    async delete(key) {
        if (!this.client) {
            logger.warn("CacheManager: Cliente Redis não inicializado.");
            return;
        }
        try {
            await this.client.del(key);
        } catch (error) {
            logger.error(`CacheManager: Erro ao deletar chave '${key}'`, error);
        }
    }
};

module.exports = CacheManager;
