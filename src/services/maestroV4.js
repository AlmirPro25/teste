const { CONFIG, logger } = require('../core/config');
const AIService = require('./aiService');
const MemoryModule = require('./memoryModule');
const MessageSystem = require('./messageSystem');
const WebService = require('./webService');
const DockerService = require('./dockerService');
const AutomationSystem = require('./automationSystem');
const VisionService = require('./visionService');
const MediaGenerationSystem = require('./mediaGenerationSystem');
const SystemGenerator = require('./systemGenerator');
const CacheManager = require('./cacheManager');
const FileProcessor = require('./fileProcessor'); 

// Placeholder para io (Socket.IO instance)
// TODO: Injete ou importe a instância 'io' do Socket.IO aqui.
const io_placeholder = {
    to: (room) => ({ emit: (event, data) => logger.debug(`MaestroV4.io_placeholder.to('${room}').emit('${event}') called`, data) }),
    emit: (event, data) => logger.debug(`MaestroV4.io_placeholder.emit('${event}') called`, data),
    sockets: {
        sockets: new Map(), 
        get: function(id) { return this.sockets.get(id); } 
    },
    _mockSocket: { 
        id: 'mockSocketId',
        join: (room) => logger.debug(`MaestroV4.io_placeholder._mockSocket.join('${room}') called`),
        leave: (room) => logger.debug(`MaestroV4.io_placeholder._mockSocket.leave('${room}') called`),
        emit: (event, data) => logger.debug(`MaestroV4.io_placeholder._mockSocket.emit('${event}') called`, data)
    }
};

