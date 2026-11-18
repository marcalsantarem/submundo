# BRF-089 — AG01 (Gameplay) — T-100 `testArena` em 2 Ondas (Monstros Normais → 2 Bosses)

**Leia:** [docs/agentes/AG01_Gameplay.md](../agentes/AG01_Gameplay.md), [src/view/scenes/DungeonScene.ts](../../src/view/scenes/DungeonScene.ts). **Regra:** respostas curtas; **PROIBIDO** editar `src/core/`, `BootScene.ts`, `tests/` ou executar `git`.

**Decisão do dono:** Na `testArena`:
1. Iniciar com **Onda 1** contendo apenas os monstros normais (`slime`, `cave_bat`, `wolf`, `skeleton`, `skeleton_archer`).
2. Assim que **todos** os monstros normais da Onda 1 morrerem, disparar automaticamente a **Onda 2** com os **2 bosses** (`wolf_alpha` e `karnak`) para o dono conseguir vê-los e testá-los em seguida!

**Fazer (apenas em `src/view/scenes/DungeonScene.ts`):**
1. Dividir `TEST_ARENA_SPAWNS` em duas listas:
   - `TEST_ARENA_WAVE_1` (monstros normais: `slime`, `cave_bat`, `wolf`, `skeleton`, `skeleton_archer`)
   - `TEST_ARENA_WAVE_2` (2 bosses: `wolf_alpha` à esquerda e `karnak` à direita do centro, ex.: `{ id: 'wolf_alpha', dx: -120, dy: -60 }` e `{ id: 'karnak', dx: 120, dy: -60 }`)
2. Adicionar campo `private testArenaWave = 1;` (resetado para `1` em `create`, `startNewRun` e `SHUTDOWN`).
3. Em `loadCurrentRoom()` quando `this.isTestArena === true`:
   - Spawnar apenas `TEST_ARENA_WAVE_1` (usando um helper `spawnTestArenaWave(spawns, waveNum)`).
4. Em `checkAndUpdateRoomState(nowMs)` quando `this.isTestArena === true`:
   - Se `this.testArenaWave === 1` e todos os monstros em `this.monsters` estiverem mortos (`this.monsters.every((m) => !m.isAlive)`):
     - Aguardar apenas se quiser (ou após `600ms` / imediatamente quando todos estiverem mortos, mantendo os sprites morrendo ou limpando `monsterVisuals` só dos mortos se necessário — atenção: se a animação `death` estiver rodando, é legal aguardar ~`650ms` ou usar um timer `testArenaWaveDelayMs`, ou limpar os já finalizados e spawnar a Onda 2 sem apagar quem ainda está no tween de `death`!). Usar um pequeno delay (`650 ms`) após o último monstro morrer para a Onda 1 terminar a animação `death` antes da Onda 2 aparecer é super limpo!
     - Mudar `this.testArenaWave = 2`, spawnar `TEST_ARENA_WAVE_2` (`wolf_alpha` e `karnak`) e exibir um banner curto (`"Onda 2: Chefe da Matilha & Karnak!"`, `2500 ms`).

**Permitido:** `src/view/scenes/DungeonScene.ts`.
**Proibido:** `src/core/`, `BootScene.ts`, `tests/`, e qualquer comando `git`.

**Entrega:** até 5 linhas: alterações em `DungeonScene.ts` e revisão estática (`strict: true`).
