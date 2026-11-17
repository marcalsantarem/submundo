# BRF-042 — AG07 — T-041 Contratos da Campanha (Prólogo + Ato 1) e Retratos 2D

**Leia:** `docs/agentes/AG07_Arquiteto.md`, `docs/GDD_Submundo.md` (seção 2), `src/core/index.ts`. **Regra:** respostas curtas; zero Phaser em `src/core/`; zero git commands.
**Decisão do dono:** Autorização explícita da `T-041` (M4 `v0.4.0`).
**Fazer:**
Adicionar ao final de `src/core/index.ts` os contratos oficiais do M4 (mantendo 100% dos tipos existentes intactos):
1. Tipos de Campanha e Retratos:
   - `export type CampaignPhase = 'prologue' | 'act1';`
   - `export type CampaignStageId = 'prologue_grotto' | 'prologue_mine' | 'prologue_seal' | 'act1_submundo';`
   - `export type PortraitId = 'hero_living' | 'hero_wraith' | 'weapon_master' | 'village_blacksmith' | 'emissary' | 'spectral_blacksmith' | 'infernal_warden' | 'system';`
   - `export type BiomeId = 'village_grotto' | 'village_mine' | 'ancient_seal' | 'submundo_abyss';`
   - `export interface DialogueLine { id: string; speaker: string; portraitId: PortraitId; title: string; text: string; shortText?: string; }`
   - `export interface CampaignStageDef { id: CampaignStageId; phase: CampaignPhase; order: number; name: string; subtitle: string; description: string; biome: BiomeId; totalRooms: number; difficultyScale: number; monsterPool: string[]; bossId: string; introDialogueIds: string[]; victoryDialogueIds: string[]; defeatDialogueIds?: string[]; unlocksStageId?: CampaignStageId; triggersFallOfVillage?: boolean; }`
   - `export interface CampaignCatalog { stages: CampaignStageDef[]; }`
   - `export interface CampaignProgress { phase: CampaignPhase; currentStageId: CampaignStageId; completedStages: CampaignStageId[]; seenDialogues: string[]; villageFallTriggered: boolean; }`
2. Estender `SaveProfile`, `RunEndReport` e `HubTransitionData` de forma retrocompatível (campos opcionais):
   - Em `SaveProfile`: `campaign?: CampaignProgress;`
   - Em `RunEndReport`: `stageId?: CampaignStageId; triggeredVillageFall?: boolean;`
   - Em `HubTransitionData`: `stageId?: CampaignStageId;`
**Permitido:** `src/core/index.ts`.
**Proibido:** importar Phaser em `src/core/`, alterar `src/view/` ou executar comandos git.
**Pronto quando:** `npm run typecheck` passa sem erros.
**Entrega:** até 4 linhas listando os novos tipos exportados em `src/core/index.ts`.
