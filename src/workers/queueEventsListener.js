const { QueueEvents } = require('bullmq');
const { CONFIG, logger } = require('../core/config');
const MessageSystem = require('../services/messageSystem');
const { dbGet, dbRun } = require('../config/initializers/database'); // Importar dbGet e dbRun reais

const queueEvents = new QueueEvents(CONFIG.TASK_QUEUE_NAME, { connection: { host: CONFIG.REDIS_HOST, port: CONFIG.REDIS_PORT, password: CONFIG.REDIS_PASSWORD } });

queueEvents.on('completed', async ({ jobId, returnvalue }) => {
  logger.info(`QueueEvents: Job ${jobId} concluído.`);
   const task = await dbGet('SELECT task_id, user_id, status FROM tasks WHERE job_id = ?', [jobId]);
   if(task && task.status !== 'completed' && task.status !== 'failed') {
       MessageSystem.send(task.task_id, 'TASK_STATUS_UPDATE', { taskId: task.task_id, jobId, status: 'COMPLETED', progress: 100, result: returnvalue });
       await dbRun("UPDATE tasks SET status = 'completed', result = ?, updated_at = ? WHERE task_id = ?", [JSON.stringify(returnvalue), Date.now(), task.task_id]);
   } else if (!task) {
        logger.warn(`QueueEvents: Task não encontrada no DB para Job ${jobId} concluído.`);
   }
});

queueEvents.on('failed', async ({ jobId, failedReason }) => {
   logger.error(`QueueEvents: Job ${jobId} falhou: ${failedReason}`);
    const task = await dbGet('SELECT task_id, user_id, status FROM tasks WHERE job_id = ?', [jobId]);
     if(task && task.status !== 'failed') {
         MessageSystem.send(task.task_id, 'TASK_STATUS_UPDATE', { taskId: task.task_id, jobId, status: 'FAILED', error: failedReason });
         await dbRun("UPDATE tasks SET status = 'failed', result = ?, updated_at = ? WHERE task_id = ?", [JSON.stringify({ error: failedReason }), Date.now(), task.task_id]);
     } else if (!task) {
         logger.warn(`QueueEvents: Task não encontrada no DB para Job ${jobId} falhado.`);
     }
});

queueEvents.on('error', (error) => {
     logger.error('Erro no QueueEvents:', error);
});

logger.info(`Listeners QueueEvents para fila "${CONFIG.TASK_QUEUE_NAME}" configurados.`);

module.exports = queueEvents;
