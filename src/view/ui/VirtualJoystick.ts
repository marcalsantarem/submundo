import Phaser from 'phaser';
import { Vector2D, ViewportConfig, resolveViewportConfig } from '../../core/index';
import { DF_PALETTE } from './DarkFantasyUiBuilder';

export class VirtualJoystick {
  private readonly scene: Phaser.Scene;
  private viewport: ViewportConfig;
  private readonly baseGraphic: Phaser.GameObjects.Graphics;
  private readonly thumbGraphic: Phaser.GameObjects.Graphics;

  private activePointerId: number | null = null;
  private originX = 96;
  private originY = 444;
  private currentX = 96;
  private currentY = 444;
  private direction: Vector2D = { x: 0, y: 0 };

  private readonly maxRadius = 46;
  private readonly thumbRadius = 20;
  private readonly deadZone = 7;

  private readonly onPointerDownBound: (
    pointer: Phaser.Input.Pointer,
    currentlyOver?: Phaser.GameObjects.GameObject[]
  ) => void;
  private readonly onPointerMoveBound: (pointer: Phaser.Input.Pointer) => void;
  private readonly onPointerUpBound: (pointer: Phaser.Input.Pointer) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.viewport = resolveViewportConfig(
      scene.scale.width || 960,
      scene.scale.height || 540
    );

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
    this.onPointerMoveBound = (pointer: Phaser.Input.Pointer) =>
      this.handlePointerMove(pointer);
    this.onPointerUpBound = (pointer: Phaser.Input.Pointer) =>
      this.handlePointerUp(pointer);

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
    this.originX = 96;
    this.originY = this.viewport.height - 96;
    this.currentX = this.originX;
    this.currentY = this.originY;
  }

  private isEligibleTouchZone(x: number, y: number): boolean {
    const w = this.viewport.width;
    const h = this.viewport.height;
    return x >= 0 && x <= w * 0.46 && y >= 90 && y <= h;
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
    const baseFillAlpha = isActive ? 0.56 : 0.28;
    const ringAlpha = isActive ? 0.9 : 0.46;
    const innerRingRadius = Math.round(this.maxRadius * 0.54);

    // Outer dark fantasy metallic circular base
    this.baseGraphic.clear();

    if (isActive) {
      this.baseGraphic.fillStyle(DF_PALETTE.agedGold, 0.12);
      this.baseGraphic.fillCircle(this.originX, this.originY, this.maxRadius + 5);
    }

    this.baseGraphic.fillStyle(DF_PALETTE.deepRecess, baseFillAlpha);
    this.baseGraphic.fillCircle(this.originX, this.originY, this.maxRadius);

    // Dark steel outer lip + bronze/gold metallic bevel ring
    this.baseGraphic.lineStyle(3, DF_PALETTE.metalDark, ringAlpha * 0.9);
    this.baseGraphic.strokeCircle(this.originX, this.originY, this.maxRadius + 1);
    this.baseGraphic.lineStyle(
      2,
      isActive ? DF_PALETTE.agedGold : DF_PALETTE.bronzeBorder,
      ringAlpha
    );
    this.baseGraphic.strokeCircle(this.originX, this.originY, this.maxRadius);
    this.baseGraphic.lineStyle(
      1,
      isActive ? DF_PALETTE.goldBright : DF_PALETTE.metalBorder,
      ringAlpha * 0.72
    );
    this.baseGraphic.strokeCircle(this.originX, this.originY, this.maxRadius - 3);

    // Inner guide ring
    this.baseGraphic.lineStyle(
      1,
      isActive ? DF_PALETTE.agedGold : DF_PALETTE.metalHighlight,
      ringAlpha * 0.52
    );
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
      { dx: 0, dy: -1, active: isActive && this.direction.y < -0.35 },
      { dx: 0, dy: 1, active: isActive && this.direction.y > 0.35 },
      { dx: 1, dy: 0, active: isActive && this.direction.x > 0.35 },
      { dx: -1, dy: 0, active: isActive && this.direction.x < -0.35 },
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

      const arrowColor = dir.active
        ? DF_PALETTE.goldBright
        : DF_PALETTE.metalHighlight;
      const arrowAlpha = dir.active ? 0.96 : ringAlpha * 0.72;
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

    // Translucent metallic thumbstick knob (r = 20)
    const knobR = this.thumbRadius;
    const thumbAlpha = isActive ? 0.92 : 0.4;
    this.thumbGraphic.clear();

    if (isActive) {
      this.thumbGraphic.fillStyle(DF_PALETTE.agedGold, 0.2);
      this.thumbGraphic.fillCircle(this.currentX, this.currentY, knobR + 6);
      this.thumbGraphic.fillStyle(DF_PALETTE.goldBright, 0.14);
      this.thumbGraphic.fillCircle(this.currentX, this.currentY, knobR + 2.5);
    }

    this.thumbGraphic.fillStyle(
      isActive ? DF_PALETTE.buttonIronFill : DF_PALETTE.innerSurface,
      thumbAlpha
    );
    this.thumbGraphic.fillCircle(this.currentX, this.currentY, knobR);

    // Metallic bronze/steel rim + inner recess + subtle highlight
    this.thumbGraphic.lineStyle(
      2.2,
      isActive ? DF_PALETTE.agedGold : DF_PALETTE.bronzeBorder,
      thumbAlpha
    );
    this.thumbGraphic.strokeCircle(this.currentX, this.currentY, knobR);
    this.thumbGraphic.lineStyle(1, DF_PALETTE.metalDark, thumbAlpha * 0.85);
    this.thumbGraphic.strokeCircle(this.currentX, this.currentY, knobR - 3);
    this.thumbGraphic.fillStyle(
      isActive ? DF_PALETTE.goldBright : DF_PALETTE.metalHighlight,
      thumbAlpha * 0.34
    );
    this.thumbGraphic.fillCircle(this.currentX - 4.5, this.currentY - 4.5, 6);
  }
}
