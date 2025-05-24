const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const screenshot = require('screenshot-desktop');
const { CONFIG, logger } = require('../core/config');
const MessageSystem = require('./messageSystem'); 

// Definição local de 'delay'
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const VisionService = {
    processInstance: null,
    retries: 0,
    maxRetries: CONFIG.MAX_VISION_RETRIES,
    retryDelay: CONFIG.VISION_RETRY_DELAY,
    ioInstance: null, // Atribuído em serverSetup.js
    loggerInstance: logger, // Usar logger importado
    isStarting: false,
    lastKnownPid: null,

    spawnVisionProcess(attemptTaskId = 'vision_init') {
        if (this.processInstance || this.isStarting) {
            this.loggerInstance.debug(`Visão: Spawn solicitado, mas já rodando (PID: ${this.processInstance?.pid}) ou iniciando.`);
            return;
        }
        this.isStarting = true;

        const pythonExecutable = CONFIG.VISION_PYTHON_PATH;
        const visionScript = CONFIG.VISION_SCRIPT_PATH;
        const args = ['-u', visionScript, '--task-id', attemptTaskId]; 

        this.loggerInstance.info(`Visão: Iniciando processo Python (Script: ${visionScript}) com TaskID: ${attemptTaskId}`);

        try {
             if (!require('fs').existsSync(visionScript)) { 
                  throw new Error(`Script de visão não encontrado em ${visionScript}`);
             }

            this.processInstance = spawn(pythonExecutable, args, { stdio: ['pipe', 'pipe', 'pipe'] });
            this.lastKnownPid = this.processInstance.pid;
            this.isStarting = false; 
            this.loggerInstance.info(`Visão: Processo Python (PID: ${this.processInstance.pid}) iniciado.`);
            this.retries = 0; 

            this.processInstance.stdout.on('data', (data) => {
                const dataStr = data.toString().trim();
                dataStr.split('\n').forEach(line => {
                     if (line) {
                         try {
                             const message = JSON.parse(line);
                             this.handlePythonMessage(message);
                         } catch (err) {
                             this.loggerInstance.debug(`Visão (PY > STDOUT): ${line.substring(0, 200)}`);
                         }
                     }
                });
            });

            this.processInstance.stderr.on('data', (data) => {
                const errorMsg = data.toString().trim();
                 if(errorMsg.includes('WARNING') || errorMsg.includes('INFO')) {
                      this.loggerInstance.warn(`Visão (PY > STDERR): ${errorMsg}`);
                 } else {
                     this.loggerInstance.error(`Visão (PY > STDERR): ${errorMsg}`);
                 }
            });

            this.processInstance.on('close', (code, signal) => this.handleProcessExit(attemptTaskId, code, signal));
            this.processInstance.on('error', (err) => {
                 this.loggerInstance.error(`Visão: Erro no spawn do processo Python: ${err.message}`, { attemptTaskId });
                 this.isStarting = false; 
                 this.processInstance = null;
                 this.handleProcessExit(attemptTaskId, 1, null); 
             });

        } catch (spawnError) {
            this.loggerInstance.error("Visão: Falha CRÍTICA ao iniciar processo Python:", spawnError);
            this.isStarting = false; 
            this.processInstance = null;
            this.handleProcessExit(attemptTaskId, 1, null); 
        }
    },

     handlePythonMessage(message) {
          const { type, payload, message: msgText, socketId, taskId } = message;
           const targetTaskId = payload?.taskId || taskId || 'unknown_task';

           this.loggerInstance.debug(`Visão: Mensagem recebida do Python (Type: ${type}, Task: ${targetTaskId})`);

           if (!this.ioInstance) {
               this.loggerInstance.warn("VisionService: ioInstance não configurado. Mensagens Python não podem ser encaminhadas.");
               return;
           }

           switch (type) {
                case 'ANALYSIS_RESULT':
                     this.loggerInstance.info(`Visão: Resultado da análise recebido para Task ${targetTaskId}`, { detections: payload.detections?.length, ocr: payload.ocrText?.length > 0});
                     this.ioInstance.to(targetTaskId).emit('ANALYSIS_RESULT', payload);
                     break;
                case 'DIGITAL_MIRROR_UPDATE':
                     this.loggerInstance.info(`Visão: Atualização do Espelho Digital recebida para Task ${targetTaskId}`);
                     this.ioInstance.to(targetTaskId).emit('DIGITAL_MIRROR_UPDATE', payload);
                     break;
                case 'VISION_LOG':
                     this.loggerInstance.info(`Visão (PY): ${msgText || 'Log message'}`, payload || {});
                     break;
                case 'VISION_ERROR':
                     this.loggerInstance.error(`Visão (PY): ${msgText || 'Error message'}`, payload || {});
                      this.ioInstance.to(targetTaskId).emit('systemError', { taskId: targetTaskId, code: 'VISION_PYTHON_ERROR', message: msgText || 'Erro interno no serviço de visão.' });
                     break;
                 case 'PYTHON_READY':
                      this.loggerInstance.info(`Visão (PY): Processo Python pronto (PID: ${payload?.pid}).`);
                      this.ioInstance.emit('SYSTEM_STATUS_UPDATE', { service: 'vision', status: 'ready' });
                      break;
                 case 'PYTHON_EXITING':
                       this.loggerInstance.warn(`Visão (PY): Processo Python iniciando desligamento (PID: ${payload?.pid}).`);
                       break;
                default:
                     this.loggerInstance.warn(`Visão: Tipo de mensagem Python desconhecido recebido: ${type}`);
           }
     },

    handleProcessExit(originalTaskId, code, signal) {
        const pid = this.lastKnownPid;
        this.loggerInstance.warn(`Visão: Processo Python (PID: ${pid}) terminou com código ${code}, sinal ${signal}.`, { originalTaskId });
        this.processInstance = null;
        this.isStarting = false;

        if (this.ioInstance) { // Apenas emite se ioInstance estiver disponível
            if (code !== 0 && signal !== 'SIGTERM' && this.retries < this.maxRetries) {
                this.retries++;
                this.loggerInstance.warn(`Visão: Tentando reiniciar processo (Tentativa ${this.retries}/${this.maxRetries}) em ${this.retryDelay}ms...`);
                setTimeout(() => {
                    this.spawnVisionProcess(`vision_restart_${Date.now()}`);
                }, this.retryDelay);
            } else if (code !== 0 && signal !== 'SIGTERM') {
                this.loggerInstance.error(`Visão: Processo Python falhou após ${this.maxRetries} tentativas (ou não retryable). Não será reiniciado automaticamente.`);
                this.ioInstance.emit('systemError', { code: 'VISION_PROCESS_FAILED', message: 'Serviço de visão indisponível permanentemente.' });
            } else {
                 this.loggerInstance.info(`Visão: Processo Python (PID: ${pid}) encerrado normalmente.`);
            }
            this.ioInstance.emit('SYSTEM_STATUS_UPDATE', { service: 'vision', status: 'stopped', code, signal });
        } else {
            this.loggerInstance.warn("VisionService: ioInstance não configurado. Não é possível emitir status de saída do processo Python.");
        }
    },

    ensureVisionIsRunning() {
        if (!this.processInstance && !this.isStarting) {
            this.loggerInstance.info("Visão: Processo Python não está rodando. Iniciando...");
            this.spawnVisionProcess();
        } else {
            this.loggerInstance.debug("Visão: Processo Python já está rodando ou iniciando.");
        }
    },

     sendCommandToPython(command, payload = {}) {
         if (this.processInstance && this.processInstance.stdin && !this.processInstance.stdin.destroyed) {
              const message = JSON.stringify({ command, payload });
              try {
                  this.processInstance.stdin.write(message + '\n');
                  this.loggerInstance.debug(`Visão: Comando '${command}' enviado para Python.`);
                  return true;
              } catch (error) {
                   this.loggerInstance.error(`Visão: Erro ao enviar comando '${command}' para stdin do Python: ${error.message}`);
                   this.handleProcessExit('stdin_error', 1, null);
                   return false;
              }
         } else {
              this.loggerInstance.warn(`Visão: Tentativa de enviar comando '${command}', mas processo não está rodando ou stdin indisponível.`);
              this.ensureVisionIsRunning(); 
              return false;
         }
     },

     async captureScreenAndAnalyze(taskId, socketId) {
         this.loggerInstance.info(`Visão: Capturando tela para análise (Task: ${taskId}, Socket: ${socketId})`);
         MessageSystem.send(taskId, 'TASK_UPDATE', { taskId, status: 'ACTIVE', message: 'Capturando tela...' });

         try {
             const displays = await screenshot.listDisplays();
             const primaryDisplay = displays[0];
             if (!primaryDisplay) throw new Error("Nenhum display encontrado para captura.");

             const imgBuffer = await screenshot({ screen: primaryDisplay.id, format: 'png' });
             const timestamp = Date.now();
             const screenshotFilename = `screen_${taskId}_${timestamp}.png`;
             const screenshotPath = path.join(CONFIG.SCREENSHOT_DIR, screenshotFilename);

             await fs.mkdir(CONFIG.SCREENSHOT_DIR, { recursive: true });
             await fs.writeFile(screenshotPath, imgBuffer);
             this.loggerInstance.info(`Visão: Screenshot salvo em ${screenshotPath}`);

             const imageUrl = `/screenshots/${screenshotFilename}`; 
              MessageSystem.send(taskId, 'DIGITAL_MIRROR_UPDATE', { taskId, image: imageUrl, timestamp });
              MessageSystem.send(taskId, 'TASK_UPDATE', { taskId, status: 'ACTIVE', message: 'Enviando imagem para análise...' });
              const commandSent = this.sendCommandToPython('analyze_image', {
                  taskId: taskId,
                  socketId: socketId,
                  imagePath: screenshotPath, 
              });

              if (!commandSent) {
                   throw new Error("Falha ao enviar comando de análise para o processo Python.");
              }
         } catch (error) {
             this.loggerInstance.error(`Visão: Erro durante captura/análise de tela para Task ${taskId}:`, error);
              MessageSystem.send(taskId, 'TASK_ERROR', { taskId, errorMessage: `Erro na captura/análise: ${error.message}` });
              throw error; 
         }
     },

    stop() {
         if (this.processInstance) {
              this.loggerInstance.info("Visão: Enviando sinal de término para processo Python..."); // Changed logger to this.loggerInstance
              this.processInstance.kill('SIGTERM');
              const forceKillTimeout = setTimeout(() => {
                   if (this.processInstance) {
                        this.loggerInstance.warn(`Visão: Processo Python não terminou com SIGTERM, forçando (SIGKILL)...`); // Changed logger to this.loggerInstance
                        this.processInstance.kill('SIGKILL');
                        this.processInstance = null;
                   }
              }, 3000); 

               this.processInstance.on('close', () => {
                    clearTimeout(forceKillTimeout); 
                    this.processInstance = null;
               });
         }
    }
};

module.exports = VisionService;
