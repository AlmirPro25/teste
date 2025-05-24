const { Worker } = require('bullmq');
const { CONFIG, logger } = require('../core/config');
const MessageSystem = require('../services/messageSystem');
const SpeechService = require('../services/speechService');
const SystemGenerator = require('../services/systemGenerator');
const AIService = require('../services/aiService'); // Para injetar no SystemGenerator
// MemoryModule é importado por outros serviços, mas dbGet/dbRun não são usados diretamente aqui.

const worker = new Worker(CONFIG.TASK_QUEUE_NAME, async job => {
    // O server.js original usa job.data.taskType, mas o payload de enqueue_task e generate_system não define taskType explicitamente, e sim o nome do job.
    // O worker original tem: const { taskType, taskId, socketId, ...payload } = job.data;
    // E depois switch (taskType)
    // No entanto, os jobs são adicionados com nomes como 'system_generation_job', 'media_analysis_job'
    // Vamos usar job.name para o switch, que é como BullMQ geralmente funciona se nomes são usados ao adicionar jobs.

    logger.info(`Worker: Iniciando job ${job.id} (${job.name})`, { taskId: job.data.taskId, payloadKeys: Object.keys(job.data) });

    try {
        let result;
        MessageSystem.send(job.data.taskId, 'TASK_UPDATE', { taskId: job.data.taskId, jobId: job.id, status: 'ACTIVE', progress: 1, message: `Worker processando ${job.name}...` });

        // Injeção de dependência para SystemGenerator se necessário
        if (job.name === 'system_generation_job' || job.name === 'system_refinement_job') {
            if (!SystemGenerator.aiService && AIService) {
                SystemGenerator.injectDependencies(AIService);
                logger.debug('AIService injetado no SystemGenerator dentro do worker.');
            } else if (!AIService) {
                logger.warn('AIService não está disponível para injetar no SystemGenerator no worker.');
            }
        }

        switch (job.name) { // Usando job.name
            case 'screen_analysis_job': // Este era um exemplo, pode ser removido se não usado
                 logger.warn("Worker: screen_analysis_job obsoleto, use VisionService.captureScreenAndAnalyze diretamente.");
                 result = { message: "Job obsoleto." };
                 break;
            case 'media_analysis_job': 
                 if (job.data.mimeType?.startsWith('audio/')) {
                     logger.info(`Worker: Iniciando transcrição para ${job.data.filePath}`);
                     result = await SpeechService.recognizeAudio(job.data.filePath, job.data.taskId); 
                     MessageSystem.logAndSend(job.data.taskId, 'SpeechService', `Transcrição concluída: ${result.text.substring(0,100)}...`);
                 } else {
                      throw new Error(`Tipo de mídia não suportado para análise no worker: ${job.data.mimeType}`);
                 }
                break;
             case 'system_generation_job':
                 logger.info(`Worker: Iniciando Geração de Sistema via Job`, {taskId: job.data.taskId, prompt: job.data.prompt?.substring(0,50)});
                 result = await SystemGenerator.generateSystem(job.data.taskId, job.data.userId, job.data.prompt, null); 
                 break;
            case 'system_refinement_job':
                 logger.info(`Worker: Iniciando Refinamento de Sistema via Job`, {taskId: job.data.taskId, newPrompt: job.data.newPrompt?.substring(0,50)});
                  result = await SystemGenerator.refineSystem(job.data.taskId, job.data.userId, job.data.originalResult, job.data.newPrompt, null);
                  break;
            default:
                throw new Error(`Worker: Tipo de tarefa desconhecido: ${job.name}`);
        }
        logger.info(`Worker: Job ${job.id} (${job.name}) concluído.`);
        return result;
    } catch (error) {
        logger.error(`Worker: Erro no job ${job.id} (Task ${job.data.taskId}, Type ${job.name}): ${error.message}`, error);
         MessageSystem.send(job.data.taskId, 'TASK_UPDATE', { taskId: job.data.taskId, jobId: job.id, status: 'FAILED', error: error.message });
        throw error; 
    }
}, { connection: { host: CONFIG.REDIS_HOST, port: CONFIG.REDIS_PORT, password: CONFIG.REDIS_PASSWORD }, concurrency: CONFIG.MAX_CONCURRENT_JOBS });

worker.on('error', error => {
  logger.error('Erro não tratado no Worker BullMQ:', error);
});
worker.on('failed', (job, err) => {
   logger.error(`Worker: Job ${job?.id} (Type: ${job?.name}, Task: ${job?.data?.taskId}) falhou permanentemente após retentativas.`, err);
});

logger.info(`Worker BullMQ para fila "${CONFIG.TASK_QUEUE_NAME}" inicializado e escutando.`);

module.exports = worker;
