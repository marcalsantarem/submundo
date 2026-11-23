import Phaser from 'phaser';
import { DF_FONTS, formatStatNumber } from '../ui/DarkFantasyUiBuilder';

export type SkillForceVfx = 'inferno' | 'submundo' | 'empireo' | 'none';

export const HERO_WALK_FOOTSTEP_FRAMES: readonly number[] = [4, 7];

interface AnimationSpec {
  key: string;
  texture: string;
  frames: number[];
  frameRate: number;
  repeat: number;
}

function createMonsterAnimSpecs(
  texture: string,
  idleFrameRate = 6,
  walkFrameRate = 10,
): AnimationSpec[] {
  return [
    {
      key: `${texture}_idle`,
      texture,
      frames: [0, 1, 2, 3],
      frameRate: idleFrameRate,
      repeat: -1,
    },
    {
      key: `${texture}_walk`,
      texture,
      frames: [4, 5, 6, 7, 8, 9],
      frameRate: walkFrameRate,
      repeat: -1,
    },
    {
      key: `${texture}_attack`,
      texture,
      frames: [10, 11, 12, 13, 14, 15],
      frameRate: 16,
      repeat: 0,
    },
    {
      key: `${texture}_death`,
      texture,
      frames: [16, 17, 18, 19],
      frameRate: 10,
      repeat: 0,
    },
  ];
}

const ANIMATION_SPECS: readonly AnimationSpec[] = [
  // Hero Living (Prologue) — 1920x80 (24 frames of 80x80)
  {
    key: 'hero_living_idle',
    texture: 'hero_living',
    frames: [0, 1, 2, 3],
    frameRate: 6,
    repeat: -1,
  },
  {
    key: 'hero_living_walk',
    texture: 'hero_living',
    frames: [4, 5, 6, 7, 8, 9],
    frameRate: 12,
    repeat: -1,
  },
  {
    key: 'hero_living_attack',
    texture: 'hero_living',
    frames: [10, 11, 12, 13, 14, 15],
    frameRate: 18,
    repeat: 0,
  },
  {
    key: 'hero_living_dash',
    texture: 'hero_living',
    frames: [16, 17, 18, 19],
    frameRate: 16,
    repeat: 0,
  },
  {
    key: 'hero_living_hit',
    texture: 'hero_living',
    frames: [20, 21, 22, 23],
    frameRate: 14,
    repeat: 0,
  },
  // Hero Wraith (Act 1+) — 1920x80 (24 frames of 80x80)
  {
    key: 'hero_wraith_idle',
    texture: 'hero_wraith',
    frames: [0, 1, 2, 3],
    frameRate: 6,
    repeat: -1,
  },
  {
    key: 'hero_wraith_walk',
    texture: 'hero_wraith',
    frames: [4, 5, 6, 7, 8, 9],
    frameRate: 12,
    repeat: -1,
  },
  {
    key: 'hero_wraith_attack',
    texture: 'hero_wraith',
    frames: [10, 11, 12, 13, 14, 15],
    frameRate: 18,
    repeat: 0,
  },
  {
    key: 'hero_wraith_dash',
    texture: 'hero_wraith',
    frames: [16, 17, 18, 19],
    frameRate: 16,
    repeat: 0,
  },
  {
    key: 'hero_wraith_hit',
    texture: 'hero_wraith',
    frames: [20, 21, 22, 23],
    frameRate: 14,
    repeat: 0,
  },
  // Monsters (20 frames: idle 0-3, walk 4-9, attack 10-15, death 16-19)
  ...createMonsterAnimSpecs('slime', 6, 10),
  ...createMonsterAnimSpecs('cave_bat', 8, 12),
  ...createMonsterAnimSpecs('wolf', 6, 12),
  ...createMonsterAnimSpecs('skeleton', 6, 10),
  ...createMonsterAnimSpecs('skeleton_archer', 6, 10),
  ...createMonsterAnimSpecs('skeleton_chief', 6, 10),
  ...createMonsterAnimSpecs('wolf_alpha', 6, 12),
  ...createMonsterAnimSpecs('karnak', 6, 9),
  // Legacy fallback specs if wraith_warrior or legacy monster textures exist
  {
    key: 'wraith_idle',
    texture: 'wraith_warrior',
    frames: [0, 1],
    frameRate: 4,
    repeat: -1,
  },
  {
    key: 'wraith_attack',
    texture: 'wraith_warrior',
    frames: [2, 0],
    frameRate: 10,
    repeat: 0,
  },
  {
    key: 'wraith_dash',
    texture: 'wraith_warrior',
    frames: [3],
    frameRate: 10,
    repeat: 0,
  },
  {
    key: 'slime_idle',
    texture: 'abyssal_slime',
    frames: [0, 1],
    frameRate: 4,
    repeat: -1,
  },
  {
    key: 'sentinel_idle',
    texture: 'bone_sentinel',
    frames: [0, 1],
    frameRate: 3,
    repeat: -1,
  },
  {
    key: 'warden_idle',
    texture: 'infernal_warden',
    frames: [0, 1],
    frameRate: 3,
    repeat: -1,
  },
];

