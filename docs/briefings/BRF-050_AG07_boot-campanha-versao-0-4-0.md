# BRF-050 — AG07 — T-049 Pré-carregar Assets M4 no BootScene e Versão 0.4.0

**Leia:** `docs/agentes/AG07_Arquiteto.md`, `src/view/scenes/BootScene.ts`, `src/version.ts`, `package.json`, `tests/core/architecture.test.ts`, `tests/e2e/m1-dungeon.spec.ts`, `tests/e2e/m2-loot.spec.ts`, `tests/e2e/m3-hub.spec.ts`. **Regra:** respostas curtas; zero git commands.
**Decisão do dono:** Autorização explícita da `T-049` (M4 `v0.4.0`).
**Fazer:**
1. Atualizar `src/view/scenes/BootScene.ts`:
   - Adicionar a `SPRITESHEET_SPECS` os novos spritesheets do M4:
     - `portraits`: `assets/sprites/portraits.png` (`64x64`)
     - `village_tiles`: `assets/sprites/village_tiles.png` (`16x16`)
     - `village_npcs`: `assets/sprites/village_npcs.png` (`32x32`)
     - `cave_bat`: `assets/sprites/cave_bat.png` (`32x32`)
2. Subir a versão do projeto para `'0.4.0'` em:
   - `package.json` (`"version": "0.4.0"`)
   - `src/version.ts` (`GAME_VERSION = '0.4.0'`)
   - `tests/core/architecture.test.ts` (teste `exports GAME_VERSION as 0.4.0`)
3. Atualizar `tests/e2e/m1-dungeon.spec.ts`, `tests/e2e/m2-loot.spec.ts` e `tests/e2e/m3-hub.spec.ts` para refletir `SUBMUNDO v0.4.0` e compatibilizar o novo fluxo inicial do Prólogo (ex.: em M1/M2/M3 chamar `setCampaignPhase('act1', 'act1_submundo')` / `enterDungeon('act1_submundo')` onde o teste assume o Refúgio do Ato 1 / 5 salas do `infernal_warden`).
**Permitido:** `src/view/scenes/BootScene.ts`, `package.json`, `src/version.ts`, `tests/core/architecture.test.ts`, `tests/e2e/m1-dungeon.spec.ts`, `tests/e2e/m2-loot.spec.ts`, `tests/e2e/m3-hub.spec.ts`.
**Proibido:** tocar `HubScene.ts`, `DungeonScene.ts`, `src/core/`, `src/data/` ou executar comandos git.
**Pronto quando:** `npm run typecheck`, `npm run build` e `npm test` 100% verdes.
**Entrega:** até 5 linhas resumindo `BootScene`, versão `0.4.0` e resultados da suíte.
