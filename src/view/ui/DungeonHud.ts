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
import {
  DF_FONTS,
  DF_PALETTE,
  DF_UI_ICONS_KEY,
  DF_UI_ICON_FRAMES,
  drawOrnamentalDivider,
  drawOrnateButton,
  drawOrnatePanel,
  hasUiTextureFrame,
} from './DarkFantasyUiBuilder';
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
  /** Contador do objetivo da missão (T-147), ex.: "Ervas 3/10". */
  objectiveText?: string;
  /** Ícone do contador do objetivo (`mission_icons`). */
  objectiveIcon?: 'herb' | 'tools';
  /** Há item no chão dentro do raio de busca do botão "Pegar" (T-132). */
  pickupAvailable?: boolean;
  /** Raridade do item mais próximo (cor do anel do botão "Pegar"). */
  pickupRarity?: 'common' | 'magic' | 'rare' | 'legendary';
  /**
   * Objetivo principal de abate (T-152/T-153), ex.: "Elimine todos os monstros 12/15".
   * Quando presente, vira a linha principal do tracker e o `objectiveText` fica abaixo.
   */
  killObjectiveText?: string;
  /**
   * Planta do mapa contínuo em coordenadas de mundo (T-152). Sem ela o minimapa
   * usa o formato antigo (arena única: testArena / Ato 1).
   */
  minimapLayout?: MinimapLayout;
  minimap?: {
    heroX: number;
    heroY: number;
    /** Largura do mapa inteiro (mundo). */
    arenaWidth: number;
    /** Altura do mapa inteiro (mundo). */
    arenaHeight: number;
    enemies: Array<{ x: number; y: number; isBoss: boolean }>;
    /** Coletáveis do objetivo ainda no chão (coordenadas de mundo). */
    collectibles?: Array<{ x: number; y: number }>;
  };
}

export interface MinimapRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MinimapLayout {
  worldW: number;
  worldH: number;
  rooms: MinimapRect[];
  corridors: MinimapRect[];
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
  sideLabelText?: Phaser.GameObjects.Text;
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

const PORTRAITS_KEY = 'portraits';

const HERO_FRAME = {
  cx: 46,
  cy: 44,
  r: 32, // 64x64 circular portrait
  barX: 86,
  hpY: 30,
  hpW: 188,
  hpH: 18,
  secY: 53,
  secW: 154,
  secH: 6,
  nameX: 88,
  nameY: 17,
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
    onPickupNearest?: () => void;
  };

  private viewport: ViewportConfig;
  private readonly joystick: VirtualJoystick;
  private movementKeys?: MovementKeys;
  private readonly keydownHandler: (event: KeyboardEvent) => void;

  // Top-Left: Dark Fantasy Hero Frame (64x64 portrait + 188x18 HP bar)
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

  // Top-Left below Hero Frame: Clean Open Objective / Campaign Tracker
  private readonly objectiveContainer: Phaser.GameObjects.Container;
  private readonly objectiveBg: Phaser.GameObjects.Graphics;
  private readonly objectiveTitleText: Phaser.GameObjects.Text;
  private readonly objectiveText: Phaser.GameObjects.Text;
  // Contador do objetivo da missão (T-147): ícone + "Ervas 3/10".
  private readonly objectiveCounter: Phaser.GameObjects.Container;
  private readonly objectiveCounterIcon: Phaser.GameObjects.Image;
  private readonly objectiveCounterFallback: Phaser.GameObjects.Graphics;
  private readonly objectiveCounterText: Phaser.GameObjects.Text;
  private objectiveCounterValue: string | null = null;
  private objectiveCounterIconKey: 'herb' | 'tools' | null = null;

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

  // Top-Right: Circular Minimap (r = 46)
  private readonly minimapContainer: Phaser.GameObjects.Container;
  private readonly minimapBg: Phaser.GameObjects.Graphics;
  private readonly minimapDots: Phaser.GameObjects.Graphics;
  private readonly minimapFrame: Phaser.GameObjects.Graphics;
  private readonly minimapRadius = 46;
  private readonly minimapMaskGfx: Phaser.GameObjects.Graphics | null;
  private minimapDebug: {
    mode: 'empty' | 'arena' | 'layout';
    scale: number;
    rooms: number;
    corridors: number;
    enemies: number;
    collectibles: number;
  } = { mode: 'empty', scale: 0, rooms: 0, corridors: 0, enemies: 0, collectibles: 0 };

  // Top-Right Utility Row (AUTO, Inventário, Áudio)
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
  private readonly bagLabelText: Phaser.GameObjects.Text;
  private readonly bagBtnZone: Phaser.GameObjects.Zone;

  private readonly muteBtnContainer: Phaser.GameObjects.Container;
  private readonly muteBtnBg: Phaser.GameObjects.Graphics;
  private readonly muteBtnIcon: Phaser.GameObjects.Image | null;
  private readonly muteBtnFallbackText: Phaser.GameObjects.Text;
  private readonly muteLabelText: Phaser.GameObjects.Text;
  private readonly muteBtnZone: Phaser.GameObjects.Zone;

  private readonly utilityBtnRadius = 18;

  // Top-Center: Boss HP Bar
  private readonly bossContainer: Phaser.GameObjects.Container;
  private readonly bossBarGraphic: Phaser.GameObjects.Graphics;
  private readonly bossNameText: Phaser.GameObjects.Text;
  private readonly bossHpText: Phaser.GameObjects.Text;

  // Top-Center: Status / Narrative Banner
  private readonly bannerContainer: Phaser.GameObjects.Container;
  private readonly bannerBg: Phaser.GameObjects.Graphics;
  private readonly bannerLabel: Phaser.GameObjects.Text;
  private lastBannerWidth = 360;

  // Bottom-Right: Primary Attack Button (r = 42) + Action Arc (Esquiva, Poção, Skills)
  private readonly attackBtnContainer: Phaser.GameObjects.Container;
  private readonly attackBtnBg: Phaser.GameObjects.Graphics;
  private readonly attackBtnIcon: Phaser.GameObjects.Image | null;
  private readonly attackBtnFallbackText: Phaser.GameObjects.Text;
  private readonly attackBtnLabelText: Phaser.GameObjects.Text;
  private readonly attackBtnZone: Phaser.GameObjects.Zone;
  private readonly attackBtnRadius = 42;

