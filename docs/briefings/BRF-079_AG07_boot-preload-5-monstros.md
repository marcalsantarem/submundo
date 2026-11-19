# BRF-079 — AG07 (Arquiteto) — T-070a Pré-carregar 5 Spritesheets 80×80 dos Monstros (`BootScene.ts`)

**Leia:** [docs/agentes/AG07_Arquiteto.md](../agentes/AG07_Arquiteto.md), [src/view/scenes/BootScene.ts](../../src/view/scenes/BootScene.ts). **Regra:** respostas curtas; **PROIBIDO** editar `src/core/`, `DungeonScene.ts`, `tests/` ou executar `git`.

**Fazer (apenas em `src/view/scenes/BootScene.ts`):**
1. Atualizar a entrada `cave_bat` em `SPRITESHEET_SPECS` de `frameWidth: 32, frameHeight: 32` para `frameWidth: 80, frameHeight: 80`.
2. Adicionar as 4 novas entradas em `SPRITESHEET_SPECS` (todas `frameWidth: 80, frameHeight: 80`):
   - `{ key: 'slime', file: 'assets/sprites/slime.png', frameWidth: 80, frameHeight: 80, fallbackColor: 0x22c55e }`
   - `{ key: 'wolf', file: 'assets/sprites/wolf.png', frameWidth: 80, frameHeight: 80, fallbackColor: 0x94a3b8 }`
   - `{ key: 'skeleton', file: 'assets/sprites/skeleton.png', frameWidth: 80, frameHeight: 80, fallbackColor: 0xe2e8f0 }`
   - `{ key: 'skeleton_archer', file: 'assets/sprites/skeleton_archer.png', frameWidth: 80, frameHeight: 80, fallbackColor: 0x65a30d }`
3. Manter `BootScene.create()` iniciando `DungeonScene` com `{ testArena: true }`, e **não** alterar a versão (`0.5.0`) ainda.

**Permitido:** `src/view/scenes/BootScene.ts`.
**Proibido:** qualquer outro arquivo e comandos `git`.

**Entrega:** até 5 linhas: (1) alterações em `BootScene.ts`, (2) revisão estática (`strict: true`).
