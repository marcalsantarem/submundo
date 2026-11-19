# BRF-072 — AG07 (Arquiteto) — T-092a Entrada Direta na Dungeon Escura de Teste (`BootScene.ts`)

**Leia:** [docs/agentes/AG07_Arquiteto.md](../agentes/AG07_Arquiteto.md), [src/view/scenes/BootScene.ts](../../src/view/scenes/BootScene.ts). **Regra:** respostas curtas; **PROIBIDO** editar `src/core/`, `src/view/scenes/DungeonScene.ts`, `tests/` ou executar `git`.

**Decisão do dono (Decisão #10):** O jogo deve entrar diretamente em uma dungeon escura de teste apenas com o Herói na forma humana (`hero_living`), para adicionar monstros e a nova UI de forma controlada.

**Contrato (com AG01 na T-092b):**
- Em `src/view/scenes/BootScene.ts`, quando `'DungeonScene' in this.scene.manager.keys`, iniciar diretamente `this.scene.start('DungeonScene', { testArena: true });` (em vez de `HubScene`).

**Fazer (apenas em `src/view/scenes/BootScene.ts`):**
1. Alterar a transição ao final de `create()` para iniciar `DungeonScene` com `{ testArena: true }` quando `'DungeonScene'` estiver registrada (mantendo `HubScene` intacta no projeto para reuso futuro).
2. Garantir que `hero_living` e `weapons` continuam pré-carregados normalmente em `SPRITESHEET_SPECS`.

**Permitido:** `src/view/scenes/BootScene.ts`.
**Proibido:** qualquer outro arquivo e comandos `git`.

**Pronto quando:** `BootScene.ts` inicia `DungeonScene` com `{ testArena: true }` sem erros de tipo.

**Entrega:** até 5 linhas: (1) alteração feita, (2) revisão estática (`strict: true`).
