# BRF-094 — AG01 (Gameplay) — T-103b Integrar `skeleton_chief` na `CombatVfx.ts` e Onda 2 da `testArena`

**Leia:** [docs/agentes/AG01_Gameplay.md](../agentes/AG01_Gameplay.md), [src/view/sprites/CombatVfx.ts](../../src/view/sprites/CombatVfx.ts), [src/view/scenes/DungeonScene.ts](../../src/view/scenes/DungeonScene.ts). **Regra:** respostas curtas; **PROIBIDO** editar `BootScene.ts`, `src/core/`, `tests/` ou executar `git`.

**Fazer:**
1. **`src/view/sprites/CombatVfx.ts`:**
   - Adicionar `...createMonsterAnimSpecs('skeleton_chief', 6, 10)` em `ANIMATION_SPECS` e `'skeleton_chief'` em `ANIMATED_MONSTER_KEYS`.
2. **`src/view/scenes/DungeonScene.ts`:**
   - Adicionar `'skeleton_chief'` em `ANIMATED_SPRITESHEET_MONSTERS`, em `ensureCampaignFallbackTextures()` (`80×80`), e `offsetY = 38` na barra de HP.
   - Adicionar `{ id: 'skeleton_chief', dx: 0, dy: 95 }` em `TEST_ARENA_WAVE_2` (junto com `wolf_alpha` e `karnak`!) e atualizar o banner da Onda 2 para `'Onda 2: Bosses & Esqueleto Chefe!'`.

**Permitido:** `src/view/sprites/CombatVfx.ts`, `src/view/scenes/DungeonScene.ts`.
**Proibido:** `BootScene.ts`, `src/core/`, `tests/`, e qualquer comando `git`.

**Entrega:** até 5 linhas: alterações feitas e revisão estática (`strict: true`).
