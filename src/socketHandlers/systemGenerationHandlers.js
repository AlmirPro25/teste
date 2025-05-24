const { logger } = require('../core/config');
const MemoryModule = require('../services/memoryModule');
// TODO: Importar 'taskQueue' e 'dbRun'
const taskQueue_placeholder = { add: async (jobType, data) => { logger.debug('taskQueue_placeholder.add called', { jobType, data }); return ({ id: 'placeholder_job_id_' + Date.now() }); } };
const dbRun_placeholder = MemoryModule.dbRun;

function registerSystemGenerationHandlers(io, socket) {
    socket.on('generate_system', async (data) => {
        const { prompt, stream } = data || {};
        if (!prompt) return socket.emit('error_response', { message: 'Prompt é necessário.' });
        const taskId = `system_${Date.now()}_${socket.userId.slice(0, 8)}`;
        logger.info(`Solicitação generate_system de ${socket.userId} (Socket: ${socket.id})`, {taskId, prompt: prompt.substring(0,50)});
        try {
            await MemoryModule.addTask(taskId, socket.userId, prompt, 'queued');
            socket.join(taskId);
            socket.emit('task_generation_started', {taskId}); 
            const job = await taskQueue_placeholder.add('system_generation_job', { taskId, userId: socket.userId, prompt });
            await dbRun_placeholder('UPDATE tasks SET job_id = ? WHERE task_id = ?', [job.id, taskId]);
            logger.info(`Geração de sistema enfileirada para Task ${taskId}, Job ID: ${job.id}`);
        } catch (error) {
             logger.error(`Erro em generate_system para task ${taskId}:`, error);
             await MemoryModule.updateTaskStatus(taskId, 'failed', { error: `Erro ao iniciar/enfileirar geração: ${error.message}` }).catch(()=>{});
             socket.emit('error_response', { taskId, message: `Erro ao iniciar/enfileirar geração: ${error.message}` });
        }
    });
    socket.on('refine_system', async (data) => {
          const { taskId, newPrompt, stream } = data || {};
          if (!taskId || !newPrompt) return socket.emit('error_response', { message: 'taskId e newPrompt são necessários.' });
          logger.info(`Solicitação refine_system de ${socket.userId} (Socket: ${socket.id})`, {taskId, newPrompt: newPrompt.substring(0,50)});
          try {
              const task = await MemoryModule.getTask(taskId);
              if (!task) return socket.emit('error_response', { taskId, message: 'Tarefa original não encontrada.' });
              if (task.user_id !== socket.userId) return socket.emit('error_response', { taskId, message: 'Permissão negada.' });
              if (task.status !== 'completed') return socket.emit('error_response', { taskId, message: 'Só é possível refinar tarefas concluídas.' });
               const originalResult = task.result ? JSON.parse(task.result) : null;
                if (!originalResult || !originalResult.code) return socket.emit('error_response', { taskId, message: 'Resultado original inválido ou sem código.' });
              await MemoryModule.updateTaskStatus(taskId, 'queued_refinement'); 
              socket.join(taskId);
              socket.emit('task_refinement_started', {taskId}); 
               const job = await taskQueue_placeholder.add('system_refinement_job', { taskId, userId: socket.userId, originalResult, newPrompt });
               await dbRun_placeholder('UPDATE tasks SET job_id = ? WHERE task_id = ?', [job.id, taskId]); 
               logger.info(`Refinamento de sistema enfileirado para Task ${taskId}, Job ID: ${job.id}`);
          } catch (error) {
               logger.error(`Erro em refine_system para task ${taskId}:`, error);
               await MemoryModule.updateTaskStatus(taskId, 'failed', { error: `Erro ao iniciar/enfileirar refinamento: ${error.message}` }).catch(()=>{});
               socket.emit('error_response', { taskId, message: `Erro ao iniciar/enfileirar refinamento: ${error.message}` });
          }
     });
}

module.exports = { registerSystemGenerationHandlers };
