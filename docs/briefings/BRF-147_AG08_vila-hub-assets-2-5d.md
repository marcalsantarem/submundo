# BRF-147 (REFAZER) — AG08 (Arte): Assets Pixel Art 2.5D de Alta Qualidade da Vila Natal (T-133)

- **Task:** `T-133` (M9 — `v0.9.0`)
- **Agente:** `AG08 (Arte)`
- **Motivo do retrabalho:** O dono reprovou a versão anterior porque:
  1. Os tiles de chão (`dirt_0..2`) tinham manchas repetitivas nos mesmos cantos, gerando uma grade quadriculada `32×32` aparente no chão.
  2. A casa de palha (`village_hub_house.png`) e o portão de pedra (`village_hub_gate.png`) pareciam caixas geométricas chapadas de frente, sem a profundidade 2.5D, textura de pedra (`voronoi_stones`), madeira, reboco e telhado orgânico dos biomas aprovados no M8 (`surf_village.py` e `surf_herb_field.py`).
  3. A paliçada, carroça, forja, bigorna e fogueira em `32×32` ficaram minúsculas e chapadas perto do herói `80×80` (~`68px` de altura).

## Referências Obrigatórias (leia antes de codar)
1. `scripts/art/biomes/surf_village.py` e `scripts/art/biomes/surf_herb_field.py` (veja como `voronoi_stones`, `plaster`, `beam_h`, `post_v`, `brace`, `window`, `draw_cobbles`, `grass`, `leaf_blobs`, `drystone` e `overhang_shadow` constroem superfícies 2.5D ricas e sem costuras!).
2. `scripts/art/biomes/surf_common.py` e `scripts/art/buildDungeonBasic.py`.
3. `assets/mockups/ref_m9_village_hub.jpg` e `assets/mockups/mockup_m8_village.png` (abra com `read_file`).

## Requisitos Técnicos Obrigatórios

1. **`public/assets/sprites/village_hub_tiles.png` (`320×32`, 10 frames `32×32`) — ZERO costura / ZERO grade aparente:**
   - Frames: `dirt_0`, `dirt_1`, `dirt_2`, `dirt_trail`, `grass_0`, `grass_1`, `dirt_grass_n`, `dirt_grass_s`, `dirt_ash`, `dirt_cobble`.
   - Use `vnoise(x, y, 32, seed, 8)` (periódico módulo 32 de `surf_common.py`) e pedras que atravessam a borda (`cobble_layout` de `surf_village.py`) para que `dirt_0..2` e `grass_0..1` **emendem de forma 100% contínua sem nenhuma marca de grade `32×32` quando repetidos lado a lado**!
   - Para `grass_0` e `grass_1`, use a função `grass()` de `surf_herb_field.py` (grama dark-fantasy rica com folhinhas). Para `dirt_cobble`, combine a terra batida com pedras de calçamento (`COB_TONES`) de `surf_village.py`.

2. **`public/assets/sprites/village_hub_house.png` (`224×192` RGBA) — Casa de Palha 2.5D Rica e Detalhada:**
   - Construa com as técnicas 2.5D de `surf_village.py` + `surf_common.py` e a composição de `ref_m9_village_hub.jpg`:
     - **Telhado de sapê 2.5D volumoso (`y=6..108`):** Camadas orgânicas de feixes de palha dourada/ocre/marrom-escura sobrepostas em fiadas com textura de fios (`h01`/`vnoise`), beiral largo e irregular projetando sombra forte (`overhang_shadow`) sobre a fachada, **remendo de tábuas de madeira escura pregadas** na água esquerda do telhado, tufos sutis de musgo e **caibros de madeira cruzados em `X`** ao longo da cumeeira superior.
     - **Fachada em enxaimel e fundação de pedra (`y=98..182`):** Parede com reboco envelhecido (`plaster` de `surf_village.py`), vigas grossas de carvalho (`beam_h`, `post_v` e mãos-francesas diagonais `brace`), embasamento alto de **pedras irregulares (`voronoi_stones`)** na metade inferior, **janela acesa com caixilho de madeira, postigos e brilho quente âmbar** à esquerda (`window` de `surf_village.py`), e **porta pesada de tábuas de madeira com dobradiças/argola de ferro, batente recuado em 2.5D e degrau de pedra** à direita (onde Lyra ficará posicionada).
     - **Detalhes integrados na base/lateral:** Tonel/lenha encostados na base esquerda e sombra elíptica/projetada no chão (`y=178..190`).

