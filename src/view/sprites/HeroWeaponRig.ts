import Phaser from 'phaser';
import type { ItemInstance } from '../../core';

export type WeaponVisualFrame = 0 | 1 | 2 | 3;

export function resolveWeaponFrame(
  equippedWeapon: ItemInstance | null,
  isWraith: boolean
): WeaponVisualFrame {
  if (equippedWeapon) {
    const hasInfernoAffix = equippedWeapon.affixes.some(
      (affix) => affix.force === 'inferno'
    );
    const hasInfernoPower =
      equippedWeapon.legendaryPower?.id.startsWith('inferno_') ?? false;
    if (hasInfernoAffix || hasInfernoPower) {
      return 2;
    }

    const hasSubmundoAffix = equippedWeapon.affixes.some(
      (affix) => affix.force === 'submundo'
    );
    const hasSubmundoPower =
      equippedWeapon.legendaryPower?.id.startsWith('submundo_') ?? false;
    if (hasSubmundoAffix || hasSubmundoPower) {
      return 3;
    }

    const hasEmpireoAffix = equippedWeapon.affixes.some(
      (affix) => affix.force === 'empireo'
    );
    const hasEmpireoPower =
      equippedWeapon.legendaryPower?.id.startsWith('empireo_') ?? false;
    if (
      hasEmpireoAffix ||
      hasEmpireoPower ||
      equippedWeapon.rarity === 'rare' ||
      equippedWeapon.rarity === 'legendary'
    ) {
      return 1;
    }
  }

  return isWraith ? 1 : 0;
}

export class HeroWeaponRig {
  private readonly scene: Phaser.Scene;
  private readonly heroSprite: Phaser.GameObjects.Sprite;
  private weaponSprite?: Phaser.GameObjects.Sprite;
  private swingTween?: Phaser.Tweens.Tween;
  private isSwinging = false;

  constructor(
    scene: Phaser.Scene,
    heroSprite: Phaser.GameObjects.Sprite,
    equippedWeapon: ItemInstance | null,
    isWraith: boolean
  ) {
    this.scene = scene;
    this.heroSprite = heroSprite;

    if (scene.textures.exists('weapons')) {
      const frame = resolveWeaponFrame(equippedWeapon, isWraith);
      this.weaponSprite = scene.add
        .sprite(heroSprite.x, heroSprite.y, 'weapons', frame)
        .setDepth(heroSprite.depth + 1)
        .setScale(heroSprite.scaleX * 0.68)
        .setOrigin(heroSprite.flipX ? 0.78 : 0.22, 0.78);
    }

    this.sync(false, 0);
  }

  public setEquippedWeapon(
    equippedWeapon: ItemInstance | null,
    isWraith: boolean
  ): void {
    if (!this.weaponSprite || !this.weaponSprite.scene) {
      return;
    }
    this.weaponSprite.setFrame(resolveWeaponFrame(equippedWeapon, isWraith));
  }

  public sync(isMoving: boolean, timeMs: number): void {
    if (!this.weaponSprite || !this.weaponSprite.scene) {
      return;
    }

    const flipX = this.heroSprite.flipX;
    const bob = isMoving
      ? Math.sin(timeMs * 0.015) * 1.8
      : Math.sin(timeMs * 0.004) * 0.8;

    const handOffsetX = (flipX ? -13 : 13) * this.heroSprite.scaleX;
    const handOffsetY = (-3 + bob) * this.heroSprite.scaleY;

    this.weaponSprite.setPosition(
      this.heroSprite.x + handOffsetX,
      this.heroSprite.y + handOffsetY
    );
    this.weaponSprite.setFlipX(flipX);
    this.weaponSprite.setOrigin(flipX ? 0.78 : 0.22, 0.78);
    this.weaponSprite.setScale(this.heroSprite.scaleX * 0.68);
    this.weaponSprite.setDepth(this.heroSprite.depth + 1);

    if (!this.isSwinging) {
      const baseAngle = isMoving
        ? 0.14 + Math.sin(timeMs * 0.015) * 0.1
        : 0.06 + Math.sin(timeMs * 0.004) * 0.04;
      this.weaponSprite.setRotation(flipX ? -baseAngle : baseAngle);
    }
  }

  public playAttackSwing(facingLeft: boolean): void {
    if (!this.weaponSprite || !this.weaponSprite.scene) {
      return;
    }

    if (this.swingTween) {
      this.swingTween.stop();
      this.swingTween = undefined;
    }

    this.isSwinging = true;
    const startAngle = facingLeft ? 0.95 : -0.95;
    const endAngle = facingLeft ? -1.15 : 1.15;

    this.weaponSprite.setRotation(startAngle);
    this.swingTween = this.scene.tweens.add({
      targets: this.weaponSprite,
      rotation: endAngle,
      duration: 90,
      ease: 'Cubic.easeOut',
      yoyo: true,
      onComplete: () => {
        this.isSwinging = false;
        this.swingTween = undefined;
      },
      onStop: () => {
        this.isSwinging = false;
        this.swingTween = undefined;
      },
    });
  }

  public setVisible(visible: boolean): void {
    if (!this.weaponSprite || !this.weaponSprite.scene) {
      return;
    }
    this.weaponSprite.setVisible(visible);
  }

  public setAlpha(alpha: number): void {
    if (!this.weaponSprite || !this.weaponSprite.scene) {
      return;
    }
    this.weaponSprite.setAlpha(alpha);
  }

  public destroy(): void {
    if (this.swingTween) {
      this.swingTween.stop();
      this.swingTween = undefined;
    }
    this.isSwinging = false;
    if (this.weaponSprite) {
      this.weaponSprite.destroy();
      this.weaponSprite = undefined;
    }
  }
}
