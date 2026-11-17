# BRF-035 — AG04 — T-033 Lógica pura de progressão permanente (ProfileManager)

**Leia:** `docs/agentes/AG04_Sistemas_Meta.md`, `src/core/index.ts`, `src/core/progression/StorageAdapter.ts`, `src/core/loot/LootGenerator.ts`, `src/core/loot/Inventory.ts`, `src/core/entities/Hero.ts`, `src/data/progression.json`. **Regra:** respostas curtas; sem commit/push/branches; ZERO Phaser em `src/core/`.
**Decisão do dono:** Autorização explícita da `T-033` (M3 `v0.3.0`).
**Contrato (`src/core/progression/ProfileManager.ts`):**
- `export const DEFAULT_PROFILE_VERSION = 1;`
- `export const DEFAULT_MAX_STASH_SIZE = 30;`
- `export function getProgressionCatalog(): ProgressionCatalog`
- `export function createDefaultProfile(): SaveProfile`
- `export function loadOrCreateProfile(storage?: StorageLike): SaveProfile`
- `export function persistProfile(profile: SaveProfile, storage?: StorageLike): boolean`
- `export function getAltarUpgradeCost(def: AltarUpgradeDef, currentLevel: number): number` (`Infinity` se no nível máximo; senão `Math.round(def.baseSoulCost * Math.pow(def.costMultiplier, currentLevel))`)
- `export function computeAltarBonuses(profile: SaveProfile, catalog?: ProgressionCatalog): Required<StatBonus>`
- `export function purchaseAltarUpgrade(profile: SaveProfile, upgradeId: AltarUpgradeId, catalog?: ProgressionCatalog): { ok: boolean; reason?: string; newLevel: number; cost: number }`
- `export function getItemUpgradeLevel(profile: SaveProfile, instanceId: string): number`
- `export function getBlacksmithUpgradeCost(currentLevel: number, catalog?: ProgressionCatalog): number` (`Infinity` se `>= maxLevel`; senão `baseSoulCost + currentLevel * costPerLevel`)
- `export function upgradeItemWithBlacksmith(profile: SaveProfile, instanceId: string, catalog?: ProgressionCatalog): { ok: boolean; reason?: string; item?: ItemInstance; newLevel: number; cost: number }` (localiza item em `equipped` ou `stash`, cobra Almas, incrementa `itemUpgradeLevels[instanceId]`, soma `attackBonusPerLevel`/`hpBonusPerLevel`/`defenseBonusPerLevel` em `item.baseBonuses`, atualiza sufixo `(+N)` no `item.name` e recalcula `powerScore`)
- `export function forgeItemWithBlacksmith(profile: SaveProfile, recipeId: string, rng?: () => number, catalog?: ProgressionCatalog): { ok: boolean; reason?: string; item?: ItemInstance }` (verifica Essências, Almas e espaço no `stash`, gera via `generateItemDrop` e adiciona ao `stash`)
- `export function equipStashItem(profile: SaveProfile, instanceId: string): boolean`
- `export function unequipProfileSlot(profile: SaveProfile, slot: EquipSlot): boolean`
- `export function applyRunOutcomeToProfile(profile: SaveProfile, report: RunEndReport): SaveProfile` (sempre soma `soulsGained` em `profile.souls` e `stats.totalSoulsEarned`, soma `essencesGained` em `profile.generalEssences`; na `victory`, incrementa `runsCompleted`/`bossDefeated` e guarda os `keptItems` no `stash`/equipados evitando duplicar `instanceId`; na derrota, incrementa `runsFailed` mantendo gear que já era do Hub e descartando drops perdidos na run)
- `export function buildHeroFromProfile(profile: SaveProfile, initialPos?: Vector2D, catalog?: ProgressionCatalog): HeroState` (aplica bônus do Altar sobre `DEFAULT_HERO_STATS` em `hero.baseStats`, depois aplica `profile.equipped` via `applyGearToHero` + `computeGearBonuses`, `lifeSteal`, `cooldownReduction`, `luck`, `equippedForces` e `activeLegendaryPowers`)
**Fazer:**
1. Implementar `src/core/progression/ProfileManager.ts`.
2. Criar `tests/core/progression.test.ts` testando: criação/persistência em `StorageAdapter`, compra no Altar + cálculo de `computeAltarBonuses` e `buildHeroFromProfile`, melhoria `+1/+2` e forja Lendária no Ferreiro, equipar/desequipar no Baú e `applyRunOutcomeToProfile` (vitória vs derrota).
**Permitido:** `src/core/progression/ProfileManager.ts`, `tests/core/progression.test.ts`.
**Proibido:** `src/core/index.ts`, `src/view/`, `src/data/` e comandos git.
**Pronto quando:** `npm run typecheck` e `npm test` passarem 100% verdes.
**Entrega:** até 6 linhas: arquivos criados, contagem de testes em `progression.test.ts` e validações.
