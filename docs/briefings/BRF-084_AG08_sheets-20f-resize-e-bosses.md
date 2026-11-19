# BRF-084 — AG08 (Arte) — T-097 Spritesheets 20f: Slime/Morcego 50% + Bosses (`wolf_alpha` e `karnak`)

**Leia:** [docs/agentes/AG08_Arte.md](../agentes/AG08_Arte.md), [scripts/art/buildMonstersSheets.py](../../scripts/art/buildMonstersSheets.py), [scripts/art/buildMonstersBase.py](../../scripts/art/buildMonstersBase.py), [public/assets/sprites/manifest.json](../../public/assets/sprites/manifest.json). **Regra:** respostas curtas; **PROIBIDO** editar `src/`, `tests/`, `src/data/` ou executar `git`.

**Decisão do dono:** Sprites aprovados! Agora gerar os spritesheets animados 20f (`idle` 0..3, `walk` 4..9, `attack` 10..15, `death` 16..19):
1. **Regenerar `public/assets/sprites/slime.png` e `cave_bat.png`** (`1600×80`, 20 frames `80×80`) usando a nova escala **50%** aprovada em `slime_base.png` e `cave_bat_base.png`.
2. **Gerar `public/assets/sprites/wolf_alpha.png`** (`1600×80`, 20 frames `80×80`): mesmo ciclo articulado fluido do `wolf`, porém maior e com pelagem marrom/vermelha, juba e cicatriz de `wolf_alpha_base.png`.
3. **Gerar `public/assets/sprites/karnak.png`** (`1920×96`, 20 frames **`96×96`**) a partir de `assets/sprites_src/monsters/karnak_base.png` (cascos alinhados em `y = 92`):
   - `0..3` (`idle`): respiração imponente, leve pulsar de chamas/runas do machado e capa esfarrapada;
   - `4..9` (`walk`): passos pesados alternando pernas/cascos, leve bounce vertical e balanço do machado duplo e capa;
   - `10..15` (`attack`): antecipação erguendo o machado duplo para trás, golpe amplo descendente com rastro vermelho carmesim no ar, follow-through e retorno à guarda;
   - `16..19` (`death`): recuo, joelhos cedendo, tombando no chão com o machado caído.
4. Atualizar `public/assets/sprites/manifest.json` (`wolf_alpha` `1600×80` `80×80`, `karnak` `1920×96` `96×96`) e `docs/guia_visual.md`.
5. Gerar prévia ampliada `assets/mockups/preview_bosses_20f.png` (mostrando `slime` 50%, `cave_bat` 50%, `wolf_alpha` e `karnak` com todos os 20 frames) e **inspecionar com `read_file`** até ficar fluido, limpo e sem artefatos.

**Permitido:** `scripts/art/buildMonstersSheets.py`, `public/assets/sprites/{slime,cave_bat,wolf_alpha,karnak}.png`, `public/assets/sprites/manifest.json`, `docs/guia_visual.md`, `assets/mockups/preview_bosses_20f.png`.
**Proibido:** `src/`, `tests/`, `src/data/`, `public/assets/sprites/hero_*.png`, e qualquer comando `git`.

**Entrega:** até 8 linhas: (1) arquivos gerados/atualizados, (2) dimensões de cada PNG e confirmação de inspeção visual.
