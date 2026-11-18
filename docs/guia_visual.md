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
5. **Retratos 2D Estilizados (`portraits.png`):** Renderizados com supersampling 3x (anti-aliasing suave), iluminação volumétrica com *rim light*, gradientes suaves e bordas nítidas em frames `64x64`.

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
| `portraits` | `portraits.png` | `512x64` px | `64x64` px | 8 | `0: hero_living`, `1: hero_wraith`, `2: weapon_master`, `3: village_blacksmith`, `4: emissary`, `5: spectral_blacksmith`, `6: infernal_warden`, `7: system` |
| `village_tiles` | `village_tiles.png` | `64x16` px | `16x16` px | 4 | `0: grass_path`, `1: cobble_square`, `2: wood_wall`, `3: village_lantern` |
| `village_npcs` | `village_npcs.png` | `128x32` px | `32x32` px | 4 | `0: weapon_master`, `1: village_blacksmith`, `2: potion_stall`, `3: village_gate` |
| `cave_bat` | `cave_bat.png` | `64x32` px | `32x32` px | 2 | `0: flap0`, `1: flap1` |

### 3.1. Animações 24f do Herói (`hero_living` e `hero_wraith`)

- **Especificação:** `1920x80` px (`24` frames `80x80`), fundo transparente, contorno preto `#09090b` de `1px`, pés alinhados em `y = 76` e centro do corpo em `x = 40`.
- **Ciclos:**
  - `0..3` (`idle0..idle3`): respiração orgânica com pés firmes no chão e oscilação suave de tronco, braços, faixa/capa e túnica.
  - `4..9` (`walk0..walk5`): ciclo completo de passos com alternância explícita direita/esquerda (contato D, apoio baixo D `+2px`, passagem E `-2px`, contato E invertido, apoio baixo E `+2px`, passagem D `-2px`), dobra real de joelho/bota, contra-fase de braços e ondulação contínua da capa/túnica.
  - `10..15` (`attack0..attack5`): antecipação recuada com braço alto, início do corte com lunge, pico de extensão frontal, follow-through baixo e duas etapas de recuperação.
  - `16..19` (`dash0..dash3`): agachamento de impulso, arranque aerodinâmico com rastro, pico de velocidade com afterimages espectrais e frenagem/pouso.
  - `20..23` (`hit0..hit3`): impacto com recuo e flash preservando contorno/olhos ciano, recuo máximo, passo atrás recuperando equilíbrio e retomada de guarda.
- **Ancoragem de Arma (`handAnchors`):** Cada entrada `hero_living` e `hero_wraith` em `public/assets/sprites/manifest.json` expõe um array de `24` objetos `{ dx, dy, rot }` relativo ao centro `(40, 40)` do frame para sincronizar o `HeroWeaponRig`.
- **Sprites Base (Idempotência):** Os frames-base originais ficam preservados em `assets/sprites_src/hero_living_base.png` e `assets/sprites_src/hero_wraith_base.png`; prévias ampliadas em grade são geradas em `assets/mockups/preview_hero_*`.

### 3.2. VFX das 3 Forças e Drops (`src/view/sprites/CombatVfx.ts`)

- **Inferno (`showEmberExplosion`):** Anel e centelhas ígneas em `#f97316` / `#ef4444` / `#facc15`.
- **Empíreo (`showLightningChain`):** Raios angulares em cadeia com halo `#facc15` e núcleo `#e0fbfc`.
- **Submundo (`showBleedEffect`):** Impacto carmesim e gotículas descendentes em `#ef4444` / `#991b1b` / `#fca5a5`.
- **Drops e Coleta (`showLootDropBeam`, `showItemPickupBanner`):** Feixe vertical por raridade (`#e4e4e7`, `#38bdf8`, `#facc15`, `#f97316`) e banner flutuante com contorno `#09090b`.

---

## 4. Pipeline e Substituição Futura

- Os spritesheets seguem grid horizontal estrito (`width = frameWidth * frames.length`, `height = frameHeight`).
- Para regenerar os spritesheets procedurais base: `node scripts/art/generateSprites.mjs`.
- Para regenerar `hero_living.png` (`1920x80`, 24f), `hero_wraith.png` (`1920x80`, 24f), as prévias em `assets/mockups/preview_hero_*.png` e atualizar `manifest.json` a partir dos sprites base em `assets/sprites_src/` (sem dependências externas): `python scripts/art/buildHeroAndWeapons.py`.
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
