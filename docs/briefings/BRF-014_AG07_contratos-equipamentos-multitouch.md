# BRF-014 — AG07 — T-013 + T-023 Contratos de Equipamentos/Sinergias e Multi-touch no Phaser/HTML

**Leia:** `docs/agentes/AG07_Arquiteto.md`, `src/core/index.ts`, `src/main.ts`, `index.html`, `tests/core/architecture.test.ts`. **Regra:** respostas curtas; sem commit/push/branches; ZERO importação de Phaser em `src/core/`.
**Decisão do dono:** Feedback do teste mobile (`T-023`) e contratos do M2 (`T-013`).
**Contrato (para AG04, AG01, AG02, AG08 no M2):**
Exportar em `src/core/index.ts` (mantendo todos os tipos existentes do M1):
- `EquipSlot = 'weapon' | 'armor' | 'amulet' | 'ring'`
- `Rarity = 'common' | 'magic' | 'rare' | 'legendary'`
- `StatusEffectType = 'ember' | 'bleed' | 'judgment'`
- `LegendaryPowerId = 'inferno_dash_trail' | 'submundo_bleed_minion' | 'empireo_crit_lightning' | 'inferno_ember_nova' | 'submundo_crimson_pact' | 'empireo_judgment_haste'`
- `StatBonus`: `{ maxHp?: number; attack?: number; defense?: number; moveSpeed?: number; attackRange?: number; cooldownReduction?: number; critChance?: number; critMultiplier?: number; lifeSteal?: number; luck?: number; }`
- `AffixDef`: `{ id: string; name: string; force: ForceType; allowedSlots: EquipSlot[]; minRarity: Rarity; bonuses: StatBonus; description: string; }`
- `LegendaryPowerDef`: `{ id: LegendaryPowerId; name: string; force: ForceType; description: string; }`
- `ItemDef`: `{ id: string; name: string; slot: EquipSlot; force: ForceType; baseBonuses: StatBonus; iconKey: string; description: string; }`
- `ItemInstance`: `{ instanceId: string; defId: string; name: string; slot: EquipSlot; rarity: Rarity; force: ForceType; baseBonuses: StatBonus; affixes: AffixDef[]; legendaryPower?: LegendaryPowerDef; iconKey: string; powerScore: number; }`
- `EquippedGear = Record<EquipSlot, ItemInstance | null>`
**Fazer:**
1. (`T-013`) Adicionar os tipos acima em `src/core/index.ts` (100% TS puro).
2. (`T-023`) Em `src/main.ts`, adicionar `input: { activePointers: 4 }` dentro de `createGameConfig` para liberar múltiplos toques simultâneos (joystick + botão de skill). Em `index.html`, adicionar `touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;` em `html, body, #game-container, #game-container canvas`.
3. Atualizar `tests/core/architecture.test.ts` incluindo verificação de `createGameConfig` possuir `input.activePointers >= 4` (ou testar contratos de tipos/ausência de Phaser em `src/core/index.ts`).
**Permitido:** `src/core/index.ts`, `src/main.ts`, `index.html`, `tests/core/architecture.test.ts`.
**Proibido:** `src/core/entities/`, `src/core/combat/`, `src/core/dungeon/`, `src/view/`, `src/data/` e comandos git.
**Pronto quando:** `npm run typecheck`, `npm test` e `npm run build` passarem 100% verdes.
**Entrega:** até 6 linhas: alterações em `src/core/index.ts`, `src/main.ts`, `index.html`, contagem de testes e `typecheck`/`build`.
