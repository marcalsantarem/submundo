import Phaser from 'phaser';
import type { ItemInstance } from '../../core';

export type WeaponVisualFrame = 0 | 1 | 2 | 3;

/**
 * Attack timeline contract (T-121). The body animation `hero_*_attack`
 * (frames 10..15) uses exactly these per-frame durations, and the weapon rig
 * drives its keyframes from the same timeline.
 * Frames: 10 anticipation, 11 swing, 12 impact, 13 follow-through,
 * 14-15 recovery back to guard.
 */
export const HERO_ATTACK_FRAME_DURATIONS_MS: readonly number[] = [
  90, 55, 65, 55, 50, 45,
];
/** Total duration of the basic attack (body + weapon), in ms. */
export const HERO_ATTACK_DURATION_MS = 360;
/** Instant of the blow (impact pose reached), counted from the start, in ms. */
export const HERO_ATTACK_IMPACT_MS = 145;
/** Skill attack reuses the same body animation, with a wider/heavier arc. */
export const HERO_SKILL_ATTACK_DURATION_MS = HERO_ATTACK_DURATION_MS;
export const HERO_SKILL_ATTACK_IMPACT_MS = HERO_ATTACK_IMPACT_MS;

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
  // attack (10..15): anticipation, swing, impact, follow-through, rec1, rec2
  { dx: 4.5, dy: -28.0, rot: -1.7 },
  { dx: 20.0, dy: -24.5, rot: -1.95 },
  { dx: 30.0, dy: -6.0, rot: 1.05 },
  { dx: 23.0, dy: 7.0, rot: 1.7 },
  { dx: 18.5, dy: 0.5, rot: 1.75 },
  { dx: 16.0, dy: -5.5, rot: 0.75 },
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
const WEAPON_ORIGIN_X = 0.22;
const WEAPON_ORIGIN_Y = 0.78;
/** Grip (origin) to blade tip in weapon texture pixels (48x48 frames, blade at -45deg). */
const WEAPON_BLADE_LENGTH_PX = 48;
const ACTION_FRAME_START_INDEX = 10;
const ATTACK_FRAME_START_INDEX = 10;
const ATTACK_FRAME_COUNT = 6;
const DASH_FRAME_START_INDEX = 16;

const ATTACK_FRAME_STARTS_MS: readonly number[] =
  HERO_ATTACK_FRAME_DURATIONS_MS.map((_, index) =>
    HERO_ATTACK_FRAME_DURATIONS_MS.slice(0, index).reduce((a, b) => a + b, 0)
  );

type EaseName = 'linear' | 'in' | 'out' | 'inOut';

interface RotationKey {
  readonly t: number;
  readonly rot: number;
  /** Easing used to arrive at this key from the previous one. */
  readonly ease: EaseName;
}

/**
 * Weapon rotation keyframes along the attack timeline (radians, facing right;
 * the blade points at rot - 45deg on screen). Starts on the anticipation
 * pose, coils back, whips through the overhead arc to reach the impact pose at
 * HERO_ATTACK_IMPACT_MS, follows through low and recovers to the idle guard.
 */
const ATTACK_ROTATION_KEYS: readonly RotationKey[] = [
  { t: 0, rot: -1.7, ease: 'linear' },
  { t: 80, rot: -2.02, ease: 'out' },
  { t: 90, rot: -1.95, ease: 'linear' },
  { t: HERO_ATTACK_IMPACT_MS, rot: 1.05, ease: 'in' },
  { t: 180, rot: 1.55, ease: 'out' },
  { t: 265, rot: 1.75, ease: 'out' },
  { t: 315, rot: 0.75, ease: 'inOut' },
  { t: HERO_ATTACK_DURATION_MS, rot: 0.06, ease: 'out' },
];

/** Skill swing: deeper coil and longer follow-through on the same timeline. */
const SKILL_ROTATION_BONUS_KEYS: readonly RotationKey[] = [
  { t: 0, rot: -0.15, ease: 'linear' },
  { t: 80, rot: -0.3, ease: 'out' },
  { t: HERO_ATTACK_IMPACT_MS, rot: 0, ease: 'in' },
  { t: 190, rot: 0.25, ease: 'out' },
  { t: 300, rot: 0.1, ease: 'inOut' },
  { t: HERO_ATTACK_DURATION_MS, rot: 0, ease: 'out' },
];

