# BRF-095 — AG08 (Arte) — T-104 Corrigir orientação base e animação de ataque de Karnak (`karnak.png`)

**Leia:** [docs/agentes/AG08_Arte.md](../agentes/AG08_Arte.md), [scripts/art/buildMonstersSheets.py](../../scripts/art/buildMonstersSheets.py), [public/assets/sprites/karnak.png](../../public/assets/sprites/karnak.png). **Regra:** respostas curtas; **PROIBIDO** editar `src/`, `tests/` ou executar `git`.

**Contexto:**
- Todos os monstros e bosses (`wolf_alpha`, `skeleton_chief`, etc.) têm orientação base virada e atacando para a **direita** no spritesheet, pois a `DungeonScene.ts` aplica `setFlipX(this.hero.position.x < monster.position.x)`.
- `karnak.png` (`1920×96`, 20 frames `96×96`) foi gerado virado e atacando para a **esquerda**, fazendo Karnak sempre atacar para o lado oposto do Herói.
- Além disso, nos frames de ataque (`10..15`) de `build_karnak_frames()` em `scripts/art/buildMonstersSheets.py`, há dois artefatos de recorte:
  1. Quando `hide_front_axe=True` (frames 10 e 11) ou quando o corpo/pernas deslocam nos frames 11, 12 e 13, a máscara `is_axe_head = (x <= 34 and y >= 36)` e `if x < 35 and y < 68: continue` deixa um pedaço da lâmina original visível nos frames 12–13 atrás do rastro vermelho e cria uma fenda vertical de 1–2px entre `leg_l` e `leg_r` em `x = 52` quando `leg_l_dx != leg_r_dx`.

**Fazer:**
1. Em `scripts/art/buildMonstersSheets.py` (`_render_karnak_posed` e `build_karnak_frames`):
   - Corrigir a fenda vertical entre as pernas (`x = 52`) quando `leg_l_dx != leg_r_dx` (preenchendo qualquer gap horizontal de 1–2px entre `50 <= x <= 56`, `62 <= y <= 84`, ou mantendo as pernas coesas sem rasgo vertical no frame 11 e 17).
   - Nos frames `12` e `13` (golpe descendente com rastro carmesim), rotacionar/posicionar o machado duplo acompanhando o golpe para frente/baixo de forma limpa (sem deixar metade da lâmina estática cortada atrás do arco carmesim).
   - **Orientação para a direita:** Espelhar horizontalmente (`flip_h`) todos os 20 frames gerados por `build_karnak_frames()` (ou espelhar `base_cv` e os offsets) para que o spritesheet final `public/assets/sprites/karnak.png` (`1920×96`) tenha Karnak olhando, caminhando e desferindo o golpe com rastro carmesim para a **direita** (igual a `wolf_alpha.png` e `skeleton_chief.png`).
2. Executar `python3 scripts/art/buildMonstersSheets.py` para regenerar `public/assets/sprites/karnak.png` e `assets/mockups/preview_bosses_20f.png`.
3. Inspecionar `public/assets/sprites/karnak.png` com `view_file` para confirmar que Karnak ataca para a direita e que não há rasgos nas pernas nem lâmina cortada nos frames `10..15`.

**Permitido:** `scripts/art/buildMonstersSheets.py`, `public/assets/sprites/karnak.png`, `assets/mockups/preview_bosses_20f.png`.
**Proibido:** `src/`, `tests/`, e qualquer comando `git`.

**Entrega:** até 6 linhas: ajustes realizados em `buildMonstersSheets.py`, regeneração de `karnak.png` (`1920×96`) e confirmação visual.
