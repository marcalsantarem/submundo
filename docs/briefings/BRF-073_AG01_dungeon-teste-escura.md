# BRF-073 — AG01 (Gameplay) — T-092b Modo Dungeon Escura de Teste (`DungeonScene.ts`)

**Leia:** [docs/agentes/AG01_Gameplay.md](../agentes/AG01_Gameplay.md), [src/view/scenes/DungeonScene.ts](../../src/view/scenes/DungeonScene.ts). **Regra:** respostas curtas; **PROIBIDO** editar `BootScene.ts`, `HubScene.ts`, `src/core/`, `tests/` ou executar `git`.

**Decisão do dono (Decisão #10):** Ao entrar no jogo (`BootScene` passando `{ testArena: true }`), a tela deve ser **apenas uma sala toda preta (`#000000`)** com o **Herói na forma humana (`hero_living`)** dentro — sem monstros, sem cenário/tiles, sem portal, sem diálogos, sem música/banner poluindo. É o nosso palco limpo para testar os novos monstros e a nova UI aos poucos.

**Contrato (com AG07 na T-092a):**
- `DungeonScene.create(data?: { profileSnapshot?: SaveProfile; stageId?: CampaignStageId; testArena?: boolean })` e `startNewRun(data?: ...)`.

**Fazer (apenas em `src/view/scenes/DungeonScene.ts`):**
1. Adicionar campo `private isTestArena = false;` (resetado no `SHUTDOWN` e setado a partir de `Boolean(data?.testArena)` em `create`/`startNewRun`).
2. Quando `this.isTestArena === true`:
   - Fundo da câmera `#000000`;
   - **Não** criar tiles, paredes, tochas, iluminação ou drops em `buildArenaTilesAndLighting` / `loadCurrentRoom` (manter a sala **100% preta**);
   - Forçar o Herói na **forma humana (`hero_living`)** (`this.heroSpriteKey = 'hero_living'`) no centro da tela, com `HeroWeaponRig` usando a arma equipada (ou espada de ferro `0` se vazio);
   - **Não** spawnar monstros (`this.monsters = []`), **não** criar portal, **não** abrir diálogo introdutório e **não** encerrar a sala por `room_cleared` automático (`update` apenas permite mover livremente dentro dos limites da tela/arena, usar Dash/ataque/skills se quiser testar animações, atualizar `syncVisuals`, `updateHeroFootstepDust`, `weaponRig.sync` e `cameraRig.syncLayers`);
   - Manter a câmera com zoom (`SceneCameraRig`) seguindo o Herói e o joystick virtual (Mobile) + `WASD`/Setas (PC) funcionando perfeitamente;
   - Preservar 100% o comportamento normal da `DungeonScene` quando `testArena` não for `true` (para não quebrar testes ou fluxos existentes).

**Permitido:** `src/view/scenes/DungeonScene.ts`.
**Proibido:** `BootScene.ts`, `HubScene.ts`, `src/core/`, `tests/`, e qualquer comando `git`.

**Pronto quando:** `DungeonScene.ts` implementa `testArena: true` exatamente como especificado, sem erros de TypeScript (`strict: true`).

**Entrega:** até 8 linhas: (1) alterações feitas em `DungeonScene.ts`, (2) validação estática realizada e pontos de atenção.
