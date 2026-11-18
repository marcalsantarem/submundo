# BRF-065 — AG02 (UI): Integração 80×80 e HeroWeaponRig na HubScene (T-085c)

## Objetivo
Integrar o `HeroWeaponRig` e a nova escala `0.88` do sprite `80×80` na `HubScene.ts`, refletindo imediatamente a arma equipada no inventário/Ferreiro.

## Arquivos sob sua posse
- `src/view/scenes/HubScene.ts`

## Requisitos Técnicos
1. **Contrato de `src/view/sprites/HeroWeaponRig.ts` (criado em paralelo pelo AG01):**
   ```ts
   import { HeroWeaponRig } from '../sprites/HeroWeaponRig';
   // constructor(scene, heroSprite, equippedWeapon, isWraith)
   // setEquippedWeapon(equippedWeapon, isWraith), sync(isMoving, timeMs), setVisible(v), destroy()
   ```
2. **Alterações em `HubScene.ts`:**
   - Ajustar escala de `this.heroSprite` de `1.35` para **`0.88`** (em `create` e `rebuildPhaseScenario`).
   - Em `ensureRequiredFallbackTextures()`: atualizar fallbacks de `hero_living` e `hero_wraith` para `80×80` e adicionar fallback de `weapons` (`48×48`).
   - Instanciar `this.weaponRig = new HeroWeaponRig(this, this.heroSprite, this.profile.equipped.weapon, this.heroSpriteKey === 'hero_wraith')` em `create()`.
   - Em `refreshHeroFromProfile()` e `rebuildPhaseScenario()`: atualizar `this.weaponRig?.setEquippedWeapon(this.profile.equipped.weapon, this.heroSpriteKey === 'hero_wraith')`.
   - No `update()`: chamar `this.weaponRig?.sync(isMoving, time)`.
   - Em `cleanupScene()`: chamar `this.weaponRig?.destroy()`.

## Restrições
- Não tocar em `DungeonScene.ts`, `BootScene.ts`, `HeroWeaponRig.ts`, `src/core/` ou `git`.
- Validar com `npm run typecheck` (após `HeroWeaponRig.ts` existir).
