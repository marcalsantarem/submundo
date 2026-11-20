# BRF-141 — AG03 — T-130 E2E do mapa novo (salas + corredores com curvas e sala gigante)
**Leia:** `docs/agentes/AG03_QA.md`, decisão #20 em `docs/decisoes.md`, as linhas T-126 a T-128 de `docs/backlog.md`, `tests/e2e/m6-monsters.spec.ts`, `tests/e2e/m8-dungeon-basic.spec.ts`, `tests/e2e/m8-ground-pickup.spec.ts`, `tests/e2e/helpers/testDungeon.ts` e, em `src/view/scenes/DungeonScene.ts`, só o bloco `window.__SUBMUNDO_DEBUG__` e os campos públicos da testArena. **Regra:** respostas curtas; sem commit/push/branches.
**O que mudou (já implementado):**
- A testArena usa `generateDungeonMap(seed, { mode })` (`src/core/dungeon/DungeonMap.ts`), com `?map=rooms` (padrão) ou `?map=giant` e `?seed=N`.
- Campos públicos: `testArenaMapMode`, `testArenaSeed`, `testArenaRoomIndex` (zona ativa), `testArenaWave`, `testArenaFinished`.
- Debug: `getDungeonMap()`, `getActiveZoneIndex()`, `getSealedDoorIds()`, `getGroundDrops()`, `pickUpDropAt(i)` e `spawnTestDrop`. `getTestRooms()` e `getTestRoomWorldOrigins()` agora devolvem `[]` (deprecated).
- Zonas/ondas: 1 `slime`+`wolf`, 2 `skeleton`+`skeleton_archer`, 3 `skeleton_chief`. No modo rooms, as portas de saída nascem seladas, as de entrada selam ao entrar e as saídas abrem ao limpar. O modo giant não tem portas.
**Fazer:**
(1) Atualize os três specs e o helper para o mapa novo. Remova os usos de `getTestRooms` e `getTestRoomWorldOrigins` e conserte as caminhadas.
(2) Modo rooms com `?seed=101` e `?seed=606`: confira que o herói empurrado contra uma porta selada não passa e que, após limpar a zona (debug), caminha pelo teclado até a zona seguinte. Um helper que siga um caminho por BFS na grade de `cells` com teclas reais é o ideal; se não ficar estável, mova `hero.position` passo a passo só por células caminháveis. Confira a sequência das zonas 0→1→2 e das ondas 1→2→3, e por fim "Teste finalizado". Confira também no `getDungeonMap()` que existe ao menos uma porta lateral (e/w) e ao menos um corredor com curva nessas seeds.
(3) Modo giant com `?map=giant&seed=707`: as zonas ativam ao entrar no trigger e o fim é "Teste finalizado".
(4) Coleta: o mesmo teste de antes no mapa novo (parar sobre o item não coleta, clique de longe caminha e coleta, tecla cancela).
(5) Capturas PC `960×540` em `docs/qa/screenshots/m8_map_*`: corredor com curva, porta lateral, sala gigante e tela final.
(6) Rode os E2E alterados 3× seguidas e depois a suíte E2E inteira, um arquivo por vez (a m4 tem um erro de ambiente conhecido). Relate o que quebrar por causa desta mudança, sem corrigir `src/`.
**Permitido:** `tests/`, `docs/qa/screenshots/` (só arquivos `m8_*` novos ou alterados; **não apague** capturas versionadas de outros marcos). **Proibido:** `src/`, assets, configs de build, Git.
**Pronto quando:** os E2E m6, m8 e de coleta passam 3× seguidas.
**Entrega:** até 10 linhas: testes alterados/criados, resultados, quebras em outros E2E com o motivo, capturas e o que não foi verificado.
