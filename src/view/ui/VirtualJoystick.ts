import Phaser from 'phaser';
import { Vector2D, ViewportConfig, resolveViewportConfig } from '../../core/index';

export class VirtualJoystick {
  private readonly scene: Phaser.Scene;
  private viewport: ViewportConfig;
  private baseGraphic: Phaser.GameObjects.Graphics;
  private thumbGraphic: Phaser.GameObjects.Graphics;

  private activePointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  private currentX = 0;
  private currentY = 0;
  private direction: Vector2D = { x: 0, y: 0 };

  private readonly maxRadius = 46;
  private readonly deadZone = 7;

  private readonly onPointerDownBound: (
    pointer: Phaser.Input.Pointer,
    currentlyOver?: Phaser.GameObjects.GameObject[]
  ) => void;
  private readonly onPointerMoveBound: (pointer: Phaser.Input.Pointer) => void;
  private readonly onPointerUpBound: (pointer: Phaser.Input.Pointer) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.viewport = resolveViewportConfig(scene.scale.width || 800, scene.scale.height || 600);

    const totalPointers = scene.input.manager?.pointersTotal ?? 2;
    if (totalPointers < 4) {
      scene.input.addPointer?.(4 - totalPointers);
    }

    this.baseGraphic = scene.add.graphics();
    this.baseGraphic.setScrollFactor(0);
    this.baseGraphic.setDepth(1000);

    this.thumbGraphic = scene.add.graphics();
    this.thumbGraphic.setScrollFactor(0);
    this.thumbGraphic.setDepth(1001);

    this.onPointerDownBound = (
      pointer: Phaser.Input.Pointer,
      currentlyOver?: Phaser.GameObjects.GameObject[]
    ) => this.handlePointerDown(pointer, currentlyOver);
    this.onPointerMoveBound = (pointer: Phaser.Input.Pointer) => this.handlePointerMove(pointer);
    this.onPointerUpBound = (pointer: Phaser.Input.Pointer) => this.handlePointerUp(pointer);

    scene.input.on('pointerdown', this.onPointerDownBound);
    scene.input.on('pointermove', this.onPointerMoveBound);
    scene.input.on('pointerup', this.onPointerUpBound);
    scene.input.on('pointerupoutside', this.onPointerUpBound);
    scene.input.on('pointercancel', this.onPointerUpBound);

