const { FunctionDeclarationSchemaType } = require('@google/generative-ai'); // Used in _defineTools
const { CONFIG, logger } = require('../core/config');
const GeminiProvider = require('./geminiProvider');
const MemoryModule = require('./memoryModule'); 

// const SystemGenerator = require('./systemGenerator'); // Comentado conforme instrução, será injetado externamente.

const AIService = {
    geminiProvider: GeminiProvider, 
    orchestrator: null, 
    config: CONFIG, 
    metrics: { totalCalls: 0, errors: 0, functionCalls: 0 },
    availableTools: [], 

    init(orchestratorInstance) { 
         this.orchestrator = orchestratorInstance; 
         this.availableTools = this._defineTools();
         logger.info("AIService inicializado.");
         // SystemGenerator.injectDependencies(this); // REMOVIDO conforme instrução
    },

    _defineTools() {
        const allowedAutomationActions = this.config.allowedAutomationActions || [];
        return [
            {
                name: 'web_search',
                description: 'Busca informações recentes na web usando DuckDuckGo.',
                parameters: {
                    type: FunctionDeclarationSchemaType.OBJECT,
                    properties: { query: { type: FunctionDeclarationSchemaType.STRING, description: "Termo ou pergunta a ser pesquisada." } },
                    required: ['query']
                }
            },
            {
                name: 'execute_code',
                description: 'Executa código Python, Javascript ou Bash de forma isolada em um container Docker. Recebe o código e opcionalmente dados de entrada (stdin). Retorna stdout e stderr.',
                parameters: {
                    type: FunctionDeclarationSchemaType.OBJECT,
                    properties: {
                        language: { type: FunctionDeclarationSchemaType.STRING, enum: ['python', 'javascript', 'bash'], description: "Linguagem do código." },
                        code: { type: FunctionDeclarationSchemaType.STRING, description: "O código a ser executado." },
                        input: { type: FunctionDeclarationSchemaType.STRING, description: "Dados opcionais para enviar ao stdin do processo." }
                    },
                    required: ['language', 'code']
                }
            },
             {
                 name: 'generate_image',
                 description: 'Gera uma imagem usando IA (Stability AI XL) a partir de uma descrição textual (prompt).',
                 parameters: {
                     type: FunctionDeclarationSchemaType.OBJECT,
                     properties: { prompt: { type: FunctionDeclarationSchemaType.STRING, description: "Descrição detalhada da imagem a ser gerada." } },
                     required: ['prompt']
                 }
             },
             {
                 name: 'generate_audio',
                 description: 'Gera áudio (fala) a partir de um texto usando IA (ElevenLabs).',
                 parameters: {
                     type: FunctionDeclarationSchemaType.OBJECT,
                     properties: { text: { type: FunctionDeclarationSchemaType.STRING, description: "O texto a ser convertido em fala." } },
                     required: ['text']
                 }
             },
            {
                name: 'automate_desktop_action',
                description: 'Executa uma ação de automação no desktop do usuário (ex: mover mouse, clicar, digitar). Ações críticas requerem confirmação do usuário.',
                parameters: {
                    type: FunctionDeclarationSchemaType.OBJECT,
                    properties: {
                        action: { type: FunctionDeclarationSchemaType.STRING, enum: allowedAutomationActions, description: "A ação de automação a ser executada." },
                        args: { type: FunctionDeclarationSchemaType.ARRAY, description: "Argumentos para a ação (ex: coordenadas [x, y] para moveMouse, [texto] para type).", items: { type: FunctionDeclarationSchemaType.ANY } },
                        description: { type: FunctionDeclarationSchemaType.STRING, description: "Breve descrição do motivo da ação para confirmação do usuário." }
                    },
                    required: ['action', 'args', 'description']
                }
            },
             {
                 name: 'capture_and_analyze_screen',
                 description: 'Captura a tela atual do usuário, envia para análise (OCR e Detecção de Objetos via processo Python/YOLO) e retorna os resultados.',
                 parameters: { type: FunctionDeclarationSchemaType.OBJECT, properties: {}, required: [] } 
             },
        ];
    },

    async execute(params) {
         const { role, taskId, userId, socket } = params; 
         logger.debug(\`AIService: Executando para role \${role}\`, { taskId });
         this.metrics.totalCalls++;

         try {
             const result = await this.geminiProvider.execute({ 
                 ...params,
                 tools: this.availableTools 
             });

             if (result.functionCalls && result.functionCalls.length > 0) {
                  this.metrics.functionCalls += result.functionCalls.length;
                  logger.info(\`AIService: IA solicitou \${result.functionCalls.length} ferramenta(s) para Task \${taskId}.\`);
                  if (this.orchestrator && typeof this.orchestrator.handleFunctionCalls === 'function') {
                       return await this.orchestrator.handleFunctionCalls(taskId, userId, result.functionCalls, params.history || [], socket, result.text);
                   } else {
                       logger.error("AIService: Orchestrator não encontrado ou handleFunctionCalls não definido. Não é possível executar ferramentas.");
                       throw new Error("Orchestrator não disponível para executar ferramentas.");
                   }
             }
             if (result.text !== null && result.text !== undefined) {
                 logger.debug(\`AIService: Resposta de texto recebida para Task \${taskId} (role: \${role})\`);
                 await MemoryModule.addMessage(taskId, 'model', result.text, { role }); 
                 return { text: result.text }; 
             }
             logger.warn(\`AIService: Resposta inesperada sem texto ou chamada de função.\`, { taskId, role });
             return { text: "" }; 
         } catch (error) {
             this.metrics.errors++;
             logger.error(\`AIService: Erro durante execução (role: \${role}, task: \${taskId}):\`, error);
              if (socket && typeof socket.emit === 'function') {  // Check if socket and emit are valid
                  socket.emit('error_response', { taskId, message: \`Erro na IA (\${role}): \${error.message}\` });
              }
             await MemoryModule.addMessage(taskId, 'system_error', \`Erro na IA (\${role}): \${error.message}\`); 
             throw error; 
         }
     },
     getMetrics: function () { return this.metrics; },
     resetMetrics: function () { this.metrics = { totalCalls: 0, errors: 0, functionCalls: 0 }; },
     async estimateCost() { return { estimatedCost: 0 }; } // Placeholder
};

module.exports = AIService;
