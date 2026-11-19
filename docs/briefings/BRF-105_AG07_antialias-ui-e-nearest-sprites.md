# BRF-105 — AG07 (Arquiteto) — T-107 Suavização Real da UI 2D (`index.html`, `src/main.ts`, `BootScene.ts`)

**Leia:** [docs/agentes/AG07_Arquiteto.md](../agentes/AG07_Arquiteto.md), [index.html](../../index.html), [src/main.ts](../../src/main.ts), [src/view/scenes/BootScene.ts](../../src/view/scenes/BootScene.ts). **Regra:** respostas curtas; **PROIBIDO** editar `src/core/`, `src/view/ui/`, `DungeonScene.ts`, `tests/` ou executar `git`.

**Contexto:** `image-rendering: pixelated` em `index.html` e `pixelArt: true` (`antialias: false`) em `src/main.ts` estavam deixando a UI 2D, círculos e ícones serrilhados mesmo após `FilterMode.LINEAR` em `ui_icons`/`portraits`.

**Fazer:**
1. **`index.html`:** remover a linha `image-rendering: pixelated;` de `#game-container canvas` (mantendo `display: block;`).
2. **`src/main.ts`:** em `createGameConfig()`, trocar `pixelArt: true` por `pixelArt: false` e `render: { antialias: true, pixelArt: false, roundPixels: true }` (mantendo `roundPixels: true` no topo ou dentro de `render` conforme `Phaser.Types.Core.GameConfig`).
3. **`src/view/scenes/BootScene.ts`:** em `applyLinearFilterToUiTextures()` (pode renomear para `applyTextureFilters()`), percorrer `SPRITESHEET_SPECS`:
   - Se `key` estiver em `LINEAR_TEXTURE_KEYS` (`['ui_icons', 'portraits']`), aplicar `Phaser.Textures.FilterMode.LINEAR`;
   - Para todas as demais texturas de gameplay (pixel art), aplicar explicitamente `Phaser.Textures.FilterMode.NEAREST`.

**Permitido:** `index.html`, `src/main.ts`, `src/view/scenes/BootScene.ts`.
**Proibido:** qualquer outro arquivo e comandos `git`.

**Entrega:** até 5 linhas: alterações nos 3 arquivos e revisão estática (`strict: true`).
