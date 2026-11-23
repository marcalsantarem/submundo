# BRF-103 — AG01 (Gameplay) — T-078d Integrar Dados de Minimapa, Retrato, Ataque Manual/AUTO e Boss Bar na `DungeonScene.ts`

**Leia:** [docs/agentes/AG01_Gameplay.md](../agentes/AG01_Gameplay.md), [src/view/scenes/DungeonScene.ts](../../src/view/scenes/DungeonScene.ts). **Regra:** respostas curtas; **PROIBIDO** editar `src/view/ui/`, `BootScene.ts`, `src/core/`, `tests/` ou executar `git`.

**Contrato (compartilhado com AG02 na T-078c):**
- `DungeonHud` passa a aceitar callbacks opcionais `onBasicAttack?: () => void` e `onToggleAutoAttack?: () => void`.
- `HudSnapshot` passa a aceitar campos opcionais: `heroPortraitFrame`, `heroName`, `heroLevel`, `essences`, `autoAttackEnabled`, `isTestArena`, `missionObjective`, `minimap: { heroX, heroY, arenaWidth, arenaHeight, enemies: Array<{ x: number; y: number; isBoss: boolean }> }`.

**Fazer (apenas em `src/view/scenes/DungeonScene.ts`):**
1. Adicionar estado `private autoAttackEnabled = true;` (resetado para `true` em `create` / `startNewRun`).
2. Na instanciação de `new DungeonHud(...)`, conectar:
   - `onToggleAutoAttack: () => { this.autoAttackEnabled = !this.autoAttackEnabled; soundManager.play('ui_click'); this.updateHud(this.elapsedTimeMs); }`
   - `onBasicAttack: () => { this.handleManualBasicAttack(); }`
3. Implementar `private handleManualBasicAttack(): void`:
   - Se o herói estiver vivo, não estiver em modal e o run estiver `in_progress`: dispara o feedback visual de ataque (`playHeroActionAnim('attack')` se não estiver andando/dash + `weaponRig?.playAttackSwing(facingLeft, false)` + `soundManager.play('attack')`) e, se houver monstro vivo dentro do alcance (`hero.stats.attackRange + 28`) e fora de cooldown imediato, aplica o golpe (ou acelera `hero.nextAttackAtMs = Math.min(hero.nextAttackAtMs, this.elapsedTimeMs)` para o próximo `tickCombat` executar o ataque básico imediatamente!).
   - Quando `!this.autoAttackEnabled` no `update()`, impedir o ataque automático mantendo `hero.nextAttackAtMs = Math.max(hero.nextAttackAtMs, nowMs + 120)` antes do `tickCombat` (e quando o jogador tocar em `onBasicAttack`, setar `hero.nextAttackAtMs = 0` para disparar!). Assim `src/core/` permanece 100% intocado e os testes core não quebram!
4. Atualizar `updateHud(nowMs)` para enviar os novos campos de `HudSnapshot`:
   - `heroPortraitFrame`: `this.heroSpriteKey === 'hero_wraith' ? 1 : 0`
   - `heroName`: `this.heroSpriteKey === 'hero_wraith' ? 'ESPECTRO' : 'GUERREIRO'`
   - `heroLevel`: `1 + (this.activeProfile ? Object.values(this.activeProfile.altarLevels).reduce((a, b) => a + b, 0) : 0)`
   - `essences`: `this.essencesCollected`
   - `autoAttackEnabled`: `this.autoAttackEnabled`
   - `isTestArena`: `this.isTestArena`
   - `missionObjective`: na `testArena`, `'Arena de Teste — Onda 1 (Monstros)'` ou `'Arena de Teste — Onda 2 (Bosses)'`; em run normal, `${currentRoom.roomNumber}/${this.runState.totalRooms} — ${currentRoom.title}`
   - `minimap`: `{ heroX: this.hero.position.x, heroY: this.hero.position.y, arenaWidth: this.scale.width || 800, arenaHeight: this.scale.height || 600, enemies: this.monsters.filter((m) => m.isAlive).map((m) => ({ x: m.position.x, y: m.position.y, isBoss: m.type === 'boss' })) }`
   - Garantir que `bossHp`/`bossMaxHp`/`bossName` sejam preenchidos sempre que existir algum monstro vivo com `type === 'boss'` (inclusive na Onda 2 da `testArena`, priorizando o boss mais próximo do herói!).

**Permitido:** `src/view/scenes/DungeonScene.ts`.
**Proibido:** `src/view/ui/`, `BootScene.ts`, `src/core/`, `tests/`, e qualquer comando `git`.

**Entrega:** até 8 linhas: alterações em `DungeonScene.ts`, aderência ao contrato com `AG02` e revisão estática (`strict: true`).
