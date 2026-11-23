# BRF-132 — AG01 — T-122 Gerador procedural da dungeon de teste (core puro)
**Leia:** `docs/agentes/AG01_Gameplay.md`, decisões #12 e #18 em `docs/decisoes.md`, `src/core/dungeon/DungeonGenerator.ts` (use `createSeededRng`) e, em `src/view/scenes/DungeonScene.ts`, só as constantes `TEST_ROOM_*`, `TEST_ARENA_*` e `ACTOR_FEET_OFFSET` (ex.: sala atual 20×12 tiles de 32 px, obstáculos em "feet space"). **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono (#18):** a dungeon de teste vira 3 salas procedurais, uma onda por sala: **1** Slimes e Lobos; **2** Esqueletos e Esqueletos Arqueiros; **3** Boss Esqueleto Chefe. O jogador caminha de uma sala para a próxima.
**Contrato (exato; AG01-cena trabalha em paralelo na `DungeonScene.ts` e consome isto):** crie `src/core/dungeon/TestDungeon.ts` (TS puro, ZERO Phaser) exportando, e reexporte em `src/core/index.ts` se for o padrão do projeto:
```ts
export interface TestRoomRect { x: number; y: number; w: number; h: number } // px locais da sala, "feet space"
export interface TestRoomFloorProp { name: string; x: number; y: number }   // name ∈ torch/chest_closed/barrel/urn/bones/rubble/chain/skulls_candle (frames de dungeon_basic_props); x,y = canto sup. esq. em px locais
export interface TestRoomTallProp { frame: 0 | 1; x: number; y: number }    // 0 pilar, 1 pilar quebrado (dungeon_basic_props_tall, 32x64)
export interface TestRoomSpawn { defId: string; x: number; y: number }      // px locais, centro do ator; defIds: 'slime' | 'wolf' | 'skeleton' | 'skeleton_archer' | 'skeleton_chief'
export interface TestRoomSpec {
  index: 0 | 1 | 2;
  wave: 1 | 2 | 3;
  isBossRoom: boolean;
  title: string;              // ex.: 'Sala 1/3 — Slimes e Lobos'
  banner: string;             // ex.: 'Onda 1: Slimes e Lobos!'
  cols: number; rows: number; // em tiles de 32 px, com paredes incluídas
  exitDoorCols: [number, number] | null;  // 2 colunas do arco na parede superior; null na sala 3
  entryDoorCols: [number, number] | null; // 2 colunas da abertura na parede inferior; null na sala 1
  torchCols: number[];
  floorProps: TestRoomFloorProp[];
  tallProps: TestRoomTallProp[];
  obstacles: TestRoomRect[];  // coerentes com os props (mesma convenção das constantes atuais)
  heroStart: { x: number; y: number }; // px locais: sala 1 no centro; salas 2 e 3 logo acima da abertura de entrada
  spawns: TestRoomSpawn[];
}
export function generateTestDungeon(seed: number): TestRoomSpec[]; // sempre 3 salas, determinístico
```
**Regras do gerador:**
- Tamanhos por sala vindos da semente: `cols` 18–26 e `rows` 11–15; a sala do boss é a maior (≥ 22×13). Mantenha a geometria da parede (topo com 3 linhas de altura de parede/face, como hoje) e as colunas de porta dentro do piso, com ≥ 2 tiles de folga das quinas.
- **Sala 1:** 3 a 4 `slime` + 2 a 3 `wolf`. **Sala 2:** 3 a 4 `skeleton` + 2 `skeleton_archer`. **Sala 3:** só `skeleton_chief` (1 spawn).
- Props e obstáculos aleatórios por sala (pilares, baú, barril, urna, ossos, destroços etc.), com `obstacles` derivados dos props. Garanta: (a) existe caminho livre (grade de 16 px ou 32 px, BFS) do `heroStart` até a porta de saída (e da entrada), (b) nenhum `spawn` dentro de obstáculo nem a menos de ~140 px do `heroStart`, (c) todos os spawns dentro do piso caminhável. Em último caso, regenere com a próxima sub-semente.
- Mesma semente ⇒ mesmo resultado; sementes diferentes ⇒ salas diferentes.
**Testes (Vitest, `tests/core/test-dungeon.test.ts`):** 3 salas; composição por onda; determinismo; variação entre sementes; conectividade para 200 sementes; spawns fora de obstáculos e dentro do piso; portas coerentes (sala 1 sem entrada, sala 3 sem saída); boss na sala 3 com `isBossRoom`.
**Permitido:** `src/core/dungeon/TestDungeon.ts`, `src/core/index.ts` (só reexport) e `tests/core/test-dungeon.test.ts`. **Proibido:** `DungeonScene.ts`, `BootScene.ts`, `src/view/`, assets, `tests/e2e/`, Git.
**Pronto quando:** `npm test` e `npm run build` passam. Crie o arquivo com os tipos exatos do contrato logo no começo (o AG01-cena importa dele).
**Entrega:** até 8 linhas: o que foi feito, contagem de testes, regras de geração relevantes (tamanhos, convenção das portas e coordenadas) e o que não foi verificado.
