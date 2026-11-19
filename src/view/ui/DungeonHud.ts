import Phaser from 'phaser';
import {
  ForceType,
  SkillDef,
  SkillSlot,
  Vector2D,
  ViewportConfig,
  resolveViewportConfig,
} from '../../core/index';
import dialoguesData from '../../data/dialogues.json';
import { soundManager } from '../audio/SoundManager';
import { VirtualJoystick } from './VirtualJoystick';

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  souls: number;
  roomNumber: number;
  totalRooms: number;
  isBossRoom: boolean;
  roomTitle: string;
  stageName?: string;
  bossHp?: number;
  bossMaxHp?: number;
  bossName?: string;
  potionCharges: number;
  maxPotionCharges: number;
  skillCooldownsMs: Record<string, number>;
  runStatus: 'in_progress' | 'room_cleared' | 'victory' | 'defeat';
  bannerText?: string;
  bagCount?: number;
  equippedCount?: number;
  lootSummaryText?: string;
  heroPortraitFrame?: number;
  heroName?: string;
  heroLevel?: number;
  essences?: number;
  autoAttackEnabled?: boolean;
  isTestArena?: boolean;
  missionObjective?: string;
  minimap?: {
    heroX: number;
    heroY: number;
    arenaWidth: number;
    arenaHeight: number;
    enemies: Array<{ x: number; y: number; isBoss: boolean }>;
  };
}

interface SkillButtonView {
  skill: SkillDef;
  iconFrame: number;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  iconImage: Phaser.GameObjects.Image | null;
  fallbackLabelText: Phaser.GameObjects.Text;
  cdOverlay: Phaser.GameObjects.Graphics;
  cooldownText: Phaser.GameObjects.Text;
  hotkeyBg: Phaser.GameObjects.Graphics;
  hotkeyText: Phaser.GameObjects.Text;
  chargesBg?: Phaser.GameObjects.Graphics;
  chargesText?: Phaser.GameObjects.Text;
  hitZone: Phaser.GameObjects.Zone;
  radius: number;
}

interface MovementKeys {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  w: Phaser.Input.Keyboard.Key;
  s: Phaser.Input.Keyboard.Key;
  a: Phaser.Input.Keyboard.Key;
  d: Phaser.Input.Keyboard.Key;
}

const UI_ICONS_KEY = 'ui_icons';
const PORTRAITS_KEY = 'portraits';
const FONT_TITLE =
  "'Cinzel', 'Palatino Linotype', 'Book Antiqua', Georgia, serif";
const FONT_BODY =
  "'Segoe UI', 'Inter', system-ui, -apple-system, sans-serif";

const ICON_FRAME = {
  ATTACK: 0,
  DASH: 1,
  SKILL_INFERNO: 2,
  SKILL_EMPIREO: 3,
  SKILL_SUBMUNDO: 4,
  POTION: 5,
  BAG: 6,
  SETTINGS: 7,
  AUDIO_ON: 8,
  AUDIO_OFF: 9,
  SOULS: 10,
  ESSENCE: 11,
} as const;

export class DungeonHud {
  private readonly scene: Phaser.Scene;
  private readonly skills: SkillDef[];
  private readonly callbacks: {
    onUseSkill: (skillId: string) => void;
    onRestartRun: () => void;
    onToggleInventory?: () => void;
    onBasicAttack?: () => void;
    onToggleAutoAttack?: () => void;
  };

  private viewport: ViewportConfig;
  private readonly joystick: VirtualJoystick;
  private movementKeys?: MovementKeys;
  private readonly keydownHandler: (event: KeyboardEvent) => void;

  // Top-Left: Diablo Hero Frame
  private readonly heroFrameContainer: Phaser.GameObjects.Container;
  private readonly portraitBgGraphic: Phaser.GameObjects.Graphics;
  private readonly portraitSprite: Phaser.GameObjects.Image | null;
  private readonly portraitMaskGfx: Phaser.GameObjects.Graphics | null;
  private readonly portraitFallbackText: Phaser.GameObjects.Text;
  private readonly portraitRingGraphic: Phaser.GameObjects.Graphics;
  private readonly levelBadgeBg: Phaser.GameObjects.Graphics;
  private readonly levelBadgeText: Phaser.GameObjects.Text;
  private readonly heroNameText: Phaser.GameObjects.Text;
  private readonly hpBarGraphic: Phaser.GameObjects.Graphics;
  private readonly hpText: Phaser.GameObjects.Text;
  private readonly secondaryBarGraphic: Phaser.GameObjects.Graphics;

  // Top-Left below Hero Frame: Compact Mission / Room Objective Tracker
  private readonly objectiveContainer: Phaser.GameObjects.Container;
  private readonly objectiveBg: Phaser.GameObjects.Graphics;
  private readonly objectiveText: Phaser.GameObjects.Text;

  // Top-Right: Resources (Souls & Essences)
  private readonly resourcesContainer: Phaser.GameObjects.Container;
  private readonly soulsBg: Phaser.GameObjects.Graphics;
  private readonly soulsIcon: Phaser.GameObjects.Image | null;
  private readonly soulsFallbackGraphic: Phaser.GameObjects.Graphics;
  private readonly soulsText: Phaser.GameObjects.Text;
  private readonly essenceBg: Phaser.GameObjects.Graphics;
  private readonly essenceIcon: Phaser.GameObjects.Image | null;
  private readonly essenceFallbackGraphic: Phaser.GameObjects.Graphics;
  private readonly essenceText: Phaser.GameObjects.Text;

  // Top-Right: Circular Minimap
  private readonly minimapContainer: Phaser.GameObjects.Container;
  private readonly minimapBg: Phaser.GameObjects.Graphics;
  private readonly minimapDots: Phaser.GameObjects.Graphics;
  private readonly minimapFrame: Phaser.GameObjects.Graphics;
  private minimapRadius = 36;

  // Top-Right Utility Row (AUTO, Bag, Audio)
  private readonly autoBtnContainer: Phaser.GameObjects.Container;
  private readonly autoBtnBg: Phaser.GameObjects.Graphics;
  private readonly autoBtnText: Phaser.GameObjects.Text;
  private readonly autoBtnZone: Phaser.GameObjects.Zone;

  private readonly bagBtnContainer: Phaser.GameObjects.Container;
  private readonly bagBtnBg: Phaser.GameObjects.Graphics;
  private readonly bagBtnIcon: Phaser.GameObjects.Image | null;
  private readonly bagBtnFallbackText: Phaser.GameObjects.Text;
  private readonly bagBadgeBg: Phaser.GameObjects.Graphics;
  private readonly bagBadgeText: Phaser.GameObjects.Text;
  private readonly bagHotkeyText: Phaser.GameObjects.Text;
  private readonly bagBtnZone: Phaser.GameObjects.Zone;

  private readonly muteBtnContainer: Phaser.GameObjects.Container;
  private readonly muteBtnBg: Phaser.GameObjects.Graphics;
  private readonly muteBtnIcon: Phaser.GameObjects.Image | null;
  private readonly muteBtnFallbackText: Phaser.GameObjects.Text;
  private readonly muteHotkeyText: Phaser.GameObjects.Text;
  private readonly muteBtnZone: Phaser.GameObjects.Zone;

  private utilityBtnRadius = 17;

  // Top-Center: Boss HP Bar
  private readonly bossContainer: Phaser.GameObjects.Container;
  private readonly bossBarGraphic: Phaser.GameObjects.Graphics;
  private readonly bossNameText: Phaser.GameObjects.Text;
  private readonly bossHpText: Phaser.GameObjects.Text;

  // Status / Narrative Banner
  private readonly bannerContainer: Phaser.GameObjects.Container;
  private readonly bannerBg: Phaser.GameObjects.Graphics;
  private readonly bannerLabel: Phaser.GameObjects.Text;

  // Bottom-Right: Primary Attack Button + Satellite Skill Arc
  private readonly attackBtnContainer: Phaser.GameObjects.Container;
  private readonly attackBtnBg: Phaser.GameObjects.Graphics;
  private readonly attackBtnIcon: Phaser.GameObjects.Image | null;
  private readonly attackBtnFallbackText: Phaser.GameObjects.Text;
  private readonly attackBtnZone: Phaser.GameObjects.Zone;
  private attackBtnRadius = 34;

  private readonly skillButtons: SkillButtonView[] = [];
  private readonly skillBySlot = new Map<SkillSlot, SkillDef>();

  // End-of-run Modal (Victory / Defeat)
  private readonly modalContainer: Phaser.GameObjects.Container;
  private readonly modalBackdrop: Phaser.GameObjects.Graphics;
  private readonly modalBox: Phaser.GameObjects.Graphics;
  private readonly modalTitleText: Phaser.GameObjects.Text;
  private readonly modalBodyText: Phaser.GameObjects.Text;
  private readonly modalSoulsText: Phaser.GameObjects.Text;
  private readonly modalLootText: Phaser.GameObjects.Text;
  private readonly restartBtnContainer: Phaser.GameObjects.Container;
  private readonly restartBtnBg: Phaser.GameObjects.Graphics;
  private readonly restartBtnText: Phaser.GameObjects.Text;
  private readonly restartBtnZone: Phaser.GameObjects.Zone;

  private lastSnapshot: HudSnapshot = {
    hp: 100,
    maxHp: 100,
    souls: 0,
    roomNumber: 1,
    totalRooms: 5,
    isBossRoom: false,
    roomTitle: 'Câmara das Cinzas',
    potionCharges: 3,
    maxPotionCharges: 3,
    skillCooldownsMs: {},
    runStatus: 'in_progress',
    autoAttackEnabled: true,
    heroLevel: 1,
    heroPortraitFrame: 0,
  };

