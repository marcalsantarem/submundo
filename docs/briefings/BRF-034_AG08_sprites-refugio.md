# BRF-034 — AG08 — T-032 Spritesheets Pixel Art do Refúgio no Submundo

**Leia:** `docs/agentes/AG08_Arte.md`, `docs/guia_visual.md`, `scripts/art/generateSprites.mjs`. **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono:** Autorização explícita da `T-032` (M3 `v0.3.0`).
**Contrato:**
- Gerar via `scripts/art/generateSprites.mjs` em `public/assets/sprites/`, preservando os 8 sprites existentes do M1/M2:
  - `hub_tiles.png` (`64x16` px, 4 frames `16x16`: `0 = refuge_floor`, `1 = refuge_runes`, `2 = refuge_wall`, `3 = refuge_brazier`) com estética de vila em ruínas iluminada por chamas espirituais azuis (`#38bdf8` / `#0284c7` / `#14141b`).
  - `hub_npcs.png` (`128x32` px, 4 frames `32x32`: `0 = emissary`, `1 = blacksmith`, `2 = soul_altar`, `3 = rift_portal`).
- Atualizar `public/assets/sprites/manifest.json` incluindo `hub_tiles` e `hub_npcs`.
- Documentar os novos sheets em `docs/guia_visual.md` (seção 3).
**Fazer:** Atualizar `scripts/art/generateSprites.mjs`, rodar `node scripts/art/generateSprites.mjs` e atualizar `docs/guia_visual.md`.
**Permitido:** `scripts/art/generateSprites.mjs`, `public/assets/sprites/`, `docs/guia_visual.md`.
**Proibido:** `public/icons/`, `assets/`, `src/`, `tests/` e comandos git.
**Pronto quando:** `hub_tiles.png`, `hub_npcs.png` e `manifest.json` válidos e `npm run typecheck` verde.
**Entrega:** até 5 linhas: arquivos atualizados/gerados e resultado do script/`typecheck`.
