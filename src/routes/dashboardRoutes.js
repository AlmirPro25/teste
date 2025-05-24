const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../core/config'); // Logger for potential errors

// Caminho para o arquivo index.html
const indexPath = path.join(__dirname, '..', 'public', 'index.html');

async function configureDashboardRoutes(app) {
    app.get('/', async (req, res) => {
        try {
            const htmlContent = await fs.readFile(indexPath, 'utf8');
            res.type('html').send(htmlContent);
        } catch (error) {
            logger.error("Erro ao ler dashboard HTML:", error);
            res.status(500).send("Erro interno ao carregar o painel.");
        }
    });
}

// DASHBOARD_HTML constante removida

module.exports = { configureDashboardRoutes };
