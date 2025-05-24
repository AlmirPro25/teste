const robot = require('robotjs');
const os = require('os');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const { CONFIG, logger } = require('../core/config');

// Definição local de 'delay'
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Placeholder para io (Socket.IO instance)
// TODO: Injete ou importe a instância 'io' do Socket.IO aqui.
const io_placeholder = {
    sockets: { 
        sockets: { 
            get: (socketId) => ({ 
                emit: (event, data) => logger.debug(`io_placeholder.sockets.sockets.get('${socketId}').emit('${event}') called`, data)
            })
        }
    }
};

const AutomationSystem = {
    robot: robot, 
    io: io_placeholder, 
    pendingConfirmations: new Map(), 

    async executeAction(action, args = [], taskId, socketId) {
        logger.info(`Automation: Executando ação '${action}' com args: ${JSON.stringify(args)}`, { taskId });
         if (!CONFIG.allowedAutomationActions.includes(action)) {
             throw new Error(`Ação de automação não permitida: ${action}`);
         }

        if (CONFIG.criticalActionConfirmation && ['click', 'type', 'pressKey', 'runCommand', 'openFolder'].includes(action)) {
             try {
                 await this.confirmCriticalAction(action, args, taskId, socketId);
                 logger.info(`Automation: Ação '${action}' confirmada pelo usuário.`);
             } catch (error) {
                  logger.warn(`Automation: Ação '${action}' negada ou timeout.`, { taskId });
                  throw new Error(`Ação '${action}' não confirmada pelo usuário.`);
             }
        }
        try {
            let result = null;
             switch (action) {
                 case 'moveMouse':
                     this.robot.moveMouse(args[0], args[1]);
                     break;
                 case 'click':
                     this.robot.mouseClick(args[0] || 'left', args[1] || false); 
                     break;
                 case 'type':
                      await delay(100); 
                      this.robot.typeString(args[0]); // Changed to typeString for full string typing
                      if (args[1] && Array.isArray(args[1]) && args[1].length > 0) { // Modifier for keyTap after string
                        this.robot.keyTap(args[0].slice(-1), args[1]); // Example: apply modifier to last char if needed or rethink
                      } else if (args[0].toLowerCase() === 'enter') { // Specific handling for enter might be better
                         this.robot.keyTap('enter');
                         await delay(200);
                      }
                      break;
                case 'pressKey': // This case now handles multiple keys or single key with modifiers
                    if (Array.isArray(args[0])) { // Multiple keys sequentially
                        for (const key of args[0]) {
                             await delay(50); 
                             this.robot.keyTap(key, args[1] || []); 
                        }
                    } else { // Single key with optional modifiers
                         this.robot.keyTap(args[0], args[1] || []); 
                    }
                    break;
                 case 'openFolder':
                     if (os.platform() === 'win32') {
                          spawn('explorer', [args[0]], { detached: true }).unref();
                     } else if (os.platform() === 'darwin') {
                          spawn('open', [args[0]], { detached: true }).unref();
                     } else { 
                          spawn('xdg-open', [args[0]], { detached: true }).unref();
                     }
                     break;
                 case 'runCommand':
                      const commandParts = args[0].split(' ');
                      const cmd = commandParts[0];
                      const cmdArgs = commandParts.slice(1);
                      logger.warn(`Automation: Executando comando externo: ${cmd} ${cmdArgs.join(' ')}`);
                      spawn(cmd, cmdArgs, { detached: true, shell: true }).unref(); 
                     break;
                  case 'getMousePos':
                      result = this.robot.getMousePos(); 
                      break;
                  case 'getScreenSize':
                       result = this.robot.getScreenSize(); 
                       break;
                 default:
                     throw new Error(`Ação RobotJS não implementada: ${action}`);
             }
             logger.info(`Automation: Ação '${action}' executada com sucesso.`);
             return result !== null ? result : `Ação '${action}' executada com sucesso.`;
         } catch (error) {
             logger.error(`Automation: Erro executando ação '${action}':`, error);
             throw new Error(`Erro na automação: ${error.message}`);
         }
    },
     confirmCriticalAction(action, args, taskId, socketId) {
         return new Promise((resolve, reject) => {
             const targetSocket = this.io.sockets.sockets.get(socketId); 
             if (!targetSocket) {
                  logger.warn(`Automation: Não foi possível encontrar socket ${socketId} para confirmar ação ${action}. Rejeitando.`);
                  return reject(new Error("Usuário não conectado para confirmação."));
             }

             const callbackId = uuidv4();
             const actionDescription = `Ação: ${action}\nArgumentos: ${JSON.stringify(args)}\nTarefa: ${taskId}`;
             const timeoutDuration = CONFIG.taskTimeouts.automation || 30000;

             const timeoutId = setTimeout(() => {
                 if (this.pendingConfirmations.has(callbackId)) {
                     this.pendingConfirmations.get(callbackId).reject(new Error("Timeout de confirmação"));
                     this.pendingConfirmations.delete(callbackId);
                     logger.warn(`Automation: Timeout para confirmação da ação ${action} (ID: ${callbackId})`);
                 }
             }, timeoutDuration);

             this.pendingConfirmations.set(callbackId, { resolve, reject, timeoutId, socketId });

             logger.info(`Automation: Solicitando confirmação para ação '${action}' (Callback ID: ${callbackId})`, { taskId, socketId });
             targetSocket.emit('CONFIRM_ACTION', { action: actionDescription, callbackId });
         });
     },
     resolveConfirmation(callbackId, confirmed) {
         if (this.pendingConfirmations.has(callbackId)) {
             const confirmation = this.pendingConfirmations.get(callbackId);
             clearTimeout(confirmation.timeoutId);

             if (confirmed) {
                  logger.info(`Automation: Confirmação recebida (Aceita) para ${callbackId}`);
                 confirmation.resolve();
             } else {
                  logger.warn(`Automation: Confirmação recebida (Rejeitada) para ${callbackId}`);
                 confirmation.reject(new Error("Ação rejeitada pelo usuário."));
             }
             this.pendingConfirmations.delete(callbackId);
         } else {
              logger.warn(`Automation: Confirmação recebida para callbackId ${callbackId} não encontrado ou já resolvido.`);
         }
     }
};

module.exports = AutomationSystem;
