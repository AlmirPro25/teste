const { logger } = require('../core/config');
const MaestroV4 = require('../services/maestroV4');

function registerMetaHandlers(io, socket) {
    socket.on('REQUEST_HISTORY', async () => {
        try {
             const history = await MaestroV4.getTaskHistory(socket.userId, 20); 
             socket.emit('HISTORY_UPDATE', { history });
        } catch(error) {
             logger.error(`Erro ao buscar histórico para ${socket.userId}:`, error);
              socket.emit('error_response', { message: "Erro ao buscar histórico." });
        }
   });
}

module.exports = { registerMetaHandlers };
