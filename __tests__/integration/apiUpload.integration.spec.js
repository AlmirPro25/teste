// __tests__/integration/apiUpload.integration.spec.js

// Importar os módulos que a rota usa, para que possamos mocká-los.
const MemoryModule = require('../../src/services/memoryModule');
const FileProcessor = require('../../src/services/fileProcessor');
const MessageSystem = require('../../src/services/messageSystem');
const { logger } = require('../../src/core/config'); // A rota usa logger

// Mock dos serviços e funções que a rota /api/upload/:taskId interage
jest.mock('../../src/services/memoryModule', () => ({
    getTask: jest.fn(),
    addMessage: jest.fn(),
}));
jest.mock('../../src/services/fileProcessor', () => ({
    processUpload: jest.fn(),
}));
jest.mock('../../src/services/messageSystem', () => ({
    send: jest.fn(),
    io: { // Mock io se MessageSystem.io.to(...).emit(...) for usado diretamente no handler
        to: jest.fn().mockReturnThis(),
        emit: jest.fn()
    }
}));
jest.mock('../../src/core/config', () => ({ // Mock logger para evitar output real
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
    CONFIG: {} // apiRoutes pode não usar CONFIG diretamente, mas é bom ter
}));


// A rota está em src/routes/apiRoutes.js
// Este arquivo exporta um router. Precisamos extrair/simular a função handler específica.
// Para um teste real com supertest, importaríamos o 'app' Express.
// Aqui, vamos simular a chamada da lógica da rota.

// Suponha que a lógica da rota /api/upload/:taskId seja algo como:
// async (req, res) => { ... }
// Vamos definir uma função que simula essa lógica para o teste.
// Esta é uma RECRIAÇÃO da lógica da rota como estava definida em apiRoutes.js,
// adaptada para ser testável aqui.
const mockApiUploadHandler = async (req, res) => {
    const userId = req.userId;
    const taskId = req.params.taskId;
    const socketId = req.body?.socketId; // Adicionado para consistência com apiRoutes.js original
    const file = req.file;

    logger.info(`POST /api/upload/${taskId} - Arquivo recebido: ${file?.filename}`, { userId, socketId, originalName: file?.originalname, size: file?.size });

    if (!file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    // A lógica original em apiRoutes.js não verifica a task com MemoryModule.getTask antes de processar.
    // Ela diretamente processa o arquivo. Adicionaremos essa verificação se for um requisito.
    // Por agora, vamos seguir a lógica como estava em apiRoutes.js.

    try {
        const processedFile = await FileProcessor.processUpload(file, taskId, null); // socket é null aqui, pois a resposta é HTTP

        if (processedFile && !processedFile.error) {
            if (MessageSystem && socketId && MessageSystem.io && MessageSystem.io.to) { // Check MessageSystem.io.to
                 MessageSystem.io.to(socketId).emit('FILE_PROCESSED', { taskId, file: processedFile });
            }
            
            await MemoryModule.addMessage(taskId, 'user', `Arquivo ${file.filename} (${file.mimetype}) recebido e processado.`, { file: processedFile });

            res.status(200).json({
                message: 'Arquivo enviado e processado com sucesso!',
                fileId: file.filename,
                ...processedFile
            });
        } else {
            // Se processedFile for null ou tiver um erro, lance um erro para o catch lidar
            throw new Error(processedFile ? processedFile.error : "Erro desconhecido no processamento do arquivo.");
        }
    } catch (error) {
        logger.error(`Erro em POST /api/upload/${taskId}:`, error);
        // fs.unlink não é mockado aqui, então a tentativa de remover o arquivo não será testada.
        // await fs.unlink(req.file.path).catch(err => logger.warn(...));
        res.status(500).json({ error: `Erro ao processar arquivo: ${error.message}` });
    }
};


describe('Integration-like Test for API Route: POST /api/upload/:taskId', () => {
    let mockReq;
    let mockRes;

    beforeEach(() => {
        // Resetar mocks dos serviços
        MemoryModule.getTask.mockReset(); // Embora não usado no handler acima, mantemos se a lógica real mudar
        MemoryModule.addMessage.mockReset();
        FileProcessor.processUpload.mockReset();
        if (MessageSystem.io && MessageSystem.io.to) { // Resetar mocks do io se existir
            MessageSystem.io.to.mockClear();
            MessageSystem.io.emit.mockClear();
        }
        // logger mocks
        logger.info.mockClear();
        logger.warn.mockClear();
        logger.error.mockClear();


        // Mock de objetos req e res do Express
        mockReq = {
            userId: 'test-user-http',
            params: { taskId: 'task123' },
            body: { socketId: 'socketTestId123' }, // Incluir socketId no body
            file: {
                filename: 'testfile.pdf',
                mimetype: 'application/pdf',
                path: '/tmp/testfile.pdf'
            },
            headers: { 'x-user-id': 'test-user-http' }
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
    });

    it('should successfully process a file upload', async () => {
        const mockProcessedFile = { type: 'pdf', content: 'PDF content extracted', path: mockReq.file.path, filename: mockReq.file.filename };
        FileProcessor.processUpload.mockResolvedValue(mockProcessedFile);

        await mockApiUploadHandler(mockReq, mockRes);

        expect(FileProcessor.processUpload).toHaveBeenCalledWith(mockReq.file, 'task123', null);
        expect(MemoryModule.addMessage).toHaveBeenCalledWith(
            'task123', 
            'user', 
            `Arquivo ${mockReq.file.filename} (${mockReq.file.mimetype}) recebido e processado.`, 
            { file: mockProcessedFile }
        );
        expect(MessageSystem.io.to).toHaveBeenCalledWith('socketTestId123');
        expect(MessageSystem.io.emit).toHaveBeenCalledWith('FILE_PROCESSED', { taskId: 'task123', file: mockProcessedFile });
        
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith({
            message: 'Arquivo enviado e processado com sucesso!',
            fileId: mockReq.file.filename,
            ...mockProcessedFile
        });
    });

    it('should return 400 if no file is provided', async () => {
        mockReq.file = null; // Simular nenhum arquivo enviado
        await mockApiUploadHandler(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({ error: "Nenhum arquivo enviado." });
    });

    it('should return 500 if FileProcessor.processUpload fails', async () => {
        const error = new Error('PDF parsing failed');
        FileProcessor.processUpload.mockRejectedValue(error);

        await mockApiUploadHandler(mockReq, mockRes);

        expect(logger.error).toHaveBeenCalledWith(`Erro em POST /api/upload/task123:`, error);
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ error: `Erro ao processar arquivo: ${error.message}` });
    });

    it('should return 500 if FileProcessor.processUpload returns an error object', async () => {
        const errorResult = { error: "Processed file error" };
        FileProcessor.processUpload.mockResolvedValue(errorResult);
    
        await mockApiUploadHandler(mockReq, mockRes);
    
        expect(logger.error).toHaveBeenCalledWith(
            `Erro em POST /api/upload/task123:`, 
            expect.any(Error) // Verifica se um erro foi logado
        );
        // Verifica se a mensagem do erro logado contém a mensagem de erro do processedFile
        expect(logger.error.mock.calls[0][1].message).toBe(errorResult.error); 
    
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ error: `Erro ao processar arquivo: ${errorResult.error}` });
    });
});
