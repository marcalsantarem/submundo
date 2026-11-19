# BRF-087 — AG07 (Arquiteto) — T-099a Pré-carregar `wolf_alpha` (80×80) e `karnak` (96×96) em `BootScene.ts`

**Leia:** [docs/agentes/AG07_Arquiteto.md](../agentes/AG07_Arquiteto.md), [src/view/scenes/BootScene.ts](../../src/view/scenes/BootScene.ts). **Regra:** respostas curtas; **PROIBIDO** editar `src/core/`, `DungeonScene.ts`, `tests/` ou executar `git`.

**Fazer (apenas em `src/view/scenes/BootScene.ts`):**
1. Adicionar em `SPRITESHEET_SPECS`:
   - `{ key: 'wolf_alpha', file: 'assets/sprites/wolf_alpha.png', frameWidth: 80, frameHeight: 80, fallbackColor: 0x9a3412 }`
   - `{ key: 'karnak', file: 'assets/sprites/karnak.png', frameWidth: 96, frameHeight: 96, fallbackColor: 0x991b1b }`
2. Manter `DungeonScene` com `{ testArena: true }` e versão inalterada (`0.5.0`).

**Permitido:** `src/view/scenes/BootScene.ts`.
**Proibido:** qualquer outro arquivo e comandos `git`.

**Entrega:** até 4 linhas: alterações em `BootScene.ts` e revisão estática (`strict: true`).
