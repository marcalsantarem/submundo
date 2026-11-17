# BRF-051 — AG08 — T-052 Ajuste do Tile de Grama Contínua (`village_tiles.png`)

**Leia:** `docs/agentes/AG08_Arte.md`, `scripts/art/generateSprites.mjs` (função `generateVillageTiles`). **Regra:** manter exatamente as dimensões `64x16` (`4` frames `16x16`) e os frames `1..3` (`cobble_square`, `wood_wall`, `village_lantern`); zero git commands.
**Decisão do dono:** Pedido explícito para suavizar o piso base da Vila Natal / Gruta antes da validação `T-050`.
**Fazer:**
1. Em `scripts/art/generateSprites.mjs` (`generateVillageTiles`), alterar apenas o **frame 0 (`grass_path`)**:
   - Remover a faixa vertical marrom central que cria listras verticais quando o tile é repetido em grade 32x32 na Vila Natal e na Gruta.
   - Substituir por textura orgânica contínua (*seamless*) de grama escura/musgo sombrio (`#1a3322`, `#1f3d28`, `#264b31`) com dithering sutil e raros tufos/pedrinhas espalhados de forma equilibrada nas bordas para evitar padrão listrado ao repetir em `HubScene` e `DungeonScene`.
2. Rodar `node scripts/art/generateSprites.mjs` para regenerar `public/assets/sprites/village_tiles.png`.
**Permitido:** `scripts/art/generateSprites.mjs`, `public/assets/sprites/village_tiles.png` (e demais PNGs regenerados pelo script sem alterar dimensões).
**Proibido:** alterar `src/`, `tests/`, `manifest.json` (versão/dimensões) ou executar comandos git.
**Pronto quando:** `village_tiles.png` regenerado (`64x16`) e inspecionado sem listras verticais no frame 0.
**Entrega:** até 3 linhas confirmando a alteração em `generateVillageTiles` e a regeneração de `village_tiles.png`.
