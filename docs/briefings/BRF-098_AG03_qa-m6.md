# BRF-098 — AG03 (QA) — T-071b Validação do M6 (`v0.6.0`: Monstros & Bosses 20f na `testArena`)

**Leia:** [docs/agentes/AG03_QA.md](../agentes/AG03_QA.md), [docs/qa/qa-M5.md](../qa/qa-M5.md), [public/assets/sprites/manifest.json](../../public/assets/sprites/manifest.json), [src/data/monsters.json](../../src/data/monsters.json), [src/view/sprites/CombatVfx.ts](../../src/view/sprites/CombatVfx.ts), [src/view/scenes/BootScene.ts](../../src/view/scenes/BootScene.ts), [src/view/scenes/DungeonScene.ts](../../src/view/scenes/DungeonScene.ts). **Regra:** respostas curtas; **PROIBIDO** editar `src/`, `assets/`, `scripts/`, `public/`, `package.json` ou executar `git`.

**Contexto:** O M6 entregou a `testArena` escura em 2 ondas (Decisões #10, #11, #13): 5 monstros comuns (`slime`, `cave_bat`, `wolf`, `skeleton`, `skeleton_archer` em `1600×80`) e 3 bosses/minibosses (`wolf_alpha`, `skeleton_chief` em `1600×80` e `karnak` em `1920×96`, escala `1.06`, orientado para a direita), com versão sendo atualizada para `0.6.0` pelo AG07 em paralelo.

**Fazer:**
1. **Criar `tests/core/m6-monsters-assets.test.ts`** (Node puro, ZERO importação de `phaser`, para rodar no `vitest run` do CI):
   - Validar assinatura PNG e `IHDR` de todos os 8 spritesheets em `public/assets/sprites/`:
     - `1600×80`: `slime.png`, `cave_bat.png`, `wolf.png`, `skeleton.png`, `skeleton_archer.png`, `wolf_alpha.png`, `skeleton_chief.png`;
     - `1920×96`: `karnak.png`.
   - Validar em `public/assets/sprites/manifest.json` que todos os 8 têm exatamente 20 frames canônicos (`idle0..3`, `walk0..5`, `attack0..5`, `death0..3`).
   - Validar em `src/view/sprites/CombatVfx.ts` que `createMonsterAnimSpecs` e `ANIMATED_MONSTER_KEYS` cobrem todos os 8 monstros/bosses.
   - Validar em `src/view/scenes/BootScene.ts` que `SPRITESHEET_SPECS` pré-carrega todos os 8 (`80×80` para os 7 primeiros e `96×96` para `karnak`).
   - Validar em `src/data/monsters.json` que todos os 12 registros (4 legados + 5 monstros M6 + 3 bosses M6) existem e são válidos.
2. **Criar `tests/e2e/m6-monsters.spec.ts`:**
   - Validar boot na `testArena` (`SUBMUNDO v0.6.0`, `BootScene` -> `DungeonScene` com `testArena = true`, fundo `#000000`, `hero_living`, zero `consoleErrors`/`pageErrors`/`404`).
   - Validar texturas e `32` animações dos 8 monstros/bosses (`frameTotal === 21`, `80×80` / `96×96`).
   - Validar Onda 1 (5 monstros normais vivos), matar Onda 1 e aguardar Onda 2 (`wolf_alpha`, `karnak` em escala `1.06`, `skeleton_chief`), gerando capturas PC (`800×600`) e Mobile (`360×640`) em `/tmp/qa-m6/`.
3. **Executar verificações locais disponíveis e gerar `docs/qa/qa-M6.md`:**
   - Tentar rodar `npm run typecheck`, `npm run build` e `npm test`; se `node`/`npm` não existir no PATH deste Windows, rodar auditoria binária/estática completa via Python 3.14 (PNG/IHDR dos 8 spritesheets, `manifest.json`, `monsters.json`, `CombatVfx.ts`, `BootScene.ts`, `DungeonScene.ts` e revisão `strict: true` dos testes).
   - Emitir `docs/qa/qa-M6.md` com veredito honesto (**PASSA COM RESSALVAS** se o Node/Playwright não estiver disponível localmente, detalhando o que foi auditado e o que fica pendente no CI do GitHub Actions + roteiro manual para o dono).

**Permitido:** `tests/core/m6-monsters-assets.test.ts`, `tests/e2e/m6-monsters.spec.ts`, `docs/qa/qa-M6.md`.
**Proibido:** `src/`, `assets/`, `scripts/`, `public/`, `package.json`, e qualquer comando `git`.

**Entrega:** até 10 linhas: (1) arquivos criados, (2) veredito e resumo da auditoria/testes, (3) o que não pôde ser executado localmente.
