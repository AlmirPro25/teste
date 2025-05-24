const { logger } = require('../core/config');
const MaestroV4 = require('../services/maestroV4');
const MemoryModule = require('../services/memoryModule');
const { taskQueue } = require('../config/initializers/bullmqSetup'); // Importar taskQueue real
const { dbRun } = require('../config/initializers/database'); // Importar dbRun real

function registerCommandHandlers(io, socket) {
   socket.on('send_command', async (data) => {
        const { command, stream, context } = data || {};
        const fileInfo = data.file; 
        logger.info(`Comando V4 recebido de ${socket.userId} (Socket: ${socket.id}): ${command?.substring(0,100)}`, { stream, context, fileInfo });
        if (!command && !fileInfo) {
             return socket.emit('error_response', { message: 'Comando ou informação de arquivo anexado é necessário.' });
        }
        try {
            await MaestroV4.process(socket.userId, command, fileInfo, stream === true, socket, context || {});
        } catch (error) {
            logger.error(`Erro processando comando V4 de ${socket.userId} (Socket: ${socket.id}): ${error.message}`, error);
            socket.emit('error_response', { message: `Erro interno ao processar comando: ${error.message}` });
        }
   });
   socket.on('enqueue_task', async (data) => {
        const { command, taskType } = data || {}; 
        const fileInfo = data.file;
        if (!command && !fileInfo) return socket.emit('error_response', { message: 'Comando ou arquivo necessário.' });
        if (!taskType) return socket.emit('error_response', { message: 'Tipo de tarefa (taskType) é obrigatório para enfileirar.' });
        const taskId = `batch-${Date.now()}-${socket.userId.slice(0, 6)}`;
        try {
           await MemoryModule.addTask(taskId, socket.userId, command, 'queued');
           const job = await taskQueue.add(taskType, { taskId, userId: socket.userId, command, fileInfo, ...data.payload });
           await dbRun('UPDATE tasks SET job_id = ? WHERE task_id = ?', [job.id, taskId]);
           logger.info(`Tarefa Batch (${taskType}) enfileirada: ${taskId}, Job ID: ${job.id}`);
           socket.join(taskId);
           socket.emit('task_queued_ack', { taskId, jobId: job.id, taskType }); 
        } catch (error) {
            logger.error(`Erro ao enfileirar tarefa ${taskType} para ${socket.userId}: ${error.message}`, error);
            socket.emit('error_response', { message: `Erro ao enfileirar: ${error.message}` });
            await MemoryModule.updateTaskStatus(taskId, 'failed', { error: `Erro ao enfileirar: ${error.message}` }).catch(()=>{});
        }
   });
}

module.exports = { registerCommandHandlers };
