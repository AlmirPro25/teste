const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../core/config');
const { CONFIG } = require('../core/config');

// TODO: Injete ou importe a instância 'docker' do Dockerode aqui.
const docker_placeholder = {
    getContainer: (containerName) => ({
        remove: async (options) => logger.debug(`docker_placeholder.getContainer('${containerName}').remove() called`, options)
    }),
    createContainer: async (options) => {
        logger.debug('docker_placeholder.createContainer() called', options);
        return {
            start: async () => logger.debug('container_placeholder.start() called'),
            wait: async () => { logger.debug('container_placeholder.wait() called'); return { StatusCode: 0 }; },
            remove: async (options) => logger.debug(`container_placeholder.remove() called`, options) // Adicionado para o finally
        };
    }
};

const DockerService = {
    docker: docker_placeholder, // Usar o placeholder definido
    workDir: CONFIG.DOCKER_WORK_DIR,
    resourceLimits: CONFIG.dockerResourceLimits,
    images: CONFIG.dockerImages,

    async runCode(language, code, input = '', taskId = 'docker_task') {
        const imageName = this.images[language];
        if (!imageName) throw new Error(`Linguagem não suportada: ${language}`);

        const containerName = `nexus-exec-${language}-${taskId}-${Date.now()}`;
        const hostWorkDir = path.join(CONFIG.DOCKER_WORK_DIR, containerName);
        const containerWorkDir = '/app';
        const scriptFileName = language === 'javascript' ? 'script.js' : (language === 'python' ? 'script.py' : 'script.sh');
        const scriptHostPath = path.join(hostWorkDir, scriptFileName);
        const inputFileName = 'input.txt';
        const inputHostPath = path.join(hostWorkDir, inputFileName);
        const outputFileName = 'output.txt';
        const errorFileName = 'error.txt';

        let cmd;
        switch (language) {
            case 'python': cmd = ['python', `${containerWorkDir}/${scriptFileName}`]; break;
            case 'javascript': cmd = ['node', `${containerWorkDir}/${scriptFileName}`]; break;
            case 'bash': cmd = ['/bin/bash', `${containerWorkDir}/${scriptFileName}`]; break;
            default: throw new Error(`Comando não definido para ${language}`);
        }
        const fullCommand = [
            '/bin/sh', '-c',
            `${cmd.join(' ')} < ${containerWorkDir}/${inputFileName} > ${containerWorkDir}/${outputFileName} 2> ${containerWorkDir}/${errorFileName}`
        ];
        try {
            await fs.mkdir(hostWorkDir, { recursive: true });
            await fs.writeFile(scriptHostPath, code);
            await fs.writeFile(inputHostPath, input);
            await fs.writeFile(path.join(hostWorkDir, outputFileName), '');
            await fs.writeFile(path.join(hostWorkDir, errorFileName), '');

            logger.info(`Docker: Criando container ${containerName} com imagem ${imageName}`);
            const container = await this.docker.createContainer({
                Image: imageName,
                name: containerName,
                Cmd: fullCommand,
                WorkingDir: containerWorkDir,
                HostConfig: {
                    Binds: [`${hostWorkDir}:${containerWorkDir}`],
                    ...this.resourceLimits, 
                    AutoRemove: false, 
                },
                Tty: false, 
                AttachStdin: false,
                AttachStdout: false, 
                AttachStderr: false, 
                OpenStdin: false,
            });

            logger.info(`Docker: Iniciando container ${containerName}`);
            await container.start();

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`Container ${containerName} excedeu o timeout (${CONFIG.taskTimeouts.coding / 1000}s)`)), CONFIG.taskTimeouts.coding)
            );
            const waitPromise = container.wait();
            const status = await Promise.race([waitPromise, timeoutPromise]);
            logger.info(`Docker: Container ${containerName} finalizado com status ${status.StatusCode}`);

            const stdout = await fs.readFile(path.join(hostWorkDir, outputFileName), 'utf8');
            const stderr = await fs.readFile(path.join(hostWorkDir, errorFileName), 'utf8');

            if (status.StatusCode !== 0) {
                logger.warn(`Docker: Container ${containerName} saiu com código ${status.StatusCode}. Stderr: ${stderr.substring(0, 500)}`);
                 throw new Error(`Execução falhou (código ${status.StatusCode}): ${stderr || 'Sem erro específico no stderr.'}`);
            }
            return { stdout, stderr };
        } catch (error) {
            logger.error(`Docker: Erro ao executar código ${language} no container ${containerName}:`, error);
            throw error;
        } finally {
            try {
                const containerToRemove = this.docker.getContainer(containerName);
                await containerToRemove.remove({ force: true }); 
                logger.debug(`Docker: Container ${containerName} removido.`);
            } catch (removeError) {
                if (!removeError.message.includes('No such container')) {
                     logger.warn(`Docker: Falha ao remover container ${containerName}. Pode requerer limpeza manual.`, removeError);
                }
            }
            try {
                await fs.rm(hostWorkDir, { recursive: true, force: true });
                 logger.debug(`Docker: Diretório de trabalho ${hostWorkDir} removido.`);
            } catch (rmError) {
                logger.warn(`Docker: Falha ao remover diretório de trabalho ${hostWorkDir}.`, rmError);
            }
        }
    }
};

module.exports = DockerService;
