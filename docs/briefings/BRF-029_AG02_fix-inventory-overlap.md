# BRF-029 — AG02 — T-039 Corrigir sobreposição de nome longo na Mochila e Cards do InventoryModal

**Leia:** `docs/agentes/AG02_UI.md`, `src/view/ui/InventoryModal.ts`, `docs/qa/qa-M2.md`. **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono:** Autorização explícita da `T-039` (ressalva menor #1 do QA M2).
**Fazer:**
1. Em `src/view/ui/InventoryModal.ts`: evitar sobreposição quando um item raro/lendário tem nome longo tanto nos cards de `EQUIPADOS` (`renderSnapshot` linhas 851-858 / `layoutSlotCard` linhas 752-758) quanto nas linhas de `MOCHILA` (`renderSnapshot` linhas 911-925 / `layoutBagRow` linhas 779-795):
   - Posicionar `detailText` / `statsText` dinamicamente após `nameText` ou limitar/truncar com reticências (`...`) quando ultrapassar a largura útil de 1 linha (ou ajustar altura/espaçamento com segurança para nunca encostar em `metaText` nem em `detailText`/`statsText`).
**Permitido:** `src/view/ui/InventoryModal.ts`.
**Proibido:** `src/core/`, `src/view/scenes/`, `tests/`, `docs/` e comandos git.
**Pronto quando:** `npm run typecheck`, `npm test` e `npm run build` passarem 100% verdes.
**Entrega:** até 5 linhas: ajuste aplicado e resultado de `typecheck`/`test`/`build`.
