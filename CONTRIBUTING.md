# Como Contribuir para o Nexus Unified

Primeiramente, obrigado pelo seu interesse em contribuir para o Nexus Unified! Valorizamos muito o tempo e esforço da comunidade para nos ajudar a melhorar o projeto.

Este documento é um guia para ajudar você a fazer sua contribuição.

## Código de Conduta

Antes de contribuir, por favor, leia nosso [Código de Conduta](CODE_OF_CONDUCT.md). Esperamos que todos os contribuidores sigam este código para garantir que nossa comunidade seja acolhedora e respeitosa para todos.

## Como Você Pode Contribuir

Existem várias maneiras de contribuir para o projeto:

*   **Reportando Bugs:** Se você encontrar um bug, por favor, abra uma issue em nosso repositório GitHub. Detalhe como reproduzir o bug, o que você esperava que acontecesse e o que realmente aconteceu. Inclua informações sobre seu ambiente (sistema operacional, versões de software relevantes, etc.).
*   **Sugerindo Melhorias e Novas Funcionalidades:** Se você tem uma ideia para uma nova funcionalidade ou uma melhoria em algo existente, abra uma issue descrevendo sua sugestão. Explique o caso de uso e por que isso seria benéfico para o projeto.
*   **Escrevendo Código:** Você pode contribuir com código para corrigir bugs ou implementar novas funcionalidades.
*   **Melhorando a Documentação:** Se você encontrar algo na documentação que está confuso, incompleto ou incorreto, sinta-se à vontade para propor alterações.

## Fazendo Sua Primeira Contribuição de Código

Se você deseja contribuir com código, siga os passos abaixo:

1.  **Faça um Fork do Repositório:**
    Clique no botão "Fork" no canto superior direito da página do repositório no GitHub. Isso criará uma cópia do repositório na sua conta do GitHub.

2.  **Clone o Seu Fork Localmente:**
    ```bash
    git clone https://github.com/SEU_USUARIO/nexus-unified-v4.9.git
    cd nexus-unified-v4.9
    ```
    Substitua `SEU_USUARIO` pelo seu nome de usuário do GitHub.

3.  **Crie uma Nova Branch:**
    Crie uma branch descritiva para sua feature ou correção de bug.
    ```bash
    git checkout -b feature/nome-da-sua-feature
    # ou
    git checkout -b bugfix/descricao-do-bug
    ```

4.  **Faça Suas Alterações:**
    Escreva o código necessário para sua contribuição.

5.  **Testes:**
    *   Adicione testes unitários ou de integração para suas alterações sempre que possível. Os testes estão localizados no diretório `__tests__`.
    *   Certifique-se de que todos os testes existentes continuam passando executando `npm test`.
    *   Busque manter ou aumentar a cobertura de testes do projeto.

6.  **Convenções de Código:**
    *   Por favor, siga as convenções de código existentes no projeto.
    *   Mantenha suas linhas de código com um comprimento razoável (geralmente abaixo de 100-120 caracteres).
    *   Escreva comentários claros e concisos onde necessário.
    *   (Se houver um linter configurado, mencione: "Execute o linter para verificar seu código: `npm run lint`")

7.  **Faça o Commit das Suas Alterações:**
    Use mensagens de commit claras e descritivas.
    ```bash
    git add .
    git commit -m "Adiciona nova feature X"
    # ou
    git commit -m "Corrige bug Y na funcionalidade Z"
    ```

8.  **Envie Suas Alterações para o Seu Fork:**
    ```bash
    git push origin feature/nome-da-sua-feature
    ```

9.  **Abra um Pull Request (PR):**
    *   Vá para o repositório original no GitHub.
    *   Você verá uma mensagem sugerindo a criação de um Pull Request a partir da sua branch recém-enviada. Clique nesse botão.
    *   Preencha o template do Pull Request com uma descrição clara das suas alterações, o problema que elas resolvem e qualquer informação relevante para os revisores.
    *   Certifique-se de que seu PR está direcionado para a branch principal (geralmente `main` ou `master`) do repositório original.
    *   Referencie qualquer issue relacionada no seu PR (ex: "Closes #123").

## Revisão do Pull Request

Após abrir um PR, os mantenedores do projeto irão revisá-lo. Pode haver discussões e pedidos de alterações. Este é um processo colaborativo para garantir a qualidade do código.

Obrigado novamente por sua contribuição!
