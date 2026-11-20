# Guia Visual — SUBMUNDO (Pixel Art Dark Fantasy & Arte 2D Estilizada)

Este documento define a direção de arte, paleta de cores, regras de contraste e especificações técnicas dos spritesheets, tilesets e retratos (`v0.4.0`).

---

## 1. Paleta de Cores

### 1.1. Submundo & Masmorra (Dark Fantasy)
A paleta prioriza cenários abissais de baixa saturação para garantir que o herói, projéteis, chamas espirituais e telegrafias de ataque tenham leitura imediata tanto no PC (`800x600`) quanto no Mobile (`9:16`).

| Categoria | Papel Visual | Hex Primário | Hex Secundário / Sombra | Hex Brilho / Destaque |
| :--- | :--- | :--- | :--- | :--- |
| **Abismo (Cenário)** | Pisos, paredes e sombras profundas | `#14141b` | `#09090b` | `#272730` |
| **Espectro (Herói / Alma)** | Chamas espirituais, lâmina, Dash, Orbe e Portal | `#38bdf8` | `#0284c7` / `#1e1b4b` | `#e0f2fe` |
| **Submundo (Sangue / Limo)** | `abyssal_slime`, sangramento e dano vital | `#ef4444` | `#991b1b` / `#450a0a` | `#fca5a5` |
| **Inferno (Brasa / Boss)** | `infernal_warden`, olhos de ameaça e impacto | `#dc2626` | `#7f1d1d` | `#f97316` / `#facc15` |
| **Ossos & Ferro** | `bone_sentinel`, armaduras e lâminas físicas | `#e4e4e7` | `#71717a` / `#3f3f46` | `#fafafa` |

### 1.2. Vila Natal / Prólogo (Tons Vivos Quentes)
Para contrastar emocionalmente com a queda e a condenação no Submundo, a Vila Natal utiliza tons quentes e orgânicos antes da invasão.

| Categoria | Papel Visual | Hex Primário | Hex Secundário / Sombra | Hex Brilho / Destaque |
| :--- | :--- | :--- | :--- | :--- |
| **Grama & Trilha** | `grass_path` e vegetação viva | `#3d6b35` | `#2f5229` | `#5a8f49` / `#926943` |
| **Calçamento & Pedra** | `cobble_square` e portão `village_gate` | `#7e7467` | `#3b352f` / `#4f4840` | `#a89b8c` |
| **Madeira & Reboco** | `wood_wall` e tendas da vila | `#7c4d2b` | `#2e1a0d` / `#5c3a21` | `#dfc5a4` |
| **Luz Quente & Forja** | `village_lantern`, tochas e forja viva | `#f59e0b` | `#b91c1c` | `#fde047` / `#fef9c3` |

---

## 2. Regras de Contraste e Refinamento (16/32-bit)

1. **Cenário Silencioso (Baixa Luminância):** Os tiles de piso (`floor_dark`, `floor_cracked`, `refuge_floor`) utilizam *dithering* ordenado 2x2 sutil mantendo luminância baixa (6%–12%), sem ruído de alto contraste que confunda colisão.
2. **Paredes Delimitadas:** `wall_abyssal` e `refuge_wall` possuem sombreamento de 4 tons, topo iluminado (`#52525b` / `#64748b`) e juntas escuras (`#09090b`) para leitura imediata de bloqueio físico.
3. **Sombreamento 4 Tons & Rim Lighting:** Personagens e monstros possuem contorno `#09090b`, sombreamento volumétrico de 4 tons, silhuetas orgânicas (capuz pontiagudo, chifres curvos, asas recortadas) e *rim lighting* direcional (`#38bdf8` no Espectro/Hub, `#f97316` no Inferno).
4. **Telegrafia Visual:** Os frames de ação (`attack`, `slam`, `dash`) expandem a silhueta com arcos de energia de alto brilho (`#e0f2fe` ou `#f97316`).
5. **Retratos 2D Estilizados (`portraits.png`) e Ícones de UI (`ui_icons.png`):** Arte 2D estilizada com recorte por alpha suave, preservação de *glows*/auras, descontaminação de cor e downscale por integração de área em *premultiplied alpha* (`portraits.png` em frames `128x128` e `ui_icons.png` em frames `64x64`).