/** How far (0..1) the grip leads toward the next drawn hand inside a frame. */
const ATTACK_POSITION_LEAD = 0.2;
/** Fraction of the attack hand path applied on top of the walk pose. */
const WALK_SWING_OFFSET_SCALE_X = 0.15;
const WALK_SWING_OFFSET_SCALE_Y = 0.15;
/** Walking keeps the blade in front of the face during the wind-up. */
const WALK_COIL_LIMIT_ROT = -0.5;
const WALK_COIL_COMPRESSION = 0.15;
/** Fade-in of the swing over the walk pose (no body frame to snap with). */
const WALK_SWING_BLEND_IN_MS = 40;
/** Smooth hand-off from the attack pose back to idle/walk. */
const SWING_RETURN_BLEND_MS = 80;

const SMEAR_START_MS = 112;
const SMEAR_END_MS = 190;
const SMEAR_WINDOW_MS = 30;
const SMEAR_SAMPLES = 9;
const SMEAR_COLORS: Record<WeaponVisualFrame, number> = {
  0: 0xe2e8f0,
  1: 0x67e8f9,
  2: 0xfb923c,
  3: 0xf87171,
};

interface LocalPose {
  dx: number;
  dy: number;
  rot: number;
}

function applyEase(ease: EaseName, p: number): number {
  switch (ease) {
    case 'in':
      return p * p;
    case 'out':
      return 1 - (1 - p) * (1 - p);
    case 'inOut':
      return p * p * (3 - 2 * p);
    default:
      return p;
  }
}

function sampleKeys(keys: readonly RotationKey[], t: number): number {
  if (t <= keys[0].t) {
    return keys[0].rot;
  }
  for (let i = 1; i < keys.length; i += 1) {
    const next = keys[i];
    if (t <= next.t) {
      const prev = keys[i - 1];
      const span = Math.max(1, next.t - prev.t);
      return prev.rot + (next.rot - prev.rot) * applyEase(next.ease, (t - prev.t) / span);
    }
  }
  return keys[keys.length - 1].rot;
}

function attackFrameAt(t: number): number {
  let frame = 0;
  for (let i = 0; i < ATTACK_FRAME_COUNT; i += 1) {
    if (t >= ATTACK_FRAME_STARTS_MS[i]) {
      frame = i;
    }
  }
  return frame;
}

/** Weapon rotation (facing right) at time t of the attack timeline. */
export function sampleAttackRotation(t: number, isSkill = false): number {
  const base = sampleKeys(ATTACK_ROTATION_KEYS, t);
  return isSkill ? base + sampleKeys(SKILL_ROTATION_BONUS_KEYS, t) : base;
}

/**
 * Grip position (facing right, hero-local px) at time t: the hand drawn in the
 * current attack frame, leaning slightly toward the next frame's hand.
 */
export function sampleAttackGrip(t: number): { dx: number; dy: number } {
  const frame = attackFrameAt(t);
  const current = HERO_HAND_ANCHORS[ATTACK_FRAME_START_INDEX + frame];
  const next =
    frame < ATTACK_FRAME_COUNT - 1
      ? HERO_HAND_ANCHORS[ATTACK_FRAME_START_INDEX + frame + 1]
      : HERO_HAND_ANCHORS[0];
  const progress = Phaser.Math.Clamp(
    (t - ATTACK_FRAME_STARTS_MS[frame]) / HERO_ATTACK_FRAME_DURATIONS_MS[frame],
    0,
    1
  );
  const lead = ATTACK_POSITION_LEAD * progress * progress;
  return {
    dx: current.dx + (next.dx - current.dx) * lead,
    dy: current.dy + (next.dy - current.dy) * lead,
  };
}

/** Grip path interpolated across whole frames (used to trace the smear arc). */
function sampleContinuousGrip(t: number): { dx: number; dy: number } {
  const frame = attackFrameAt(t);
  const current = HERO_HAND_ANCHORS[ATTACK_FRAME_START_INDEX + frame];
  const next =
    frame < ATTACK_FRAME_COUNT - 1
      ? HERO_HAND_ANCHORS[ATTACK_FRAME_START_INDEX + frame + 1]
      : HERO_HAND_ANCHORS[0];
  const progress = Phaser.Math.Clamp(
    (t - ATTACK_FRAME_STARTS_MS[frame]) / HERO_ATTACK_FRAME_DURATIONS_MS[frame],
    0,
    1
  );
  return {
    dx: current.dx + (next.dx - current.dx) * progress,
    dy: current.dy + (next.dy - current.dy) * progress,
  };
}

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

