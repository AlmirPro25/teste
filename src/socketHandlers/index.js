const { handleBaseEvents } = require('./connection');
const { registerCommandHandlers } = require('./commandHandlers');
const { registerSystemGenerationHandlers } = require('./systemGenerationHandlers');
const { registerAutomationHandlers } = require('./automationHandlers');
const { registerVisionHandlers } = require('./visionHandlers');
const { registerMediaHandlers } = require('./mediaHandlers');
const { registerMetaHandlers } = require('./metaHandlers');

function registerAllSocketHandlers(io, socket) {
    handleBaseEvents(io, socket);
    registerCommandHandlers(io, socket);
    registerSystemGenerationHandlers(io, socket);
    registerAutomationHandlers(io, socket);
    registerVisionHandlers(io, socket);
    registerMediaHandlers(io, socket);
    registerMetaHandlers(io, socket);
}

module.exports = { registerAllSocketHandlers };
