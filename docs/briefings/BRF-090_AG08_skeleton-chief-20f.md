# BRF-090 — AG08 (Arte) — T-101 Spritesheet 20f do Esqueleto Chefe (`skeleton_chief.png`)

**Leia:** [docs/agentes/AG08_Arte.md](../agentes/AG08_Arte.md), [scripts/art/buildMonstersSheets.py](../../scripts/art/buildMonstersSheets.py), `assets/sprites_src/monsters/skeleton_chief_turnaround.png`, [public/assets/sprites/manifest.json](../../public/assets/sprites/manifest.json). **Regra:** respostas curtas; **PROIBIDO** editar `src/`, `tests/`, `src/data/` ou executar `git`.

**Contexto:** O dono enviou `assets/sprites_src/monsters/skeleton_chief_turnaround.png` (PNG transparente com 8 ângulos direcionais do **Esqueleto Chefe**: elmo de ferro, costelas, saiote vermelho, escudo redondo e espada dentada).

**Fazer:**
1. Inspecionar `assets/sprites_src/monsters/skeleton_chief_turnaround.png` com `read_file` e identificar a pose 3/4 olhando para a direita (ex.: 2ª ou 8ª pose da tira — escolher a pose onde espada e escudo ficam melhor visíveis e voltados para a direita!).
2. Extrair essa pose limpa (ou usar em `scripts/art/buildMonstersSheets.py`), escalar com `NEAREST` para caber em `80×80` com porte de chefe (~`70–74 px` de altura, pés alinhados em `y = 76`, centro `x = 40`), salvar `assets/sprites_src/monsters/skeleton_chief_base.png` e gerar **`public/assets/sprites/skeleton_chief.png`** (`1600×80`, 20 frames `80×80`: `idle` 0..3, `walk` 4..9, `attack` 10..15, `death` 16..19):
   - `0..3` (`idle`): respiração/guarda com espada e escudo;
   - `4..9` (`walk`): ciclo claro de passos com oscilação vertical, inclinação e movimento de escudo/espada;
   - `10..15` (`attack`): antecipação erguendo a espada, corte amplo para frente com rastro de lâmina, follow-through e retorno;
   - `16..19` (`death`): tombando e desabando no chão.
3. Atualizar `public/assets/sprites/manifest.json` (`skeleton_chief`, `1600×80`, `80×80`, 20 frames) e `docs/guia_visual.md`.
4. Gerar `assets/mockups/preview_skeleton_chief_20f.png` e **inspecionar com `read_file`** até ficar fluido, nítido e sem cortes/artefatos.

**Permitido:** `scripts/art/buildMonstersSheets.py`, `assets/sprites_src/monsters/skeleton_chief_base.png`, `public/assets/sprites/skeleton_chief.png`, `public/assets/sprites/manifest.json`, `docs/guia_visual.md`, `assets/mockups/preview_skeleton_chief_20f.png`.
**Proibido:** `src/`, `tests/`, `src/data/`, e qualquer comando `git`.

**Entrega:** até 6 linhas: arquivos gerados, dimensões e confirmação de inspeção visual.
