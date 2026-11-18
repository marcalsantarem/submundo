# BRF-068 — AG01 (Gameplay) — T-088 Animações 24f, HeroWeaponRig Sincronizado e Combate Fluido na DungeonScene

**Leia:** [docs/agentes/AG01_Gameplay.md](../agentes/AG01_Gameplay.md), [src/view/sprites/CombatVfx.ts](../../src/view/sprites/CombatVfx.ts), [src/view/sprites/HeroWeaponRig.ts](../../src/view/sprites/HeroWeaponRig.ts), [src/view/scenes/DungeonScene.ts](../../src/view/scenes/DungeonScene.ts), [public/assets/sprites/manifest.json](../../public/assets/sprites/manifest.json). **Regra:** respostas curtas; **PROIBIDO** executar `git commit`, `push`, `branch`, `checkout`, `reset` ou `stash`.

**Decisão do dono (Decisão #8):** Os spritesheets `hero_living.png` e `hero_wraith.png` foram refeitos na `T-087` para **24 frames (`1920×80`, `80×80`/frame)** com passos reais e poses de combate/dash/hit. Agora precisamos atualizar as definições de animação, acoplar a arma exatamente na mão por frame e deixar movimentação + combate fluidos na `DungeonScene` (sem travar passos durante ataque automático).

**Contrato (compartilhado com AG02 em paralelo na T-089):**
1. **`src/view/sprites/CombatVfx.ts`:**
   - Layout de 24 frames (`hero_living` e `hero_wraith`):
     - `*_idle`: `frames: [0, 1, 2, 3]`, `frameRate: 6`, `repeat: -1`
     - `*_walk`: `frames: [4, 5, 6, 7, 8, 9]`, `frameRate: 12`, `repeat: -1`
     - `*_attack`: `frames: [10, 11, 12, 13, 14, 15]`, `frameRate: 18`, `repeat: 0`
     - `*_dash`: `frames: [16, 17, 18, 19]`, `frameRate: 16`, `repeat: 0`
     - `*_hit`: `frames: [20, 21, 22, 23]`, `frameRate: 14`, `repeat: 0`
   - Exportar constante `HERO_WALK_FOOTSTEP_FRAMES: readonly number[] = [4, 7]` (frames `walk0` e `walk3`, contato dos pés no chão).
   - Exportar função pública `export function spawnFootstepDust(scene: Phaser.Scene, x: number, y: number, isWraith: boolean): void` que cria 2–3 partículas leves de poeira (tons terrosos `#d6c7a9`/`#a89878` no Living; bruma espectral ciano `#38bdf8`/`#94a3b8` no Wraith) em `depth = 19` (`< 50`), com tween rápido (`220–260ms`) e destruição automática no `onComplete`.
2. **`src/view/sprites/HeroWeaponRig.ts`:**
   - Manter a assinatura pública compatível:
     - `constructor(scene, heroSprite, equippedWeapon, isWraith)`
     - `setEquippedWeapon(equippedWeapon, isWraith): void`
     - `sync(isMoving: boolean, timeMs: number): void`
     - `playAttackSwing(facingLeft: boolean, isSkill?: boolean): void` (parâmetro opcional `isSkill = false`)
     - `setVisible(visible: boolean): void`, `setAlpha(alpha: number): void`, `destroy(): void`
   - Ler o índice do frame atual do `heroSprite` (`Number(this.heroSprite.frame?.name)` com fallback seguro para `0`) e usar a tabela `HERO_HAND_ANCHORS` com os 24 objetos `{ dx, dy, rot }` exatos de `public/assets/sprites/manifest.json` (`hero_living.handAnchors` / `hero_wraith.handAnchors`) para posicionar a arma exatamente na mão em todos os 24 frames (`x = heroSprite.x + (flipX ? -anchor.dx : anchor.dx) * heroSprite.scaleX`, `y = heroSprite.y + anchor.dy * heroSprite.scaleY`).
   - Quando não estiver em `swingTween`, rotacionar a arma com `flipX ? -anchor.rot : anchor.rot` (com micro-oscilação sutil apenas se o frame não for de ataque/dash/hit).
   - Em `playAttackSwing(facingLeft, isSkill = false)`: executar arco de corte rápido e fluido (`duration: isSkill ? 115 : 85`, `yoyo: true`), partindo de ângulo recuado alto até extensão ampla (`isSkill` mais amplo e leve scale punch `1.18x` durante o pico), sempre mantendo a posição ancorada na mão via `sync()`.

**Fazer:**
1. Atualizar `ANIMATION_SPECS` (24 frames + frameRates acima), exportar `HERO_WALK_FOOTSTEP_FRAMES` e `spawnFootstepDust(...)` em `src/view/sprites/CombatVfx.ts` (também atualizar comentário de `768x48` para `1920x80` e garantir que `hasNumberedFrames` funcione corretamente com 24 frames — atenção: no Phaser `texture.frameTotal` inclui `__BASE`, então para 24 frames `frameTotal === 25`, e `maxFrameIndex = 23`, logo `texture.frameTotal > maxFrameIndex + 1` daria `25 > 24 = true`! Conferir essa condição com cuidado para não falhar!).
2. Refatorar `src/view/sprites/HeroWeaponRig.ts` conforme o contrato acima (âncoras exatas dos 24 frames do `manifest.json`, `playAttackSwing(facingLeft, isSkill = false)` fluido e seguro no cleanup).
3. Refinar animações de movimentação e combate em `src/view/scenes/DungeonScene.ts`:
   - **Sem congelar passos durante ataque automático andando:** quando `hero_basic_attack` ocorre enquanto `this.heroIsMoving === true`, manter o herói correndo em `walk` contínuo (sem travar as pernas!) e disparar `weaponRig.playAttackSwing(facingLeft, false)` + `vfx.showSlashEffect(...)` (e virar brevemente na direção do alvo apenas se apropriado, voltando ao `moveDir.x` ao continuar andando); quando `!this.heroIsMoving`, tocar a animação completa `attack` (`10..15`) + `weaponRig.playAttackSwing`.
   - **Cancelamento responsivo (attack/hit cancel por movimento):** se uma animação de `attack` (ou `hit`) estiver rodando e o jogador começar a se mover após o frame de impacto (`frameIdx >= 12` no attack ou `frameIdx >= 21` no hit), cancelar `isHeroActionAnimPlaying` imediatamente e transicionar para `walk` sem travamento!
   - **Skills ativas (`hero_skill_used`):** quando `skill.slot === 'active_1' || skill.slot === 'active_2'`, disparar `playHeroActionAnim('attack')` (se não estiver em `dash`) + `weaponRig?.playAttackSwing(facingLeft, true)`.
   - **Prioridade de `dash` e `hit`:** `dash` sempre tem prioridade máxima (cancela `attack`/`hit`/`walk`); `hit` nunca interrompe `dash` em andamento.
   - **Poeira nos passos:** no `update()`, detectar mudança do frame atual do `heroSprite` durante `*_walk`; quando entrar em `4` ou `7` (`HERO_WALK_FOOTSTEP_FRAMES`), chamar `spawnFootstepDust(this, this.heroSprite.x, this.heroSprite.y + 31 * this.heroSprite.scaleY, this.heroSpriteKey === 'hero_wraith')`.
   - Resetar o rastreador de último frame de passo no `create` / troca de sala / `SHUTDOWN`.

**Permitido:** `src/view/sprites/CombatVfx.ts`, `src/view/sprites/HeroWeaponRig.ts`, `src/view/scenes/DungeonScene.ts`.
**Proibido:** `src/core/`, `src/data/`, `src/view/scenes/HubScene.ts`, `src/view/scenes/BootScene.ts`, `src/view/ui/`, `tests/`, `package.json` e qualquer comando `git`.

**Pronto quando:**
- Os 3 arquivos respeitam 100% o contrato acima, sem erros de tipagem TypeScript (`strict: true`), imports corretos e compatíveis com `HubScene.ts` (T-089) e `tests/e2e/m5-hero.spec.ts`;
- Nota de ambiente: se `npm`/`node` não estiver disponível no PATH local, faça revisão minuciosa de tipos/sintaxe em todos os arquivos editados e reporte claramente o que não pôde ser executado localmente.

**Entrega:** até 10 linhas: (1) arquivos alterados e resumo das mudanças, (2) confirmação do contrato (`HERO_HAND_ANCHORS`, `HERO_WALK_FOOTSTEP_FRAMES`, `spawnFootstepDust`, `playAttackSwing`), (3) validação realizada e o que não foi possível rodar localmente, (4) próximos passos.
