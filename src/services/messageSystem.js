const { logger } = require('../core/config');
const MemoryModule = require('./memoryModule');

// TODO: Injete ou importe a instância 'io' do Socket.IO aqui.
const io_placeholder = {
    to: (room) => ({ emit: (event, data) => logger.debug(`io_placeholder.to('${room}').emit('${event}') called`, data) }),
    emit: (event, data) => logger.debug(`io_placeholder.emit('${event}') called`, data)
};

const MessageSystem = {
    io: io_placeholder, // Usar o placeholder definido
    async send(taskId, event, data) {
        this.io.to(taskId).emit(event, data);
        logger.debug(`Mensagem enviada [${event}] para Task ${taskId}`, { content: JSON.stringify(data).substring(0, 100) });
    },
    async broadcast(event, data) {
        this.io.emit(event, data);
        logger.debug(`Broadcast [${event}] enviado`, { content: JSON.stringify(data).substring(0, 100) });
    },
    async logAndSend(taskId, role, content, event = 'newMessage', metadata = null) {
        await MemoryModule.addMessage(taskId, role, content, metadata);
        this.send(taskId, event, { taskId, sender: role, message: content, timestamp: Date.now(), ...(metadata || {}) });
    }
};

module.exports = MessageSystem;
