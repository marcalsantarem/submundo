import Phaser from 'phaser';

export type SkillForceVfx = 'inferno' | 'submundo' | 'empireo' | 'none';

interface AnimationSpec {
  key: string;
  texture: string;
  frames: number[];
  frameRate: number;
  repeat: number;
}

const ANIMATION_SPECS: readonly AnimationSpec[] = [
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
    const label = isHeroDamage
      ? `-${rounded}`
      : isCrit
        ? `${rounded}!`
        : `${rounded}`;

    const color = isHeroDamage
      ? '#ef4444'
      : isCrit
        ? '#facc15'
        : '#f4f4f5';

    const fontSize = isCrit ? '16px' : '13px';
    const offsetX = ((rounded * 7) % 11) - 5;

    const text = this.scene.add
      .text(x + offsetX, y - 12, label, {
        fontFamily: 'monospace',
        fontSize,
        fontStyle: 'bold',
        color,
        stroke: '#09090b',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(45);

    if (isCrit) {
      text.setScale(1.25);
    }

    this.scene.tweens.add({
      targets: text,
      y: y - (isCrit ? 38 : 28),
      alpha: 0,
      scale: isCrit ? 1.0 : 0.9,
      duration: isCrit ? 620 : 480,
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
      .text(x, y - 16, `+${rounded}`, {
        fontFamily: 'monospace',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#38bdf8',
        stroke: '#09090b',
        strokeThickness: 3,
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
  ): void {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const midX = fromX + (toX - fromX) * 0.65;
    const midY = fromY + (toY - fromY) * 0.65;

    const slash = this.scene.add.graphics({ x: midX, y: midY }).setDepth(42);
    slash.setRotation(angle);

    // Outer spectral glow arc (#38bdf8)
    slash.lineStyle(4, 0x38bdf8, 0.9);
    slash.beginPath();
    slash.arc(0, 0, 16, -0.85, 0.85, false);
    slash.strokePath();

    // Inner bright blade core (#e0f2fe)
    slash.lineStyle(2, 0xe0f2fe, 1);
    slash.beginPath();
    slash.arc(2, 0, 15, -0.65, 0.65, false);
    slash.strokePath();

    this.scene.tweens.add({
      targets: slash,
      scaleX: 1.25,
      scaleY: 1.25,
      alpha: 0,
      duration: 160,
      ease: 'Quad.easeOut',
      onComplete: () => {
        slash.destroy();
      },
    });
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
      .text(fromX, fromY - 10, `+${count} Alma${count > 1 ? 's' : ''}`, {
        fontFamily: 'monospace',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#e0f2fe',
        stroke: '#0284c7',
        strokeThickness: 3,
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
}
