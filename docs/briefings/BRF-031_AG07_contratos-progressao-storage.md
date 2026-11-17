# BRF-031 — AG07 — T-029 Contratos de progressão e StorageAdapter

**Leia:** `docs/agentes/AG07_Arquiteto.md`, `src/core/index.ts`. **Regra:** respostas curtas; sem commit/push/branches; ZERO Phaser em `src/core/`.
**Decisão do dono:** Autorização explícita da `T-029` (M3 `v0.3.0`).
**Contrato:**
- `src/core/index.ts` (preservar 100% dos tipos e funções existentes + exportar):
  - `export type AltarUpgradeId = 'vitality' | 'might' | 'bastion' | 'swiftness' | 'fortune';`
  - `export interface AltarUpgradeDef { id: AltarUpgradeId; name: string; description: string; maxLevel: number; baseSoulCost: number; costMultiplier: number; bonusPerLevel: StatBonus; }`
  - `export interface BlacksmithUpgradeConfig { maxLevel: number; baseSoulCost: number; costPerLevel: number; attackBonusPerLevel: number; hpBonusPerLevel: number; defenseBonusPerLevel: number; }`
  - `export interface BlacksmithForgeDef { id: string; name: string; description: string; essenceCost: number; soulCost: number; rarity: Rarity; slot?: EquipSlot; }`
  - `export interface ProgressionCatalog { altarUpgrades: AltarUpgradeDef[]; blacksmithUpgrade: BlacksmithUpgradeConfig; blacksmithForge: BlacksmithForgeDef[]; }`
  - `export interface SaveProfile { version: number; souls: number; generalEssences: number; altarLevels: Record<AltarUpgradeId, number>; equipped: EquippedGear; stash: ItemInstance[]; maxStashSize: number; itemUpgradeLevels: Record<string, number>; stats: { runsCompleted: number; runsFailed: number; bossesDefeated: number; totalSoulsEarned: number; }; }`
  - `export interface RunEndReport { victory: boolean; soulsGained: number; essencesGained: number; monstersKilled: number; bossDefeated: boolean; keptItems: ItemInstance[]; lostItems: ItemInstance[]; }`
  - `export interface HubTransitionData { fromRun?: RunEndReport; }`
- `src/core/progression/StorageAdapter.ts` (100% TS puro, seguro em Node/SSR sem `window.localStorage`):
  - `export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void; }`
  - `export const SAVE_STORAGE_KEY = 'submundo_save_v1';`
  - `export function getDefaultStorage(): StorageLike`
  - `export function saveProfileToStorage(profile: SaveProfile, storage?: StorageLike): boolean`
  - `export function loadProfileFromStorage(storage?: StorageLike): SaveProfile | null`
  - `export function clearProfileStorage(storage?: StorageLike): void`
**Fazer:**
1. Estender `src/core/index.ts` com os tipos acima.
2. Criar `src/core/progression/StorageAdapter.ts`.
**Permitido:** `src/core/index.ts`, `src/core/progression/StorageAdapter.ts`.
**Proibido:** `src/view/`, `src/data/`, `tests/`, `package.json` e comandos git.
**Pronto quando:** `npm run typecheck` e `npm test` passarem 100% verdes.
**Entrega:** até 5 linhas: arquivos criados/alterados e resultado de `typecheck`/`test`.
