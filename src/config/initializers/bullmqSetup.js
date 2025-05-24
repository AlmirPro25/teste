const { Queue } = require('bullmq');
const { CONFIG, logger } = require('../../core/config');

const taskQueue = new Queue(CONFIG.TASK_QUEUE_NAME, { 
    connection: { 
        host: CONFIG.REDIS_HOST, 
        port: CONFIG.REDIS_PORT, 
        password: CONFIG.REDIS_PASSWORD 
    } 
});

taskQueue.on('error', err => logger.error('Erro na Fila BullMQ Principal:', err));

logger.info(`Fila BullMQ "${CONFIG.TASK_QUEUE_NAME}" inicializada.`);

module.exports = { taskQueue };
