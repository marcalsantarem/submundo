# BRF-053 — AG04 — T-053 Preservar `campaign` em `loadOrCreateProfile()`

**Leia:** `docs/agentes/AG04_Sistemas.md`, `docs/qa/qa-M4.md` (seção 4 — Bloqueante #1), `src/core/progression/ProfileManager.ts:145-195`, `tests/core/progression.test.ts`. **Regra:** zero Phaser em `src/core/`; zero git commands.
**Decisão do dono:** Correção de bloqueante detectado na validação `T-050` (M4 `v0.4.0`).
**Fazer:**
1. Em `src/core/progression/ProfileManager.ts` (`loadOrCreateProfile`, ~linhas 161–194):
   - Quando `loaded.campaign` existir e for um objeto válido, preservar `campaign` no objeto retornado (normalizando `phase`, `currentStageId`, `completedStages`, `seenDialogues` e `villageFallTriggered` com fallback seguro caso algum campo falte, sem descartar o progresso salvo).
2. Em `tests/core/progression.test.ts`:
   - Adicionar teste unitário verificando que `persistProfile()` seguido de `loadOrCreateProfile()` preserva `profile.campaign` completo (`phase`, `currentStageId`, `completedStages`, `seenDialogues`, `villageFallTriggered`).
**Permitido:** `src/core/progression/ProfileManager.ts`, `tests/core/progression.test.ts`.
**Proibido:** alterar outros arquivos ou executar comandos git.
**Pronto quando:** `npm run typecheck`, `npm run build` e `npm test` passam 100% (incluindo `tests/e2e/m4-campaign.spec.ts`).
**Entrega:** até 4 linhas resumindo a correção e a contagem da suíte.
