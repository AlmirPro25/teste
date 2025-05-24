const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { CONFIG, logger } = require('../core/config');
const MessageSystem = require('./messageSystem'); 
const SpeechService = require('./speechService'); 

const MediaGenerationSystem = {
    config: CONFIG, 
    speechService: SpeechService, 

    async generateImage(prompt, taskId, socket) { // socket is passed as a parameter
        if (!this.config.STABILITY_API_KEY) {
             logger.warn("MediaGeneration: Stability API Key não configurada.");
             if(socket) socket.emit('error_response', { taskId, message: 'Serviço de geração de imagem (Stability) não configurado.' });
             throw new Error('Serviço de geração de imagem (Stability) não configurado.');
        }
        logger.info(\`MediaGeneration: Gerando imagem para Task \${taskId} com prompt: "\${prompt.substring(0, 50)}..."\`);
        
        if(socket && MessageSystem && MessageSystem.logAndSend) { 
            MessageSystem.logAndSend(taskId, 'MediaGenerationSystem', \`🎨 Iniciando geração de imagem para: "\${prompt}"...\`);
        } else if (socket) {
            // Fallback if MessageSystem or logAndSend is not available (though it should be)
            socket.emit('TASK_UPDATE', {taskId, message: \`🎨 Iniciando geração de imagem para: "\${prompt}"...\`});
        }

        try {
            const response = await axios.post(this.config.STABILITY_API_URL, {
                text_prompts: [{ text: prompt }],
                cfg_scale: 7,
                height: 1024,
                width: 1024,
                steps: 30, 
                samples: 1,
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': \`Bearer \${this.config.STABILITY_API_KEY}\`
                },
                timeout: (this.config.taskTimeouts && this.config.taskTimeouts.multimodal) || 120000 
            });

            if (response.data && response.data.artifacts && response.data.artifacts.length > 0) {
                const artifact = response.data.artifacts[0];
                if (artifact.finishReason === 'SUCCESS') {
                    const base64Data = artifact.base64;
                    // Path adjustment using UPLOAD_DIR as base for generated_media, consistent with SpeechService
                    const imageDir = path.join(this.config.UPLOAD_DIR, '..', 'generated_media', 'images'); 
                    await fs.mkdir(imageDir, { recursive: true });
                    const imageFileName = \`\${taskId}_\${Date.now()}.png\`;
                    const imagePath = path.join(imageDir, imageFileName);
                    await fs.writeFile(imagePath, base64Data, { encoding: 'base64' });

                    const imageUrl = \`/generated_media/images/\${imageFileName}\`;
                    logger.info(\`MediaGeneration: Imagem gerada e salva em \${imagePath}\`);
                     if(socket && MessageSystem && MessageSystem.send) {
                         MessageSystem.send(taskId, 'IMAGE_GENERATED', { taskId, prompt, image: imageUrl });
                     } else if (socket) {
                         socket.emit('IMAGE_GENERATED', { taskId, prompt, image: imageUrl });
                     }
                     return { imageUrl, prompt, imagePath }; // Added imagePath for local access
                } else {
                     logger.error(\`MediaGeneration: Falha na geração da imagem (Stability API). Razão: \${artifact.finishReason}\`, { taskId, artifact });
                     throw new Error(\`Falha na geração da imagem (Stability API). Razão: \${artifact.finishReason}\`);
                }
            } else {
                logger.error('MediaGeneration: Resposta inválida da API Stability AI.', { taskId, responseData: response.data });
                throw new Error('Resposta inválida da API Stability AI.');
            }
        } catch (error) {
            const errorMsg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
            logger.error(\`MediaGeneration: Erro ao gerar imagem para Task \${taskId}: \${errorMsg}\`, error);
             if(socket && MessageSystem && MessageSystem.logAndSend) {
                 MessageSystem.logAndSend(taskId, 'MediaGenerationSystem', \`❌ Erro ao gerar imagem: \${error.message}\`, 'TASK_ERROR');
             } else if (socket) {
                 socket.emit('TASK_ERROR', {taskId, message: \`❌ Erro ao gerar imagem: \${error.message}\`});
             }
             throw error; 
        }
    },

    async generateAudio(text, taskId, socket, voiceId = null) { // socket passed, voiceId added
         logger.info(\`MediaGeneration: Solicitando geração de áudio para Task \${taskId}\`);
         if(socket && MessageSystem && MessageSystem.logAndSend) {
            MessageSystem.logAndSend(taskId, 'MediaGenerationSystem', \`🗣️ Iniciando geração de áudio para: "\${text.substring(0,50)}..."\`);
         } else if (socket) {
            socket.emit('TASK_UPDATE', {taskId, message: \`🗣️ Iniciando geração de áudio para: "\${text.substring(0,50)}..."\`});
         }
         try {
              // Pass voiceId to speechService
              const result = await this.speechService.generateSpeech(text, taskId, voiceId); 
              if(socket && MessageSystem && MessageSystem.send) {
                  MessageSystem.send(taskId, 'SPEECH_GENERATED', { taskId, ...result }); 
              } else if (socket) {
                  socket.emit('SPEECH_GENERATED', { taskId, ...result });
              }
              return result;
         } catch(error) {
              logger.error(\`MediaGeneration: Erro ao gerar áudio via SpeechService para Task \${taskId}: \${error.message}\`, error);
              if(socket && MessageSystem && MessageSystem.logAndSend) {
                  MessageSystem.logAndSend(taskId, 'MediaGenerationSystem', \`❌ Erro ao gerar áudio: \${error.message}\`, 'TASK_ERROR');
              } else if (socket) {
                  socket.emit('TASK_ERROR', {taskId, message: \`❌ Erro ao gerar áudio: \${error.message}\`});
              }
              throw error;
         }
    }
};

module.exports = MediaGenerationSystem;
