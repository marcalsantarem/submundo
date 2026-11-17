# BRF-007 — AG01 — T-007 Gerador de incursão de 4 salas + 1 Boss e máquina de estado da run

**Leia:** `docs/agentes/AG01_Gameplay.md`, `src/core/index.ts`, `src/data/monsters.json`. **Regra:** respostas curtas; sem commit/push/branches; ZERO importação de Phaser em `src/core/`.
**Decisão do dono:** Decisão #3 e Decisão #5 (M1 `v0.1.0`).
**Contrato:**
- `src/core/dungeon/DungeonGenerator.ts`:
  - `RoomSpawn { defId: string; x: number; y: number }`
  - `RoomSpec { roomNumber: number; isBossRoom: boolean; title: string; spawns: RoomSpawn[] }`
  - `createSeededRng(seed: number): () => number` (PRNG determinístico Mulberry32).
  - `generateDungeonRooms(arenaWidth?: number, arenaHeight?: number, seed?: number): RoomSpec[]`: gera exatamente 5 salas (Salas 1 a 4 normais com ondas progressivas de `abyssal_slime` e `bone_sentinel`; Sala 5 Boss com `infernal_warden` + escolta). Posições de spawn respeitando margem segura das bordas e do ponto inicial do herói.
- `src/core/dungeon/DungeonRun.ts`:
  - `RunStatus = 'in_progress' | 'room_cleared' | 'victory' | 'defeat'`
  - `DungeonRunState { seed: number; currentRoomIndex: number; totalRooms: number; rooms: RoomSpec[]; status: RunStatus; soulsCollected: number; monstersKilled: number; elapsedMs: number; }`
  - Exportar: `createDungeonRun(arenaWidth?: number, arenaHeight?: number, seed?: number): DungeonRunState`, `getCurrentRoom(run: DungeonRunState): RoomSpec`, `evaluateRoomState(run: DungeonRunState, livingMonstersCount: number, heroAlive: boolean): RunStatus`, `advanceToNextRoom(run: DungeonRunState): RoomSpec | null`.
**Fazer:**
1. Implementar `src/core/dungeon/DungeonGenerator.ts` e `src/core/dungeon/DungeonRun.ts` (100% TS puro).
2. Criar `tests/core/dungeon.test.ts` testando determinismo da semente, estrutura das 4 salas + 1 Boss, transição entre salas, vitória ao limpar a Sala 5 e derrota ao morrer.
**Permitido:** `src/core/dungeon/DungeonGenerator.ts`, `src/core/dungeon/DungeonRun.ts`, `tests/core/dungeon.test.ts`.
**Proibido:** `src/core/entities/`, `src/core/combat/`, `src/core/index.ts`, `src/view/` e comandos git (`commit`, `push`, `branch`, `checkout`, `reset`, `stash`).
**Pronto quando:** `npm run typecheck` e `npx vitest run tests/core/dungeon.test.ts` passarem 100% verdes.
**Entrega:** até 6 linhas: arquivos criados, contagem de testes em `dungeon.test.ts`, suposições e o que não foi testado.
