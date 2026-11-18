import Phaser from 'phaser';
import type { ItemInstance } from '../../core';

export type WeaponVisualFrame = 0 | 1 | 2 | 3;

export interface HeroHandAnchor {
  readonly dx: number;
  readonly dy: number;
  readonly rot: number;
}

/**
 * Per-frame right-hand grip anchors matching the 24 frames (0..23) of
 * hero_living / hero_wraith in public/assets/sprites/manifest.json.
 */
export const HERO_HAND_ANCHORS: readonly HeroHandAnchor[] = [
  // idle (0..3)
  { dx: 15.0, dy: -7.5, rot: 0.06 },
  { dx: 15.0, dy: -8.3, rot: 0.03 },
  { dx: 15.0, dy: -9.1, rot: 0.0 },
  { dx: 15.0, dy: -8.2, rot: 0.03 },
  // walk (4..9)
  { dx: 17.5, dy: -6.5, rot: 0.22 },
  { dx: 14.5, dy: -4.0, rot: 0.14 },
  { dx: 11.5, dy: -6.0, rot: 0.04 },
  { dx: 10.5, dy: -4.5, rot: -0.05 },
  { dx: 12.5, dy: -3.5, rot: 0.04 },
  { dx: 15.5, dy: -6.5, rot: 0.16 },
  // attack (10..15)
  { dx: 12.5, dy: -23.0, rot: -1.22 },
  { dx: 23.5, dy: -14.5, rot: -0.32 },
  { dx: 31.0, dy: -4.5, rot: 1.05 },
  { dx: 25.5, dy: 6.5, rot: 1.52 },
  { dx: 19.5, dy: 0.0, rot: 0.72 },
  { dx: 16.0, dy: -5.5, rot: 0.22 },
  // dash (16..19)
  { dx: 10.5, dy: 0.5, rot: 0.45 },
  { dx: 19.0, dy: -4.0, rot: 0.85 },
  { dx: 21.5, dy: -2.5, rot: 1.08 },
  { dx: 14.5, dy: -5.0, rot: 0.26 },
  // hit (20..23)
  { dx: 9.0, dy: -12.5, rot: -0.65 },
  { dx: 6.0, dy: -7.5, rot: -0.38 },
  { dx: 11.0, dy: -4.5, rot: 0.14 },
  { dx: 14.0, dy: -6.5, rot: 0.08 },
] as const;

const WEAPON_BASE_SCALE_FACTOR = 0.68;
const ACTION_FRAME_START_INDEX = 10;

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
  private swingScaleMultiplier = 1;
  private swingGeneration = 0;

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
        .setScale(heroSprite.scaleX * WEAPON_BASE_SCALE_FACTOR)
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

    const frameIndex = this.resolveCurrentFrameIndex();
    const anchor = HERO_HAND_ANCHORS[frameIndex] ?? HERO_HAND_ANCHORS[0];
    const flipX = this.heroSprite.flipX;

    const handOffsetX = (flipX ? -anchor.dx : anchor.dx) * this.heroSprite.scaleX;
    const handOffsetY = anchor.dy * this.heroSprite.scaleY;

    this.weaponSprite.setPosition(
      this.heroSprite.x + handOffsetX,
      this.heroSprite.y + handOffsetY
    );
    this.weaponSprite.setFlipX(flipX);
    this.weaponSprite.setOrigin(flipX ? 0.78 : 0.22, 0.78);
    this.weaponSprite.setScale(
      this.heroSprite.scaleX * WEAPON_BASE_SCALE_FACTOR * this.swingScaleMultiplier
    );
    this.weaponSprite.setDepth(this.heroSprite.depth + 1);

    if (!this.isSwinging) {
      const isActionFrame = frameIndex >= ACTION_FRAME_START_INDEX;
      const microSway = isActionFrame
        ? 0
        : isMoving
          ? Math.sin(timeMs * 0.014) * 0.04
          : Math.sin(timeMs * 0.004) * 0.025;
      const targetRot = anchor.rot + microSway;
      this.weaponSprite.setRotation(flipX ? -targetRot : targetRot);
    }
  }

  public playAttackSwing(facingLeft: boolean, isSkill = false): void {
    if (!this.weaponSprite || !this.weaponSprite.scene) {
      return;
    }

    const generation = ++this.swingGeneration;
    const prevTween = this.swingTween;
    this.swingTween = undefined;
    if (prevTween) {
      prevTween.stop();
    }

    this.isSwinging = true;
    this.swingScaleMultiplier = 1;

    const startMag = isSkill ? 1.38 : 1.15;
    const endMag = isSkill ? 1.65 : 1.35;
    const startAngle = facingLeft ? startMag : -startMag;
    const endAngle = facingLeft ? -endMag : endMag;
    const peakScaleMult = isSkill ? 1.18 : 1;

    const swingState = {
      rotation: startAngle,
      scaleMult: 1,
    };

    this.weaponSprite.setRotation(startAngle);
    this.weaponSprite.setScale(
      this.heroSprite.scaleX * WEAPON_BASE_SCALE_FACTOR
    );

    const finishSwing = (): void => {
      if (this.swingGeneration !== generation) {
        return;
      }
      this.isSwinging = false;
      this.swingScaleMultiplier = 1;
      this.swingTween = undefined;
      if (this.weaponSprite && this.weaponSprite.scene) {
        this.weaponSprite.setScale(
          this.heroSprite.scaleX * WEAPON_BASE_SCALE_FACTOR
        );
      }
    };

    this.swingTween = this.scene.tweens.add({
      targets: swingState,
      rotation: endAngle,
      scaleMult: peakScaleMult,
      duration: isSkill ? 115 : 85,
      ease: 'Cubic.easeOut',
      yoyo: true,
      onUpdate: () => {
        if (this.swingGeneration !== generation) {
          return;
        }
        this.swingScaleMultiplier = swingState.scaleMult;
        if (this.weaponSprite && this.weaponSprite.scene) {
          this.weaponSprite.setRotation(swingState.rotation);
          this.weaponSprite.setScale(
            this.heroSprite.scaleX *
              WEAPON_BASE_SCALE_FACTOR *
              this.swingScaleMultiplier
          );
        }
      },
      onComplete: finishSwing,
      onStop: finishSwing,
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
    this.swingGeneration += 1;
    const activeTween = this.swingTween;
    this.swingTween = undefined;
    if (activeTween) {
      activeTween.stop();
    }
    this.isSwinging = false;
    this.swingScaleMultiplier = 1;
    if (this.weaponSprite) {
      this.weaponSprite.destroy();
      this.weaponSprite = undefined;
    }
  }

  private resolveCurrentFrameIndex(): number {
    const rawName = this.heroSprite.frame?.name;
    const parsed = Number(rawName);
    if (
      Number.isInteger(parsed) &&
      parsed >= 0 &&
      parsed < HERO_HAND_ANCHORS.length
    ) {
      return parsed;
    }
    return 0;
  }
}