---

## 3. Especificação de Spritesheets, Tilesets e Retratos (`public/assets/sprites/`)

Todos os arquivos são gerados via código por `scripts/art/generateSprites.mjs` em formato PNG RGBA (`8-bit/color`, transparência alfa) e catalogados em `public/assets/sprites/manifest.json` (`"version": "0.4.0"`).

| Key | Arquivo | Dimensões Totais | Frame (`LxA`) | Qtd. Frames | Convenção de Frames (Índice: Nome) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `hero_living` | `hero_living.png` | `1920x80` px | `80x80` px | 24 | `0..3: idle0..3`, `4..9: walk0..5`, `10..15: attack0..5`, `16..19: dash0..3`, `20..23: hit0..3` |
| `hero_wraith` | `hero_wraith.png` | `1920x80` px | `80x80` px | 24 | `0..3: idle0..3`, `4..9: walk0..5`, `10..15: attack0..5`, `16..19: dash0..3`, `20..23: hit0..3` |
| `weapons` | `weapons.png` | `192x48` px | `48x48` px | 4 | `0: iron_sword`, `1: cyan_runeblade`, `2: inferno_axe`, `3: crimson_dagger` |
| `wraith_warrior` | `wraith_warrior.png` | `128x32` px | `32x32` px | 4 | `0: idle0`, `1: idle1`, `2: attack`, `3: dash` |
| `abyssal_slime` | `abyssal_slime.png` | `64x32` px | `32x32` px | 2 | `0: idle0`, `1: idle1` |
| `bone_sentinel` | `bone_sentinel.png` | `64x32` px | `32x32` px | 2 | `0: idle0`, `1: attack` |
| `infernal_warden` | `infernal_warden.png` | `128x64` px | `64x64` px | 2 | `0: idle`, `1: slam` |
| `dungeon_tiles` | `dungeon_tiles.png` | `64x16` px | `16x16` px | 4 | `0: floor_dark`, `1: floor_cracked`, `2: wall_abyssal`, `3: portal_soul` |
| `soul_orb` | `soul_orb.png` | `16x16` px | `16x16` px | 1 | `0: idle` |
| `loot_icons` | `loot_icons.png` | `64x16` px | `16x16` px | 4 | `0: icon_weapon`, `1: icon_armor`, `2: icon_amulet`, `3: icon_ring` |
| `loot_drops` | `loot_drops.png` | `64x16` px | `16x16` px | 4 | `0: common (#e4e4e7)`, `1: magic (#38bdf8)`, `2: rare (#facc15)`, `3: legendary (#f97316)` |
| `hub_tiles` | `hub_tiles.png` | `64x16` px | `16x16` px | 4 | `0: refuge_floor`, `1: refuge_runes`, `2: refuge_wall`, `3: refuge_brazier` |
| `hub_npcs` | `hub_npcs.png` | `128x32` px | `32x32` px | 4 | `0: emissary`, `1: blacksmith`, `2: soul_altar`, `3: rift_portal` |
| `portraits` | `portraits.png` | `1024x128` px | `128x128` px | 8 | `0: hero_living`, `1: hero_wraith`, `2: weapon_master`, `3: village_blacksmith`, `4: emissary`, `5: spectral_blacksmith`, `6: infernal_warden`, `7: system` |
| `ui_icons` | `ui_icons.png` | `1024x64` px | `64x64` px | 16 | `0: attack`, `1: dash`, `2: skill_inferno`, `3: skill_empireo`, `4: skill_submundo`, `5: potion`, `6: bag`, `7: settings`, `8: audio_on`, `9: audio_off`, `10: souls`, `11: essence`, `12: slot_weapon`, `13: slot_armor`, `14: slot_amulet`, `15: slot_ring` |
| `village_tiles` | `village_tiles.png` | `64x16` px | `16x16` px | 4 | `0: grass_path`, `1: cobble_square`, `2: wood_wall`, `3: village_lantern` |
| `village_npcs` | `village_npcs.png` | `128x32` px | `32x32` px | 4 | `0: weapon_master`, `1: village_blacksmith`, `2: potion_stall`, `3: village_gate` |
| `slime` | `slime.png` | `1600x80` px | `80x80` px | 20 | `0..3: idle0..3`, `4..9: walk0..5`, `10..15: attack0..5`, `16..19: death0..3` |
| `cave_bat` | `cave_bat.png` | `1600x80` px | `80x80` px | 20 | `0..3: idle0..3`, `4..9: walk0..5`, `10..15: attack0..5`, `16..19: death0..3` |
| `wolf` | `wolf.png` | `1600x80` px | `80x80` px | 20 | `0..3: idle0..3`, `4..9: walk0..5`, `10..15: attack0..5`, `16..19: death0..3` |
| `skeleton` | `skeleton.png` | `1600x80` px | `80x80` px | 20 | `0..3: idle0..3`, `4..9: walk0..5`, `10..15: attack0..5`, `16..19: death0..3` |
| `skeleton_archer` | `skeleton_archer.png` | `1600x80` px | `80x80` px | 20 | `0..3: idle0..3`, `4..9: walk0..5`, `10..15: attack0..5`, `16..19: death0..3` |
| `wolf_alpha` | `wolf_alpha.png` | `1600x80` px | `80x80` px | 20 | `0..3: idle0..3`, `4..9: walk0..5`, `10..15: attack0..5`, `16..19: death0..3` |
| `karnak` | `karnak.png` | `1920x96` px | `96x96` px | 20 | `0..3: idle0..3`, `4..9: walk0..5`, `10..15: attack0..5`, `16..19: death0..3` |
| `skeleton_chief` | `skeleton_chief.png` | `1600x80` px | `80x80` px | 20 | `0..3: idle0..3`, `4..9: walk0..5`, `10..15: attack0..5`, `16..19: death0..3` |

