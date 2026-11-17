# BRF-023 — AG04 — T-017 Gerador de loot, inventário da run e perda na morte

**Leia:** `docs/agentes/AG04_Sistemas_Meta.md`, `src/core/index.ts`, `src/core/entities/Hero.ts`, `src/data/items.json`, `src/data/affixes.json`. **Regra:** respostas curtas; sem commit/push/branches; ZERO Phaser em `src/core/`.
**Decisão do dono:** Autorização explícita da `T-017` (M2 `v0.2.0`).
**Contrato:**
- `src/core/loot/LootGenerator.ts`:
  - `RARITY_COLORS: Record<Rarity, string>` (`common: '#e4e4e7'`, `magic: '#38bdf8'`, `rare: '#facc15'`, `legendary: '#f97316'`).
  - `rollRarity(rng: () => number, luck?: number, isBoss?: boolean): Rarity` (`isBoss` garante no mínimo `rare` com boa chance de `legendary`).
  - `shouldDropLoot(isBoss: boolean, rng?: () => number, luck?: number): boolean` (Boss `true` 100%; monstro normal ~`0.30` + `luck`).
  - `generateItemDrop(options?: { rng?: () => number; luck?: number; isBoss?: boolean; forcedRarity?: Rarity; forcedSlot?: EquipSlot; idPrefix?: string }): ItemInstance` (`common`: 0 afixos; `magic`: 1 afixo; `rare`: 2–3 afixos; `legendary`: 3 afixos + 1 `LegendaryPowerDef`; calcula `powerScore`).
- `src/core/loot/Inventory.ts`:
  - `RunInventoryState { equipped: EquippedGear; bag: ItemInstance[]; extractedItems: ItemInstance[]; lostItemsOnDeath: ItemInstance[]; maxBagSize: number; }`
  - `createRunInventory(maxBagSize?: number): RunInventoryState`
  - `addItemToBag(inv: RunInventoryState, item: ItemInstance): boolean`
  - `equipItemFromBag(inv: RunInventoryState, instanceId: string): { equipped: ItemInstance; previous: ItemInstance | null } | null`
  - `unequipSlotToBag(inv: RunInventoryState, slot: EquipSlot): boolean`
  - `computeGearBonuses(equipped: EquippedGear): Required<StatBonus>`
  - `getActiveForces(equipped: EquippedGear): Record<'inferno' | 'submundo' | 'empireo', number>`
  - `getActiveLegendaryPowers(equipped: EquippedGear): LegendaryPowerId[]`
  - `applyGearToHero(hero: HeroState, baseStats: HeroStats, equipped: EquippedGear): HeroStats` (atualiza `hero.stats` com bônus dos itens mantendo `hp <= maxHp`).
  - `resolveRunEndLoot(inv: RunInventoryState, victory: boolean): { kept: ItemInstance[]; lost: ItemInstance[] }` (vitória extrai todos os equipados + mochila em `extractedItems`; derrota move tudo para `lostItemsOnDeath` e limpa `equipped`/`bag`).
**Fazer:**
1. Implementar `src/core/loot/LootGenerator.ts` e `src/core/loot/Inventory.ts` (100% TS puro).
2. Criar `tests/core/loot.test.ts` testando todas as raridades, contagem de afixos/poder lendário, equipar/desequipar, cálculo de bônus/forças e regra de extração vs. perda total na morte.
**Permitido:** `src/core/loot/LootGenerator.ts`, `src/core/loot/Inventory.ts`, `tests/core/loot.test.ts`.
**Proibido:** `src/core/index.ts`, `src/core/entities/`, `src/core/combat/`, `src/view/`, `src/data/` e comandos git.
**Pronto quando:** `npm run typecheck` e `npx vitest run tests/core/loot.test.ts` passarem 100% verdes.
**Entrega:** até 6 linhas: arquivos criados, contagem de testes em `loot.test.ts` e validações executadas.
