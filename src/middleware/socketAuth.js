const jwt = require('jsonwebtoken');
const { CONFIG, logger } = require('../core/config'); // Ajuste o caminho se necessário

const socketAuthMiddleware = (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
        logger.warn(`Socket ${socket.id} connection attempt failed: No token`);
        return next(new Error('Authentication error: No token provided'));
    }
    try {
        const decoded = jwt.verify(token, CONFIG.JWT_SECRET);
        socket.userId = decoded.userId || decoded.id;
        if (!socket.userId) throw new Error('Token does not contain userId/id');
        logger.debug(`Socket ${socket.id} autenticado para user ${socket.userId}`);
        next();
    } catch (error) {
        logger.warn(`Socket ${socket.id} authentication failed: ${error.message}`);
        next(new Error('Authentication error: Invalid token'));
    }
};
module.exports = socketAuthMiddleware; // Exporta a função diretamente
