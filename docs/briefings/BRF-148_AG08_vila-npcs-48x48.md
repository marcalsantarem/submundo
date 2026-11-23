# BRF-148 (REFAZER) — AG08 (Arte): NPCs da Vila Natal no Padrão Real 80×80 do Herói (T-134)

- **Task:** `T-134` (M9 — `v0.9.0`)
- **Agente:** `AG08 (Arte)`
- **Motivo do retrabalho:** O dono reprovou a versão anterior (`48×48` com formas geométricas simples e olhos de 2 pontinhos pretos). No jogo, **todos os personagens (`hero_living`, `hero_wraith`, `skeleton`, `skeleton_chief`, etc.) usam frames `80×80` com `FOOT_Y = 76` e `CENTER_X = 40`** (~`64–68px` de altura real). Os 3 NPCs da Vila precisam ter **exatamente a mesma resolução (`80×80`), anatomia, rosto detalhado e sombreamento de `hero_living.png`**.

## Referências Obrigatórias (leia antes de codar)
1. `scripts/art/buildHeroAndWeapons.py` (especialmente linhas 420–980: `Canvas`, `read_png`, `write_png`, `HeroTheme`, `LIVING_THEME`, `extract_hero_parts`, `draw_leg`, `draw_arm`, `draw_capsule`, `draw_disc`, `draw_polygon_shaded`, `solve_2bone_ik`, `add_outline`, `remove_isolated_pixels`, `dim_palette`).
2. `assets/sprites_src/hero_living_base.png` (`80×80` — abra com `read_file`) e `assets/sprites_src/ui/portraits_128.png` (frames 2 e 3 mostram o Mestre de Armas e o Ferreiro Gorran!).
3. `assets/mockups/ref_m9_village_hub.jpg` (referência de figurino e pose dos 3 NPCs).

## Requisitos Técnicos Obrigatórios

1. **Padrão de Frame `80×80` (`FOOT_Y = 76`, `CENTER_X = 40`) — IGUAL ao `hero_living.png`:**
   - `public/assets/sprites/npc_weapon_master.png`: **`320×80`** (4 frames `80×80`: `idle0`, `idle1`, `idle2`, `idle3`).
   - `public/assets/sprites/npc_lyra.png`: **`320×80`** (4 frames `80×80`: `idle0`, `idle1`, `idle2`, `idle3`).
   - `public/assets/sprites/npc_gorran.png`: **`640×80`** (8 frames `80×80`: `idle0..idle3` + `hammer0..hammer3`).

