# BRF-096 — AG01 (Gameplay) — T-105 Aumentar escala de Karnak em +20% na `DungeonScene.ts`

**Leia:** [docs/agentes/AG01_Gameplay.md](../agentes/AG01_Gameplay.md), [src/view/scenes/DungeonScene.ts](../../src/view/scenes/DungeonScene.ts). **Regra:** respostas curtas; **PROIBIDO** editar `src/core/`, `tests/`, `scripts/` ou executar `git`.

**Contexto:**
- Na `DungeonScene.ts`, `createMonsterVisual` aplica `scale = isAnimatedSpritesheet ? 0.88 : ...` para todos os monstros com spritesheet animado.
- O dono pediu para aumentar o sprite de **Karnak** (`monster.spriteKey === 'karnak'`) em ~20% (`0.88 * 1.2 = 1.056` → usar `1.06`).

**Fazer:**
1. Em `src/view/scenes/DungeonScene.ts`:
   - Em `createMonsterVisual(monster: MonsterInstance)` (~linha 726), definir escala `1.06` quando `monster.spriteKey === 'karnak'` (mantendo `0.88` para os demais `isAnimatedSpritesheet`).
   - No cálculo de `offsetY` da barra de HP individual (~linha 1478), aumentar o `offsetY` de `monster.spriteKey === 'karnak'` de `46` para `56` (acompanhando o aumento de 20% na altura do sprite para a barra de vida não sobrepor os chifres).

**Permitido:** `src/view/scenes/DungeonScene.ts`.
**Proibido:** `src/core/`, `tests/`, `scripts/`, e qualquer comando `git`.

**Entrega:** até 4 linhas: alterações feitas em `DungeonScene.ts`.
