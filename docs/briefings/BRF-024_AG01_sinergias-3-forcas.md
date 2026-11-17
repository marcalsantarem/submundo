# BRF-024 — AG01 — T-018 Sinergias das 3 Forças e Poderes Lendários no Combate

**Leia:** `docs/agentes/AG01_Gameplay.md`, `src/core/index.ts`, `src/core/entities/Hero.ts`, `src/core/entities/Monster.ts`, `src/core/combat/CombatEngine.ts`, `tests/core/combat.test.ts`. **Regra:** respostas curtas; sem commit/push/branches; ZERO Phaser em `src/core/`; preservar 100% de compatibilidade com os testes do M1.
**Decisão do dono:** Autorização explícita da `T-018` (M2 `v0.2.0`).
**Contrato:**
- `src/core/entities/Hero.ts`:
  - Exportar `SpectralMinion { id: string; position: Vector2D; attack: number; attackRange: number; attackCooldownMs: number; nextAttackAtMs: number; expiresAtMs: number; }`.
  - Adicionar em `HeroState` (inicializados em `createHero` com defaults seguros para não quebrar M1): `baseStats: HeroStats`, `lifeSteal: number`, `cooldownReduction: number`, `luck: number`, `equippedForces: Record<'inferno' | 'submundo' | 'empireo', number>`, `activeLegendaryPowers: LegendaryPowerId[]`, `minions: SpectralMinion[]`.
- `src/core/entities/Monster.ts`:
  - Adicionar em `MonsterInstance` (inicializados em `spawnMonster`): `emberStacks: number`, `bleedUntilMs: number`, `bleedDps: number`, `lastBleedTickAtMs: number`, `stunnedUntilMs: number`.
- `src/core/combat/CombatEngine.ts`:
  - Estender `CombatEventType` mantendo todos os tipos do M1 + `'ember_applied' | 'ember_explosion' | 'bleed_tick' | 'lifesteal_heal' | 'lightning_chain' | 'minion_spawned' | 'minion_attack' | 'status_stun'`.
  - Adicionar `chainTargets?: Vector2D[]` em `CombatEvent`.
  - Implementar as 3 Forças e Poderes Lendários dentro de `tickCombat` e `triggerHeroSkill`:
    1. **Inferno (`Brasa`):** ataque/skill de `inferno` ou `equippedForces.inferno > 0` aplica `emberStacks += 1` (emite `ember_applied`); ao atingir **5 cargas**, zera e explode em área (`radius: 90` ou `130` com `inferno_ember_nova`, dano `Math.round(hero.stats.attack * 1.8)` ou `2.6` com nova), emitindo `ember_explosion`. Com `inferno_dash_trail`, o Dash aplica `ember` nos monstros até `90px`.
    2. **Submundo (`Sangramento & Roubo de Vida`):** skill `submundo` ou `equippedForces.submundo > 0` aplica sangramento de 3s (`bleedDps = Math.max(4, Math.round(hero.stats.attack * 0.4))`, tick a cada `500ms` emitindo `bleed_tick`) e `hero.lifeSteal` cura parte do dano causado (`lifesteal_heal`). Com `submundo_bleed_minion`, monstro que morre sangrando tem 25% (`rng() < 0.25`) de invocar um `SpectralMinion` (`minion_spawned`) que persegue/ataca monstros por 12s. Com `submundo_crimson_pact`, roubo de vida dobra contra alvos sangrando.
    3. **Empíreo (`Julgamento & Raio`):** acerto crítico quando `equippedForces.empireo > 0` ou `empireo_crit_lightning` dispara raio em cadeia em até 2 monstros próximos (`radius: 160`, dano `Math.round(hero.stats.attack * 0.9)`, atordoa por `600ms` impedindo o monstro de mover/atacar até `stunnedUntilMs`), emitindo `lightning_chain` (com `chainTargets`) e `status_stun`. Com `empireo_judgment_haste`, críticos reduzem em `500ms` os cooldowns ativos das skills.
    4. Aplicar `hero.cooldownReduction` (máx `0.45`) ao calcular o cooldown em `triggerHeroSkill`.
**Fazer:**
1. Atualizar `Hero.ts`, `Monster.ts` e `CombatEngine.ts`.
2. Criar `tests/core/synergies.test.ts` testando explosão de 5 cargas de Brasa, sangramento + roubo de vida + invocação de servo espectral, raio em cadeia no crítico + stun + haste e redução de cooldown.
**Permitido:** `src/core/entities/Hero.ts`, `src/core/entities/Monster.ts`, `src/core/combat/CombatEngine.ts`, `tests/core/synergies.test.ts`.
**Proibido:** `src/core/index.ts`, `src/core/loot/`, `src/core/dungeon/`, `src/view/`, `tests/core/combat.test.ts` e comandos git.
**Pronto quando:** `npm run typecheck` e `npm test` (todos os testes antigos + `synergies.test.ts`) passarem 100% verdes.
**Entrega:** até 6 linhas: arquivos alterados/criados, contagem de testes em `synergies.test.ts` e resultado da suíte completa.
