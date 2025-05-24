const Redis = require('ioredis');
const { CONFIG, logger } = require('../../core/config');

const redisClient = new Redis({
    host: CONFIG.REDIS_HOST,
    port: CONFIG.REDIS_PORT,
    password: CONFIG.REDIS_PASSWORD,
    maxRetriesPerRequest: 3,
    enableReadyCheck: false // Recommended for BullMQ and general use to avoid startup issues
});

const pubClient = redisClient.duplicate();
const subClient = redisClient.duplicate();

redisClient.on('error', (err) => logger.error('Erro no Cliente Redis Principal:', err));
pubClient.on('error', (err) => logger.error('Erro no Cliente Redis Pub:', err));
subClient.on('error', (err) => logger.error('Erro no Cliente Redis Sub:', err));

// Optional: Log successful connections
redisClient.on('connect', () => logger.info('Cliente Redis Principal conectado.'));
pubClient.on('connect', () => logger.info('Cliente Redis Pub conectado.'));
subClient.on('connect', () => logger.info('Cliente Redis Sub conectado.'));

module.exports = { redisClient, pubClient, subClient };
