const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { CONFIG, logger } = require('../core/config');

const SpeechService = {
    config: CONFIG, // Usar o objeto importado

    async generateSpeech(text, taskId, voiceId = null) {
        if (!this.config.ELEVENLABS_API_KEY) {
            logger.warn("SpeechService: Chave API ElevenLabs não configurada.");
            throw new Error("Serviço de geração de fala não configurado.");
        }

        // Use voiceId if provided, otherwise use the one from the URL or fallback to the default in CONFIG
        let effectiveVoiceId = voiceId;
        if (!effectiveVoiceId) {
            const urlParts = this.config.ELEVENLABS_API_URL.split('/');
            const lastPart = urlParts[urlParts.length -1];
            // Check if the last part is a typical voice ID format (e.g., 21m00Tcm4TlvDq8ikWAM)
            if (lastPart && lastPart.length === 20 && /^[a-zA-Z0-9]+$/.test(lastPart)) {
                effectiveVoiceId = lastPart;
            } else {
                effectiveVoiceId = '21m00Tcm4TlvDq8ikWAM'; // Default fallback if not in URL and not provided
            }
        }
        
        const effectiveUrl = \`https://api.elevenlabs.io/v1/text-to-speech/\${effectiveVoiceId}\`;

        logger.info(\`SpeechService: Gerando áudio para Task \${taskId} usando voz \${effectiveVoiceId}\`);

        try {
            const response = await axios.post(effectiveUrl, {
                text: text,
                model_id: "eleven_multilingual_v2", 
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            }, {
                headers: {
                    'Accept': 'audio/mpeg',
                    'xi-api-key': this.config.ELEVENLABS_API_KEY,
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer', 
                timeout: this.config.taskTimeouts?.default || 30000 // Use default task timeout
            });
            
            // Path adjustment for generated media
            const audioDir = path.join(this.config.UPLOAD_DIR, '..', 'generated_media', 'audio');
            await fs.mkdir(audioDir, { recursive: true });
            const audioFileName = \`\${taskId}_\${Date.now()}.mp3\`;
            const audioPath = path.join(audioDir, audioFileName);
            await fs.writeFile(audioPath, response.data);

            // The URL should be relative to how static files are served.
            const audioUrl = \`/generated_media/audio/\${audioFileName}\`; 
            logger.info(\`SpeechService: Áudio gerado e salvo em \${audioPath}\`);
            return { audioUrl, text, audioPath }; // Return audioPath for local access if needed

        } catch (error) {
            const errorMsg = error.response?.data ? Buffer.from(error.response.data).toString() : error.message;
            logger.error(\`SpeechService: Erro ao gerar áudio para Task \${taskId} com voz \${effectiveVoiceId}: \${errorMsg}\`, error);
            throw new Error(\`Falha na geração de áudio (\${effectiveVoiceId}): \${errorMsg}\`);
        }
    },
    async recognizeAudio(filePath, taskId) {
         logger.warn("SpeechService: Reconhecimento de áudio não implementado nesta versão.");
         // Simula uma chamada que poderia falhar ou retornar um resultado padrão
         return Promise.resolve({ text: "[Reconhecimento de áudio não disponível]" });
    }
};

module.exports = SpeechService;