### 3.1. Animações 24f do Herói (`hero_living` e `hero_wraith`)

- **Especificação:** `1920x80` px (`24` frames `80x80`), fundo transparente, contorno preto `#09090b` de `1px`, pés alinhados em `y = 76` e centro do corpo em `x = 40`.
- **Ciclos:**
  - `0..3` (`idle0..idle3`): respiração orgânica com pés firmes no chão e oscilação suave de tronco, braços, faixa/capa e túnica.
  - `4..9` (`walk0..walk5`): ciclo completo de passos com alternância explícita direita/esquerda (contato D, apoio baixo D `+2px`, passagem E `-2px`, contato E invertido, apoio baixo E `+2px`, passagem D `-2px`), dobra real de joelho/bota, contra-fase de braços e ondulação contínua da capa/túnica.
  - `10..15` (`attack0..attack5`, T-121): antecipação (peso atrás, mão da arma alta atrás da cabeça), golpe (braço cruzando por cima e à frente), impacto (extensão máxima, peso no pé da frente), follow-through baixo e duas etapas de recuperação até a guarda do idle. Durações por frame `90/55/65/55/50/45 ms` (total `360 ms`, impacto em `145 ms`), exportadas em `HeroWeaponRig.ts` (`HERO_ATTACK_FRAME_DURATIONS_MS`, `HERO_ATTACK_DURATION_MS`, `HERO_ATTACK_IMPACT_MS`) e usadas pela animação `hero_*_attack` em `CombatVfx.ts`. Nos frames `10..13` o braço da arma é desenhado na frente do torso/cabeça.
  - `16..19` (`dash0..dash3`): agachamento de impulso, arranque aerodinâmico com rastro, pico de velocidade com afterimages espectrais e frenagem/pouso.
  - `20..23` (`hit0..hit3`): impacto com recuo e flash preservando contorno/olhos ciano, recuo máximo, passo atrás recuperando equilíbrio e retomada de guarda.
