# BRF-054 — AG08 — T-063 Spritesheets Pixel Art 48x48 do Herói (`hero_living` e `hero_wraith`)

**Leia:** `docs/agentes/AG08_Arte.md`, `assets/mockups/mockup_pixel_art.jpg`, `docs/guia_visual.md`, `scripts/art/generateSprites.mjs`, `public/assets/sprites/manifest.json`. **Regra:** NÃO remover ou alterar `wraith_warrior.png` (ainda em uso até T-064/T-066); zero git commands.
**Decisão do dono:** Decisão #7 e autorização explícita da `T-063` (M5 `v0.5.0` — Personagem).
**Fazer:**
1. Estender `scripts/art/generateSprites.mjs` com um gerador dedicado de alta qualidade Pixel Art 16/32-bit **48x48 por frame** (`768x48` total, **16 frames horizontais**), inspirado diretamente nas proporções, postura 3/4, armadura metálica, capa esvoaçante e espada brilhante de `assets/mockups/mockup_pixel_art.jpg`:
   - **`public/assets/sprites/hero_living.png` (`768x48`, `48x48` × 16 frames):**
     - Jovem Guerreiro da Vila (Prólogo): armadura de aço prateado com sombreamento de 4 tons + contorno escuro nítido (`#12131a`), ombreiras arredondadas, **capa vermelha** dinâmica, elmo de cavaleiro (ou viseira com crista vermelha/detalhe quente) e **espada longa de aço brilhante** com gume claro.
   - **`public/assets/sprites/hero_wraith.png` (`768x48`, `48x48` × 16 frames):**
     - Guerreiro Espectral (Ato 1): armadura escura de aço abissal/obsidiana com **rim lighting azul-celeste**, capuz/elmo sombrio com **olhos ciano brilhantes**, **capa espectral escura** com pontas etéreas azuladas, runa celestial no peitoral e **lâmina rúnica azul-celeste** brilhante.
   - **Ordem obrigatória dos 16 frames (`0..15`) em ambos:**
     - `0..3`: `idle0..idle3` (respiração, balanço sutil da capa, brilho da lâmina)
     - `4..7`: `walk0..walk3` (passada alternada nítida das botas/pernas, inclinação de corrida e capa ondulando)
     - `8..11`: `attack0..attack3` (recuo da espada → golpe largo com arco de corte luminoso à frente → extensão → retorno)
     - `12..13`: `dash0..dash1` (postura baixa aerodinâmica com rastro de velocidade e capa esticada para trás)
     - `14..15`: `hit0..hit1` (recuo de dano com destaque de impacto)
2. Rodar `node scripts/art/generateSprites.mjs` e atualizar `public/assets/sprites/manifest.json` (adicionando `hero_living` e `hero_wraith` sem remover os sprites existentes) e `docs/guia_visual.md`.
3. Inspecionar visualmente ambos os spritesheets gerados para garantir proporção heroica, leitura clara em fundo escuro e ausência de cortes nas bordas de cada célula `48x48`.
**Permitido:** `scripts/art/`, `public/assets/sprites/`, `docs/guia_visual.md`.
**Proibido:** tocar `src/`, `tests/`, `package.json` e executar comandos git.
**Pronto quando:** `hero_living.png` (`768x48`) e `hero_wraith.png` (`768x48`) gerados, `manifest.json` atualizado e inspeção visual aprovada.
**Entrega:** até 5 linhas resumindo dimensões, frames, paleta e detalhes visuais dos dois spritesheets.
