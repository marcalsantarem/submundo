# BRF-038 — AG01 — T-036 Integração HubScene ⇄ DungeonScene e Essência de General

**Leia:** `docs/agentes/AG01_Gameplay.md`, `src/core/index.ts`, `src/core/progression/ProfileManager.ts`, `src/view/scenes/DungeonScene.ts`, `src/view/ui/DungeonHud.ts`, `src/data/dialogues.json`. **Regra:** respostas curtas; sem commit/push/branches; preservar compatibilidade com todos os testes E2E do M1 e M2 (`tests/e2e/`).
**Decisão do dono:** Autorização explícita da `T-036` (M3 `v0.3.0`).
**Contrato (`src/view/scenes/DungeonScene.ts`):**
- Ao iniciar `create(data?: { profileSnapshot?: SaveProfile })`:
  - Ler perfil permanente via `data?.profileSnapshot ?? loadOrCreateProfile()` (mantendo compatibilidade caso `DungeonScene` seja aberta diretamente nos testes!).
  - Em `startNewRun()`, construir o herói com `buildHeroFromProfile(profile, centerPos)` (já aplicando bônus do Altar e equipamentos equipados salvos do Hub!), inicializar `this.inventory` com os itens pré-equipados de `profile.equipped` (`startingHubItemIds = new Set(...)`) para que o jogador comece a masmorra usando seu gear do Refúgio.
  - Garantir compatibilidade dos testes M1/M2: se `profile.equipped` estiver vazio (perfil novo padrão), `hero.stats` segue exatamente `DEFAULT_HERO_STATS` (`120 HP`, `3 poções`).
- **Essência de General:** ao derrotar o Boss (`infernal_warden` na Sala 5), conceder `+1 Essência de General` (`this.essencesCollected += 1`) com banner/alerta (`dialoguesData.entries.boss_essence_drop.shortText`).
- **Encerramento e Retorno ao Hub (`victory` / `defeat`):**
  - Ao resolver o fim da run (`resolveRunEndLoot`), diferenciar itens trazidos do Hub (`startingHubItemIds`, preservados no perfil) vs. novos drops da run (mantidos na vitória, perdidos na derrota — exatamente como define o GDD!).
  - Persistir imediatamente o `RunEndReport` via `applyRunOutcomeToProfile(profile, report)` + `persistProfile(profile)` assim que a run termina (garantindo salvamento mesmo antes de clicar no botão).
  - No callback do botão final (ou `onRestartRun` / `returnToHub()`), se `'HubScene' in this.scene.manager.keys`, oferecer/executar transição `this.scene.start('HubScene', { fromRun: report })` (mantendo `window.__SUBMUNDO_DEBUG__.restartRun` funcionando normalmente para testes E2E).
**Fazer:** Atualizar `src/view/scenes/DungeonScene.ts`.
**Permitido:** `src/view/scenes/DungeonScene.ts`.
**Proibido:** `src/core/`, `src/view/ui/`, `src/view/scenes/HubScene.ts`, `src/view/scenes/BootScene.ts`, `tests/` e comandos git.
**Pronto quando:** `npm run typecheck`, `npm test` (todos os 8 arquivos verdes!) e `npm run build` passarem 100% verdes.
**Entrega:** até 6 linhas: integrações adicionadas na `DungeonScene.ts` e resultado de `typecheck`/`test`/`build`.
