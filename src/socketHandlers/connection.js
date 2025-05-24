const { logger } = require('../core/config');
const AutomationSystem = require('../services/automationSystem');

function handleBaseEvents(io, socket) {
    logger.info(`Cliente conectado e autenticado: ${socket.userId} (Socket ID: ${socket.id})`);
    socket.join(socket.userId);

    socket.on('JOIN_TASK_ROOM', (taskId) => {
        logger.debug(`Socket ${socket.id} entrando na sala da Task ${taskId}`);
        socket.join(taskId);
    });
    socket.on('LEAVE_TASK_ROOM', (taskId) => {
        logger.debug(`Socket ${socket.id} saindo da sala da Task ${taskId}`);
        socket.leave(taskId);
    });
    socket.on('disconnect', (reason) => {
        logger.info(`Cliente desconectado: ${socket.userId} (Socket ID: ${socket.id}). Razão: ${reason}`);
        AutomationSystem.pendingConfirmations.forEach((confirmation, callbackId) => {
            if (confirmation.socketId === socket.id) {
                clearTimeout(confirmation.timeoutId);
                if (confirmation.reject) { // Check if reject exists
                    confirmation.reject(new Error("Usuário desconectado durante confirmação."));
                }
                AutomationSystem.pendingConfirmations.delete(callbackId);
                logger.warn(`Automation: Confirmação pendente ${callbackId} cancelada devido à desconexão.`);
            }
        });
    });
    socket.on('error', (error) => {
        logger.error(`Erro no Socket ${socket.id} (User ${socket.userId}):`, error);
    });
}
module.exports = { handleBaseEvents };
