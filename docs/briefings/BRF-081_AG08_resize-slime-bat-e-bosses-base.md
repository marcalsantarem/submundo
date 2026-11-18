# BRF-081 — AG08 (Arte) — T-094 Ajuste de Escala (Slime e Morcego 50%) + Sprites Base dos 2 Bosses (Chefe da Matilha e Karnak)

**Leia:** [docs/agentes/AG08_Arte.md](../agentes/AG08_Arte.md), [scripts/art/buildMonstersBase.py](../../scripts/art/buildMonstersBase.py), [assets/sprites_src/hero_living_base.png](../../assets/sprites_src/hero_living_base.png). **Regra:** respostas curtas; **PROIBIDO** editar `src/`, `tests/`, `public/assets/sprites/` (não sobrescrever os spritesheets antes da aprovação do dono!) ou executar `git`.

**Decisão do dono:**
1. Ao testar ingame, `slime` e `cave_bat` estavam muito grandes em relação ao Herói. **Diminuir ambos pela metade (50% em tamanho)** — manter canvas `80×80` com pés/base alinhados em `y = 76` (Slime) ou centralizado no ar (Morcego), porém com o desenho em ~22×17 px (Slime) e ~30×20 px (Morcego), nítido e com contorno preto 1px limpo (sem virar borrão!).
2. Criar os **sprites base estáticos (`80×80`)** dos **2 primeiros bosses**, no mesmo nível de detalhamento do Herói e dos monstros aprovados:
   - **`wolf_alpha_base.png` (Chefe da Matilha):** mesmo estilo/padrão do `wolf_base.png`, porém **maior em tamanho** (~72×62 px dentro de `80×80`, ou `96×96` se precisar de mais espaço — prefira `80×80` bem preenchido ou `96×96` se o lobo normal já ocupa `58×52`, mantendo proporção claramente maior!) e com **pelagem marrom/vermelha** (tons ferrugem/carmesim escuro com detalhes de cicatriz/juba imponente).
   - **`karnak_base.png` (Karnak):** **demônio** com aparência **escura/vermelha** (pele/armadura carmesim-escura, chifres demoníacos, olhos incandescentes), **um pouco maior que o Herói** (~74–78 px de altura em `80×80` ou `96×96`, mais largo/musculoso que `hero_living_base.png` de 68 px), carregando um **machado grande nas mãos**!

**Fazer:**
1. Atualizar `scripts/art/buildMonstersBase.py` (ou criar `scripts/art/buildBossesAndResizeBase.py` + atualizar `slime_base.png` e `cave_bat_base.png` em `assets/sprites_src/monsters/`) gerando em `assets/sprites_src/monsters/`:
   - `slime_base.png` (`80×80`, metade do tamanho anterior, bem legível com contorno 1px)
   - `cave_bat_base.png` (`80×80`, metade do tamanho anterior, bem legível com contorno 1px)
   - `wolf_alpha_base.png` (Chefe da Matilha — maior que `wolf_base.png`, marrom/vermelho)
   - `karnak_base.png` (Karnak — demônio escuro/vermelho com machado, um pouco maior que `hero_living_base.png`)
2. Gerar uma prancha de comparação ampliada 3× **`assets/mockups/preview_m6_resize_and_bosses.png`** mostrando lado a lado na mesma escala:
   - `hero_living` (referência 68px)
   - `slime` (novo 50%)
   - `cave_bat` (novo 50%)
   - `wolf` (referência atual)
   - `wolf_alpha` (Chefe da Matilha)
   - `karnak` (Karnak)
3. **Inspecionar `assets/mockups/preview_m6_resize_and_bosses.png` com `read_file`** e iterar até que Slime/Morcego fiquem nítidos na metade do tamanho e os 2 Bosses fiquem imponentes e proporcionais.

**Permitido:** `scripts/art/buildMonstersBase.py`, `assets/sprites_src/monsters/`, `assets/mockups/preview_m6_resize_and_bosses.png`.
**Proibido:** `src/`, `tests/`, `public/assets/sprites/`, `docs/`, e qualquer comando `git`.

**Entrega:** até 8 linhas: (1) arquivos gerados/atualizados, (2) dimensões em px de cada sprite em relação ao Herói (68px), (3) confirmação de inspeção visual, (4) pronto para aprovação do dono.
