# Nexus Unified v4.9

[![Status](https://img.shields.io/badge/status-em%20desenvolvimento-yellow)](https://github.com/seu-usuario/nexus-unified-v4.9)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE.md)

Interface Unificada para Orquestração de Agentes IA, Geração Multimodal e Automação Desktop/Web.

## Status Atual

O Nexus Unified v4.9 está atualmente em fase de **desenvolvimento ativo e refatoração**. As funcionalidades principais estão sendo modularizadas e a base de código está sendo preparada para expansões futuras. Alguns componentes podem estar usando placeholders ou implementações mock enquanto a integração completa dos serviços é finalizada.

## Visão Geral da Arquitetura

O Nexus Unified v4.9 é construído sobre uma arquitetura modular Node.js, projetada para flexibilidade e escalabilidade. Os componentes principais incluem:

*   **Servidor Principal (`src/app.js`)**: Ponto de entrada da aplicação, usando Express.js para rotas HTTP e Socket.IO para comunicação em tempo real.
*   **Módulo Core (`src/core/`)**: Contém a configuração central (`config.js`) e a lógica de setup do servidor (`serverSetup.js`).
*   **Serviços (`src/services/`)**: Módulos especializados para cada funcionalidade principal (IA, Geração de Mídia, Automação, Visão Computacional, etc.).
*   **Inicializadores (`src/config/initializers/`)**: Scripts para configurar conexões com bancos de dados, Redis, Docker, BullMQ e Socket.IO.
*   **Middlewares (`src/middleware/`)**: Para autenticação (HTTP e Socket.IO) e upload de arquivos.
*   **Rotas (`src/routes/`)**: Definições de rotas HTTP para API, dashboard e arquivos estáticos.
*   **Socket Handlers (`src/socketHandlers/`)**: Lógica para lidar com eventos Socket.IO, modularizada por funcionalidade.
*   **Workers (`src/workers/`)**: Processadores de tarefas em segundo plano usando BullMQ para operações pesadas (geração de sistemas, análise de mídia).
*   **Interface do Usuário**: Uma interface web (`src/public/index.html`) para interação com o sistema.
*   **Serviço de Visão (Python)**: Um serviço externo em Python (localizado no diretório `vision/`) para análise de tela (OCR, detecção de objetos), que se comunica com o servidor Node.js.

**Fluxo de Dados (Simplificado):**
1.  O usuário interage via Interface Web (Socket.IO ou HTTP API).
2.  As requisições são recebidas pelo `app.js` ou pelos `socketHandlers`.
3.  O `MaestroV4` (orquestrador principal) coordena a execução, utilizando outros serviços.
4.  `AIService` interage com `GeminiProvider` para chamadas a LLMs (Google Gemini).
5.  Outros serviços (MediaGenerationSystem, DockerService, AutomationSystem, VisionService) executam tarefas específicas.
6.  Tarefas pesadas são enfileiradas no BullMQ e processadas pelos `workers`.
7.  `MemoryModule` (usando SQLite) armazena o histórico de tasks e mensagens.
8.  `MessageSystem` envia atualizações em tempo real para o cliente via Socket.IO.

## Principais Funcionalidades

*   **Orquestração de Agentes IA**: Capacidade de planejar e executar tarefas complexas usando múltiplos modelos de IA (Gemini Pro/Flash) e ferramentas.
*   **Geração Multimodal**:
    *   **Texto**: Geração de texto para diversos fins (codificação, análise, conversação).
    *   **Imagem**: Geração de imagens usando Stability AI (via API).
    *   **Áudio**: Geração de voz a partir de texto usando ElevenLabs (via API).
*   **Automação Desktop**: Controle de mouse, teclado e execução de comandos no desktop do usuário (requer confirmação para ações críticas).
*   **Visão Computacional**: Análise de tela em tempo real (OCR, detecção de objetos) usando um serviço Python com YOLO.
*   **Execução de Código Segura**: Execução de código Python, JavaScript e Bash em ambientes Docker isolados.
*   **Interface Web Unificada**: Painel de controle para interagir com todas as funcionalidades, visualizar logs, gerenciar tasks e arquivos.
*   **Sistema de Tarefas Assíncronas**: Uso de BullMQ e Redis para gerenciar e processar tarefas pesadas em segundo plano.
*   **Gerenciamento de Chaves API**: Sistema de rotação e fallback para chaves de API do Google.
*   **Comunicação em Tempo Real**: Uso intensivo de Socket.IO para feedback instantâneo ao usuário.
*   **Upload e Processamento de Arquivos**: Suporte para upload de arquivos com processamento específico (ex: extração de texto de PDFs).
*   **Geração de Sistemas Web**: Capacidade de gerar aplicações web básicas (HTML, CSS, JS) com base em prompts, com um ciclo iterativo de feedback e refinamento.

## Estrutura de Diretórios

```
nexus-unified-v4.9/
├── src/
│   ├── app.js                  # Ponto de entrada principal da aplicação
│   ├── config/
│   │   └── initializers/       # Módulos de inicialização (DB, Redis, Docker, etc.)
│   ├── core/
│   │   ├── config.js           # Configurações centrais, logger
│   │   └── serverSetup.js      # Lógica de setup do servidor e graceful shutdown
│   ├── middleware/             # Middlewares Express e Socket.IO
│   ├── public/                 # Arquivos estáticos públicos (ex: index.html)
│   ├── routes/                 # Definições de rotas Express
│   ├── services/               # Módulos de serviço especializados
│   ├── socketHandlers/         # Handlers para eventos Socket.IO
│   └── workers/                # Workers BullMQ para tarefas em segundo plano
├── vision/                     # Serviço de Visão em Python (OCR, Detecção)
│   ├── .venv/                  # Ambiente virtual Python (criado pelo setup)
│   ├── vision_sync.py          # Script principal do serviço de visão
│   └── requirements.txt        # Dependências Python
├── Uploads/                    # Diretório padrão para uploads de arquivos
├── screenshots/                # Diretório padrão para capturas de tela
├── docker_work/                # Diretório de trabalho para DockerService
├── generated_systems/          # Diretório para sistemas web gerados
├── generated_media/            # Diretório para mídias geradas (áudio, imagens)
│   ├── audio/
│   └── images/
├── package.json                # Dependências e scripts Node.js
├── setup_nexus.sh              # Script de setup do ambiente
├── README.md                   # Este arquivo
└── .env.example                # Arquivo de exemplo para variáveis de ambiente
```

## Pré-requisitos

*   **Node.js**: v18.0.0 ou superior.
*   **npm**: (geralmente incluído com Node.js).
*   **Git**: Para clonar o repositório.
*   **Python 3**: (v3.8+ recomendado) e `pip3` para o `VisionService`.
*   **Docker**: (Opcional, mas necessário para `DockerService` e para rodar Redis via `docker-compose`).
*   **Docker Compose**: (Opcional, para gerenciar containers Docker, como o Redis).
*   **Conexão com a Internet**: Para baixar dependências e acessar APIs externas.
*   **Sistema Operacional**: Desenvolvido e testado primariamente em Linux. Windows e macOS podem requerer ajustes (especialmente para `robotjs` e `VisionService`).

## Configuração (`.env`)

1.  Copie o arquivo `.env.example` para `.env`: `cp .env.example .env`
2.  Edite o arquivo `.env` e preencha as variáveis de ambiente necessárias:

    *   `PORT`: Porta para o servidor (padrão: 6000).
    *   `JWT_SECRET`: Segredo forte para tokens JWT (obrigatório).
    *   `GOOGLE_API_KEY` ou `GOOGLE_API_KEYS`: Chave(s) API do Google Gemini (obrigatório). Use vírgula para múltiplas chaves em `GOOGLE_API_KEYS`.
    *   `STABILITY_API_KEY`: Chave API da Stability AI para geração de imagens.
    *   `ELEVENLABS_API_KEY`: Chave API da ElevenLabs para geração de áudio.
    *   `ELEVENLABS_API_URL`: URL da API ElevenLabs, incluindo o ID da voz desejada (ex: `https://api.elevenlabs.io/v1/text-to-speech/VOICE_ID`).
    *   `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`: Configurações do Redis (padrão: `127.0.0.1:6379` sem senha).
    *   `VISION_PYTHON_PATH`: Caminho para o executável Python do ambiente virtual do VisionService (ex: `./vision/.venv/bin/python`).
    *   `VISION_SCRIPT_PATH`: Caminho para o script principal do VisionService (padrão: `src/core/vision/vision_sync.py`, mas o script está em `vision/vision_sync.py`). *Nota: O `config.js` resolve isso para `src/core/vision/vision_sync.py` se o padrão for usado. Certifique-se que o script `vision_sync.py` esteja no diretório `vision/` na raiz do projeto.*
    *   Outras configurações como `DB_PATH`, `UPLOAD_DIR`, `DEFAULT_GEMINI_MODEL`, etc., podem ser ajustadas conforme necessário.

## Setup e Instalação

1.  **Clone o repositório:**
    ```bash
    git clone <url_do_repositorio>
    cd nexus-unified-v4.9
    ```

2.  **Execute o script de setup interativo:**
    Este script verificará dependências, instalará pacotes Node.js e ajudará a configurar o `.env`.
    ```bash
    bash setup_nexus.sh
    ```
    *Siga as instruções do script.*

3.  **Configure o VisionService (se for usar):**
    O script `setup_nexus.sh` fornecerá instruções. O comando principal é:
    ```bash
    npm run setup:vision
    ```
    Lembre-se de atualizar `VISION_PYTHON_PATH` no seu `.env` após a conclusão (ex: `./vision/.venv/bin/python`).

4.  **Verifique o arquivo `.env`:**
    Certifique-se que todas as chaves de API e caminhos importantes estão corretamente configurados no arquivo `.env`.

## Como Executar

*   **Modo de Desenvolvimento:**
    Utiliza `nodemon` para reiniciar automaticamente o servidor após alterações no código.
    ```bash
    npm run dev
    ```

*   **Modo de Produção:**
    Inicia o servidor normalmente.
    ```bash
    npm start
    ```

*   **Serviços Docker (Opcional):**
    Se você tiver um `docker-compose.yml` para serviços como Redis:
    ```bash
    npm run docker:run  # Inicia os containers em background
    npm run docker:stop # Para os containers
    ```
    *Nota: Um arquivo `docker-compose.yml` não foi fornecido neste projeto base, mas os scripts estão presentes no `package.json` para conveniência caso seja adicionado.*

## Acessando a Aplicação

Após iniciar o servidor, acesse a interface web no seu navegador:

*   **URL**: `http://localhost:<PORTA_CONFIGURADA>` (ex: `http://localhost:6000` se a porta for 6000).

Você precisará de um token JWT válido para se autenticar via Socket.IO. A interface web deve ter um mecanismo para obter/inserir este token. Para testes locais com `simpleAuth` em rotas HTTP, o `userId` pode ser passado via header `x-user-id`.

## Roadmap / Próximos Passos e Melhorias Futuras

Esta seção detalha os planos para o desenvolvimento futuro do Nexus Unified.

### 1. Novas Funcionalidades
*   **Análises e Relatórios Avançados:**
    *   Capacidade: Adicionar um módulo de relatórios personalizáveis, onde o usuário possa selecionar métricas, dimensões e criar dashboards interativos. Incluir gráficos e a capacidade de exportar em diversos formatos (PDF, Excel, CSV).
    *   Motivo: Usuários geralmente precisam de insights mais profundos dos dados para tomadas de decisão, e um sistema de relatórios fixos raramente atende a todas as necessidades.
*   **Integração com Plataformas Externas (API Aberta):**
    *   Capacidade: Desenvolver uma API RESTful bem documentada para que outros sistemas possam interagir com o nosso, seja para importar/exportar dados ou automatizar processos.
    *   Motivo: Facilita a interoperabilidade e expande o ecossistema de uso do nosso sistema, permitindo que clientes o integrem às suas próprias ferramentas.
*   **Módulo de Automação de Tarefas/Workflows:**
    *   Capacidade: Permitir a criação de fluxos de trabalho automatizados baseados em eventos (ex: "quando um item X é criado, envie uma notificação para Y e crie uma tarefa Z").
    *   Motivo: Reduz a carga de trabalho manual, minimiza erros humanos e acelera processos repetitivos.
*   **Sistema de Notificações Inteligente:**
    *   Capacidade: Além das notificações existentes, permitir que o usuário configure alertas personalizados com base em critérios específicos (ex: "notifique-me quando o status de um item mudar para 'urgente'") e escolha o canal (e-mail, notificação in-app, SMS).
    *   Motivo: Garante que os usuários sejam informados sobre eventos críticos de forma proativa e personalizável.

### 2. Melhoria de Funcionalidades Existentes
*   **Busca Aprimorada:**
    *   Melhoria: Implementar busca "fuzzy" (tolerância a erros de digitação), busca por múltiplos critérios (filtros avançados combináveis), e a capacidade de salvar buscas frequentes.
    *   Motivo: Aumentar a eficiência e a produtividade do usuário ao encontrar informações rapidamente.
*   **Experiência de Upload/Download de Arquivos:**
    *   Melhoria: Suporte a upload de múltiplos arquivos, arrastar e soltar, barra de progresso detalhada, e visualização prévia de documentos/imagens antes do download.
    *   Motivo: Tornar a interação com arquivos mais fluida e moderna.
*   **Melhoria na Gestão de Usuários e Permissões:**
    *   Melhoria: Tornar a configuração de permissões mais granular (ex: permitir que um usuário visualize mas não edite um campo específico) e facilitar a cópia de permissões entre usuários/perfis.
    *   Motivo: Oferecer maior flexibilidade e segurança no controle de acesso.

### 3. Performance
*   **Otimização de Consultas de Banco de Dados:**
    *   Ação: Realizar uma auditoria nas queries mais lentas, adicionar/otimizar índices, refatorar queries complexas e considerar estratégias de cache para dados frequentemente acessados.
    *   Motivo: É um gargalo comum em sistemas com grande volume de dados. Melhorar a performance do DB impacta diretamente a velocidade de carregamento de páginas e a responsividade.
*   **Otimização de Carregamento de Página (Front-end):**
    *   Ação: Minificação de arquivos CSS/JS, otimização de imagens, lazy loading para componentes/dados não essenciais, e uso de CDNs.
    *   Motivo: Melhora a experiência do usuário, especialmente em conexões de internet mais lentas ou dispositivos móveis.
*   **Estratégias de Cache no Backend:**
    *   Ação: Implementar cache em nível de aplicação para resultados de operações computacionalmente caras ou dados que mudam com pouca frequência.
    *   Motivo: Reduz a carga sobre o servidor e o banco de dados, resultando em respostas mais rápidas para solicitações repetidas.
*   **Escalabilidade Horizontal:**
    *   Ação: Avaliar a arquitetura para garantir que o sistema possa ser facilmente escalado horizontalmente (adicionar mais servidores) para lidar com picos de demanda.
    *   Motivo: Preparar o sistema para o crescimento futuro da base de usuários e do volume de dados.

### 4. Segurança
*   **Autenticação Multifator (MFA):**
    *   Ação: Implementar MFA (ex: Google Authenticator, SMS) para todos os usuários ou, no mínimo, para usuários com privilégios administrativos.
    *   Motivo: Aumenta significativamente a segurança contra acessos não autorizados, mesmo que a senha seja comprometida.
*   **Controle de Acesso Baseado em Papéis (RBAC) mais robusto:**
    *   Ação: Reavaliar e, se necessário, refinar o modelo de RBAC para garantir que as permissões sejam aplicadas corretamente e que o "princípio do menor privilégio" seja seguido.
    *   Motivo: Minimizar o risco de que usuários tenham acesso a informações ou funcionalidades além do necessário para suas funções.
*   **Registro e Auditoria de Ações Críticas:**
    *   Ação: Melhorar os logs para registrar todas as ações críticas (criação/edição/exclusão de dados sensíveis, alterações de permissão, tentativas de login falhas) com carimbo de data/hora, usuário e IP.
    *   Motivo: Essencial para rastrear atividades, investigar incidentes de segurança e para conformidade com regulamentações.
*   **Varreduras de Vulnerabilidades e Testes de Penetração Regulares:**
    *   Ação: Agendar varreduras automatizadas e, se possível, contratar testes de penetração ("pentests") periódicos.
    *   Motivo: Identificar proativamente falhas de segurança antes que possam ser exploradas.

### 5. Qualidade do Código
*   **Aumento da Cobertura e Qualidade dos Testes Automatizados:**
    *   Ação: Priorizar a escrita de testes unitários, de integração e end-to-end, especialmente para módulos críticos e recém-desenvolvidos. Refatorar testes existentes para torná-los mais legíveis e confiáveis.
    *   Motivo: Garante a estabilidade do sistema, previne regressões e facilita futuras manutenções e o desenvolvimento de novas features.
*   **Refatoração de Módulos Legados/Críticos:**
    *   Ação: Identificar partes do código com alta dívida técnica, baixa legibilidade ou que são difíceis de manter e refatorá-las gradualmente, sem alterar o comportamento externo.
    *   Motivo: Melhora a manutenibilidade, reduz a chance de bugs e acelera o desenvolvimento de novas funcionalidades nesses módulos.
*   **Padronização de Código e Implementação de Ferramentas de Linting/Formatação:**
    *   Ação: Definir e aplicar um guia de estilo de código, usando ferramentas automatizadas (linters, formatters) para garantir consistência em toda a base de código.
    *   Motivo: Aumenta a legibilidade, facilita o code review e a colaboração entre desenvolvedores.
*   **Melhoria da Documentação Interna (para Desenvolvedores):**
    *   Ação: Adicionar comentários claros em código complexo, documentar a arquitetura de módulos, decisões de design importantes e guias de setup/desenvolvimento.
    *   Motivo: Facilita o onboarding de novos desenvolvedores e a compreensão do sistema por toda a equipe.

### 6. Interface do Usuário (UI)
*   **Dashboard Personalizável:**
    *   Melhoria: Permitir que os usuários personalizem seu dashboard com widgets que exibam as informações mais relevantes para eles.
    *   Motivo: Aumenta a relevância e a utilidade do dashboard para diferentes perfis de usuário.
*   **Experiência Mobile Responsiva/Aplicativo Dedicado:**
    *   Melhoria: Garantir que a interface seja totalmente responsiva e utilizável em qualquer dispositivo móvel, ou até mesmo desenvolver um aplicativo móvel nativo para as funcionalidades mais acessadas.
    *   Motivo: Aumenta a acessibilidade e a flexibilidade para usuários que precisam interagir com o sistema em trânsito.
*   **Melhoria da Navegação e Arquitetura da Informação:**
    *   Melhoria: Simplificar menus, agrupar funcionalidades de forma mais lógica e usar testes de usabilidade para identificar pontos de fricção.
    *   Motivo: Reduz a curva de aprendizado e a frustração do usuário, tornando o sistema mais intuitivo.
*   **Feedback Visual e Notificações In-App:**
    *   Melhoria: Adicionar animações, indicadores de carregamento mais claros, mensagens de sucesso/erro mais descritivas e um centro de notificações in-app para que o usuário não perca alertas importantes.
    *   Motivo: Melhora a comunicação com o usuário e a percepção de responsividade do sistema.

### 7. Documentação
*   **Documentação do Usuário Final Aprimorada:**
    *   Adição/Melhoria: Criar guias de uso detalhados, FAQs, tutoriais em vídeo, e uma base de conhecimento pesquisável para funcionalidades chave.
    *   Motivo: Empodera o usuário a resolver seus próprios problemas, reduzindo a carga sobre o suporte ao cliente.
*   **Documentação para Desenvolvedores (Onboarding e Arquitetura):**
    *   Adição/Melhoria: Criar um guia de "primeiros passos" para novos desenvolvedores, diagramas de arquitetura do sistema, fluxos de dados, e decisões de design importantes.
    *   Motivo: Acelera o onboarding de novos membros da equipe e garante que todos entendam a estrutura do sistema.
*   **Documentação da API (se aplicável):**
    *   Adição/Melhoria: Se houver uma API, garantir que esteja completa, com exemplos de código, descrições de endpoints, parâmetros, e respostas (usando ferramentas como Swagger/OpenAPI).
    *   Motivo: Essencial para desenvolvedores externos que precisam integrar seus sistemas com o nosso.

### 8. Correção de Bugs
*   **Priorização e Resolução de Bugs de Alto Impacto:**
    *   Ação: Realizar uma triagem e priorização de todos os bugs conhecidos, focando naqueles que afetam a funcionalidade principal, causam perda de dados, ou têm um grande impacto na experiência do usuário.
    *   Motivo: Garantir a estabilidade e a confiabilidade do sistema, que são fundamentais para a satisfação do usuário.
*   **Criação de Testes de Regressão para Bugs Corrigidos:**
    *   Ação: Para cada bug crítico corrigido, escrever um teste automatizado que garanta que ele não volte a ocorrer em futuras versões.
    *   Motivo: Prevenir a reintrodução de bugs conhecidos e solidificar a qualidade do código.

#### Priorização
Para iniciar, sugiro que, a partir desta lista, seja feita uma priorização baseada em:
*   Impacto no Negócio/Usuário: Quais melhorias trariam o maior benefício?
*   Esforço de Desenvolvimento: Quanto tempo e recursos seriam necessários?
*   Dependências: Há algo que precisa ser feito antes de outra coisa?
*   Custo/Benefício: O retorno do investimento vale a pena?
Com essa análise, poderíamos definir um roadmap claro para as próximas fases de desenvolvimento.

## Como Contribuir

Contribuições são bem-vindas! Se você deseja contribuir:

1.  Faça um Fork do repositório.
2.  Crie uma nova Branch para sua feature ou correção (`git checkout -b feature/sua-feature` ou `bugfix/seu-bug`).
3.  Faça suas alterações e commit (`git commit -m 'Adiciona nova feature X'`).
4.  Envie para sua Branch (`git push origin feature/sua-feature`).
5.  Abra um Pull Request para a branch principal do repositório original.

Por favor, siga as convenções de código existentes e adicione testes para suas alterações sempre que possível.

## Licença

Este projeto é licenciado sob a [Licença ISC](LICENSE.md).
