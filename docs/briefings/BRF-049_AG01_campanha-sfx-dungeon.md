# BRF-049 — AG01 — T-048 Estágios da Campanha, Biomas, Queda da Vila e SFX na DungeonScene

**Leia:** `docs/agentes/AG01_Gameplay.md`, `src/core/progression/CampaignManager.ts`, `src/core/dungeon/DungeonRun.ts`, `src/view/audio/SoundManager.ts`, `src/view/scenes/DungeonScene.ts`, `src/view/sprites/CombatVfx.ts`, `src/view/ui/DungeonHud.ts`. **Regra:** manter compatibilidade da `window.__SUBMUNDO_DEBUG__` e dos testes E2E M1/M2/M3; zero git commands.
**Decisão do dono:** Autorização explícita da `T-048` (M4 `v0.4.0`).
**Fazer:**
1. **`src/view/sprites/CombatVfx.ts`:**
   - Registrar animação `'bat_idle'` usando spritesheet `'cave_bat'` (frames `[0, 1]`, `frameRate: 6`, `repeat: -1`), com fallback seguro caso a textura não esteja carregada.
2. **`src/view/ui/DungeonHud.ts`:**
   - Adicionar botão discreto de Mute (`Som`) integrado ao `soundManager.toggleMute()` e exibir opcionalmente o nome do estágio no topo quando informado no snapshot (`stageName?: string`).
3. **`src/view/scenes/DungeonScene.ts`:**
   - Aceitar `data?: { profileSnapshot?: SaveProfile; stageId?: CampaignStageId }` em `create` e `startNewRun`.
   - Resolver `activeStage = getCampaignStage(data?.stageId ?? ensureCampaignProgress(this.activeProfile).currentStageId)` e passar `activeStage` para `createDungeonRun(arenaWidth, arenaHeight, seed, activeStage)`.
   - Aplicar `room.difficultyScale ?? 1` ao spawnar monstros da sala (`maxHp` e `attack` proporcionais, mantendo `1.0` exato para `act1_submundo`).
   - Adaptar visual/iluminação da arena ao `biome` da sala (`village_grotto` musgo/água, `village_mine` pedra de mina, `ancient_seal` selo rúnico carmesim, `submundo_abyss` abissal atual) usando `village_tiles` nos biomas da vila ou `dungeon_tiles` no Submundo.
   - Suportar `cave_bat` (animação `bat_idle`) e `abyss_herald` (usa `infernal_warden` com tint carmesim/escala 1.75 e barra de Boss).
   - Em `finalizeRunOutcome`:
     - Só conceder `+1 Essência de General` quando vencer o Boss do Ato 1 (`infernal_warden` em `act1_submundo`).
     - Chamar `applyStageOutcomeToCampaign(this.activeProfile, this.activeStage.id, victory)` antes de `persistProfile(this.activeProfile)`.
     - Gravar `stageId: this.activeStage.id` e `triggeredVillageFall` no `RunEndReport` e destacá-lo no banner final caso ocorra a Queda da Vila (`prologue_seal`).
   - Integrar `soundManager.unlock()` no primeiro input e disparar `soundManager.play(...)` nos eventos de combate (`attack`, `crit`, `dash`, `skill_inferno`, `skill_submundo`, `skill_empireo`, `potion`, `loot_drop`, `loot_legendary`, `soul_pickup`, `hit_player`, `victory`, `defeat`, `ui_click`).
**Permitido:** `src/view/scenes/DungeonScene.ts`, `src/view/sprites/CombatVfx.ts`, `src/view/ui/DungeonHud.ts`.
**Proibido:** alterar `src/core/`, `src/data/`, `HubScene.ts`, `BootScene.ts` ou executar comandos git.
**Pronto quando:** `npm run typecheck` e `npm run build` limpos (0 erros).
**Entrega:** até 5 linhas resumindo integração de estágios/biomas, transição da Queda da Vila e SFX na `DungeonScene`.