const FORCE_PALETTE: Record<
  SkillForceVfx,
  { primary: number; secondary: number; highlight: number }
> = {
  inferno: {
    primary: 0xf97316,
    secondary: 0xdc2626,
    highlight: 0xfacc15,
  },
  submundo: {
    primary: 0xef4444,
    secondary: 0x991b1b,
    highlight: 0xfca5a5,
  },
  empireo: {
    primary: 0xfacc15,
    secondary: 0x38bdf8,
    highlight: 0xe0f2fe,
  },
  none: {
    primary: 0x38bdf8,
    secondary: 0x0284c7,
    highlight: 0xe0f2fe,
  },
};

/**
 * Registers sprite animations for the hero, monsters, and boss if not already present.
 */
export function registerGameAnimations(scene: Phaser.Scene): void {
  for (const spec of ANIMATION_SPECS) {
    if (scene.anims.exists(spec.key) || !scene.textures.exists(spec.texture)) {
      continue;
    }

    const texture = scene.textures.get(spec.texture);
    const maxFrameIndex = Math.max(...spec.frames);
    const hasNumberedFrames = texture.frameTotal > maxFrameIndex + 1;

    const animFrames = hasNumberedFrames
      ? scene.anims.generateFrameNumbers(spec.texture, { frames: spec.frames })
      : [{ key: spec.texture }];

    if (animFrames.length === 0) {
      continue;
    }

    scene.anims.create({
      key: spec.key,
      frames: animFrames,
      frameRate: spec.frameRate,
      repeat: spec.repeat,
    });
  }
}

export type MonsterAnimState = 'idle' | 'walk' | 'attack' | 'death';

const ANIMATED_MONSTER_KEYS = new Set<string>([
  'slime',
  'cave_bat',
  'wolf',
  'skeleton',
  'skeleton_archer',
  'skeleton_chief',
  'wolf_alpha',
  'karnak',
]);

const LEGACY_MONSTER_ANIM_FALLBACKS: Record<string, string> = {
  abyssal_slime: 'slime_idle',
  bone_sentinel: 'sentinel_idle',
  infernal_warden: 'warden_idle',
};

/**
 * Resolves the animation key for a monster sprite and state, falling back safely for legacy textures.
 */
export function resolveMonsterAnimKey(
  spriteKey: string,
  state: MonsterAnimState,
): string | null {
  if (ANIMATED_MONSTER_KEYS.has(spriteKey)) {
    return `${spriteKey}_${state}`;
  }
  return LEGACY_MONSTER_ANIM_FALLBACKS[spriteKey] ?? null;
}

/**
 * Spawns lightweight footstep dust (Living) or spectral mist (Wraith) particles on walk contact frames.
 */
export function spawnFootstepDust(
  scene: Phaser.Scene,
  x: number,
  y: number,
  isWraith: boolean,
): void {
  const primaryColor = isWraith ? 0x38bdf8 : 0xd6c7a9;
  const secondaryColor = isWraith ? 0x94a3b8 : 0xa89878;

  const puffs = [
    { offsetX: -5, offsetY: 0, driftX: -9, driftY: -5, radius: 2.6, duration: 230 },
    { offsetX: 0, offsetY: 1, driftX: 0, driftY: -6, radius: 2.1, duration: 250 },
    { offsetX: 5, offsetY: 0, driftX: 9, driftY: -4, radius: 2.4, duration: 240 },
  ];

  for (let i = 0; i < puffs.length; i++) {
    const puff = puffs[i];
    const dust = scene.add
      .graphics({ x: x + puff.offsetX, y: y + puff.offsetY })
      .setDepth(19);
    const color = i % 2 === 0 ? primaryColor : secondaryColor;
    dust.fillStyle(color, isWraith ? 0.55 : 0.65);
    dust.fillCircle(0, 0, puff.radius);

    scene.tweens.add({
      targets: dust,
      x: x + puff.offsetX + puff.driftX,
      y: y + puff.offsetY + puff.driftY,
      scaleX: 1.5,
      scaleY: 1.3,
      alpha: 0,
      duration: puff.duration,
      ease: 'Quad.easeOut',
      onComplete: () => {
        dust.destroy();
      },
    });
  }
}