2. **Construção Anatômica via `buildHeroAndWeapons.py` + `hero_living_base.png` (PROIBIDO boneco palito/blocos ou olhos de 2 pontinhos):**
   - Importe as funções e o `extract_hero_parts` de `scripts/art/buildHeroAndWeapons.py` e carregue `assets/sprites_src/hero_living_base.png`.
   - Use a cabeça/rosto 3/4 real (`head`), o torso (`torso`) e a ombreira (`pauldron`) extraídos de `hero_living_base.png` + as funções de membros articulados 2-bone IK (`draw_leg`, `draw_arm`, `draw_polygon_shaded`, `draw_capsule`, `add_outline`) como base anatômica real de cada NPC:
   - **Mestre de Armas (`npc_weapon_master.png`, `320×80`, 4f `80×80`):**
     - **Cabeça/Rosto (`y=8..26`):** Parta do `head` real de `hero_living_base.png` (preservando a anatomia facial 3/4, olhos com esclera/íris, nariz e orelha), recolore o cabelo e sobrancelhas para grisalho/prateado veterano (`(78,84,96)`, `(122,130,142)`, `(170,178,190)`, `(214,220,230)`), remova as fitas da bandana e esculpa uma **barba e bigode grisalhos cheios e sombreados** sobre o maxilar/queixo (`y=18..26`) + cicatriz sutil na face (fiel ao retrato 2 de `portraits_128.png`).
     - **Torso, Couraça, Ombreiras e Capa (`y=23..66`):** Adapte o `torso` e `pauldron` para **armadura de placas de aço polido/escuro** (`(38,44,56)`, `(68,76,92)`, `(112,124,142)`, `(166,178,196)`) com correia diagonal de couro marrom (`baldric`), fivela dourada no cinto, ombreiras de aço rebitadas nos dois ombros e uma **capa veterana azul-ardósia escuro** (`draw_polygon_shaded`, `y=25..64`) caindo atrás das costas.
     - **Pernas/Grevas (`y=44..75`):** Use `draw_leg` com calças escuras e botas/grevas de aço e couro (`FOOT_Y = 76`).
     - **Braços e Alabarda (`y=4..75`):** Braço traseiro firme junto ao cinto; braço dianteiro (`draw_arm` com braçadeira de aço) segurando na vertical uma **alabarda de aço detalhada** (`y=4..75`: haste de madeira de lei com anéis de ferro, lâmina crescente de machado chanfrada com brilho metálico, ponta de lança superior e espinho traseiro, com contorno `OUTLINE` 1px).
     - **Ciclo `idle0..idle3`:** Respiração orgânica (`bob_y = 0, -1, -1, 0`), leve ondulação da capa e micro-movimento do peito/alabarda.
   - **Lyra (`npc_lyra.png`, `320×80`, 4f `80×80`):**
     - **Cabeça/Rosto (`y=11..27`, levemente mais baixa ~`63px` de altura total):** Parta do `head` de `hero_living_base.png` deslocado `+2px` em Y e suavizado no maxilar em 1px, pele clara/quente (`(158,108,90)`, `(198,142,118)`, `(234,178,146)`, `(248,206,174)`), olhos expressivos nítidos, cabelo castanho-avelã preso em **coque trançado** atrás da nuca (`x=28..35, y=13..21`) com mechas laterais suaves emoldurando o rosto.
     - **Corpete, Mangas, Saia Longa e Avental (`y=26..74`):** Corpete medieval verde-oliva (`(30,48,34)`, `(48,74,50)`, `(72,102,68)`, `(96,130,88)`) com gola/decote e mangas bufantes de linho creme (`(148,136,116)`..`(232,222,202)`), **saia longa pregueada verde-oliva** até os tornozelos (`y=42..72`, `draw_polygon_shaded` com dobras verticais), pontas das botas de couro visíveis na base (`FOOT_Y = 76`) e **avental frontal creme/pergaminho** (`x=34..47, y=41..69`, `draw_polygon_shaded`).
     - **Cinto, Bolsa de Ervas e Frasco de Poção Esmeralda:** Cinto de couro marrom (`y=40..42`) com bolsinha de couro à esquerda e um **frasco de vidro de poção verde-esmeralda brilhante** (`x=45..50, y=42..49`: gargalo com rolha, líquido `#059669`/`#10b981`/`#6ee7b7` e ponto de brilho especular branco) pendurado no quadril; braços (`draw_arm`) com mãos postas à frente do avental segurando um pequeno ramo/frasco.
     - **Ciclo `idle0..idle3`:** Respiração suave (`bob_y = 0, -1, -1, 0`), leve balanço da barra da saia/avental e cintilação sutil no frasco de poção.
   - **Gorran (`npc_gorran.png`, `640×80`, 8f `80×80`: `idle0..3` + `hammer0..3`):**
     - **Cabeça/Rosto (`y=9..26`):** Parta do `head` de `hero_living_base.png` com pele bronzeada pelo calor da forja, cabelo castanho-avermelhado escuro/carvão e **barba cheia e larga de ferreiro** (`(52,26,18)`, `(86,42,26)`, `(124,62,36)`, `(158,84,48)` — fiel ao retrato 3 de `portraits_128.png`).
     - **Torso Musculoso, Avental de Couro e Braços Fortes (`y=25..75`):** Ombros e peito largos (`+2px` de largura), braços nus musculosos (`draw_arm` com `r0=3.5, r1=2.9` e munhequeiras de couro escuro), camisa escura sob a gola e **avental pesado de couro marrom-queimado de ferreiro** (`(42,25,17)`, `(70,42,28)`, `(102,64,42)`, `(134,88,58)`) com alças nos ombros, bolso peitoral, rebites metálicos e cinto de ferramentas, descendo até `y=61` sobre calças escuras e botas pesadas (`draw_leg`, `FOOT_Y = 76`).
     - **Frames `0..3` (`idle0..idle3`):** Respiração firme segurando o **martelo pesado de forja** (cabo de madeira + cabeça de ferro chanfrada) na mão direita e a tenaz de ferro na mão esquerda.
     - **Frames `4..7` (`hammer0..hammer3`):** Ciclo real de martelada articulado por IK (`solve_2bone_ik`):
       - Mão esquerda estende a **tenaz de ferro** (`x=46..60, y=47..50`) segurando uma **barra de ferro incandescente** (`#b91c1c` -> `#f97316` -> `#fef08a`).
       - Braço direito executa o arco completo de martelada:
         - `hammer0`: braço erguido acima do ombro (`hand=(34, 19)`), martelo armado no alto;
         - `hammer1`: descida rápida (`hand=(44, 28)`);
         - `hammer2` (**Impacto**): golpe firme sobre a barra incandescente (`hand=(50, 41)`, cabeça do martelo em `(57, 46)`) com **explosão de faíscas douradas/laranjas** ao redor do ponto de impacto e compressão de `+1px` no torso;
         - `hammer3`: recuo/rebote (`hand=(45, 32)`) com faíscas residuais subindo.
   - Adicione sombra elíptica de contato sutil sob os pés de todos os 3 NPCs (mesmo padrão do herói/monstros).

3. **Manifesto Parcial e Prancha de Validação (`preview_m9_village_npcs.png`):**
   - Atualize `scripts/art/biomes/out/village_hub_npcs.manifest.json` com `frameWidth: 80, frameHeight: 80` para `npc_weapon_master`, `npc_lyra` e `npc_gorran`.
   - Gere `assets/mockups/preview_m9_village_npcs.png` (ampliado `3×` ou `4×` com rótulos nítidos via `render_text_overlay` de `buildDungeonBasic.py` e uma linha inferior comparando lado a lado `hero_living` frame 0 `80×80` com `npc_weapon_master`, `npc_lyra` e `npc_gorran` **na mesma escala 1:1 sem redimensionar o herói!**).
   - **Inspecione `assets/mockups/preview_m9_village_npcs.png` com `read_file`** e refine até que os 3 NPCs tenham exatamente a mesma qualidade, nitidez facial e acabamento do `hero_living`.

## Restrições
- **Proibido executar comandos `git`.**
- Não editar `public/assets/sprites/manifest.json` diretamente (grave apenas o manifesto parcial em `scripts/art/biomes/out/village_hub_npcs.manifest.json`).
