# BRF-139 — AG07 — T-128 (apoio) Carregar `dungeon_basic_doors` no BootScene
**Leia:** `docs/agentes/AG07_Arquiteto.md` e a entrada `dungeon_basic_doors` de `public/assets/sprites/manifest.json`. **Regra:** respostas curtas; sem commit/push/branches.
**Fazer:** acrescentar `dungeon_basic_doors` (32×32, 43 frames) em `SPRITESHEET_SPECS` do `src/view/scenes/BootScene.ts`, com `FilterMode.NEAREST` (fora de `LINEAR_TEXTURE_KEYS`). O AG01 consome em paralelo.
**Permitido:** `src/view/scenes/BootScene.ts`. **Proibido:** o resto, Git. **Pronto quando:** `npm test` e `npm run build` passam. **Entrega:** até 3 linhas.
