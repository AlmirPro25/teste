#!/bin/bash

# Script de Setup Nexus Unified v4.9
# Este script automatiza a configuração do ambiente de desenvolvimento.

# Cores para logs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Iniciando Setup do Nexus Unified v4.9...${NC}"

# Função para verificar se um comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 1. Verificar Node.js e npm
echo -e "\n${YELLOW}Verificando Node.js e npm...${NC}"
if command_exists node && command_exists npm; then
    NODE_VERSION=$(node -v)
    NPM_VERSION=$(npm -v)
    echo -e "Node.js encontrado: ${NODE_VERSION}"
    echo -e "npm encontrado: ${NPM_VERSION}"
    # Adicionar verificação de versão mínima se necessário
    if [[ ! $(echo "$NODE_VERSION" | cut -c2- | awk '{print ($1 >= 18)}') -eq 1 ]]; then
        echo -e "${RED}Versão do Node.js é ${NODE_VERSION}. Requerido >= v18.0.0. Por favor, atualize o Node.js.${NC}"
        exit 1
    fi
else
    echo -e "${RED}Node.js ou npm não encontrados. Por favor, instale o Node.js (que inclui npm) versão 18 ou superior.${NC}"
    echo -e "Visite: https://nodejs.org/"
    exit 1
fi

# 2. Verificar Git
echo -e "\n${YELLOW}Verificando Git...${NC}"
if command_exists git; then
    GIT_VERSION=$(git --version)
    echo -e "Git encontrado: ${GIT_VERSION}"
else
    echo -e "${RED}Git não encontrado. Por favor, instale o Git.${NC}"
    echo -e "Instruções: https://git-scm.com/book/en/v2/Getting-Started-Installing-Git"
    exit 1
fi

# 3. Verificar Python (para VisionService)
echo -e "\n${YELLOW}Verificando Python (para VisionService)...${NC}"
if command_exists python3 && command_exists pip3; then
    PYTHON_VERSION=$(python3 --version)
    PIP_VERSION=$(pip3 --version | cut -d' ' -f1,2) # Formatar saída do pip
    echo -e "Python 3 encontrado: ${PYTHON_VERSION}"
    echo -e "pip3 encontrado: ${PIP_VERSION}"
else
    echo -e "${RED}Python 3 ou pip3 não encontrados. Por favor, instale o Python 3 e o pip3.${NC}"
    echo -e "É recomendado usar 'python3 -m venv .venv' para criar um ambiente virtual para o VisionService."
    # Não sair, pois o VisionService é opcional para o core
fi

# 4. Verificar Docker (opcional, para DockerService e docker-compose)
echo -e "\n${YELLOW}Verificando Docker e Docker Compose (opcional)...${NC}"
DOCKER_OK=false
DOCKER_COMPOSE_OK=false
if command_exists docker; then
    DOCKER_VERSION=$(docker --version)
    echo -e "Docker encontrado: ${DOCKER_VERSION}"
    DOCKER_OK=true
else
    echo -e "${YELLOW}Docker não encontrado. O DockerService e comandos docker:run/stop não funcionarão.${NC}"
    echo -e "Instruções: https://docs.docker.com/get-docker/"
fi

if command_exists docker-compose; then
    DOCKER_COMPOSE_VERSION=$(docker-compose --version)
    echo -e "Docker Compose encontrado: ${DOCKER_COMPOSE_VERSION}"
    DOCKER_COMPOSE_OK=true
elif command_exists docker && docker compose version >/dev/null 2>&1; then # Docker Compose V2 (plugin)
    DOCKER_COMPOSE_VERSION=$(docker compose version)
    echo -e "Docker Compose (plugin) encontrado: ${DOCKER_COMPOSE_VERSION}"
    DOCKER_COMPOSE_OK=true
else
    echo -e "${YELLOW}Docker Compose não encontrado. Comandos docker:run/stop podem não funcionar como esperado.${NC}"
    echo -e "Instruções: https://docs.docker.com/compose/install/"
fi

# 5. Instalar dependências do Node.js
echo -e "\n${YELLOW}Instalando dependências do Node.js (npm install)...${NC}"
if [ -f package.json ]; then
    npm install
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Dependências do Node.js instaladas com sucesso.${NC}"
    else
        echo -e "${RED}Erro ao instalar dependências do Node.js. Verifique os logs acima.${NC}"
        exit 1
    fi
else
    echo -e "${RED}Arquivo package.json não encontrado. Não é possível instalar dependências.${NC}"
    exit 1
fi

