# BRF-062 — AG08 (Arte): Spritesheets Finais 80×80 do Herói (Sem Arma) + Weapons 48×48 (T-084)

## Objetivo
Gerar a versão sem arma do Guerreiro Aprendiz da Vila (`hero_villager_unarmed`), remover o fundo escuro das 3 artes aprovadas (`hero_villager_unarmed`, `hero_wraith_simple`, `weapons_concept`) preservando contornos pretos, e gerar os spritesheets finais do jogo:
- `public/assets/sprites/hero_living.png` (`1280×80`, 16 frames `80×80`)
- `public/assets/sprites/hero_wraith.png` (`1280×80`, 16 frames `80×80`)
- `public/assets/sprites/weapons.png` (`192×48`, 4 frames `48×48`)

## Arquivos sob sua posse
- `scripts/art/buildHeroAndWeapons.py` (novo — script reproduzível)
- `public/assets/sprites/hero_living.png`
- `public/assets/sprites/hero_wraith.png`
- `public/assets/sprites/weapons.png`
- `public/assets/sprites/manifest.json`
- `docs/guia_visual.md`

## Requisitos Técnicos
1. **Gerar `hero_villager_unarmed`:**
   - Usar `generate_image` com `ImagePaths`:
     - `/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p/5a751fb7-4d45-4899-b516-4228e4828d52/hero_villager_warrior.jpg`
     - `/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p/5a751fb7-4d45-4899-b516-4228e4828d52/hero_wraith_simple.jpg`
   - Prompt: O mesmo jovem guerreiro aprendiz da vila de `hero_villager_warrior.jpg` (cabelo castanho, faixa, túnica azul-ardósia, colete e ombreira de couro, braçadeiras, botas), **porém com as MÃOS VAZIAS (SEM NENHUMA ESPADA OU ARMA)**, na mesma pose de empunhadura de `hero_wraith_simple.jpg`, sobre fundo sólido escuro uniforme (`#11131f`).
   - Inspecionar com `view_file` para confirmar que está sem espada/arma e fiel ao personagem.
2. **Remoção de fundo inteligente (Flood-Fill a partir das bordas):**
   - Em `scripts/art/buildHeroAndWeapons.py` (usando `PIL` / `numpy`), remover apenas o fundo conectado às bordas da imagem (tolerância de cor próxima ao fundo `#11131f`, ex.: distância euclidiana RGB < 28 a partir do pixel `(0,0)`), **preservando intacto o contorno preto (`#000000`..`#181820`) do personagem e das armas**! Suavizar eventuais halos na borda externa.
3. **Spritesheets `hero_living.png` e `hero_wraith.png` (`1280×80`, 16 frames `80×80`):**
   - Redimensionar cada personagem recortado (com proporção preservada) para caber confortavelmente em `80×80` (aprox. `68px` de altura, pés alinhados em `y = 76`, centralizado em `x = 40`).
   - Gerar os 16 frames (`0..15`) com variações de pose limpas e nítidas (`NEAREST`):
     - `0..3` (`idle`): respiração sutil (leve compressão/deslocamento vertical de `0, -1, -1, 0` px);
     - `4..7` (`walk`): ciclo de corrida/passo (inclinação leve para frente + oscilação vertical `-2, 0, -2, 0` px e leve avanço horizontal);
     - `8..11` (`attack`): antecipação para trás (`-2px`), golpe/avanço (`+5px` e leve inclinação para frente), follow-through (`+3px`), retorno (`+1px`);
     - `12..13` (`dash`): inclinação rápida de avanço (`+4px`) + leve transparência/fantasma ciano (no wraith) ou rastro;
     - `14..15` (`hit`): recuo (`-3px`) + flash branco/avermelhado no frame `14`.
4. **Spritesheet `weapons.png` (`192×48`, 4 frames `48×48`):**
   - Extrair os 4 quadrantes de `/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p/5a751fb7-4d45-4899-b516-4228e4828d52/weapons_concept.jpg` com flood-fill de fundo transparente:
     - Frame `0`: Espada de Ferro
     - Frame `1`: Espada Rúnica Ciano
     - Frame `2`: Machado Flamejante (Inferno)
     - Frame `3`: Adaga/Lâmina Carmesim (Submundo)
   - Centralizar cada arma em `48×48` apontando para cima-direita (`45°`) com o cabo próximo ao centro-inferior esquerdo para encaixe natural na mão.
5. **Inspecionar visualmente** uma prévia upscaled (3×) dos 3 spritesheets gerados antes de concluir, e atualizar `public/assets/sprites/manifest.json` e `docs/guia_visual.md`.

## Restrições
- Não tocar em `src/`, `tests/`, `package.json` ou `git`.
