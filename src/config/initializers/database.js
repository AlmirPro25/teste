const sqlite3 = require('sqlite3').verbose();
const util = require('util');
const { CONFIG, logger } = require('../../core/config');

let dbInstanceHolder = { instance: null };

const initializeDatabase = () => new Promise((resolve, reject) => {
    logger.info("Inicializando banco de dados SQLite em:", CONFIG.DB_PATH);
    const db = new sqlite3.Database(CONFIG.DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, async (err) => {
        if (err) {
            logger.error("Erro ao conectar/criar banco de dados:", err.message);
            return reject(err);
        }
        dbInstanceHolder.instance = db;
        logger.info("Conexão com SQLite estabelecida.");

        try {
            // Promisify run for table creation
            const run = util.promisify(db.run.bind(db));

            await run(`CREATE TABLE IF NOT EXISTS tasks (
                task_id TEXT PRIMARY KEY,
                user_id TEXT,
                command TEXT,
                status TEXT,
                result TEXT,
                job_id TEXT,
                created_at INTEGER,
                updated_at INTEGER
            )`);
            logger.debug("Tabela 'tasks' verificada/criada.");

            await run(`CREATE TABLE IF NOT EXISTS messages (
                message_id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id TEXT,
                role TEXT,
                content TEXT,
                metadata TEXT,
                timestamp INTEGER,
                FOREIGN KEY (task_id) REFERENCES tasks(task_id)
            )`);
            logger.debug("Tabela 'messages' verificada/criada.");
            
            // Adicionar outras tabelas se necessário (ex: 'users', 'settings')
            // Exemplo: Tabela de usuários (simplificada)
            await run(`CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                username TEXT UNIQUE,
                created_at INTEGER
            )`);
            logger.debug("Tabela 'users' verificada/criada.");

            resolve(db);
        } catch (tableError) {
            logger.error("Erro ao criar tabelas:", tableError);
            reject(tableError);
        }
    });
});

const dbRun = async (sql, params = []) => {
    if (!dbInstanceHolder.instance) throw new Error("DB not initialized or instance not set in dbRun");
    return util.promisify(dbInstanceHolder.instance.run.bind(dbInstanceHolder.instance))(sql, params);
};

const dbGet = async (sql, params = []) => {
    if (!dbInstanceHolder.instance) throw new Error("DB not initialized or instance not set in dbGet");
    return util.promisify(dbInstanceHolder.instance.get.bind(dbInstanceHolder.instance))(sql, params);
};

const dbAll = async (sql, params = []) => {
    if (!dbInstanceHolder.instance) throw new Error("DB not initialized or instance not set in dbAll");
    return util.promisify(dbInstanceHolder.instance.all.bind(dbInstanceHolder.instance))(sql, params);
};

module.exports = { 
    initializeDatabase, 
    dbInstanceHolder, // Exportado para referência, mas getDBInstance seria mais seguro
    dbRun, 
    dbGet, 
    dbAll,
    // Adicionar uma função para obter a instância de forma segura
    getDBInstance: () => {
        if (!dbInstanceHolder.instance) {
            logger.error("Tentativa de obter instância do DB antes da inicialização.");
            throw new Error("Database not initialized.");
        }
        return dbInstanceHolder.instance;
    }
};
