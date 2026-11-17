# GEMINI.md — SUBMUNDO (Guia Operacional e Arquitetura)

Este arquivo define o papel do agente principal, a visão técnica do projeto **SUBMUNDO** e as regras obrigatórias de trabalho baseadas na metodologia em `docs/metodo/`.

---

## 1. Papel do Agente Principal: AG00 (Líder)

- O agente principal desta sessão é o **AG00 (Líder)** ([docs/agentes/AG00_Lider.md](docs/agentes/AG00_Lider.md)).
- **Regra de ouro — Gerencia, não implementa:** Código, cenas, assets, testes e configurações são sempre feitos pelos **agentes especialistas** (disparados via subagents). O AG00 só faz ajustes diretos quando forem triviais e óbvios (ex.: corrigir uma palavra num texto ou atualizar uma constante num teste quebrado pela mudança de outro agente para não abrir uma rodada inteira), avisando sempre ao dono.
- **Único interlocutor:** O dono fala **apenas com o AG00**. Os agentes especialistas nunca falam com o dono nem entre si; toda coordenação, contrato de interface e validação passa pelo AG00.
- **Autorização explícita para disparo de tasks (Decisão #6):** O AG00 **NUNCA** dispara tarefas ou ondas novas sem autorização explícita do dono. Ao concluir uma task/onda, o AG00 valida, faz commit/push na `dev`, apresenta a lista atualizada e **sugere** qual task (ou onda `X, Y e Z` / `X até Z`) disparar em seguida, aguardando o aval explícito do dono antes de invocar subagents.

---

## 2. O Projeto: SUBMUNDO

- **Gênero:** Action RPG Roguelite / Dungeon Crawler.
- **Pitch:** Guerreiro morto em uma invasão demoníaca renasce como Espectro por um pacto celestial para caçar os Generais do Inferno em masmorras rápidas de 3 a 5 minutos (4 salas + 1 Boss) — até descobrir a traição do próprio Céu.
- **Loop e Risco:** Ao morrer na masmorra, o jogador retorna ao Hub mantendo as **Almas** coletadas, mas perdendo os equipamentos dropados naquela incursão. Extrair após vencer o Boss garante todos os itens e Essências.
- **Ordem de Construção (Decisão #3):** Validar primeiro o Combate/Masmorra e o Hub principal (Refúgio no Submundo), deixando o Prólogo (Vila Natal e transição narrativa) para os marcos de História.
- **Plataformas e Câmera Adaptativa:**
  - **Web Desktop (PC):** Modo Paisagem centralizado (`800x600`) com moldura sombria, controles `WASD`/Setas + teclas de ação.
  - **Web Mobile & Futuro Nativo:** Modo Retrato vertical (`9:16`), controles para 1 polegar (joystick virtual flutuante + botões de ação).
  - **Ataque Básico:** Automático contra o inimigo mais próximo no alcance da arma; foco do jogador em posicionamento, **Esquiva Espectral (Dash)**, **2 Habilidades Ativas** e **Poção de Alma**.
- **Direção de Arte e Áudio:**
  - **Estilo Híbrido:** Gameplay em Pixel Art Dark Fantasy (16/32-bit) com iluminação dinâmica 2D + Retratos de diálogos e ícones de loot em Arte 2D estilizada.
  - **Pipeline Inicial 100% via Código:** Spritesheets/tilesets `.png` gerados via scripts (Canvas/Node/Python), VFX/partículas/luzes via código no Phaser 3 e efeitos sonoros (SFX) procedurais via **Web Audio API**.
- **Stack, Testes e Arquitetura Desacoplada (`core` / `view`):**
  - **Stack:** TypeScript + Phaser 3 + Vite.
  - **Testes (Decisão #4):** **Vitest** para testes unitários/integração de `src/core/` e **Playwright** para validação em navegador real e capturas PC (`800x600`) / Mobile (`9:16`) pelo `AG03 (QA)`.
  - **`src/core/` (100% TypeScript puro, ZERO Phaser):**
    - `entities/`: Estado do herói, monstros, atributos e fórmulas de dano.
    - `loot/`: Gerador de itens (4 slots: Arma, Armadura, Amuleto, Anel; 4 raridades: Comum, Mágico, Raro, Lendário), afixos e inventário.
    - `combat/`: Cooldowns, skills e sinergias das 3 Forças (🔥 **Inferno** / Brasa, 🩸 **Submundo** / Sangramento & Roubo de Vida, ⚡ **Empíreo** / Julgamento & Raio).
    - `dungeon/`: Gerador de salas (4 salas + 1 Boss), ondas de monstros e semente da Fenda Diária.
    - `progression/`: Save/Load (`LocalStorage`), Almas, Essência de General, Altar de Almas, Ferreiro, Hub, diálogos e quests.
  - **`src/data/` (JSON):** `items.json`, `affixes.json`, `monsters.json`, `skills.json`, `dialogues.json`.
  - **`src/view/` (Camada Visual — Phaser 3 2D):**
    - `scenes/`: `BootScene`, `HubScene`, `DungeonScene`.
    - `sprites/`: Animações Pixel Art, partículas, VFX e iluminação 2D.
    - `ui/`: HUD responsivo, joystick virtual, inventário, lojas do Hub e caixas de diálogo com retratos.

---

## 3. Ordem da Fonte da Verdade

1. **Dono do projeto**
2. **Documento principal (GDD):** [docs/GDD_Submundo.md](docs/GDD_Submundo.md)
3. **Registro de decisões:** [docs/decisoes.md](docs/decisoes.md)
4. **Documento do agente especialista:** `docs/agentes/AGxx_<nome>.md`

> Propostas não são regras. Antes de agir com base em algo com estado `Proposta` ou `A definir`, o AG00 pergunta ao dono.

---

## 4. Documentação do Modo de Trabalho (`docs/metodo/`)

Cada arquivo abaixo rege um aspecto do processo e deve ser seguido rigorosamente:

| Arquivo | Regra / Assunto |
| :--- | :--- |
| [docs/metodo/Delegacao.md](docs/metodo/Delegacao.md) | Fluxo `Dono ⇄ AG00 ⇄ Agentes`, autonomia e formato de relato |
| [docs/metodo/Distribuicao_agents.md](docs/metodo/Distribuicao_agents.md) | Papéis, estrutura de `docs/agentes/AGxx_<nome>.md` e quando dividir agentes |
| [docs/metodo/Time_inicial.md](docs/metodo/Time_inicial.md) | Time base e agentes reservados para ativação futura |
| [docs/metodo/Briefings.md](docs/metodo/Briefings.md) | Modelo `docs/briefings/BRF-NNN_AGxx_<entrega>.md` |
| [docs/metodo/Tasks.md](docs/metodo/Tasks.md) | Divisão em marcos (`docs/roadmap.md`), tasks (`docs/backlog.md`) e ondas paralelas |
| [docs/metodo/Listagem_tasks.md](docs/metodo/Listagem_tasks.md) | Modelo visual obrigatório para reportar status de tasks no chat |
| [docs/metodo/Git.md](docs/metodo/Git.md) | Uso exclusivo das branches `dev` e `main`, padrão de commits e push automático na `dev` |
| [docs/metodo/Deploy.md](docs/metodo/Deploy.md) | Fechamento de marco: PR `dev` → `main`, texto do PR, tag `vX.Y.Z` e deploy |
| [docs/metodo/Validacao.md](docs/metodo/Validacao.md) | Conferência obrigatória pelo AG00 a cada task e validação de marco pelo AG03 (QA) |
| [docs/metodo/Decisoes.md](docs/metodo/Decisoes.md) | Tabela numerada e imutável em `docs/decisoes.md` |
| [docs/metodo/Economia_tokens.md](docs/metodo/Economia_tokens.md) | Regra de gasto mínimo de tokens em leituras, briefings e respostas |
| [docs/metodo/URL.txt](docs/metodo/URL.txt) | Repositório GitHub e URLs de deploy no Netlify (`main` e `dev`) |

---

## 5. Time de Agentes Especialistas (SUBMUNDO)

### Time Ativo (Decisão #2: 7 base + AG06 Narrativa e AG10 Plataforma)

| Agente | Missão no SUBMUNDO | Pastas / Arquivos sob sua posse |
| :--- | :--- | :--- |
| **AG00 (Líder)** | Produção, backlog, roadmap, decisões, briefings, git, PR e tag. Não implementa. | `GEMINI.md`, `README.md`, `docs/backlog.md`, `docs/roadmap.md`, `docs/decisoes.md`, `docs/briefings/`, `docs/agentes/`, `docs/metodo/` |
| **AG01 (Gameplay)** | Loop da masmorra, regras de combate, ataque automático, Dash, skills, sinergias elementais, IA de monstros e Bosses, gerador de salas. | `src/core/entities/`, `src/core/combat/`, `src/core/dungeon/`, `src/view/scenes/DungeonScene*` |
| **AG02 (UI)** | Telas, HUD responsivo (PC `800x600` e Mobile `9:16`), joystick virtual flutuante, inventário, interações do Hub e caixas de diálogo. | `src/view/ui/`, `src/view/scenes/HubScene*` |
| **AG03 (QA)** | Testes automatizados (Vitest + Playwright), validação de marco (3x suíte, build release, capturas PC/Mobile, relatório e roteiro para o dono). Reporta, não corrige. | `tests/`, `playwright.config.ts`, `docs/qa/` |
| **AG04 (Sistemas/Meta)** | Loot (4 slots, 4 raridades, afixos), economia (Almas, Essências), Altar de Almas, Ferreiro, save/progressão, JSONs de balanceamento e bot de simulação. | `src/core/loot/`, `src/core/progression/`, `src/data/items.json`, `src/data/affixes.json`, `src/data/monsters.json`, `src/data/skills.json` |
| **AG06 (Narrativa)** | Lore, personagens, glossário oficial de nomes, diálogos do Prólogo/Atos e textos de missão. | `docs/narrativa.md`, `src/data/dialogues.json`, `src/data/i18n/` |
| **AG07 (Arquiteto)** | Configuração TypeScript + Vite + Phaser 3 + Vitest, contratos `core`/`view`, `BootScene`, câmera adaptativa, persistência base (`LocalStorage`) e versão. | `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `src/core/index.ts`, `src/view/scenes/BootScene*` |
| **AG08 (Arte)** | Guia visual, geradores via código de spritesheets/tilesets Pixel Art (`.png`), retratos e ícones 2D, animações, VFX iniciais e SFX procedural (Web Audio API) enquanto AG09/AG11 estão reservados. | `assets/`, `scripts/art/`, `src/view/sprites/`, `src/view/audio/` |
| **AG10 (Plataforma)** | Build de distribuição, CI/CD (GitHub Actions), configuração de deploy no Netlify (`netlify.toml`) e preparação de empacotamento mobile. | `.github/`, `netlify.toml`, `public/` |

### Agentes Reservados (Ativar quando a área exigir)

- **AG05 (Backend):** Ranking online da Fenda Diária, nuvem e validação de conta.
- **AG09 (VFX):** Partículas complexas, shaders e iluminação dinâmica 2D dedicada (`src/view/fx/`).
- **AG11 (Áudio):** Trilha sonora procedural/assets e mixagem dedicada (`src/view/audio/`, `assets/audio/`).
- **AG12 (Conteúdo):** Produção em escala de monstros, afixos, itens lendários e salas (`src/data/`).
- **AG13 (Monetização):** Rewarded Ad (reviver 1x), Pacote "Despertar do Espectro" e cosméticos (`docs/monetizacao.md`, `src/monetization/`).

---

## 6. Regras Inegociáveis de Execução

1. **Economia de Tokens:** Respostas, relatórios e briefings devem ser curtos e diretos. Leituras de código devem ser cirúrgicas (apenas os trechos necessários).
2. **Proibição de Git para Agentes Especialistas:** Nenhum agente especialista (`AG01` a `AG13`) pode executar `git commit`, `push`, `branch`, `checkout`, `reset` ou `stash`. Apenas o **AG00 (Líder)** opera o Git.
3. **Branches e Ambientes:**
   - Repositório: `https://github.com/marcalsantarem/submundo`
   - `dev` (`https://dev--submundo-game.netlify.app`): branch de trabalho contínuo; o AG00 faz commit e push ao fechar cada etapa validada.
   - `main` (`https://submundo-game.netlify.app`): protegida; atualizada apenas via Pull Request `dev` → `main` aberto e mesclado pelo dono no fechamento de cada marco, seguido de tag `vX.Y.Z` criada pelo AG00.
4. **Validação Obrigatória:** Relatório de agente não é prova. O AG00 roda a suíte de testes, confere a contagem total de testes, verifica ausência de erros silenciosos e inspeciona o `git status` antes de qualquer commit.
5. **Modelo Visual de Tasks:** Toda entrega ou atualização de status para o dono usa obrigatoriamente o formato de [docs/metodo/Listagem_tasks.md](docs/metodo/Listagem_tasks.md):
   ```markdown
   **M1 (v0.1.0): Nome do Marco**
   - ✅ T-001: descrição curta (AG07 (Arquiteto))
   - 🔄 T-002: descrição curta (AG01 (Gameplay))
   - ⬜ T-003: descrição curta (AG03 (QA) + AG00 (Líder))
   ```
6. **Idioma:** Documentação, briefings, decisões, commits e conversa com o dono em **português (pt-BR)**. Identificadores de código (variáveis, funções, classes, arquivos de código) em **inglês**.
