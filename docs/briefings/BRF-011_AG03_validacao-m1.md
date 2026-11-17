# BRF-011 — AG03 — T-010 Validação do Marco 1 (Vitest 3x, Playwright, capturas PC/Mobile e relatório QA)

**Leia:** `docs/agentes/AG03_QA.md`, `docs/metodo/Validacao.md`. **Regra:** respostas curtas; sem commit/push/branches; reporta, não corrige código de produção.
**Decisão do dono:** Decisão #4 (Vitest + Playwright) e Decisão #5 (M1 `v0.1.0`).
**Contrato:**
- `playwright.config.ts` e `tests/e2e/m1-dungeon.spec.ts` para validar o build no navegador real em dois viewports:
  - PC Desktop Paisagem (`800x600`) -> salvar captura em `docs/qa/screenshots/m1-pc-800x600.png`
  - Mobile Retrato (`360x640`, proporção `9:16`) -> salvar captura em `docs/qa/screenshots/m1-mobile-360x640.png`
- Relatório formal em `docs/qa/qa-M1.md` seguindo `docs/metodo/Validacao.md`.
**Fazer:**
1. Rodar a suíte unitária/integração (`npm test`) 3 vezes seguidas para atestar estabilidade.
2. Rodar `npm run build` e medir o tamanho dos arquivos gerados em `dist/`.
3. Criar `playwright.config.ts` e `tests/e2e/m1-dungeon.spec.ts` verificando: carregamento sem erros de console/página, renderização da `DungeonScene`, funcionamento de movimentação/ataque automático/skills/poção, transição de salas até o Boss e geração das capturas `m1-pc-800x600.png` e `m1-mobile-360x640.png`.
4. Escrever `docs/qa/qa-M1.md` com veredito (`passa`, `passa com ressalvas` ou `não passa`), métricas, classificação de eventuais achados (`arquivo:linha`) e roteiro curto para o dono testar no aparelho real.
**Permitido:** `playwright.config.ts`, `tests/`, `docs/qa/`.
**Proibido:** `src/`, `package.json`, `public/` e comandos git (`commit`, `push`, `branch`, `checkout`, `reset`, `stash`).
**Pronto quando:** suíte 3x rodada, teste Playwright e capturas geradas, e `docs/qa/qa-M1.md` concluído.
**Entrega:** até 6 linhas: veredito, contagem de testes (unitários + E2E), tamanho do build, capturas geradas e o que ficou para o dono validar.
