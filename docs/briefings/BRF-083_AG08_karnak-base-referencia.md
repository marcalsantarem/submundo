# BRF-083 — AG08 (Arte) — T-096 Refazer Sprite Base do Demônio Karnak com Base na Referência

**Leia:** [docs/agentes/AG08_Arte.md](../agentes/AG08_Arte.md), [scripts/art/buildMonstersBase.py](../../scripts/art/buildMonstersBase.py), `assets/sprites_src/monsters/karnak_ref.jpg`. **Regra:** respostas curtas; **PROIBIDO** editar `src/`, `tests/`, `public/assets/sprites/` ou executar `git`.

**Decisão do dono:** O sprite anterior do Karnak não ficou bom; refazer com base na imagem de referência `assets/sprites_src/monsters/karnak_ref.jpg`:
- Demônio musculoso vermelho-escuro com chifres grandes curvos segmentados (+ chifrinhos internos), olhos dourados incandescentes;
- Ombreiras pretas pesadas com espinhos, arreio preto no peito, braçal com espinhos, cinto com fivela, capa/tanga preta esfarrapada, grevas pretas com espinhos e cascos;
- **Machado duplo grande de ferro escuro com runas vermelhas** empunhado em duas mãos na diagonal.

**Fazer:**
1. Inspecionar `assets/sprites_src/monsters/karnak_ref.jpg` com `read_file`.
2. Atualizar `scripts/art/buildMonstersBase.py` para gerar `assets/sprites_src/monsters/karnak_base.png` (`96×96` ou `80×80` — usar `96×96` se precisar para não cortar o machado duplo largo nem os chifres, mantendo o corpo/cabeça **um pouco maior que o Herói `68px`**, ex.: ~`76–82px` de altura total dos cascos ao topo dos chifres, pés/cascos em `y = 92` em `96×96` ou `y = 76` em `80×80`!).
   - **Dica técnica (como fizemos no Herói `hero_living_base.png`):** Você pode processar `karnak_ref.jpg` em Python stdlib (decodificando ou convertendo via ferramenta/script se necessário — note que `karnak_ref.jpg` é JPEG! Se não houver Pillow instalado no Python 3.14, verifique se há `ffmpeg`/`magick`/`powershell System.Drawing` no Windows para ler o `.jpg` e salvar um PNG intermediário ou extrair os pixels, ou se preferir desenhar/extrair via `.NET System.Drawing` em PowerShell para PNG sem perda!). Remover o fundo cinza conectado às bordas, preservar o contorno preto 1px, fazer downscale limpo (amostragem de bloco / pixel-art crisp sem borrão) para a altura alvo (~`78px`) e ajustar o contorno preto 1px final.
3. Atualizar `assets/mockups/preview_m6_resize_and_bosses.png` colocando o novo `karnak` ao lado de `hero_living`, `slime`, `cave_bat`, `wolf` e `wolf_alpha` na mesma escala visual!
4. **Inspecionar `assets/mockups/preview_m6_resize_and_bosses.png` com `read_file`** e iterar até que o Karnak esteja nítido, imponente e fiel à referência (sem halo cinza, sem contorno quebrado, machado e chifres inteiros).

**Permitido:** `scripts/art/buildMonstersBase.py`, `assets/sprites_src/monsters/karnak_base.png` (e PNG intermediário se preciso em `assets/sprites_src/monsters/`), `assets/mockups/preview_m6_resize_and_bosses.png`.
**Proibido:** `src/`, `tests/`, `public/assets/sprites/`, `docs/`, e qualquer comando `git`.

**Entrega:** até 6 linhas: (1) arquivos atualizados, (2) dimensões do `karnak_base.png` vs Herói, (3) confirmação de inspeção visual, (4) pronto para aprovação do dono.