- **Ancoragem de Arma (`handAnchors`):** Cada entrada `hero_living` e `hero_wraith` em `public/assets/sprites/manifest.json` expõe um array de `24` objetos `{ dx, dy, rot }` relativo ao centro `(40, 40)` do frame para sincronizar o `HeroWeaponRig`. No ataque, a posição vem da mão desenhada no frame atual (com leve avanço para a do próximo frame) e a rotação segue keyframes próprios interpolados pelo progresso do frame; `rot` nos frames `10..15` é a rotação no início de cada frame. Andando, o rig roda a mesma linha do tempo sobre a pose de walk; a volta para idle/walk é misturada em `80 ms`. Um rastro curto da lâmina (smear, desenhado em código) aparece em torno do impacto. Pranchas de simulação: `assets/mockups/preview_hero_attack_sim_R.png` e `_L.png`.
- **Sprites Base (Idempotência):** Os frames-base originais ficam preservados em `assets/sprites_src/hero_living_base.png` e `assets/sprites_src/hero_wraith_base.png`; prévias ampliadas em grade são geradas em `assets/mockups/preview_hero_*`.

### 3.2. VFX das 3 Forças e Drops (`src/view/sprites/CombatVfx.ts`)

- **Inferno (`showEmberExplosion`):** Anel e centelhas ígneas em `#f97316` / `#ef4444` / `#facc15`.
- **Empíreo (`showLightningChain`):** Raios angulares em cadeia com halo `#facc15` e núcleo `#e0fbfc`.
- **Submundo (`showBleedEffect`):** Impacto carmesim e gotículas descendentes em `#ef4444` / `#991b1b` / `#fca5a5`.
- **Drops e Coleta (`showLootDropBeam`, `showItemPickupBanner`):** Feixe vertical por raridade (`#e4e4e7`, `#38bdf8`, `#facc15`, `#f97316`) e banner flutuante com contorno `#09090b`.

### 3.3. Masmorra Básica 2.5D (M8 piloto)

