const axios = require('axios');
const { logger } = require('../core/config');
const { CONFIG } = require('../core/config');

const WebService = {
    async search(query) {
        try {
            logger.info(`WebService: Buscando por "${query}"`);
            const response = await axios.get(CONFIG.SEARCH_API_URL + encodeURIComponent(query), { timeout: 5000 });
            if (response.data && response.data.AbstractText) {
                let results = response.data.AbstractText;
                if (response.data.RelatedTopics && response.data.RelatedTopics.length > 0) {
                    results += "\n\nResultados Relacionados:\n" + response.data.RelatedTopics.slice(0, 5)
                        .map(t => `- ${t.Text} (${t.FirstURL})`)
                        .join('\n');
                }
                logger.debug(`WebService: Busca por "${query}" retornou ${results.length} caracteres.`);
                return results;
            } else if (response.data && response.data.Results && response.data.Results.length > 0) {
                 let results = "Resultados Principais:\n" + response.data.Results.slice(0, 5)
                     .map(t => `- ${t.Text} (${t.FirstURL})`)
                     .join('\n');
                 logger.debug(`WebService: Busca por "${query}" retornou ${results.length} caracteres (lista).`);
                 return results;
            } else {
                 logger.warn(`WebService: Busca por "${query}" não retornou resultados úteis.`);
                return "Nenhum resultado encontrado.";
            }
        } catch (error) {
            logger.error(`WebService: Erro ao buscar por "${query}":`, error.message);
            return `Erro ao realizar a busca: ${error.message}`;
        }
    }
};

module.exports = WebService;
