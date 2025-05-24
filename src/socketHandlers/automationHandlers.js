const { logger } = require('../core/config');
const AutomationSystem = require('../services/automationSystem');

function registerAutomationHandlers(io, socket) {
    socket.on('ACTION_CONFIRMED', ({ callbackId, confirmed }) => {
        const pending = AutomationSystem.pendingConfirmations.get(callbackId);
        if (pending && pending.socketId === socket.id) {
            AutomationSystem.resolveConfirmation(callbackId, confirmed);
        } else if (pending) {
             logger.warn(`Automation: Tentativa de confirmar ação ${callbackId} de socket ${socket.id}, mas pertence a ${pending.socketId}. Rejeitado.`);
             AutomationSystem.resolveConfirmation(callbackId, false); 
        } else {
            logger.warn(`Automation: Confirmação recebida para callback ID ${callbackId} inexistente/expirado.`);
        }
   });
}

module.exports = { registerAutomationHandlers };
