const express = require('express');
const { simpleAuth } = require('../middleware/expressAuth');
const { upload } = require('../middleware/fileUpload');
const MemoryModule = require('../services/memoryModule'); // usa dbGet, dbRun
const FileProcessor = require('../services/fileProcessor');
const MessageSystem = require('../services/messageSystem');
const { logger } = require('../core/config'); // CONFIG não é usado diretamente aqui, mas logger sim.
const fs = require('fs').promises; // Para unlink em caso de erro de upload

// Placeholders para dependências que virão de outros módulos de config
// TODO: Importar 'taskQueue' de '../config/bullmq.js'
const taskQueue_placeholder = {
    add: async (jobType, data) => {
        logger.debug('taskQueue_placeholder.add called', { jobType, data });
        return { id: 'placeholder_job_id_' + Date.now() };
    }
};
// TODO: Importar 'dbRun' de um módulo de banco de dados dedicado (MemoryModule já usa placeholders)
const dbRun_placeholder = MemoryModule.dbRun; // Ou use o placeholder do MemoryModule

const router = express.Router();

// Rota para gerar sistema
router.post('/generate-system', simpleAuth, async (req, res) => {
    const userId = req.userId;
    const { prompt } = req.body;
    const taskId = `system_${Date.now()}_${userId.slice(0, 8)}`;
    logger.info(`POST /api/generate-system recebido`, { userId, taskId, prompt: prompt?.substring(0,50) });

    if (!prompt) return res.status(400).json({ error: 'prompt é obrigatório.' });

    try {
        await MemoryModule.addTask(taskId, userId, prompt, 'queued');
        const job = await taskQueue_placeholder.add('system_generation_job', { taskId, userId, prompt });
        // MemoryModule.dbRun já é o placeholder, então dbRun_placeholder pode ser usado diretamente
        await dbRun_placeholder('UPDATE tasks SET job_id = ? WHERE task_id = ?', [job.id, taskId]);
        res.status(202).json({ message: 'Geração de sistema enfileirada.', taskId, jobId: job.id });
    } catch (error) {
        logger.error(`Erro em POST /api/generate-system:`, error);
        await MemoryModule.updateTaskStatus(taskId, 'failed', { error: error.message }).catch(()=>{});
        res.status(500).json({ error: `Erro ao enfileirar geração: ${error.message}` });
    }
});

// Rota para refinar sistema
router.post('/refine-system', simpleAuth, async (req, res) => {
    const userId = req.userId;
    const { originalTaskId, newPrompt } = req.body;
    const taskId = `refine_${Date.now()}_${userId.slice(0, 8)}`;
    logger.info(`POST /api/refine-system recebido`, { userId, taskId, originalTaskId, newPrompt: newPrompt?.substring(0,50) });

    if (!originalTaskId || !newPrompt) {
        return res.status(400).json({ error: 'originalTaskId e newPrompt são obrigatórios.' });
    }

    try {
        const originalTask = await MemoryModule.getTask(originalTaskId);
        if (!originalTask || !originalTask.result) {
            return res.status(404).json({ error: 'Tarefa original ou seu resultado não encontrados.' });
        }
        // originalTask.result é JSON string, precisa parsear
        const originalResult = JSON.parse(originalTask.result); 

        await MemoryModule.addTask(taskId, userId, `Refinar: ${originalTaskId} com "${newPrompt}"`, 'queued');
        const job = await taskQueue_placeholder.add('system_refinement_job', { taskId, userId, originalResult, newPrompt });
        await dbRun_placeholder('UPDATE tasks SET job_id = ? WHERE task_id = ?', [job.id, taskId]);
        res.status(202).json({ message: 'Refinamento de sistema enfileirado.', taskId, jobId: job.id });
    } catch (error) {
        logger.error(`Erro em POST /api/refine-system:`, error);
        await MemoryModule.updateTaskStatus(taskId, 'failed', { error: error.message }).catch(()=>{});
        res.status(500).json({ error: `Erro ao enfileirar refinamento: ${error.message}` });
    }
});

// Rota para upload de arquivo
router.post('/upload/:taskId', simpleAuth, upload.single('file'), async (req, res) => {
    const userId = req.userId;
    const taskId = req.params.taskId; // TaskId da URL para associar o arquivo
    const socketId = req.body.socketId; // socketId do cliente que fez o upload

    if (!req.file) {
        return res.status(400).send({ error: 'Nenhum arquivo enviado.' });
    }

    logger.info(`POST /api/upload/${taskId} - Arquivo recebido: ${req.file.filename}`, { userId, socketId, originalName: req.file.originalname, size: req.file.size });

    try {
        // FileProcessor.processUpload já está disponível via importação
        const processedFile = await FileProcessor.processUpload(req.file, taskId, null); // socket é null aqui, pois a resposta é HTTP

        if (processedFile && !processedFile.error) {
            // MessageSystem.send é usado para notificar via WebSocket, se necessário, mas aqui é uma resposta HTTP
            // Pode-se adicionar uma lógica para notificar o socketId se ele for conhecido e relevante
            if (MessageSystem && socketId) {
                 MessageSystem.io.to(socketId).emit('FILE_PROCESSED', { taskId, file: processedFile });
            }
            
            // Adiciona mensagem ao histórico da task sobre o upload
            await MemoryModule.addMessage(taskId, 'user', `Arquivo ${req.file.filename} (${req.file.mimetype}) recebido e processado.`, { file: processedFile });

            res.status(200).json({
                message: 'Arquivo enviado e processado com sucesso!',
                fileId: req.file.filename, // Ou um ID mais persistente se gerado
                ...processedFile
            });
        } else {
            throw new Error(processedFile ? processedFile.error : "Erro desconhecido no processamento do arquivo.");
        }
    } catch (error) {
        logger.error(`Erro em POST /api/upload/${taskId}:`, error);
        // Tenta remover o arquivo se houve erro no processamento
        await fs.unlink(req.file.path).catch(err => logger.warn(`Falha ao remover arquivo de upload ${req.file.path} após erro:`, err));
        res.status(500).json({ error: `Erro ao processar arquivo: ${error.message}` });
    }
});

module.exports = router;
