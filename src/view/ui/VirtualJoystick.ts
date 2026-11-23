import Phaser from 'phaser';
import { Vector2D, ViewportConfig, resolveViewportConfig } from '../../core/index';
import { DF_PALETTE } from './DarkFantasyUiBuilder';

export class VirtualJoystick {
  private readonly scene: Phaser.Scene;
  private viewport: ViewportConfig;
  private readonly baseGraphic: Phaser.GameObjects.Graphics;
  private readonly thumbGraphic: Phaser.GameObjects.Graphics;

  private activePointerId: number | null = null;
  private originX = 104;
  private originY = 436;
  private currentX = 104;
  private currentY = 436;
  private direction: Vector2D = { x: 0, y: 0 };

  private readonly maxRadius = 54;
  private readonly thumbRadius = 18;
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
    this.originX = 104;
    this.originY = this.viewport.height - 104;
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
    const outerR = this.maxRadius;
    const innerRingRadius = Math.round(outerR * 0.44);
    const baseFillAlpha = isActive ? 0.42 : 0.24;
    const outerRingAlpha = isActive ? 0.68 : 0.34;
    const innerRingAlpha = isActive ? 0.44 : 0.2;

    // Translucent dark circular D-Pad base (matching ref_landscape_hud.jpg)
    this.baseGraphic.clear();

    if (isActive) {
      this.baseGraphic.fillStyle(DF_PALETTE.agedGold, 0.08);
      this.baseGraphic.fillCircle(this.originX, this.originY, outerR + 4);
    }

    this.baseGraphic.fillStyle(0x0a0d14, baseFillAlpha);
    this.baseGraphic.fillCircle(this.originX, this.originY, outerR);

    // Subtle thin light translucent outer ring + hairline inner bevel
    this.baseGraphic.lineStyle(
      1.3,
      isActive ? DF_PALETTE.goldBright : 0xd6dce6,
      outerRingAlpha
    );
    this.baseGraphic.strokeCircle(this.originX, this.originY, outerR);
    this.baseGraphic.lineStyle(1, 0x94a3b8, outerRingAlpha * 0.38);
    this.baseGraphic.strokeCircle(this.originX, this.originY, outerR - 2.5);

    // Subtle 4-way directional pad recesses between inner ring and outer rim
    const padColor = isActive ? 0x161c28 : 0x111520;
    const padFillAlpha = isActive ? 0.38 : 0.24;
    const padBorderAlpha = isActive ? 0.34 : 0.16;
    const padLong = 24;
    const padShort = 21;
    const padOffset = 37;
    const padRects = [
      { x: -padShort / 2, y: -padOffset - padLong / 2, w: padShort, h: padLong },
      { x: -padShort / 2, y: padOffset - padLong / 2, w: padShort, h: padLong },
      { x: -padOffset - padLong / 2, y: -padShort / 2, w: padLong, h: padShort },
      { x: padOffset - padLong / 2, y: -padShort / 2, w: padLong, h: padShort },
    ];
    for (const rect of padRects) {
      this.baseGraphic.fillStyle(padColor, padFillAlpha);
      this.baseGraphic.fillRoundedRect(
        this.originX + rect.x,
        this.originY + rect.y,
        rect.w,
        rect.h,
        5
      );
      this.baseGraphic.lineStyle(1, 0xcbd5e1, padBorderAlpha);
      this.baseGraphic.strokeRoundedRect(
        this.originX + rect.x,
        this.originY + rect.y,
        rect.w,
        rect.h,
        5
      );
    }

    // Subtle inner guide ring
    this.baseGraphic.lineStyle(
      1,
      isActive ? DF_PALETTE.agedGold : 0xcbd5e1,
      innerRingAlpha
    );
    this.baseGraphic.strokeCircle(this.originX, this.originY, innerRingRadius);

    // 4 subtle triangular directional arrows (Up, Down, Right, Left)
    const arrowDist = 37;
    const arrowTipOffset = 4.5;
    const arrowBackOffset = 3;
    const arrowHalfBase = 4.4;
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
      const baseX = cx - dir.dx * arrowBackOffset;
      const baseY = cy - dir.dy * arrowBackOffset;
      const perpX = -dir.dy * arrowHalfBase;
      const perpY = dir.dx * arrowHalfBase;

      const arrowColor = dir.active ? DF_PALETTE.goldBright : 0xcbd5e1;
      const arrowAlpha = dir.active ? 0.94 : isActive ? 0.56 : 0.38;
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

    // Translucent central circular thumbstick knob (r = 18)
    const knobR = this.thumbRadius;
    const thumbFillAlpha = isActive ? 0.68 : 0.36;
    const thumbRimAlpha = isActive ? 0.88 : 0.42;
    this.thumbGraphic.clear();

    if (isActive) {
      this.thumbGraphic.fillStyle(DF_PALETTE.agedGold, 0.14);
      this.thumbGraphic.fillCircle(this.currentX, this.currentY, knobR + 5);
    }

    this.thumbGraphic.fillStyle(
      isActive ? 0x1e2534 : 0x141924,
      thumbFillAlpha
    );
    this.thumbGraphic.fillCircle(this.currentX, this.currentY, knobR);

    this.thumbGraphic.lineStyle(
      1.4,
      isActive ? DF_PALETTE.goldBright : 0xe2e8f0,
      thumbRimAlpha
    );
    this.thumbGraphic.strokeCircle(this.currentX, this.currentY, knobR);

    this.thumbGraphic.lineStyle(
      1,
      isActive ? DF_PALETTE.agedGold : 0x94a3b8,
      thumbRimAlpha * 0.42
    );
    this.thumbGraphic.strokeCircle(this.currentX, this.currentY, knobR - 3.5);

    // Subtle soft highlight inside central button
    this.thumbGraphic.fillStyle(
      isActive ? DF_PALETTE.goldBright : 0xe2e8f0,
      thumbRimAlpha * 0.24
    );
    this.thumbGraphic.fillCircle(this.currentX - 4, this.currentY - 4, 4.8);
  }
}
