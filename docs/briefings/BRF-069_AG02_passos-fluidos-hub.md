# BRF-069 — AG02 (UI) — T-089 Passos Fluidos sem Flicker e Poeira de Passos na HubScene

**Leia:** [docs/agentes/AG02_UI.md](../agentes/AG02_UI.md), [src/view/scenes/HubScene.ts](../../src/view/scenes/HubScene.ts). **Regra:** respostas curtas; **PROIBIDO** executar `git commit`, `push`, `branch`, `checkout`, `reset` ou `stash`.

**Decisão do dono (Decisão #8):** Na `T-087` os spritesheets `hero_living.png` e `hero_wraith.png` passaram para 24 frames (`1920×80`, `walk` 6 frames `4..9`) e na `T-088` (em paralelo com AG01) `CombatVfx.ts` e `HeroWeaponRig.ts` passam a usar as novas animações 24f e âncoras reais da mão. Precisamos deixar a locomoção do herói na `HubScene.ts` igualmente fluida, sem flicker `idle`/`walk` e com poeira de passos sincronizada.

**Contrato (criado/atualizado em paralelo pelo AG01 na T-088):**
- Em `../sprites/CombatVfx`:
  ```ts
  export const HERO_WALK_FOOTSTEP_FRAMES: readonly number[] = [4, 7];
  export function spawnFootstepDust(
    scene: Phaser.Scene,
    x: number,
    y: number,
    isWraith: boolean
  ): void;
  export function registerGameAnimations(scene: Phaser.Scene): void;
  ```
- Em `../sprites/HeroWeaponRig`:
  - Mantém exatamente a mesma interface usada pela `HubScene`: `new HeroWeaponRig(scene, heroSprite, equippedWeapon, isWraith)`, `setEquippedWeapon(...)`, `sync(isMoving, timeMs)`, `setVisible(...)`, `destroy()`. Internamente `HeroWeaponRig.sync` passa a ler o frame real do `heroSprite` automaticamente.

**Fazer (apenas em `src/view/scenes/HubScene.ts`):**
1. **Importar `HERO_WALK_FOOTSTEP_FRAMES` e `spawnFootstepDust`** de `../sprites/CombatVfx` (junto com `registerGameAnimations`).
2. **Eliminar risco de flicker `idle`/`walk` no `update()`:**
   - Determinar `isMoving` a partir da intenção de movimento (`canMove && (Math.abs(moveDir.x) > 0.05 || Math.abs(moveDir.y) > 0.05)`) combinada com deslocamento real (`Math.hypot(dx, dy) > 0.05`) — em vez do limiar alto `> 0.5px` por frame que pode piscar em monitores 120/144 Hz ou toques curtos no joystick!
   - Atualizar `flipX` quando `Math.abs(moveDir.x) > 0.05` (ou `Math.abs(dx) > 0.05`), garantindo resposta imediata ao virar o personagem.
   - Só chamar `this.heroSprite.play(desiredKey, true)` quando `this.heroSprite.anims.currentAnim?.key !== desiredKey` (garantindo continuidade suave do ciclo de 6 frames de `walk`).
3. **Poeira de passos sincronizada com o ciclo `walk`:**
   - Adicionar campo `private lastFootstepFrame = -1;` na `HubScene` (resetado no `create`, `rebuildPhaseScenario` e `cleanupScene`).
   - Quando `isMoving` e a animação atual for `${this.heroSpriteKey}_walk`, ler `const frameIdx = Number(this.heroSprite.frame?.name);`. Sempre que `frameIdx !== this.lastFootstepFrame`: atualizar `this.lastFootstepFrame = frameIdx;` e, se `HERO_WALK_FOOTSTEP_FRAMES.includes(frameIdx)`, chamar `spawnFootstepDust(this, this.heroSprite.x, this.heroSprite.y + 31 * this.heroSprite.scaleY, this.heroSpriteKey === 'hero_wraith')`.
   - Quando `!isMoving`, resetar `this.lastFootstepFrame = -1`.
4. **Conferir `syncVisuals()`, `rebuildPhaseScenario()` e `handleViewportResize()`:**
   - Garantir que `this.weaponRig?.sync(isMoving, time)` seja chamado de forma consistente após a atualização da posição/animação do herói (inclusive no `rebuildPhaseScenario` com `isMoving = false`).

**Permitido:** `src/view/scenes/HubScene.ts`.
**Proibido:** `src/view/sprites/CombatVfx.ts`, `src/view/sprites/HeroWeaponRig.ts`, `src/view/scenes/DungeonScene.ts`, `src/view/scenes/BootScene.ts`, `src/core/`, `src/data/`, `tests/`, `package.json` e qualquer comando `git`.

**Pronto quando:**
- `src/view/scenes/HubScene.ts` implementa os itens 1 a 4 respeitando exatamente o contrato com `AG01`, sem erros de tipagem TypeScript (`strict: true`) e preservando integralmente o comportamento do Hub, diálogos, modais, `Resetar` e debug handle `__SUBMUNDO_HUB_DEBUG__`.
- Nota de ambiente: se `npm`/`node` não estiver disponível no PATH local, faça revisão minuciosa de tipos/sintaxe em `HubScene.ts` e reporte o que não pôde ser executado localmente.

**Entrega:** até 8 linhas: (1) alterações feitas em `HubScene.ts`, (2) aderência ao contrato da `T-088`, (3) validação realizada e o que não foi possível testar localmente.