/**
 * Manages procedural Dark Fantasy combat visual effects in Phaser 3.
 */
export class CombatVfxManager {
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  public showDamageNumber(
    x: number,
    y: number,
    amount: number,
    isCrit = false,
    isHeroDamage = false,
  ): void {
    const rounded = Math.max(1, Math.round(amount));
    const formatted = formatStatNumber(rounded);
    const showCritBanner = isCrit && !isHeroDamage;
    const label = isHeroDamage ? `-${formatted}` : formatted;

    const color = isHeroDamage
      ? '#ef4444'
      : showCritBanner
        ? '#fef08a'
        : '#f4f4f5';

    const fontSize = showCritBanner ? '20px' : '14px';
    const offsetX = ((rounded * 7) % 11) - 5;

    if (showCritBanner) {
      const critLabel = this.scene.add
        .text(x + offsetX, y - 30, 'CRÍTICO!', {
          fontFamily: DF_FONTS.TITLE,
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#fde047',
          stroke: '#09090b',
          strokeThickness: 4,
          shadow: {
            offsetX: 0,
            offsetY: 2,
            color: '#000000',
            blur: 3,
            fill: true,
          },
          resolution: 2,
        })
        .setOrigin(0.5)
        .setDepth(46)
        .setScale(0.75);

      this.scene.tweens.add({
        targets: critLabel,
        scaleX: 1.14,
        scaleY: 1.14,
        duration: 110,
        ease: 'Back.easeOut',
        onComplete: () => {
          if (!critLabel.active) {
            return;
          }
          this.scene.tweens.add({
            targets: critLabel,
            y: y - 58,
            alpha: 0,
            scaleX: 1.0,
            scaleY: 1.0,
            duration: 560,
            ease: 'Cubic.easeOut',
            onComplete: () => {
              critLabel.destroy();
            },
          });
        },
      });
    }

    const damageStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: DF_FONTS.TITLE,
      fontSize,
      fontStyle: 'bold',
      color,
      stroke: '#09090b',
      strokeThickness: showCritBanner ? 4 : 3,
      resolution: 2,
    };
    if (showCritBanner) {
      damageStyle.shadow = {
        offsetX: 0,
        offsetY: 2,
        color: '#000000',
        blur: 4,
        fill: true,
      };
    }

    const text = this.scene.add
      .text(x + offsetX, y - (showCritBanner ? 14 : 12), label, damageStyle)
      .setOrigin(0.5)
      .setDepth(showCritBanner ? 46 : 45);

    if (showCritBanner) {
      text.setScale(0.8);
      this.scene.tweens.add({
        targets: text,
        scaleX: 1.28,
        scaleY: 1.28,
        duration: 110,
        ease: 'Back.easeOut',
        onComplete: () => {
          if (!text.active) {
            return;
          }
          this.scene.tweens.add({
            targets: text,
            y: y - 42,
            alpha: 0,
            scaleX: 1.02,
            scaleY: 1.02,
            duration: 560,
            ease: 'Cubic.easeOut',
            onComplete: () => {
              text.destroy();
            },
          });
        },
      });
      return;
    }

