# BRF-080 — AG01 (Gameplay) — T-070b Aplicar os 5 Monstros Animados na Dungeon Escura de Teste (`DungeonScene.ts`)

**Leia:** [docs/agentes/AG01_Gameplay.md](../agentes/AG01_Gameplay.md), [src/view/scenes/DungeonScene.ts](../../src/view/scenes/DungeonScene.ts), [src/view/sprites/CombatVfx.ts](../../src/view/sprites/CombatVfx.ts), [src/data/monsters.json](../../src/data/monsters.json). **Regra:** respostas curtas; **PROIBIDO** editar `BootScene.ts`, `src/core/`, `tests/` ou executar `git`.

**Decisão do dono:** Aplicar algumas unidades dos 5 novos monstros (`slime`, `cave_bat`, `wolf`, `skeleton`, `skeleton_archer`) na nossa **dungeon de teste escura (`testArena: true`)** para vê-los existindo, andando, atacando (inclusive o `skeleton_archer` disparando flecha à distância) e morrendo com as novas animações 20f (`80×80`)!

**Fazer (apenas em `src/view/scenes/DungeonScene.ts`):**
1. **Importar `resolveMonsterAnimKey`** de `../sprites/CombatVfx`.
2. **Spawn na `testArena` (`loadCurrentRoom` quando `this.isTestArena === true`):**
   - Em vez de `this.monsters = []`, spawnar **1 unidade de cada um dos 5 monstros** (`slime`, `cave_bat`, `wolf`, `skeleton`, `skeleton_archer`) posicionados ao redor do centro (em pontos bem espaçados e visíveis dentro dos limites da câmera/arena, ex.: offsets ao redor de `centerPos` com distância `110–170 px` para não colarem no spawn no primeiro frame) usando `this.monsterDefMap.get(id)` + `spawnMonster(...)` + `createMonsterVisual(...)`!
   - Manter `testArena` com fundo `#000000` sem tiles/paredes/luzes/diálogos e sem `room_cleared` automático.
3. **Fallback textures em `ensureCampaignFallbackTextures()`:**
   - Garantir fallback `80×80` para `slime`, `cave_bat`, `wolf`, `skeleton` e `skeleton_archer` caso alguma textura não exista.
4. **Visual e Animações dos Monstros (`MonsterVisual`, `createMonsterVisual`, `syncVisuals`, `processCombatEvents`):**
   - Atualizar `MonsterVisual` para rastrear `isActionPlaying?: boolean` e `isDying?: boolean` (e `deathFinished?: boolean`).
   - Em `createMonsterVisual`:
     - Para os 5 novos monstros (`80×80`), usar escala apropriada ao Herói (`0.88`, igual ao `heroSprite` `80×80`! — para legados 32×32/64×64 manter `1.2`/`1.1`).
     - Tocar `resolveMonsterAnimKey(monster.spriteKey, 'idle')` inicial.
   - Em `syncVisuals`:
     - Se `!monster.isAlive || monster.hp <= 0`: se `!visual.isDying` e existir animação `death` via `resolveMonsterAnimKey(monster.spriteKey, 'death')`, marcar `visual.isDying = true`, limpar barra de HP, tocar a animação `death` e no `ANIMATION_COMPLETE` fazer fade-out rápido (`250ms`) e marcar `visual.deathFinished = true` + `setVisible(false)`. (Se não existir `death`, esconder imediatamente como antes.)
     - Se vivo e `!visual.isActionPlaying`: calcular distância até o herói (`distanceBetween(monster.position, this.hero.position)`); se `dist > monster.attackRange`, tocar `resolveMonsterAnimKey(monster.spriteKey, 'walk')`, senão `resolveMonsterAnimKey(monster.spriteKey, 'idle')` (só chamando `.play(key, true)` quando `currentAnim?.key !== key`).
     - Ajustar `offsetY` da barra de HP para `34` nos monstros `80×80` (ou `44` em boss).
   - Em `processCombatEvents`:
     - No `case 'hero_damaged':`: buscar o monstro por `event.sourceId` em `this.monsters` e o `visual` em `this.monsterVisuals`. Se vivo, tocar `resolveMonsterAnimKey(monster.spriteKey, 'attack')` com `visual.isActionPlaying = true` e `once(ANIMATION_COMPLETE)` para liberar `visual.isActionPlaying = false`.
     - Se `monster.attackType === 'ranged'`, criar um projétil visual simples e nítido de **flecha** (linha/ponta madeira + aço em `Graphics`, `depth = 25`) que voa da posição do `skeleton_archer` até `this.hero.position` em `160 ms` e se destrói ao chegar!

**Permitido:** `src/view/scenes/DungeonScene.ts`.
**Proibido:** `BootScene.ts`, `src/core/`, `tests/`, e qualquer comando `git`.

**Pronto quando:** `DungeonScene.ts` spawna os 5 monstros na `testArena`, toca `idle`/`walk`/`attack`/`death` (com flecha visual no `skeleton_archer`) e passa na revisão estática (`strict: true`).

**Entrega:** até 10 linhas: (1) alterações em `DungeonScene.ts`, (2) revisão estática (`strict: true`) e pontos de atenção.
