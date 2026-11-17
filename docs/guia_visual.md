# Guia Visual — SUBMUNDO (Pixel Art Dark Fantasy)

Este documento define a direção de arte, paleta de cores, regras de contraste e especificações técnicas dos spritesheets e tilesets do marco inicial (`M1 v0.1.0`).

---

## 1. Paleta de Cores (Dark Fantasy)

A paleta prioriza cenários abissais de baixa saturação para garantir que o herói, projéteis, chamas espirituais e telegrafias de ataque tenham leitura imediata tanto no PC (`800x600`) quanto no Mobile (`9:16`).

| Categoria | Papel Visual | Hex Primário | Hex Secundário / Sombra | Hex Brilho / Destaque |
| :--- | :--- | :--- | :--- | :--- |
| **Abismo (Cenário)** | Pisos, paredes e sombras profundas | `#14141b` | `#09090b` | `#272730` |
| **Espectro (Herói / Alma)** | Chamas espirituais, lâmina, Dash, Orbe e Portal | `#38bdf8` | `#0284c7` / `#1e1b4b` | `#e0f2fe` |
| **Submundo (Sangue / Limo)** | `abyssal_slime`, sangramento e dano vital | `#ef4444` | `#991b1b` / `#450a0a` | `#fca5a5` |
| **Inferno (Brasa / Boss)** | `infernal_warden`, olhos de ameaça e impacto | `#dc2626` | `#7f1d1d` | `#f97316` / `#facc15` |
| **Ossos & Ferro** | `bone_sentinel`, armaduras e lâminas físicas | `#e4e4e7` | `#71717a` / `#3f3f46` | `#fafafa` |

---

## 2. Regras de Contraste e Leitura

1. **Cenário Silencioso (Baixa Luminância):** Os tiles de piso (`floor_dark`, `floor_cracked`) mantêm luminância entre 6% e 12%, sem ruído de alto contraste que confunda colisão.
2. **Paredes Delimitadas:** O tile `wall_abyssal` possui topo iluminado (`#3f3f4e`) e juntas escuras (`#09090b`) para leitura imediata de bloqueio físico.
3. **Silhueta e Ponto Focal:** Todos os personagens e monstros possuem contorno escuro (`#09090b`) e pontos focais saturados (olhos/lâmina `#38bdf8` no Herói; núcleos/olhos `#f97316` e `#ef4444` nos inimigos).
4. **Telegrafia Visual:** Os frames de ação (`attack`, `slam`, `dash`) expandem a silhueta com arcos de energia de alto brilho (`#e0f2fe` ou `#f97316`).

---

## 3. Especificação de Spritesheets e Tilesets (`public/assets/sprites/`)

Todos os arquivos são gerados via código por `scripts/art/generateSprites.mjs` em formato PNG RGBA (`8-bit/color`, transparência alfa) e catalogados em `public/assets/sprites/manifest.json`.

| Key | Arquivo | Dimensões Totais | Frame (`LxA`) | Qtd. Frames | Convenção de Frames (Índice: Nome) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `wraith_warrior` | `wraith_warrior.png` | `128x32` px | `32x32` px | 4 | `0: idle0`, `1: idle1`, `2: attack`, `3: dash` |
| `abyssal_slime` | `abyssal_slime.png` | `64x32` px | `32x32` px | 2 | `0: idle0`, `1: idle1` |
| `bone_sentinel` | `bone_sentinel.png` | `64x32` px | `32x32` px | 2 | `0: idle0`, `1: attack` |
| `infernal_warden` | `infernal_warden.png` | `128x64` px | `64x64` px | 2 | `0: idle`, `1: slam` |
| `dungeon_tiles` | `dungeon_tiles.png` | `64x16` px | `16x16` px | 4 | `0: floor_dark`, `1: floor_cracked`, `2: wall_abyssal`, `3: portal_soul` |
| `soul_orb` | `soul_orb.png` | `16x16` px | `16x16` px | 1 | `0: idle` |

---

## 4. Pipeline e Substituição Futura

- Os spritesheets seguem grid horizontal estrito (`width = frameWidth * frames.length`, `height = frameHeight`).
- Para regenerar todos os assets via código: `node scripts/art/generateSprites.mjs`.
- Qualquer arquivo `.png` em `public/assets/sprites/` pode ser editado ou substituído no LibreSprite/Pixelorama mantendo a mesma chave, dimensão de frame e ordem de índices em `manifest.json`.
