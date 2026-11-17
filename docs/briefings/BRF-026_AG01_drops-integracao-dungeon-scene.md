# BRF-026 — AG01 — T-020 Drops físicos, coleta e sinergias em tempo real na DungeonScene

**Leia:** `docs/agentes/AG01_Gameplay.md`, `src/core/loot/LootGenerator.ts`, `src/core/loot/Inventory.ts`, `src/core/combat/CombatEngine.ts`, `src/view/sprites/CombatVfx.ts`, `src/view/ui/InventoryModal.ts`, `src/view/ui/DungeonHud.ts`, `src/view/scenes/BootScene.ts`, `src/view/scenes/DungeonScene.ts`. **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono:** Autorização explícita da `T-020` (M2 `v0.2.0`).
**Fazer:**
1. Em `src/view/scenes/BootScene.ts`: carregar também `loot_icons.png` (`16x16`) e `loot_drops.png` (`16x16`) de `/assets/sprites/` (com texturas de fallback caso falhem).
2. Em `src/view/scenes/DungeonScene.ts`:
   - Instanciar `RunInventoryState` (`createRunInventory`) e `InventoryModal`.
   - Ao matar monstros/Boss (`monster_killed`), consultar `shouldDropLoot` / `generateItemDrop` e spawnar drop físico no chão com sprite `loot_drops` (frame por raridade) + `vfx.showLootDropBeam`.
   - Coletar automaticamente ao herói se aproximar (`<= 34px`), chamando `addItemToBag`, `vfx.showItemPickupBanner`, e se o slot estiver vazio equipar automaticamente (ou equipar manualmente pelo `InventoryModal`, recalculando `applyGearToHero`, `equippedForces`, `activeLegendaryPowers`, `lifeSteal`, `cooldownReduction` e `luck`).
   - Renderizar `CombatVfxManager` para os novos eventos (`ember_explosion`, `lightning_chain`, `bleed_tick`, `lifesteal_heal`, `minion_spawned`) e sprites/marcadores dos `SpectralMinion` ativos.
   - Ao encerrar a run (`victory` ou `defeat`), chamar `resolveRunEndLoot` para consolidar espólios mantidos vs. perdidos e preencher `lootSummaryText` no `DungeonHud`.
   - Pausar ticks de combate enquanto o `InventoryModal` estiver aberto; expor no `window.__SUBMUNDO_DEBUG__` helpers leves (`getInventory: () => this.inventory`, `spawnTestDrop: (rarity?) => ...`, `equipItem: (id) => ...`).
**Permitido:** `src/view/scenes/BootScene.ts`, `src/view/scenes/DungeonScene.ts`.
**Proibido:** `src/core/`, `src/view/ui/`, `src/view/sprites/`, `src/data/`, `tests/` e comandos git.
**Pronto quando:** `npm run typecheck`, `npm test` e `npm run build` passarem 100% verdes.
**Entrega:** até 6 linhas: arquivos alterados, fluxos integrados e resultado de `typecheck`/`test`/`build`.
