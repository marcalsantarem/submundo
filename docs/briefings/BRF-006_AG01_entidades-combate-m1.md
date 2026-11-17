# BRF-006 — AG01 — T-006 Lógica pura de entidades, combate automático, skills e IA de monstros

**Leia:** `docs/agentes/AG01_Gameplay.md`, `src/core/index.ts`, `src/data/monsters.json`, `src/data/skills.json`. **Regra:** respostas curtas; sem commit/push/branches; ZERO importação de Phaser em `src/core/`.
**Decisão do dono:** Decisão #3 e Decisão #5 (M1 `v0.1.0`).
**Contrato:**
- `src/core/entities/Hero.ts`:
  - `DEFAULT_HERO_STATS: HeroStats = { maxHp: 120, hp: 120, attack: 18, defense: 4, moveSpeed: 140, attackRange: 52, attackCooldownMs: 650, critChance: 0.1, critMultiplier: 1.5 }`
  - `HeroState`: `{ id: string; name: string; position: Vector2D; facing: Vector2D; stats: HeroStats; souls: number; potionCharges: number; maxPotionCharges: number; invulnerableUntilMs: number; basicAttackReadyAtMs: number; skillReadyAtMs: Record<string, number>; isAlive: boolean; }`
  - Exportar: `createHero(initialPos?: Vector2D, overrides?: Partial<HeroStats>): HeroState`, `moveHero(hero: HeroState, dir: Vector2D, deltaMs: number, bounds: { width: number; height: number; padding?: number }): void`, `healHero(hero: HeroState, percent: number): number`, `applyDamageToHero(hero: HeroState, rawDamage: number, nowMs: number): number`.
- `src/core/entities/Monster.ts`:
  - `MonsterInstance`: `{ instanceId: string; defId: string; name: string; type: MonsterType; spriteKey: string; position: Vector2D; hp: number; maxHp: number; attack: number; defense: number; moveSpeed: number; attackRange: number; attackCooldownMs: number; soulReward: number; nextAttackAtMs: number; isAlive: boolean; }`
  - Exportar: `spawnMonster(def: MonsterDef, instanceId: string, position: Vector2D): MonsterInstance`, `applyDamageToMonster(monster: MonsterInstance, rawDamage: number): number`.
- `src/core/combat/CombatEngine.ts`:
  - `CombatEventType = 'hero_basic_attack' | 'hero_skill_used' | 'hero_dash' | 'hero_healed' | 'monster_damaged' | 'monster_killed' | 'hero_damaged' | 'hero_killed'`
  - `CombatEvent { type: CombatEventType; sourceId: string; targetId?: string; skillId?: string; value?: number; position: Vector2D; isCrit?: boolean }`
  - Exportar: `calculateDamage`, `findNearestLivingMonster`, `tickCombat` (ataque básico automático no inimigo mais próximo no alcance, perseguição/ataque dos monstros, invulnerabilidade durante Dash, recompensa de Almas ao matar) e `triggerHeroSkill` (`dash`, `active_1`, `active_2`, `potion` com cooldowns e cargas).
**Fazer:**
1. Implementar `src/core/entities/Hero.ts`, `src/core/entities/Monster.ts` e `src/core/combat/CombatEngine.ts` (100% TS puro).
2. Criar `tests/core/combat.test.ts` cobrindo movimentação, ataque básico automático, Dash com invulnerabilidade, as 2 skills de área, Poção de Alma, IA dos monstros, coleta de Almas e morte do herói.
**Permitido:** `src/core/entities/Hero.ts`, `src/core/entities/Monster.ts`, `src/core/combat/CombatEngine.ts`, `tests/core/combat.test.ts`.
**Proibido:** `src/core/dungeon/`, `src/core/index.ts`, `src/view/` e comandos git (`commit`, `push`, `branch`, `checkout`, `reset`, `stash`).
**Pronto quando:** `npm run typecheck` e `npx vitest run tests/core/combat.test.ts` passarem 100% verdes.
**Entrega:** até 6 linhas: arquivos criados, contagem de testes em `combat.test.ts`, suposições e o que não foi testado.
