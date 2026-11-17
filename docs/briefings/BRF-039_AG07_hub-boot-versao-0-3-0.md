# BRF-039 — AG07 — T-037 Registrar HubScene, BootScene e subir versão para 0.3.0

**Leia:** `docs/agentes/AG07_Arquiteto.md`, `src/main.ts`, `src/view/scenes/BootScene.ts`, `src/version.ts`, `package.json`, `tests/core/architecture.test.ts`, `tests/e2e/m1-dungeon.spec.ts`, `tests/e2e/m2-loot.spec.ts`. **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono:** Autorização explícita da `T-037` (M3 `v0.3.0`).
**Fazer:**
1. `src/view/scenes/BootScene.ts`:
   - Adicionar `hub_tiles` (`assets/sprites/hub_tiles.png`, `16x16`) e `hub_npcs` (`assets/sprites/hub_npcs.png`, `32x32`) ao `SPRITESHEET_SPECS` com fallback.
   - Iniciar `'HubScene'` quando registrada (`if ('HubScene' in this.scene.manager.keys) this.scene.start('HubScene'); else if ('DungeonScene' ...)`).
2. `src/main.ts`: registrar `HubScene` em `createGameConfig`: `scene: [BootScene, HubScene, DungeonScene]`.
3. Subir versão para `0.3.0` em `package.json`, `src/version.ts` e `tests/core/architecture.test.ts` (e conferir se `tests/e2e/m1-dungeon.spec.ts` / `tests/e2e/m2-loot.spec.ts` continuam compatíveis caso entrem pelo `HubScene`, ajustando a transição `enterDungeon()` antes de checar `DungeonScene` se necessário!).
**Permitido:** `src/main.ts`, `src/view/scenes/BootScene.ts`, `package.json`, `src/version.ts`, `tests/core/architecture.test.ts`, `tests/e2e/m1-dungeon.spec.ts`, `tests/e2e/m2-loot.spec.ts`.
**Proibido:** `src/core/`, `src/view/scenes/HubScene.ts`, `src/view/scenes/DungeonScene.ts`, `src/view/ui/`, `src/data/` e comandos git.
**Pronto quando:** `npm run typecheck`, `npm test` (todos verdes!) e `npm run build` passarem 100% verdes.
**Entrega:** até 6 linhas: arquivos alterados e resultado de `typecheck`/`test`/`build`.
