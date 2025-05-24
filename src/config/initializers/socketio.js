const { Server } = require('socket.io');
const { createAdapter } = require("@socket.io/redis-adapter");
const { CONFIG, logger } = require('../../core/config');
const { pubClient, subClient } = require('./redis'); // Do módulo Redis criado nesta etapa

function initializeSocketIO(httpServer) {
    const io = new Server(httpServer, {
        cors: CONFIG.SOCKET_IO_CORS,
        adapter: createAdapter(pubClient, subClient),
        pingTimeout: CONFIG.SOCKET_PING_TIMEOUT || 60000, // Usar valor de CONFIG ou default
        pingInterval: CONFIG.SOCKET_PING_INTERVAL || 25000, // Usar valor de CONFIG ou default
    });
    logger.info("Socket.IO inicializado com adapter Redis.");
    return io;
}

module.exports = { initializeSocketIO };
