# BRF-151 (REFAZER) — AG08 (Arte): Mockup Estático 960×540 da Vila Natal no Padrão M8 (`surf_mockup.py`) (T-135)

- **Task:** `T-135` (M9 — `v0.9.0`)
- **Agente:** `AG08 (Arte)`
- **Motivo do retrabalho:** O dono reprovou o mockup anterior (`mockup_m9_village_hub.png`) porque:
  1. Não usou o pipeline de renderização, iluminação (`LightMap`) e tipografia/HUD (`render_text_overlay` via `.NET System.Drawing` com `Cinzel`/Sans) de `scripts/art/biomes/surf_mockup.py` e `scripts/art/buildMockupDungeonBasic.py` (usou fonte bitmap 5×7 serrilhada e ícone cartoon de balão de fala).
  2. O chão parecia um retângulo marrom quadriculado (`32×32`) flutuando num fundo verde chapado com palitos finos de cerca.
  3. O herói (`80×80`) foi encolhido para `48×48` e os NPCs pareciam bonecos de palito.

## Referências Obrigatórias (leia antes de codar)
1. `scripts/art/biomes/surf_mockup.py`, `scripts/art/biomes/surf_scenes.py`, `scripts/art/buildMockupDungeonBasic.py` e `scripts/art/buildDungeonBasic.py` (importe e reutilize `LightMap`, `apply_light`, `add_glow`, `draw_sprite_scaled`, `render_text_overlay`, `text_item`, `DF`, `FONT_TITLE`, `FONT_BODY`, `metal_button`, `chamfer_pts`, `disc`, `ring`, `polygon`, `stroke_poly`, `resize_area`).
2. `assets/mockups/ref_m9_village_hub.jpg`, `assets/mockups/mockup_m8_village.png` e `assets/mockups/mockup_m8_herb_field.png` (abra com `read_file`).

## Requisitos Técnicos Obrigatórios

1. **Zoom, Escala e Atores (`80×80` Nativos, ZERO encolhimento do Herói):**
   - Use **`ZOOM = 1.45`** e **`ACTOR_SCALE = 0.88`** (`s_actor = ACTOR_SCALE * ZOOM = 1.276`), **exatamente igual a `surf_mockup.py` (`mockup_m8_village.png` e `mockup_m8_herb_field.png`)**!
   - Renderize `hero_living.png` (frame 0, `80×80`), `npc_weapon_master.png` (frame 0, `80×80`), `npc_lyra.png` (frame 0, `80×80`) e `npc_gorran.png` (frame 6 `hammer2`, `80×80`, `flip=True` voltado para a esquerda sobre a bigorna) usando `draw_sprite_scaled(scr, frame, sx, sy, s_actor, flip, mask)` com sombra elíptica de contato sob os pés.

2. **Composição Orgânica 2.5D do Cenário (Fiel a `ref_m9_village_hub.jpg` + Qualidade de `mockup_m8_herb_field.png` / `mockup_m8_village.png`):**
   - **Perímetro 2.5D denso e natural (sem vazio verde chapado!):**
     - Cerque as bordas externas da clareira (norte, oeste, leste e cantos sul) com **copas densas de floresta/sebes 2.5D** (`biome_herb_field_tiles.png` — `hedge_cap` e `hedge_front` / `leaf_blobs` + árvores `tree_oak` de `biome_village_props_tall.png`) e contorne toda a clareira com a **paliçada alta 2.5D de toras apontadas** (`palisade_tall_h` / `palisade_tall_v` de `village_hub_props_large.png`, incluindo a paliçada em primeiro plano na borda inferior esquerda e direita com uma abertura central e tocha acesa à esquerda, igual a `ref_m9_village_hub.jpg`!).
   - **Terreno orgânico sem nenhuma marca de grade `32×32`:**
     - Base de grama dark-fantasy (`grass_0..1` / `surf_herb_field.py`) nas bordas junto à paliçada/árvores, fundindo-se de forma orgânica (via máscara radial contínua com `vnoise` — sem blocos quadrados duros!) em uma **ampla clareira central de terra batida quente**, com **estrada de terra e paralelepípedos (`draw_cobbles`) com trilhos sutis de roda de carroça** subindo do centro e atravessando o **Portão de Pedra (`"SAÍDA"`)** no canto superior direito, pátio de pedras diante da **Casa de Palha** à esquerda e piso de pedra/cinzas na área da **Forja** à direita.
   - **Posicionamento das Estruturas, Props e Personagens (em `960×540`):**
     - **Fundo-Esquerda:** `village_hub_house.png` (`224×192`, Casa de Palha 2.5D com janela acesa e remendo no telhado), pilha de lenha/barris à esquerda, **Lyra** em frente à porta e **braseiro aceso** (`brazier_0`) logo à direita da porta.
     - **Esquerda:** **Mestre de Armas** próximo à paliçada oeste voltado para o herói, com rótulo `"Mestre de Armas"` e ícone **`"!"` dourado brilhante** acima da cabeça.
     - **Centro-Esquerda:** **Herói (`hero_living`)** de frente para o Mestre/fogueira.
     - **Centro:** **Fogueira central grande (`campfire_large_0` de `village_hub_props_large.png`)** sobre anel de pedras e terra queimada.
     - **Topo-Direita:** **Portão de Pedra 2.5D (`village_hub_gate.png`, `192×160`)** com placa **`"SAÍDA"`** sobre a estrada que sai da vila, tocha acesa ao lado da estrada e a **Carroça de Madeira 2.5D (`wooden_cart_large` de `village_hub_props_large.png`)** estacionada logo à esquerda do pilar do portão (exatamente como em `ref_m9_village_hub.jpg`!).
     - **Direita:** Área do ferreiro com a **Bigorna grande (`anvil_large`)**, **Gorran** martelando a barra incandescente sobre a bigorna com faíscas voando, a **Forja de pedra acesa (`forge_large_0`)** à direita dele e barril/roda de carroça/caixotes (`biome_village_props.png`).