const MaestroV4 = {
    io: io_placeholder, 
    services: { 
        aiService: AIService, 
        memory: MemoryModule,
        messages: MessageSystem,
        web: WebService,
        docker: DockerService,
        automation: AutomationSystem,
        vision: VisionService,
        media: MediaGenerationSystem,
        systemGenerator: SystemGenerator,
        cache: CacheManager,
        fileProcessor: FileProcessor 
    },
    config: CONFIG, 
    activeTasks: new Map(), 

    async process(userId, command, file = null, stream = false, socket, context = {}) {
        const taskId = `task-${Date.now()}-${userId.slice(0, 6)}`;
        logger.info(`MaestroV4: Nova Task ${taskId} iniciada por ${userId}. Stream: ${stream}`, { command: command?.substring(0,100), file: file?.filename, context });

        socket.join(taskId); 
        this.activeTasks.set(taskId, { userId, history: [], status: 'starting', currentPlan: null, currentIteration: 0, socketId: socket.id });

        try {
            await this.services.memory.addTask(taskId, userId, command);
            this.services.messages.send(taskId, 'TASK_STARTED', { taskId, command, context });

             let fileContent = null;
             if (file) {
                 fileContent = await this.services.fileProcessor.processUpload(file, taskId, socket);
                 if (fileContent && !fileContent.error) {
                      command += `\n\n[Arquivo anexado: ${file.filename} (${file.mimetype})` +
                                 `${fileContent.type === 'pdf' ? ` - ${fileContent.pages} páginas` : ''}` +
                                 `${fileContent.type === 'pdf' && fileContent.content ? `\nConteúdo inicial:\n${fileContent.content.substring(0, 500)}...` : ''}` +
                                 `]`;
                 } else if (fileContent?.error) {
                     command += `\n\n[Erro ao processar arquivo ${file.filename}: ${fileContent.error}]`;
                 }
             }

            const initialMessage = { role: 'user', content: command };
            await this.services.memory.addMessage(taskId, 'user', command);
            this.activeTasks.get(taskId).history.push(initialMessage);

             const streamCallback = stream ? (chunk) => {
                  this.services.messages.send(taskId, 'STREAM_UPDATE', { taskId, chunk });
             } : null;

             await this.planAndExecuteTask(taskId, userId, streamCallback, socket, file);

        } catch (error) {
            logger.error(`MaestroV4: Erro crítico processando Task ${taskId}:`, error);
             this.services.messages.logAndSend(taskId, 'MaestroV4', `Erro fatal na tarefa: ${error.message}`, 'TASK_ERROR', { final: true });
             await this.services.memory.updateTaskStatus(taskId, 'failed', { error: error.message });
             this.activeTasks.delete(taskId); 
        }
    },

     async planAndExecuteTask(taskId, userId, streamCallback, socket, file) {
          const taskState = this.activeTasks.get(taskId);
          if (!taskState) {
               logger.error(`MaestroV4: Estado da Task ${taskId} não encontrado.`);
               return;
          }
          taskState.status = 'planning';
          this.services.messages.logAndSend(taskId, 'MaestroV4', '🧠 Planejando a execução...', 'TASK_UPDATE');

          try {
               const planResult = await this.services.aiService.execute({
                    role: 'PlannerAPI', 
                    prompt: `Com base na solicitação do usuário e no histórico, crie um plano passo a passo conciso para atingir o objetivo. Se uma ferramenta for necessária, especifique-a. Solicitação: ${taskState.history.find(m=>m.role==='user')?.content}`,
                    history: taskState.history,
                    taskId, userId, socket,
               });

               if (!planResult || !planResult.text) {
                    throw new Error("Falha ao gerar plano inicial.");
               }
               taskState.currentPlan = planResult.text.split('\n').map(step => step.trim()).filter(Boolean); 
               this.services.messages.logAndSend(taskId, 'MaestroV4', `📝 Plano inicial:\n${taskState.currentPlan.join('\n')}`, 'PLAN_RECEIVED');
                taskState.history.push({ role: 'model', content: `Plano: ${planResult.text}` }); 

               taskState.status = 'executing';
               taskState.currentIteration = 1; 

                this.services.messages.logAndSend(taskId, 'MaestroV4', '🚀 Iniciando execução principal (Iteração 1)...', 'TASK_UPDATE');
               const executionResult = await this.services.aiService.execute({
                    role: 'LeaderAPI', 
                    prompt: taskState.history.find(m=>m.role==='user')?.content, 
                    history: taskState.history,
                    taskId, userId, streamCallback, socket, file, 
                     systemPrompt: `Você é o Nexus, uma IA assistente avançada. Use as ferramentas disponíveis para completar a solicitação do usuário. Pense passo a passo. O plano inicial era:\n${taskState.currentPlan.join('\n')}\n\nExecute a solicitação.`
               });
               if (executionResult && executionResult.text !== undefined) {
                   taskState.status = 'completed';
                   this.services.messages.logAndSend(taskId, 'MaestroV4', '✅ Tarefa concluída com sucesso.', 'TASK_COMPLETED', { finalResult: executionResult.text });
                   await this.services.memory.updateTaskStatus(taskId, 'completed', { finalResult: executionResult.text });
                    taskState.history.push({ role: 'model', content: executionResult.text });
               } else {
                    const finalStatus = await this.services.memory.getTask(taskId);
                    if (finalStatus?.status !== 'failed') {
                         logger.warn(`MaestroV4: Tarefa ${taskId} finalizada sem resultado textual direto. Verifique os logs/histórico.`, { executionResult });
                         taskState.status = 'completed_no_text';
                         this.services.messages.logAndSend(taskId, 'MaestroV4', '✅ Tarefa concluída (sem resposta textual final explícita).', 'TASK_COMPLETED', { finalResult: null });
                         await this.services.memory.updateTaskStatus(taskId, 'completed', { finalResult: null });
                    } else {
                          logger.warn(`MaestroV4: Tarefa ${taskId} finalizada com status 'failed' no DB.`);
                           taskState.status = 'failed';
                    }
               }
          } catch (error) {
               logger.error(`MaestroV4: Erro durante o ciclo de planejamento/execução da Task ${taskId}:`, error);
               taskState.status = 'failed';
                this.services.messages.logAndSend(taskId, 'MaestroV4', `❌ Erro durante a execução: ${error.message}`, 'TASK_ERROR', { final: true });
               await this.services.memory.updateTaskStatus(taskId, 'failed', { error: error.message });
          } finally {
               if(this.activeTasks.has(taskId)) { // Check if task still exists before deleting
                    socket.leave(taskId); 
                    this.activeTasks.delete(taskId); 
                    logger.info(`MaestroV4: Task ${taskId} finalizada com status: ${taskState?.status || 'unknown'}`);
               }
          }
     },

     async handleFunctionCalls(taskId, userId, functionCalls, history, socket, intermediateText = null) {
          const taskState = this.activeTasks.get(taskId);
          if (!taskState) {
              logger.warn(`MaestroV4: handleFunctionCalls - Estado da Task ${taskId} não encontrado.`);
              return { error: "Estado da tarefa não encontrado." }; 
          }

          if (intermediateText) {
               this.services.messages.logAndSend(taskId, 'model', intermediateText, 'STREAM_UPDATE'); 
                taskState.history.push({ role: 'model', content: intermediateText });
          }

          let allResults = [];
          let errorOccurred = false;

          for (const funcCall of functionCalls) {
               const funcName = funcCall.name;
               const funcArgs = funcCall.args || {}; 
               this.services.messages.logAndSend(taskId, 'MaestroV4', `🛠️ Executando ferramenta: ${funcName}(${JSON.stringify(funcArgs).substring(0, 50)}...)\`, 'SUBTASK_UPDATE', { status: 'EXECUTING_STEP', role: funcName });
               taskState.history.push({ role: 'model', tool_calls: [funcCall] }); 

               let result;
               try {
                    switch (funcName) {
                         case 'web_search':
                              result = await this.services.web.search(funcArgs.query);
                              break;
                         case 'execute_code':
                              const dockerResult = await this.services.docker.runCode(funcArgs.language, funcArgs.code, funcArgs.input || '', taskId);
                              result = `Saída Padrão (stdout):\n${dockerResult.stdout}\n\nSaída de Erro (stderr):\n${dockerResult.stderr}`;
                              break;
                         case 'generate_image':
                               const imageResult = await this.services.media.generateImage(funcArgs.prompt, taskId, socket);
                               result = `Imagem solicitada com prompt "${funcArgs.prompt}". A imagem foi gerada e enviada ao usuário. URL (interna): ${imageResult.imageUrl}`;
                              break;
                          case 'generate_audio':
                                const audioResult = await this.services.media.generateAudio(funcArgs.text, taskId, socket, funcArgs.voiceId || null); // Added voiceId
                                result = `Áudio solicitado para o texto "${funcArgs.text.substring(0,30)}...". O áudio foi gerado e enviado ao usuário. URL (interna): ${audioResult.audioUrl}`;
                               break;
                         case 'automate_desktop_action':
                              const automationResult = await this.services.automation.executeAction(funcArgs.action, funcArgs.args, taskId, socket.id);
                               result = typeof automationResult === 'string' ? automationResult : JSON.stringify(automationResult);
                               break;
                         case 'capture_and_analyze_screen':
                                this.services.messages.logAndSend(taskId, 'MaestroV4', `👁️ Solicitando captura e análise da tela...\`, 'TASK_UPDATE');
                               await this.services.vision.captureScreenAndAnalyze(taskId, socket.id);
                               result = "A captura e análise da tela foi iniciada. Os resultados serão fornecidos em breve ou numa próxima mensagem.";
                               break;
                         default:
                              logger.warn(`MaestroV4: Tentativa de chamar função desconhecida: ${funcName}\`, { taskId });
                              result = `Erro: Ferramenta '${funcName}' não encontrada.\`;
                              errorOccurred = true; 
                    }
                    logger.debug(`MaestroV4: Resultado da ferramenta ${funcName}: ${typeof result === 'string' ? result.substring(0,100) : JSON.stringify(result)}...\`, { taskId });
                    const functionResponse = { role: 'function', name: funcName, content: result };
                    allResults.push(functionResponse);
                    taskState.history.push(functionResponse); 
                     this.services.messages.logAndSend(taskId, 'MaestroV4', `✔️ Resultado de ${funcName}: ${typeof result === 'string' ? result.substring(0, 100) : JSON.stringify(result)}...\`, 'SUBTASK_UPDATE', { status: 'COMPLETED', role: funcName });

                } catch (error) {
                     logger.error(`MaestroV4: Erro executando ferramenta ${funcName} para Task ${taskId}:\`, error);
                     const errorMsg = `Erro ao executar ${funcName}: ${error.message}\`;
                     const errorResponse = { role: 'function', name: funcName, content: errorMsg };
                     allResults.push(errorResponse);
                     taskState.history.push(errorResponse); 
                      this.services.messages.logAndSend(taskId, 'MaestroV4', `❌ Erro em ${funcName}: ${error.message}\`, 'SUBTASK_UPDATE', { status: 'STEP_ERROR', role: funcName });
                     errorOccurred = true; 
                }
          } 

           if (allResults.length > 0) { 
                this.services.messages.logAndSend(taskId, 'MaestroV4', '🔄 Enviando resultados das ferramentas para a IA...', 'TASK_UPDATE');
                try {
                     const finalResult = await this.services.aiService.execute({
                         role: 'LeaderAPI', 
                         prompt: null, 
                         history: taskState.history, 
                         taskId, userId,
                         streamCallback: socket ? (chunk) => this.services.messages.send(taskId, 'STREAM_UPDATE', { taskId, chunk }) : null,
                         socket,
                     });
                     return finalResult;
                } catch (aiError) {
                    logger.error(`MaestroV4: Erro na chamada da IA após execução de ferramentas (Task ${taskId}):\`, aiError);
                      this.services.messages.logAndSend(taskId, 'MaestroV4', \`❌ Erro da IA após processar resultados das ferramentas: \${aiError.message}\`, 'TASK_ERROR', { final: true });
                      await this.services.memory.updateTaskStatus(taskId, 'failed', { error: \`Erro da IA pós-ferramentas: \${aiError.message}\` });
                      taskState.status = 'failed'; 
                      return { error: \`Erro da IA após processar resultados das ferramentas: \${aiError.message}\` }; 
                }
           } else {
                 logger.warn(\`MaestroV4: handleFunctionCalls foi chamado, mas nenhum resultado foi gerado.\`, {taskId});
                 return { text: intermediateText || "" }; 
           }
     },
    async getTaskHistory(userId, limit = 10) {
         return this.services.memory.getUserTasks(userId, limit);
    },
    async reflect(userId) { /* TODO: Implement reflection logic */ }
};

module.exports = MaestroV4;