3. **`public/assets/sprites/village_hub_gate.png` (`192×160` RGBA) — Portão de Pedra e Madeira 2.5D com `"SAÍDA"`:**
   - Construa com `voronoi_stones` e madeiramento 2.5D pesado fiel a `ref_m9_village_hub.jpg`:
     - **Dois pilares maciços de alvenaria de pedra (`x=14..64` e `x=128..178`, `y=14..152`):** Cada pilar com **topo 2.5D visível** (lajes de pedra chanfradas com luz superior), face frontal e **face lateral interna** mostrando espessura 3D real, pedras esculpidas via `voronoi_stones`, rachaduras, musgo na base e plinto escalonado de pedra.
     - **Viga dupla superior e mãos-francesas (`y=18..58`):** Duas vigas horizontais grossas de madeira escura reforçadas com cintas e rebites de ferro atravessando o vão entre os pilares, sustentadas por **escoras diagonais de madeira** (`brace`) engastadas nos pilares e projetando sombra sobre o vão.
     - **Folhas do portão entreabertas (`x=60..84` e `x=112..130`, `y=46..148`):** Portões pesados de pranchas verticais com travessas de ferro entreabertos para dentro, deixando a passagem central transparente.
     - **Placa `"SAÍDA"` (`x=130..188, y=58..84`):** Placa rústica de madeira escura com moldura e rebites de ferro fixada no pilar direito, com a palavra **`SAÍDA`** perfeitamente legível e nítida em tom ouro-pálido/pergaminho.

4. **`public/assets/sprites/village_hub_props.png` (`896×32`, 28 frames `32×32`) + `public/assets/sprites/village_hub_props_large.png` (`768×64`, 12 frames `64×64` para elementos de porte real 2.5D):**
   - **Mantenha `village_hub_props.png` (`896×32`, 28 frames `32×32`)** com os 28 frames do contrato (`palisade_h`, `palisade_v_l`, `palisade_v_r`, `palisade_corner_t`, `palisade_corner_b`, `palisade_end`, `campfire_0..3`, `brazier_0..3`, `torch_post_0..3`, `forge_0..3`, `anvil`, `sign_exit`, `firewood`, `barrel`, `cart_wheel`, `wooden_cart`), todos refinados com sombreamento 2.5D rico e ocupando bem o frame `32×32`.
   - **Adicione `public/assets/sprites/village_hub_props_large.png` (`768×64`, 12 frames `64×64`)** para os elementos que na cena e no mockup precisam de **escala 2.5D proporcional ao herói `80×80`** (fiel a `ref_m9_village_hub.jpg`):
     - Frames `0..3` (`campfire_large_0..3`, `64×64`): Fogueira central de acampamento com anel circular detalhado de pedras de rio (`voronoi_stones`), base de cinzas/brasas incandescentes, toras cruzadas carbonizadas e labaredas ricas em 4 camadas (`#b91c1c` -> `#ea580c` -> `#f59e0b` -> `#fef08a`) com fagulhas subindo.
     - Frames `4..7` (`forge_large_0..3`, `64×64`): Forja robusta de alvenaria de pedra (`voronoi_stones`) em 2.5D com bancada superior, leito de carvão e brasa viva animada no topo, boca de fornalha acesa na base frontal, tenaz/ferramentas apoiadas e brilho quente nas pedras.
     - Frame `8` (`anvil_large`, `64×64`): Bigorna clássica pesada de ferro escuro (chifre cônico, mesa polida com highlight metálico, base chanfrada) montada sobre um **cepo grosso de tronco de carvalho** com anéis de ferro e sombra no chão.
     - Frame `9` (`wooden_cart_large`, `64×64`): Carroça medieval de madeira 2.5D completa (caçamba de tábuas com fardos de palha/sacos, duas rodas grandes raiadas com aro de ferro e varais frontais), na escala real de `ref_m9_village_hub.jpg`.
     - Frame `10` (`palisade_tall_h`, `64×64`): Trecho largo (`64px`) de **paliçada alta 2.5D de toras roliças apontadas** (~`52px` de altura, toras de alturas variadas com casca texturizada, pontas chanfradas claras, travessas horizontais amarradas com cordas e sombra projetada no chão).
     - Frame `11` (`palisade_tall_v`, `64×64`): Trecho lateral/canto de paliçada alta 2.5D de toras apontadas com escora diagonal de madeira.

5. **Manifesto Parcial e Prancha de Validação (`preview_m9_village_assets.png`):**
   - Registre `village_hub_tiles`, `village_hub_props`, `village_hub_props_large`, `village_hub_house` e `village_hub_gate` em `scripts/art/biomes/out/village_hub_assets.manifest.json`.
   - Gere `assets/mockups/preview_m9_village_assets.png` mostrando todos os tiles (incluindo um bloco `6×4` repetido de `dirt_0..2` e `grass_0..1` provando que **não há grade aparente**!), os props `32×32`, os props `64×64` (`village_hub_props_large`), a `village_hub_house` (`224×192`) e o `village_hub_gate` (`192×160`).
   - **Inspecione `assets/mockups/preview_m9_village_assets.png` com `read_file`** e refine até atingir o padrão de `preview_m8_village_sheets.png` e `preview_m8_herb_field_sheets.png`.

## Restrições
- **Proibido executar comandos `git`.**
- Não editar `public/assets/sprites/manifest.json` diretamente (grave apenas em `scripts/art/biomes/out/village_hub_assets.manifest.json`).
