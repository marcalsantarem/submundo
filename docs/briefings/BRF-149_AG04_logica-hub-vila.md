# BRF-149 — AG04 — T-136 Lógica do hub da Vila (core puro)
**Leia:** `docs/agentes/AG04_Sistemas_Meta.md`, a decisão #23 em `docs/decisoes.md`, `src/core/index.ts` (tipos `SaveProfile`, `CampaignProgress`, `CampaignStageDef`), `src/core/progression/CampaignManager.ts` (`getAvailableStages`, `applyStageOutcomeToCampaign`) e `src/data/campaign.json`. **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono (#23):** o Mestre de Armas aponta a próxima missão; o portão da vila só libera depois de falar com ele e abre uma **lista** das dungeons do prólogo (Gruta, Mina, Selo; travadas com cadeado), que inicia as fases já existentes. Ao terminar ou morrer na dungeon, o herói volta à vila e aparece no portão. Sem moeda. A ordem e as falas definitivas das missões ficam para o M10.
**Fazer** (core puro, sem Phaser), num módulo novo `src/core/progression/VillageHub.ts` exportado em `src/core/index.ts`:
(1) Estado "falou com o Mestre sobre a missão atual" no save (campo opcional e retrocompatível), com `talkToMaster(profile)` e `isGateUnlocked(profile)`. Ao concluir uma fase, o portão volta a pedir conversa com o Mestre para a próxima.
(2) `getPrologueDungeonList(profile)`: as fases do prólogo em ordem, com `status` `'available' | 'locked' | 'completed'`, `title` e `stageId`, a partir do progresso da campanha existente.
(3) `getVillageSpawn(profile, origin)`: `'start'` (primeira vez) ou `'gate'` (voltando da dungeon, por vitória ou morte).
(4) `getVillageObjective(profile)`: texto curto do tracker ("Falar com o Mestre", "Saia pelo portão") e qual NPC recebe o "!".
(5) Testes Vitest em `tests/core/village-hub.test.ts` cobrindo save antigo sem o campo, sequência Gruta→Mina→Selo, morte e vitória.
**Permitido:** `src/core/progression/`, `src/core/index.ts` (só exports e o campo opcional), `tests/core/village-hub.test.ts`. **Proibido:** `src/view/`, `src/data/` (o AG06 edita `dialogues.json` em paralelo), assets, Git.
**Pronto quando:** `npm test` e `npm run build` passam.
**Entrega:** até 6 linhas: API criada, campo de save, testes e o que não foi verificado.