    this.scene.tweens.add({
      targets: text,
      y: y - 28,
      alpha: 0,
      scale: 0.9,
      duration: 480,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        text.destroy();
      },
    });
  }

  public showHealEffect(x: number, y: number, amount: number): void {
    const rounded = Math.max(1, Math.round(amount));

    const ring = this.scene.add.graphics({ x, y }).setDepth(40);
    ring.lineStyle(2, 0x38bdf8, 0.95);
    ring.strokeCircle(0, 0, 14);
    ring.fillStyle(0xe0f2fe, 0.25);
    ring.fillCircle(0, 0, 10);

    this.scene.tweens.add({
      targets: ring,
      scaleX: 1.7,
      scaleY: 1.7,
      alpha: 0,
      duration: 380,
      ease: 'Quad.easeOut',
      onComplete: () => {
        ring.destroy();
      },
    });

    const text = this.scene.add
      .text(x, y - 16, `+${formatStatNumber(rounded)}`, {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#38bdf8',
        stroke: '#09090b',
        strokeThickness: 3,
        resolution: 2,
      })
      .setOrigin(0.5)
      .setDepth(46);

    this.scene.tweens.add({
      targets: text,
      y: y - 40,
      alpha: 0,
      duration: 550,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        text.destroy();
      },
    });
  }

  public showSlashEffect(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    isWraith = true,
  ): void {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const midX = fromX + (toX - fromX) * 0.65;
    const midY = fromY + (toY - fromY) * 0.65;

    const outerColor = isWraith ? 0x38bdf8 : 0xfacc15;
    const innerColor = isWraith ? 0xe0f2fe : 0xe2e8f0;

    const slash = this.scene.add.graphics({ x: midX, y: midY }).setDepth(42);
    slash.setRotation(angle);

    // Outer runic glow arc (traço externo)
    slash.lineStyle(4, outerColor, 0.9);
    slash.beginPath();
    slash.arc(0, 0, 18, -0.9, 0.9, false);
    slash.strokePath();

    // Secondary trailing arc (traço duplo)
    slash.lineStyle(2.5, outerColor, 0.55);
    slash.beginPath();
    slash.arc(-3, 0, 14, -0.75, 0.75, false);
    slash.strokePath();

    // Inner bright blade core
    slash.lineStyle(2, innerColor, 1);
    slash.beginPath();
    slash.arc(2, 0, 16, -0.68, 0.68, false);
    slash.strokePath();

    this.scene.tweens.add({
      targets: slash,
      scaleX: 1.28,
      scaleY: 1.28,
      alpha: 0,
      duration: 165,
      ease: 'Quad.easeOut',
      onComplete: () => {
        slash.destroy();
      },
    });

    // Subtle spark particles along the slash arc
    const sparkOffsets = [-0.65, -0.2, 0.25, 0.65];
    for (let i = 0; i < sparkOffsets.length; i++) {
      const sparkAngle = angle + sparkOffsets[i];
      const startDist = 14;
      const endDist = 26;
      const sx = midX + Math.cos(sparkAngle) * startDist;
      const sy = midY + Math.sin(sparkAngle) * startDist;

      const spark = this.scene.add.graphics({ x: sx, y: sy }).setDepth(43);
      spark.fillStyle(i % 2 === 0 ? innerColor : outerColor, 0.95);
      spark.fillCircle(0, 0, 1.8);

      this.scene.tweens.add({
        targets: spark,
        x: midX + Math.cos(sparkAngle) * endDist,
        y: midY + Math.sin(sparkAngle) * endDist,
        alpha: 0,
        scaleX: 0.4,
        scaleY: 0.4,
        duration: 160,
        ease: 'Quad.easeOut',
        onComplete: () => {
          spark.destroy();
        },
      });
    }
  }

  public showSkillAreaEffect(
    x: number,
    y: number,
    radius: number,
    force: SkillForceVfx,
  ): void {
    const palette = FORCE_PALETTE[force];
    const effectiveRadius = Math.max(18, radius);

    const blast = this.scene.add.graphics({ x, y }).setDepth(38);
    blast.fillStyle(palette.secondary, 0.28);
    blast.fillCircle(0, 0, effectiveRadius);
    blast.lineStyle(3, palette.primary, 0.95);
    blast.strokeCircle(0, 0, effectiveRadius);
    blast.lineStyle(1.5, palette.highlight, 0.85);
    blast.strokeCircle(0, 0, effectiveRadius * 0.62);

    blast.setScale(0.35);

    this.scene.tweens.add({
      targets: blast,
      scaleX: 1.08,
      scaleY: 1.08,
      alpha: 0,
      duration: 300,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        blast.destroy();
      },
    });
  }

  public showDashTrail(x: number, y: number): void {
    const ghost = this.scene.add.graphics({ x, y }).setDepth(35);

    // Spectral wisp afterimage (#38bdf8 + #e0f2fe)
    ghost.fillStyle(0x38bdf8, 0.55);
    ghost.fillCircle(0, 0, 10);
    ghost.lineStyle(2, 0xe0f2fe, 0.8);
    ghost.strokeCircle(0, 0, 12);

    this.scene.tweens.add({
      targets: ghost,
      scaleX: 0.4,
      scaleY: 0.4,
      alpha: 0,
      duration: 220,
      ease: 'Quad.easeOut',
      onComplete: () => {
        ghost.destroy();
      },
    });
  }

  public showSoulCollectEffect(
    fromX: number,
    fromY: number,
    souls: number,
  ): void {
    const count = Math.max(1, Math.round(souls));

    const orb = this.scene.add.graphics({ x: fromX, y: fromY }).setDepth(44);
    orb.fillStyle(0x38bdf8, 0.85);
    orb.fillCircle(0, 0, 6);
    orb.fillStyle(0xe0f2fe, 1);
    orb.fillCircle(0, 0, 3);

    this.scene.tweens.add({
      targets: orb,
      y: fromY - 26,
      scaleX: 0.3,
      scaleY: 0.3,
      alpha: 0,
      duration: 420,
      ease: 'Back.easeIn',
      onComplete: () => {
        orb.destroy();
      },
    });

    const label = this.scene.add
      .text(fromX, fromY - 10, `+${formatStatNumber(count)} Alma${count > 1 ? 's' : ''}`, {
        fontFamily: DF_FONTS.BODY,
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#e0f2fe',
        stroke: '#0284c7',
        strokeThickness: 3,
        resolution: 2,
      })
      .setOrigin(0.5)
      .setDepth(45);

    this.scene.tweens.add({
      targets: label,
      y: fromY - 34,
      alpha: 0,
      duration: 520,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        label.destroy();
      },
    });
  }

  public showEmberExplosion(x: number, y: number, radius: number): void {
    const effectiveRadius = Math.max(20, radius);

    const blast = this.scene.add.graphics({ x, y }).setDepth(41);
    blast.fillStyle(0xef4444, 0.35);
    blast.fillCircle(0, 0, effectiveRadius);
    blast.fillStyle(0xf97316, 0.45);
    blast.fillCircle(0, 0, effectiveRadius * 0.58);
    blast.fillStyle(0xfacc15, 0.75);
    blast.fillCircle(0, 0, effectiveRadius * 0.25);
    blast.lineStyle(3, 0xf97316, 0.95);
    blast.strokeCircle(0, 0, effectiveRadius);
    blast.lineStyle(1.5, 0xef4444, 0.85);
    blast.strokeCircle(0, 0, effectiveRadius * 0.78);
    blast.setScale(0.3);

    this.scene.tweens.add({
      targets: blast,
      scaleX: 1.15,
      scaleY: 1.15,
      alpha: 0,
      duration: 340,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        blast.destroy();
      },
    });

    const sparkCount = 8;
    for (let i = 0; i < sparkCount; i++) {
      const angle = (Math.PI * 2 * i) / sparkCount;
      const spark = this.scene.add.graphics({ x, y }).setDepth(42);
      const color = i % 2 === 0 ? 0xf97316 : 0xef4444;
      spark.fillStyle(color, 1);
      spark.fillCircle(0, 0, 2.5);

      const dist = effectiveRadius * 0.95;
      this.scene.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scaleX: 0.4,
        scaleY: 0.4,
        duration: 280,
        ease: 'Quad.easeOut',
        onComplete: () => {
          spark.destroy();
        },
      });
    }
  }

  public showLightningChain(points: Array<{ x: number; y: number }>): void {
    if (points.length < 2) {
      return;
    }

    const bolt = this.scene.add.graphics().setDepth(43);

    // Outer yellow/cyan aura segments
    bolt.lineStyle(4, 0xfacc15, 0.75);
    this.drawAngularChainPath(bolt, points, 6);
    bolt.strokePath();

    // Inner bright electric core (#e0fbfc)
    bolt.lineStyle(2, 0xe0fbfc, 1);
    this.drawAngularChainPath(bolt, points, 3);
    bolt.strokePath();

    // Impact nodes at chained targets
    for (let i = 1; i < points.length; i++) {
      const pt = points[i];
      bolt.fillStyle(0xe0fbfc, 0.95);
      bolt.fillCircle(pt.x, pt.y, 4);
      bolt.lineStyle(1.5, 0xfacc15, 0.9);
      bolt.strokeCircle(pt.x, pt.y, 8);
    }

    this.scene.tweens.add({
      targets: bolt,
      alpha: 0,
      duration: 240,
      ease: 'Quad.easeOut',
      onComplete: () => {
        bolt.destroy();
      },
    });
  }

  public showBleedEffect(x: number, y: number): void {
    const splatter = this.scene.add.graphics({ x, y }).setDepth(41);
    splatter.lineStyle(2, 0xef4444, 0.9);
    splatter.strokeCircle(0, 0, 9);
    splatter.fillStyle(0x991b1b, 0.45);
    splatter.fillCircle(0, 0, 6);

    this.scene.tweens.add({
      targets: splatter,
      scaleX: 1.4,
      scaleY: 1.4,
      alpha: 0,
      duration: 280,
      ease: 'Quad.easeOut',
      onComplete: () => {
        splatter.destroy();
      },
    });

    const droplets = [
      { dx: -7, dy: -4, fall: 14, r: 2.2 },
      { dx: 6, dy: -6, fall: 16, r: 2.0 },
      { dx: -3, dy: 3, fall: 18, r: 2.5 },
      { dx: 8, dy: 2, fall: 15, r: 1.8 },
      { dx: 0, dy: -8, fall: 17, r: 2.2 },
    ];

    for (const drop of droplets) {
      const gfx = this.scene.add
        .graphics({ x: x + drop.dx, y: y + drop.dy })
        .setDepth(42);
      gfx.fillStyle(0xef4444, 0.95);
      gfx.fillCircle(0, 0, drop.r);
      gfx.fillStyle(0xfca5a5, 0.8);
      gfx.fillCircle(-0.5, -0.5, drop.r * 0.4);

      this.scene.tweens.add({
        targets: gfx,
        x: x + drop.dx * 1.4,
        y: y + drop.dy + drop.fall,
        alpha: 0,
        scaleX: 0.6,
        scaleY: 0.8,
        duration: 380,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          gfx.destroy();
        },
      });
    }
  }

  public showLootDropBeam(
    x: number,
    y: number,
    rarity: 'common' | 'magic' | 'rare' | 'legendary',
  ): void {
    const ringColorMap: Record<'common' | 'magic' | 'rare' | 'legendary', number> = {
      common: 0xe4e4e7,
      magic: 0x60a5fa,
      rare: 0xfacc15,
      legendary: 0xf97316,
    };

    const color = ringColorMap[rarity];
    const effect = this.scene.add.graphics({ x, y }).setDepth(39);

    // Pilar vertical de luz EXCLUSIVAMENTE em itens Lendários (regra inegociável do dono)
    if (rarity === 'legendary') {
      const height = 160;
      effect.fillStyle(0xf97316, 0.28);
      effect.fillRect(-10, -height, 20, height);
      effect.fillStyle(0xfde047, 0.48);
      effect.fillRect(-4, -height * 0.9, 8, height * 0.9);
      effect.fillStyle(0xfffbeb, 0.85);
      effect.fillRect(-1.5, -height * 0.82, 3, height * 0.82);
    }

    // Anel sutil na base do drop no chão (todos os itens)
    const ringWidth = rarity === 'legendary' ? 32 : 20;
    const ringHeight = rarity === 'legendary' ? 13 : 8;
    effect.lineStyle(rarity === 'legendary' ? 2.2 : 1.5, color, 0.9);
    effect.strokeEllipse(0, 0, ringWidth, ringHeight);

    this.scene.tweens.add({
      targets: effect,
      scaleX: rarity === 'legendary' ? 1.15 : 1.35,
      scaleY: rarity === 'legendary' ? 1.15 : 1.35,
      alpha: 0,
      duration: rarity === 'legendary' ? 760 : 480,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        effect.destroy();
      },
    });
  }

  public showItemPickupBanner(
    x: number,
    y: number,
    label: string,
    colorHex: string,
  ): void {
    const safeColor = colorHex && colorHex.trim().length > 0 ? colorHex : '#e4e4e7';
    const banner = this.scene.add
      .text(x, y - 16, label, {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '12px',
        fontStyle: 'bold',
        color: safeColor,
        stroke: '#09090b',
        strokeThickness: 4,
        resolution: 2,
      })
      .setOrigin(0.5)
      .setDepth(48);

    this.scene.tweens.add({
      targets: banner,
      y: y - 46,
      alpha: 0,
      duration: 950,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        banner.destroy();
      },
    });
  }

  private drawAngularChainPath(
    graphics: Phaser.GameObjects.Graphics,
    points: Array<{ x: number; y: number }>,
    jitter: number,
  ): void {
    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);

    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const sign = i % 2 === 0 ? 1 : -1;

      const mid1X = a.x + dx * 0.33 + nx * jitter * sign;
      const mid1Y = a.y + dy * 0.33 + ny * jitter * sign;
      const mid2X = a.x + dx * 0.67 - nx * jitter * sign;
      const mid2Y = a.y + dy * 0.67 - ny * jitter * sign;

      graphics.lineTo(mid1X, mid1Y);
      graphics.lineTo(mid2X, mid2Y);
      graphics.lineTo(b.x, b.y);
    }
  }
}