/**
 * Attaches the weapon sprite to the hero's drawn hand.
 *
 * The attack swing is a single keyframed timeline (HERO_ATTACK_* constants):
 * while the body plays `hero_*_attack`, the rig reads the body's current frame
 * and in-frame progress, so blade and arm never drift apart. When the body is
 * not playing the attack (hero walking, decision #8), the rig runs the same
 * timeline on its own clock over the walk pose. The return to idle/walk is
 * blended over SWING_RETURN_BLEND_MS.
 */
export class HeroWeaponRig {
  private readonly scene: Phaser.Scene;
  private readonly heroSprite: Phaser.GameObjects.Sprite;
  private weaponSprite?: Phaser.GameObjects.Sprite;
  private smear?: Phaser.GameObjects.Graphics;
  private weaponFrame: WeaponVisualFrame = 0;
  private isSwinging = false;
  private swingIsSkill = false;
  private swingStartMs = 0;
  private releasePose?: LocalPose;
  private releaseStartMs = 0;
  private lastSwingPose?: LocalPose;
  private visible = true;

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
      this.weaponFrame = frame;
      this.weaponSprite = scene.add
        .sprite(heroSprite.x, heroSprite.y, 'weapons', frame)
        .setDepth(heroSprite.depth + 1)
        .setScale(heroSprite.scaleX * WEAPON_BASE_SCALE_FACTOR)
        .setOrigin(
          heroSprite.flipX ? 1 - WEAPON_ORIGIN_X : WEAPON_ORIGIN_X,
          WEAPON_ORIGIN_Y
        );
      this.smear = scene.add
        .graphics()
        .setDepth(heroSprite.depth + 0.9)
        .setBlendMode(Phaser.BlendModes.ADD);
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
    this.weaponFrame = resolveWeaponFrame(equippedWeapon, isWraith);
    this.weaponSprite.setFrame(this.weaponFrame);
  }

  public sync(isMoving: boolean, timeMs: number): void {
    if (!this.weaponSprite || !this.weaponSprite.scene) {
      return;
    }

    const now = this.scene.time.now;
    const frameIndex = this.resolveCurrentFrameIndex();
    const natural = this.resolveNaturalPose(frameIndex, isMoving, timeMs);
    const bodyAttackT = this.resolveBodyAttackTime(frameIndex);

    let pose: LocalPose = natural;
    let swingT: number | undefined;
    let bodyDriven = false;

    if (frameIndex >= DASH_FRAME_START_INDEX) {
      // Dash / hit take over the arm: drop any swing in progress.
      this.endSwing();
    } else if (bodyAttackT !== undefined) {
      // Body leads: follow its frame + in-frame progress exactly.
      if (!this.isSwinging) {
        this.isSwinging = true;
        this.swingIsSkill = false;
      }
      this.releasePose = undefined;
      this.swingStartMs = now - bodyAttackT;
      swingT = bodyAttackT;
      bodyDriven = true;
    } else if (this.isSwinging) {
      swingT = now - this.swingStartMs;
    }

    if (swingT !== undefined && swingT < HERO_ATTACK_DURATION_MS) {
      pose = this.computeSwingPose(swingT, bodyDriven, natural);
      this.lastSwingPose = pose;
    } else if (swingT !== undefined) {
      // Timeline finished: blend from the last swing pose into idle/walk.
      if (!this.releasePose) {
        this.releasePose =
          this.lastSwingPose ?? this.computeSwingPose(HERO_ATTACK_DURATION_MS, false, natural);
        this.releaseStartMs = now;
      }
      const w = Phaser.Math.Clamp((now - this.releaseStartMs) / SWING_RETURN_BLEND_MS, 0, 1);
      const eased = applyEase('inOut', w);
      pose = {
        dx: Phaser.Math.Linear(this.releasePose.dx, natural.dx, eased),
        dy: Phaser.Math.Linear(this.releasePose.dy, natural.dy, eased),
        rot: Phaser.Math.Linear(this.releasePose.rot, natural.rot, eased),
      };
      if (w >= 1) {
        this.endSwing();
      }
    }

    const scaleMult =
      swingT !== undefined && swingT < HERO_ATTACK_DURATION_MS
        ? this.resolveSwingScale(swingT)
        : 1;
    this.applyPose(pose, scaleMult);
    this.drawSmear(swingT, bodyDriven, natural);
  }

  public playAttackSwing(facingLeft: boolean, isSkill = false): void {
    if (!this.weaponSprite || !this.weaponSprite.scene) {
      return;
    }
    void facingLeft; // facing is read from the hero sprite on every sync
    this.isSwinging = true;
    this.swingIsSkill = isSkill;
    this.swingStartMs = this.scene.time.now;
    this.releasePose = undefined;
    this.lastSwingPose = undefined;
    this.sync(false, this.scene.time.now);
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
    if (this.weaponSprite && this.weaponSprite.scene) {
      this.weaponSprite.setVisible(visible);
    }
    if (this.smear && this.smear.scene) {
      this.smear.setVisible(visible);
    }
  }

  public setAlpha(alpha: number): void {
    if (this.weaponSprite && this.weaponSprite.scene) {
      this.weaponSprite.setAlpha(alpha);
    }
    if (this.smear && this.smear.scene) {
      this.smear.setAlpha(alpha);
    }
  }

  public destroy(): void {
    this.endSwing();
    if (this.weaponSprite) {
      this.weaponSprite.destroy();
      this.weaponSprite = undefined;
    }
    if (this.smear) {
      this.smear.destroy();
      this.smear = undefined;
    }
  }

  private endSwing(): void {
    this.isSwinging = false;
    this.swingIsSkill = false;
    this.releasePose = undefined;
    this.lastSwingPose = undefined;
  }

  private resolveNaturalPose(
    frameIndex: number,
    isMoving: boolean,
    timeMs: number
  ): LocalPose {
    const anchor = HERO_HAND_ANCHORS[frameIndex] ?? HERO_HAND_ANCHORS[0];
    const isActionFrame = frameIndex >= ACTION_FRAME_START_INDEX;
    const microSway = isActionFrame
      ? 0
      : isMoving
        ? Math.sin(timeMs * 0.014) * 0.04
        : Math.sin(timeMs * 0.004) * 0.025;
    return { dx: anchor.dx, dy: anchor.dy, rot: anchor.rot + microSway };
  }

  /** Time on the attack timeline derived from the body's attack frame, if any. */
  private resolveBodyAttackTime(frameIndex: number): number | undefined {
    const local = frameIndex - ATTACK_FRAME_START_INDEX;
    if (local < 0 || local >= ATTACK_FRAME_COUNT) {
      return undefined;
    }
    const anims = this.heroSprite.anims;
    const duration = HERO_ATTACK_FRAME_DURATIONS_MS[local];
    let progress = 1;
    if (anims?.isPlaying) {
      const tick = anims.nextTick > 0 ? anims.nextTick : duration;
      progress = Phaser.Math.Clamp(anims.accumulator / tick, 0, 1);
    }
    return ATTACK_FRAME_STARTS_MS[local] + progress * duration;
  }

  private computeSwingPose(
    t: number,
    bodyDriven: boolean,
    natural: LocalPose
  ): LocalPose {
    const grip = sampleAttackGrip(t);
    const rot = sampleAttackRotation(t, this.swingIsSkill);
    if (bodyDriven) {
      return { dx: grip.dx, dy: grip.dy, rot };
    }

    // Walking: the legs keep the walk cycle, the arm follows a scaled-down
    // version of the attack hand path around the walk grip.
    const guard = HERO_HAND_ANCHORS[0];
    const blendIn = applyEase('out', Phaser.Math.Clamp(t / WALK_SWING_BLEND_IN_MS, 0, 1));
    const kx = WALK_SWING_OFFSET_SCALE_X * blendIn;
    const ky = WALK_SWING_OFFSET_SCALE_Y * blendIn;
    // The walk arm stays low, so a full back-coil would cross the head:
    // compress the wind-up part of the arc.
    const walkRot =
      rot < WALK_COIL_LIMIT_ROT
        ? WALK_COIL_LIMIT_ROT + (rot - WALK_COIL_LIMIT_ROT) * WALK_COIL_COMPRESSION
        : rot;
    return {
      dx: natural.dx + (grip.dx - guard.dx) * kx,
      dy: natural.dy + (grip.dy - guard.dy) * ky,
      rot: Phaser.Math.Linear(natural.rot, walkRot, blendIn),
    };
  }

  private resolveSwingScale(t: number): number {
    // Slight stretch on the impact (heavier for skills).
    const peak = this.swingIsSkill ? 0.16 : 0.05;
    const center = HERO_ATTACK_IMPACT_MS + 15;
    const width = this.swingIsSkill ? 90 : 60;
    const d = (t - center) / width;
    return 1 + peak * Math.exp(-d * d * 2.5);
  }

  private applyPose(pose: LocalPose, scaleMult: number): void {
    const weapon = this.weaponSprite;
    if (!weapon) {
      return;
    }
    const flipX = this.heroSprite.flipX;
    weapon.setPosition(
      this.heroSprite.x + (flipX ? -pose.dx : pose.dx) * this.heroSprite.scaleX,
      this.heroSprite.y + pose.dy * this.heroSprite.scaleY
    );
    weapon.setFlipX(flipX);
    weapon.setOrigin(flipX ? 1 - WEAPON_ORIGIN_X : WEAPON_ORIGIN_X, WEAPON_ORIGIN_Y);
    weapon.setScale(this.heroSprite.scaleX * WEAPON_BASE_SCALE_FACTOR * scaleMult);
    weapon.setDepth(this.heroSprite.depth + 1);
    weapon.setRotation(flipX ? -pose.rot : pose.rot);
  }

  /** World-space grip and blade points for a local pose. */
  private bladePoints(
    pose: LocalPose,
    inner: number,
    outer: number,
    scaleMult: number
  ): { ix: number; iy: number; ox: number; oy: number } {
    const flip = this.heroSprite.flipX ? -1 : 1;
    const sx = this.heroSprite.scaleX;
    const gx = this.heroSprite.x + flip * pose.dx * sx;
    const gy = this.heroSprite.y + pose.dy * this.heroSprite.scaleY;
    const angle = pose.rot - Math.PI / 4;
    const len = WEAPON_BLADE_LENGTH_PX * WEAPON_BASE_SCALE_FACTOR * sx * scaleMult;
    const ux = Math.cos(angle) * flip;
    const uy = Math.sin(angle);
    return {
      ix: gx + ux * len * inner,
      iy: gy + uy * len * inner,
      ox: gx + ux * len * outer,
      oy: gy + uy * len * outer,
    };
  }

  /** Short blade smear following the real arc around the impact. */
  private drawSmear(
    swingT: number | undefined,
    bodyDriven: boolean,
    natural: LocalPose
  ): void {
    const smear = this.smear;
    if (!smear || !smear.scene) {
      return;
    }
    smear.clear();
    if (
      !this.visible ||
      swingT === undefined ||
      swingT < SMEAR_START_MS ||
      swingT > SMEAR_END_MS
    ) {
      return;
    }

    const head = Math.min(swingT, HERO_ATTACK_IMPACT_MS + 8);
    const tail = Math.max(SMEAR_START_MS, swingT - SMEAR_WINDOW_MS);
    if (head - tail < 6) {
      return;
    }

    const fade =
      swingT <= HERO_ATTACK_IMPACT_MS
        ? 1
        : 1 - (swingT - HERO_ATTACK_IMPACT_MS) / (SMEAR_END_MS - HERO_ATTACK_IMPACT_MS);
    const baseAlpha = (this.swingIsSkill ? 0.42 : 0.3) * Phaser.Math.Clamp(fade, 0, 1);
    const color = SMEAR_COLORS[this.weaponFrame];

    // The drawn hand jumps between body frames; trace the arc with a
    // continuous grip path, pinned so its head matches the real blade.
    const headPose = this.computeSwingPose(head, bodyDriven, natural);
    const headGrip = sampleContinuousGrip(head);
    const outerPts: Phaser.Math.Vector2[] = [];
    const innerPts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i <= SMEAR_SAMPLES; i += 1) {
      const ts = tail + ((head - tail) * i) / SMEAR_SAMPLES;
      const grip = sampleContinuousGrip(ts);
      const swingPose = this.computeSwingPose(ts, bodyDriven, natural);
      const pose: LocalPose = {
        dx: headPose.dx + (grip.dx - headGrip.dx) * (bodyDriven ? 1 : WALK_SWING_OFFSET_SCALE_X),
        dy: headPose.dy + (grip.dy - headGrip.dy) * (bodyDriven ? 1 : WALK_SWING_OFFSET_SCALE_Y),
        rot: swingPose.rot,
      };
      const scale = this.resolveSwingScale(ts);
      // The ribbon thins toward its tail.
      const innerFrac = 0.97 - 0.42 * (i / SMEAR_SAMPLES);
      const pts = this.bladePoints(pose, innerFrac, 1.02, scale);
      outerPts.push(new Phaser.Math.Vector2(pts.ox, pts.oy));
      innerPts.push(new Phaser.Math.Vector2(pts.ix, pts.iy));
    }

    smear.fillStyle(color, baseAlpha);
    smear.fillPoints([...outerPts, ...innerPts.reverse()], true);
    smear.lineStyle(Math.max(1, this.heroSprite.scaleX * 1.5), 0xffffff, baseAlpha * 1.4);
    smear.strokePoints(outerPts.slice(Math.floor(SMEAR_SAMPLES / 3)), false);
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
