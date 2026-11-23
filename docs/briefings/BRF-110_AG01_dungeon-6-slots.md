# BRF-110 — AG01 (Gameplay) — T-108b Atualizar `EQUIP_SLOTS` para 6 Slots na `DungeonScene.ts`

**Leia:** [docs/agentes/AG01_Gameplay.md](../agentes/AG01_Gameplay.md), [src/view/scenes/DungeonScene.ts](../../src/view/scenes/DungeonScene.ts). **Regra:** respostas curtas; **PROIBIDO** editar `src/core/`, `src/view/ui/` ou executar `git`.

**Fazer (apenas em `src/view/scenes/DungeonScene.ts`):**
1. Atualizar `const EQUIP_SLOTS: readonly EquipSlot[]` (linha ~148) e a contagem `equippedCount` em `updateHud` (linha ~1664) para usar os 6 slots: `['weapon', 'armor', 'helm', 'boots', 'amulet', 'ring']`.

**Permitido:** `src/view/scenes/DungeonScene.ts`.
**Proibido:** qualquer outro arquivo e comandos `git`.

**Entrega:** até 3 linhas: alterações feitas em `DungeonScene.ts`.