  // Bottom-Right above Attack: "Pegar" button (r = 24) — coleta o item mais próximo (T-132)
  private pickupBtnContainer!: Phaser.GameObjects.Container;
  private pickupBtnGlow!: Phaser.GameObjects.Graphics;
  private pickupBtnBg!: Phaser.GameObjects.Graphics;
  private pickupBtnIcon!: Phaser.GameObjects.Image | null;
  private pickupBtnFallbackText!: Phaser.GameObjects.Text;
  private pickupBtnLabelText!: Phaser.GameObjects.Text;
  private pickupHotkeyBg!: Phaser.GameObjects.Graphics;
  private pickupHotkeyText!: Phaser.GameObjects.Text;
  private pickupBtnZone!: Phaser.GameObjects.Zone;
  private readonly pickupBtnRadius = 24;
  private pickupStateKey = '';
  private pickupPulseTween: Phaser.Tweens.Tween | null = null;

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
  private restartBtnHovered = false;
  private restartBtnPressed = false;

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
      onPickupNearest?: () => void;
    }
  ) {
    this.scene = scene;
    this.skills = skills;
    this.callbacks = callbacks;
    this.viewport = resolveViewportConfig(
      scene.scale.width || 960,
      scene.scale.height || 540
    );

    for (const skill of skills) {
      this.skillBySlot.set(skill.slot, skill);
    }

    const totalPointers = scene.input.manager?.pointersTotal ?? 2;
    if (totalPointers < 4) {
      scene.input.addPointer?.(4 - totalPointers);
    }

    this.joystick = new VirtualJoystick(scene);

    // -------------------------------------------------------------------------
    // 1. TOP-LEFT: HERO FRAME (64x64 PORTRAIT + 188x18 HP BAR)
    // -------------------------------------------------------------------------
    this.portraitBgGraphic = scene.add.graphics();
    this.portraitSprite = hasUiTextureFrame(scene, PORTRAITS_KEY, 0)
      ? scene.add.image(0, 0, PORTRAITS_KEY, 0).setOrigin(0.5)
      : null;

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
        fontFamily: DF_FONTS.TITLE,
        resolution: 2,
        fontSize: '16px',
        color: DF_PALETTE.textParchment,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.portraitRingGraphic = scene.add.graphics();
    this.levelBadgeBg = scene.add.graphics();
    this.levelBadgeText = scene.add
      .text(0, 0, 'Nv. 1', {
        fontFamily: DF_FONTS.BODY,
        resolution: 2,
        fontSize: '9px',
        color: DF_PALETTE.textParchment,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.heroNameText = scene.add
      .text(0, 0, 'GUERREIRO', {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '13px',
        color: DF_PALETTE.textParchment,
        fontStyle: 'bold',
        stroke: '#07090e',
        strokeThickness: 3,
        resolution: 2,
      })
      .setOrigin(0, 0.5);

    this.hpBarGraphic = scene.add.graphics();
    this.hpText = scene.add
      .text(0, 0, '100/100', {
        fontFamily: DF_FONTS.BODY,
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
    // 2. TOP-LEFT: CLEAN OPEN OBJECTIVE / CAMPAIGN TRACKER
    // -------------------------------------------------------------------------
    this.objectiveBg = scene.add.graphics();
    this.objectiveTitleText = scene.add
      .text(24, 10, 'Campanha', {
        fontFamily: DF_FONTS.TITLE,
        resolution: 2,
        fontSize: '13px',
        color: DF_PALETTE.textParchment,
        fontStyle: 'bold',
        stroke: '#07090e',
        strokeThickness: 3,
      })
      .setOrigin(0, 0.5);

    this.objectiveText = scene.add
      .text(24, 22, 'Sala 1/5', {
        fontFamily: DF_FONTS.BODY,
        resolution: 2,
        fontSize: '11px',
        color: '#e2e8f0',
        stroke: '#07090e',
        strokeThickness: 2.5,
        wordWrap: { width: 196 },
        lineSpacing: 2,
      })
      .setOrigin(0, 0);

    this.objectiveCounterIcon = scene.add
      .image(8, 0, '__DEFAULT')
      .setOrigin(0.5)
      .setVisible(false);
    this.objectiveCounterFallback = scene.add.graphics();
    this.objectiveCounterText = scene.add
      .text(20, 0, '', {
        fontFamily: DF_FONTS.BODY,
        resolution: 2,
        fontSize: '11px',
        fontStyle: 'bold',
        color: DF_PALETTE.textParchment,
        stroke: '#07090e',
        strokeThickness: 2.5,
      })
      .setOrigin(0, 0.5);
    this.objectiveCounter = scene.add
      .container(0, 0, [
        this.objectiveCounterFallback,
        this.objectiveCounterIcon,
        this.objectiveCounterText,
      ])
      .setVisible(false);
    this.objectiveCounter.setName('hud_objective_counter');

    this.objectiveContainer = scene.add
      .container(0, 0, [
        this.objectiveBg,
        this.objectiveTitleText,
        this.objectiveText,
        this.objectiveCounter,
      ])
      .setScrollFactor(0)
      .setDepth(1010);

    // -------------------------------------------------------------------------
    // 3. TOP-RIGHT: CLEAN INLINE RESOURCES (SOULS & ESSENCES)
    // -------------------------------------------------------------------------
    this.soulsBg = scene.add.graphics();
    this.soulsFallbackGraphic = scene.add.graphics();
    this.soulsIcon = hasUiTextureFrame(
      scene,
      DF_UI_ICONS_KEY,
      DF_UI_ICON_FRAMES.souls
    )
      ? scene.add
          .image(0, 0, DF_UI_ICONS_KEY, DF_UI_ICON_FRAMES.souls)
          .setOrigin(0.5)
      : null;
    this.soulsText = scene.add
      .text(0, 0, '0', {
        fontFamily: DF_FONTS.TITLE,
        resolution: 2,
        fontSize: '13px',
        color: '#e0f2fe',
        fontStyle: 'bold',
        stroke: '#07090e',
        strokeThickness: 3,
      })
      .setOrigin(0, 0.5);

    this.essenceBg = scene.add.graphics();
    this.essenceFallbackGraphic = scene.add.graphics();
    this.essenceIcon = hasUiTextureFrame(
      scene,
      DF_UI_ICONS_KEY,
      DF_UI_ICON_FRAMES.essence
    )
      ? scene.add
          .image(0, 0, DF_UI_ICONS_KEY, DF_UI_ICON_FRAMES.essence)
          .setOrigin(0.5)
      : null;
    this.essenceText = scene.add
      .text(0, 0, '0', {
        fontFamily: DF_FONTS.TITLE,
        resolution: 2,
        fontSize: '13px',
        color: DF_PALETTE.textGold,
        fontStyle: 'bold',
        stroke: '#07090e',
        strokeThickness: 3,
      })
      .setOrigin(0, 0.5);

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
    // 4. TOP-RIGHT: CIRCULAR MINIMAP (r = 46)
    // -------------------------------------------------------------------------
    this.minimapBg = scene.add.graphics();
    this.minimapDots = scene.add.graphics();
    this.minimapMaskGfx =
      typeof scene.make?.graphics === 'function' ? scene.make.graphics({}, false) : null;
    if (this.minimapMaskGfx && typeof this.minimapMaskGfx.createGeometryMask === 'function') {
      this.minimapDots.setMask(this.minimapMaskGfx.createGeometryMask());
    }
    this.minimapFrame = scene.add.graphics();

    this.minimapContainer = scene.add
      .container(0, 0, [this.minimapBg, this.minimapDots, this.minimapFrame])
      .setScrollFactor(0)
      .setDepth(1012);

    // -------------------------------------------------------------------------
    // 5. TOP-RIGHT UTILITY ROW: AUTO / INVENTÁRIO / ÁUDIO
    // -------------------------------------------------------------------------
    this.autoBtnBg = scene.add.graphics();
    this.autoBtnText = scene.add
      .text(0, 0, 'AUTO', {
        fontFamily: DF_FONTS.TITLE,
        resolution: 2,
        fontSize: '9.5px',
        color: DF_PALETTE.textGold,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.autoBtnZone = scene.add
      .zone(0, 0, 42, 42)
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

    this.bagBtnBg = scene.add.graphics();
    this.bagBtnIcon = hasUiTextureFrame(
      scene,
      DF_UI_ICONS_KEY,
      DF_UI_ICON_FRAMES.bag
    )
      ? scene.add
          .image(0, 0, DF_UI_ICONS_KEY, DF_UI_ICON_FRAMES.bag)
          .setOrigin(0.5)
      : null;
    this.bagBtnFallbackText = scene.add
      .text(0, 0, 'I', {
        fontFamily: DF_FONTS.BODY,
        resolution: 2,
        fontSize: '12px',
        color: DF_PALETTE.textParchment,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.bagBadgeBg = scene.add.graphics();
    this.bagBadgeText = scene.add
      .text(0, 0, '0', {
        fontFamily: DF_FONTS.BODY,
        resolution: 2,
        fontSize: '9px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.bagLabelText = scene.add
      .text(0, 27, 'Inventário', {
        fontFamily: DF_FONTS.BODY,
        resolution: 2,
        fontSize: '9.5px',
        color: DF_PALETTE.textParchment,
        stroke: '#07090e',
        strokeThickness: 2.5,
      })
      .setOrigin(0.5);
    this.bagBtnZone = scene.add
      .zone(0, 0, 42, 42)
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
      this.bagLabelText,
      this.bagBtnZone
    );

    this.bagBtnContainer = scene.add
      .container(0, 0, bagChildren)
      .setScrollFactor(0)
      .setDepth(1020);

    this.muteBtnBg = scene.add.graphics();
    this.muteBtnIcon = hasUiTextureFrame(
      scene,
      DF_UI_ICONS_KEY,
      DF_UI_ICON_FRAMES.audioOn
    )
      ? scene.add
          .image(0, 0, DF_UI_ICONS_KEY, DF_UI_ICON_FRAMES.audioOn)
          .setOrigin(0.5)
      : null;
    this.muteBtnFallbackText = scene.add
      .text(0, 0, 'ON', {
        fontFamily: DF_FONTS.BODY,
        resolution: 2,
        fontSize: '9px',
        color: DF_PALETTE.textParchment,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.muteLabelText = scene.add
      .text(0, 27, 'Áudio', {
        fontFamily: DF_FONTS.BODY,
        resolution: 2,
        fontSize: '9.5px',
        color: DF_PALETTE.textParchment,
        stroke: '#07090e',
        strokeThickness: 2.5,
      })
      .setOrigin(0.5);
    this.muteBtnZone = scene.add
      .zone(0, 0, 42, 42)
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
    muteChildren.push(this.muteLabelText, this.muteBtnZone);

    this.muteBtnContainer = scene.add
      .container(0, 0, muteChildren)
      .setScrollFactor(0)
      .setDepth(1020);

    // -------------------------------------------------------------------------
    // 6. TOP-CENTER: BOSS HP BAR
    // -------------------------------------------------------------------------
    this.bossBarGraphic = scene.add.graphics();
    this.bossNameText = scene.add
      .text(0, -18, 'CARCEREIRO INFERNAL', {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '12px',
        color: DF_PALETTE.textDanger,
        fontStyle: 'bold',
        stroke: '#07090e',
        strokeThickness: 3,
        resolution: 2,
      })
      .setOrigin(0.5);
    this.bossHpText = scene.add
      .text(0, 0, '0/0', {
        fontFamily: DF_FONTS.BODY,
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
    // 7. TOP-CENTER: STATUS / NARRATIVE BANNER
    // -------------------------------------------------------------------------
    this.bannerBg = scene.add.graphics();
    this.bannerLabel = scene.add
      .text(0, 0, '', {
        fontFamily: DF_FONTS.BODY,
        resolution: 2,
        fontSize: '11px',
        color: DF_PALETTE.textParchment,
        align: 'center',
        wordWrap: { width: 340 },
      })
      .setOrigin(0.5);

    this.bannerContainer = scene.add
      .container(0, 0, [this.bannerBg, this.bannerLabel])
      .setScrollFactor(0)
      .setDepth(1014)
      .setVisible(false);

    // -------------------------------------------------------------------------
    // 8. BOTTOM-RIGHT: PRIMARY ATTACK BUTTON (r = 42) & COMBAT CLUSTER
    // -------------------------------------------------------------------------
    this.attackBtnBg = scene.add.graphics();
    this.attackBtnIcon = hasUiTextureFrame(
      scene,
      DF_UI_ICONS_KEY,
      DF_UI_ICON_FRAMES.attack
    )
      ? scene.add
          .image(0, -8, DF_UI_ICONS_KEY, DF_UI_ICON_FRAMES.attack)
          .setOrigin(0.5)
      : null;
    this.attackBtnFallbackText = scene.add
      .text(0, -8, 'ATK', {
        fontFamily: DF_FONTS.TITLE,
        resolution: 2,
        fontSize: '13px',
        color: '#fff7ed',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.attackBtnLabelText = scene.add
      .text(0, 22, 'Ataque', {
        fontFamily: DF_FONTS.TITLE,
        resolution: 2,
        fontSize: '12.5px',
        color: '#fff7ed',
        fontStyle: 'bold',
        stroke: '#07090e',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    this.attackBtnZone = scene.add
      .zone(0, 0, this.attackBtnRadius * 2 + 8, this.attackBtnRadius * 2 + 8)
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
    attackChildren.push(this.attackBtnLabelText, this.attackBtnZone);

    this.attackBtnContainer = scene.add
      .container(0, 0, attackChildren)
      .setScrollFactor(0)
      .setDepth(1022);

    this.buildSkillButtons();
    this.buildPickupButton();

    // -------------------------------------------------------------------------
    // 9. END-OF-RUN MODAL (VICTORY / DEFEAT)
    // -------------------------------------------------------------------------
    this.modalBackdrop = scene.add.graphics();
    this.modalBox = scene.add.graphics();
    this.modalTitleText = scene.add
      .text(0, -96, '', {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '18px',
        color: DF_PALETTE.textGold,
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: 410 },
        resolution: 2,
      })
      .setOrigin(0.5);

    this.modalBodyText = scene.add
      .text(0, -28, '', {
        fontFamily: DF_FONTS.BODY,
        resolution: 2,
        fontSize: '12px',
        color: DF_PALETTE.textParchment,
        align: 'center',
        wordWrap: { width: 400 },
      })
      .setOrigin(0.5);

    this.modalSoulsText = scene.add
      .text(0, 26, '', {
        fontFamily: DF_FONTS.BODY,
        resolution: 2,
        fontSize: '13px',
        color: '#a5f3fc',
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5);

    this.modalLootText = scene.add
      .text(0, 52, '', {
        fontFamily: DF_FONTS.BODY,
        resolution: 2,
        fontSize: '11px',
        color: DF_PALETTE.textGold,
        align: 'center',
        wordWrap: { width: 400 },
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.restartBtnBg = scene.add.graphics();
    this.restartBtnText = scene.add
      .text(0, 0, 'Nova Incursão', {
        fontFamily: DF_FONTS.TITLE,
        resolution: 2,
        fontSize: '14px',
        color: DF_PALETTE.textParchment,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.restartBtnZone = scene.add
      .zone(0, 0, 200, 42)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.restartBtnZone.on('pointerover', () => {
      this.restartBtnHovered = true;
      this.redrawRestartButton();
    });
    this.restartBtnZone.on('pointerout', () => {
      this.restartBtnHovered = false;
      this.restartBtnPressed = false;
      this.redrawRestartButton();
    });
    this.restartBtnZone.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event?: Phaser.Types.Input.EventData
      ) => {
        event?.stopPropagation?.();
        this.restartBtnPressed = true;
        this.redrawRestartButton();
        soundManager.unlock();
        soundManager.play('ui_click');
        this.callbacks.onRestartRun();
      }
    );
    this.restartBtnZone.on('pointerup', () => {
      this.restartBtnPressed = false;
      this.redrawRestartButton();
    });

    this.restartBtnContainer = scene.add.container(0, 88, [
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
    this.refreshPickupButtonState(snapshot);

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
      const cdRemainingMs = Math.max(
        0,
        snapshot.skillCooldownsMs[btn.skill.id] ?? 0
      );
      const isOnCooldown = cdRemainingMs > 0;
      const isOutOfCharges =
        btn.skill.slot === 'potion' && snapshot.potionCharges <= 0;

      const hasIcon =
        btn.iconImage !== null &&
        hasUiTextureFrame(this.scene, DF_UI_ICONS_KEY, btn.iconFrame);

      if (btn.iconImage) {
        btn.iconImage.setVisible(hasIcon);
        if (hasIcon) {
          btn.iconImage.setAlpha(
            isOnCooldown ? 0.36 : isOutOfCharges ? 0.3 : 1
          );
        }
      }

      btn.fallbackLabelText.setVisible(!hasIcon && !isOnCooldown);

      if (btn.chargesText && btn.chargesBg) {
        this.drawPotionChargesBadge(btn, snapshot.potionCharges);
      }

      if (isOnCooldown) {
        btn.cooldownText.setVisible(true);
        btn.cooldownText.setText(
          cdRemainingMs >= 1000
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

      this.modalTitleText.setText(entry.title.toUpperCase());
      this.modalTitleText.setColor(
        isVictory ? DF_PALETTE.textGold : DF_PALETTE.textDanger
      );
      this.modalBodyText.setText(snapshot.bannerText || entry.text);
      this.modalSoulsText.setText(`Almas preservadas: ${snapshot.souls}`);

      if (hasLootSummary) {
        this.modalTitleText.setY(-116);
        this.modalBodyText.setY(-44);
        this.modalSoulsText.setY(22);
        this.modalLootText.setY(52).setText(lootText).setVisible(true);
        this.restartBtnContainer.setY(104);
      } else {
        this.modalTitleText.setY(-98);
        this.modalBodyText.setY(-26);
        this.modalSoulsText.setY(34);
        this.modalLootText.setVisible(false);
        this.restartBtnContainer.setY(88);
      }

      this.drawModalBackground(isVictory, hasLootSummary);
      this.redrawRestartButton();
    } else {
      this.modalContainer.setVisible(false);
    }
  }

  public resize(viewport: ViewportConfig): void {
    this.viewport = viewport;
    this.joystick.resize(viewport);

    const w = viewport.width;
    const h = viewport.height;

    // 1. Top-Left Hero Frame + Objective Tracker
    this.layoutHeroFrame();
    this.layoutObjectiveTracker();

    // 2. Top-Right Resources + Circular Minimap + Utility Row
    this.layoutMinimapAndTopRight(w);

    // 3. Top-Center Boss Bar & Banner
    this.bossContainer.setPosition(w / 2, 42);
    const hasBoss =
      this.lastSnapshot.bossHp !== undefined &&
      typeof this.lastSnapshot.bossMaxHp === 'number' &&
      this.lastSnapshot.bossMaxHp > 0;
    this.positionBanner(hasBoss);

    // 4. Bottom-Right Ergonomic 2-Hand Action Arc
    this.layoutActionCluster(w, h);

    // 5. End-of-Run Modal
    this.modalContainer.setPosition(w / 2, h / 2);
    const modalWidth = Math.min(460, w - 48);
    this.modalTitleText.setWordWrapWidth(modalWidth - 40);
    this.modalBodyText.setWordWrapWidth(modalWidth - 48);
    this.modalLootText.setWordWrapWidth(modalWidth - 48);

    this.update(this.lastSnapshot);
  }

  public destroy(): void {
    this.scene.input.keyboard?.off('keydown', this.keydownHandler);
    this.joystick.destroy();

    if (this.portraitSprite) {
      this.portraitSprite.clearMask(false);
    }
    this.portraitMaskGfx?.destroy();
    this.minimapMaskGfx?.destroy();

    this.heroFrameContainer.destroy();
    this.scene.tweens.killTweensOf([
      this.objectiveCounterText,
      this.objectiveCounterIcon,
      this.objectiveCounterFallback,
    ]);
    this.objectiveContainer.destroy();
    this.resourcesContainer.destroy();
    this.minimapContainer.destroy();
    this.autoBtnContainer.destroy();
    this.bagBtnContainer.destroy();
    this.muteBtnContainer.destroy();
    this.bossContainer.destroy();
    this.bannerContainer.destroy();
    this.attackBtnContainer.destroy();
    this.pickupPulseTween?.stop();
    this.pickupPulseTween = null;
    this.pickupBtnContainer.destroy();
    this.modalContainer.destroy();

    for (const btn of this.skillButtons) {
      btn.container.destroy();
    }
  }

  // ===========================================================================
  // TOP-LEFT: HERO FRAME (64x64 PORTRAIT + 188x18 HP BAR) & OBJECTIVE TRACKER
  // ===========================================================================

  private layoutHeroFrame(): void {
    const m = HERO_FRAME;

    // Obsidian backing disc
    this.portraitBgGraphic.clear();
    this.portraitBgGraphic.fillStyle(DF_PALETTE.deepRecess, 0.96);
    this.portraitBgGraphic.fillCircle(m.cx, m.cy, m.r);

    // Circular mask aligned 1:1 on uiCamera
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

    this.portraitFallbackText.setPosition(m.cx, m.cy);

    // Metallic bronze/steel double ring around circular portrait
    this.portraitRingGraphic.clear();
    this.portraitRingGraphic.lineStyle(3.5, DF_PALETTE.metalDark, 1);
    this.portraitRingGraphic.strokeCircle(m.cx, m.cy, m.r + 1.5);
    this.portraitRingGraphic.lineStyle(2.2, DF_PALETTE.bronzeBorder, 0.98);
    this.portraitRingGraphic.strokeCircle(m.cx, m.cy, m.r);
    this.portraitRingGraphic.lineStyle(1, DF_PALETTE.agedGold, 0.75);
    this.portraitRingGraphic.strokeCircle(m.cx, m.cy, m.r - 2);

    // Ornamental metallic studs
    const studOffsets = [
      { x: 0, y: -m.r },
      { x: m.r, y: 0 },
      { x: -m.r, y: 0 },
    ];
    this.portraitRingGraphic.fillStyle(DF_PALETTE.agedGold, 0.96);
    for (const s of studOffsets) {
      this.portraitRingGraphic.fillCircle(m.cx + s.x, m.cy + s.y, 2);
    }

    // Level badge ("Nv. X") anchored cleanly at bottom rim
    const badgeW = 46;
    const badgeH = 15;
    const badgeY = m.cy + m.r + 1;
    this.levelBadgeBg.clear();
    this.levelBadgeBg.fillStyle(DF_PALETTE.obsidianBg, 0.96);
    this.levelBadgeBg.fillRoundedRect(
      m.cx - badgeW / 2,
      badgeY - badgeH / 2,
      badgeW,
      badgeH,
      4
    );
    this.levelBadgeBg.lineStyle(1.3, DF_PALETTE.agedGold, 0.95);
    this.levelBadgeBg.strokeRoundedRect(
      m.cx - badgeW / 2,
      badgeY - badgeH / 2,
      badgeW,
      badgeH,
      4
    );
    this.levelBadgeText.setPosition(m.cx, badgeY);

    this.heroNameText.setPosition(m.nameX, m.nameY);
    this.hpText.setPosition(m.barX + m.hpW * 0.46, m.hpY + m.hpH / 2);
  }

  private updateHeroFrame(snapshot: HudSnapshot): void {
    const m = HERO_FRAME;

    const frame = snapshot.heroPortraitFrame ?? 0;
    const isWraith = frame === 1;
    const defaultName = isWraith ? 'ESPECTRO' : 'GUERREIRO';
    const displayName = (snapshot.heroName?.trim() || defaultName).toUpperCase();
    const level = Math.max(1, Math.floor(snapshot.heroLevel ?? 1));

    this.heroNameText.setText(displayName);
    this.levelBadgeText.setText(`Nv. ${level}`);

    const hasPortrait =
      this.portraitSprite !== null &&
      hasUiTextureFrame(this.scene, PORTRAITS_KEY, frame);
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

    // Metallic chamfered HP bar (188x18)
    const clampedHp = Math.max(0, Math.min(snapshot.hp, snapshot.maxHp));
    const ratio =
      snapshot.maxHp > 0
        ? Math.max(0, Math.min(1, clampedHp / snapshot.maxHp))
        : 0;
    this.hpText.setText(`${Math.ceil(clampedHp)}/${snapshot.maxHp}`);

    const bevel = 9;
    this.hpBarGraphic.clear();

    this.drawChamferedBar(
      this.hpBarGraphic,
      m.barX,
      m.hpY,
      m.hpW,
      m.hpH,
      bevel,
      DF_PALETTE.deepRecess,
      0.95
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

    this.strokeChamferedBar(
      this.hpBarGraphic,
      m.barX,
      m.hpY,
      m.hpW,
      m.hpH,
      bevel,
      1.6,
      DF_PALETTE.bronzeBorder,
      0.98
    );
    this.strokeChamferedBar(
      this.hpBarGraphic,
      m.barX - 1,
      m.hpY - 1,
      m.hpW + 2,
      m.hpH + 2,
      bevel,
      1,
      DF_PALETTE.metalDark,
      0.92
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
      DF_PALETTE.deepRecess,
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
      DF_PALETTE.metalBorder,
      0.88
    );
  }

  private layoutObjectiveTracker(): void {
    this.objectiveContainer.setPosition(16, 94);
    this.objectiveTitleText.setPosition(24, 10);
    this.objectiveText.setPosition(24, 23);
    this.drawObjectiveDecorations();
  }

  private drawObjectiveDecorations(): void {
    const dx = 10;
    const dy = 10;
    const outerR = 6.2;
    const innerR = 3;

    this.objectiveBg.clear();

    // Ornate golden diamond emblem (◆) without heavy closed box
    this.objectiveBg.lineStyle(1.4, DF_PALETTE.agedGold, 0.96);
    this.objectiveBg.strokePoints(
      [
        { x: dx, y: dy - outerR },
        { x: dx + outerR, y: dy },
        { x: dx, y: dy + outerR },
        { x: dx - outerR, y: dy },
      ],
      true,
      true
    );

    this.objectiveBg.fillStyle(DF_PALETTE.bronzeDark, 0.85);
    this.objectiveBg.fillPoints(
      [
        { x: dx, y: dy - outerR + 1.2 },
        { x: dx + outerR - 1.2, y: dy },
        { x: dx, y: dy + outerR - 1.2 },
        { x: dx - outerR + 1.2, y: dy },
      ],
      true
    );

    this.objectiveBg.fillStyle(DF_PALETTE.goldBright, 0.98);
    this.objectiveBg.fillPoints(
      [
        { x: dx, y: dy - innerR },
        { x: dx + innerR, y: dy },
        { x: dx, y: dy + innerR },
        { x: dx - innerR, y: dy },
      ],
      true
    );

    // Thin divider line cleanly below the objective text
    const bodyHeight = Math.max(14, Math.ceil(this.objectiveText.height || 14));
    const dividerY = 23 + bodyHeight + 7;
    const dividerW = 204;
    this.objectiveBg.lineStyle(1, DF_PALETTE.bronzeBorder, 0.48);
    this.objectiveBg.lineBetween(0, dividerY, dividerW, dividerY);
    this.objectiveBg.lineStyle(1, DF_PALETTE.agedGold, 0.52);
    this.objectiveBg.lineBetween(0, dividerY, 56, dividerY);
  }

  private updateObjectiveTracker(snapshot: HudSnapshot): void {
    const rawStage = snapshot.stageName?.trim();
    const titleBase = rawStage && rawStage.length > 0 ? rawStage : 'Campanha';
    const title =
      titleBase.length > 24
        ? `${titleBase.slice(0, 23).trimEnd()}…`
        : titleBase;
    this.objectiveTitleText.setText(title);

    const maxChars = 48;
    // T-152/T-153: "Elimine todos os monstros X/Y" é o objetivo principal quando existe.
    const killObjective = snapshot.killObjectiveText?.trim();
    const rawObjective =
      killObjective && killObjective.length > 0 ? killObjective : snapshot.missionObjective?.trim();
    const fallbackRoom = snapshot.isTestArena
      ? snapshot.roomTitle || 'Arena de Combate'
      : `Sala ${snapshot.roomNumber}/${snapshot.totalRooms} · ${snapshot.roomTitle || ''}`.replace(
          /\s*·\s*$/,
          ''
        );
    const line =
      rawObjective && rawObjective.length > 0 ? rawObjective : fallbackRoom;
    const truncated =
      line.length > maxChars ? `${line.slice(0, maxChars - 1).trimEnd()}…` : line;

    this.objectiveText.setText(truncated);
    let killDone = false;
    if (killObjective && killObjective.length > 0) {
      const m = /(\d+)\s*\/\s*(\d+)/.exec(killObjective);
      killDone = !!m && Number(m[2]) > 0 && Number(m[1]) >= Number(m[2]);
    }
    this.objectiveText.setColor(killDone ? DF_PALETTE.textSuccess : '#e2e8f0');
    this.drawObjectiveDecorations();
    this.updateObjectiveCounter(snapshot);
  }

  /** Estado do contador do objetivo (debug/E2E). */
  public getObjectiveCounterState(): { visible: boolean; text: string; complete: boolean } {
    return {
      visible: this.objectiveCounter.visible,
      text: this.objectiveCounterText.text,
      complete: this.objectiveCounterText.style.color === DF_PALETTE.textSuccess,
    };
  }

  /**
   * Contador discreto abaixo do tracker (T-147): ícone + texto. Pisca quando o
   * valor sobe e fica verde quando "X/Y" chega em Y.
   */
  private updateObjectiveCounter(snapshot: HudSnapshot): void {
    const text = snapshot.objectiveText?.trim() ?? '';
    if (text.length === 0) {
      this.objectiveCounter.setVisible(false);
      this.objectiveCounterValue = null;
      return;
    }
    const bodyHeight = Math.max(14, Math.ceil(this.objectiveText.height || 14));
    const dividerY = 23 + bodyHeight + 7;
    this.objectiveCounter.setPosition(2, dividerY + 13).setVisible(true);

    const iconKey = snapshot.objectiveIcon ?? null;
    if (iconKey !== this.objectiveCounterIconKey) {
      this.objectiveCounterIconKey = iconKey;
      this.drawObjectiveCounterIcon(iconKey);
    }

    const match = /(\d+)\s*\/\s*(\d+)/.exec(text);
    const current = match ? Number(match[1]) : NaN;
    const total = match ? Number(match[2]) : NaN;
    const complete = Number.isFinite(current) && Number.isFinite(total) && total > 0 && current >= total;
    const previous = this.objectiveCounterValue;
    if (previous !== text) {
      this.objectiveCounterText.setText(text);
      this.objectiveCounterText.setColor(complete ? DF_PALETTE.textSuccess : DF_PALETTE.textParchment);
      const prevMatch = previous ? /(\d+)\s*\/\s*(\d+)/.exec(previous) : null;
      const increased = prevMatch !== null && Number.isFinite(current) && current > Number(prevMatch[1]);
      if (increased) {
        this.flashObjectiveCounter(complete);
      }
      this.objectiveCounterValue = text;
    }
  }

  private drawObjectiveCounterIcon(icon: 'herb' | 'tools' | null): void {
    const g = this.objectiveCounterFallback;
    g.clear();
    const frame = icon === 'herb' ? 0 : icon === 'tools' ? 1 : -1;
    if (frame >= 0 && hasUiTextureFrame(this.scene, 'mission_icons', frame)) {
      this.objectiveCounterIcon.setTexture('mission_icons', frame).setVisible(true);
      return;
    }
    this.objectiveCounterIcon.setVisible(false);
    if (icon === 'herb') {
      g.fillStyle(0x4ade80, 1);
      g.fillEllipse(5, 0, 5, 9);
      g.fillEllipse(11, 0, 5, 9);
    } else if (icon === 'tools') {
      g.fillStyle(0x94a3b8, 1);
      g.fillRect(3, -5, 10, 4);
      g.fillStyle(0x92400e, 1);
      g.fillRect(7, -1, 2, 7);
    } else {
      g.fillStyle(DF_PALETTE.agedGold, 1);
      g.fillCircle(8, 0, 3);
    }
  }

  private flashObjectiveCounter(complete: boolean): void {
    const targets = [this.objectiveCounterText, this.objectiveCounterIcon, this.objectiveCounterFallback];
    this.scene.tweens.killTweensOf(targets);
    for (const t of targets) {
      t.setScale(1);
      t.setAlpha(1);
    }
    this.objectiveCounterText.setColor(complete ? DF_PALETTE.textSuccess : '#fde68a');
    this.scene.tweens.add({
      targets,
      scale: 1.25,
      duration: 110,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.objectiveCounterText.setColor(complete ? DF_PALETTE.textSuccess : DF_PALETTE.textParchment);
      },
    });
  }

  // ===========================================================================
  // TOP-RIGHT: CLEAN RESOURCES, CIRCULAR MINIMAP (r = 46) & UTILITY TRIO
  // ===========================================================================

  private layoutMinimapAndTopRight(w: number): void {
    const mapR = this.minimapRadius;
    const mapX = w - 60;
    const mapY = 60;
    this.minimapContainer.setPosition(mapX, mapY);
    if (this.minimapMaskGfx) {
      this.minimapMaskGfx.clear();
      this.minimapMaskGfx.fillStyle(0xffffff, 1);
      this.minimapMaskGfx.fillCircle(mapX, mapY, mapR - 3);
    }
    this.drawMinimapStaticShell(mapR);

    // Clean inline Souls & Essences row to the left of the minimap (y = 26, no heavy pills)
    const mapLeft = mapX - mapR;
    const resY = 26;
    const iconSize = 18;

    this.resourcesContainer.setPosition(0, 0);
    this.soulsBg.clear();
    this.essenceBg.clear();

    const soulsIconX = mapLeft - 128;
    if (this.soulsIcon) {
      this.soulsIcon
        .setPosition(soulsIconX, resY)
        .setDisplaySize(iconSize, iconSize);
    }
    this.soulsFallbackGraphic.clear();
    this.soulsFallbackGraphic.fillStyle(0x38bdf8, 0.95);
    this.soulsFallbackGraphic.fillCircle(soulsIconX, resY, 5.5);
    this.soulsFallbackGraphic.lineStyle(1, 0xbae6fd, 0.95);
    this.soulsFallbackGraphic.strokeCircle(soulsIconX, resY, 5.5);
    this.soulsText.setPosition(soulsIconX + 13, resY);

    const essIconX = mapLeft - 52;
    if (this.essenceIcon) {
      this.essenceIcon
        .setPosition(essIconX, resY)
        .setDisplaySize(iconSize, iconSize);
    }
    this.essenceFallbackGraphic.clear();
    this.essenceFallbackGraphic.fillStyle(DF_PALETTE.agedGold, 0.96);
    this.essenceFallbackGraphic.fillPoints(
      [
        { x: essIconX, y: resY - 5.5 },
        { x: essIconX + 5.5, y: resY },
        { x: essIconX, y: resY + 5.5 },
        { x: essIconX - 5.5, y: resY },
      ],
      true
    );
    this.essenceText.setPosition(essIconX + 13, resY);

    // Trio of dark metallic circular utility buttons aligned below minimap (y = 128, r = 18)
    const r = this.utilityBtnRadius;
    const gap = 50;
    const rowY = 128;
    const rightMostX = w - 34;

    this.muteBtnContainer.setPosition(rightMostX, rowY);
    this.bagBtnContainer.setPosition(rightMostX - gap, rowY);
    this.autoBtnContainer.setPosition(rightMostX - gap * 2, rowY);

    const hitSize = r * 2 + 8;
    this.autoBtnZone.setSize(hitSize, hitSize);
    this.bagBtnZone.setSize(hitSize, hitSize);
    this.muteBtnZone.setSize(hitSize, hitSize);

    const utilIconSize = 20;
    if (this.bagBtnIcon) {
      this.bagBtnIcon.setDisplaySize(utilIconSize, utilIconSize);
    }
    if (this.muteBtnIcon) {
      this.muteBtnIcon.setDisplaySize(utilIconSize, utilIconSize);
    }

    this.bagLabelText.setPosition(0, r + 9).setVisible(true);
    this.muteLabelText.setPosition(0, r + 9).setVisible(true);
  }

  private updateResources(snapshot: HudSnapshot): void {
    this.soulsText.setText(`${snapshot.souls}`);

    const hasSoulsIcon =
      this.soulsIcon !== null &&
      hasUiTextureFrame(this.scene, DF_UI_ICONS_KEY, DF_UI_ICON_FRAMES.souls);
    if (this.soulsIcon) {
      this.soulsIcon.setVisible(hasSoulsIcon);
      if (hasSoulsIcon) {
        this.soulsIcon.setFrame(DF_UI_ICON_FRAMES.souls);
      }
    }
    this.soulsFallbackGraphic.setVisible(!hasSoulsIcon);

    const essences = snapshot.essences ?? 0;
    this.essenceText.setText(`${essences}`).setVisible(true);
    const hasEssIcon =
      this.essenceIcon !== null &&
      hasUiTextureFrame(
        this.scene,
        DF_UI_ICONS_KEY,
        DF_UI_ICON_FRAMES.essence
      );
    if (this.essenceIcon) {
      this.essenceIcon.setVisible(hasEssIcon);
      if (hasEssIcon) {
        this.essenceIcon.setFrame(DF_UI_ICON_FRAMES.essence);
      }
    }
    this.essenceFallbackGraphic.setVisible(!hasEssIcon);
  }

  private drawMinimapStaticShell(r: number): void {
    this.minimapBg.clear();
    this.minimapBg.fillStyle(0x0b1220, 0.92);
    this.minimapBg.fillCircle(0, 0, r);
    this.minimapBg.fillStyle(0x162238, 0.42);
    this.minimapBg.fillCircle(0, 0, r - 6);

    // Subtle radar crosshair & inner guide ring
    this.minimapBg.lineStyle(1, 0x26354d, 0.65);
    this.minimapBg.lineBetween(-r + 5, 0, r - 5, 0);
    this.minimapBg.lineBetween(0, -r + 5, 0, r - 5);
    this.minimapBg.strokeCircle(0, 0, Math.round(r * 0.52));

    // Metallic dark-steel + bronze outer ring + North arrow
    this.minimapFrame.clear();
    this.minimapFrame.lineStyle(3.2, DF_PALETTE.metalDark, 0.98);
    this.minimapFrame.strokeCircle(0, 0, r + 1.2);
    this.minimapFrame.lineStyle(2, DF_PALETTE.bronzeBorder, 0.96);
    this.minimapFrame.strokeCircle(0, 0, r);
    this.minimapFrame.lineStyle(1, DF_PALETTE.metalBorder, 0.72);
    this.minimapFrame.strokeCircle(0, 0, r - 2.6);

    this.minimapFrame.fillStyle(DF_PALETTE.agedGold, 0.98);
    this.minimapFrame.fillTriangle(0, -r - 4.5, -4, -r + 1, 4, -r + 1);
  }

  private drawMinimapDots(snapshot: HudSnapshot): void {
    const r = this.minimapRadius;
    const usableR = r - 7;
    const g = this.minimapDots;

    g.clear();

    const map = snapshot.minimap;
    if (!map || map.arenaWidth <= 0 || map.arenaHeight <= 0) {
      g.fillStyle(0x38bdf8, 0.35);
      g.fillCircle(0, 0, 5);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(0, 0, 2.5);
      this.minimapDebug = { mode: 'empty', scale: 0, rooms: 0, corridors: 0, enemies: 0, collectibles: 0 };
      return;
    }

    const layout = snapshot.minimapLayout;
    const hasLayout =
      !!layout && layout.worldW > 0 && layout.worldH > 0 && layout.rooms.length + layout.corridors.length > 0;

    const clampToCircle = (px: number, py: number, limit: number): { x: number; y: number } => {
      const dist = Math.hypot(px, py);
      if (dist > limit && dist > 0) {
        const k = limit / dist;
        return { x: px * k, y: py * k };
      }
      return { x: px, y: py };
    };

    let project: (wx: number, wy: number) => { x: number; y: number };
    let scale: number;

    if (hasLayout && layout) {
      // Planta do mapa contínuo: se o mapa inteiro cabe no círculo (escala >= mínimo),
      // mostra tudo centrado; senão centra no herói com escala fixa legível.
      const worldW = layout.worldW;
      const worldH = layout.worldH;
      const fitScale = (usableR * 2) / Math.hypot(worldW, worldH);
      const minReadable = usableR / 640;
      const fits = fitScale >= minReadable;
      scale = fits ? fitScale : minReadable;
      const cx = fits ? worldW / 2 : map.heroX;
      const cy = fits ? worldH / 2 : map.heroY;
      project = (wx, wy) => ({ x: (wx - cx) * scale, y: (wy - cy) * scale });

      // Máscara aproximada: recorta cada retângulo ao quadrado inscrito do círculo
      // e descarta o que estiver totalmente fora.
      const lim = usableR + 3;
      const drawRect = (rect: MinimapRect, color: number, alpha: number): void => {
        const a = project(rect.x, rect.y);
        let x0 = a.x;
        let y0 = a.y;
        let x1 = a.x + rect.w * scale;
        let y1 = a.y + rect.h * scale;
        x0 = Math.max(x0, -lim);
        y0 = Math.max(y0, -lim);
        x1 = Math.min(x1, lim);
        y1 = Math.min(y1, lim);
        if (x1 <= x0 || y1 <= y0) return;
        // Descarta retângulos cujo ponto mais próximo do centro já está fora do círculo.
        const nx = Math.max(x0, Math.min(0, x1));
        const ny = Math.max(y0, Math.min(0, y1));
        if (Math.hypot(nx, ny) > lim) return;
        g.fillStyle(color, alpha);
        g.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
      };
      for (const c of layout.corridors) drawRect(c, 0x3b4a63, 0.9);
      for (const room of layout.rooms) drawRect(room, 0x4b5d7a, 0.92);
      g.lineStyle(1, 0x8aa0c0, 0.55);
      for (const room of layout.rooms) {
        const a = project(room.x, room.y);
        const x0 = Math.max(a.x, -lim);
        const y0 = Math.max(a.y, -lim);
        const x1 = Math.min(a.x + room.w * scale, lim);
        const y1 = Math.min(a.y + room.h * scale, lim);
        if (x1 <= x0 || y1 <= y0) continue;
        const nx = Math.max(x0, Math.min(0, x1));
        const ny = Math.max(y0, Math.min(0, y1));
        if (Math.hypot(nx, ny) > lim) continue;
        g.strokeRect(x0, y0, x1 - x0, y1 - y0);
      }
    } else {
      // Formato antigo (arena única: testArena / Ato 1): normaliza a arena no círculo.
      scale = (usableR * 2) / Math.max(map.arenaWidth, map.arenaHeight);
      project = (wx, wy) => {
        const nx = (wx / map.arenaWidth) * 2 - 1;
        const ny = (wy / map.arenaHeight) * 2 - 1;
        return { x: nx * usableR, y: ny * usableR };
      };
    }

    const point = (wx: number, wy: number) => {
      const p = project(wx, wy);
      return clampToCircle(p.x, p.y, usableR);
    };
    const inside = (wx: number, wy: number): boolean => {
      const p = project(wx, wy);
      return Math.hypot(p.x, p.y) <= usableR;
    };

    const collectibles = map.collectibles ?? [];
    for (const c of collectibles) {
      if (hasLayout && !inside(c.x, c.y)) continue;
      const pt = point(c.x, c.y);
      g.fillStyle(0x4ade80, 0.35);
      g.fillCircle(pt.x, pt.y, 3.6);
      g.fillStyle(0xbbf7d0, 1);
      g.fillCircle(pt.x, pt.y, 1.8);
    }

    for (const enemy of map.enemies) {
      // Chefe fica preso à borda quando está longe; monstros comuns só aparecem dentro.
      if (hasLayout && !enemy.isBoss && !inside(enemy.x, enemy.y)) continue;
      const pt = point(enemy.x, enemy.y);
      if (enemy.isBoss) {
        g.fillStyle(0xf97316, 0.35);
        g.fillCircle(pt.x, pt.y, 6.5);
        g.fillStyle(0xf97316, 1);
        g.fillCircle(pt.x, pt.y, 4);
        g.lineStyle(1, 0xfef08a, 0.95);
        g.strokeCircle(pt.x, pt.y, 4);
      } else {
        g.fillStyle(0xef4444, 0.96);
        g.fillCircle(pt.x, pt.y, 2.4);
      }
    }

    const heroPt = point(map.heroX, map.heroY);
    g.fillStyle(0x38bdf8, 0.4);
    g.fillCircle(heroPt.x, heroPt.y, 5.5);
    g.fillStyle(0xe0f2fe, 1);
    g.fillCircle(heroPt.x, heroPt.y, 2.8);

    this.minimapDebug = {
      mode: hasLayout ? 'layout' : 'arena',
      scale,
      rooms: layout?.rooms.length ?? 0,
      corridors: layout?.corridors.length ?? 0,
      enemies: map.enemies.length,
      collectibles: collectibles.length,
    };
  }

  /** Estado do minimapa (debug/E2E). */
  public getMinimapState(): {
    mode: 'empty' | 'arena' | 'layout';
    scale: number;
    rooms: number;
    corridors: number;
    enemies: number;
    collectibles: number;
  } {
    return { ...this.minimapDebug };
  }

  private refreshAutoButtonState(enabled: boolean): void {
    const r = this.utilityBtnRadius;
    this.autoBtnBg.clear();
    if (enabled) {
      this.autoBtnBg.fillStyle(DF_PALETTE.agedGold, 0.14);
      this.autoBtnBg.fillCircle(0, 0, r + 2.5);
    }
    this.autoBtnBg.fillStyle(
      enabled ? 0x241d15 : DF_PALETTE.obsidianBg,
      0.92
    );
    this.autoBtnBg.fillCircle(0, 0, r);
    this.autoBtnBg.lineStyle(2.4, DF_PALETTE.metalDark, 0.96);
    this.autoBtnBg.strokeCircle(0, 0, r + 1);
    this.autoBtnBg.lineStyle(
      1.6,
      enabled ? DF_PALETTE.agedGold : DF_PALETTE.metalBorder,
      enabled ? 0.96 : 0.82
    );
    this.autoBtnBg.strokeCircle(0, 0, r);
    this.autoBtnBg.lineStyle(
      1,
      enabled ? DF_PALETTE.bronzeBorder : DF_PALETTE.metalDark,
      0.75
    );
    this.autoBtnBg.strokeCircle(0, 0, r - 2.5);

    this.autoBtnText.setColor(
      enabled ? DF_PALETTE.textGold : DF_PALETTE.textMuted
    );
  }

  private refreshBagButtonState(bagCount: number): void {
    const r = this.utilityBtnRadius;
    this.bagBtnBg.clear();
    this.bagBtnBg.fillStyle(DF_PALETTE.innerSurface, 0.92);
    this.bagBtnBg.fillCircle(0, 0, r);
    this.bagBtnBg.lineStyle(2.4, DF_PALETTE.metalDark, 0.96);
    this.bagBtnBg.strokeCircle(0, 0, r + 1);
    this.bagBtnBg.lineStyle(
      1.6,
      bagCount > 0 ? DF_PALETTE.agedGold : DF_PALETTE.bronzeBorder,
      0.95
    );
    this.bagBtnBg.strokeCircle(0, 0, r);
    this.bagBtnBg.lineStyle(1, DF_PALETTE.metalDark, 0.85);
    this.bagBtnBg.strokeCircle(0, 0, r - 2.5);

    const hasIcon =
      this.bagBtnIcon !== null &&
      hasUiTextureFrame(this.scene, DF_UI_ICONS_KEY, DF_UI_ICON_FRAMES.bag);
    if (this.bagBtnIcon) {
      this.bagBtnIcon.setVisible(hasIcon);
      if (hasIcon) {
        this.bagBtnIcon.setFrame(DF_UI_ICON_FRAMES.bag);
      }
    }
    this.bagBtnFallbackText.setVisible(!hasIcon);

    this.bagBadgeBg.clear();
    if (bagCount > 0) {
      const bx = Math.round(r * 0.72);
      const by = -Math.round(r * 0.72);
      this.bagBadgeBg.fillStyle(0xb91c1c, 0.98);
      this.bagBadgeBg.fillCircle(bx, by, 7.5);
      this.bagBadgeBg.lineStyle(1.2, DF_PALETTE.agedGold, 0.98);
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
    this.muteBtnBg.fillStyle(
      muted ? DF_PALETTE.deepRecess : DF_PALETTE.innerSurface,
      0.92
    );
    this.muteBtnBg.fillCircle(0, 0, r);
    this.muteBtnBg.lineStyle(2.4, DF_PALETTE.metalDark, 0.96);
    this.muteBtnBg.strokeCircle(0, 0, r + 1);
    this.muteBtnBg.lineStyle(
      1.6,
      muted ? DF_PALETTE.metalBorder : DF_PALETTE.bronzeBorder,
      0.95
    );
    this.muteBtnBg.strokeCircle(0, 0, r);
    this.muteBtnBg.lineStyle(1, DF_PALETTE.metalDark, 0.85);
    this.muteBtnBg.strokeCircle(0, 0, r - 2.5);

    const frame = muted
      ? DF_UI_ICON_FRAMES.audioOff
      : DF_UI_ICON_FRAMES.audioOn;
    const hasIcon =
      this.muteBtnIcon !== null &&
      hasUiTextureFrame(this.scene, DF_UI_ICONS_KEY, frame);
    if (this.muteBtnIcon) {
      this.muteBtnIcon.setVisible(hasIcon);
      if (hasIcon) {
        this.muteBtnIcon.setFrame(frame);
        this.muteBtnIcon.setAlpha(muted ? 0.65 : 1);
      }
    }
    this.muteBtnFallbackText
      .setText(muted ? 'OFF' : 'ON')
      .setColor(muted ? DF_PALETTE.textMuted : DF_PALETTE.textParchment)
      .setVisible(!hasIcon);
  }

  // ===========================================================================
  // BOTTOM-RIGHT: COMBAT CLUSTER (ATAQUE r=42 + ESQUIVA + POÇÃO + SKILLS ARC)
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
      dash: 'SPACE',
      active_1: '1',
      active_2: '2',
      potion: 'Q',
    };
    const radiusBySlot: Record<SkillSlot, number> = {
      dash: 22,
      potion: 24,
      active_1: 26,
      active_2: 26,
    };

    orderedSlots.forEach((slot, idx) => {
      const skill = this.skillBySlot.get(slot) ?? this.skills[idx];
      if (!skill) {
        return;
      }

      const iconFrame = this.resolveSkillIconFrame(skill);
      const radius = radiusBySlot[slot] ?? 26;
      const isActiveSkill = slot === 'active_1' || slot === 'active_2';
      const bg = this.scene.add.graphics();
      const iconImage = hasUiTextureFrame(
        this.scene,
        DF_UI_ICONS_KEY,
        iconFrame
      )
        ? this.scene.add.image(0, 0, DF_UI_ICONS_KEY, iconFrame).setOrigin(0.5)
        : null;

      const fallbackLabelText = this.scene.add
        .text(0, 0, defaultShortLabels[slot], {
          fontFamily: DF_FONTS.BODY,
          resolution: 2,
          fontSize: '10px',
          color: DF_PALETTE.textLight,
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      const cdOverlay = this.scene.add.graphics();
      const cooldownText = this.scene.add
        .text(0, 0, '', {
          fontFamily: DF_FONTS.TITLE,
          resolution: 2,
          fontSize: isActiveSkill ? '16px' : '13px',
          color: '#fff7ed',
          fontStyle: 'bold',
          stroke: '#05070c',
          strokeThickness: 3.5,
        })
        .setOrigin(0.5)
        .setVisible(false);

      const hotkeyBg = this.scene.add.graphics();
      const hotkeyText = this.scene.add
        .text(0, 0, defaultHotkeys[slot], {
          fontFamily: DF_FONTS.BODY,
          resolution: 2,
          fontSize: '8px',
          color: DF_PALETTE.textMuted,
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

      let sideLabelText: Phaser.GameObjects.Text | undefined;
      if (slot === 'dash') {
        sideLabelText = this.scene.add
          .text(-radius - 8, 0, 'Esquiva', {
            fontFamily: DF_FONTS.TITLE,
            resolution: 2,
            fontSize: '12.5px',
            color: DF_PALETTE.textParchment,
            fontStyle: 'bold',
            stroke: '#07090e',
            strokeThickness: 3,
          })
          .setOrigin(1, 0.5);
        children.push(sideLabelText);
      }

      let chargesBg: Phaser.GameObjects.Graphics | undefined;
      let chargesText: Phaser.GameObjects.Text | undefined;
      if (slot === 'potion') {
        chargesBg = this.scene.add.graphics();
        chargesText = this.scene.add
          .text(0, 0, '3', {
            fontFamily: DF_FONTS.BODY,
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
        sideLabelText,
        chargesBg,
        chargesText,
        hitZone,
        radius,
      });
    });
  }

  private layoutActionCluster(w: number, h: number): void {
    // Primary Attack Button: r = 42 at (w - 92, h - 104)
    const atkR = this.attackBtnRadius;
    const atkX = w - 92;
    const atkY = h - 104;
    this.attackBtnContainer.setPosition(atkX, atkY);
    this.attackBtnZone.setSize(atkR * 2 + 8, atkR * 2 + 8);
    this.drawPrimaryAttackButton(atkR);

    // Exact cluster layout matching ref_landscape_hud.jpg
    const slotLayout: Record<SkillSlot, { x: number; y: number; r: number }> = {
      dash: { x: w - 42, y: h - 38, r: 22 },
      potion: { x: atkX - 88, y: atkY + 38, r: 24 },
      active_1: { x: atkX - 94, y: atkY - 30, r: 26 },
      active_2: { x: atkX - 38, y: atkY - 94, r: 26 },
    };

    for (const btn of this.skillButtons) {
      const cfg = slotLayout[btn.skill.slot] ?? {
        x: atkX - 90,
        y: atkY - 30,
        r: 26,
      };
      btn.radius = cfg.r;
      btn.container.setPosition(cfg.x, cfg.y);
      btn.hitZone.setSize(cfg.r * 2 + 8, cfg.r * 2 + 8);

      const iconSize = Math.round(cfg.r * 1.38);
      if (btn.iconImage) {
        if (hasUiTextureFrame(this.scene, DF_UI_ICONS_KEY, btn.iconFrame)) {
          btn.iconImage.setFrame(btn.iconFrame);
        }
        btn.iconImage.setDisplaySize(iconSize, iconSize);
      }

      if (btn.sideLabelText) {
        btn.sideLabelText.setPosition(-cfg.r - 8, 0);
      }

      // Discreet hotkey pill tucked on the bottom rim (SPACE, 1, 2, Q)
      btn.hotkeyBg.clear();
      const label = btn.hotkeyText.text;
      const pillW = Math.max(15, label.length * 5.2 + 8);
      const pillH = 12;
      const pillY = cfg.r + 1;
      btn.hotkeyBg.fillStyle(DF_PALETTE.obsidianBg, 0.84);
      btn.hotkeyBg.fillRoundedRect(
        -pillW / 2,
        pillY - pillH / 2,
        pillW,
        pillH,
        3
      );
      btn.hotkeyBg.lineStyle(1, DF_PALETTE.metalBorder, 0.72);
      btn.hotkeyBg.strokeRoundedRect(
        -pillW / 2,
        pillY - pillH / 2,
        pillW,
        pillH,
        3
      );
      btn.hotkeyText.setPosition(0, pillY).setVisible(true);
    }

    this.layoutPickupButton(atkX, atkY);
  }

  // ===========================================================================
  // BOTTOM-RIGHT: BOTÃO "PEGAR" (T-132) — acima do Ataque, à direita de active_2
  // ===========================================================================

  private buildPickupButton(): void {
    const scene = this.scene;
    this.pickupBtnGlow = scene.add.graphics();
    this.pickupBtnBg = scene.add.graphics();
    this.pickupBtnIcon = hasUiTextureFrame(
      scene,
      DF_UI_ICONS_KEY,
      DF_UI_ICON_FRAMES.bag
    )
      ? scene.add
          .image(0, -5, DF_UI_ICONS_KEY, DF_UI_ICON_FRAMES.bag)
          .setOrigin(0.5)
      : null;
    this.pickupBtnFallbackText = scene.add
      .text(0, -5, 'PEG', {
        fontFamily: DF_FONTS.BODY,
        resolution: 2,
        fontSize: '10px',
        color: DF_PALETTE.textLight,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.pickupBtnLabelText = scene.add
      .text(0, 11, 'Pegar', {
        fontFamily: DF_FONTS.TITLE,
        resolution: 2,
        fontSize: '9.5px',
        color: '#fff7ed',
        fontStyle: 'bold',
        stroke: '#07090e',
        strokeThickness: 2.5,
      })
      .setOrigin(0.5);
    this.pickupHotkeyBg = scene.add.graphics();
    this.pickupHotkeyText = scene.add
      .text(0, 0, 'E', {
        fontFamily: DF_FONTS.BODY,
        resolution: 2,
        fontSize: '8px',
        color: DF_PALETTE.textMuted,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const r = this.pickupBtnRadius;
    this.pickupBtnZone = scene.add
      .zone(0, 0, r * 2 + 8, r * 2 + 8)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.pickupBtnZone.on(
      'pointerdown',
      (
        pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event?: Phaser.Types.Input.EventData
      ) => {
        // Consome o toque: não chega ao joystick nem dispara ataque.
        event?.stopPropagation?.();
        soundManager.unlock();
        if (pointer.id >= 0) {
          this.triggerPickupNearest();
        }
      }
    );

    const children: Phaser.GameObjects.GameObject[] = [
      this.pickupBtnGlow,
      this.pickupBtnBg,
    ];
    if (this.pickupBtnIcon) {
      children.push(this.pickupBtnIcon);
    }
    children.push(
      this.pickupBtnFallbackText,
      this.pickupBtnLabelText,
      this.pickupHotkeyBg,
      this.pickupHotkeyText,
      this.pickupBtnZone
    );

    this.pickupBtnContainer = scene.add
      .container(0, 0, children)
      .setScrollFactor(0)
      .setDepth(1021);
  }

  private layoutPickupButton(atkX: number, atkY: number): void {
    const r = this.pickupBtnRadius;
    // Acima do Ataque, levemente à direita; folga medida para active_2 (atkX - 38, atkY - 94, r 26).
    this.pickupBtnContainer.setPosition(atkX + 24, atkY - 92);
    this.pickupBtnZone.setSize(r * 2 + 8, r * 2 + 8);

    const iconSize = Math.round(r * 0.98);
    if (this.pickupBtnIcon) {
      this.pickupBtnIcon.setPosition(0, -5).setDisplaySize(iconSize, iconSize);
    }
    this.pickupBtnFallbackText.setPosition(0, -5);
    this.pickupBtnLabelText.setPosition(0, 11);

    this.pickupHotkeyBg.clear();
    const pillW = 15;
    const pillH = 12;
    const pillY = r + 1;
    this.pickupHotkeyBg.fillStyle(DF_PALETTE.obsidianBg, 0.84);
    this.pickupHotkeyBg.fillRoundedRect(
      -pillW / 2,
      pillY - pillH / 2,
      pillW,
      pillH,
      3
    );
    this.pickupHotkeyBg.lineStyle(1, DF_PALETTE.metalBorder, 0.72);
    this.pickupHotkeyBg.strokeRoundedRect(
      -pillW / 2,
      pillY - pillH / 2,
      pillW,
      pillH,
      3
    );
    this.pickupHotkeyText.setPosition(0, pillY);

    this.pickupStateKey = '';
  }

  private isPickupAvailable(): boolean {
    return this.lastSnapshot.pickupAvailable === true && !this.isRunEnded();
  }

  private triggerPickupNearest(): void {
    if (!this.isPickupAvailable()) {
      return;
    }
    this.pulseContainer(this.pickupBtnContainer);
    this.callbacks.onPickupNearest?.();
  }

  private getPickupRarityColor(rarity: HudSnapshot['pickupRarity']): number {
    switch (rarity) {
      case 'magic':
        return 0x60a5fa;
      case 'rare':
        return 0xfacc15;
      case 'legendary':
        return 0xf97316;
      default:
        return 0xc4c4cc;
    }
  }

  private refreshPickupButtonState(snapshot: HudSnapshot): void {
    if (!this.pickupBtnContainer) {
      return;
    }
    const available =
      snapshot.pickupAvailable === true &&
      snapshot.runStatus !== 'victory' &&
      snapshot.runStatus !== 'defeat';
    const rarity = snapshot.pickupRarity ?? 'common';
    const stateKey = available ? `on:${rarity}` : 'off';
    if (stateKey === this.pickupStateKey) {
      return;
    }
    this.pickupStateKey = stateKey;

    const r = this.pickupBtnRadius;
    const ringColor = this.getPickupRarityColor(rarity);
    const bg = this.pickupBtnBg;
    const glow = this.pickupBtnGlow;
    bg.clear();
    glow.clear();

    bg.fillStyle(DF_PALETTE.obsidianBg, available ? 0.94 : 0.8);
    bg.fillCircle(0, 0, r);
    bg.fillStyle(
      available ? ringColor : DF_PALETTE.metalDark,
      available ? 0.2 : 0.35
    );
    bg.fillCircle(0, 0, r - 3);

    bg.lineStyle(2.8, DF_PALETTE.metalDark, 0.98);
    bg.strokeCircle(0, 0, r + 1.2);
    if (available) {
      bg.lineStyle(2.2, ringColor, 0.98);
      bg.strokeCircle(0, 0, r);
      bg.lineStyle(1, 0xffffff, 0.22);
      bg.strokeCircle(0, 0, r - 3);

      glow.fillStyle(ringColor, 0.3);
      glow.fillCircle(0, 0, r + 6);
      glow.fillStyle(ringColor, 0.18);
      glow.fillCircle(0, 0, r + 3);
    } else {
      bg.lineStyle(1.6, DF_PALETTE.metalBorder, 0.6);
      bg.strokeCircle(0, 0, r);
      bg.lineStyle(1.1, DF_PALETTE.deepRecess, 0.7);
      bg.strokeCircle(0, 0, r - 3);
    }

    const hasIcon =
      this.pickupBtnIcon !== null &&
      hasUiTextureFrame(this.scene, DF_UI_ICONS_KEY, DF_UI_ICON_FRAMES.bag);
    if (this.pickupBtnIcon) {
      this.pickupBtnIcon.setVisible(hasIcon);
    }
    this.pickupBtnFallbackText.setVisible(!hasIcon);
    this.pickupHotkeyText.setColor(
      available ? DF_PALETTE.textParchment : DF_PALETTE.textMuted
    );

    this.pickupBtnContainer.setAlpha(available ? 1 : 0.45);

    this.pickupPulseTween?.stop();
    this.pickupPulseTween = null;
    glow.setAlpha(1).setScale(1);
    if (
      available &&
      this.scene.tweens &&
      typeof this.scene.tweens.add === 'function'
    ) {
      this.pickupPulseTween = this.scene.tweens.add({
        targets: glow,
        alpha: { from: 1, to: 0.35 },
        scaleX: { from: 1, to: 1.08 },
        scaleY: { from: 1, to: 1.08 },
        duration: 720,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private drawPrimaryAttackButton(r: number): void {
    this.attackBtnBg.clear();

    // Warm glowing ember/bronze outer halo
    this.attackBtnBg.fillStyle(0xf97316, 0.22);
    this.attackBtnBg.fillCircle(0, 0, r + 7);
    this.attackBtnBg.fillStyle(0xd4a95a, 0.16);
    this.attackBtnBg.fillCircle(0, 0, r + 3.5);

    // Dark crimson-obsidian metallic disc
    this.attackBtnBg.fillStyle(0x180b09, 0.96);
    this.attackBtnBg.fillCircle(0, 0, r);
    this.attackBtnBg.fillStyle(0x5f1b0d, 0.62);
    this.attackBtnBg.fillCircle(0, 0, r - 4);
    this.attackBtnBg.fillStyle(0x9a3412, 0.28);
    this.attackBtnBg.fillCircle(0, 6, r - 10);

    // Double dark metallic ring + bright glowing orange/bronze ring
    this.attackBtnBg.lineStyle(3.8, DF_PALETTE.metalDark, 0.98);
    this.attackBtnBg.strokeCircle(0, 0, r + 2);
    this.attackBtnBg.lineStyle(2.6, DF_PALETTE.agedGold, 0.98);
    this.attackBtnBg.strokeCircle(0, 0, r);
    this.attackBtnBg.lineStyle(2, 0xf97316, 0.95);
    this.attackBtnBg.strokeCircle(0, 0, r - 3);
    this.attackBtnBg.lineStyle(1, 0xfdba74, 0.55);
    this.attackBtnBg.strokeCircle(0, 0, r - 5);

    const hasIcon =
      this.attackBtnIcon !== null &&
      hasUiTextureFrame(this.scene, DF_UI_ICONS_KEY, DF_UI_ICON_FRAMES.attack);
    if (this.attackBtnIcon) {
      this.attackBtnIcon.setVisible(hasIcon);
      if (hasIcon) {
        const size = Math.round(r * 1.06);
        this.attackBtnIcon
          .setPosition(0, -8)
          .setFrame(DF_UI_ICON_FRAMES.attack)
          .setDisplaySize(size, size);
      }
    }
    this.attackBtnFallbackText.setPosition(0, -8).setVisible(!hasIcon);
    this.attackBtnLabelText.setPosition(0, 22).setVisible(true);
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
    btn.bg.fillStyle(DF_PALETTE.obsidianBg, isReady ? 0.94 : 0.78);
    btn.bg.fillCircle(0, 0, r);
    btn.bg.fillStyle(palette.fill, isReady ? 0.48 : 0.22);
    btn.bg.fillCircle(0, 0, r - 3);

    // Dark metallic outer ring + refined bronze/force bevel
    btn.bg.lineStyle(2.8, DF_PALETTE.metalDark, 0.98);
    btn.bg.strokeCircle(0, 0, r + 1.2);
    btn.bg.lineStyle(
      1.8,
      isReady ? DF_PALETTE.bronzeBorder : DF_PALETTE.metalBorder,
      isReady ? 0.96 : 0.6
    );
    btn.bg.strokeCircle(0, 0, r);
    btn.bg.lineStyle(
      1.1,
      isReady ? palette.stroke : DF_PALETTE.deepRecess,
      isReady ? 0.78 : 0.7
    );
    btn.bg.strokeCircle(0, 0, r - 2.4);

    // Smooth dark translucent radial cooldown sweep
    btn.cdOverlay.clear();
    if (cdRemainingMs > 0 && totalCooldownMs > 0) {
      const ratio = Math.min(1, cdRemainingMs / totalCooldownMs);
      const startAngle = Phaser.Math.DegToRad(-90);
      const endAngle = Phaser.Math.DegToRad(-90 + 360 * ratio);

      btn.cdOverlay.fillStyle(0x04060a, 0.76);
      btn.cdOverlay.slice(0, 0, r - 1.5, startAngle, endAngle, false);
      btn.cdOverlay.fillPath();

      btn.cdOverlay.lineStyle(2.2, DF_PALETTE.agedGold, 0.94);
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
    const bx = Math.round(r * 0.72);
    const by = -Math.round(r * 0.72);
    const hasCharges = charges > 0;

    btn.chargesBg.clear();
    btn.chargesBg.fillStyle(
      hasCharges ? 0x991b1b : DF_PALETTE.buttonDisabledFill,
      0.98
    );
    btn.chargesBg.fillCircle(bx, by, 8.5);
    btn.chargesBg.lineStyle(
      1.4,
      hasCharges ? DF_PALETTE.agedGold : DF_PALETTE.metalBorder,
      0.98
    );
    btn.chargesBg.strokeCircle(bx, by, 8.5);

    btn.chargesText
      .setPosition(bx, by)
      .setText(`${Math.max(0, charges)}`)
      .setColor(hasCharges ? '#fff7ed' : DF_PALETTE.textMuted)
      .setVisible(true);
  }

  private resolveSkillIconFrame(skill: SkillDef): number {
    if (skill.slot === 'dash') {
      return DF_UI_ICON_FRAMES.dash;
    }
    if (skill.slot === 'potion') {
      return DF_UI_ICON_FRAMES.potion;
    }
    switch (skill.force) {
      case 'inferno':
        return DF_UI_ICON_FRAMES.skillInferno;
      case 'empireo':
        return DF_UI_ICON_FRAMES.skillEmpireo;
      case 'submundo':
        return DF_UI_ICON_FRAMES.skillSubmundo;
      default:
        return DF_UI_ICON_FRAMES.skillInferno;
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
        return { fill: 0x1d3557, stroke: DF_PALETTE.agedGold };
      default:
        return { fill: 0x1a2a3a, stroke: 0x48cae4 };
    }
  }

  // ===========================================================================
  // TOP-CENTER: BOSS HP BAR, ORNATE BANNER & END-OF-RUN MODAL
  // ===========================================================================

  private drawBossHpBar(bossHp: number, bossMaxHp: number): void {
    const width = 300;
    const height = 16;
    const bevel = 7;
    const ratio =
      bossMaxHp > 0 ? Math.max(0, Math.min(1, bossHp / bossMaxHp)) : 0;

    this.bossBarGraphic.clear();

    // Dark backing plate behind Boss bar
    this.bossBarGraphic.fillStyle(DF_PALETTE.obsidianBg, 0.88);
    this.bossBarGraphic.fillRoundedRect(
      -width / 2 - 6,
      -height / 2 - 4,
      width + 12,
      height + 8,
      4
    );

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
      const fillRight =
        -innerHalfW + Math.max(innerBevel * 2, innerHalfW * 2 * ratio);
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

    this.strokeChamferedSymmetricBar(
      this.bossBarGraphic,
      width,
      height,
      bevel,
      2,
      DF_PALETTE.agedGold,
      0.98
    );

    const halfW = width / 2 + 2;
    this.bossBarGraphic.fillStyle(DF_PALETTE.goldBright, 0.96);
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
    const w = this.viewport.width;
    this.lastBannerWidth = showBossBar ? 420 : 360;
    const bannerY = showBossBar ? 88 : 38;
    this.bannerLabel.setWordWrapWidth(this.lastBannerWidth - 28);
    this.bannerContainer.setPosition(w / 2, bannerY);
  }

  private drawBannerBox(): void {
    const width = this.lastBannerWidth;
    const textHeight = this.bannerLabel.height || 16;
    const height = Math.max(34, Math.min(54, Math.ceil(textHeight) + 16));

    drawOrnatePanel(this.bannerBg, {
      x: -width / 2,
      y: -height / 2,
      width,
      height,
      bevel: 7,
      fillColor: DF_PALETTE.obsidianBg,
      fillAlpha: 0.92,
      innerFillColor: DF_PALETTE.innerSurface,
      outerBorderColor: DF_PALETTE.metalBorder,
      innerBorderColor: DF_PALETTE.bronzeBorder,
      accentColor: DF_PALETTE.agedGold,
      shadow: true,
      shadowOffsetX: 2,
      shadowOffsetY: 3,
      shadowAlpha: 0.45,
      cornerOrnaments: false,
      clear: true,
    });
  }

  private drawModalBackground(
    isVictory: boolean,
    hasLootSummary = false
  ): void {
    const w = this.viewport.width;
    const h = this.viewport.height;
    const boxW = Math.min(460, w - 48);
    const boxH = hasLootSummary ? 286 : 252;

    this.modalBackdrop.clear();
    this.modalBackdrop.fillStyle(0x04060a, 0.82);
    this.modalBackdrop.fillRect(-w / 2, -h / 2, w, h);

    const accent = isVictory
      ? DF_PALETTE.agedGold
      : DF_PALETTE.buttonCrimsonBorder;
    const headerColor = isVictory
      ? DF_PALETTE.buttonGoldFill
      : DF_PALETTE.buttonCrimsonFill;

    drawOrnatePanel(this.modalBox, {
      x: -boxW / 2,
      y: -boxH / 2,
      width: boxW,
      height: boxH,
      bevel: 12,
      fillColor: DF_PALETTE.obsidianBg,
      fillAlpha: 0.98,
      innerFillColor: DF_PALETTE.innerSurface,
      outerBorderColor: accent,
      innerBorderColor: isVictory
        ? DF_PALETTE.bronzeBorder
        : DF_PALETTE.buttonCrimsonBorder,
      accentColor: accent,
      headerHeight: 46,
      headerColor,
      headerGlowColor: accent,
      headerGlowAlpha: 0.22,
      shadow: true,
      shadowOffsetX: 5,
      shadowOffsetY: 8,
      shadowAlpha: 0.65,
      cornerOrnaments: true,
      clear: true,
    });

    const dividerY = hasLootSummary ? 2 : 10;
    drawOrnamentalDivider(
      this.modalBox,
      -boxW / 2 + 28,
      dividerY,
      boxW - 56,
      isVictory ? DF_PALETTE.bronzeBorder : DF_PALETTE.buttonCrimsonBorder
    );
  }

  private redrawRestartButton(): void {
    const isVictory = this.lastSnapshot.runStatus === 'victory';
    drawOrnateButton(this.restartBtnBg, -100, -21, 200, 42, {
      variant: isVictory ? 'gold' : 'crimson',
      bevel: 7,
      hovered: this.restartBtnHovered,
      pressed: this.restartBtnPressed,
      clear: true,
    });
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

    if (code === 'KeyE') {
      this.triggerPickupNearest();
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
