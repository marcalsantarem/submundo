import Phaser from 'phaser';
import { Vector2D, ViewportConfig, resolveViewportConfig } from '../../core/index';

export class VirtualJoystick {
  private readonly scene: Phaser.Scene;
  private viewport: ViewportConfig;
  private baseGraphic: Phaser.GameObjects.Graphics;
  private thumbGraphic: Phaser.GameObjects.Graphics;
  private hintText: Phaser.GameObjects.Text;

  private activePointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  private currentX = 0;
  private currentY = 0;
  private direction: Vector2D = { x: 0, y: 0 };

  private readonly maxRadius = 46;
  private readonly deadZone = 7;

  private readonly onPointerDownBound: (pointer: Phaser.Input.Pointer) => void;
  private readonly onPointerMoveBound: (pointer: Phaser.Input.Pointer) => void;
  private readonly onPointerUpBound: (pointer: Phaser.Input.Pointer) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.viewport = resolveViewportConfig(scene.scale.width || 800, scene.scale.height || 600);

    this.baseGraphic = scene.add.graphics();
    this.baseGraphic.setScrollFactor(0);
    this.baseGraphic.setDepth(1000);

    this.thumbGraphic = scene.add.graphics();
    this.thumbGraphic.setScrollFactor(0);
    this.thumbGraphic.setDepth(1001);

    this.hintText = scene.add
      .text(0, 0, 'MOVER', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#9aa5b1',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(1001);

    this.onPointerDownBound = (pointer: Phaser.Input.Pointer) => this.handlePointerDown(pointer);
    this.onPointerMoveBound = (pointer: Phaser.Input.Pointer) => this.handlePointerMove(pointer);
    this.onPointerUpBound = (pointer: Phaser.Input.Pointer) => this.handlePointerUp(pointer);

    scene.input.on('pointerdown', this.onPointerDownBound);
    scene.input.on('pointermove', this.onPointerMoveBound);
    scene.input.on('pointerup', this.onPointerUpBound);
    scene.input.on('pointerupoutside', this.onPointerUpBound);

    this.resetRestingPosition();
    this.render();
  }

  public getDirection(): Vector2D {
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

    this.baseGraphic.destroy();
    this.thumbGraphic.destroy();
    this.hintText.destroy();
  }

  private resetRestingPosition(): void {
    if (this.viewport.mode === 'mobile_portrait') {
      this.originX = 82;
      this.originY = this.viewport.height - 108;
    } else {
      this.originX = 96;
      this.originY = this.viewport.height - 96;
    }
    this.currentX = this.originX;
    this.currentY = this.originY;
  }

  private isEligibleTouchZone(x: number, y: number): boolean {
    if (this.viewport.mode === 'mobile_portrait') {
      const inTopHeader = y < 68;
      const inActionCluster = x > this.viewport.width * 0.52 && y > this.viewport.height - 210;
      return !inTopHeader && !inActionCluster;
    }

    const inActionClusterDesktop =
      x > this.viewport.width - 300 && y > this.viewport.height - 140;
    if (inActionClusterDesktop) {
      return false;
    }

    return x <= this.viewport.width * 0.55 || y >= this.viewport.height * 0.45;
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.activePointerId !== null) {
      return;
    }

    if (!this.isEligibleTouchZone(pointer.x, pointer.y)) {
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
    }
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
    const baseAlpha = isActive ? 0.55 : this.viewport.mode === 'mobile_portrait' ? 0.32 : 0.22;
    const thumbAlpha = isActive ? 0.85 : this.viewport.mode === 'mobile_portrait' ? 0.48 : 0.32;

    this.baseGraphic.clear();
    this.baseGraphic.fillStyle(0x0b0f19, baseAlpha);
    this.baseGraphic.fillCircle(this.originX, this.originY, this.maxRadius);
    this.baseGraphic.lineStyle(2, 0x48cae4, baseAlpha + 0.15);
    this.baseGraphic.strokeCircle(this.originX, this.originY, this.maxRadius);

    this.thumbGraphic.clear();
    this.thumbGraphic.fillStyle(0x48cae4, thumbAlpha);
    this.thumbGraphic.fillCircle(this.currentX, this.currentY, 20);
    this.thumbGraphic.lineStyle(2, 0xe0fbfc, thumbAlpha);
    this.thumbGraphic.strokeCircle(this.currentX, this.currentY, 20);

    this.hintText.setPosition(this.originX, this.originY + this.maxRadius + 14);
    this.hintText.setAlpha(isActive ? 0 : 0.65);
  }
}
