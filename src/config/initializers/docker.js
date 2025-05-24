const Docker = require('dockerode');
const { CONFIG } = require('../../core/config');

const docker = new Docker({ socketPath: CONFIG.DOCKER_SOCKET_PATH });

module.exports = { docker };
