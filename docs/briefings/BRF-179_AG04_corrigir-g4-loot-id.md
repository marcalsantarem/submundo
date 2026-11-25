# BRF-179 — AG04 — T-167 (parte core) Corrigir G4 no LootGenerator
**Leia:** `docs/agentes/AG04_Sistemas_Meta.md`, `docs/qa/qa-M11.md` (seção 9, G4), `src/core/loot/LootGenerator.ts` (linhas ~225-259) e `tests/core/loot.test.ts` (linhas ~1-95). **Regra:** respostas curtas; sem `git commit`/`push`/`branch`/`checkout`/`reset`/`stash`.
**Problema (G4):** `LootGenerator.ts:242-244` incrementa `nextItemSeq` a partir de `0` em memória, gerando `${prefix}_${nextItemSeq}` (`item_1`, `test_1`...) que colide entre reloads da página com itens já salvos no Baú; assim `storeRunItems` descarta o drop por `instanceId` duplicado e `MenuHubScene.countOverflow` omite o aviso de Baú cheio.
**Fazer:**
(1) Em `src/core/loot/LootGenerator.ts`, gere um `instanceId` único entre sessões/reloads mantendo o prefixo `${prefix}_` (ex.: `${prefix}_${sessionSalt}_${nextItemSeq}` usando `crypto.randomUUID()` se disponível, com fallback puro JS `Date.now().toString(36)` + `Math.random().toString(36)`), garantindo que nunca colida com IDs legados simples (`item_1`, `test_1`) nem entre reloads e mantendo `src/core/loot/` 100% TS puro (zero Phaser).
(2) Em `tests/core/loot.test.ts`, adicione teste unitário comprovando que `generateItemDrop` mantém o prefixo `${prefix}_`, gera IDs distintos em chamadas seguidas e não gera o formato legado simples `${prefix}_1`.
(3) No PowerShell, com `$env:PATH = "C:\Users\msm\AppData\Local\Programs\nodejs;$env:PATH"`, rode `npm.cmd run typecheck`, `npm.cmd test` e `npm.cmd run build`.
**Permitido:** `src/core/loot/LootGenerator.ts`, `tests/core/loot.test.ts`. **Proibido:** `src/view/`, `tests/e2e/`, `docs/`, assets, Git.
**Pronto quando:** `npm.cmd run typecheck`, `npm.cmd test` (com o novo teste) e `npm.cmd run build` passam.
**Entrega:** até 5 linhas com alteração feita, contagem de testes em `loot.test.ts` e resultado de `typecheck`/`test`/`build`.
