const { logger } = require('../core/config');
const MediaGenerationSystem = require('../services/mediaGenerationSystem');

function registerMediaHandlers(io, socket) {
    socket.on('GENERATE_IMAGE', async ({ prompt, taskId: reqTaskId }) => {
        const taskId = reqTaskId || `img-${Date.now()}-${socket.userId.slice(0, 6)}`;
        logger.info(`Solicitação GENERATE_IMAGE de ${socket.userId} (Socket: ${socket.id})`, {taskId, prompt: prompt?.substring(0,50)});
        if (!prompt) return socket.emit('error_response', { taskId, message: "Prompt é obrigatório para gerar imagem." });
        socket.join(taskId);
        try {
            // MediaGenerationSystem.generateImage já emite 'IMAGE_GENERATED' ou 'TASK_ERROR' para o socket/task
            await MediaGenerationSystem.generateImage(prompt, taskId, socket);
        } catch (e) { 
            logger.error("Erro no handler GENERATE_IMAGE socket event: ", e.message); 
            // O erro já deve ter sido emitido pelo MediaGenerationSystem para o socket,
            // mas caso não tenha sido, podemos garantir uma resposta de erro aqui.
            if (!socket.disconnected) { // Check if socket is still connected
                 // Avoid sending another error if MediaGenerationSystem already did.
                 // This might require MediaGenerationSystem to return a status or for the error to be checked.
                 // For simplicity, this log is important, and an additional emit might be redundant if service handles it.
            }
        }
   });
   socket.on('GENERATE_AUDIO', async ({ text, taskId: reqTaskId, voiceId }) => { // voiceId added
        const taskId = reqTaskId || `audio-${Date.now()}-${socket.userId.slice(0, 6)}`;
        logger.info(`Solicitação GENERATE_AUDIO de ${socket.userId} (Socket: ${socket.id})`, {taskId, text: text?.substring(0,50), voiceId });
         if (!text) return socket.emit('error_response', { taskId, message: "Texto é obrigatório para gerar áudio." });
        socket.join(taskId);
        try {
             // MediaGenerationSystem.generateAudio já emite 'SPEECH_GENERATED' ou 'TASK_ERROR'
             await MediaGenerationSystem.generateAudio(text, taskId, socket, voiceId); // voiceId passed
        } catch (e) { 
            logger.error("Erro no handler GENERATE_AUDIO socket event: ", e.message);
            // Similar to GENERATE_IMAGE, service should handle socket emissions.
        }
   });
}

module.exports = { registerMediaHandlers };
