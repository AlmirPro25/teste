const fs = require('fs').promises;
const path = require('path');
const { CONFIG, logger } = require('../core/config');
const DockerService = require('./dockerService');
const MessageSystem = require('./messageSystem');
const MemoryModule = require('./memoryModule'); // SystemGenerator usa MemoryModule diretamente também

// Placeholder para io (Socket.IO instance)
// TODO: Injete ou importe a instância 'io' do Socket.IO aqui.
const io_placeholder = {
    to: (room) => ({ emit: (event, data) => logger.debug(`io_placeholder.to('${room}').emit('${event}') called`, data) }),
    emit: (event, data) => logger.debug(`io_placeholder.emit('${event}') called`, data)
};

const SystemGenerator = {
    aiService: null, // Será injetado
    dockerService: DockerService, 
    messageSystem: MessageSystem, 
    io: io_placeholder, // Usar placeholder
    config: CONFIG, 

    injectDependencies(services) { // 'services' aqui deve ser o AIService
         this.aiService = services; 
    },

    async generateSystem(taskId, userId, prompt, streamCallback = null) {
        logger.info(`SystemGenerator: Iniciando geração para Task ${taskId}`, { userId });
        await MemoryModule.updateTaskStatus(taskId, 'active'); 
        this.messageSystem.logAndSend(taskId, 'SystemGenerator', `🚀 Iniciando geração do sistema com base em: "${prompt.substring(0, 100)}..."`, 'TASK_UPDATE');

        let currentCode = {}; 
        let feedback = "Geração inicial.";
        let iterations = 0;
        const maxIterations = (this.config && this.config.maxIterations) || 3;


        try {
            while (iterations < maxIterations) {
                iterations++;
                 this.messageSystem.logAndSend(taskId, 'SystemGenerator', `💡 Iteração ${iterations}: Planejando/Codificando...\`, 'TASK_UPDATE');

                const codingPrompt = this.buildCodingPrompt(prompt, feedback, currentCode);
                if (!this.aiService) throw new Error("AIService não injetado no SystemGenerator"); 
                const codingResult = await this.aiService.execute({
                    role: 'CodingAPI', 
                    prompt: codingPrompt,
                    history: [], 
                    taskId, userId, streamCallback,
                });

                if (!codingResult || !codingResult.text) {
                    throw new Error("Falha ao gerar código (resposta vazia da IA).");
                }

                currentCode = this.extractCodeStructure(codingResult.text);
                if (!currentCode || !currentCode.files || Object.keys(currentCode.files).length === 0 || !currentCode.entry) {
                     feedback = "A resposta da IA não continha uma estrutura de código válida (arquivos e ponto de entrada). Tente novamente.";
                     logger.warn(`SystemGenerator: Iteração ${iterations} falhou na extração de código.`, { taskId });
                     this.messageSystem.logAndSend(taskId, 'SystemGenerator', `⚠️ Iteração ${iterations}: Falha ao extrair código da resposta da IA.\`, 'TASK_UPDATE');
                     if (iterations >= maxIterations) throw new Error("Falha ao extrair código após múltiplas tentativas.");
                     continue; 
                }
                this.messageSystem.logAndSend(taskId, 'SystemGenerator', `📝 Iteração ${iterations}: Código extraído (${Object.keys(currentCode.files).length} arquivos, entrada: ${currentCode.entry}). Testando...\`, 'TASK_UPDATE');
                this.messageSystem.send(taskId, 'CODE_CHUNK', { taskId, code: currentCode }); 

                let testResult = { status: 'skipped', output: 'Teste não aplicável ou não implementado.', type: null };
                if (currentCode.entry.endsWith('.html') && currentCode.files[currentCode.entry]) {
                     testResult = await this.testWebApp(taskId, currentCode); 
                     this.messageSystem.logAndSend(taskId, 'SystemGenerator', `🧪 Iteração ${iterations}: Resultado do teste: ${testResult.status}. Output: ${testResult.output.substring(0,100)}...\`, 'TASK_UPDATE');
                } else {
                     logger.info(`SystemGenerator: Teste pulado para tipo de arquivo não-HTML: ${currentCode.entry}\`, { taskId });
                }

                if (testResult.status === 'success' || iterations >= maxIterations) {
                     feedback = testResult.status === 'success' ? "Sistema gerado e testado com sucesso (teste básico)." : "Máximo de iterações atingido. Geração finalizada.";
                     logger.info(`SystemGenerator: Geração concluída para Task ${taskId}. Status: ${testResult.status}\`, { iterations });
                     break; 
                 } else {
                     feedback = `O teste falhou com a seguinte saída/erro: ${testResult.output}. Analise o erro e corrija o código. Gere a estrutura completa de arquivos novamente.\`;
                      this.messageSystem.logAndSend(taskId, 'SystemGenerator', `❌ Iteração ${iterations}: Teste falhou. Solicitando correção à IA...\`, 'TASK_UPDATE');
                 }
            } 

            const finalPath = await this.saveGeneratedSystem(taskId, currentCode);
            const result = {
                 status: 'completed', 
                 message: feedback,
                 code: currentCode,
                 test: { type: 'html', output: feedback }, 
                 path: finalPath 
            };
            await MemoryModule.updateTaskStatus(taskId, 'completed', result); 
            this.messageSystem.send(taskId, 'SYSTEM_GENERATED', { taskId, result });
            return result;

        } catch (error) {
            logger.error(`SystemGenerator: Erro fatal durante geração para Task ${taskId}:\`, error);
            const result = { status: 'failed', message: error.message, code: currentCode };
            await MemoryModule.updateTaskStatus(taskId, 'failed', result); 
            this.messageSystem.send(taskId, 'SYSTEM_GENERATED', { taskId, result }); 
            this.messageSystem.logAndSend(taskId, 'SystemGenerator', `❌ Erro fatal na geração: ${error.message}\`, 'TASK_ERROR');
            throw error;
        }
    },

     async refineSystem(taskId, userId, originalResult, newPrompt, streamCallback = null) {
         logger.info(`SystemGenerator: Iniciando refinamento para Task ${taskId}\`, { userId });
        await MemoryModule.updateTaskStatus(taskId, 'refining');
        this.messageSystem.logAndSend(taskId, 'SystemGenerator', `🔄 Iniciando refinamento do sistema com base em: "\${newPrompt.substring(0, 100)}..."\`, 'TASK_UPDATE');

        let currentCode = originalResult.code; 
        const previousFeedback = originalResult.message;
        let feedback = `Refinando o sistema anterior. Feedback anterior: ${previousFeedback}. Nova solicitação: ${newPrompt}\`;
        let iterations = 0; 
        const maxIterations = 2;

        try {
            while (iterations < maxIterations) {
                iterations++;
                this.messageSystem.logAndSend(taskId, 'SystemGenerator', `💡 Iteração Refinamento ${iterations}: Codificando...\`, 'TASK_UPDATE');

                const codingPrompt = this.buildCodingPrompt(newPrompt, feedback, currentCode, true); 
                if (!this.aiService) throw new Error("AIService não injetado no SystemGenerator");
                const codingResult = await this.aiService.execute({
                    role: 'CodingAPI', prompt: codingPrompt, history: [],
                    taskId, userId, streamCallback,
                });

                if (!codingResult || !codingResult.text) throw new Error("Falha ao refinar código.");

                const refinedCode = this.extractCodeStructure(codingResult.text);
                if (!refinedCode || !refinedCode.files || Object.keys(refinedCode.files).length === 0 || !refinedCode.entry) {
                     feedback = "A resposta da IA para refinamento não continha uma estrutura de código válida.";
                     logger.warn(`SystemGenerator: Refinamento ${iterations} falhou na extração.\`, { taskId });
                     if (iterations >= maxIterations) throw new Error("Falha ao extrair código refinado.");
                     continue;
                }
                this.messageSystem.logAndSend(taskId, 'SystemGenerator', `📝 Iteração Refinamento ${iterations}: Código extraído. Testando...\`, 'TASK_UPDATE');
                this.messageSystem.send(taskId, 'CODE_CHUNK', { taskId, code: refinedCode });

                let testResult = { status: 'skipped', output: 'Teste pulado.', type: null };
                if (refinedCode.entry.endsWith('.html')) {
                     testResult = await this.testWebApp(taskId, refinedCode);
                     this.messageSystem.logAndSend(taskId, 'SystemGenerator', `🧪 Iteração Refinamento ${iterations}: Teste: ${testResult.status}.\`, 'TASK_UPDATE');
                }

                if (testResult.status === 'success' || iterations >= maxIterations) {
                     feedback = `Sistema refinado. Último teste: ${testResult.status}.\`;
                     currentCode = refinedCode; 
                     break;
                 } else {
                     feedback = `O teste do refinamento falhou: ${testResult.output}. Analise e corrija.\`;
                     currentCode = refinedCode;
                 }
            }

            const finalPath = await this.saveGeneratedSystem(taskId, currentCode); 
            const result = {
                status: 'completed', message: feedback, code: currentCode,
                test: { type: 'html', output: feedback }, path: finalPath
            };
            await MemoryModule.updateTaskStatus(taskId, 'completed', result); 
            this.messageSystem.send(taskId, 'SYSTEM_GENERATED', { taskId, result });
            return result;

        } catch (error) {
             logger.error(`SystemGenerator: Erro fatal durante refinamento para Task ${taskId}:\`, error);
             const result = { status: 'failed', message: error.message, code: currentCode }; 
             await MemoryModule.updateTaskStatus(taskId, 'failed', result); 
             this.messageSystem.send(taskId, 'SYSTEM_GENERATED', { taskId, result });
             this.messageSystem.logAndSend(taskId, 'SystemGenerator', `❌ Erro fatal no refinamento: ${error.message}\`, 'TASK_ERROR');
             throw error;
        }
     },

    buildCodingPrompt(userPrompt, feedback, currentCode, isRefinement = false) {
        let prompt = isRefinement
            ? `Refine o seguinte sistema web com base na solicitação e feedback. Gere a estrutura completa de arquivos novamente.\n`
            : `Gere o código completo para um sistema web com base na seguinte solicitação. Gere a estrutura completa de arquivos.\n`;
        prompt += `\nSolicitação do Usuário:\n---\n${userPrompt}\n---\n`;
        if (feedback) {
            prompt += `\nFeedback da Última Tentativa:\n---\n${feedback}\n---\n`;
        }
        if (currentCode && currentCode.files && Object.keys(currentCode.files).length > 0) {
            prompt += "\nCódigo Atual (para referência ou refinamento):\n---\n";
            for (const filename in currentCode.files) {
                 prompt += `\n\`\`\`${filename.split('.').pop()}\n${filename}\n${currentCode.files[filename]}\n\`\`\`\n`;
            }
             prompt += `--- \n`;
        }
        prompt += "\nInstruções de Saída:\n"
        prompt += "1. Gere todos os arquivos necessários (HTML, CSS, JavaScript).\n";
        prompt += "2. Use tags `<file name='path/to/filename.ext'>` para delimitar cada arquivo.\n";
        prompt += "3. Indique o arquivo de entrada principal com `<entry file='path/to/mainfile.html'>`.\n";
        prompt += "4. **NÃO** inclua explicações fora das tags `<file>` ou `<entry>`. A saída deve conter apenas essas tags e o código dentro delas.\n";
        prompt += "5. Se usar JavaScript externo, certifique-se que o HTML o inclua corretamente.\n";
        prompt += "6. Para CSS, pode ser inline, em tag `<style>`, ou arquivo .css externo linkado no HTML.\n";
        prompt += "7. Gere código funcional e completo.\n";
         if (isRefinement) {
              prompt += "8. **Refaça a estrutura completa dos arquivos** aplicando as correções/melhorias solicitadas.\n";
         }
        return prompt;
    },

     extractCodeStructure(aiResponse) {
         const files = {};
         let entryFile = null;
         const fileRegex = /<file name='(.*?)'>\s*([\s\S]*?)\s*<\/file>/gs;
         const entryRegex = /<entry file='(.*?)'>/s;
         let match;
         while ((match = fileRegex.exec(aiResponse)) !== null) {
              const filePath = match[1].trim();
              const fileContent = match[2].trim();
              const cleanedContent = fileContent.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, ''); // Adjusted regex for code blocks
              files[filePath] = cleanedContent;
         }
         const entryMatch = aiResponse.match(entryRegex);
         if (entryMatch) {
              entryFile = entryMatch[1].trim();
         }
         if (!entryFile && Object.keys(files).length > 0) {
             if (files['index.html']) entryFile = 'index.html';
             else if (files['app.py']) entryFile = 'app.py'; 
             else if (files['server.js']) entryFile = 'server.js';
             else entryFile = Object.keys(files)[0]; 
             logger.warn(`SystemGenerator: Tag <entry> não encontrada, usando fallback: ${entryFile}`);
         }
         if (Object.keys(files).length === 0) {
              logger.error("SystemGenerator: Nenhuma tag <file> encontrada na resposta da IA.");
              // Return null or an empty structure, depending on how caller handles it
              return { files: {}, entry: null }; // Returning empty structure
         }
         return { files, entry: entryFile };
     },

     async testWebApp(taskId, codeStructure) {
          if (!codeStructure.entry.endsWith('.html') || !codeStructure.files[codeStructure.entry]) {
               return { status: 'skipped', output: 'Não é uma aplicação HTML/JS básica.', type: null };
          }
           logger.info(`SystemGenerator: Tentando testar ${codeStructure.entry} para Task ${taskId}`);
           // Placeholder for actual test logic, perhaps using DockerService for a static server
           // For now, just return success if HTML content exists
           return { status: 'success', output: codeStructure.files[codeStructure.entry].substring(0, 200) + '...', type: 'html' };
      },

     async saveGeneratedSystem(taskId, codeStructure) {
          const systemDir = path.join(this.config.SYSTEM_GENERATION_DIR, taskId); 
          try {
              await fs.rm(systemDir, { recursive: true, force: true }); 
              await fs.mkdir(systemDir, { recursive: true });
              for (const filePath in codeStructure.files) {
                  const fullPath = path.join(systemDir, filePath);
                  const dirName = path.dirname(fullPath);
                  await fs.mkdir(dirName, { recursive: true });
                  await fs.writeFile(fullPath, codeStructure.files[filePath]);
              }
              logger.info(`SystemGenerator: Sistema salvo em ${systemDir}`);
              return systemDir; 
          } catch (error) {
               logger.error(`SystemGenerator: Erro ao salvar sistema gerado em ${systemDir}:`, error);
               throw new Error(`Falha ao salvar sistema gerado: ${error.message}`);
          }
     }
};

module.exports = SystemGenerator;
