# BRF-153 — AG01 — T-139 (parte) Voltar da dungeon para a Vila no portão
**Leia:** `docs/agentes/AG01_Gameplay.md`, a decisão #23 em `docs/decisoes.md`, em `src/view/scenes/DungeonScene.ts` os pontos onde a run termina (vitória/extração e morte) e volta para a `HubScene` (`this.scene.start('HubScene', { fromRun: ... })`), e `src/core/progression/VillageHub.ts` (`getVillageSpawn`). **Regra:** respostas curtas; sem commit/push/branches (checkout no branch `M9`; não troque).
**Decisão do dono (#23):** ao terminar ou morrer na dungeon, o herói volta à Vila e aparece no portão.
**Contrato (o AG02 monta a Vila em paralelo):** a `DungeonScene` passa `villageOrigin: 'dungeon_victory' | 'dungeon_defeat'` junto de `fromRun` ao iniciar a `HubScene`.
**Fazer:**
(1) Em todos os caminhos de fim de run da campanha que voltam ao hub, inclua `villageOrigin` conforme o resultado.
(2) Confira que a testArena (que termina em "Teste finalizado") não muda.
(3) Nada mais muda na `DungeonScene`: a campanha sem teleporte é o M10.
**Permitido:** `src/view/scenes/DungeonScene.ts`. **Proibido:** `HubScene.ts`, `BootScene.ts`, `src/view/ui/`, `src/core/`, assets, `tests/`, Git.
**Pronto quando:** `npm test` e `npm run build` passam.
**Entrega:** até 4 linhas: pontos alterados e o que não foi verificado.
