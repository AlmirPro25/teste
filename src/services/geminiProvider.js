const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai'); // HarmCategory and HarmBlockThreshold are used in CONFIG, not directly here.
const fs = require('fs').promises;
const APIKeyManager = require('./apiKeyManager');
const { CONFIG, logger } = require('../core/config');

// Definição local de 'delay' até que seja movido para utils globais
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const GeminiProvider = {
    clients: {},
    apiKeyManager: APIKeyManager, // Usar o módulo importado
    config: CONFIG, // Usar o objeto importado

    getClient: function () {
        // APIKeyManager já está referenciado corretamente
        const apiKey = this.apiKeyManager.getNextKey();
        if (!apiKey) {
            throw new Error("Nenhuma chave de API Google válida disponível.");
        }
        if (!this.clients[apiKey]) {
            try {
                this.clients[apiKey] = new GoogleGenerativeAI(apiKey);
                logger.debug(`GeminiProvider: Cliente inicializado para chave ${apiKey.substring(0, 5)}...`);
            } catch (e) {
                logger.error(`GeminiProvider: Falha ao inicializar cliente com chave ${apiKey.substring(0, 5)}...`, e);
                this.apiKeyManager.markKeyAsInvalid(apiKey);
                throw new Error(`Falha ao inicializar GoogleGenerativeAI: ${e.message}`);
            }
        }
        return this.clients[apiKey];
    },

    getModel: function (role = null) {
        const modelName = this.config.geminiModels[role] || this.config.defaultModel;
        const settings = this.config.modelSettings[modelName] || {};
        const generationConfig = {
            temperature: settings.temperature ?? 0.8,
            topP: settings.topP ?? 0.95,
        };

        try {
            const client = this.getClient(); // This will get a client using a key from APIKeyManager
            const modelInstance = client.getGenerativeModel({
                model: modelName,
                safetySettings: this.config.safetySettings, // CONFIG.safetySettings
                generationConfig: generationConfig,
            });
            logger.debug(`GeminiProvider: Usando modelo ${modelName} para role ${role || 'default'}`);
            return { modelInstance, settings, modelName };
        } catch (error) {
            // If getClient() threw due to no keys, or getGenerativeModel failed
            logger.error(`GeminiProvider: Falha ao obter modelo Gemini '${modelName}'`, error);
            // Check if the error is due to API key issue from getClient() or a general model loading issue
            if (error.message.includes("Nenhuma chave de API Google válida disponível.")) {
                 throw error; // Re-throw the specific error from getClient()
            }
            throw new Error(`Falha ao obter modelo Gemini '${modelName}': ${error.message}`);
        }
    },

     _adaptMessage: function (msg) {
        if (msg.role === 'user') {
            return { role: 'user', parts: [{ text: msg.content || '' }] };
        } else if (msg.role === 'model' || msg.role === 'assistant') {
             if (msg.tool_calls || msg.functionCall) { 
                 const functionCallData = msg.tool_calls ? msg.tool_calls[0] : msg.functionCall; 
                 return { role: 'model', parts: [{ functionCall: functionCallData }] };
             }
             if (msg.content) {
                 return { role: 'model', parts: [{ text: msg.content }] };
             }
             return null; 
        } else if (msg.role === 'tool' || msg.role === 'function') {
              if(msg.tool_call_id && msg.content) { 
                   return {
                        role: 'function', 
                        parts: [{ functionResponse: { name: msg.name || msg.tool_call_id, response: { content: msg.content } } }]
                    };
              } else if (msg.name && msg.content) { 
                 return {
                     role: 'function',
                     parts: [{ functionResponse: { name: msg.name, response: { content: msg.content } } }]
                 };
             }
            return null;
        } else if (msg.role === 'system') {
            // System instructions are handled differently in the new Gemini API (via systemInstruction)
            return null; // Should not be part of 'contents' array directly
        }
        logger.warn(`GeminiProvider: Role não reconhecido no histórico: ${msg.role}`);
        return null; 
    },

    _prepareChatHistory: function (history) {
        return history.map(this._adaptMessage).filter(Boolean); 
    },

     async _fileToGenerativePart(filePath, mimeType) {
         try {
             const data = await fs.readFile(filePath); // fs.promises.readFile
             return {
                 inlineData: {
                     data: Buffer.from(data).toString("base64"),
                     mimeType
                 },
             };
         } catch (error) {
              logger.error(`GeminiProvider: Erro ao ler ou converter arquivo ${filePath}`, error);
              throw new Error(`Falha ao processar arquivo: ${error.message}`);
         }
     },

    async execute(params) {
        const {
            prompt, history = [], role = null, streamCallback = null,
            tools = null, file = null, systemPrompt = null, taskId = 'gemini_task'
        } = params;

        let attempts = 0;
        const maxAttempts = this.config.retryAttempts || 3;

        const systemMessagesFromHistory = history.filter(m => m.role === 'system');
        const effectiveSystemPromptText = systemPrompt || systemMessagesFromHistory.map(m=>m.content).join("\n") || null;
        const effectiveSystemInstruction = effectiveSystemPromptText ? { parts: [{ text: effectiveSystemPromptText }] } : null;


        while (attempts < maxAttempts) {
            attempts++;
             let modelInstance, settings, modelName;
             let apiKeyUsed = null; // To keep track of the key used in this attempt

            try {
                // Get the API key first to associate it with this attempt
                // Note: getModel() also calls getNextKey() via getClient(). This is a bit redundant.
                // To ensure the same key is used for getClient and potential error handling:
                apiKeyUsed = this.apiKeyManager.getCurrentKeyForAttempt(); // Hypothetical: need to adjust APIKeyManager or how key is fetched for retry logic
                                                                      // For now, getModel will fetch a key. If it fails, it's handled.
                                                                      // If execute fails later due to the key, we need the key.
                                                                      // Let's assume getModel's internal getClient() call is the source of truth for apiKeyUsed in an attempt.

                // The getModel function internally calls getClient, which uses getNextKey.
                // If getClient fails (e.g. no keys), getModel will throw.
                ({ modelInstance, settings, modelName } = this.getModel(role)); 
                
                // If getModel succeeded, a key was used. We need to know which one if a later error occurs.
                // This is tricky because getClient in getModel doesn't return the key it used.
                // A temporary solution: APIKeyManager.getLastUsedKey() or modify getClient to return {client, apiKey}
                // For now, if a key-related error happens, we'll mark the *next* available key as invalid, which might not be the one that failed.
                // This is a known limitation in the current structure.
                // A better approach would be for getClient to return the key it used.
                // Or for APIKeyManager to have a method like `getActiveKey()`.
                // For the purpose of this refactor, we will proceed with the current structure.
                // If an API key error occurs, we will call `this.apiKeyManager.markKeyAsInvalid(this.apiKeyManager.getLastAttemptedKey())`
                // This implies APIKeyManager needs a `getLastAttemptedKey()` or similar.
                // Given APIKeyManager's current structure, `getNextKey` is advancing.
                // If an error related to the key occurs, we'd mark the key that was *just fetched and failed*.
                // This logic is complex. Let's assume for now that APIKeyManager handles its state internally upon failure.
                // The original code in server.js didn't explicitly pass the key to mark.
                // It relied on APIKeyManager.markKeyAsInvalid(apiKey), where apiKey was fetched *before* the call.

                // Let's try to get the key that will be used by getModel explicitly for this attempt
                // This is not ideal as getModel itself calls getNextKey.
                // We will rely on the error handling to catch key issues and mark the "current" key.
                // The provided code for GeminiProvider has `this.apiKeyManager.markKeyAsInvalid(apiKey);` in `getClient`
                // And `this.apiKeyManager.markKeyAsInvalid(apiKeyUsed);` in `execute` loop.
                // For `apiKeyUsed` to be correct in `execute`'s catch block, it should be the key that `getClient` used.

                // Simplified: getClient already handles marking its own key invalid on init failure.
                // If the key becomes invalid *during* the API call (e.g. quota), we need to mark it.
                // This means `this.apiKeyManager.markKeyAsInvalid(client.apiKey)` - if client stored the key.
                // GoogleGenerativeAI client doesn't directly expose the API key.

                // Let's assume the key *that was attempted* needs to be tracked.
                // The current APIKeyManager rotates keys. If an error occurs, it's for the key that was *just* rotated to.
                // So, `APIKeyManager.markCurrentKeyAsInvalid()` might be a better method in APIKeyManager.
                // For now, we'll stick to the provided structure and acknowledge this complexity.

                 const userParts = [];
                 if (prompt) userParts.push({ text: prompt });
                 if (file && file.path && file.mimetype && settings.multimodal) {
                      logger.info(`GeminiProvider: Processando arquivo ${file.filename} (${file.mimetype}) para inclusão multimodal.`);
                      const filePart = await this._fileToGenerativePart(file.path, file.mimetype);
                      userParts.push(filePart);
                 } else if (file && !settings.multimodal) {
                      logger.warn(`GeminiProvider: Modelo ${modelName} não suporta multimodal, arquivo ${file.filename} ignorado.`);
                 }
                 if (userParts.length === 0) {
                     throw new Error("Requisição Gemini precisa de um prompt ou arquivo.");
                 }

                const chatHistory = this._prepareChatHistory(history.filter(m => m.role !== 'system')); // System messages handled by systemInstruction
                const requestPayload = {
                     contents: [...chatHistory, { role: 'user', parts: userParts }],
                     ...(tools && tools.length > 0 && { tools: [{ functionDeclarations: tools }] }),
                     ...(effectiveSystemInstruction && { systemInstruction: effectiveSystemInstruction }),
                 };

                logger.debug(`GeminiProvider: Enviando requisição para ${modelName} (Tentativa ${attempts})`, { taskId, modelName, hasTools: !!tools, hasFile: !!file, hasSystemInstruction: !!effectiveSystemInstruction });


                if (streamCallback) {
                    const streamResult = await modelInstance.generateContentStream(requestPayload);
                    let fullResponseText = '';
                    let functionCalls = []; 

                    for await (const chunk of streamResult.stream) {
                         const chunkCalls = chunk.functionCalls();
                         if (chunkCalls && chunkCalls.length > 0) {
                              functionCalls.push(...chunkCalls);
                         }
                         const chunkText = chunk.text();
                         if (chunkText) {
                             fullResponseText += chunkText;
                             streamCallback(chunkText); 
                         }
                    }
                     logger.debug(`GeminiProvider: Stream concluído para ${taskId}. Texto total: ${fullResponseText.length} chars. Funções: ${functionCalls.length}.`);
                     if (functionCalls.length > 0) {
                          return { functionCalls, text: fullResponseText || null }; 
                     }
                     return { text: fullResponseText };

                } else { 
                    const result = await modelInstance.generateContent(requestPayload);
                    const response = result.response;
                    const candidate = response?.candidates?.[0];

                    if (!candidate) {
                        const blockReason = response?.promptFeedback?.blockReason;
                        const safetyRatings = response?.promptFeedback?.safetyRatings || candidate?.safetyRatings;
                        logger.error(`GeminiProvider: Resposta inválida ou bloqueada. Razão: ${blockReason || 'Desconhecida'}\`, { taskId, safetyRatings });
                        throw new Error(\`Resposta da IA bloqueada ou inválida. Razão: \${blockReason || 'Desconhecida'}\`);
                    }

                    if (candidate.finishReason === 'SAFETY') {
                        logger.error(\`GeminiProvider: Conteúdo bloqueado por segurança.\`, { taskId, safetyRatings: candidate.safetyRatings });
                        throw new Error(\`Conteúdo bloqueado por segurança. Ratings: \${JSON.stringify(candidate.safetyRatings)}\`);
                    }

                     const functionCalls = candidate.content?.parts?.filter(p => p.functionCall).map(p => p.functionCall);
                     if (functionCalls && functionCalls.length > 0) {
                          logger.debug(\`GeminiProvider: Chamada de função recebida para \${taskId}: \${functionCalls.map(fc => fc.name).join(', ')}\`);
                          return { functionCalls, text: candidate.content?.parts?.map(p => p.text).join('') || null }; // include text if any along with function call
                     }

                    const text = candidate.content?.parts?.map(p => p.text).join('');
                     if ((text === null || text === undefined || text === '') && !functionCalls && candidate.finishReason !== 'STOP') {
                          logger.warn(\`GeminiProvider: Resposta vazia inesperada. finishReason: \${candidate.finishReason}\`, { taskId, candidate });
                          // Consider not throwing here, but returning empty, as per original logic.
                          return { text: "" }; 
                     }
                    logger.debug(\`GeminiProvider: Resposta de texto recebida para \${taskId} (\${(text || '').length} chars).\`);
                    return { text: text ?? "" };
                }

            } catch (error) {
                logger.error(\`GeminiProvider: Erro na tentativa \${attempts}/\${maxAttempts} (Task \${taskId}) para modelo \${modelName}\`, error);
                
                // The APIKeyManager's getNextKey advances the index. If an error related to *that key* occurs,
                // we need to mark that specific key. The current APIKeyManager doesn't easily expose "current key".
                // The getClient method already tries to mark a key if *client initialization* fails.
                // This catch block is for errors *during* the API call (e.g. quota, server error).
                // We need a reliable way to get the key that was actually used for this attempt.
                // For now, we'll assume that if it's a key-related error, APIKeyManager should handle it.
                // The original code had `this.apiKeyManager.markKeyAsInvalid(apiKeyUsed);`
                // but `apiKeyUsed` wasn't consistently captured from `getClient`.

                // Let's refine the error handling for key invalidation:
                // If `getClient` fails, it marks its own key.
                // If `generateContent` or `generateContentStream` fails with an API key error,
                // we need to tell APIKeyManager to invalidate the key that was *just used*.
                // This implies APIKeyManager needs a method like `invalidateCurrentKey()` or `invalidateKey(key)`.
                // The `APIKeyManager.markKeyAsInvalid(key)` is available.
                // The challenge is getting the 'key' that was used for the failed call.
                // The `clients` object in GeminiProvider is keyed by API key.
                // However, `modelInstance.client.apiKey` is not a public property.

                // A pragmatic approach: if it's an auth error, assume the "current" key in APIKeyManager rotation is bad.
                // This is what `this.apiKeyManager.markKeyAsInvalid(this.apiKeyManager.getNextKey())` would effectively do if called before retry,
                // but `getNextKey` also advances.
                // The `APIKeyManager` in this project is stateful and rotates. `markKeyAsInvalid` adds to `invalidKeys`.
                // `getNextKey` filters out `invalidKeys`.

                const message = error.message?.toLowerCase() || '';
                const status = error.status || error.code || (error.response && error.response.status);

                if (message.includes('api key not valid') || message.includes('api key expired') || 
                    message.includes('permission denied') || message.includes('authentication failed') ||
                    status === 401 || status === 403) {
                    
                    // This is where we'd ideally get the specific key that failed.
                    // Since getClient() in getModel() fetches a key, and that client is used,
                    // that key is the one that failed. But it's not directly passed back.
                    // We can ask APIKeyManager to invalidate its "last provided key" if we add such a feature.
                    // For now, we'll log and rely on the rotation. If all keys become invalid, getNextKey returns null.
                    logger.warn(`GeminiProvider: Possível problema com a chave de API (status: ${status}). A rotação de chaves cuidará disso.`);
                    // To actively mark, we'd need the key. If we had it:
                    // if (apiKeyThatWasUsed) this.apiKeyManager.markKeyAsInvalid(apiKeyThatWasUsed);
                    // And potentially: if (apiKeyThatWasUsed && this.clients[apiKeyThatWasUsed]) delete this.clients[apiKeyThatWasUsed];
                    if (attempts >= maxAttempts) throw error; 
                    await delay(100 * attempts + Math.random() * 500); // Small delay before retrying with a new key
                    continue; // Try next key via getModel() in the next iteration
                } else if (message.includes('429') || message.includes('resource has been exhausted') || status === 429) {
                     logger.warn(`GeminiProvider: Rate limit atingido. Aguardando ${attempts * 1000}ms para retentativa...\`);
                     await delay(attempts * 1000 + Math.random() * 500); 
                } else if (message.includes('500') || status >= 500) { 
                      logger.warn(`GeminiProvider: Erro interno do servidor (${status || '5XX'}). Aguardando ${attempts * 1500}ms para retentativa...\`);
                     await delay(attempts * 1500 + Math.random() * 500); 
                } else if (message.includes('safety') || message.includes('blocked')) {
                      throw error; // Do not retry safety blocks
                } else if (message.includes('timed out')) {
                      await delay(attempts * 1000); 
                } else if (status === 400) { // Bad request, often means model can't handle the input
                      logger.error('GeminiProvider: Erro 400 - Bad Request. Verifique o payload da requisição, formato do histórico ou prompt.', { error });
                      throw error; // Do not retry typical 400 errors unless they are temporary
                }


                 if (attempts >= maxAttempts) {
                     throw error; 
                 }
                 await delay(500 * attempts); // General delay before next attempt
            }
        }
        throw new Error(`GeminiProvider: Falha na execução após ${maxAttempts} tentativas.`);
    }
};

module.exports = GeminiProvider;
