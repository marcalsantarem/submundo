# BRF-178 — AG02 — T-167 (parte UI) Corrigir G3 no MenuHubScene
**Leia:** `docs/agentes/AG02_UI.md`, `docs/qa/qa-M11.md` (seção 9, G3), e `src/view/scenes/MenuHubScene.ts` (linhas ~297-365 e ~450-551). **Regra:** respostas curtas; sem `git commit`/`push`/`branch`/`checkout`/`reset`/`stash`.
**Problema (G3):** Em `MenuHubScene.ts`, `Voltar` (`~510-515`) chama `this.closeRightPanel(); this.repaintButtons();` dentro de seu `pointerdown`, e `paintButton()` (`~317-355`) chama `removeInteractive()`, `removeAllListeners()` e `makeHit()` (`setInteractive`) no mesmo evento/quadro, deixando o botão **Masmorras** sem reação a clique (PC) e toque (Mobile) após **Voltar**.
**Fazer:**
(1) Em `buildLeftPanel()` (`~306-313`), configure a área interativa (`this.makeHit(container, L.btnW + 12, Math.max(L.btnH, 44))`) e o listener (`container.on('pointerdown', () => this.onButtonPressed(item.id))`) **uma única vez** na criação do container de cada botão.
(2) Em `paintButton()` (`~317-355`), reconstrua **apenas** os filhos visuais (`view.container.removeAll(true)` + `bg`/`label`/`lock`), **sem** chamar `removeInteractive()`, `removeAllListeners()` ou `makeHit()`. Confira também se `closeRightPanel()` destruindo o botão *Voltar* dentro do `pointerdown` ou `setDepth`/hitArea causa qualquer bloqueio remanescente no `InputPlugin` do Phaser.
(3) No PowerShell, com `$env:PATH = "C:\Users\msm\AppData\Local\Programs\nodejs;$env:PATH"`, rode `npm.cmd run typecheck`, `npm.cmd test` e `npm.cmd run build`.
**Permitido:** `src/view/scenes/MenuHubScene.ts`. **Proibido:** `src/core/`, `tests/`, `docs/`, assets, Git.
**Pronto quando:** `npm.cmd run typecheck`, `npm.cmd test` e `npm.cmd run build` passam sem erro.
**Entrega:** até 5 linhas com causa confirmada, alteração feita e resultado de `typecheck`/`test`/`build`.
