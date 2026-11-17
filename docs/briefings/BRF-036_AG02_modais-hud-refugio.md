# BRF-036 — AG02 — T-034 Modais e HUD responsivos do Refúgio no Submundo

**Leia:** `docs/agentes/AG02_UI.md`, `src/core/index.ts`, `src/view/ui/InventoryModal.ts`, `src/view/ui/VirtualJoystick.ts`, `src/data/progression.json`, `src/data/dialogues.json`. **Regra:** respostas curtas; sem commit/push/branches; responsivo PC `800x600` e Mobile `360x640`; multi-touch seguro com `stopPropagation`.
**Decisão do dono:** Autorização explícita da `T-034` (M3 `v0.3.0`).
**Contrato (`src/view/ui/`):**
- `src/view/ui/AltarModal.ts`:
  - `export interface AltarModalSnapshot { souls: number; altarLevels: Record<AltarUpgradeId, number>; upgrades: AltarUpgradeDef[]; getCost: (def: AltarUpgradeDef, level: number) => number; }`
  - `export class AltarModal`: `constructor(scene, callbacks: { onPurchaseUpgrade: (id: AltarUpgradeId) => void; onClose: () => void })`, métodos `open(snap)`, `update(snap)`, `close()`, `isOpen()`, `resize(viewport)`, `destroy()`.
- `src/view/ui/BlacksmithModal.ts`:
  - `export interface BlacksmithModalSnapshot { souls: number; generalEssences: number; items: ItemInstance[]; itemUpgradeLevels: Record<string, number>; maxUpgradeLevel: number; getUpgradeCost: (level: number) => number; forgeRecipes: BlacksmithForgeDef[]; }`
  - `export class BlacksmithModal`: `constructor(scene, callbacks: { onUpgradeItem: (instanceId: string) => void; onForgeRecipe: (recipeId: string) => void; onClose: () => void })`, métodos `open(snap)`, `update(snap)`, `close()`, `isOpen()`, `resize(viewport)`, `destroy()`.
- `src/view/ui/HubHud.ts`:
  - `export interface HubHudSnapshot { souls: number; generalEssences: number; equippedCount: number; stashCount: number; nearbyStationLabel?: string; bannerText?: string; }`
  - `export class HubHud`: `constructor(scene, callbacks: { onOpenAltar: () => void; onOpenBlacksmith: () => void; onOpenStash: () => void; onEnterDungeon: () => void; onInteract?: () => void })`, métodos `getMoveVector(): Vector2D`, `update(snap)`, `resize(viewport)`, `destroy()`.
  - Inclui `VirtualJoystick` + `WASD`/Setas para mover no Refúgio e botões acessíveis tanto no PC (`800x600`) quanto no Mobile (`360x640`): **Altar**, **Ferreiro**, **Baú**, **Entrar na Fenda** (e botão contextual `"Interagir"` quando próximo de estação).
**Fazer:** Criar `src/view/ui/AltarModal.ts`, `src/view/ui/BlacksmithModal.ts` e `src/view/ui/HubHud.ts`.
**Permitido:** `src/view/ui/AltarModal.ts`, `src/view/ui/BlacksmithModal.ts`, `src/view/ui/HubHud.ts`.
**Proibido:** `src/core/`, `src/view/scenes/`, `src/view/ui/InventoryModal.ts`, `src/view/ui/DungeonHud.ts`, `tests/` e comandos git.
**Pronto quando:** `npm run typecheck` e `npm run build` passarem 100% verdes.
**Entrega:** até 6 linhas: arquivos criados, comportamento PC/Mobile implementado e resultado de `typecheck`/`build`.
