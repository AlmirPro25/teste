const fs = require('fs').promises;
const pdfParse = require('pdf-parse');
const { CONFIG, logger } = require('../core/config');
const MessageSystem = require('./messageSystem'); 

// Placeholder para taskQueue e dbRun
// TODO: Importar 'taskQueue' de '../config/bullmq.js'
const taskQueue_placeholder = {
    add: async (jobType, data) => {
        logger.debug('taskQueue_placeholder.add called', { jobType, data });
        return { id: 'placeholder_job_id_' + Date.now() };
    }
};
// TODO: Importar 'dbRun' de um módulo de banco de dados dedicado.
const dbRun_placeholder = async (sql, params = []) => { logger.debug('dbRun_placeholder called', { sql, params }); return Promise.resolve(); };

const FileProcessor = {
    config: CONFIG, 
    taskQueue: taskQueue_placeholder, 

    async processUpload(file, taskId, socket) { 
        if (!file) return null;
        logger.info(`FileProcessor: Processando upload ${file.filename} (${file.mimetype})`, { taskId });

        if (file.mimetype === 'application/pdf') {
            try {
                 const dataBuffer = await fs.readFile(file.path);
                 const data = await pdfParse(dataBuffer);
                 logger.info(`FileProcessor: PDF ${file.filename} parseado. ${data.numpages} páginas.`, { taskId });
                 return { type: 'pdf', content: data.text.substring(0, 50000), pages: data.numpages, path: file.path, filename: file.filename }; 
            } catch (error) {
                 logger.error(`FileProcessor: Erro ao parsear PDF ${file.filename}:`, error);
                 if (socket && MessageSystem && MessageSystem.send) { 
                     MessageSystem.send(taskId, 'error_response', { taskId, message: `Erro ao processar PDF: ${error.message}` });
                 } else if (socket) {
                     socket.emit('error_response', { taskId, message: `Erro ao processar PDF: ${error.message}` });
                 }
                 return { type: 'pdf', error: error.message, path: file.path, filename: file.filename };
            }
        } else if (file.mimetype.startsWith('image/')) {
             logger.info(`FileProcessor: Arquivo de imagem ${file.filename} recebido. Análise pode ser feita pela IA multimodal ou Visão.`, { taskId });
             return { type: 'image', path: file.path, mimetype: file.mimetype, filename: file.filename };
        } else if (file.mimetype.startsWith('audio/')) {
             logger.info(`FileProcessor: Arquivo de áudio ${file.filename} recebido. Pode ser enfileirado para transcrição.`, { taskId });
             return { type: 'audio', path: file.path, mimetype: file.mimetype, filename: file.filename };
        }
         else {
              logger.warn(`FileProcessor: Tipo de arquivo não suportado diretamente: ${file.mimetype}`, { taskId });
              return { type: 'other', path: file.path, mimetype: file.mimetype, filename: file.filename };
         }
    },
     async enqueueFileAnalysis(filePath, mimeType, taskId, socketId, jobType = 'media_analysis_job') {
         try {
             const job = await this.taskQueue.add(jobType, { 
                 taskId,
                 socketId,
                 filePath,
                 mimeType,
             });
             logger.info(`FileProcessor: Tarefa de análise (${jobType}) enfileirada para ${filePath}. Job ID: ${job.id}`, { taskId });
             
             await dbRun_placeholder('UPDATE tasks SET job_id = ? WHERE task_id = ?', [job.id, taskId]);
             if (MessageSystem && MessageSystem.send) { 
                MessageSystem.send(taskId, 'TASK_UPDATE', { taskId, status: 'QUEUED', message: `Análise de arquivo enfileirada (Job ${job.id})` });
             }
             return job.id;
         } catch (error) {
             logger.error(`FileProcessor: Erro ao enfileirar análise para ${filePath}:`, error);
             if (MessageSystem && MessageSystem.send) { 
                MessageSystem.send(taskId, 'TASK_ERROR', { taskId, errorMessage: `Erro ao enfileirar análise: ${error.message}` });
             }
             return null;
         }
     }
};

module.exports = FileProcessor;
