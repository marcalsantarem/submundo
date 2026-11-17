# BRF-013 — AG01 — T-012 Ressalva do QA do M1 em forceClearRoom na DungeonScene

**Leia:** `docs/agentes/AG01_Gameplay.md`, `src/view/scenes/DungeonScene.ts` (linhas 234-265). **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono:** Correção de ressalva menor do QA (`docs/qa/qa-M1.md`).
**Fazer:**
1. Em `src/view/scenes/DungeonScene.ts`, dentro de `forceClearRoom()`, adicionar `return;` imediatamente após `this.advanceRoomNow();` quando `this.runState.status === 'room_cleared'`, evitando que o método avance a sala e abata os monstros da sala recém-carregada na mesma chamada.
**Permitido:** `src/view/scenes/DungeonScene.ts`.
**Proibido:** `src/core/`, `src/view/ui/`, `src/view/sprites/`, `tests/` e comandos git.
**Pronto quando:** `npm run typecheck` e `npm test` passarem 100% verdes.
**Entrega:** até 4 linhas: linha alterada em `DungeonScene.ts` e resultado de `typecheck`/`test`.
