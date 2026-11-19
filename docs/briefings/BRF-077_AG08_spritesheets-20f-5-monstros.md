# BRF-077 — AG08 (Arte) — T-069a Spritesheets Animados 20f dos 5 Monstros (`idle`, `walk`, `attack`, `death`)

**Leia:** [docs/agentes/AG08_Arte.md](../agentes/AG08_Arte.md), [scripts/art/buildMonstersBase.py](../../scripts/art/buildMonstersBase.py), [public/assets/sprites/manifest.json](../../public/assets/sprites/manifest.json), [docs/guia_visual.md](../guia_visual.md). **Regra:** respostas curtas; **PROIBIDO** editar `src/`, `tests/`, `src/data/` ou executar `git`.

**Decisão do dono:** Os 5 sprites base de `T-068` foram aprovados! Agora gerar os spritesheets animados finais de todos os 5 monstros (`slime`, `cave_bat`, `wolf`, `skeleton`, `skeleton_archer`), mantendo o mesmo padrão de fluidez, articulação real (sem deslizar!) e contorno preto nítido do Herói.

**Contrato (compartilhado com AG01 na T-069b):**
- Gerar 5 arquivos PNG em `public/assets/sprites/` com dimensões **`1600×80`** (**20 frames `80×80`**, fundo transparente, contorno preto 1px limpo, pés/base alinhados em `y = 76` quando terrestre):
  - `public/assets/sprites/slime.png`
  - `public/assets/sprites/cave_bat.png`
  - `public/assets/sprites/wolf.png`
  - `public/assets/sprites/skeleton.png`
  - `public/assets/sprites/skeleton_archer.png`
- **Índices de frames idênticos nos 5:**
  - `0..3`: `idle0..idle3` (4f — respiração / flutuação / pulsação gelatinosa)
  - `4..9`: `walk0..walk5` (6f — **animação real, sem deslizar**:
    - `slime`: compressão, impulso/salto em arco, pouso gelatinoso e rebote;
    - `cave_bat`: ciclo completo de batida de asas cima → meio → baixo → retorno;
    - `wolf`: ciclo real de trote/galope com alternância clara das patas dianteiras e traseiras e cauda;
    - `skeleton`: ciclo real de passos (pernas alternadas, balanço de espada e escudo);
    - `skeleton_archer`: ciclo real de passos (pernas alternadas, capuz/aljava/arco acompanhando o passo).)
  - `10..15`: `attack0..attack5` (6f — antecipação, golpe/investida/disparo no pico `12..13`, follow-through e recuperação:
    - `slime`: encolhe para trás e projeta o corpo para frente em golpe gelatinoso;
    - `cave_bat`: fecha asas para trás e mergulha em rasante com presas à frente;
    - `wolf`: agacha e dá bote longo com mandíbula aberta;
    - `skeleton`: ergue a espada e desfere corte amplo para frente protegendo com o escudo;
    - `skeleton_archer`: puxa a corda do arco com a flecha tensionada, solta o disparo e recua o braço.)
  - `16..19`: `death0..death3` (4f — morrendo até o chão:
    - `slime`: achatamento progressivo até virar poça verde no chão;
    - `cave_bat`: desequilíbrio, queda e asas fechadas no chão;
    - `wolf`: tombando de lado e repousando imóvel no chão;
    - `skeleton` e `skeleton_archer`: desabando e espalhando ossos/arco/escudo no chão.)
- Atualizar `public/assets/sprites/manifest.json` com as 5 entradas (`width: 1600`, `height: 80`, `frameWidth: 80`, `frameHeight: 80`, `frames` com os 20 nomes acima) e atualizar `docs/guia_visual.md`.

**Fazer:**
1. Criar `scripts/art/buildMonstersSheets.py` (Python stdlib pura, aproveitando/importando a lógica de desenho anatômico de `buildMonstersBase.py` ou desenhando poses articuladas limpas por partes para cada frame, sem depender de Pillow/NumPy).
2. Gerar os 5 PNGs `1600×80` em `public/assets/sprites/`, atualizar `manifest.json` e `docs/guia_visual.md`.
3. Gerar prévia ampliada em grade legível `assets/mockups/preview_monsters_5_20f.png` (mostrando todos os 5 monstros e seus 20 frames) e **inspecionar com `read_file`**, refinando se houver qualquer artefato, membro desconectado ou falta de fluidez.

**Permitido:** `scripts/art/buildMonstersSheets.py`, `public/assets/sprites/slime.png`, `public/assets/sprites/cave_bat.png`, `public/assets/sprites/wolf.png`, `public/assets/sprites/skeleton.png`, `public/assets/sprites/skeleton_archer.png`, `public/assets/sprites/manifest.json`, `docs/guia_visual.md`, `assets/mockups/preview_monsters_5_20f.png`.
**Proibido:** `src/`, `tests/`, `src/data/`, `public/assets/sprites/hero_*.png`, e qualquer comando `git`.

**Pronto quando:** 5 spritesheets `1600×80` válidos, `manifest.json` atualizado e `preview_monsters_5_20f.png` inspecionado visualmente sem defeitos.

**Entrega:** até 10 linhas: (1) arquivos gerados/atualizados, (2) confirmação das dimensões `1600×80` / 20 frames e inspeção visual, (3) o que não foi testado (execução no Phaser na T-070).