  constructor(
    scene: Phaser.Scene,
    skills: SkillDef[],
    callbacks: {
      onUseSkill: (skillId: string) => void;
      onRestartRun: () => void;
      onToggleInventory?: () => void;
      onBasicAttack?: () => void;
      onToggleAutoAttack?: () => void;
    }
  ) {
    this.scene = scene;
    this.skills = skills;
    this.callbacks = callbacks;
    this.viewport = resolveViewportConfig(scene.scale.width || 800, scene.scale.height || 600);

    for (const skill of skills) {
      this.skillBySlot.set(skill.slot, skill);
    }

    const totalPointers = scene.input.manager?.pointersTotal ?? 2;
    if (totalPointers < 4) {
      scene.input.addPointer?.(4 - totalPointers);
    }

    this.joystick = new VirtualJoystick(scene);

    // -------------------------------------------------------------------------
    // 1. TOP-LEFT: DIABLO HERO FRAME
    // -------------------------------------------------------------------------
    this.portraitBgGraphic = scene.add.graphics();
    this.portraitSprite = this.hasTextureFrame(PORTRAITS_KEY, 0)
      ? scene.add.image(0, 0, PORTRAITS_KEY, 0).setOrigin(0.5)
      : null;

    // Non-display-list mask graphics for clean circular portrait crop on uiCamera
    this.portraitMaskGfx =
      this.portraitSprite && typeof scene.make?.graphics === 'function'
        ? scene.make.graphics({}, false)
        : null;
    if (
      this.portraitSprite &&
      this.portraitMaskGfx &&
      typeof this.portraitMaskGfx.createGeometryMask === 'function'
    ) {
      this.portraitSprite.setMask(this.portraitMaskGfx.createGeometryMask());
    }

    this.portraitFallbackText = scene.add
      .text(0, 0, 'GR', {
        fontFamily: FONT_BODY,
        resolution: 2,
        fontSize: '15px',
        color: '#f0d9a7',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.portraitRingGraphic = scene.add.graphics();
    this.levelBadgeBg = scene.add.graphics();
    this.levelBadgeText = scene.add
      .text(0, 0, 'Nv. 1', {
        fontFamily: FONT_BODY,
        resolution: 2,
        fontSize: '9px',
        color: '#f3e6cc',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.heroNameText = scene.add
      .text(0, 0, 'GUERREIRO', {
        fontFamily: FONT_TITLE,
        fontSize: '12px',
        color: '#f0d9a7',
        fontStyle: 'bold',
        stroke: '#07090e',
        strokeThickness: 3,
        resolution: 2,
      })
      .setOrigin(0, 0.5);

    this.hpBarGraphic = scene.add.graphics();
    this.hpText = scene.add
      .text(0, 0, '100/100', {
        fontFamily: FONT_BODY,
        resolution: 2,
        fontSize: '11px',
        color: '#fff7ed',
        fontStyle: 'bold',
        stroke: '#07090e',
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    this.secondaryBarGraphic = scene.add.graphics();

    const heroFrameChildren: Phaser.GameObjects.GameObject[] = [
      this.portraitBgGraphic,
      this.portraitFallbackText,
    ];
    if (this.portraitSprite) {
      heroFrameChildren.push(this.portraitSprite);
    }
    heroFrameChildren.push(
      this.portraitRingGraphic,
      this.levelBadgeBg,
      this.levelBadgeText,
      this.heroNameText,
      this.hpBarGraphic,
      this.hpText,
      this.secondaryBarGraphic
    );

    this.heroFrameContainer = scene.add
      .container(0, 0, heroFrameChildren)
      .setScrollFactor(0)
      .setDepth(1010);

    // -------------------------------------------------------------------------
    // 2. TOP-LEFT: COMPACT OBJECTIVE TRACKER
    // -------------------------------------------------------------------------
    this.objectiveBg = scene.add.graphics();
    this.objectiveText = scene.add
      .text(0, 0, 'Sala 1/5', {
        fontFamily: FONT_BODY,
        resolution: 2,
        fontSize: '11px',
        color: '#e8dfd1',
        fontStyle: 'bold',
        stroke: '#07090e',
        strokeThickness: 2,
      })
      .setOrigin(0, 0.5);

    this.objectiveContainer = scene.add
      .container(0, 0, [this.objectiveBg, this.objectiveText])
      .setScrollFactor(0)
      .setDepth(1010);

    // -------------------------------------------------------------------------
    // 3. TOP-RIGHT: RESOURCES (SOULS & ESSENCES)
    // -------------------------------------------------------------------------
    this.soulsBg = scene.add.graphics();
    this.soulsFallbackGraphic = scene.add.graphics();
    this.soulsIcon = this.hasTextureFrame(UI_ICONS_KEY, ICON_FRAME.SOULS)
      ? scene.add.image(0, 0, UI_ICONS_KEY, ICON_FRAME.SOULS).setOrigin(0.5)
      : null;
    this.soulsText = scene.add
      .text(0, 0, '0', {
        fontFamily: FONT_BODY,
        resolution: 2,
        fontSize: '12px',
        color: '#a5f3fc',
        fontStyle: 'bold',
        stroke: '#07090e',
        strokeThickness: 2,
      })
      .setOrigin(1, 0.5);

    this.essenceBg = scene.add.graphics();
    this.essenceFallbackGraphic = scene.add.graphics();
    this.essenceIcon = this.hasTextureFrame(UI_ICONS_KEY, ICON_FRAME.ESSENCE)
      ? scene.add.image(0, 0, UI_ICONS_KEY, ICON_FRAME.ESSENCE).setOrigin(0.5)
      : null;
    this.essenceText = scene.add
      .text(0, 0, '0', {
        fontFamily: FONT_BODY,
        resolution: 2,
        fontSize: '11px',
        color: '#fcd34d',
        fontStyle: 'bold',
        stroke: '#07090e',
        strokeThickness: 2,
      })
      .setOrigin(1, 0.5);

    const resourceChildren: Phaser.GameObjects.GameObject[] = [
      this.soulsBg,
      this.soulsFallbackGraphic,
    ];
    if (this.soulsIcon) {
      resourceChildren.push(this.soulsIcon);
    }
    resourceChildren.push(
      this.soulsText,
      this.essenceBg,
      this.essenceFallbackGraphic
    );
    if (this.essenceIcon) {
      resourceChildren.push(this.essenceIcon);
    }
    resourceChildren.push(this.essenceText);

    this.resourcesContainer = scene.add
      .container(0, 0, resourceChildren)
      .setScrollFactor(0)
      .setDepth(1010);

    // -------------------------------------------------------------------------
    // 4. TOP-RIGHT: CIRCULAR MINIMAP
    // -------------------------------------------------------------------------
    this.minimapBg = scene.add.graphics();
    this.minimapDots = scene.add.graphics();
    this.minimapFrame = scene.add.graphics();

    this.minimapContainer = scene.add
      .container(0, 0, [this.minimapBg, this.minimapDots, this.minimapFrame])
      .setScrollFactor(0)
      .setDepth(1012);

    // -------------------------------------------------------------------------
    // 5. TOP-RIGHT UTILITY ROW: AUTO / BAG / AUDIO
    // -------------------------------------------------------------------------
    // 5a. AUTO button
    this.autoBtnBg = scene.add.graphics();
    this.autoBtnText = scene.add
      .text(0, 0, 'AUTO', {
        fontFamily: FONT_BODY,
        resolution: 2,
        fontSize: '9px',
        color: '#fde68a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.autoBtnZone = scene.add
      .zone(0, 0, 38, 38)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.autoBtnZone.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event?: Phaser.Types.Input.EventData
      ) => {
        event?.stopPropagation?.();
        soundManager.unlock();
        if (this.isRunEnded()) {
          return;
        }
        soundManager.play('ui_click');
        this.pulseContainer(this.autoBtnContainer);
        this.callbacks.onToggleAutoAttack?.();
      }
    );

    this.autoBtnContainer = scene.add
      .container(0, 0, [this.autoBtnBg, this.autoBtnText, this.autoBtnZone])
      .setScrollFactor(0)
      .setDepth(1020);

    // 5b. Bag button
    this.bagBtnBg = scene.add.graphics();
    this.bagBtnIcon = this.hasTextureFrame(UI_ICONS_KEY, ICON_FRAME.BAG)
      ? scene.add.image(0, 0, UI_ICONS_KEY, ICON_FRAME.BAG).setOrigin(0.5)
      : null;
    this.bagBtnFallbackText = scene.add
      .text(0, 0, 'I', {
        fontFamily: FONT_BODY,
        resolution: 2,
        fontSize: '12px',
        color: '#e8dfd1',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.bagBadgeBg = scene.add.graphics();
    this.bagBadgeText = scene.add
      .text(0, 0, '0', {
        fontFamily: FONT_BODY,
        resolution: 2,
        fontSize: '9px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.bagHotkeyText = scene.add
      .text(0, 22, 'I', {
        fontFamily: FONT_BODY,
        resolution: 2,
        fontSize: '9px',
        color: '#94a3b8',
        fontStyle: 'bold',
        stroke: '#07090e',
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    this.bagBtnZone = scene.add
      .zone(0, 0, 38, 38)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.bagBtnZone.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event?: Phaser.Types.Input.EventData
      ) => {
        event?.stopPropagation?.();
        soundManager.unlock();
        if (this.isRunEnded()) {
          return;
        }
        soundManager.play('ui_click');
        this.pulseContainer(this.bagBtnContainer);
        this.callbacks.onToggleInventory?.();
      }
    );

    const bagChildren: Phaser.GameObjects.GameObject[] = [
      this.bagBtnBg,
      this.bagBtnFallbackText,
    ];
    if (this.bagBtnIcon) {
      bagChildren.push(this.bagBtnIcon);
    }
    bagChildren.push(
      this.bagBadgeBg,
      this.bagBadgeText,
      this.bagHotkeyText,
      this.bagBtnZone
    );

    this.bagBtnContainer = scene.add
      .container(0, 0, bagChildren)
      .setScrollFactor(0)
      .setDepth(1020);

    // 5c. Audio / Mute button
    this.muteBtnBg = scene.add.graphics();
    this.muteBtnIcon = this.hasTextureFrame(UI_ICONS_KEY, ICON_FRAME.AUDIO_ON)
      ? scene.add.image(0, 0, UI_ICONS_KEY, ICON_FRAME.AUDIO_ON).setOrigin(0.5)
      : null;
    this.muteBtnFallbackText = scene.add
      .text(0, 0, 'ON', {
        fontFamily: FONT_BODY,
        resolution: 2,
        fontSize: '9px',
        color: '#e8dfd1',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.muteHotkeyText = scene.add
      .text(0, 22, 'M', {
        fontFamily: FONT_BODY,
        resolution: 2,
        fontSize: '9px',
        color: '#94a3b8',
        fontStyle: 'bold',
        stroke: '#07090e',
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    this.muteBtnZone = scene.add
      .zone(0, 0, 38, 38)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.muteBtnZone.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event?: Phaser.Types.Input.EventData
      ) => {
        event?.stopPropagation?.();
        soundManager.unlock();
        const muted = soundManager.toggleMute();
        this.pulseContainer(this.muteBtnContainer);
        this.refreshMuteButtonState();
        if (!muted) {
          soundManager.play('ui_click');
        }
      }
    );

    const muteChildren: Phaser.GameObjects.GameObject[] = [
      this.muteBtnBg,
      this.muteBtnFallbackText,
    ];
    if (this.muteBtnIcon) {
      muteChildren.push(this.muteBtnIcon);
    }
    muteChildren.push(this.muteHotkeyText, this.muteBtnZone);

    this.muteBtnContainer = scene.add
      .container(0, 0, muteChildren)
      .setScrollFactor(0)
      .setDepth(1020);

    // -------------------------------------------------------------------------
    // 6. TOP-CENTER: BOSS HP BAR
    // -------------------------------------------------------------------------
    this.bossBarGraphic = scene.add.graphics();
    this.bossNameText = scene.add
      .text(0, -17, 'CARCEREIRO INFERNAL', {
        fontFamily: FONT_TITLE,
        fontSize: '12px',
        color: '#fca5a5',
        fontStyle: 'bold',
        stroke: '#07090e',
        strokeThickness: 3,
        resolution: 2,
      })
      .setOrigin(0.5);
    this.bossHpText = scene.add
      .text(0, 0, '0/0', {
        fontFamily: FONT_BODY,
        resolution: 2,
        fontSize: '10px',
        color: '#fff7ed',
        fontStyle: 'bold',
        stroke: '#07090e',
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    this.bossContainer = scene.add
      .container(0, 0, [this.bossBarGraphic, this.bossNameText, this.bossHpText])
      .setScrollFactor(0)
      .setDepth(1015)
      .setVisible(false);

    // -------------------------------------------------------------------------
    // 7. STATUS / NARRATIVE BANNER
    // -------------------------------------------------------------------------
    this.bannerBg = scene.add.graphics();
    this.bannerLabel = scene.add
      .text(0, 0, '', {
        fontFamily: FONT_BODY,
        resolution: 2,
        fontSize: '11px',
        color: '#f1e8d6',
        align: 'center',
        wordWrap: { width: 420 },
      })
      .setOrigin(0.5);

    this.bannerContainer = scene.add
      .container(0, 0, [this.bannerBg, this.bannerLabel])
      .setScrollFactor(0)
      .setDepth(1014)
      .setVisible(false);

    // -------------------------------------------------------------------------
    // 8. BOTTOM-RIGHT: PRIMARY ATTACK BUTTON & SATELLITE SKILL ARC
    // -------------------------------------------------------------------------
    this.attackBtnBg = scene.add.graphics();
    this.attackBtnIcon = this.hasTextureFrame(UI_ICONS_KEY, ICON_FRAME.ATTACK)
      ? scene.add.image(0, 0, UI_ICONS_KEY, ICON_FRAME.ATTACK).setOrigin(0.5)
      : null;
    this.attackBtnFallbackText = scene.add
      .text(0, 0, 'ATK', {
        fontFamily: FONT_BODY,
        resolution: 2,
        fontSize: '12px',
        color: '#fff7ed',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.attackBtnZone = scene.add
      .zone(0, 0, 76, 76)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.attackBtnZone.on(
      'pointerdown',
      (
        pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event?: Phaser.Types.Input.EventData
      ) => {
        event?.stopPropagation?.();
        soundManager.unlock();
        if (this.isRunEnded()) {
          return;
        }
        if (pointer.id >= 0) {
          this.pulseContainer(this.attackBtnContainer);
          this.callbacks.onBasicAttack?.();
        }
      }
    );

    const attackChildren: Phaser.GameObjects.GameObject[] = [
      this.attackBtnBg,
      this.attackBtnFallbackText,
    ];
    if (this.attackBtnIcon) {
      attackChildren.push(this.attackBtnIcon);
    }
    attackChildren.push(this.attackBtnZone);

    this.attackBtnContainer = scene.add
      .container(0, 0, attackChildren)
      .setScrollFactor(0)
      .setDepth(1022);

    this.buildSkillButtons();

    // -------------------------------------------------------------------------
    // 9. END-OF-RUN MODAL (VICTORY / DEFEAT)
    // -------------------------------------------------------------------------
    this.modalBackdrop = scene.add.graphics();
    this.modalBox = scene.add.graphics();
    this.modalTitleText = scene.add
      .text(0, -76, '', {
        fontFamily: FONT_TITLE,
        fontSize: '16px',
        color: '#f0c46c',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: 300 },
        resolution: 2,
      })
      .setOrigin(0.5);

    this.modalBodyText = scene.add
      .text(0, -18, '', {
        fontFamily: FONT_BODY,
        resolution: 2,
        fontSize: '12px',
        color: '#e8dfd1',
        align: 'center',
        wordWrap: { width: 290 },
      })
      .setOrigin(0.5);

    this.modalSoulsText = scene.add
      .text(0, 34, '', {
        fontFamily: FONT_BODY,
        resolution: 2,
        fontSize: '13px',
        color: '#90e0ef',
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5);

    this.modalLootText = scene.add
      .text(0, 52, '', {
        fontFamily: FONT_BODY,
        resolution: 2,
        fontSize: '11px',
        color: '#a5f3fc',
        align: 'center',
        wordWrap: { width: 290 },
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.restartBtnBg = scene.add.graphics();
    this.restartBtnBg.fillStyle(0x7f1d1d, 0.96);
    this.restartBtnBg.fillRoundedRect(-90, -20, 180, 40, 6);
    this.restartBtnBg.lineStyle(2, 0xf0c46c, 1);
    this.restartBtnBg.strokeRoundedRect(-90, -20, 180, 40, 6);

    this.restartBtnText = scene.add
      .text(0, 0, 'Nova Incursão', {
        fontFamily: FONT_BODY,
        resolution: 2,
        fontSize: '14px',
        color: '#fff7ed',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.restartBtnZone = scene.add
      .zone(0, 0, 180, 40)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.restartBtnZone.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event?: Phaser.Types.Input.EventData
      ) => {
        event?.stopPropagation?.();
        soundManager.unlock();
        soundManager.play('ui_click');
        this.callbacks.onRestartRun();
      }
    );

    this.restartBtnContainer = scene.add.container(0, 82, [
      this.restartBtnBg,
      this.restartBtnText,
      this.restartBtnZone,
    ]);

    this.modalContainer = scene.add
      .container(0, 0, [
        this.modalBackdrop,
        this.modalBox,
        this.modalTitleText,
        this.modalBodyText,
        this.modalSoulsText,
        this.modalLootText,
        this.restartBtnContainer,
      ])
      .setScrollFactor(0)
      .setDepth(1050)
      .setVisible(false);

    // -------------------------------------------------------------------------
    // 10. KEYBOARD CONTROLS
    // -------------------------------------------------------------------------
    if (scene.input.keyboard) {
      this.movementKeys = {
        up: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
        down: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
        left: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
        right: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
        w: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        s: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        a: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        d: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }

    this.keydownHandler = (event: KeyboardEvent) => this.handleKeyDown(event);
    scene.input.keyboard?.on('keydown', this.keydownHandler);

    this.resize(this.viewport);
    this.update(this.lastSnapshot);
  }

  public getMoveVector(): Vector2D {
    if (this.isRunEnded()) {
      return { x: 0, y: 0 };
    }

    let vx = 0;
    let vy = 0;

    if (this.movementKeys) {
      if (this.movementKeys.left.isDown || this.movementKeys.a.isDown) {
        vx -= 1;
      }
      if (this.movementKeys.right.isDown || this.movementKeys.d.isDown) {
        vx += 1;
      }
      if (this.movementKeys.up.isDown || this.movementKeys.w.isDown) {
        vy -= 1;
      }
      if (this.movementKeys.down.isDown || this.movementKeys.s.isDown) {
        vy += 1;
      }
    }

    const joyDir = this.joystick.getDirection();
    if (joyDir.x !== 0 || joyDir.y !== 0) {
      vx += joyDir.x;
      vy += joyDir.y;
    }

    const length = Math.hypot(vx, vy);
    if (length === 0) {
      return { x: 0, y: 0 };
    }

    return {
      x: vx / length,
      y: vy / length,
    };
  }

  public update(snapshot: HudSnapshot): void {
    this.lastSnapshot = snapshot;

    // 1. Top-Left: Hero Frame + HP + Secondary Bar + Objective Tracker
    this.updateHeroFrame(snapshot);
    this.updateObjectiveTracker(snapshot);

    // 2. Top-Right: Resources + Minimap + Utility Buttons
    this.updateResources(snapshot);
    this.drawMinimapDots(snapshot);
    this.refreshAutoButtonState(snapshot.autoAttackEnabled !== false);
    this.refreshBagButtonState(snapshot.bagCount ?? 0);
    this.refreshMuteButtonState();

    // 3. Top-Center: Boss HP Bar
    const showBossBar =
      snapshot.bossHp !== undefined &&
      typeof snapshot.bossMaxHp === 'number' &&
      snapshot.bossMaxHp > 0;
    this.bossContainer.setVisible(showBossBar);
    if (showBossBar) {
      const bossMax = snapshot.bossMaxHp ?? 1;
      const bossHp = Math.max(0, Math.min(snapshot.bossHp ?? 0, bossMax));
      this.bossNameText.setText(
        (snapshot.bossName || 'Carcereiro Infernal').toUpperCase()
      );
      this.bossHpText.setText(`${Math.ceil(bossHp)}/${bossMax}`);
      this.drawBossHpBar(bossHp, bossMax);
    }

    // 4. Narrative / Status Banner
    const resolvedBanner =
      snapshot.bannerText ??
      (snapshot.runStatus === 'room_cleared'
        ? dialoguesData.entries.room_clear.shortText
        : '');
    if (resolvedBanner && !this.isRunEnded()) {
      this.positionBanner(showBossBar);
      this.bannerContainer.setVisible(true);
      this.bannerLabel.setText(resolvedBanner);
      this.drawBannerBox();
    } else {
      this.bannerContainer.setVisible(false);
    }

    // 5. Skill Buttons Cooldowns & Potion Charges
    for (const btn of this.skillButtons) {
      const cdRemainingMs = Math.max(0, snapshot.skillCooldownsMs[btn.skill.id] ?? 0);
      const isOnCooldown = cdRemainingMs > 0;
      const isOutOfCharges =
        btn.skill.slot === 'potion' && snapshot.potionCharges <= 0;

      const hasIcon =
        btn.iconImage !== null &&
        this.hasTextureFrame(UI_ICONS_KEY, btn.iconFrame);

      if (btn.iconImage) {
        btn.iconImage.setVisible(hasIcon);
        if (hasIcon) {
          btn.iconImage.setAlpha(isOnCooldown ? 0.36 : isOutOfCharges ? 0.3 : 1);
        }
      }

      // Hide fallback label during cooldown (T-011) or when sprite icon is displayed
      btn.fallbackLabelText.setVisible(!hasIcon && !isOnCooldown);

      if (btn.chargesText && btn.chargesBg) {
        this.drawPotionChargesBadge(btn, snapshot.potionCharges);
      }

      if (isOnCooldown) {
        btn.cooldownText.setVisible(true);
        btn.cooldownText.setText(
          cdRemainingMs >= 10000
            ? `${Math.ceil(cdRemainingMs / 1000)}s`
            : `${(cdRemainingMs / 1000).toFixed(1)}s`
        );
      } else {
        btn.cooldownText.setVisible(false);
      }

      this.drawSkillButtonState(
        btn,
        cdRemainingMs,
        btn.skill.cooldownMs,
        isOutOfCharges
      );
    }

    // 6. Victory / Defeat Modal
    if (this.isRunEnded()) {
      this.modalContainer.setVisible(true);
      const isVictory = snapshot.runStatus === 'victory';
      const entry = isVictory
        ? dialoguesData.entries.run_victory
        : dialoguesData.entries.run_death;

      const lootText = snapshot.lootSummaryText?.trim() ?? '';
      const hasLootSummary = lootText.length > 0;

      this.modalTitleText.setText(entry.title);
      this.modalTitleText.setColor(isVictory ? '#f0c46c' : '#ff4d6d');
      this.modalBodyText.setText(snapshot.bannerText || entry.text);
      this.modalSoulsText.setText(`Almas preservadas: ${snapshot.souls}`);

      if (hasLootSummary) {
        this.modalTitleText.setY(-92);
        this.modalBodyText.setY(-40);
        this.modalSoulsText.setY(14);
        this.modalLootText.setY(48).setText(lootText).setVisible(true);
        this.restartBtnContainer.setY(100);
      } else {
        this.modalTitleText.setY(-76);
        this.modalBodyText.setY(-18);
        this.modalSoulsText.setY(34);
        this.modalLootText.setVisible(false);
        this.restartBtnContainer.setY(82);
      }

      this.drawModalBackground(isVictory, hasLootSummary);
    } else {
      this.modalContainer.setVisible(false);
    }
  }

  public resize(viewport: ViewportConfig): void {
    this.viewport = viewport;
    this.joystick.resize(viewport);

    const isMobile = viewport.mode === 'mobile_portrait';
    const w = viewport.width;
    const h = viewport.height;

    this.minimapRadius = isMobile ? 30 : 36;
    this.utilityBtnRadius = isMobile ? 15 : 17;
    this.attackBtnRadius = isMobile ? 31 : 34;

    // 1. Top-Left Hero Frame + Objective Tracker
    this.layoutHeroFrame(isMobile);
    this.layoutObjectiveTracker(isMobile);

    // 2. Top-Right Resources + Minimap + Utility Row
    this.layoutMinimapAndTopRight(isMobile, w);

    // 3. Top-Center Boss Bar & Banner
    this.bossContainer.setPosition(w / 2, isMobile ? 140 : 44);
    this.bossNameText.setFontSize(isMobile ? 11 : 12);
    this.bossHpText.setFontSize(isMobile ? 10 : 10);
    this.bannerLabel.setWordWrapWidth(isMobile ? w - 44 : 420);
    const hasBoss =
      this.lastSnapshot.bossHp !== undefined &&
      typeof this.lastSnapshot.bossMaxHp === 'number' &&
      this.lastSnapshot.bossMaxHp > 0;
    this.positionBanner(hasBoss);

    // 4. Bottom-Right Ergonomic Diablo Arc Cluster
    this.layoutActionCluster(isMobile, w, h);

    // 5. End-of-Run Modal
    this.modalContainer.setPosition(w / 2, h / 2);
    const modalWidth = isMobile ? w - 32 : 440;
    this.modalTitleText.setWordWrapWidth(modalWidth - 32);
    this.modalBodyText.setWordWrapWidth(modalWidth - 36);
    this.modalLootText.setWordWrapWidth(modalWidth - 36);

    this.update(this.lastSnapshot);
  }

  public destroy(): void {
    this.scene.input.keyboard?.off('keydown', this.keydownHandler);
    this.joystick.destroy();

    if (this.portraitSprite) {
      this.portraitSprite.clearMask(false);
    }
    this.portraitMaskGfx?.destroy();

    this.heroFrameContainer.destroy();
    this.objectiveContainer.destroy();
    this.resourcesContainer.destroy();
    this.minimapContainer.destroy();
    this.autoBtnContainer.destroy();
    this.bagBtnContainer.destroy();
    this.muteBtnContainer.destroy();
    this.bossContainer.destroy();
    this.bannerContainer.destroy();
    this.attackBtnContainer.destroy();
    this.modalContainer.destroy();

    for (const btn of this.skillButtons) {
      btn.container.destroy();
    }
  }

  // ===========================================================================
  // TOP-LEFT: HERO FRAME & OBJECTIVE TRACKER
  // ===========================================================================

  private getHeroFrameMetrics(isMobile: boolean): {
    cx: number;
    cy: number;
    r: number;
    barX: number;
    hpY: number;
    hpW: number;
    hpH: number;
    secY: number;
    secW: number;
    secH: number;
    nameX: number;
    nameY: number;
  } {
    if (isMobile) {
      return {
        cx: 34,
        cy: 34,
        r: 23,
        barX: 62,
        hpY: 25,
        hpW: 118,
        hpH: 14,
        secY: 42,
        secW: 96,
        secH: 5,
        nameX: 64,
        nameY: 14,
      };
    }

    return {
      cx: 44,
      cy: 42,
      r: 28,
      barX: 78,
      hpY: 32,
      hpW: 162,
      hpH: 16,
      secY: 52,
      secW: 136,
      secH: 6,
      nameX: 80,
      nameY: 18,
    };
  }

  private layoutHeroFrame(isMobile: boolean): void {
    const m = this.getHeroFrameMetrics(isMobile);

    // Dark obsidian backing disc
    this.portraitBgGraphic.clear();
    this.portraitBgGraphic.fillStyle(0x090b10, 0.94);
    this.portraitBgGraphic.fillCircle(m.cx, m.cy, m.r);

    // Circular mask aligned 1:1 on uiCamera (scroll = 0, zoom = 1)
    if (this.portraitMaskGfx) {
      this.portraitMaskGfx.clear();
      this.portraitMaskGfx.fillStyle(0xffffff, 1);
      this.portraitMaskGfx.fillCircle(m.cx, m.cy, m.r - 2);
    }

    if (this.portraitSprite) {
      const spriteSize = (m.r - 1) * 2;
      this.portraitSprite
        .setPosition(m.cx, m.cy + 1)
        .setDisplaySize(spriteSize, spriteSize);
    }

    this.portraitFallbackText
      .setPosition(m.cx, m.cy)
      .setFontSize(isMobile ? 13 : 15);

    // Metallic bronze/steel double ring frame around portrait
    this.portraitRingGraphic.clear();
    this.portraitRingGraphic.lineStyle(3.5, 0x262b36, 1);
    this.portraitRingGraphic.strokeCircle(m.cx, m.cy, m.r + 1);
    this.portraitRingGraphic.lineStyle(2, 0xb89052, 0.98);
    this.portraitRingGraphic.strokeCircle(m.cx, m.cy, m.r);
    this.portraitRingGraphic.lineStyle(1, 0x090b10, 0.85);
    this.portraitRingGraphic.strokeCircle(m.cx, m.cy, m.r - 2);

    // 4 small metallic studs on the ring
    const studOffsets = [
      { x: 0, y: -m.r },
      { x: m.r, y: 0 },
      { x: -m.r, y: 0 },
    ];
    this.portraitRingGraphic.fillStyle(0xf0c46c, 0.95);
    for (const s of studOffsets) {
      this.portraitRingGraphic.fillCircle(m.cx + s.x, m.cy + s.y, 1.8);
    }

    // Level badge ("Nv. X") anchored at bottom of circular portrait
    const badgeW = isMobile ? 38 : 44;
    const badgeH = isMobile ? 13 : 15;
    const badgeY = m.cy + m.r + 1;
    this.levelBadgeBg.clear();
    this.levelBadgeBg.fillStyle(0x0b0e16, 0.96);
    this.levelBadgeBg.fillRoundedRect(
      m.cx - badgeW / 2,
      badgeY - badgeH / 2,
      badgeW,
      badgeH,
      4
    );
    this.levelBadgeBg.lineStyle(1.2, 0xc9a25e, 0.95);
    this.levelBadgeBg.strokeRoundedRect(
      m.cx - badgeW / 2,
      badgeY - badgeH / 2,
      badgeW,
      badgeH,
      4
    );
    this.levelBadgeText
      .setPosition(m.cx, badgeY)
      .setFontSize(isMobile ? 8 : 9);

    this.heroNameText
      .setPosition(m.nameX, m.nameY)
      .setFontSize(isMobile ? 11 : 13);
    this.hpText
      .setPosition(m.barX + m.hpW * 0.46, m.hpY + m.hpH / 2)
      .setFontSize(isMobile ? 10 : 11);
  }

  private updateHeroFrame(snapshot: HudSnapshot): void {
    const isMobile = this.viewport.mode === 'mobile_portrait';
    const m = this.getHeroFrameMetrics(isMobile);

    const frame = snapshot.heroPortraitFrame ?? 0;
    const isWraith = frame === 1;
    const defaultName = isWraith ? 'ESPECTRO' : 'GUERREIRO';
    const displayName = (snapshot.heroName?.trim() || defaultName).toUpperCase();
    const level = Math.max(1, Math.floor(snapshot.heroLevel ?? 1));

    this.heroNameText.setText(displayName);
    this.levelBadgeText.setText(`Nv. ${level}`);

    const hasPortrait =
      this.portraitSprite !== null && this.hasTextureFrame(PORTRAITS_KEY, frame);
    if (this.portraitSprite) {
      this.portraitSprite.setVisible(hasPortrait);
      if (hasPortrait) {
        this.portraitSprite.setFrame(frame);
        const spriteSize = (m.r - 1) * 2;
        this.portraitSprite.setDisplaySize(spriteSize, spriteSize);
      }
    }
    this.portraitFallbackText
      .setText(displayName.slice(0, 2))
      .setVisible(!hasPortrait);

    // Chamfered metallic HP bar
    const clampedHp = Math.max(0, Math.min(snapshot.hp, snapshot.maxHp));
    const ratio = snapshot.maxHp > 0 ? Math.max(0, Math.min(1, clampedHp / snapshot.maxHp)) : 0;
    this.hpText.setText(`${Math.ceil(clampedHp)}/${snapshot.maxHp}`);

    const bevel = isMobile ? 7 : 9;
    this.hpBarGraphic.clear();

    // Dark recessed steel track
    this.drawChamferedBar(
      this.hpBarGraphic,
      m.barX,
      m.hpY,
      m.hpW,
      m.hpH,
      bevel,
      0x11141d,
      0.94
    );

    if (ratio > 0) {
      const fillW = Math.max(bevel + 2, m.hpW * ratio);
      const fillBevel = Math.min(bevel, fillW * 0.35);
      const mainColor = ratio > 0.32 ? 0xb91c1c : 0xe11d48;
      const highlightColor = ratio > 0.32 ? 0xef4444 : 0xfb7185;
      this.drawChamferedBar(
        this.hpBarGraphic,
        m.barX + 1,
        m.hpY + 1,
        Math.max(4, fillW - 2),
        m.hpH - 2,
        fillBevel,
        mainColor,
        0.98
      );
      // Top glossy highlight band
      this.drawChamferedBar(
        this.hpBarGraphic,
        m.barX + 2,
        m.hpY + 2,
        Math.max(3, fillW - 6),
        Math.max(2, Math.floor((m.hpH - 4) * 0.42)),
        Math.max(2, fillBevel * 0.5),
        highlightColor,
        0.55
      );
    }

    // Metallic dark steel & bronze border
    this.strokeChamferedBar(
      this.hpBarGraphic,
      m.barX,
      m.hpY,
      m.hpW,
      m.hpH,
      bevel,
      1.6,
      0x7c6850,
      0.96
    );
    this.strokeChamferedBar(
      this.hpBarGraphic,
      m.barX - 1,
      m.hpY - 1,
      m.hpW + 2,
      m.hpH + 2,
      bevel,
      1,
      0x272c38,
      0.9
    );

    // Thin secondary bar (amber for living warrior, spectral cyan for wraith)
    const secRatio = snapshot.isTestArena
      ? 1
      : Math.max(
          0.12,
          Math.min(1, snapshot.roomNumber / Math.max(1, snapshot.totalRooms))
        );
    const secBevel = 4;
    this.secondaryBarGraphic.clear();
    this.drawChamferedBar(
      this.secondaryBarGraphic,
      m.barX,
      m.secY,
      m.secW,
      m.secH,
      secBevel,
      0x10131c,
      0.92
    );
    const secFillColor = isWraith ? 0x38bdf8 : 0xd97706;
    const secHiColor = isWraith ? 0xbae6fd : 0xfbbf24;
    const secFillW = Math.max(6, (m.secW - 2) * secRatio);
    this.drawChamferedBar(
      this.secondaryBarGraphic,
      m.barX + 1,
      m.secY + 1,
      secFillW,
      m.secH - 2,
      Math.min(secBevel, secFillW * 0.3),
      secFillColor,
      0.95
    );
    this.secondaryBarGraphic.fillStyle(secHiColor, 0.5);
    this.secondaryBarGraphic.fillRect(
      m.barX + 2,
      m.secY + 1,
      Math.max(2, secFillW - 4),
      1.5
    );
    this.strokeChamferedBar(
      this.secondaryBarGraphic,
      m.barX,
      m.secY,
      m.secW,
      m.secH,
      secBevel,
      1,
      0x475569,
      0.85
    );
  }

  private layoutObjectiveTracker(isMobile: boolean): void {
    const x = isMobile ? 12 : 18;
    const y = isMobile ? 69 : 84;
    const w = isMobile ? 182 : 226;
    const h = isMobile ? 21 : 23;

    this.objectiveContainer.setPosition(x, y);

    this.objectiveBg.clear();
    this.objectiveBg.fillStyle(0x090b10, 0.68);
    this.objectiveBg.fillRoundedRect(0, 0, w, h, 3);
    // Subtle left bronze accent edge
    this.objectiveBg.fillStyle(0xc9a25e, 0.85);
    this.objectiveBg.fillRect(0, 2, 2, h - 4);
    this.objectiveBg.lineStyle(1, 0x3a4152, 0.55);
    this.objectiveBg.strokeRoundedRect(0, 0, w, h, 3);

    // Golden diamond emblem
    const dx = 11;
    const dy = h / 2;
    const dr = isMobile ? 3.8 : 4.4;
    this.objectiveBg.fillStyle(0xf0c46c, 0.98);
    this.objectiveBg.fillPoints(
      [
        { x: dx, y: dy - dr },
        { x: dx + dr, y: dy },
        { x: dx, y: dy + dr },
        { x: dx - dr, y: dy },
      ],
      true
    );
    this.objectiveBg.lineStyle(1, 0x7c5b2b, 0.9);
    this.objectiveBg.strokePoints(
      [
        { x: dx, y: dy - dr },
        { x: dx + dr, y: dy },
        { x: dx, y: dy + dr },
        { x: dx - dr, y: dy },
      ],
      true
    );

    this.objectiveText
      .setPosition(21, h / 2)
      .setFontSize(isMobile ? 9 : 10);
  }

  private updateObjectiveTracker(snapshot: HudSnapshot): void {
    const isMobile = this.viewport.mode === 'mobile_portrait';
    const maxChars = isMobile ? 26 : 31;

    const rawObjective = snapshot.missionObjective?.trim();
    const fallbackRoom = snapshot.isTestArena
      ? snapshot.roomTitle || 'Arena de Combate'
      : `Sala ${snapshot.roomNumber}/${snapshot.totalRooms} · ${snapshot.roomTitle || ''}`.replace(
          /\s*·\s*$/,
          ''
        );
    const line = rawObjective && rawObjective.length > 0 ? rawObjective : fallbackRoom;
    const truncated =
      line.length > maxChars ? `${line.slice(0, maxChars - 1).trimEnd()}…` : line;

    this.objectiveText.setText(truncated);
  }

  // ===========================================================================
  // TOP-RIGHT: RESOURCES, CIRCULAR MINIMAP & UTILITY BUTTONS
  // ===========================================================================

  private layoutMinimapAndTopRight(isMobile: boolean, w: number): void {
    const mapR = this.minimapRadius;
    const mapX = isMobile ? w - 40 : w - 50;
    const mapY = isMobile ? 40 : 48;
    this.minimapContainer.setPosition(mapX, mapY);
    this.drawMinimapStaticShell(mapR);

    // Resources stacked cleanly to the left of the circular minimap
    const resRightX = mapX - mapR - (isMobile ? 8 : 10);
    const pillW = isMobile ? 76 : 92;
    const pillH = isMobile ? 21 : 24;
    const soulsY = isMobile ? 24 : 28;
    const essenceY = isMobile ? 48 : 56;

    this.resourcesContainer.setPosition(0, 0);

    // Souls pill
    this.soulsBg.clear();
    this.soulsBg.fillStyle(0x090b10, 0.78);
    this.soulsBg.fillRoundedRect(resRightX - pillW, soulsY - pillH / 2, pillW, pillH, 5);
    this.soulsBg.lineStyle(1, 0x5c5346, 0.85);
    this.soulsBg.strokeRoundedRect(
      resRightX - pillW,
      soulsY - pillH / 2,
      pillW,
      pillH,
      5
    );

    const iconSize = isMobile ? 16 : 18;
    const soulsIconX = resRightX - pillW + 13;
    if (this.soulsIcon) {
      this.soulsIcon
        .setPosition(soulsIconX, soulsY)
        .setDisplaySize(iconSize, iconSize);
    }
    this.soulsFallbackGraphic.clear();
    this.soulsFallbackGraphic.fillStyle(0x38bdf8, 0.95);
    this.soulsFallbackGraphic.fillCircle(soulsIconX, soulsY, 5);
    this.soulsFallbackGraphic.lineStyle(1, 0xbae6fd, 0.95);
    this.soulsFallbackGraphic.strokeCircle(soulsIconX, soulsY, 5);

    this.soulsText
      .setPosition(resRightX - 7, soulsY)
      .setFontSize(isMobile ? 11 : 12);

    // Essences pill (below Souls, visibility toggled in updateResources)
    const essH = isMobile ? 19 : 21;
    this.essenceBg.clear();
    this.essenceBg.fillStyle(0x090b10, 0.78);
    this.essenceBg.fillRoundedRect(resRightX - pillW, essenceY - essH / 2, pillW, essH, 5);
    this.essenceBg.lineStyle(1, 0x8c6d46, 0.85);
    this.essenceBg.strokeRoundedRect(
      resRightX - pillW,
      essenceY - essH / 2,
      pillW,
      essH,
      5
    );

    const essIconX = resRightX - pillW + 13;
    if (this.essenceIcon) {
      this.essenceIcon
        .setPosition(essIconX, essenceY)
        .setDisplaySize(iconSize - 2, iconSize - 2);
    }
    this.essenceFallbackGraphic.clear();
    this.essenceFallbackGraphic.fillStyle(0xf59e0b, 0.95);
    this.essenceFallbackGraphic.fillPoints(
      [
        { x: essIconX, y: essenceY - 5 },
        { x: essIconX + 5, y: essenceY },
        { x: essIconX, y: essenceY + 5 },
        { x: essIconX - 5, y: essenceY },
      ],
      true
    );
    this.essenceText
      .setPosition(resRightX - 7, essenceY)
      .setFontSize(isMobile ? 10 : 11);

    // 3 Compact Circular Utility Buttons below the minimap
    const r = this.utilityBtnRadius;
    const gap = isMobile ? 36 : 42;
    const rowY = mapY + mapR + r + 8;
    const rightMostX = isMobile ? w - 26 : w - 32;

    this.muteBtnContainer.setPosition(rightMostX, rowY);
    this.bagBtnContainer.setPosition(rightMostX - gap, rowY);
    this.autoBtnContainer.setPosition(rightMostX - gap * 2, rowY);

    const hitSize = r * 2 + 6;
    this.autoBtnZone.setSize(hitSize, hitSize);
    this.bagBtnZone.setSize(hitSize, hitSize);
    this.muteBtnZone.setSize(hitSize, hitSize);

    this.autoBtnText.setFontSize(isMobile ? 8 : 9);
    const utilIconSize = isMobile ? 19 : 22;
    if (this.bagBtnIcon) {
      this.bagBtnIcon.setDisplaySize(utilIconSize, utilIconSize);
    }
    if (this.muteBtnIcon) {
      this.muteBtnIcon.setDisplaySize(utilIconSize, utilIconSize);
    }

    // Discrete PC hotkeys only on desktop
    this.bagHotkeyText.setPosition(0, r + 9).setVisible(!isMobile);
    this.muteHotkeyText.setPosition(0, r + 9).setVisible(!isMobile);
  }

  private updateResources(snapshot: HudSnapshot): void {
    this.soulsText.setText(`${snapshot.souls}`);

    const hasSoulsIcon =
      this.soulsIcon !== null &&
      this.hasTextureFrame(UI_ICONS_KEY, ICON_FRAME.SOULS);
    if (this.soulsIcon) {
      this.soulsIcon.setVisible(hasSoulsIcon);
      if (hasSoulsIcon) {
        this.soulsIcon.setFrame(ICON_FRAME.SOULS);
      }
    }
    this.soulsFallbackGraphic.setVisible(!hasSoulsIcon);

    const essences = snapshot.essences ?? 0;
    const showEssence = essences > 0;
    this.essenceBg.setVisible(showEssence);
    this.essenceText.setVisible(showEssence);
    if (showEssence) {
      this.essenceText.setText(`${essences}`);
      const hasEssIcon =
        this.essenceIcon !== null &&
        this.hasTextureFrame(UI_ICONS_KEY, ICON_FRAME.ESSENCE);
      if (this.essenceIcon) {
        this.essenceIcon.setVisible(hasEssIcon);
        if (hasEssIcon) {
          this.essenceIcon.setFrame(ICON_FRAME.ESSENCE);
        }
      }
      this.essenceFallbackGraphic.setVisible(!hasEssIcon);
    } else {
      this.essenceIcon?.setVisible(false);
      this.essenceFallbackGraphic.setVisible(false);
    }
  }

  private drawMinimapStaticShell(r: number): void {
    this.minimapBg.clear();
    this.minimapBg.fillStyle(0x0a0c12, 0.88);
    this.minimapBg.fillCircle(0, 0, r);

    // Subtle radar crosshair & inner ring
    this.minimapBg.lineStyle(1, 0x263042, 0.55);
    this.minimapBg.lineBetween(-r + 4, 0, r - 4, 0);
    this.minimapBg.lineBetween(0, -r + 4, 0, r - 4);
    this.minimapBg.strokeCircle(0, 0, Math.round(r * 0.52));

    // Metallic Diablo circular rim + North pointer
    this.minimapFrame.clear();
    this.minimapFrame.lineStyle(3, 0x242833, 0.96);
    this.minimapFrame.strokeCircle(0, 0, r + 1);
    this.minimapFrame.lineStyle(1.8, 0xb89052, 0.96);
    this.minimapFrame.strokeCircle(0, 0, r);
    this.minimapFrame.lineStyle(1, 0x475569, 0.7);
    this.minimapFrame.strokeCircle(0, 0, r - 2.5);

    // Subtle golden North arrow notch on top
    this.minimapFrame.fillStyle(0xf0c46c, 0.96);
    this.minimapFrame.fillTriangle(0, -r - 4, -3.5, -r + 1, 3.5, -r + 1);
  }

  private drawMinimapDots(snapshot: HudSnapshot): void {
    const r = this.minimapRadius;
    const usableR = r - 6;

    this.minimapDots.clear();

    const map = snapshot.minimap;
    if (!map || map.arenaWidth <= 0 || map.arenaHeight <= 0) {
      // Fallback centered hero dot
      this.minimapDots.fillStyle(0x38bdf8, 0.35);
      this.minimapDots.fillCircle(0, 0, 5);
      this.minimapDots.fillStyle(0xffffff, 1);
      this.minimapDots.fillCircle(0, 0, 2.5);
      return;
    }

    const projectToCircle = (wx: number, wy: number): { x: number; y: number } => {
      const nx = (wx / map.arenaWidth) * 2 - 1;
      const ny = (wy / map.arenaHeight) * 2 - 1;
      const px = nx * usableR;
      const py = ny * usableR;
      const dist = Math.hypot(px, py);
      if (dist > usableR && dist > 0) {
        const scale = usableR / dist;
        return { x: px * scale, y: py * scale };
      }
      return { x: px, y: py };
    };

    // Enemies first so hero stays crisp on top
    for (const enemy of map.enemies) {
      const pt = projectToCircle(enemy.x, enemy.y);
      if (enemy.isBoss) {
        this.minimapDots.fillStyle(0xf97316, 0.35);
        this.minimapDots.fillCircle(pt.x, pt.y, 6);
        this.minimapDots.fillStyle(0xf97316, 1);
        this.minimapDots.fillCircle(pt.x, pt.y, 3.8);
        this.minimapDots.lineStyle(1, 0xfef08a, 0.95);
        this.minimapDots.strokeCircle(pt.x, pt.y, 3.8);
      } else {
        this.minimapDots.fillStyle(0xef4444, 0.96);
        this.minimapDots.fillCircle(pt.x, pt.y, 2.3);
      }
    }

    // Hero dot (cyan halo + bright white core)
    const heroPt = projectToCircle(map.heroX, map.heroY);
    this.minimapDots.fillStyle(0x38bdf8, 0.4);
    this.minimapDots.fillCircle(heroPt.x, heroPt.y, 5);
    this.minimapDots.fillStyle(0xe0f2fe, 1);
    this.minimapDots.fillCircle(heroPt.x, heroPt.y, 2.6);
  }

  private refreshAutoButtonState(enabled: boolean): void {
    const r = this.utilityBtnRadius;
    this.autoBtnBg.clear();
    if (enabled) {
      this.autoBtnBg.fillStyle(0xf0c46c, 0.14);
      this.autoBtnBg.fillCircle(0, 0, r + 3);
    }
    this.autoBtnBg.fillStyle(enabled ? 0x1c1710 : 0x0d1018, 0.92);
    this.autoBtnBg.fillCircle(0, 0, r);
    this.autoBtnBg.lineStyle(1.8, enabled ? 0xf0c46c : 0x475569, enabled ? 1 : 0.85);
    this.autoBtnBg.strokeCircle(0, 0, r);
    this.autoBtnBg.lineStyle(1, enabled ? 0x8c6d46 : 0x1e293b, 0.75);
    this.autoBtnBg.strokeCircle(0, 0, r - 2.5);

    this.autoBtnText.setColor(enabled ? '#fde68a' : '#64748b');
  }

  private refreshBagButtonState(bagCount: number): void {
    const r = this.utilityBtnRadius;
    this.bagBtnBg.clear();
    this.bagBtnBg.fillStyle(0x0f121b, 0.92);
    this.bagBtnBg.fillCircle(0, 0, r);
    this.bagBtnBg.lineStyle(1.6, bagCount > 0 ? 0xc9a25e : 0x5c6475, 0.95);
    this.bagBtnBg.strokeCircle(0, 0, r);
    this.bagBtnBg.lineStyle(1, 0x242a38, 0.8);
    this.bagBtnBg.strokeCircle(0, 0, r - 2.5);

    const hasIcon =
      this.bagBtnIcon !== null &&
      this.hasTextureFrame(UI_ICONS_KEY, ICON_FRAME.BAG);
    if (this.bagBtnIcon) {
      this.bagBtnIcon.setVisible(hasIcon);
      if (hasIcon) {
        this.bagBtnIcon.setFrame(ICON_FRAME.BAG);
      }
    }
    this.bagBtnFallbackText.setVisible(!hasIcon);

    // Numeric badge when bagCount > 0
    this.bagBadgeBg.clear();
    if (bagCount > 0) {
      const bx = Math.round(r * 0.72);
      const by = -Math.round(r * 0.72);
      this.bagBadgeBg.fillStyle(0xb91c1c, 0.98);
      this.bagBadgeBg.fillCircle(bx, by, 7.5);
      this.bagBadgeBg.lineStyle(1.2, 0xf0c46c, 0.98);
      this.bagBadgeBg.strokeCircle(bx, by, 7.5);
      this.bagBadgeText
        .setPosition(bx, by)
        .setText(bagCount > 99 ? '99' : `${bagCount}`)
        .setVisible(true);
    } else {
      this.bagBadgeText.setVisible(false);
    }
  }

  private refreshMuteButtonState(): void {
    const r = this.utilityBtnRadius;
    const muted = soundManager.isMuted();

    this.muteBtnBg.clear();
    this.muteBtnBg.fillStyle(muted ? 0x0b0d14 : 0x0f121b, 0.92);
    this.muteBtnBg.fillCircle(0, 0, r);
    this.muteBtnBg.lineStyle(1.6, muted ? 0x475569 : 0x8c7a62, 0.95);
    this.muteBtnBg.strokeCircle(0, 0, r);

    const frame = muted ? ICON_FRAME.AUDIO_OFF : ICON_FRAME.AUDIO_ON;
    const hasIcon =
      this.muteBtnIcon !== null && this.hasTextureFrame(UI_ICONS_KEY, frame);
    if (this.muteBtnIcon) {
      this.muteBtnIcon.setVisible(hasIcon);
      if (hasIcon) {
        this.muteBtnIcon.setFrame(frame);
        this.muteBtnIcon.setAlpha(muted ? 0.65 : 1);
      }
    }
    this.muteBtnFallbackText
      .setText(muted ? 'OFF' : 'ON')
      .setColor(muted ? '#64748b' : '#e8dfd1')
      .setVisible(!hasIcon);
  }

  // ===========================================================================
  // BOTTOM-RIGHT: ERGONOMIC DIABLO ACTION ARC
  // ===========================================================================

  private buildSkillButtons(): void {
    const orderedSlots: SkillSlot[] = ['dash', 'active_1', 'active_2', 'potion'];
    const defaultShortLabels: Record<SkillSlot, string> = {
      dash: 'DASH',
      active_1: 'SK1',
      active_2: 'SK2',
      potion: 'POÇ',
    };
    const defaultHotkeys: Record<SkillSlot, string> = {
      dash: 'Espaço',
      active_1: '1',
      active_2: '2',
      potion: 'Q',
    };

    orderedSlots.forEach((slot, idx) => {
      const skill = this.skillBySlot.get(slot) ?? this.skills[idx];
      if (!skill) {
        return;
      }

      const iconFrame = this.resolveSkillIconFrame(skill);
      const radius = 25;
      const bg = this.scene.add.graphics();
      const iconImage = this.hasTextureFrame(UI_ICONS_KEY, iconFrame)
        ? this.scene.add.image(0, 0, UI_ICONS_KEY, iconFrame).setOrigin(0.5)
        : null;

      const fallbackLabelText = this.scene.add
        .text(0, 0, defaultShortLabels[slot], {
          fontFamily: FONT_BODY,
        resolution: 2,
          fontSize: '10px',
          color: '#f8fafc',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      const cdOverlay = this.scene.add.graphics();
      const cooldownText = this.scene.add
        .text(0, 0, '', {
          fontFamily: FONT_BODY,
        resolution: 2,
          fontSize: '13px',
          color: '#ffd166',
          fontStyle: 'bold',
          stroke: '#05070c',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setVisible(false);

      const hotkeyBg = this.scene.add.graphics();
      const hotkeyText = this.scene.add
        .text(0, 0, defaultHotkeys[slot], {
          fontFamily: FONT_BODY,
        resolution: 2,
          fontSize: '9px',
          color: '#e2e8f0',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      const children: Phaser.GameObjects.GameObject[] = [bg];
      if (iconImage) {
        children.push(iconImage);
      }
      children.push(
        fallbackLabelText,
        cdOverlay,
        cooldownText,
        hotkeyBg,
        hotkeyText
      );

      let chargesBg: Phaser.GameObjects.Graphics | undefined;
      let chargesText: Phaser.GameObjects.Text | undefined;
      if (slot === 'potion') {
        chargesBg = this.scene.add.graphics();
        chargesText = this.scene.add
          .text(0, 0, '3', {
            fontFamily: FONT_BODY,
        resolution: 2,
            fontSize: '10px',
            color: '#fff7ed',
            fontStyle: 'bold',
          })
          .setOrigin(0.5);
        children.push(chargesBg, chargesText);
      }

      const hitZone = this.scene.add
        .zone(0, 0, radius * 2 + 8, radius * 2 + 8)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      hitZone.on(
        'pointerdown',
        (
          pointer: Phaser.Input.Pointer,
          _lx: number,
          _ly: number,
          event?: Phaser.Types.Input.EventData
        ) => {
          event?.stopPropagation?.();
          soundManager.unlock();
          if (this.isRunEnded()) {
            return;
          }
          if (pointer.id >= 0) {
            this.pulseContainer(container);
            this.callbacks.onUseSkill(skill.id);
          }
        }
      );

      children.push(hitZone);

      const container = this.scene.add
        .container(0, 0, children)
        .setScrollFactor(0)
        .setDepth(1020);

      this.skillButtons.push({
        skill,
        iconFrame,
        container,
        bg,
        iconImage,
        fallbackLabelText,
        cdOverlay,
        cooldownText,
        hotkeyBg,
        hotkeyText,
        chargesBg,
        chargesText,
        hitZone,
        radius,
      });
    });
  }

  private layoutActionCluster(isMobile: boolean, w: number, h: number): void {
    // Primary Attack Button anchor
    const atkR = this.attackBtnRadius;
    const atkX = isMobile ? w - 46 : w - 58;
    const atkY = isMobile ? h - 64 : h - 66;
    this.attackBtnContainer.setPosition(atkX, atkY);
    this.attackBtnZone.setSize(atkR * 2 + 8, atkR * 2 + 8);
    this.drawPrimaryAttackButton(atkR);

    // 4 Satellite Skill Buttons arranged in a clean non-overlapping arc around Attack
    const satR = isMobile ? 23 : 25;
    const orbitR = isMobile ? 86 : 96;
    const angleBySlotDeg: Record<SkillSlot, number> = isMobile
      ? {
          dash: 170,
          active_1: 208,
          active_2: 244,
          potion: 280,
        }
      : {
          dash: 172,
          active_1: 209,
          active_2: 244,
          potion: 279,
        };

    const iconSize = Math.round(satR * 1.38);

    for (const btn of this.skillButtons) {
      btn.radius = satR;
      const deg = angleBySlotDeg[btn.skill.slot] ?? 225;
      const rad = Phaser.Math.DegToRad(deg);
      const bx = Math.round(atkX + orbitR * Math.cos(rad));
      const by = Math.round(atkY + orbitR * Math.sin(rad));

      btn.container.setPosition(bx, by);
      btn.hitZone.setSize(satR * 2 + 6, satR * 2 + 6);

      if (btn.iconImage) {
        if (this.hasTextureFrame(UI_ICONS_KEY, btn.iconFrame)) {
          btn.iconImage.setFrame(btn.iconFrame);
        }
        btn.iconImage.setDisplaySize(iconSize, iconSize);
      }

      // Discrete PC hotkey pill anchored cleanly on bottom rim of button
      btn.hotkeyBg.clear();
      if (!isMobile) {
        const label = btn.hotkeyText.text;
        const pillW = Math.max(18, label.length * 6 + 8);
        const pillH = 13;
        const pillY = satR + 1;
        btn.hotkeyBg.fillStyle(0x090b10, 0.94);
        btn.hotkeyBg.fillRoundedRect(-pillW / 2, pillY - pillH / 2, pillW, pillH, 3);
        btn.hotkeyBg.lineStyle(1, 0x6b5b45, 0.9);
        btn.hotkeyBg.strokeRoundedRect(-pillW / 2, pillY - pillH / 2, pillW, pillH, 3);
        btn.hotkeyText.setPosition(0, pillY).setVisible(true);
      } else {
        btn.hotkeyText.setVisible(false);
      }
    }
  }

  private drawPrimaryAttackButton(r: number): void {
    this.attackBtnBg.clear();

    // Subtle ember outer glow
    this.attackBtnBg.fillStyle(0xe85d04, 0.22);
    this.attackBtnBg.fillCircle(0, 0, r + 6);
    this.attackBtnBg.fillStyle(0xff7b00, 0.14);
    this.attackBtnBg.fillCircle(0, 0, r + 3);

    // Dark obsidian crimson disc
    this.attackBtnBg.fillStyle(0x1b0e0c, 0.95);
    this.attackBtnBg.fillCircle(0, 0, r);
    this.attackBtnBg.fillStyle(0x5c180b, 0.52);
    this.attackBtnBg.fillCircle(0, 0, r - 4);

    // Double Diablo metallic bronze + ember bevel rings
    this.attackBtnBg.lineStyle(3.2, 0x262933, 0.98);
    this.attackBtnBg.strokeCircle(0, 0, r + 1.5);
    this.attackBtnBg.lineStyle(2.4, 0xd4a359, 0.98);
    this.attackBtnBg.strokeCircle(0, 0, r);
    this.attackBtnBg.lineStyle(1.4, 0xf97316, 0.85);
    this.attackBtnBg.strokeCircle(0, 0, r - 3.5);

    const hasIcon =
      this.attackBtnIcon !== null &&
      this.hasTextureFrame(UI_ICONS_KEY, ICON_FRAME.ATTACK);
    if (this.attackBtnIcon) {
      this.attackBtnIcon.setVisible(hasIcon);
      if (hasIcon) {
        const size = Math.round(r * 1.32);
        this.attackBtnIcon.setFrame(ICON_FRAME.ATTACK).setDisplaySize(size, size);
      }
    }
    this.attackBtnFallbackText.setVisible(!hasIcon);
  }

  private drawSkillButtonState(
    btn: SkillButtonView,
    cdRemainingMs: number,
    totalCooldownMs: number,
    isOutOfCharges: boolean
  ): void {
    const palette = this.getForceColors(btn.skill.force, btn.skill.slot);
    const isReady = cdRemainingMs <= 0 && !isOutOfCharges;
    const r = btn.radius;

    btn.bg.clear();
    // Dark metallic backing
    btn.bg.fillStyle(0x0b0d14, isReady ? 0.94 : 0.72);
    btn.bg.fillCircle(0, 0, r);
    // Subtle colored inner wash
    btn.bg.fillStyle(palette.fill, isReady ? 0.56 : 0.24);
    btn.bg.fillCircle(0, 0, r - 3);

    // Metallic bevel outer rim + force accent inner ring
    btn.bg.lineStyle(2.6, 0x242834, 0.96);
    btn.bg.strokeCircle(0, 0, r + 1);
    btn.bg.lineStyle(1.8, isReady ? palette.stroke : 0x475569, isReady ? 0.98 : 0.55);
    btn.bg.strokeCircle(0, 0, r);
    btn.bg.lineStyle(1, 0x090b10, 0.75);
    btn.bg.strokeCircle(0, 0, r - 2.5);

    // Radial cooldown sweep
    btn.cdOverlay.clear();
    if (cdRemainingMs > 0 && totalCooldownMs > 0) {
      const ratio = Math.min(1, cdRemainingMs / totalCooldownMs);
      const startAngle = Phaser.Math.DegToRad(-90);
      const endAngle = Phaser.Math.DegToRad(-90 + 360 * ratio);

      btn.cdOverlay.fillStyle(0x04060a, 0.78);
      btn.cdOverlay.slice(0, 0, r - 2, startAngle, endAngle, false);
      btn.cdOverlay.fillPath();

      // Glowing radial progress arc on rim
      btn.cdOverlay.lineStyle(2.2, 0xf0c46c, 0.95);
      btn.cdOverlay.beginPath();
      btn.cdOverlay.arc(0, 0, r - 1.5, startAngle, endAngle, false);
      btn.cdOverlay.strokePath();
    }
  }

  private drawPotionChargesBadge(btn: SkillButtonView, charges: number): void {
    if (!btn.chargesBg || !btn.chargesText) {
      return;
    }
    const r = btn.radius;
    const bx = Math.round(r * 0.7);
    const by = -Math.round(r * 0.7);
    const hasCharges = charges > 0;

    btn.chargesBg.clear();
    btn.chargesBg.fillStyle(hasCharges ? 0x991b1b : 0x1f2937, 0.98);
    btn.chargesBg.fillCircle(bx, by, 8.5);
    btn.chargesBg.lineStyle(1.4, hasCharges ? 0xf0c46c : 0x475569, 0.98);
    btn.chargesBg.strokeCircle(bx, by, 8.5);

    btn.chargesText
      .setPosition(bx, by)
      .setText(`${Math.max(0, charges)}`)
      .setColor(hasCharges ? '#fff7ed' : '#94a3b8')
      .setVisible(true);
  }

  private resolveSkillIconFrame(skill: SkillDef): number {
    if (skill.slot === 'dash') {
      return ICON_FRAME.DASH;
    }
    if (skill.slot === 'potion') {
      return ICON_FRAME.POTION;
    }
    switch (skill.force) {
      case 'inferno':
        return ICON_FRAME.SKILL_INFERNO;
      case 'empireo':
        return ICON_FRAME.SKILL_EMPIREO;
      case 'submundo':
        return ICON_FRAME.SKILL_SUBMUNDO;
      default:
        return ICON_FRAME.SKILL_INFERNO;
    }
  }

  private getForceColors(
    force: ForceType,
    slot: SkillSlot
  ): { fill: number; stroke: number } {
    if (slot === 'potion') {
      return { fill: 0x6b0f1a, stroke: 0xef4444 };
    }
    if (slot === 'dash') {
      return { fill: 0x123047, stroke: 0x38bdf8 };
    }
    switch (force) {
      case 'inferno':
        return { fill: 0x6a1b09, stroke: 0xf97316 };
      case 'submundo':
        return { fill: 0x590d22, stroke: 0xf43f5e };
      case 'empireo':
        return { fill: 0x1d3557, stroke: 0xf0c46c };
      default:
        return { fill: 0x1a2a3a, stroke: 0x48cae4 };
    }
  }

  // ===========================================================================
  // TOP-CENTER: BOSS HP BAR, BANNER & END-OF-RUN MODAL
  // ===========================================================================

  private drawBossHpBar(bossHp: number, bossMaxHp: number): void {
    const isMobile = this.viewport.mode === 'mobile_portrait';
    const width = isMobile ? 286 : 292;
    const height = isMobile ? 14 : 16;
    const bevel = 7;
    const ratio = bossMaxHp > 0 ? Math.max(0, Math.min(1, bossHp / bossMaxHp)) : 0;

    this.bossBarGraphic.clear();

    // Subtle dark backing plate behind Boss bar
    this.bossBarGraphic.fillStyle(0x090b10, 0.86);
    this.bossBarGraphic.fillRoundedRect(
      -width / 2 - 6,
      -height / 2 - 4,
      width + 12,
      height + 8,
      4
    );

    // Recessed track
    this.drawChamferedSymmetricBar(
      this.bossBarGraphic,
      width,
      height,
      bevel,
      0x180a10,
      0.96
    );

    if (ratio > 0) {
      const innerHalfW = width / 2 - 2;
      const innerHalfH = height / 2 - 2;
      const innerBevel = Math.max(2, bevel - 1);
      const fillRight = -innerHalfW + Math.max(innerBevel * 2, innerHalfW * 2 * ratio);
      const rightEdgeTop = Math.min(fillRight, innerHalfW - innerBevel);

      this.bossBarGraphic.fillStyle(0xdc2626, 0.98);
      this.bossBarGraphic.fillPoints(
        [
          { x: -innerHalfW + innerBevel, y: -innerHalfH },
          { x: rightEdgeTop, y: -innerHalfH },
          { x: fillRight, y: 0 },
          { x: rightEdgeTop, y: innerHalfH },
          { x: -innerHalfW + innerBevel, y: innerHalfH },
          { x: -innerHalfW, y: 0 },
        ],
        true
      );
      this.bossBarGraphic.fillStyle(0xf87171, 0.45);
      this.bossBarGraphic.fillPoints(
        [
          { x: -innerHalfW + innerBevel, y: -innerHalfH },
          { x: rightEdgeTop, y: -innerHalfH },
          { x: Math.max(-innerHalfW + innerBevel, fillRight - 2), y: -1 },
          { x: -innerHalfW + 2, y: -1 },
        ],
        true
      );
    }

    // Imposing dark steel + aged gold frame
    this.strokeChamferedSymmetricBar(
      this.bossBarGraphic,
      width,
      height,
      bevel,
      2,
      0xc9a25e,
      0.98
    );

    // Corner ornamental diamonds
    const halfW = width / 2 + 2;
    this.bossBarGraphic.fillStyle(0xf0c46c, 0.96);
    for (const side of [-1, 1]) {
      const cx = side * halfW;
      this.bossBarGraphic.fillPoints(
        [
          { x: cx, y: -4 },
          { x: cx + 4, y: 0 },
          { x: cx, y: 4 },
          { x: cx - 4, y: 0 },
        ],
        true
      );
    }
  }

  private positionBanner(showBossBar: boolean): void {
    const isMobile = this.viewport.mode === 'mobile_portrait';
    const w = this.viewport.width;
    const bannerY = isMobile
      ? showBossBar
        ? 176
        : 126
      : showBossBar
        ? 90
        : 128;
    this.bannerContainer.setPosition(w / 2, bannerY);
  }

  private drawBannerBox(): void {
    const isMobile = this.viewport.mode === 'mobile_portrait';
    const width = isMobile ? this.viewport.width - 28 : 440;
    const height = isMobile ? 36 : 30;

    this.bannerBg.clear();
    this.bannerBg.fillStyle(0x090b10, 0.86);
    this.bannerBg.fillRoundedRect(-width / 2, -height / 2, width, height, 4);
    this.bannerBg.lineStyle(1.2, 0x8c6d46, 0.88);
    this.bannerBg.strokeRoundedRect(-width / 2, -height / 2, width, height, 4);
  }

  private drawModalBackground(isVictory: boolean, hasLootSummary = false): void {
    const w = this.viewport.width;
    const h = this.viewport.height;
    const isMobile = this.viewport.mode === 'mobile_portrait';
    const boxW = isMobile ? w - 32 : 440;
    const boxH = hasLootSummary ? (isMobile ? 284 : 264) : isMobile ? 250 : 230;

    this.modalBackdrop.clear();
    this.modalBackdrop.fillStyle(0x04060a, 0.8);
    this.modalBackdrop.fillRect(-w / 2, -h / 2, w, h);

    this.modalBox.clear();
    this.modalBox.fillStyle(0x0d1018, 0.97);
    this.modalBox.fillRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, 8);
    this.modalBox.lineStyle(2, isVictory ? 0xf0c46c : 0xdc2626, 1);
    this.modalBox.strokeRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, 8);
    this.modalBox.lineStyle(1, 0x3a4152, 0.75);
    this.modalBox.strokeRoundedRect(
      -boxW / 2 + 4,
      -boxH / 2 + 4,
      boxW - 8,
      boxH - 8,
      5
    );
  }

  // ===========================================================================
  // KEYBOARD & HELPERS
  // ===========================================================================

  private handleKeyDown(event: KeyboardEvent): void {
    soundManager.unlock();
    const code = event.code;
    const key = event.key.toLowerCase();

    if (this.isRunEnded()) {
      if (code === 'Enter' || key === 'r') {
        soundManager.play('ui_click');
        this.callbacks.onRestartRun();
      }
      return;
    }

    if (code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight') {
      const dashSkill = this.skillBySlot.get('dash');
      if (dashSkill) {
        this.callbacks.onUseSkill(dashSkill.id);
      }
      return;
    }

    if (code === 'Digit1' || key === '1' || key === 'j') {
      const skill1 = this.skillBySlot.get('active_1');
      if (skill1) {
        this.callbacks.onUseSkill(skill1.id);
      }
      return;
    }

    if (code === 'Digit2' || key === '2' || key === 'k') {
      const skill2 = this.skillBySlot.get('active_2');
      if (skill2) {
        this.callbacks.onUseSkill(skill2.id);
      }
      return;
    }

    if (code === 'Digit3' || key === '3' || key === 'q' || key === 'l') {
      const potion = this.skillBySlot.get('potion');
      if (potion) {
        this.callbacks.onUseSkill(potion.id);
      }
      return;
    }

    if (key === 'f') {
      this.pulseContainer(this.attackBtnContainer);
      this.callbacks.onBasicAttack?.();
      return;
    }

    if (key === 'i' || key === 'b') {
      soundManager.play('ui_click');
      this.callbacks.onToggleInventory?.();
      return;
    }

    if (key === 'm') {
      const muted = soundManager.toggleMute();
      this.refreshMuteButtonState();
      if (!muted) {
        soundManager.play('ui_click');
      }
    }
  }

  private isRunEnded(): boolean {
    return (
      this.lastSnapshot.runStatus === 'victory' ||
      this.lastSnapshot.runStatus === 'defeat'
    );
  }

  private hasTextureFrame(key: string, frame: number): boolean {
    if (!this.scene.textures.exists(key)) {
      return false;
    }
    return this.scene.textures.get(key).has(String(frame));
  }

  private pulseContainer(target: Phaser.GameObjects.Container): void {
    if (!this.scene.tweens || typeof this.scene.tweens.add !== 'function') {
      return;
    }
    this.scene.tweens.killTweensOf(target);
    target.setScale(1);
    this.scene.tweens.add({
      targets: target,
      scaleX: 0.9,
      scaleY: 0.9,
      duration: 55,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  private drawChamferedBar(
    gfx: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    bevel: number,
    color: number,
    alpha: number
  ): void {
    const b = Math.min(bevel, w * 0.4, h);
    gfx.fillStyle(color, alpha);
    gfx.fillPoints(
      [
        { x, y },
        { x: x + w, y },
        { x: x + w - b, y: y + h },
        { x, y: y + h },
      ],
      true
    );
  }

  private strokeChamferedBar(
    gfx: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    bevel: number,
    lineWidth: number,
    color: number,
    alpha: number
  ): void {
    const b = Math.min(bevel, w * 0.4, h);
    gfx.lineStyle(lineWidth, color, alpha);
    gfx.strokePoints(
      [
        { x, y },
        { x: x + w, y },
        { x: x + w - b, y: y + h },
        { x, y: y + h },
      ],
      true,
      true
    );
  }

  private drawChamferedSymmetricBar(
    gfx: Phaser.GameObjects.Graphics,
    w: number,
    h: number,
    bevel: number,
    color: number,
    alpha: number
  ): void {
    const hw = w / 2;
    const hh = h / 2;
    gfx.fillStyle(color, alpha);
    gfx.fillPoints(
      [
        { x: -hw + bevel, y: -hh },
        { x: hw - bevel, y: -hh },
        { x: hw, y: 0 },
        { x: hw - bevel, y: hh },
        { x: -hw + bevel, y: hh },
        { x: -hw, y: 0 },
      ],
      true
    );
  }

  private strokeChamferedSymmetricBar(
    gfx: Phaser.GameObjects.Graphics,
    w: number,
    h: number,
    bevel: number,
    lineWidth: number,
    color: number,
    alpha: number
  ): void {
    const hw = w / 2;
    const hh = h / 2;
    gfx.lineStyle(lineWidth, color, alpha);
    gfx.strokePoints(
      [
        { x: -hw + bevel, y: -hh },
        { x: hw - bevel, y: -hh },
        { x: hw, y: 0 },
        { x: hw - bevel, y: hh },
        { x: -hw + bevel, y: hh },
        { x: -hw, y: 0 },
      ],
      true,
      true
    );
  }
}
