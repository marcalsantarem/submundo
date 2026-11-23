# BRF-149 — AG04 (Sistemas/Meta): Lógica Pura do Hub da Vila Natal (`T-136`)

## Contexto
Onda A do **M9 (`v0.9.0`: Novo hub funcional)** conforme **Decisão #23**. Precisamos da lógica pura (`src/core/progression/`, ZERO Phaser) que rege o fluxo da Vila Natal no prólogo:
1. O **portão de saída** começa travado para a próxima missão até o jogador **falar com o Mestre de Armas** (`"Falar com o Mestre"` + marcador `"!"` sobre o Mestre).
2. Ao falar com o Mestre, o portão é liberado e passa a abrir a **lista das dungeons do prólogo** (`prologue_grotto`, `prologue_mine`, `prologue_seal`), mostrando o status real de cada uma a partir do save da campanha: **liberada (`available`)**, **travada (`locked`)** ou **concluída (`completed`)**.
3. Ao terminar ou morrer numa dungeon e voltar à Vila, o herói retorna **no portão** (`returnSpawnPoint: 'gate'`).

## Arquivos sob sua posse
- `src/core/progression/VillageHubManager.ts` (criar novo — 100% TypeScript puro, ZERO Phaser)
- `tests/core/village-hub.test.ts` (criar novo — cobertura completa Vitest)

## Especificações Obrigatórias
1. **Reaproveitar `CampaignManager.ts` e `SaveProfile` sem quebrar saves existentes** (não precisa alterar `src/core/index.ts`; persistir o estado "falou com o Mestre para o estágio atual" dentro de `campaign.seenDialogues` usando chave determinística `village_master_brief_${stageId}` via `markDialogueSeen` / `ensureCampaignProgress`).
2. **Contratos a exportar em `src/core/progression/VillageHubManager.ts`:**
   - `export type VillageNpcId = 'weapon_master' | 'lyra' | 'gorran';`
   - `export type VillageDungeonStatus = 'available' | 'locked' | 'completed';`
   - `export type VillageReturnSpawn = 'center' | 'gate';`
   - `export const PROLOGUE_STAGE_IDS: readonly CampaignStageId[] = ['prologue_grotto', 'prologue_mine', 'prologue_seal'];`
   - `export interface VillageDungeonEntry { stage: CampaignStageDef; status: VillageDungeonStatus; canEnter: boolean; isNextMission: boolean; }`
   - `export interface VillageHubState { nextStageId: CampaignStageId | null; masterSpoken: boolean; gateUnlocked: boolean; showMasterExclamation: boolean; trackerText: string; dungeons: VillageDungeonEntry[]; spawnPoint: VillageReturnSpawn; }`
   - `getMasterBriefKey(stageId: CampaignStageId): string`
   - `getNextPrologueStageId(profile: SaveProfile): CampaignStageId | null` (primeira fase de `PROLOGUE_STAGE_IDS` que ainda não está em `completedStages`, ou `null` se todas concluídas)
   - `hasSpokenToMasterForCurrentMission(profile: SaveProfile): boolean` (verdadeiro se já falou com o Mestre para a próxima missão, ou se todas as fases do prólogo já foram concluídas)
   - `markSpokenToMaster(profile: SaveProfile): { gateUnlocked: boolean; nextStageId: CampaignStageId | null; dialogueId: string }` (marca a chave no save e retorna o `dialogueId` correspondente: `'village_master_prologue_grotto'`, `'village_master_prologue_mine'`, `'village_master_prologue_seal'` ou `'village_master_idle'`)
   - `getPrologueDungeonList(profile: SaveProfile): VillageDungeonEntry[]` (lista sempre as 3 dungeons do prólogo na ordem: `'completed'` se em `completedStages`; `'available'` se desbloqueada pela progressão; `'locked'` caso contrário. `canEnter` é `true` apenas se `status !== 'locked'` **e** `gateUnlocked` for `true` — ou se a fase já foi concluída e o portão está liberado)
   - `resolveVillageHubState(profile: SaveProfile, options?: { returnedFromDungeon?: boolean }): VillageHubState` (`spawnPoint: options?.returnedFromDungeon ? 'gate' : 'center'`; `trackerText`: `'Falar com o Mestre'` quando `!masterSpoken` e `nextStageId !== null`, ou `'Ir ao Portão — ' + stage.name` quando liberado).
3. **Testes em `tests/core/village-hub.test.ts`:**
   - Garantir zero import de Phaser em `VillageHubManager.ts`.
   - Testar perfil novo: `masterSpoken === false`, `gateUnlocked === false`, `showMasterExclamation === true`, `trackerText === 'Falar com o Mestre'`, `spawnPoint === 'center'`, Gruta `available` (`canEnter: false`), Mina e Selo `locked`.
   - Testar `markSpokenToMaster`: libera portão, remove `"!"`, atualiza tracker e permite entrar na Gruta (`canEnter: true`), mantendo Mina e Selo `locked`.
   - Testar após concluir Gruta: Gruta `completed`, Mina passa a ser a próxima missão (`available`), Mestre volta a exibir `"!"` para a nova missão até o jogador falar com ele novamente.
   - Testar retorno de dungeon (`returnedFromDungeon: true`): `spawnPoint === 'gate'`.

## Restrições
- 100% TypeScript puro (`strict: true`), ZERO import de Phaser.
- Não tocar em `src/core/index.ts`, `src/view/` nem em `src/data/`.
- **PROIBIDO** executar comandos `git`.
- Relato curto ao AG00: arquivos criados, contratos exportados, validação realizada e o que não foi testado.
