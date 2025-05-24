const { logger } = require('../core/config');
const MemoryModule = require('./memoryModule');

const MessageSystem = {
    io: null, // Atribuído em serverSetup.js
    async send(taskId, event, data) {
        if (!this.io) {
            logger.warn("MessageSystem: Instância io não atribuída. Mensagem não enviada.");
            return;
        }
        this.io.to(taskId).emit(event, data);
        logger.debug(`Mensagem enviada [${event}] para Task ${taskId}`, { content: JSON.stringify(data).substring(0, 100) });
    },
    async broadcast(event, data) {
        if (!this.io) {
            logger.warn("MessageSystem: Instância io não atribuída. Broadcast não enviado.");
            return;
        }
        this.io.emit(event, data);
        logger.debug(`Broadcast [${event}] enviado`, { content: JSON.stringify(data).substring(0, 100) });
    },
    async logAndSend(taskId, role, content, event = 'newMessage', metadata = null) {
        await MemoryModule.addMessage(taskId, role, content, metadata);
        // A chamada this.send() internamente verifica this.io
        this.send(taskId, event, { taskId, sender: role, message: content, timestamp: Date.now(), ...(metadata || {}) });
    }
};

module.exports = MessageSystem;
