const { logger } = require('../core/config');
const { dbRun, dbGet, dbAll } = require('../config/initializers/database');

const MemoryModule = {
    async addTask(taskId, userId, command, status = 'started') {
        const timestamp = Date.now();
        await dbRun(
            'INSERT INTO tasks (task_id, user_id, command, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            [taskId, userId, command, status, timestamp, timestamp]
        );
        logger.debug(`Task ${taskId} adicionada ao DB.`);
    },
    async updateTaskStatus(taskId, status, result = null) {
        await dbRun(
            'UPDATE tasks SET status = ?, result = ?, updated_at = ? WHERE task_id = ?',
            [status, result ? JSON.stringify(result) : null, Date.now(), taskId]
        );
        logger.debug(`Task ${taskId} atualizada no DB para status ${status}.`);
    },
    async getTask(taskId) {
        return dbGet('SELECT * FROM tasks WHERE task_id = ?', [taskId]);
    },
    async getUserTasks(userId, limit = 50) {
        return dbAll('SELECT task_id, command, status, created_at, updated_at FROM tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', [userId, limit]);
    },
    async addMessage(taskId, role, content, metadata = null) {
        await dbRun(
            'INSERT INTO messages (task_id, role, content, metadata, timestamp) VALUES (?, ?, ?, ?, ?)',
            [taskId, role, content, metadata ? JSON.stringify(metadata) : null, Date.now()]
        );
    },
    async getMessages(taskId, limit = 100) {
        return dbAll('SELECT role, content, metadata, timestamp FROM messages WHERE task_id = ? ORDER BY timestamp ASC LIMIT ?', [taskId, limit]);
    }
};

module.exports = MemoryModule;
