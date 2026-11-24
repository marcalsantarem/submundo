# BRF-148 — AG08 — T-134 NPCs da Vila no padrão do herói
**Leia:** `docs/agentes/AG08_Arte.md`, a decisão #23 em `docs/decisoes.md`, `docs/guia_visual.md`, `scripts/art/buildHeroAndWeapons.py` (como o herói é desenhado: frames 80×80, paleta, contorno, sombra) e abra `public/assets/sprites/hero_living.png` e `assets/mockups/ref_m9_village_hub.jpg` (referência de pose e figurino). **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono (#23):** 3 NPCs refeitos **no padrão do herói** (mesma escala, paleta, contorno, sombra e qualidade), substituindo os antigos `village_npcs` de 32×32:
- **Mestre de Armas:** veterano de armadura leve de couro/cota, capa, espada na cintura; postura firme.
- **Lyra:** curandeira/vendedora de poções, vestido simples e avental, bolsa de ervas, frasco na mão.
- **Gorran:** ferreiro forte, avental de couro, braços à mostra, martelo.
**Fazer:**
(1) Gerador `scripts/art/buildVillageNpcs.py` com uma folha por NPC em `public/assets/sprites/`: `village_npc_master`, `village_npc_lyra`, `village_npc_gorran`, frames 80×80 com origem nos pés como o herói. Animações: `idle` (4–6 frames, respiração sutil) nos três; Gorran também `hammer` (6–8 frames batendo na bigorna, com o quadro de impacto marcado, para casar com a faísca da forja). De frente/3/4, como no mockup.
(2) Fragmento `scripts/art/out/village_npcs.manifest.json` no formato do `manifest.json` (frames, animações, origem).
(3) Prancha `assets/mockups/preview_m9_village_npcs.png` com os 3 ao lado do herói em escala 1:1 e ampliada, com as animações em tira.
**Permitido:** `scripts/art/buildVillageNpcs.py`, `scripts/art/out/village_npcs.manifest.json`, `public/assets/sprites/village_npc_*`, `assets/mockups/preview_m9_village_npcs.png`. **Proibido:** `src/`, o `manifest.json` principal, `tests/`, `hero_*`, folhas dos biomas, `village_hub_*`/`buildVillageHub.py` (outro AG08 em paralelo), Git.
**Pronto quando:** as 3 folhas e a prancha existem e você conferiu, ao lado do herói, que escala e estilo batem.
**Entrega:** até 6 linhas: folhas, animações, como conferiu o padrão do herói e o que não foi verificado. Copie a prancha para `C:\Users\marca\AppData\Local\Temp\claude\6c0b19bfccb97544\a5a78be9-f64a-40a6-a789-0967cf940a2a\scratchpad\t134_preview.png`.
