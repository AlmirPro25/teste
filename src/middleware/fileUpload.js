const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { CONFIG } = require('../core/config');

const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            // CONFIG.UPLOAD_DIR já é um path absoluto
            await fs.mkdir(CONFIG.UPLOAD_DIR, { recursive: true });
            cb(null, CONFIG.UPLOAD_DIR);
        } catch (err) {
            cb(err);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${path.parse(file.originalname).name}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: CONFIG.MAX_FILE_SIZE } // Vem de CONFIG
});

module.exports = { upload };
