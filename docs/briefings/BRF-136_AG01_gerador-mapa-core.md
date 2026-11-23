# BRF-136 — AG01 — T-127 Gerador de mapa (core): salas variadas, corredores com curvas e sala gigante
**Leia:** `docs/agentes/AG01_Gameplay.md`, decisões #12, #18, #19 e #20 em `docs/decisoes.md`, `src/core/dungeon/TestDungeon.ts` (reaproveite props, obstáculos e BFS) e `src/core/dungeon/DungeonGenerator.ts` (`createSeededRng`). **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono (#20):** sem teleporte. Os mapas são (a) **salas ligadas por corredores** que saem por qualquer parede (N/S/L/O) e **fazem curvas**, com salas **não uniformes** (de câmaras pequenas a salões grandes; formatos retangular, em L, em cruz ou compostos de retângulos), ou (b) uma **sala gigante** que simula um mapa aberto. O jogador sempre caminha.
**Contrato (a cena vai consumir isto numa onda seguinte; crie `src/core/dungeon/DungeonMap.ts`, TS puro, sem Phaser):**
```ts
export type DungeonMapMode = 'rooms' | 'giant';
export const MAP_TILE = 32;
export const MAP_CELL_VOID = 0, MAP_CELL_ROOM = 1, MAP_CELL_CORRIDOR = 2;
export type DoorSide = 'n' | 's' | 'e' | 'w';
export interface MapRect { x: number; y: number; w: number; h: number }      // px de mundo
export interface MapDoor { id: number; roomId: number; side: DoorSide; col: number; row: number; /* 1ª das 2 células da abertura, na linha/coluna do piso da sala */ corridorId: number }
export interface MapCorridor { id: number; fromDoorId: number; toDoorId: number; cells: { col: number; row: number }[] } // caminho de 2 de largura, com curvas
export interface MapSpawn { defId: string; x: number; y: number }               // px de mundo, centro do ator
export interface MapZone {                                                       // sala (modo rooms) ou zona da sala gigante
  id: number; wave: number; isBossZone: boolean; title: string; banner: string;
  trigger: MapRect[];                 // onde o herói precisa pisar (pés) para ativar a onda
  floorRoomId: number | null;         // sala a que pertence (monstros presos ao piso dela); na sala gigante, a sala única
  spawns: MapSpawn[];
  entryDoorIds: number[]; exitDoorIds: number[];   // portas a selar/abrir (vazias no modo giant)
}
export interface MapRoom { id: number; shape: 'rect' | 'L' | 'cross' | 'compound'; bounds: { col: number; row: number; cols: number; rows: number } }
export interface MapProp { kind: 'floor' | 'tall'; name: string; frame?: number; x: number; y: number; roomId: number } // canto sup. esq., px de mundo
export interface DungeonMap {
  seed: number; mode: DungeonMapMode; cols: number; rows: number;
  cells: number[];      // cols*rows, MAP_CELL_*
  roomIdAt: number[];   // cols*rows, -1 fora de sala
  rooms: MapRoom[]; doors: MapDoor[]; corridors: MapCorridor[]; zones: MapZone[];
  props: MapProp[]; obstacles: MapRect[]; // obstáculos em "feet space", px de mundo
  torches: { col: number; row: number }[]; // células de face de parede norte com tocha
  heroStart: { x: number; y: number };
}
export function generateDungeonMap(seed: number, options?: { mode?: DungeonMapMode; waves?: string[][] }): DungeonMap;
```
**Regras:**
- **Ondas da fase de teste (padrão de `waves`):** `[['slime','wolf'], ['skeleton','skeleton_archer'], ['skeleton_chief']]`, com as quantidades de hoje (3–4 + 2–3; 3–4 + 2; chefe sozinho). No modo `rooms`: a sala inicial é a da onda 1 e o herói começa nela. As salas das ondas 2 e 3 vêm encadeadas, com **1 a 2 salas vazias de passagem** entre elas (de tamanho e formato variados). A sala do chefe é a maior. No modo `giant`: uma única sala grande (≥ 60×40 tiles, composta de retângulos para ficar irregular), com 3 zonas afastadas entre si, a zona do chefe no ponto mais distante do início e props/obstáculos espalhados que formam "caminhos".
- **Salas:** tamanho de 10×8 a 34×24 tiles; formas `rect`, `L`, `cross` e `compound`.
- **Corredores:** 2 tiles de largura, comprimento de 3 a 14, com 0 a 2 curvas, saindo pela parede apropriada (as direções devem variar de verdade entre N/S/L/O ao longo do mapa).
- **Geometria 2.5D (obrigatória para a parede caber):** acima de toda borda norte de piso, 3 linhas livres (face de 2 + topo); 1 coluna livre nas laterais; 1 linha livre abaixo da borda sul. Regiões de piso que não estão ligadas nunca podem invadir a parede umas das outras. Portas a ≥ 2 tiles das quinas. Nenhum corredor cruza outro nem atravessa uma sala.
- **Garantias** (BFS em grade de 16 px pelos pés): caminho do `heroStart` até todos os triggers e spawns; spawns a ≥ 140 px do ponto de entrada da zona, fora de obstáculos (com margem de 8 px) e dentro do piso da própria sala; props e obstáculos fora da área das portas e dos corredores. Determinístico por semente; regenere com sub-semente quando falhar (até 200 vezes), com um fallback simples.
- `src/core/dungeon/TestDungeon.ts` continua existindo, sem mudanças (a cena atual ainda o usa até a T-128).
**Testes (Vitest, `tests/core/dungeon-map.test.ts`):** os dois modos; determinismo; variação entre sementes; para 200 sementes por modo, conectividade, geometria 2.5D (folgas), portas coerentes com corredores, zonas e ondas com a composição certa e chefe na última zona; ao menos uma curva e ao menos 2 lados de porta diferentes na maioria das sementes do modo `rooms`; tamanhos e formatos realmente variados (meça a distribuição).
**Extra para avaliação visual:** um script `scripts/dev/renderDungeonMap.mjs` (Node puro, sem dependência nova; pode escrever um PNG simples à mão ou um SVG) que desenha o layout de uma semente: piso de sala, corredor, portas, zonas e spawns. Gere `assets/mockups/preview_m8_map_layouts.png` (ou `.svg`) com 6 sementes do modo `rooms` e 2 do `giant`. Olhe as imagens para conferir a variedade.
**Permitido:** `src/core/dungeon/DungeonMap.ts`, `tests/core/dungeon-map.test.ts`, `scripts/dev/`, `assets/mockups/preview_m8_map_layouts.*`. **Proibido:** `src/view/`, `TestDungeon.ts`, `src/core/index.ts`, `tests/e2e/`, assets de sprite, Git.
**Pronto quando:** `npm test` e `npm run build` passam e a prancha de layouts mostra salas variadas e corredores com curvas.
**Entrega:** até 10 linhas: o que foi feito, contagem de testes, distribuição medida (tamanhos, formas, curvas, lados de porta), caminho da prancha e o que não foi verificado.
