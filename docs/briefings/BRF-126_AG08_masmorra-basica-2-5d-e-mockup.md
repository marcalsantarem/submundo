# BRF-126 — AG08 — T-117 Masmorra Básica 2.5D (tiles + props) e mockup estático de validação
**Leia:** `docs/agentes/AG08_Arte.md`, `docs/guia_visual.md` (paleta Abismo/Espectro), `docs/decisoes.md` #10, #14, #16 e #17, as referências `assets/mockups/mockup_pixel_art.jpg` e `assets/mockups/ref_landscape_hud.jpg` (abra as imagens), `public/assets/sprites/manifest.json` e só os trechos necessários de `scripts/art/`. **Regra:** respostas curtas; sem commit/push/branches.

**Decisão do dono (#17):** antes de fazer os biomas do M8, validar o estilo com **um único ambiente**: uma masmorra básica escura em pixel art dark fantasy, top-down 2.5D (paredes com profundidade: topo + face frontal visível), e um **mockup estático** simulando o jogo final com esses assets. Os outros biomas serão feitos depois, a partir do estilo aprovado.

**Contrato (para a Onda B, que vem depois: AG07 BootScene + AG01 DungeonScene):**
- `public/assets/sprites/dungeon_basic_tiles.png`: spritesheet de frames **32×32** (escala de exibição 1:1 em `960×540`, igual a `TILE_DISPLAY_SIZE = 32` hoje). Inclua no mínimo: 3 a 4 variações de piso de pedra (uma rachada, uma com musgo ou sangue seco), parede com topo, face frontal da parede (altura de 1 a 2 tiles para dar profundidade), cantos internos e externos, bordas laterais, soleira ou arco de porta rúnico e uma sombra projetada da parede sobre o piso.
- `public/assets/sprites/dungeon_basic_props.png`: props em frames **32×32** ou **32×64** (um tamanho por sheet; se precisar de dois, crie `dungeon_basic_props_tall.png`): tocha de parede **animada (4 frames)**, pilar, destroços/ossos, baú fechado, barril ou urna, corrente pendurada.
- Registre os dois sheets em `manifest.json` com `frameWidth`, `frameHeight` e `frames` nomeados (ex.: `floor_0`, `wall_top`, `wall_face`, `torch_0..3`). **Não altere** `dungeon_tiles.png` nem os outros sheets existentes, que continuam em uso.
- Contraste: o cenário tem luminância baixa; herói, monstros e telegrafias precisam se destacar. Luz quente das tochas (`#f59e0b`/`#fde047`) contra o Abismo (`#14141b`/`#09090b`).

**Fazer:**
(1) Gerador via código em `scripts/art/buildDungeonBasic.py` (ou `.mjs`; Python 3.14 e Node 24 estão disponíveis) produzindo os sheets acima de forma determinística.
(2) Gerador do mockup em `scripts/art/buildMockupDungeonBasic.py`, que monta `assets/mockups/mockup_m8_dungeon_basic.png` em **`960×540`**: uma sala da masmorra usando os tiles e props novos (paredes com profundidade nas bordas, porta/arco em uma parede, 2 a 4 tochas com halo de luz e vinheta escura), o herói (`hero_living.png`, frame idle, na escala do jogo) no centro, 3 a 5 monstros reais (`slime`, `cave_bat`, `wolf`, `skeleton`, `skeleton_archer`), um drop de loot no chão e uma **sobreposição do HUD paisagem** aproximando o atual (retrato circular + HP no canto superior esquerdo, tracker, minimapa circular, D-pad translúcido à esquerda e cluster Ataque/Esquiva/Skills/Poção à direita, usando `ui_icons.png` e `portraits.png`). O objetivo é parecer uma captura real do jogo.
(3) Gere também `assets/mockups/preview_m8_dungeon_basic_sheets.png`: uma prancha com todos os tiles e props ampliados 3× e rotulados, para aprovação.
(4) Adicione uma seção curta "Masmorra Básica 2.5D (M8 piloto)" em `docs/guia_visual.md` com a tabela dos dois sheets.

**Permitido:** `scripts/art/`, `assets/mockups/`, `public/assets/sprites/dungeon_basic_*.png`, `public/assets/sprites/manifest.json` (apenas acrescentar entradas), `docs/guia_visual.md`. **Proibido:** `src/`, `tests/`, `index.html`, configs de build, sheets existentes, Git.

**Armadilhas:** a escala do herói e dos monstros no mockup deve ser a do jogo (confira em `DungeonScene.ts` como o herói `80×80` e os monstros são exibidos; só leitura). Pixel art no cenário (sem antialias ao ampliar); a sobreposição do HUD pode ser suave (é arte 2D). Depois de gerar, **abra o mockup e a prancha você mesmo** para conferir a leitura e corrigir o que estiver ruim antes de entregar.

**Pronto quando:** os 3 PNGs existem com as dimensões corretas, o `manifest.json` é um JSON válido com as novas entradas (contagem de frames = largura / frameWidth), os scripts rodam do zero e geram os mesmos arquivos, e `npm test` continua verde.

**Entrega:** até 12 linhas: arquivos gerados com dimensões e frames, lista nomeada dos frames, como o mockup foi composto (escalas usadas), o que não foi verificado e sugestões para a Onda B.
