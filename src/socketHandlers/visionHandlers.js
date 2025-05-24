const { logger } = require('../core/config');
const VisionService = require('../services/visionService');

function registerVisionHandlers(io, socket) {
    socket.on('CAPTURE_SCREEN', async ({ taskId: requestedTaskId }) => {
         const taskId = requestedTaskId || `screen_${Date.now()}_${socket.userId.slice(0,6)}`;
         logger.info(`Solicitação CAPTURE_SCREEN de ${socket.userId} (Socket: ${socket.id})`, {taskId});
         socket.join(taskId); 
         try {
              await VisionService.captureScreenAndAnalyze(taskId, socket.id); 
         } catch(error) {
               logger.error(`Erro ao iniciar captura/análise de tela para ${socket.userId}: ${error.message}`);
               socket.emit('error_response', { taskId, message: `Erro na visão: ${error.message}` });
         }
    });
}

module.exports = { registerVisionHandlers };