# 6. Criar arquivo .env a partir do .env.example
echo -e "\n${YELLOW}Configurando arquivo de ambiente .env...${NC}"
if [ -f .env.example ]; then
    if [ -f .env ]; then
        echo -e "Arquivo .env já existe. Verifique se todas as variáveis necessárias estão configuradas."
    else
        cp .env.example .env
        echo -e "${GREEN}Arquivo .env criado a partir de .env.example.${NC}"
        echo -e "Por favor, configure as variáveis no arquivo .env, especialmente:"
        echo -e " - ${YELLOW}GOOGLE_API_KEY ou GOOGLE_API_KEYS${NC} (para Gemini)"
        echo -e " - ${YELLOW}JWT_SECRET${NC} (para autenticação)"
        echo -e " - ${YELLOW}STABILITY_API_KEY${NC} (para geração de imagem)"
        echo -e " - ${YELLOW}ELEVENLABS_API_KEY${NC} (para geração de áudio)"
        echo -e " - ${YELLOW}REDIS_HOST, REDIS_PORT, REDIS_PASSWORD${NC} (se não usar defaults)"
        echo -e " - ${YELLOW}VISION_PYTHON_PATH${NC} (caminho para o python do .venv do VisionService, ex: ./vision/.venv/bin/python)"
    fi
else
    echo -e "${RED}.env.example não encontrado. Não é possível criar .env automaticamente.${NC}"
    echo -e "Crie um arquivo .env manualmente com as configurações necessárias."
fi

# 7. Configurar VisionService (opcional, mas recomendado)
echo -e "\n${YELLOW}Configurando o ambiente Python para VisionService (Opcional)...${NC}"
if [ -d "vision" ] && [ -f "vision/requirements.txt" ]; then
    echo -e "Um script para setup do VisionService está disponível em package.json: ${GREEN}'npm run setup:vision'${NC}"
    echo -e "Este comando irá:"
    echo -e "  1. Navegar para o diretório 'vision'."
    echo -e "  2. Criar um ambiente virtual Python em '.venv'."
    echo -e "  3. Ativar o ambiente virtual."
    echo -e "  4. Instalar as dependências de 'requirements.txt'."
    echo -e "  5. Desativar o ambiente."
    echo -e "\nExecute ${GREEN}'npm run setup:vision'${NC} manualmente se desejar usar o VisionService."
    echo -e "Lembre-se de atualizar ${YELLOW}VISION_PYTHON_PATH=${NC} no seu .env para algo como ${GREEN}./vision/.venv/bin/python${NC} após a instalação."
else
    echo -e "${YELLOW}Diretório 'vision' ou 'vision/requirements.txt' não encontrado. Pule a configuração do VisionService.${NC}"
fi

# 8. Criar diretórios necessários (se não existirem)
# UPLOAD_DIR, SCREENSHOT_DIR, DOCKER_WORK_DIR, SYSTEM_GENERATION_DIR, etc.
# O script startServer.js já faz isso, mas podemos garantir aqui.
echo -e "\n${YELLOW}Criando diretórios de trabalho (se não existirem)...${NC}"
mkdir -p Uploads
mkdir -p screenshots
mkdir -p docker_work
mkdir -p generated_systems
mkdir -p generated_media/audio
mkdir -p generated_media/images
# Se VISION_SCRIPT_PATH for algo como ./vision/script.py, o diretório ./vision já foi verificado.
echo -e "${GREEN}Diretórios de trabalho verificados/criados.${NC}"

# Conclusão
echo -e "\n\n${GREEN}Setup do Nexus Unified v4.9 concluído!${NC}"
echo -e "--------------------------------------------------"
echo -e "Próximos passos:"
echo -e "1. ${YELLOW}Configure seu arquivo .env${NC} com as chaves de API e outras configurações."
echo -e "2. Se for usar o VisionService, execute: ${GREEN}npm run setup:vision${NC} e configure VISION_PYTHON_PATH no .env."
echo -e "3. Para iniciar o servidor em modo de desenvolvimento: ${GREEN}npm run dev${NC}"
echo -e "4. Para iniciar o servidor em modo de produção: ${GREEN}npm start${NC}"
echo -e "5. Se usar Docker e Redis via docker-compose (opcional): ${GREEN}npm run docker:run${NC}"
echo -e "--------------------------------------------------"

# Lembrete sobre o Redis
if ! (command_exists redis-cli && redis-cli ping >/dev/null 2>&1 || ( $DOCKER_OK && docker ps | grep -q redis )); then
    echo -e "\n${YELLOW}LEMBRETE: Redis não parece estar rodando localmente ou via Docker (se o container se chamar 'redis').${NC}"
    echo -e "O BullMQ (sistema de filas) e o Socket.IO (com adapter Redis) precisam do Redis."
    echo -e "Certifique-se que o Redis está acessível na configuração do seu .env (REDIS_HOST, REDIS_PORT)."
    echo -e "Você pode usar 'npm run docker:run' para iniciar um container Redis definido em docker-compose.yml (se existir)."
fi

exit 0
