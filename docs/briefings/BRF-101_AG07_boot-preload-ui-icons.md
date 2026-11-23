# BRF-101 — AG07 (Arquiteto) — T-078b Pré-carregar `ui_icons` (64×64) e Atualizar `portraits` (128×128) em `BootScene.ts`

**Leia:** [docs/agentes/AG07_Arquiteto.md](../agentes/AG07_Arquiteto.md), [src/view/scenes/BootScene.ts](../../src/view/scenes/BootScene.ts). **Regra:** respostas curtas; **PROIBIDO** editar `src/core/`, `src/view/ui/`, `DungeonScene.ts`, `tests/` ou executar `git`.

**Fazer (apenas em `src/view/scenes/BootScene.ts`):**
1. Atualizar a entrada `portraits` em `SPRITESHEET_SPECS` de `frameWidth: 64, frameHeight: 64` para `frameWidth: 128, frameHeight: 128`.
2. Adicionar em `SPRITESHEET_SPECS`:
   - `{ key: 'ui_icons', file: 'assets/sprites/ui_icons.png', frameWidth: 64, frameHeight: 64, fallbackColor: 0x334155 }`
3. Manter a inicialização atual (`DungeonScene` com `{ testArena: true }`) e a versão inalterada (`0.6.0`).

**Permitido:** `src/view/scenes/BootScene.ts`.
**Proibido:** qualquer outro arquivo e comandos `git`.

**Entrega:** até 4 linhas: alterações em `BootScene.ts` e revisão estática (`strict: true`).
