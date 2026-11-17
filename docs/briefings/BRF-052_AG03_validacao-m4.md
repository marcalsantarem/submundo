# BRF-052 — AG03 — T-050 Validação do Marco 4 (v0.4.0)

**Leia:** `docs/agentes/AG03_QA.md`, `docs/metodo/Validacao.md`, `docs/qa/qa-M3.md`, `tests/e2e/m3-hub.spec.ts`, `src/core/progression/CampaignManager.ts`, `src/view/scenes/HubScene.ts`, `src/view/scenes/DungeonScene.ts`, `src/view/ui/DialogueBox.ts`, `src/view/audio/SoundManager.ts`. **Regra:** respostas curtas; sem commit/push/branches; QA reporta, não altera código de produção.
**Decisão do dono:** Decisão #4 (Vitest + Playwright) e autorização explícita da `T-050` (M4 `v0.4.0`).
**Fazer:**
1. Criar `tests/e2e/m4-campaign.spec.ts` validando no navegador real (PC `800x600` e Mobile `360x640`):
   - Boot limpo em `HubScene` (`SUBMUNDO v0.4.0`) iniciando no **Prólogo — Vila Natal Viva** (`campaign.phase === 'prologue'`, `prologue_grotto`), com abertura automática do `DialogueBox` exibindo retrato 2D (`weapon_master`, `portraits` carregado) e avanço/fechamento sem erros de console/página.
   - Verificação das ressalvas `T-051` no `BlacksmithModal` (sem sufixo `+N` duplicado em `row.nameText` e folga visual entre `costText` e o botão `Forjar` no desktop `800x600`).
   - Progresso da Campanha: entrada em `prologue_grotto` (*A Gruta da Cachoeira*, 3 salas), avanço e vitória em `prologue_grotto` → desbloqueio de `prologue_mine` → vitória em `prologue_seal` (*O Selo Antigo*, boss `abyss_herald`) disparando `triggeredVillageFall === true`, transição automática para `phase === 'act1'` (`act1_submundo` no **Refúgio no Submundo**) e exibição dos diálogos do **Pacto Celestial** (`village_fall_pact` / `act1_briefing`) com retrato do Emissário Celestial.
   - Verificação de **36 afixos** disponíveis em `src/data/affixes.json` e funcionamento seguro do `SoundManager` (`toggleMute` / `isMuted`, persistência `submundo_muted_v1`) sem exceções em ambiente headless.
   - Salvar capturas do M4 em `docs/qa/screenshots/m4-pc-800x600.png` (Vila Natal com `DialogueBox` e retrato 2D ou transição do Prólogo) e `docs/qa/screenshots/m4-mobile-360x640.png` (Vila Natal Mobile 9:16).
2. Rodar `npm run typecheck`, `npm run build` (medindo tamanho de `dist/`) e `npm test` **3 vezes seguidas** (atestando estabilidade das suítes unitárias + E2E M1/M2/M3/M4).
3. Escrever `docs/qa/qa-M4.md` seguindo `docs/metodo/Validacao.md`: veredito (`passa`, `passa com ressalvas` ou `não passa`), regressão M1/M2/M3 (incluindo verificação de `T-051` e `T-052`), cobertura M4 (Prólogo 3 masmorras, Queda da Vila/Pacto Celestial, Ato 1, retratos 2D, 36 afixos, SFX Web Audio), métricas 3x + tamanho de `dist/`, achados (`arquivo:linha`) e roteiro curto para o dono testar no celular e PC.
**Permitido:** `tests/`, `docs/qa/`.
**Proibido:** `src/`, `package.json`, `public/`, `index.html`, `scripts/` e comandos git.
**Pronto quando:** 3x `npm test` verdes, `npm run build` OK, capturas M4 geradas e `docs/qa/qa-M4.md` completo.
**Entrega:** até 6 linhas: veredito, contagem de testes (unitários + E2E), tamanho de `dist/`, capturas geradas e pontos de atenção.
