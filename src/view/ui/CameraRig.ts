import Phaser from 'phaser';

export interface CameraRigOptions {
  width: number;
  height: number;
  worldZoom: number;
  boundsWidth: number;
  boundsHeight: number;
  uiDepthThreshold?: number;
}

type DepthAwareGameObject = Phaser.GameObjects.GameObject & {
  depth?: number;
  cameraFilter: number;
};

export class SceneCameraRig {
  private readonly scene: Phaser.Scene;
  private readonly worldCamera: Phaser.Cameras.Scene2D.Camera;
  private uiCamera?: Phaser.Cameras.Scene2D.Camera;
  private readonly uiDepthThreshold: number;
  private destroyed = false;

  constructor(scene: Phaser.Scene, options: CameraRigOptions) {
    this.scene = scene;
    this.uiDepthThreshold = options.uiDepthThreshold ?? 50;

    this.worldCamera = scene.cameras.main;
    this.worldCamera.setSize(options.width, options.height);
    this.worldCamera.setZoom(options.worldZoom);
    this.worldCamera.setBounds(0, 0, options.boundsWidth, options.boundsHeight);
    this.worldCamera.roundPixels = true;

    this.uiCamera = scene.cameras.add(
      0,
      0,
      options.width,
      options.height,
      false,
      'uiCamera'
    );
    this.uiCamera.setZoom(1);
    this.uiCamera.setScroll(0, 0);
    this.uiCamera.setBackgroundColor('rgba(0,0,0,0)');
  }

  public follow(target: Phaser.GameObjects.GameObject): void {
    if (this.destroyed) {
      return;
    }
    this.worldCamera.startFollow(target, true, 0.14, 0.14);
  }

  public resize(
    width: number,
    height: number,
    worldZoom: number,
    boundsWidth: number,
    boundsHeight: number
  ): void {
    if (this.destroyed) {
      return;
    }
    this.worldCamera.setSize(width, height);
    this.worldCamera.setZoom(worldZoom);
    this.worldCamera.setBounds(0, 0, boundsWidth, boundsHeight);
    this.uiCamera?.setSize(width, height);
  }

  public syncLayers(): void {
    if (this.destroyed || !this.uiCamera) {
      return;
    }

    const worldCamId = this.worldCamera.id;
    const uiCamId = this.uiCamera.id;
    const children = this.scene.children.list;

    for (let i = 0; i < children.length; i++) {
      const obj = children[i] as DepthAwareGameObject;
      const depth = typeof obj.depth === 'number' ? obj.depth : 0;

      if (depth >= this.uiDepthThreshold) {
        const nextFilter = (obj.cameraFilter | worldCamId) & ~uiCamId;
        if (obj.cameraFilter !== nextFilter) {
          obj.cameraFilter = nextFilter;
        }
      } else {
        const nextFilter = (obj.cameraFilter | uiCamId) & ~worldCamId;
        if (obj.cameraFilter !== nextFilter) {
          obj.cameraFilter = nextFilter;
        }
      }
    }
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    if (this.uiCamera && this.scene.cameras) {
      this.scene.cameras.remove(this.uiCamera);
      this.uiCamera = undefined;
    }
  }
}
