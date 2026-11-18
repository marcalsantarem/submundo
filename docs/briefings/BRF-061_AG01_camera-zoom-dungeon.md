# BRF-061 — AG01 (Gameplay): Zoom da Câmera + Follow e Escala do Herói na DungeonScene (T-083b)

## Objetivo
Integrar o `SceneCameraRig` na `DungeonScene.ts` para dar zoom na câmera do mundo seguindo o Herói e ajustar a escala do Herói (`1.35`), mantendo `DungeonHud`, banners e modais em `zoom = 1` na `uiCamera`, aproximando a perspectiva do `mockup_pixel_art.jpg`.

## Arquivos sob sua posse
- `src/view/scenes/DungeonScene.ts`

## Requisitos Técnicos
1. **Contrato de `src/view/ui/CameraRig.ts` (criado em paralelo pelo AG02):**
   ```ts
   import { SceneCameraRig } from '../ui/CameraRig';
   // constructor(scene: Phaser.Scene, options: { width: number; height: number; worldZoom: number; boundsWidth: number; boundsHeight: number; uiDepthThreshold?: number })
   // follow(target), resize(width, height, worldZoom, boundsWidth, boundsHeight), syncLayers(), destroy()
   ```
2. **Integrar na `DungeonScene.ts`:**
   - Ajustar `this.heroSprite.setScale(1.35)` (antes `1.1`).
   - Instanciar `this.cameraRig = new SceneCameraRig(this, { width: this.viewport.width, height: this.viewport.height, worldZoom: this.getWorldZoom(this.viewport.mode), boundsWidth: this.viewport.width, boundsHeight: this.viewport.height })`.
   - `getWorldZoom(mode)`: `mode === 'mobile_portrait' ? 1.45 : 1.65`.
   - Chamar `this.cameraRig.follow(this.heroSprite)` após criar/posicionar `this.heroSprite`.
   - No `update()`: chamar `this.cameraRig?.syncLayers()` para que todos os objetos de mundo (`depth < 50`, incluindo monstros, drops, partículas e textos flutuantes de dano do `CombatVfx`) fiquem na `worldCamera` com zoom e toda a UI (`depth >= 50`: `DungeonHud`, banners, `InventoryModal`, tela de vitória/derrota) fique fixa em `zoom = 1` na `uiCamera`.
   - Em `handleResize()` e `shutdown()`: chamar `this.cameraRig?.resize(...)` e `this.cameraRig?.destroy()`.
   - Garantir que `showTimedBanner` / overlays da `DungeonScene` tenham `depth >= 50` (conferir se já têm; se algum banner estiver `< 50`, subir para `90`).

## Restrições
- Não tocar em `src/core/`, `HubScene.ts`, `CameraRig.ts` ou `git`.
- Validar com `npm run typecheck` (após `CameraRig.ts` existir) e `npx vitest run tests/core/`.
