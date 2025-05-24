// Configurações e Logging Primeiros
const { CONFIG, logger } = require('./core/config'); 

// Validação Crítica Inicial (movida para o topo após config e logger)
if (!CONFIG.JWT_SECRET || CONFIG.JWT_SECRET === '!!!DEFINE_UM_SEGREDO_JWT_FORTE_NO_.ENV!!!') {
    logger.error("FATAL: JWT_SECRET não definido ou inseguro no .env!"); 
    process.exit(1);
}
const effectiveApiKeys = CONFIG.GOOGLE_API_KEYS && CONFIG.GOOGLE_API_KEYS.length > 0 ? CONFIG.GOOGLE_API_KEYS : (CONFIG.GOOGLE_API_KEY ? [CONFIG.GOOGLE_API_KEY] : []);
if (effectiveApiKeys.length === 0) {
    logger.error("FATAL: Nenhuma GOOGLE_API_KEY(s) definida no .env"); 
    process.exit(1);
}
logger.info(`Configuração carregada. Chaves Gemini encontradas: ${effectiveApiKeys.length}. Modo confirmação de automação: ${CONFIG.criticalActionConfirmation}`);

// Módulos Essenciais do Node
const express = require('express');

// Módulos de Setup e Inicialização
// socketAuthMiddleware é aplicado dentro de serverSetup.js
const { configureStaticRoutes } = require('./routes/staticRoutes');
const { configureDashboardRoutes } = require('./routes/dashboardRoutes');
const apiRouter = require('./routes/apiRoutes'); // router exportado diretamente
const { registerAllSocketHandlers } = require('./socketHandlers');
const { startServer, gracefulShutdown } = require('./core/serverSetup');
// initializeDirectories e initializeDatabase são chamados dentro de startServer

// Inicializadores de Clientes/Serviços (para gracefulShutdown ou referência direta se necessário)
// A maioria é gerenciada dentro de startServer ou pelos próprios módulos de serviço agora
// const { httpServerInstance, ioInstance } = require('./core/serverSetup'); // Placeholder, pois startServer que os retorna -> Não são necessários aqui porque startServer os retorna e são passados para gracefulShutdown

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

configureStaticRoutes(app);
configureDashboardRoutes(app);
app.use('/api', apiRouter);

async function main() {
    try {
        // startServer agora também lida com a criação do httpServer e da instância io,
        // e aplica o middleware de socket.
        const { httpServer, io } = await startServer(app);

        // Registrar handlers de socket (io já tem o middleware de auth aplicado por startServer)
        io.on('connection', (socket) => {
            registerAllSocketHandlers(io, socket);
        });
        
        // Configurar listeners para graceful shutdown
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM', httpServer, io));
        process.on('SIGINT', () => gracefulShutdown('SIGINT', httpServer, io));

    } catch (error) {
        logger.error("FATAL: Erro ao iniciar o servidor principal:", error);
        process.exit(1);
    }
}

main();

process.on('uncaughtException', (error, origin) => {
    logger.error(`Exceção não capturada! Origin: ${origin}`, error);
    // Tentar um graceful shutdown mais robusto aqui pode ser uma opção, 
    // mas é complexo se o estado do servidor estiver corrompido.
    // Por enquanto, logar e sair é o mais seguro.
    // Idealmente, deveria chamar gracefulShutdown se possível, mas httpServer e io podem não estar definidos.
    process.exit(1); 
});
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Rejeição de Promise não tratada!', { reason });
    // Não sair por padrão em unhandledRejection, mas logar é crucial.
    // process.exit(1); // Opcional, dependendo da política de erro
});
