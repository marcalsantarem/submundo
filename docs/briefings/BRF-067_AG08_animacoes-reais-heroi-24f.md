# BRF-067 — AG08 (Arte) — T-087 Refação Completa das Animações 24f do Herói (Passos e Combate Fluidos)

**Leia:** [docs/agentes/AG08_Arte.md](../agentes/AG08_Arte.md), [scripts/art/buildHeroAndWeapons.py](../../scripts/art/buildHeroAndWeapons.py), [public/assets/sprites/manifest.json](../../public/assets/sprites/manifest.json), [docs/guia_visual.md](../guia_visual.md). **Regra:** respostas curtas; **PROIBIDO** executar `git commit`, `push`, `branch`, `checkout`, `reset` ou `stash`.

**Decisão do dono (Decisão #8):** Refazer integralmente todas as animações dos spritesheets `80×80` do Herói (`hero_living.png` e `hero_wraith.png`) porque hoje os 16 frames são estáticos (apenas inclinação/deslocamento de 1–2 px, fazendo o personagem deslizar sem passos). Expandir para **24 frames (`1920×80`)** com movimentação real e fluida de pernas/passos, braços, tronco, capa/túnica e poses de combate, dash e hit.

**Contrato (para a Onda 2 — AG01 e AG02):**
- `public/assets/sprites/hero_living.png` e `public/assets/sprites/hero_wraith.png`: **`1920×80`**, **24 frames `80×80`**, fundo transparente, contorno preto limpo, pés alinhados em `y = 76` (centro `x = 40`):
  - `0..3`: `idle0..idle3` (4 frames — respiração orgânica; pés firmes no chão, torso/cabeça/ombros/braços e capa/túnica oscilam suavemente)
  - `4..9`: `walk0..walk5` (6 frames — ciclo completo de corrida/passos com alternância clara de perna direita/esquerda, dobra de joelho, elevação de bota, bounce vertical do tronco, balanço de braços em contra-fase e ondulação contínua da capa/túnica)
  - `10..15`: `attack0..attack5` (6 frames — antecipação recuada com braço alto, início do corte com lunge, pico de extensão com braço estendido e tronco girado, follow-through, recuperação 1 e recuperação 2)
  - `16..19`: `dash0..dash3` (4 frames — agachamento de impulso, arranque aerodinâmico inclinado com perna estendida + rastro, pico de velocidade com afterimage espectral, desaceleração/pouso)
  - `20..23`: `hit0..hit3` (4 frames — impacto com recuo de tronco/cabeça + flash, recuo máximo, passo atrás recuperando equilíbrio, retomada de guarda)
- Registrar em `public/assets/sprites/manifest.json`, dentro de `sprites.hero_living` e `sprites.hero_wraith`:
  - `width: 1920`, `height: 80`, `frameWidth: 80`, `frameHeight: 80`, `frames` com os 24 nomes acima;
  - `handAnchors`: array de 24 objetos `{ "dx": number, "dy": number, "rot": number }` indicando o deslocamento da mão da arma em relação ao centro `(40, 40)` do frame `80×80` e o ângulo base sugerido (em radianos) da arma em cada frame, para o `HeroWeaponRig.ts` na Onda 2.

**Fazer:**
1. **Preservar os sprites base limpos (idempotência):** antes de sobrescrever `public/assets/sprites/hero_living.png` e `hero_wraith.png`, extrair o frame `0` (`0..80, 0..80`) de cada um e salvar em `assets/sprites_src/hero_living_base.png` e `assets/sprites_src/hero_wraith_base.png` (se ainda não existirem). O script `scripts/art/buildHeroAndWeapons.py` deve ler desses arquivos base (e preservar `weapons.png` sem quebrar, caso `weapons_concept.jpg` não exista em `assets/sprites_src/`).
2. **Articulação anatômica real em Pixel Art (`scripts/art/buildHeroAndWeapons.py`):**
   - Segmentar com precisão cada personagem (`hero_living` e `hero_wraith`) em partes anatômicas reais a partir da imagem base (usando coordenadas/máscaras analisadas dos pixels reais do sprite base):
     - **Perna traseira** (coxa + joelho + canela/bota) e **perna dianteira** (coxa + joelho + canela/bota), separadas abaixo da túnica/quadril;
     - **Capa** (no `hero_wraith`) e barra da túnica/cabelo (no `hero_living`);
     - **Torso + cabeça**;
     - **Braço traseiro** e **braço dianteiro** (mão que segura a arma).
   - Recompor cada um dos 24 frames com **poses anatômicas verdadeiras** (rotação/translação por junta de quadril, joelho, ombro e cotovelo + preenchimento limpo de juntas/calça/túnica + contorno preto nítido de 1px sem pixels soltos nem buracos abertos!).
   - Garantir especialmente nos 6 frames de `walk` (`4..9`):
     - `walk0` (contato D): perna dianteira bem à frente, perna traseira bem atrás com pé erguido;
     - `walk1` (apoio baixo D): pé dianteiro sob o corpo, perna traseira recolhendo dobrada, torso baixo (`+2px`);
     - `walk2` (passagem E): perna traseira dobrada passando alto à frente, perna dianteira empurrando atrás, torso alto (`-2px`);
     - `walk3` (contato E): **inversão clara** — perna traseira bem à frente, perna dianteira bem atrás com pé erguido;
     - `walk4` (apoio baixo E): pé esquerdo sob o corpo, perna direita recolhendo dobrada, torso baixo (`+2px`);
     - `walk5` (passagem D): perna direita dobrada passando alto à frente, perna esquerda empurrando atrás, torso alto (`-2px`).
   - Garantir que `attack` (`10..15`), `dash` (`16..19`) e `hit` (`20..23`) tenham poses igualmente expressivas, nítidas e fluidas, com `handAnchors` coerentes com a posição real da mão em cada frame.
3. **Métricas objetivas e inspeção visual obrigatória:**
   - O script deve imprimir a taxa de pixels alterados na faixa das pernas (`y = 50..78`) entre os frames de `walk` (ex.: `walk0` vs `walk3` e média consecutiva — deve haver movimento amplo e visível, não um simples shift de 1–2px).
   - Gerar prévias ampliadas 3× em grade legível (ex.: 6 colunas × 4 linhas com rótulos dos frames) em `assets/mockups/preview_hero_living_24f.png` e `assets/mockups/preview_hero_wraith_24f.png` (além de tiras ampliadas 4× só do `walk` se ajudar), **abrir com `read_file` para inspecionar visualmente** e iterar o script caso haja artefatos, pernas desconectadas, contorno quebrado ou pouco movimento!
4. **Atualizar documentação:** atualizar `public/assets/sprites/manifest.json` (24 frames + `handAnchors`) e a seção do Herói em `docs/guia_visual.md`.

**Permitido:** `assets/sprites_src/`, `assets/mockups/preview_hero_*.png`, `scripts/art/buildHeroAndWeapons.py`, `public/assets/sprites/hero_living.png`, `public/assets/sprites/hero_wraith.png`, `public/assets/sprites/manifest.json`, `docs/guia_visual.md`.
**Proibido:** `src/`, `tests/`, `package.json`, `public/assets/sprites/weapons.png` (não sobrescrever se não tiver source), e qualquer comando `git`.

**Pronto quando:**
- `scripts/art/buildHeroAndWeapons.py` roda sem erros e gera `hero_living.png` e `hero_wraith.png` (`1920×80`, 24 frames `80×80`) de forma reproduzível;
- Prévias ampliadas (`preview_hero_living_24f.png` e `preview_hero_wraith_24f.png`) foram inspecionadas visualmente mostrando passos claros, alternância evidente de pernas, balanço de braços/capa e poses fluidas de `attack`, `dash` e `hit` sem buracos/artefatos;
- `manifest.json` (com os 24 frames + `handAnchors`) e `docs/guia_visual.md` atualizados.

**Entrega:** até 12 linhas: (1) arquivos gerados/atualizados, (2) dimensões/frames e métricas de variação das pernas no `walk`, (3) confirmação de inspeção visual das prévias, (4) suposições/ajustes relevantes, (5) o que não foi testado (ex.: execução no Phaser, que fica na Onda 2).