Ambiente-piloto (decisão #17) em top-down 2.5D: topo da parede + face frontal de 2 tiles (`wall_face_upper` sobre `wall_face_lower`), piso Abismo de baixa luminância e luz quente das tochas (`#f59e0b` / `#fde047`). Gerado por `python scripts/art/buildDungeonBasic.py` (sheets, manifest e prancha `assets/mockups/preview_m8_dungeon_basic_sheets.png`); mockup `960x540` por `python scripts/art/buildMockupDungeonBasic.py` (`assets/mockups/mockup_m8_dungeon_basic.png`). Exibição 1:1 no mundo (`TILE_DISPLAY_SIZE = 32`), filtro nearest recomendado.

| Key | Arquivo | Dimensões Totais | Frame (`LxA`) | Qtd. Frames | Convenção de Frames (Índice: Nome) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `dungeon_basic_tiles` | `dungeon_basic_tiles.png` | `1088x32` px | `32x32` px | 34 | `0..5: floor_0, floor_1, floor_2, floor_cracked, floor_moss, floor_blood`, `6: wall_top`, `7: wall_top_s`, `8: wall_side_l`, `9: wall_side_r`, `10: wall_bottom`, `11..14: corner_in_tl/tr/bl/br`, `15..18: corner_out_tl/tr/bl/br`, `19: wall_face_upper`, `20: wall_face_lower`, `21: wall_face_upper_cracked`, `22: wall_face_lower_grate`, `23..24: door_arch_l/r`, `25..26: door_open_l/r`, `27..28: door_threshold_l/r`, `29..33: shadow_s, shadow_l, shadow_r, shadow_corner_l, shadow_corner_r` (alfa, sobrepostas ao piso) |
| `dungeon_basic_props` | `dungeon_basic_props.png` | `352x32` px | `32x32` px | 11 | `0..3: torch_0..3` (animação `torch`, 8 fps, loop), `4: chest_closed`, `5: barrel`, `6: urn`, `7: bones`, `8: rubble`, `9: chain`, `10: skulls_candle` |
| `dungeon_basic_props_tall` | `dungeon_basic_props_tall.png` | `64x64` px | `32x64` px | 2 | `0: pillar`, `1: pillar_broken` (origem sugerida `0.5, 0.95`) |

| `dungeon_basic_doors` | `dungeon_basic_doors.png` | `1376x32` px | `32x32` px | 43 | `0..3: door_arch_sealed_l/r, door_open_sealed_l/r` (arco norte selado, troca 1:1 com 23..26 do tiles), `4..5: door_n_link_l/r` (tampa sobre o arco norte quando um corredor segue para o norte), `6..9: door_s_l/r, door_s_sealed_l/r` (porta sul, abertura no `wall_bottom`), `10..13: door_w_t/b, door_w_sealed_t/b` (porta na parede oeste, 2 tiles de altura: `_t` em cima, `_b` embaixo), `14..17: door_e_t/b, door_e_sealed_t/b` (parede leste), `18..20: wall_face_upper_end_l/r/lr`, `21..23: wall_face_lower_end_l/r/lr` (face que termina numa aresta: piso a oeste `l`, a leste `r`, dos dois lados `lr`), `24..42: cap_ns, cap_ew, cap_nes, cap_esw, cap_nsw, cap_new, cap_nesw, cap_n_dse, cap_n_dsw, cap_s_dne, cap_s_dnw, cap_e_dnw, cap_e_dsw, cap_w_dne, cap_w_dse, cap_dne_dnw, cap_dse_dsw, cap_dne_dse, cap_dnw_dsw` |

Sheet separado (BRF-135, decisão #20) para manter `dungeon_basic_tiles` com 34 frames (contrato checado pelo e2e `m6-monsters`). Prancha de aprovação com amostra montada por autotile: `assets/mockups/preview_m8_dungeon_doors_corridors.png` (o mesmo script gera tudo; a função `autotile_sample` é a implementação de referência).

**Convenção de autotile (máscara de piso, grade de 32 px):**
1. **Face:** toda célula não piso com piso logo abaixo vira `wall_face_lower`; a célula acima dela (se também não for piso) vira `wall_face_upper`. Se a célula de face tiver piso a oeste/leste na mesma linha, usar `wall_face_*_end_l/r/lr` (quina convexa de sala em L/cruz e curva de corredor).
2. **Tampa (cap):** demais células de parede. R = piso ou face (porta norte conta como face). Aro em cada borda cujo vizinho ortogonal é R; "ponto" de quina em cada diagonal R cujos dois ortogonais vizinhos não são R. Nome `cap_<bordas n,e,s,w>[_d<diagonal>]`; os casos já existentes usam o nome antigo: sem nada = `wall_top`, `s` = `wall_top_s`, `e` = `wall_side_l`, `w` = `wall_side_r`, `n` = `wall_bottom`, ponto `se/sw/ne/nw` = `corner_in_tl/tr/bl/br`, `nw/ne/sw/es` = `corner_out_tl/tr/bl/br`. Esse conjunto cobre salas em L/cruz e corredores de 2 tiles que viram em qualquer direção.
3. **Portas sul/oeste/leste:** a célula de porta conta como **piso** para a regra de face e sombra do lado de lá (o corredor sob uma porta sul não gera face) e como **parede** ao escolher a tampa dos vizinhos (vizinhos típicos: `cap_n_dse/dsw` ao lado da porta sul; `cap_ew` acima e `cap_e_dnw`/`cap_e_dsw` ou `cap_w_dne`/`cap_w_dse` ao redor da porta lateral). Porta norte = arco 2x2 nas linhas da face + `door_threshold_*` no piso; com corredor seguindo para o norte, `door_n_link_l/r` substitui a tampa acima do arco (vizinhos `cap_s_dne/dnw`).
4. **Sombras:** piso com face acima → `shadow_s` (`shadow_corner_l/r` se também houver parede a oeste/leste); senão parede a oeste → `shadow_l`, a leste → `shadow_r`. Porta não projeta sombra.
5. **Selo:** as versões `*_sealed*` substituem o selo desenhado por código (mesmas cores: preenchimento `#0b0618`, anel `#c084fc`, núcleo `#e9d5ff`, brilho `#a855f7`).

- **Montagem da sala:** linha 0 = `corner_in_tl` + `wall_top_s` + `corner_in_tr`; linhas 1–2 = face (porta 2x2 com `door_arch_*`/`door_open_*`); linha 3 = piso com `door_threshold_*` sob a porta e `shadow_s`/`shadow_corner_*`; colunas laterais = `wall_side_l/r` com `shadow_l/r` no piso vizinho; última linha = `corner_in_bl` + `wall_bottom` + `corner_in_br`. Tochas e correntes ficam na linha da `wall_face_upper`.

---

## 4. Pipeline e Substituição Futura

- Os spritesheets seguem grid horizontal estrito (`width = frameWidth * frames.length`, `height = frameHeight`).
- Para regenerar os spritesheets procedurais base: `node scripts/art/generateSprites.mjs`.
- Para regenerar `hero_living.png` (`1920x80`, 24f), `hero_wraith.png` (`1920x80`, 24f), as prévias em `assets/mockups/preview_hero_*.png` e atualizar `manifest.json` a partir dos sprites base em `assets/sprites_src/` (sem dependências externas): `python scripts/art/buildHeroAndWeapons.py`.
- Para regenerar os spritesheets animados 20f de monstros/bosses (`slime.png` 50%, `cave_bat.png` 50%, `wolf_alpha.png` `1600x80`, `karnak.png` `1920x96`, `skeleton_chief.png` `1600x80`), as prévias `assets/mockups/preview_bosses_20f.png` e `assets/mockups/preview_skeleton_chief_20f.png`, e atualizar `manifest.json` (sem dependências externas): `python scripts/art/buildMonstersSheets.py`.
- Para regenerar e publicar `ui_icons.png` (`1024x64`, 16f `64x64`) e `portraits.png` (`1024x128`, 8f `128x128`) em `public/assets/sprites/`, atualizar `manifest.json` e gerar a prancha `assets/mockups/preview_m7_ui_assets.png` a partir de `assets/sprites_src/ui/`: `python scripts/art/buildUiAssets.py` (ou `--publish-only` para republicar apenas os PNGs já aprovados).
- Qualquer arquivo `.png` em `public/assets/sprites/` pode ser editado ou substituído no LibreSprite/Pixelorama mantendo a mesma chave, dimensão de frame e ordem de índices em `manifest.json`.

---

## 5. Ícone Oficial do App (`public/icons/`)

- **Arte-mestre (fonte):** `assets/icons/submundo_icon_master.png` (`1024x1024` px, PNG RGB opaco full-bleed — Guerreiro Espectral envolto em chamas espirituais azuis empunhando lâmina rúnica sobre fundo abissal).
- **Regra de distribuição:** `assets/icons/` é diretório-fonte **não distribuído em runtime** (nunca deve ser copiado para `public/`); o build (`dist/`) recebe exclusivamente os ícones derivados em `public/icons/`.
- **Comando de regeneração:** `python3 scripts/art/generateIcons.py` (utiliza Pillow `Resampling.LANCZOS` e nitidez suave abaixo de `256x256` px).

| Arquivo | Dimensões | Formato | Uso |
| :--- | :--- | :--- | :--- |
| `public/icons/icon-512.png` | `512x512` px | PNG RGB | Ícone PWA / Splash em alta resolução |
| `public/icons/icon-192.png` | `192x192` px | PNG RGB | Ícone padrão Android / Web App Manifest |
| `public/icons/apple-touch-icon.png` | `180x180` px | PNG RGB (opaco full-bleed) | Ícone de tela inicial iOS / Safari |
