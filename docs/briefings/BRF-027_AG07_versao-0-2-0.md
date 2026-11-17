# BRF-027 — AG07 — T-021 Subir versão para 0.2.0

**Leia:** `docs/agentes/AG07_Arquiteto.md`, `package.json`, `src/version.ts`, `tests/core/architecture.test.ts`, `tests/e2e/m1-dungeon.spec.ts`. **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono:** Autorização explícita da `T-021` (M2 `v0.2.0`).
**Fazer:**
1. Atualizar `"version": "0.2.0"` em `package.json`.
2. Atualizar `export const GAME_VERSION = '0.2.0';` em `src/version.ts`.
3. Atualizar a expectativa de `GAME_VERSION` para `'0.2.0'` em `tests/core/architecture.test.ts` e usar `` `SUBMUNDO v${GAME_VERSION}` `` (ou `'SUBMUNDO v0.2.0'`) em `tests/e2e/m1-dungeon.spec.ts` para não quebrar a regressão do M1 ao mudar de versão.
**Permitido:** `package.json`, `src/version.ts`, `tests/core/architecture.test.ts`, `tests/e2e/m1-dungeon.spec.ts`.
**Proibido:** `src/core/`, `src/view/`, `src/data/`, `public/`, `docs/` e comandos git.
**Pronto quando:** `npm run typecheck`, `npm test` e `npm run build` passarem 100% verdes.
**Entrega:** até 5 linhas: arquivos alterados e resultado de `typecheck`/`test`/`build`.