    this.resetRestingPosition();
    this.render();
  }

  public getDirection(): Vector2D {
    this.syncActivePointer();
    return { x: this.direction.x, y: this.direction.y };
  }

  public resize(viewport: ViewportConfig): void {
    this.viewport = viewport;
    if (this.activePointerId === null) {
      this.resetRestingPosition();
    }
    this.render();
  }

  public destroy(): void {
    this.scene.input.off('pointerdown', this.onPointerDownBound);
    this.scene.input.off('pointermove', this.onPointerMoveBound);
    this.scene.input.off('pointerup', this.onPointerUpBound);
    this.scene.input.off('pointerupoutside', this.onPointerUpBound);
    this.scene.input.off('pointercancel', this.onPointerUpBound);

    this.baseGraphic.destroy();
    this.thumbGraphic.destroy();
  }

  private resetRestingPosition(): void {
    if (this.viewport.mode === 'mobile_portrait') {
      this.originX = 72;
      this.originY = this.viewport.height - 92;
    } else {
      this.originX = 88;
      this.originY = this.viewport.height - 88;
    }
    this.currentX = this.originX;
    this.currentY = this.originY;
  }

  private isEligibleTouchZone(x: number, y: number): boolean {
    const w = this.viewport.width;
    const h = this.viewport.height;

    if (this.viewport.mode === 'mobile_portrait') {
      const inTopLeftHero = x < 204 && y < 100;
      const inTopRightHud = x > w - 164 && y < 120;
      const inActionCluster = x > w * 0.5 && y > h - 200;
      return !inTopLeftHero && !inTopRightHud && !inActionCluster;
    }

    const inTopLeftHeroDesktop = x < 260 && y < 118;
    const inTopRightHudDesktop = x > w - 210 && y < 145;
    const inActionClusterDesktop = x > w - 210 && y > h - 210;
    if (inTopLeftHeroDesktop || inTopRightHudDesktop || inActionClusterDesktop) {
      return false;
    }

    return x <= w * 0.55 || y >= h * 0.45;
  }

  private syncActivePointer(): void {
    if (this.activePointerId === null) {
      return;
    }

    const pointers = this.scene.input.manager?.pointers;
    if (!pointers || pointers.length === 0) {
      return;
    }

    const active = pointers.find((p) => p.id === this.activePointerId);
    if (!active || !active.isDown) {
      this.releasePointer();
    }
  }

  private handlePointerDown(
    pointer: Phaser.Input.Pointer,
    currentlyOver?: Phaser.GameObjects.GameObject[]
  ): void {
    this.syncActivePointer();

    if (currentlyOver && currentlyOver.length > 0) {
      return;
    }

    if (!this.isEligibleTouchZone(pointer.x, pointer.y)) {
      return;
    }

    if (this.activePointerId !== null && this.activePointerId !== pointer.id) {
      return;
    }

    this.activePointerId = pointer.id;
    this.originX = pointer.x;
    this.originY = pointer.y;
    this.currentX = pointer.x;
    this.currentY = pointer.y;
    this.updateDirection();
    this.render();
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.activePointerId === null || pointer.id !== this.activePointerId) {
      return;
    }

    if (!pointer.isDown) {
      this.releasePointer();
      return;
    }

    const dx = pointer.x - this.originX;
    const dy = pointer.y - this.originY;
    const distance = Math.hypot(dx, dy);

    if (distance > this.maxRadius) {
      const ratio = this.maxRadius / distance;
      this.currentX = this.originX + dx * ratio;
      this.currentY = this.originY + dy * ratio;
    } else {
      this.currentX = pointer.x;
      this.currentY = pointer.y;
    }

    this.updateDirection();
    this.render();
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.activePointerId !== null && pointer.id === this.activePointerId) {
      this.releasePointer();
      return;
    }

    this.syncActivePointer();
  }

  private releasePointer(): void {
    this.activePointerId = null;
    this.direction = { x: 0, y: 0 };
    this.resetRestingPosition();
    this.render();
  }

  private updateDirection(): void {
    const dx = this.currentX - this.originX;
    const dy = this.currentY - this.originY;
    const distance = Math.hypot(dx, dy);

    if (distance < this.deadZone) {
      this.direction = { x: 0, y: 0 };
      return;
    }

    this.direction = {
      x: dx / distance,
      y: dy / distance,
    };
  }

  private render(): void {
    const isActive = this.activePointerId !== null;
    const isMobile = this.viewport.mode === 'mobile_portrait';
    const baseFillAlpha = isActive ? 0.52 : isMobile ? 0.34 : 0.22;
    const ringAlpha = isActive ? 0.85 : isMobile ? 0.52 : 0.34;
    const innerRingRadius = Math.round(this.maxRadius * 0.54);

    // Outer dark fantasy metallic circular D-pad base
    this.baseGraphic.clear();
    this.baseGraphic.fillStyle(0x090b10, baseFillAlpha);
    this.baseGraphic.fillCircle(this.originX, this.originY, this.maxRadius);

    // Subtle dark metallic bevel rings
    this.baseGraphic.lineStyle(2, isActive ? 0xc9a25e : 0x7c7468, ringAlpha);
    this.baseGraphic.strokeCircle(this.originX, this.originY, this.maxRadius);
    this.baseGraphic.lineStyle(1, isActive ? 0x38bdf8 : 0x475569, ringAlpha * 0.72);
    this.baseGraphic.strokeCircle(this.originX, this.originY, this.maxRadius - 3);

    // Inner guide ring
    this.baseGraphic.lineStyle(1, isActive ? 0x67e8f9 : 0x64748b, ringAlpha * 0.58);
    this.baseGraphic.strokeCircle(this.originX, this.originY, innerRingRadius);

    // 4 directional cardinal arrows (N / S / E / W)
    const arrowDist = this.maxRadius - 10;
    const arrowTipOffset = 5;
    const arrowHalfBase = 4.2;
    const dirs: ReadonlyArray<{
      dx: number;
      dy: number;
      active: boolean;
    }> = [
      { dx: 0, dy: -1, active: isActive && this.direction.y < -0.35 }, // N
      { dx: 0, dy: 1, active: isActive && this.direction.y > 0.35 }, // S
      { dx: 1, dy: 0, active: isActive && this.direction.x > 0.35 }, // E
      { dx: -1, dy: 0, active: isActive && this.direction.x < -0.35 }, // W
    ];

    for (const dir of dirs) {
      const cx = this.originX + dir.dx * arrowDist;
      const cy = this.originY + dir.dy * arrowDist;
      const tipX = cx + dir.dx * arrowTipOffset;
      const tipY = cy + dir.dy * arrowTipOffset;
      const baseX = cx - dir.dx * 2.5;
      const baseY = cy - dir.dy * 2.5;
      const perpX = -dir.dy * arrowHalfBase;
      const perpY = dir.dx * arrowHalfBase;

      const arrowColor = dir.active ? 0x67e8f9 : 0x9ca3af;
      const arrowAlpha = dir.active ? 0.92 : ringAlpha * 0.75;
      this.baseGraphic.fillStyle(arrowColor, arrowAlpha);
      this.baseGraphic.fillTriangle(
        tipX,
        tipY,
        baseX + perpX,
        baseY + perpY,
        baseX - perpX,
        baseY - perpY
      );
    }

    // Translucent metallic/spectral thumbstick
    const thumbRadius = 18;
    const thumbAlpha = isActive ? 0.88 : isMobile ? 0.46 : 0.3;
    this.thumbGraphic.clear();

    if (isActive) {
      // Soft spectral cyan halo when actively dragging
      this.thumbGraphic.fillStyle(0x38bdf8, 0.2);
      this.thumbGraphic.fillCircle(this.currentX, this.currentY, thumbRadius + 5);
    }

    this.thumbGraphic.fillStyle(isActive ? 0x162436 : 0x1e2430, thumbAlpha);
    this.thumbGraphic.fillCircle(this.currentX, this.currentY, thumbRadius);

    // Metallic rim + inner specular highlight
    this.thumbGraphic.lineStyle(2, isActive ? 0x67e8f9 : 0x94a3b8, thumbAlpha);
    this.thumbGraphic.strokeCircle(this.currentX, this.currentY, thumbRadius);
    this.thumbGraphic.fillStyle(isActive ? 0xbae6fd : 0xcbd5e1, thumbAlpha * 0.35);
    this.thumbGraphic.fillCircle(this.currentX - 4, this.currentY - 4, 6);
  }
}
