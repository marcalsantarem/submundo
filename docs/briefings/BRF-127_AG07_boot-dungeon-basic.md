# BRF-127 — AG07 — T-119 Pré-carregar a Masmorra Básica no BootScene
**Leia:** `docs/agentes/AG07_Arquiteto.md`, decisão #17 em `docs/decisoes.md`, as entradas `dungeon_basic_tiles`, `dungeon_basic_props` e `dungeon_basic_props_tall` de `public/assets/sprites/manifest.json` e `src/view/scenes/BootScene.ts`. **Regra:** respostas curtas; sem commit/push/branches.
**Contrato (AG01 trabalha em paralelo na `DungeonScene.ts` e consome isto):**
- Texturas `dungeon_basic_tiles` (32×32, 34 frames), `dungeon_basic_props` (32×32, 11 frames) e `dungeon_basic_props_tall` (32×64, 2 frames), carregadas como spritesheet com `FilterMode.NEAREST`. Não entram em `LINEAR_TEXTURE_KEYS`.
- Animação global `dungeon_basic_torch`: frames 0 a 3 de `dungeon_basic_props`, 8 fps, `repeat: -1`. Crie-a junto das outras animações globais do boot.
**Fazer:** (1) Acrescente os 3 sheets em `SPRITESHEET_SPECS` (ou no mecanismo equivalente) e a animação. (2) Se houver teste de integridade da lista de sheets ou animações do boot em `tests/core/`, atualize as contagens. (3) Não mude o fluxo do boot: o jogo continua iniciando a `DungeonScene` com `{ testArena: true }`.
**Permitido:** `src/view/scenes/BootScene.ts`, testes de `tests/core/` ligados ao boot. **Proibido:** `DungeonScene.ts`, `src/view/ui/`, assets, `tests/e2e/`, Git.
**Pronto quando:** `npm test` e `npm run build` passam.
**Entrega:** até 6 linhas: o que mudou, contagens de testes atualizadas e o que não foi verificado.
