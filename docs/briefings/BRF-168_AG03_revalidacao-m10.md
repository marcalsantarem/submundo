# BRF-168 — AG03 — T-156 Revalidação do M10 após as correções
**Leia:** `docs/agentes/AG03_QA.md`, `docs/metodo/Validacao.md` (**suíte 1×**, Decisão #25), as decisões #24 e **#26** em `docs/decisoes.md`, `docs/qa/qa-M10.md` (validação anterior), os specs `tests/e2e/m10-prologue.spec.ts`, `tests/e2e/m10-timing.spec.ts` e helpers, e só os blocos de debug/campos públicos de `HubScene.ts` e `DungeonScene.ts` (`getMissionState()` agora traz `monstersAlive/monstersTotal/monstersDormant`; `completeMissionNow()` mata todos exceto o Karnak). **Regra:** respostas curtas; sem commit/push/branches/tags (checkout na `dev`; não troque).
**O que mudou (commit `54c0bf4`):** missões sem ondas — monstros já posicionados, acordam por proximidade, objetivo "Elimine todos os monstros" (contador no tracker), portas não selam; 5 ervas e 4 ferramentas; itens pegos na missão ficam no inventário na vitória e na derrota do prólogo; minimapa funcionando na dungeon (salas, corredores, herói, monstros, coletáveis) e na Vila; banner de volta à Vila "Missão cumprida…" (sem "Extração… Baú"); Ato 1 abre com `act1_arrival_*`; "!" do portão abaixo da placa; retrato da Lyra (frame 8); bloco preto e texto duplicado nas Ervas corrigidos.
**Fazer:**
(1) Atualize os E2E do M10 para o novo modelo (sem ondas/portas seladas, 5 ervas/4 ferramentas, contador de monstros) e acrescente: item pego numa missão continua no Inventário da Vila após vitória **e** após derrota; minimapa desenha a planta na dungeon e na Vila (confira pelo estado/snapshot); banner de volta sem "Extração"; Ato 1 sem falas do Arauto; retrato da Lyra no diálogo.
(2) Rode a suíte **uma vez**: `npm test`, `npm run build` e todos os E2E um arquivo por vez com `--workers=1`; repita só os arquivos que falharem.
(3) Rode o `m10-timing` uma vez e registre os tempos.
(4) Capturas novas em `docs/qa/screenshots/m10_*` (minimapa na dungeon e na Vila, contador de monstros, banner de volta, Lyra, Ato 1). Não apague capturas de outros marcos.
(5) Atualize `docs/qa/qa-M10.md` com uma seção "Revalidação" (veredito, o que mudou, ressalvas resolvidas e pendentes, roteiro manual atualizado).
**Permitido:** `tests/`, `docs/qa/`. **Proibido:** `src/`, assets, configs de build, Git.
**Pronto quando:** a suíte passa (exceto a m4 conhecida) e o relatório está atualizado. Erros em `src/` só relatados.
**Entrega:** até 8 linhas.
