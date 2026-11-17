# BRF-040 — AG03 — T-038 Validação do Marco 3 (v0.3.0)

**Leia:** `docs/agentes/AG03_QA.md`, `docs/metodo/Validacao.md`, `docs/qa/qa-M2.md`, `tests/e2e/m2-loot.spec.ts`, `src/view/scenes/HubScene.ts`, `src/view/scenes/DungeonScene.ts`. **Regra:** respostas curtas; sem commit/push/branches; QA reporta, não altera código de produção.
**Decisão do dono:** Decisão #4 (Vitest + Playwright) e autorização explícita da `T-038` (M3 `v0.3.0`).
**Fazer:**
1. Criar `tests/e2e/m3-hub.spec.ts` validando no navegador real (PC `800x600` e Mobile `360x640`):
   - Boot em `HubScene` com versão `SUBMUNDO v0.3.0`, presença de `window.__SUBMUNDO_HUB_DEBUG__`, persistência em `localStorage` (`submundo_save_profile_v1`) e zero erros de console/página.
   - Concessão de recursos via `grantTestResources(500, 3)`, compra de upgrade no Altar de Almas (`openAltar()`, nível 0 → 1), forja/melhoria `+1` no Ferreiro Espiritual (`openBlacksmith()`), abertura do Baú (`openStash()`) e verificação de sobreposição corrigida (`T-039`).
   - Entrada na masmorra via `enterDungeon()`, conferindo aplicação dos bônus do Altar e do equipamento do Hub em `window.__SUBMUNDO_DEBUG__.getHero()`.
   - Validação de **Extração na Vitória** (avançar salas até o Boss `infernal_warden`, coletar/equipar drop da run, vencer o Boss ganhando `+1 Essência de General`, retornar ao Hub via `returnToHub()` mantendo o drop da run e Almas/Essência no perfil) e **Morte Punitiva** (entrar em nova run, dropar item da run, morrer e retornar ao Hub mantendo Almas e os equipamentos originais do Hub, mas perdendo apenas os drops não extraídos daquela run).
   - Salvar capturas do M3 em `docs/qa/screenshots/m3-pc-800x600.png` e `docs/qa/screenshots/m3-mobile-360x640.png` (mostrando a `HubScene` ou modais do Refúgio em `800x600` e `360x640`).
2. Rodar `npm run typecheck`, `npm run build` (medindo tamanho de `dist/` e conferindo ausência de `submundo_icon_master.png` da `T-040`) e `npm test` **3 vezes seguidas** (atestando estabilidade das suítes unitárias + E2E M1/M2/M3).
3. Escrever `docs/qa/qa-M3.md` seguindo `docs/metodo/Validacao.md`: veredito (`passa`, `passa com ressalvas` ou `não passa`), regressão de M1/M2 (incluindo verificação das ressalvas `T-039` e `T-040`), cobertura do M3 (HubScene, Altar, Ferreiro, Baú, extração vs. morte punitiva, LocalStorage), métricas 3x + tamanho do build, achados (`arquivo:linha`) e roteiro curto para o dono testar no celular e PC.
**Permitido:** `tests/`, `docs/qa/`.
**Proibido:** `src/`, `package.json`, `public/`, `index.html`, `scripts/` e comandos git.
**Pronto quando:** 3x `npm test` verdes, `npm run build` OK, capturas M3 geradas e `docs/qa/qa-M3.md` completo.
**Entrega:** até 6 linhas: veredito, contagem de testes (unitários + E2E), tamanho de `dist/`, capturas geradas e pontos de atenção.
