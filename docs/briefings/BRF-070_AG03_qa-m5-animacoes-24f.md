# BRF-070 — AG03 (QA) — T-090 Validação QA das Animações 24f do Herói e Atualização da Suíte M5

**Leia:** [docs/agentes/AG03_QA.md](../agentes/AG03_QA.md), [tests/e2e/m5-hero.spec.ts](../../tests/e2e/m5-hero.spec.ts), [docs/qa/qa-M5.md](../qa/qa-M5.md), [public/assets/sprites/manifest.json](../../public/assets/sprites/manifest.json), [src/view/sprites/CombatVfx.ts](../../src/view/sprites/CombatVfx.ts), [src/view/sprites/HeroWeaponRig.ts](../../src/view/sprites/HeroWeaponRig.ts). **Regra:** respostas curtas; **PROIBIDO** editar `src/`, `assets/`, `scripts/` ou executar `git commit`, `push`, `branch`, `checkout`, `reset` ou `stash`.

**Decisão do dono (Decisão #8):** Os spritesheets `hero_living.png` e `hero_wraith.png` foram refeitos na `T-087` para **24 frames (`1920×80`, `80×80`/frame)** com passos reais (`walk` 6f), `attack` 6f, `dash` 4f e `hit` 4f, e integrados na `T-088`/`T-089` (`CombatVfx.ts`, `HeroWeaponRig.ts`, `DungeonScene.ts`, `HubScene.ts`). O dono testou no preview `dev` e aprovou o visual/fluidez. Agora precisamos atualizar os testes automatizados e o relatório `docs/qa/qa-M5.md`.

**Fazer:**
1. **Atualizar `tests/e2e/m5-hero.spec.ts`:**
   - Atualizar dimensões e contagem de frames de `heroLiving` e `heroWraith` para `{ width: 1920, height: 80, frameTotal: 25, frameCount: 24, frameWidth: 80, frameHeight: 80 }` (mantendo `weapons` em `192×48`, `frameTotal: 5`, `frameCount: 4`).
   - Validar o número de frames de cada uma das 10 animações registradas em `scene.anims.get(key).frames.length`:
     - `*_idle`: `4`, `*_walk`: `6`, `*_attack`: `6`, `*_dash`: `4`, `*_hit`: `4`.
   - Adicionar checagem **anti-deslizamento** no navegador (desenhando frames `4` (`walk0`) vs `7` (`walk3`) e `0` (`idle0`) vs `12` (`attack2`) de `hero_living` e `hero_wraith` em um `<canvas>` 2D offscreen e verificando diferença real de pixels `> 20%` na faixa inferior das pernas `y = 50..78`).
   - Durante o movimento na Vila Natal (`KeyA`/`KeyD`), verificar que `heroSprite.frame.name` entra na faixa de `walk` (`4..9`) e progride sem ficar travado em um único frame.
   - Manter compatibilidade com a `T-088`: note que `hero_living_attack` e `hero_wraith_attack` na `DungeonScene` rodam quando o herói está parado perto do monstro (como o teste já faz) e também são disparados por skills ativas (`crimson_cleave`), enquanto `hero_basic_attack` em movimento mantém `walk` contínuo. Preservar a geração das 4 capturas em `/tmp/qa-m5/` e zero `consoleErrors`/`pageErrors`/`404`.
2. **Criar teste unitário puro de integridade em `tests/core/hero-animations.test.ts`** (100% Node puro, ZERO importação de `phaser` para rodar no `vitest run` do CI):
   - Ler `public/assets/sprites/hero_living.png`, `hero_wraith.png` e `weapons.png` via `node:fs` e validar assinatura PNG + cabeçalho IHDR (`1920×80`, `1920×80`, `192×48`);
   - Ler `public/assets/sprites/manifest.json` e validar os 24 nomes canônicos de `frames` (`idle0..3`, `walk0..5`, `attack0..5`, `dash0..3`, `hit0..3`) e os 24 `handAnchors` (`dx`, `dy`, `rot` finitos) para ambos `hero_living` e `hero_wraith`;
   - Ler `src/view/sprites/HeroWeaponRig.ts` como texto e validar que os 24 `HERO_HAND_ANCHORS` definidos em código batem exatamente com os 24 `handAnchors` do `manifest.json` (evitando drift futuro!).
3. **Validação executável disponível neste ambiente:**
   - Testar se `npm`/`node` está disponível no PATH; se estiver, rodar `npm run typecheck`, `npm run build` e `npm test` 3× + Playwright.
   - **Se `node`/`npm` não estiver disponível neste Windows:** executar verificação automatizada via `python` confirmando: (a) cabeçalhos PNG `1920×80` e `192×48` e tamanho real em disco de `hero_living.png`, `hero_wraith.png` e `weapons.png`, (b) métricas anti-deslizamento na faixa `y = 50..78`, (c) igualdade exata dos 24 `handAnchors` entre `manifest.json` e `HeroWeaponRig.ts`, (d) igualdade dos índices de frames em `CombatVfx.ts` (`0..3`, `4..9`, `10..15`, `16..19`, `20..23`), e (e) revisão estática rigorosa de `tests/e2e/m5-hero.spec.ts` e `tests/core/hero-animations.test.ts` (`strict: true`).
4. **Atualizar `docs/qa/qa-M5.md`:**
   - Adicionar seção clara de **Reteste — Refação de Animações 24 Frames (`T-087` a `T-090`, `BRF-070`)** registrando os novos tamanhos dos spritesheets, a nova cobertura de testes (`m5-hero.spec.ts` + `hero-animations.test.ts`), as verificações executadas localmente, e sendo **100% explícito** sobre o que não pôde rodar localmente caso `node`/`npm` esteja ausente (ficando pendente de confirmação no CI do GitHub Actions).

**Permitido:** `tests/e2e/m5-hero.spec.ts`, `tests/core/hero-animations.test.ts`, `docs/qa/qa-M5.md`.
**Proibido:** `src/`, `assets/`, `scripts/`, `public/`, `package.json`, e qualquer comando `git`.

**Pronto quando:**
- `tests/e2e/m5-hero.spec.ts` atualizado para 24 frames (`1920×80`), contagem de frames por animação e checagem anti-deslizamento;
- `tests/core/hero-animations.test.ts` criado em Node puro (zero Phaser) e revisado contra `strict: true`;
- Verificação executada (Node/Playwright se presente, ou auditoria Python completa se ausente) e `docs/qa/qa-M5.md` atualizado com veredito honesto e claro.

**Entrega:** até 12 linhas: (1) arquivos alterados/criados, (2) veredito e resumo das verificações executadas, (3) pendências/achados classificados, (4) o que não pôde ser verificado localmente, (5) próximo passo.
