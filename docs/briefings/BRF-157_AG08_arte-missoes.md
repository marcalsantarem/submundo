# BRF-157 — AG08 — T-144 Arte das missões (marcadores e objetos de objetivo)
**Leia:** `docs/agentes/AG08_Arte.md`, a decisão #24 em `docs/decisoes.md`, `docs/guia_visual.md`, `scripts/art/buildVillageHub.py` e `scripts/art/biomes/` (padrão de geração), e abra `assets/mockups/mockup_m9_village.png` (o "!" atual sobre o Mestre), `assets/mockups/mockup_m8_herb_field.png` (ou o mockup aprovado das Ervas), `assets/mockups/mockup_m8_village_mine.png` e `assets/mockups/mockup_m8_mine_depths.png`. **Regra:** respostas curtas; sem commit/push/branches (checkout no branch `M10`; não troque).
**Decisão do dono (#24):** missões com marcadores sobre NPCs e o portão: "!" amarelo (missão disponível), "?" cinza (em andamento) e "?" amarelo (pronta para entregar). Missão da Lyra: colher ervas na Plantação de Ervas. Missão do Gorran: recuperar ferramentas dele na Mina Iluminada; no fim dessa missão o herói vê "algo estranho" no fundo da mina (prenúncio do Karnak).
**Fazer:** gerador `scripts/art/buildMissionArt.py` com folhas em `public/assets/sprites/`:
(1) `quest_markers`: "!" amarelo, "?" cinza, "?" amarelo, em pixel art legível sobre a cabeça dos NPCs (≈16×24, contorno escuro, brilho), com 2–4 frames de pulso cada.
(2) `mission_herb`: erva medicinal colhível com brilho suave (4 frames de brilho) e versão colhida (toco), no estilo do bioma `herb_field`.
(3) `mission_tools`: caixa/trouxa de ferramentas do Gorran (martelo, tenaz) com brilho de objetivo (4 frames) e versão vazia, no estilo `village_mine`.
(4) `mission_strange`: o "algo estranho" no fundo da Mina Iluminada: uma rachadura no chão/parede com brilho vermelho pulsante e fumaça (4–6 frames), sinistro mas discreto.
(5) Ícone pequeno de objetivo para o HUD/minimapa (erva e ferramenta, ≈16×16).
(6) Fragmento `scripts/art/out/mission_art.manifest.json` (frames, animações, origens) e prancha `assets/mockups/preview_m10_mission_art.png` com tudo rotulado, incluindo os marcadores sobre os NPCs da vila e os coletáveis sobre o chão dos biomas.
**Permitido:** `scripts/art/`, `public/assets/sprites/quest_markers.png` e `mission_*`, `assets/mockups/preview_m10_*`. **Proibido:** `src/`, o `manifest.json` principal, `tests/`, outras folhas, Git.
**Pronto quando:** as folhas e a prancha existem, as dimensões batem com o fragmento e você conferiu na prancha a legibilidade dos marcadores em escala 1:1.
**Entrega:** até 6 linhas: folhas, animações e o que não foi verificado. Copie a prancha para `C:\Users\marca\AppData\Local\Temp\claude\6c0b19bfccb97544\a5a78be9-f64a-40a6-a789-0967cf940a2a\scratchpad\t144_preview.png`.
