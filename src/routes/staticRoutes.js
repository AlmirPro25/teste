const express = require('express');
const path = require('path');
const { CONFIG, logger } = require('../core/config');

function configureStaticRoutes(app) {
    app.use('/screenshots', express.static(CONFIG.SCREENSHOT_DIR));
    app.use('/uploads', express.static(CONFIG.UPLOAD_DIR));
    app.use('/generated_systems', express.static(CONFIG.SYSTEM_GENERATION_DIR));
    
    // path.resolve is used to construct an absolute path from CONFIG.SYSTEM_GENERATION_DIR
    // by going up one level ('../') and then into 'generated_media'.
    // This assumes 'generated_media' is a sibling to 'generated_systems' if SYSTEM_GENERATION_DIR is a direct child of the project root.
    // Or, more generally, it navigates from the location of SYSTEM_GENERATION_DIR.
    const generatedMediaDir = path.resolve(CONFIG.SYSTEM_GENERATION_DIR, '../generated_media');
    app.use('/generated_media', express.static(generatedMediaDir));
    
    logger.warn("Servindo diretórios /screenshots, /uploads, /generated_systems, /generated_media SEM AUTENTICAÇÃO!");
}

module.exports = { configureStaticRoutes };