3. **Iluminação 2.5D Real (`LightMap` + `apply_light` + `add_glow` de `surf_mockup.py`):**
   - Ambiente crepuscular quente `ambient = (0.48, 0.43, 0.46)`, `vignette_k = 0.68`, `sprite_mix = 0.42`.
   - Luzes quentes (`lm.add` + `add_glow`) na fogueira central, na forja e faíscas da bigorna do Gorran, no braseiro e janela da casa da Lyra, nas tochas (`torch_post_0`) e luz suave de preenchimento no herói e na saída norte do portão.

4. **HUD Enxuto da Vila e Rótulos via `render_text_overlay` (`.NET System.Drawing` `Cinzel` / Sans — PROIBIDO fonte bitmap!):**
   - Use **obrigatoriamente** `render_text_overlay(scr, texts, out)` e `text_item(...)` de `buildDungeonBasic.py` + primitivas de `surf_mockup.py` (`draw_hud`):
     - **Topo-Esquerda:** Retrato circular `portraits[0]` com aro duplo bronze/ouro + badge `"Nv. 1"`, título `"JOVEM GUERREIRO"` (`FONT_TITLE`), barra de HP chanfrada (`100/100`), barra secundária fina e tracker de missão: losango dourado + `"VILA NATAL"` (`FONT_TITLE`, `TXT_GOLD`) + `"Falar com o Mestre"` (`FONT_BODY`, `TXT_PARCH`) + linha divisória ouro/bronze.
     - **Inferior-Esquerda:** D-Pad / joystick virtual translúcido (código exato de `surf_mockup.py` linhas 333–345).
     - **Topo-Direita:** Minimapa circular (`mx = SW - 60, my = 60, mr = 46`, mesmo estilo de `surf_mockup.py` mostrando a geometria da clareira e saída norte, triângulo ciano do herói, pontos dos 3 NPCs e fogueira, aro bronze/ouro e `"N"`). Logo abaixo do minimapa (`row_y = 128`): 3 botões circulares `metal_button` (`Inventário` com `icons[6]`, `Áudio` com `icons[8]` e `Config.` com ícone de engrenagem 2D limpo) e seus rótulos em `FONT_BODY`.
     - **Inferior-Direita:** Apenas o botão circular principal **`Interagir`** (`atk_x = SW - 92, atk_y = SH - 104, atk_r = 42`) no mesmo acabamento metálico/carmesim-dourado do botão principal de `surf_mockup.py`, com emblema 2D limpo e texto `"Interagir"` em `FONT_TITLE` (`Cinzel`).
     - **Rótulos sobre os NPCs (via `text_item` em `render_text_overlay`):**
       - Sobre o Mestre de Armas: `"!"` grande em `FONT_TITLE` dourado brilhante (`24px`, com `add_glow` dourado atrás) + `"Mestre de Armas"` (`11.5px`, `TXT_GOLD`, `FONT_TITLE`);
       - Sobre a Lyra: `"Lyra"` (`11px`, `TXT_PARCH`, `FONT_TITLE`);
       - Sobre o Gorran: `"Gorran"` (`11px`, `TXT_PARCH`, `FONT_TITLE`).
     - **NÃO incluir:** contadores de almas/essências/moedas no topo, botão AUTO, Loja, Passe, barra de EXP/chat, botões de Skills, Poção ou Esquiva (Decisão #23).

## Restrições
- **Proibido executar comandos `git`.**
- Inspecione `assets/mockups/mockup_m9_village_hub.png` com `read_file` após gerar e compare lado a lado com `assets/mockups/mockup_m8_village.png` e `assets/mockups/ref_m9_village_hub.jpg` antes de concluir.
