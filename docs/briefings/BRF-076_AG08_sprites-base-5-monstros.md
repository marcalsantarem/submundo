# BRF-076 — AG08 (Arte) — T-068 Sprites Base Detalhados dos 5 Monstros (Para Aprovação do Dono)

**Leia:** [docs/agentes/AG08_Arte.md](../agentes/AG08_Arte.md), [assets/mockups/mockup_pixel_art.jpg](../../assets/mockups/mockup_pixel_art.jpg), [assets/sprites_src/hero_living_base.png](../../assets/sprites_src/hero_living_base.png). **Regra:** respostas curtas; **PROIBIDO** editar `src/`, `tests/`, `src/data/` ou executar `git`.

**Decisão do dono (Decisão #11):** Criar **apenas o sprite base estático (pose de frente/3-4 padrão, sem animações ainda!)** de cada um dos 5 monstros, com o **mesmo nível de detalhamento, sombreamento, pixel art limpa e contorno preto nítido do nosso Herói (`hero_living_base.png`)** e inspirado no `mockup_pixel_art.jpg`. O dono quer **aprovar todos os 5 sprites primeiro** antes de passarmos para as animações (`T-069`).

**Os 5 Monstros:**
1. **`slime`** (*Slime*): gosma verde gelatinosa translúcida/brilhante (estilo o slime verde do `mockup_pixel_art.jpg`), com olhos expressivos, reflexos especulares e contorno escuro limpo. Tamanho proporcional menor/baixo que o Herói (ex.: ~44×36 px dentro de canvas `80×80`, pés/base em `y = 76`).
2. **`cave_bat`** (*Morcego*): morcego roxo/azul escuro com asas membranosas detalhadas abertas, orelhas pontudas e olhos vermelhos/âmbar brilhantes, flutuando (ex.: ~52×44 px dentro de `80×80`).
3. **`wolf`** (*Lobo*): lobo cinzento de dungeons iniciais do mundo real, pelagem cinza com sombreamento, focinho/orelhas/cauda definidos, postura quadrúpede pronta para investir (ex.: ~62×48 px dentro de `80×80`, patas em `y = 76`).
4. **`skeleton`** (*Esqueleto*): humanóide de corpo esquelético detalhado (crânio, costelas, ossos dos braços/pernas, trapos/elmo leve), empunhando **espada e escudo** (altura/proporção próxima à do Herói `hero_living_base.png`, ~64–68 px em `80×80`, pés em `y = 76`).
5. **`skeleton_archer`** (*Esqueleto Arqueiro*): humanóide de corpo esquelético distinto do anterior (ex.: capuz/aljava, postura de arqueiro), empunhando um **arco de madeira** (altura/proporção próxima à do Herói, ~64–68 px em `80×80`, pés em `y = 76`).

**Fazer:**
1. Inspecionar `assets/mockups/mockup_pixel_art.jpg` e `assets/sprites_src/hero_living_base.png` com `read_file` para alinhar perfeitamente a densidade de pixels, paleta, contorno preto 1px e direção de luz/perspectiva.
2. Criar script reproduzível `scripts/art/buildMonstersBase.py` (Python stdlib pura — sem depender de Pillow/NumPy!) que gere os 5 sprites `80×80` com fundo transparente em `assets/sprites_src/monsters/`:
   - `slime_base.png`
   - `cave_bat_base.png`
   - `wolf_base.png`
   - `skeleton_base.png`
   - `skeleton_archer_base.png`
3. Gerar uma prancha de comparação ampliada 3× ou 4× em `assets/mockups/preview_monsters_5_base.png` mostrando o **Herói (`hero_living_base.png`) ao lado dos 5 monstros** sobre fundo xadrez neutro e rótulos claros, para o dono comparar escala, estilo e detalhamento.
4. **Inspecionar visualmente `assets/mockups/preview_monsters_5_base.png` com `read_file`** e iterar o desenho até cada um dos 5 monstros estar realmente bonito, expressivo, legível e no mesmo padrão do Herói!

**Permitido:** `scripts/art/buildMonstersBase.py`, `assets/sprites_src/monsters/`, `assets/mockups/preview_monsters_5_base.png`.
**Proibido:** `src/`, `tests/`, `public/assets/sprites/` (ainda não substituir os spritesheets do jogo antes da aprovação do dono), `docs/`, e qualquer comando `git`.

**Pronto quando:** os 5 PNGs `80×80` e `assets/mockups/preview_monsters_5_base.png` foram gerados e inspecionados visualmente com alta qualidade.

**Entrega:** até 10 linhas: (1) arquivos gerados, (2) descrição visual/escala de cada um dos 5 monstros em relação ao Herói, (3) confirmação de inspeção visual com `read_file`, (4) pronto para aprovação do dono antes da `T-069`.
