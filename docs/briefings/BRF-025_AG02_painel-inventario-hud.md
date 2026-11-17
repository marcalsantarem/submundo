# BRF-025 — AG02 — T-019 Painel responsivo de Inventário e Equipamentos no HUD

**Leia:** `docs/agentes/AG02_UI.md`, `src/core/index.ts`, `src/view/ui/DungeonHud.ts`. **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono:** Autorização explícita da `T-019` (M2 `v0.2.0`).
**Contrato (alinhado com T-017 e T-020):**
- `src/view/ui/InventoryModal.ts`:
  - `export interface InventoryHudSnapshot { equipped: EquippedGear; bag: ItemInstance[]; heroStats: HeroStats; lifeSteal: number; cooldownReduction: number; luck: number; activeForces: Record<'inferno' | 'submundo' | 'empireo', number>; }`
  - `export class InventoryModal`:
    - `constructor(scene: Phaser.Scene, callbacks: { onEquipItem: (instanceId: string) => void; onUnequipSlot: (slot: EquipSlot) => void; onClose: () => void })`
    - `open(snapshot: InventoryHudSnapshot): void`, `close(): void`, `isOpen(): boolean`, `update(snapshot: InventoryHudSnapshot): void`, `resize(viewport: ViewportConfig): void`, `destroy(): void`.
    - Exibe os 4 slots equipados (`Arma`, `Armadura`, `Amuleto`, `Anel`) com borda colorida pela raridade (`#e4e4e7`, `#38bdf8`, `#facc15`, `#f97316`), lista de itens na mochila com comparação rápida (`powerScore` / delta de bônus vs item equipado no mesmo slot), ação de 1 toque para equipar/desequipar e resumo das Forças ativas (`Inferno`, `Submundo`, `Empíreo`).
- `src/view/ui/DungeonHud.ts`:
  - Adicionar em `HudSnapshot` (todos opcionais para manter retrocompatibilidade): `bagCount?: number`, `equippedCount?: number`, `lootSummaryText?: string`.
  - Adicionar em `callbacks` do `DungeonHud` (opcional): `onToggleInventory?: () => void`.
  - Adicionar botão compacto `"Bolsa (N)"` (com atalho `I` / `B`) posicionado de forma limpa em `800x600` e `360x640` sem colidir com o joystick, barra de HP ou botões de skill.
  - Exibir `lootSummaryText` no modal de Vitória/Derrota quando informado.
**Fazer:**
1. Criar `src/view/ui/InventoryModal.ts` (responsivo PC `800x600` e Mobile `9:16`, texto em pt-BR, multi-touch seguro com `stopPropagation`).
2. Atualizar `src/view/ui/DungeonHud.ts` com o botão `"Bolsa"` e `lootSummaryText`.
**Permitido:** `src/view/ui/InventoryModal.ts`, `src/view/ui/DungeonHud.ts`.
**Proibido:** `src/core/`, `src/view/scenes/`, `src/view/sprites/`, `tests/` e comandos git.
**Pronto quando:** `npm run typecheck` e `npm run build` passarem com zero erros.
**Entrega:** até 6 linhas: arquivos criados/atualizados, layout PC/Mobile implementado e resultado de `typecheck`/`build`.
