# BRF-060 — AG02 (UI): CameraRig com Zoom + Follow e Escala do Herói na HubScene (T-083a)

## Objetivo
Dar zoom na câmera do mundo (`cameras.main`) seguindo o Herói e ajustar a escala do Herói (`1.35`) na `HubScene.ts`, mantendo todo o HUD/modais/diálogos nítidos em `zoom = 1` via `uiCamera` separada (`SceneCameraRig`), para aproximar a perspectiva do `mockup_pixel_art.jpg`.

## Arquivos sob sua posse
- `src/view/ui/CameraRig.ts` (novo)
- `src/view/scenes/HubScene.ts`

## Requisitos Técnicos
1. **Criar `src/view/ui/CameraRig.ts`:**
   - Exportar:
     ```ts
     export interface CameraRigOptions {
       width: number;
       height: number;
       worldZoom: number;
       boundsWidth: number;
       boundsHeight: number;
       uiDepthThreshold?: number; // default 50
     }

     export class SceneCameraRig {
       constructor(scene: Phaser.Scene, options: CameraRigOptions)
       public follow(target: Phaser.GameObjects.GameObject): void
       public resize(width: number, height: number, worldZoom: number, boundsWidth: number, boundsHeight: number): void
       public syncLayers(): void
       public destroy(): void
     }
     ```
   - `cameras.main` é a `worldCamera`: `setZoom(worldZoom)`, `setBounds(0, 0, boundsWidth, boundsHeight)`, `roundPixels = true`.
   - `uiCamera = scene.cameras.add(0, 0, width, height, false, 'uiCamera')`: `setZoom(1)`, `setScroll(0, 0)`, `setBackgroundColor('rgba(0,0,0,0)')` (transparente, sem limpar o fundo).
   - `follow(target)`: chama `this.worldCamera.startFollow(target, true, 0.14, 0.14)`.
   - `syncLayers()`: percorre `this.scene.children.list`; para cada GameObject:
     - Se `depth >= uiDepthThreshold` (`50`): `this.worldCamera.ignore(obj)` e garante que `uiCamera` NÃO ignore (`obj.cameraFilter &= ~this.uiCamera.id`).
     - Se `depth < uiDepthThreshold`: `this.uiCamera.ignore(obj)` e garante que `worldCamera` NÃO ignore (`obj.cameraFilter &= ~this.worldCamera.id`).
     - Nota: faça bitmask direto ou use um `WeakSet` + checagem de mudança de `depth` para ser O(N) levíssimo a cada frame sem re-alocar arrays. (No Phaser 3, `camera.ignore(obj)` seta `obj.cameraFilter |= camera.id`.)
   - `resize(...)`: atualiza `worldCamera.setSize(width, height)`, `worldCamera.setZoom(worldZoom)`, `worldCamera.setBounds(0, 0, boundsWidth, boundsHeight)`, `uiCamera.setSize(width, height)`.
   - `destroy()`: remove `uiCamera` via `this.scene.cameras.remove(this.uiCamera)` se existir.
2. **Integrar na `HubScene.ts`:**
   - Ajustar `this.heroSprite.setScale(1.35)` (antes `1.1`).
   - Instanciar `this.cameraRig = new SceneCameraRig(this, { width: this.viewport.width, height: this.viewport.height, worldZoom: this.getWorldZoom(this.viewport.mode), boundsWidth: this.viewport.width, boundsHeight: this.viewport.height })`.
   - `getWorldZoom(mode)`: `mode === 'mobile_portrait' ? 1.45 : 1.65`.
   - Chamar `this.cameraRig.follow(this.heroSprite)` e `this.cameraRig.syncLayers()`.
   - No `update()`: chamar `this.cameraRig.syncLayers()`.
   - No `handleResize()` e `shutdown()`: chamar `this.cameraRig.resize(...)` e `this.cameraRig.destroy()`.

## Restrições
- Não tocar em `src/core/`, `DungeonScene.ts` ou `git`.
- Validar com `npm run typecheck` antes de responder.
