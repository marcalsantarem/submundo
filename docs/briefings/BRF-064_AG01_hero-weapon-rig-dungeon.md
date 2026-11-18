# BRF-064 — AG01 (Gameplay): HeroWeaponRig e Integração 80×80 na DungeonScene (T-085b)

## Objetivo
Criar o componente compartilhado `src/view/sprites/HeroWeaponRig.ts` para acoplar o sprite dinâmico da arma equipada na mão do Herói, e integrá-lo na `DungeonScene.ts` com a nova escala `0.88` do sprite `80×80`.

## Arquivos sob sua posse
- `src/view/sprites/HeroWeaponRig.ts` (novo)
- `src/view/scenes/DungeonScene.ts`

## Requisitos Técnicos
1. **Criar `src/view/sprites/HeroWeaponRig.ts`:**
   ```ts
   import Phaser from 'phaser';
   import type { ItemInstance } from '../../core';

   export type WeaponVisualFrame = 0 | 1 | 2 | 3;

   export function resolveWeaponFrame(
     equippedWeapon: ItemInstance | null,
     isWraith: boolean
   ): WeaponVisualFrame
   ```
   - Regras de `resolveWeaponFrame`:
     - Se `equippedWeapon` possui afixo com `force === 'inferno'` ou `legendaryPowerId` iniciando com `'inferno_'` → `2` (Machado Flamejante);
     - Se `equippedWeapon` possui afixo com `force === 'submundo'` ou `legendaryPowerId` iniciando com `'submundo_'` → `3` (Adaga Carmesim);
     - Se `equippedWeapon` possui afixo com `force === 'empireo'` ou `legendaryPowerId` iniciando com `'empireo_'` ou `rarity === 'rare' || rarity === 'legendary'` → `1` (Espada Rúnica Ciano);
     - Caso contrário: se `isWraith` → `1` (Rúnica Ciano); senão `0` (Espada de Ferro).
   - Classe `HeroWeaponRig`:
     - `constructor(scene: Phaser.Scene, heroSprite: Phaser.GameObjects.Sprite, equippedWeapon: ItemInstance | null, isWraith: boolean)`
     - Cria `weaponSprite` com textura `'weapons'` (com fallback seguro se a textura não existir) na `depth = heroSprite.depth + 1` (`21`, `< 50`).
     - Escala da arma: `heroSprite.scaleX * 0.68` (proporcional ao guerreiro `80×80`).
     - `setEquippedWeapon(equippedWeapon: ItemInstance | null, isWraith: boolean): void` — atualiza o frame.
     - `sync(isMoving: boolean, timeMs: number): void` — sincroniza posição na mão da frente (`heroSprite.x + (flipX ? -13 : 13) * heroSprite.scaleX`, `heroSprite.y + (-3 + bob) * heroSprite.scaleY`), `flipX`, `origin` (`0.22, 0.78` direita / `0.78, 0.78` esquerda) e rotação de idle/walk quando não estiver em swing.
     - `playAttackSwing(facingLeft: boolean): void` — tween rápido de corte (`180 ms`) girando a arma do alto para baixo e retornando.
     - `setVisible(visible: boolean)`, `setAlpha(alpha: number)`, `destroy(): void`.
2. **Integrar em `DungeonScene.ts`:**
   - Ajustar escala de `this.heroSprite` de `1.35` para **`0.88`**.
   - Instanciar `this.weaponRig = new HeroWeaponRig(this, this.heroSprite, this.inventory.equipped.weapon, this.heroSpriteKey === 'hero_wraith')`.
   - Em `recalculateHeroGear()`: chamar `this.weaponRig?.setEquippedWeapon(this.inventory.equipped.weapon, this.heroSpriteKey === 'hero_wraith')`.
   - Em `hero_basic_attack`: chamar `this.weaponRig?.playAttackSwing(this.heroSprite.flipX)`.
   - No `update()`: chamar `this.weaponRig?.sync(isMoving, time)`.
   - Na morte do herói / `SHUTDOWN`: limpar/ocultar `weaponRig` adequadamente.

## Restrições
- Não tocar em `HubScene.ts`, `BootScene.ts`, `src/core/` ou `git`.
- Validar com `npm run typecheck` e `npx vitest run tests/core/`.
