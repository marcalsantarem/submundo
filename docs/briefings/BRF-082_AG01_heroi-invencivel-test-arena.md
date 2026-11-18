# BRF-082 — AG01 (Gameplay) — T-095 Herói Invencível Momentaneamente na `testArena` (`DungeonScene.ts`)

**Leia:** [docs/agentes/AG01_Gameplay.md](../agentes/AG01_Gameplay.md), [src/view/scenes/DungeonScene.ts](../../src/view/scenes/DungeonScene.ts). **Regra:** respostas curtas; **PROIBIDO** editar `src/core/` (para não quebrar testes unitários), `BootScene.ts`, `tests/` ou executar `git`.

**Decisão do dono:** Momentaneamente, tornar o Herói invencível (não sofrer dano) para simplificar o teste ingame do visual e animações dos monstros.

**Fazer (apenas em `src/view/scenes/DungeonScene.ts`):**
1. No `case 'hero_damaged':` dentro de `processCombatEvents`:
   - Manter a execução da animação `attack` do monstro atacante e o disparo de flecha (`spawnRangedArrow`) quando `attackType === 'ranged'`, para o dono continuar vendo os ataques dos monstros funcionando!
   - Quando `this.isTestArena === true`:
     - **Não** tocar animação `hit` no Herói, **não** mostrar número de dano vermelho no Herói e **não** tocar som/flash de dano;
     - Restaurar imediatamente `this.hero.hp = this.hero.maxHp; this.hero.isAlive = true;`.
2. Também no `case 'hero_killed':`: se `this.isTestArena === true`, impedir derrota (`this.hero.hp = this.hero.maxHp; this.hero.isAlive = true; return;`).

**Permitido:** `src/view/scenes/DungeonScene.ts`.
**Proibido:** `src/core/`, `tests/`, `BootScene.ts`, e qualquer comando `git`.

**Entrega:** até 5 linhas: (1) alterações em `DungeonScene.ts`, (2) revisão estática (`strict: true`).
