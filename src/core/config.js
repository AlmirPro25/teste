require('dotenv').config();
const path = require('path');
const os = require('os');
const util = require('util');
const { HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

const CONFIG = {
    PORT: process.env.PORT || 6000,
    JWT_SECRET: process.env.JWT_SECRET || '!!!DEFINE_UM_SEGREDO_JWT_FORTE_NO_.ENV!!!',
    GOOGLE_API_KEYS: process.env.GOOGLE_API_KEYS ? process.env.GOOGLE_API_KEYS.split(',').map(key => key ? key.trim() : null).filter(Boolean) : [],
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || null, // Fallback single key
    IMAGE_GEN_API_KEY: process.env.IMAGE_GEN_API_KEY || null, // Generic key if needed
    IMAGE_GEN_API_URL: process.env.IMAGE_GEN_API_URL || null, // Generic URL if needed
    STABILITY_API_KEY: process.env.STABILITY_API_KEY || null,
    STABILITY_API_URL: 'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || null,
    ELEVENLABS_API_URL: process.env.ELEVENLABS_API_URL || 'https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', // Example Voice ID, make configurable
    REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
    REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
    REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,
    DOCKER_SOCKET_PATH: process.env.DOCKER_SOCKET_PATH || (os.platform() === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock'),
    TASK_QUEUE_NAME: process.env.TASK_QUEUE_NAME || 'nexus-heavy-tasks',
    MAX_CONCURRENT_JOBS: parseInt(process.env.MAX_CONCURRENT_JOBS || '3', 10),
    DB_PATH: path.resolve(__dirname, process.env.DB_PATH || 'nexus_unified_v49.db'),
    UPLOAD_DIR: path.resolve(__dirname, process.env.UPLOAD_DIR || 'Uploads'),
    SCREENSHOT_DIR: path.resolve(__dirname, process.env.SCREENSHOT_DIR || 'screenshots'),
    DOCKER_WORK_DIR: path.resolve(__dirname, process.env.DOCKER_WORK_DIR || 'docker_work'),
    SYSTEM_GENERATION_DIR: path.resolve(__dirname, process.env.SYSTEM_GENERATION_DIR || 'generated_systems'),
    VISION_SCRIPT_PATH: path.resolve(__dirname, process.env.VISION_SCRIPT_PATH || './vision/vision_sync.py'), // Caminho para script Python
    VISION_PYTHON_PATH: process.env.VISION_PYTHON_PATH || 'python3', // Comando Python (pode ser path/to/.venv/bin/python)
    MAX_FILE_SIZE: 50 * 1024 * 1024,
    defaultModel: process.env.DEFAULT_GEMINI_MODEL || 'gemini-1.5-flash-latest',
    SEARCH_API_URL: 'https://api.duckduckgo.com/?format=json&t=nexusai&q=',
    geminiModels: {
        LeaderAPI: process.env.LEADER_MODEL || 'gemini-1.5-pro-latest',
        NluAPI: process.env.NLU_MODEL || 'gemini-1.5-flash-latest',
        PlannerAPI: process.env.PLANNER_MODEL || 'gemini-1.5-pro-latest',
        SynthesisAPI: process.env.SYNTHESIS_MODEL || 'gemini-1.5-pro-latest',
        AnalystAPI: process.env.ANALYST_MODEL || 'gemini-1.5-pro-latest',
        CodingAPI: process.env.CODING_MODEL || 'gemini-1.5-pro-latest',
        CodeReviewAPI: process.env.REVIEW_MODEL || 'gemini-1.5-pro-latest',
        ReplicatorAPI: process.env.REPLICATOR_MODEL || 'gemini-1.5-pro-latest',
        AutomationAPI: process.env.AUTOMATION_MODEL || 'gemini-1.5-pro-latest',
        CreativeAPI: process.env.CREATIVE_MODEL || 'gemini-1.5-flash-latest',
        ConversationalAPI: process.env.CONVERSATIONAL_MODEL || 'gemini-1.5-flash-latest',
        MultimodalAPI: process.env.MULTIMODAL_MODEL || 'gemini-1.5-pro-latest',
    },
    modelSettings: {
        'gemini-1.5-pro-latest': { tokenLimit: 1048576, multimodal: true, temperature: 0.7, topP: 0.95 },
        'gemini-1.5-flash-latest': { tokenLimit: 1048576, multimodal: true, temperature: 0.8, topP: 0.95 }, // Flash now has 1M token limit too
    },
    taskTimeouts: { default: 120000, coding: 300000, multimodal: 300000, system_generation: 600000, vision_analysis: 60000, automation: 30000 },
    retryAttempts: 3,
    cacheTTL: 3600, // 1 hour
    fileTTL: 86400, // 24 hours for temp files
    maxIterations: 5,
    criticalActionConfirmation: process.env.REQUIRE_AUTOMATION_CONFIRMATION !== 'false',
    dockerImages: {
        python: 'python:3.11-slim',
        javascript: 'node:20-slim',
        bash: 'bash:latest',
    },
    dockerResourceLimits: { Memory: '512m', CpuQuota: 100000, NetworkDisabled: false },
    allowedAutomationActions: ['moveMouse', 'click', 'type', 'pressKey', 'openFolder', 'runCommand', 'getMousePos', 'getScreenSize'],
    SOCKET_IO_CORS: {
        origin: (process.env.FRONTEND_URL || "http://localhost:3000,http://localhost:6000,http://127.0.0.1:6000").split(','),
        methods: ["GET", "POST"],
        credentials: true
    },
    VISION_RETRY_DELAY: 5000,
    MAX_VISION_RETRIES: 3,
    safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ],
};

const logger = {
    info: (msg, data = {}) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, data && Object.keys(data).length ? util.inspect(data, { depth: 1, colors: true }) : ''),
    warn: (msg, data = {}) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`, data && Object.keys(data).length ? util.inspect(data, { depth: 1, colors: true }) : ''),
    error: (msg, error) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, error instanceof Error ? error : util.inspect(error, { depth: 2, colors: true })),
    debug: (msg, data = {}) => {
        if (process.env.NODE_ENV === 'development') {
            console.debug(`[DEBUG] ${new Date().toISOString()} - ${msg}`, data && Object.keys(data).length ? util.inspect(data, { depth: 1, colors: true }) : '');
        }
    }
};

module.exports = {
  CONFIG,
  logger,
};
