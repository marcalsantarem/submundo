# BRF-028 — AG03 — T-022 Validação do Marco 2 (v0.2.0)

**Leia:** `docs/agentes/AG03_QA.md`, `docs/metodo/Validacao.md`, `docs/qa/qa-M1.md`, `tests/e2e/m1-dungeon.spec.ts`, `src/view/scenes/DungeonScene.ts`. **Regra:** respostas curtas; sem commit/push/branches; QA reporta, não altera código de produção.
**Decisão do dono:** Decisão #4 (Vitest + Playwright) e autorização explícita da `T-022` (M2 `v0.2.0`).
**Fazer:**
1. Criar `tests/e2e/m2-loot.spec.ts` validando no navegador real (PC `800x600` e Mobile `360x640`):
   - Versão `SUBMUNDO v0.2.0`, presença de `manifest.webmanifest`, ícones PWA (`/icons/icon-192.png`, `apple-touch-icon.png`) e ausência de erros de console/página.
   - Fluxo de loot na `DungeonScene`: `spawnTestDrop('legendary')`, coleta automática ao mover ou equipar via `equipItem`, recálculo de atributos/forças em `getHero()`, pausa/abertura do `InventoryModal` via botão `"Bolsa"` / tecla `I`, resolução de loot na vitória (`resolveRunEndLoot`) e perda total na derrota.
   - Salvar capturas do M2 em `docs/qa/screenshots/m2-pc-800x600.png` e `docs/qa/screenshots/m2-mobile-360x640.png`.
2. Rodar `npm run typecheck`, `npm test` **3 vezes seguidas** (atestando estabilidade sem flakiness) e `npm run build` medindo o tamanho dos artefatos em `dist/`.
3. Escrever `docs/qa/qa-M2.md` seguindo `docs/metodo/Validacao.md`: veredito (`passa`, `passa com ressalvas` ou `não passa`), regressão do M1, cobertura do M2 (loot, sinergias, inventário, multi-touch, boss rebalanceado, PWA), métricas 3x + tamanho do build, achados (`arquivo:linha`) e roteiro curto para o dono testar no celular/iPhone e PC.
**Permitido:** `tests/`, `docs/qa/`.
**Proibido:** `src/`, `package.json`, `public/`, `index.html`, `scripts/` e comandos git.
**Pronto quando:** 3x `npm test` verdes, `npm run build` OK, capturas M2 geradas e `docs/qa/qa-M2.md` completo.
**Entrega:** até 6 linhas: veredito, contagem de testes (unitários + E2E), tamanho de `dist/`, capturas geradas e pontos de atenção.
