// __tests__/services/webService.spec.js

const axios = require('axios');
const WebService = require('../../src/services/webService');
const { CONFIG, logger } = require('../../src/core/config'); // WebService usa CONFIG e logger

// Mock para axios
jest.mock('axios');

// Mock para logger (para evitar output real e permitir espionagem)
// e CONFIG para garantir que o URL de busca é o esperado.
// Nota: O jest.mock('../../src/core/config', ...) precisa ser chamado ANTES do require('../../src/services/webService')
// se o WebService capturar CONFIG ou logger no momento da sua definição de módulo.
// Para ser seguro, vamos garantir que o mock está no topo.
const actualConfig = jest.requireActual('../../src/core/config').CONFIG;

jest.mock('../../src/core/config', () => ({
    CONFIG: {
        SEARCH_API_URL: actualConfig.SEARCH_API_URL, // Usar o valor real do config.js
        // Adicione outras configs que WebService possa usar, se houver.
        // Se WebService usar outras propriedades de CONFIG, elas devem ser mockadas aqui.
    },
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));


describe('Service: WebService (src/services/webService.js)', () => {
    beforeEach(() => {
        // Limpar mocks antes de cada teste
        axios.get.mockReset();
        logger.info.mockClear();
        logger.warn.mockClear();
        logger.error.mockClear();
        logger.debug.mockClear();
    });

    describe('search method', () => {
        it('should return AbstractText if available', async () => {
            const mockData = {
                AbstractText: "This is the main abstract text.",
                RelatedTopics: [
                    { Text: "Related Topic 1", FirstURL: "url1" },
                    { Text: "Related Topic 2", FirstURL: "url2" },
                ]
            };
            axios.get.mockResolvedValue({ data: mockData });

            const query = "test query";
            const results = await WebService.search(query);

            expect(axios.get).toHaveBeenCalledWith(CONFIG.SEARCH_API_URL + encodeURIComponent(query), { timeout: 5000 });
            expect(logger.info).toHaveBeenCalledWith(`WebService: Buscando por "${query}"`);
            expect(logger.debug).toHaveBeenCalledWith(`WebService: Busca por "${query}" retornou ${results.length} caracteres.`);
            expect(results).toContain("This is the main abstract text.");
            expect(results).toContain("Resultados Relacionados:");
            expect(results).toContain("- Related Topic 1 (url1)");
            expect(results).toContain("- Related Topic 2 (url2)");
        });

        it('should return formatted Results if AbstractText is not available but Results are', async () => {
            const mockData = {
                Results: [
                    { Text: "Main Result 1", FirstURL: "mainUrl1" },
                    { Text: "Main Result 2", FirstURL: "mainUrl2" },
                ]
                // No AbstractText
            };
            axios.get.mockResolvedValue({ data: mockData });

            const query = "another query";
            const results = await WebService.search(query);

            expect(axios.get).toHaveBeenCalledWith(CONFIG.SEARCH_API_URL + encodeURIComponent(query), { timeout: 5000 });
            expect(results).toContain("Resultados Principais:");
            expect(results).toContain("- Main Result 1 (mainUrl1)");
            expect(results).toContain("- Main Result 2 (mainUrl2)");
        });

        it('should return "Nenhum resultado encontrado." if no useful data is returned', async () => {
            axios.get.mockResolvedValue({ data: {} }); // Resposta vazia

            const query = "empty query";
            const results = await WebService.search(query);

            expect(logger.warn).toHaveBeenCalledWith(`WebService: Busca por "${query}" não retornou resultados úteis.`);
            expect(results).toBe("Nenhum resultado encontrado.");
        });

        it('should handle API errors gracefully', async () => {
            const errorMessage = "Network Error";
            axios.get.mockRejectedValue(new Error(errorMessage));

            const query = "error query";
            const results = await WebService.search(query);

            expect(logger.error).toHaveBeenCalledWith(`WebService: Erro ao buscar por "${query}":`, errorMessage);
            expect(results).toBe(`Erro ao realizar a busca: ${errorMessage}`);
        });

        it('should use a 5-second timeout for axios request', async () => {
            axios.get.mockResolvedValue({ data: { AbstractText: "some text" } });
            await WebService.search("timeout test");
            expect(axios.get).toHaveBeenCalledWith(expect.any(String), { timeout: 5000 });
        });
    });
});
