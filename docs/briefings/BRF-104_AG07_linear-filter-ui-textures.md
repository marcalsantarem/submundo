# BRF-104 — AG07 (Arquiteto) — T-106 Filtro `LINEAR` em `ui_icons` e `portraits` (`BootScene.ts`)

**Leia:** [docs/agentes/AG07_Arquiteto.md](../agentes/AG07_Arquiteto.md), [src/view/scenes/BootScene.ts](../../src/view/scenes/BootScene.ts). **Regra:** respostas curtas; **PROIBIDO** editar qualquer outro arquivo ou executar `git`.

**Contexto:** Com `pixelArt: true` em `src/main.ts`, o Phaser força `FilterMode.NEAREST` em todas as texturas, deixando os ícones 2D (`ui_icons`) e retratos 2D (`portraits`) serrilhados/pixelados no HUD. Precisamos aplicar `FilterMode.LINEAR` apenas nessas texturas 2D estilizadas, mantendo todas as texturas de gameplay em `NEAREST`.

**Fazer (apenas em `src/view/scenes/BootScene.ts`):**
1. No início de `create()` (logo após `this.ensureFallbackTextures()`), aplicar `Phaser.Textures.FilterMode.LINEAR` em `'ui_icons'` e `'portraits'` quando existirem em `this.textures` (ex.: `this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR)`).

**Permitido:** `src/view/scenes/BootScene.ts`.
**Proibido:** qualquer outro arquivo e comandos `git`.

**Entrega:** até 4 linhas: alteração em `BootScene.ts` e revisão estática (`strict: true`).
