# BRF-047 — AG01 — T-046 Lógica Pura da Campanha (Prólogo → Ato 1) e Gerador de Masmorras por Estágio

**Leia:** `docs/agentes/AG01_Gameplay.md`, `src/core/index.ts`, `src/core/dungeon/DungeonGenerator.ts`, `src/core/dungeon/DungeonRun.ts`, `src/data/campaign.json`, `src/data/dialogues.json`, `src/data/monsters.json`. **Regra:** ZERO Phaser em `src/core/`; manter 100% de retrocompatibilidade nos testes existentes (`dungeon.test.ts`, `m1-integration.test.ts`); zero git commands.
**Decisão do dono:** Autorização explícita da `T-046` (M4 `v0.4.0`).
**Fazer:**
1. Criar `src/core/progression/CampaignManager.ts` (100% TypeScript puro):
   - `getCampaignCatalog(): CampaignCatalog` e `getCampaignStage(stageId: CampaignStageId): CampaignStageDef`.
   - `createDefaultCampaignProgress(): CampaignProgress` (`phase: 'prologue'`, `currentStageId: 'prologue_grotto'`, `completedStages: []`, `seenDialogues: []`, `villageFallTriggered: false`).
   - `ensureCampaignProgress(profile: SaveProfile): CampaignProgress` (inicializa `profile.campaign` se ausente).
   - `getAvailableStages(profile: SaveProfile): CampaignStageDef[]` (ordena estágios desbloqueados: na fase `'prologue'`, libera sequencialmente `prologue_grotto` → `prologue_mine` → `prologue_seal`; após `villageFallTriggered`/`act1`, libera também `act1_submundo`).
   - `getDialogueLine(id: string): DialogueLine | null` (lê `entries` de `src/data/dialogues.json`) e `markDialogueSeen(profile: SaveProfile, id: string): boolean`.
   - `applyStageOutcomeToCampaign(profile: SaveProfile, stageId: CampaignStageId, victory: boolean): { stage: CampaignStageDef; unlockedStageId?: CampaignStageId; triggeredVillageFall: boolean; newlyCompleted: boolean }` — em vitória no `prologue_seal` (`triggersFallOfVillage: true`), transiciona `phase = 'act1'`, `villageFallTriggered = true`, `currentStageId = 'act1_submundo'`.
   - `setCampaignStageOrPhase(profile: SaveProfile, phase: CampaignPhase, stageId?: CampaignStageId): void`.
2. Atualizar `src/core/dungeon/DungeonGenerator.ts` e `src/core/dungeon/DungeonRun.ts`:
   - Adicionar campos opcionais `biome?: BiomeId` e `difficultyScale?: number` em `RoomSpec` e `stageId?: CampaignStageId`, `biome?: BiomeId` em `DungeonRunState`.
   - Permitir parâmetro opcional `stage?: CampaignStageDef` em `generateDungeonRooms(arenaWidth, arenaHeight, seed, stage?)` e `createDungeonRun(arenaWidth, arenaHeight, seed, stage?)`:
     - Sem `stage`, comportamento **idêntico** ao atual (5 salas, `abyssal_slime`/`bone_sentinel`, boss `infernal_warden`, para preservar determinismo dos testes M1–M3).
     - Com `stage`, gera `stage.totalRooms` salas usando `stage.monsterPool`, `stage.bossId` na última sala e `stage.biome`/`stage.difficultyScale`.
3. Criar `tests/core/campaign.test.ts` testando: zero Phaser em `CampaignManager.ts`, progressão completa `prologue_grotto → prologue_mine → prologue_seal → Queda da Vila → act1_submundo`, `getDialogueLine` com `portraitId`, e geração determinística de salas com `CampaignStageDef`.
**Permitido:** `src/core/progression/CampaignManager.ts`, `src/core/dungeon/DungeonGenerator.ts`, `src/core/dungeon/DungeonRun.ts`, `tests/core/campaign.test.ts`.
**Proibido:** tocar `src/view/`, `src/core/index.ts`, `src/data/` ou executar comandos git.
**Pronto quando:** `npm run typecheck` e `npm test` passam 100% (incluindo novos testes em `campaign.test.ts`).
**Entrega:** até 5 linhas resumindo `CampaignManager.ts`, `DungeonRun` por estágio e novos testes.
