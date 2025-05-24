const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const util = require('util'); // Para dbInstance.close
const { CONFIG, logger } = require('./config');

// Imports dos inicializadores
const { initializeSocketIO } = require('../config/initializers/socketio');
const socketAuthMiddleware = require('../middleware/socketAuth'); // Importar o middleware de autenticação de socket
const { initializeDatabase, dbInstanceHolder } = require('../config/initializers/database'); // dbRun, dbGet, dbAll não são usados diretamente aqui
const { redisClient, pubClient, subClient } = require('../config/initializers/redis');
const { docker } = require('../config/initializers/docker');
const { taskQueue } = require('../config/initializers/bullmqSetup');

// Imports dos workers
const worker = require('../workers/taskWorker');
const queueEvents = require('../workers/queueEventsListener');

// Imports dos Serviços
const VisionService = require('../services/visionService');
const AIService = require('../services/aiService');
const SystemGenerator = require('../services/systemGenerator');
const MaestroV4 = require('../services/maestroV4');
const CacheManager = require('../services/cacheManager');
const DockerService = require('../services/dockerService');
const MessageSystem = require('../services/messageSystem');
const AutomationSystem = require('../services/automationSystem');
const FileProcessor = require('../services/fileProcessor');
// MemoryModule é usado internamente por outros serviços e já usa os placeholders/funções de database.js

async function initializeDirectories() {
    logger.info("Verificando/criando diretórios necessários...");
    const dirs = [
        CONFIG.UPLOAD_DIR,
        CONFIG.SCREENSHOT_DIR,
        CONFIG.DOCKER_WORK_DIR,
        CONFIG.SYSTEM_GENERATION_DIR,
        path.resolve(CONFIG.SYSTEM_GENERATION_DIR, '../generated_media/audio'),
        path.resolve(CONFIG.SYSTEM_GENERATION_DIR, '../generated_media/images'),
        path.dirname(CONFIG.VISION_SCRIPT_PATH)
    ];

    for (const dir of dirs) {
        try {
            await fs.mkdir(dir, { recursive: true });
            logger.debug(`Diretório verificado/criado: ${dir}`);
        } catch (error) {
            logger.error(`Falha ao criar diretório ${dir}:`, error);
            // Decidir se o erro é fatal ou não. Por enquanto, apenas loga.
        }
    }
}

async function startServer(app) { // app é a instância do Express
    await initializeDirectories();
    await initializeDatabase(); // Configura dbInstanceHolder.instance

    const httpServer = http.createServer(app);
    const io = initializeSocketIO(httpServer);
    io.use(socketAuthMiddleware); // Aplicar middleware de autenticação de socket aqui

    // Injeção de Dependências nos Serviços
    // Os serviços que usam MemoryModule já devem estar pegando as funções dbRun, dbGet, dbAll corretas
    // pois database.js agora exporta as funções que usam dbInstanceHolder.instance.
    // Os placeholders em MemoryModule serão efetivamente ignorados se os serviços importarem
    // dbRun, dbGet, dbAll de database.js ou se MemoryModule for atualizado para usar database.js
    // (a última é a melhor prática, mas fora do escopo desta tarefa de apenas mover o setup).

    CacheManager.client = redisClient;
    DockerService.docker = docker; // Instância dockerode importada
    MessageSystem.io = io;
    VisionService.ioInstance = io; // VisionService usa ioInstance
    AutomationSystem.io = io;
    FileProcessor.taskQueue = taskQueue; // taskQueue importada de bullmqSetup

    // Inicializar serviços que precisam de setup ou instâncias
    AIService.init(MaestroV4); // MaestroV4 é passado como o orchestrator
    SystemGenerator.injectDependencies(AIService); // Ou SystemGenerator.aiService = AIService;
    
    // MaestroV4.services já deve estar preenchido corretamente pelos imports diretos nos módulos
    // Mas io precisa ser injetado.
    MaestroV4.io = io;

    // Iniciar serviços que precisam ser explicitamente iniciados
    VisionService.ensureVisionIsRunning();

    // Workers BullMQ (taskWorker e queueEventsListener) já são iniciados quando seus módulos são importados.

    httpServer.listen(CONFIG.PORT, () => {
        logger.info(`Servidor Nexus Unified v4.9 escutando na porta ${CONFIG.PORT}`);
        logger.info(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
        logger.info(`Diretório de Uploads: ${CONFIG.UPLOAD_DIR}`);
        logger.info(`Redis Host: ${CONFIG.REDIS_HOST}:${CONFIG.REDIS_PORT}`);
    });

    return { httpServer, io }; // Retornar para uso no gracefulShutdown
}

async function gracefulShutdown(signal, httpServer, ioInstance) {
    logger.info(`Sinal ${signal} recebido. Iniciando graceful shutdown...`);

    // 1. Parar de aceitar novas conexões HTTP e Socket.IO
    if (httpServer) {
        await new Promise(resolve => httpServer.close(resolve));
        logger.info('Servidor HTTP fechado.');
    }
    if (ioInstance) {
        ioInstance.close(() => { // io.close não retorna Promise diretamente
            logger.info('Conexões Socket.IO fechadas.');
        });
    }

    // 2. Parar serviços que mantêm conexões ou processos
    if (VisionService && typeof VisionService.stop === 'function') {
        VisionService.stop(); // Não é async no código original
        logger.info('VisionService parado.');
    }

    // 3. Fechar workers e filas BullMQ
    if (worker && typeof worker.close === 'function') {
        await worker.close();
        logger.info('Worker BullMQ fechado.');
    }
    if (taskQueue && typeof taskQueue.close === 'function') {
        await taskQueue.close();
        logger.info('Fila BullMQ (taskQueue) fechada.');
    }
    if (queueEvents && typeof queueEvents.close === 'function') {
        await queueEvents.close();
        logger.info('QueueEvents BullMQ fechados.');
    }

    // 4. Fechar conexões Redis
    if (redisClient && typeof redisClient.quit === 'function') {
        await redisClient.quit();
        logger.info('Cliente Redis principal fechado.');
    }
    if (pubClient && typeof pubClient.quit === 'function') {
        await pubClient.quit();
        logger.info('Cliente Redis Pub fechado.');
    }
    if (subClient && typeof subClient.quit === 'function') {
        await subClient.quit();
        logger.info('Cliente Redis Sub fechado.');
    }

    // 5. Fechar conexão com o banco de dados
    if (dbInstanceHolder.instance) {
        try {
            await util.promisify(dbInstanceHolder.instance.close.bind(dbInstanceHolder.instance))();
            logger.info('Conexão com o banco de dados SQLite fechada.');
        } catch (dbError) {
            logger.error('Erro ao fechar banco de dados SQLite:', dbError);
        }
    }

    logger.info('Graceful shutdown concluído. Saindo.');
    process.exit(0);
}

module.exports = {
    initializeDirectories,
    startServer,
    gracefulShutdown
};
