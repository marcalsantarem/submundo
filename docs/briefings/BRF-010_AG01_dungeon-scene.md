# BRF-010 — AG01 — T-009 DungeonScene integrando Core, HUD, Sprites e VFX

**Leia:** `docs/agentes/AG01_Gameplay.md`, `src/core/index.ts`, `src/core/entities/Hero.ts`, `src/core/entities/Monster.ts`, `src/core/combat/CombatEngine.ts`, `src/core/dungeon/DungeonGenerator.ts`, `src/core/dungeon/DungeonRun.ts`, `src/view/ui/DungeonHud.ts`, `src/view/sprites/CombatVfx.ts`. **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono:** Decisão #3 e Decisão #5 (M1 `v0.1.0`).
**Contrato:**
- `src/view/scenes/DungeonScene.ts` exportando `DungeonScene extends Phaser.Scene` com `key: 'DungeonScene'`.
- Ao iniciar a cena, instancia a run de 5 salas (`createDungeonRun`), o herói (`createHero`), os monstros da sala atual (`spawnMonster` usando `src/data/monsters.json`), o `CombatVfxManager` e o `DungeonHud` (com `src/data/skills.json`).
- Renderiza a arena com tiles de `dungeon_tiles`, iluminação espiritual nas bordas, sprite do herói (`wraith_warrior`), sprites dos monstros com barras de vida individuais, e portal de transição quando a sala é limpa (ou avanço automático após 1.2s / tocar no portal).
- No `update(time, delta)`, lê `hud.getMoveVector()`, chama `moveHero`, `tickCombat`, dispara VFX para cada `CombatEvent`, avalia `evaluateRoomState` e atualiza o `DungeonHud`.
- Expor no `window.__SUBMUNDO_DEBUG__` um objeto leve com `{ scene: this, getRunState: () => this.runState, getHero: () => this.hero, getMonsters: () => this.monsters, triggerSkill: (id: string) => ... }` para facilitar inspeção automatizada do `AG03 (QA)` no Playwright.
**Fazer:**
1. Implementar `src/view/scenes/DungeonScene.ts` conectando todo o loop de 4 salas + 1 Boss.
2. Garantir que `BootScene.ts` e `src/main.ts` registrem e iniciem a `DungeonScene`.
**Permitido:** `src/view/scenes/DungeonScene.ts`, `src/view/scenes/BootScene.ts`, `src/main.ts`.
**Proibido:** `src/core/`, `src/view/ui/`, `src/view/sprites/` e comandos git (`commit`, `push`, `branch`, `checkout`, `reset`, `stash`).
**Pronto quando:** `npm run typecheck`, `npm test` e `npm run build` passarem 100% verdes.
**Entrega:** até 6 linhas: arquivos criados/atualizados, integração verificada, resultado de `typecheck`/`test`/`build` e o que não foi testado.
