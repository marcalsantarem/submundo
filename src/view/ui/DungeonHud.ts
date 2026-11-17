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
import { VirtualJoystick } from './VirtualJoystick';

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  souls: number;
  roomNumber: number;
  totalRooms: number;
  isBossRoom: boolean;
  roomTitle: string;
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
}

interface SkillButtonView {
  skill: SkillDef;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  cdOverlay: Phaser.GameObjects.Graphics;
  hitZone: Phaser.GameObjects.Zone;
  labelText: Phaser.GameObjects.Text;
  hotkeyText: Phaser.GameObjects.Text;
  cooldownText: Phaser.GameObjects.Text;
  chargesText?: Phaser.GameObjects.Text;
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

export class DungeonHud {
  private readonly scene: Phaser.Scene;
  private readonly skills: SkillDef[];
  private readonly callbacks: {
    onUseSkill: (skillId: string) => void;
    onRestartRun: () => void;
    onToggleInventory?: () => void;
  };

  private viewport: ViewportConfig;
  private readonly joystick: VirtualJoystick;
  private movementKeys?: MovementKeys;
  private readonly keydownHandler: (event: KeyboardEvent) => void;

  // Top HUD: Hero HP + Souls + Room Info
  private topPanelBg: Phaser.GameObjects.Graphics;
  private hpBarGraphic: Phaser.GameObjects.Graphics;
  private hpText: Phaser.GameObjects.Text;
  private soulsText: Phaser.GameObjects.Text;
  private roomText: Phaser.GameObjects.Text;
  private roomTitleText: Phaser.GameObjects.Text;

  // Compact Bag Button
  private bagBtnContainer: Phaser.GameObjects.Container;
  private bagBtnBg: Phaser.GameObjects.Graphics;
  private bagBtnText: Phaser.GameObjects.Text;
  private bagBtnZone: Phaser.GameObjects.Zone;

  // Boss HP Bar
  private bossContainer: Phaser.GameObjects.Container;
  private bossBarGraphic: Phaser.GameObjects.Graphics;
  private bossNameText: Phaser.GameObjects.Text;
  private bossHpText: Phaser.GameObjects.Text;

  // Banner (narrative / room cleared)
  private bannerContainer: Phaser.GameObjects.Container;
  private bannerBg: Phaser.GameObjects.Graphics;
  private bannerLabel: Phaser.GameObjects.Text;

  // Skill Action Buttons
  private readonly skillButtons: SkillButtonView[] = [];
  private readonly skillBySlot = new Map<SkillSlot, SkillDef>();

  // End-of-run Modal (Victory / Defeat)
  private modalContainer: Phaser.GameObjects.Container;
  private modalBackdrop: Phaser.GameObjects.Graphics;
  private modalBox: Phaser.GameObjects.Graphics;
  private modalTitleText: Phaser.GameObjects.Text;
  private modalBodyText: Phaser.GameObjects.Text;
  private modalSoulsText: Phaser.GameObjects.Text;
  private modalLootText: Phaser.GameObjects.Text;
  private restartBtnContainer: Phaser.GameObjects.Container;
  private restartBtnBg: Phaser.GameObjects.Graphics;
  private restartBtnText: Phaser.GameObjects.Text;
  private restartBtnZone: Phaser.GameObjects.Zone;

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
  };

  constructor(
    scene: Phaser.Scene,
    skills: SkillDef[],
    callbacks: {
      onUseSkill: (skillId: string) => void;
      onRestartRun: () => void;
      onToggleInventory?: () => void;
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

    // Top HUD graphics & texts
    this.topPanelBg = scene.add.graphics().setScrollFactor(0).setDepth(1010);
    this.hpBarGraphic = scene.add.graphics().setScrollFactor(0).setDepth(1011);

    this.hpText = scene.add
      .text(0, 0, 'HP 100/100', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#f8f9fa',
        fontStyle: 'bold',
      })
      .setScrollFactor(0)
      .setDepth(1012);

    this.soulsText = scene.add
      .text(0, 0, 'Almas: 0', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#90e0ef',
        fontStyle: 'bold',
      })
      .setScrollFactor(0)
      .setDepth(1012);

    this.roomText = scene.add
      .text(0, 0, 'Sala 1/5', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffd166',
        fontStyle: 'bold',
      })
      .setScrollFactor(0)
      .setDepth(1012);

    this.roomTitleText = scene.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ced4da',
      })
      .setScrollFactor(0)
      .setDepth(1012);

    // Compact Bag Button ("Bolsa (N)")
    this.bagBtnBg = scene.add.graphics();
    this.bagBtnBg.fillStyle(0x162033, 0.94);
    this.bagBtnBg.fillRoundedRect(-52, -14, 104, 28, 6);
    this.bagBtnBg.lineStyle(1.5, 0x38bdf8, 0.9);
    this.bagBtnBg.strokeRoundedRect(-52, -14, 104, 28, 6);

    this.bagBtnText = scene.add
      .text(0, 0, 'Bolsa (0)', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#e0f2fe',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5);

    this.bagBtnZone = scene.add
      .zone(0, 0, 104, 28)
      .setOrigin(0.5, 0.5)
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
        if (
          this.lastSnapshot.runStatus === 'victory' ||
          this.lastSnapshot.runStatus === 'defeat'
        ) {
          return;
        }
        this.callbacks.onToggleInventory?.();
      }
    );

    this.bagBtnContainer = scene.add
      .container(0, 0, [this.bagBtnBg, this.bagBtnText, this.bagBtnZone])
      .setScrollFactor(0)
      .setDepth(1020);

    // Boss HP Container
    this.bossBarGraphic = scene.add.graphics();
    this.bossNameText = scene.add
      .text(0, -16, 'Carcereiro Infernal', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffccd5',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5);
    this.bossHpText = scene.add
      .text(0, 0, '0/0', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0.5);

    this.bossContainer = scene.add
      .container(0, 0, [this.bossBarGraphic, this.bossNameText, this.bossHpText])
      .setScrollFactor(0)
      .setDepth(1015)
      .setVisible(false);

    // Narrative / Status Banner
    this.bannerBg = scene.add.graphics();
    this.bannerLabel = scene.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#e9ecef',
        align: 'center',
        wordWrap: { width: 420 },
      })
      .setOrigin(0.5, 0.5);

    this.bannerContainer = scene.add
      .container(0, 0, [this.bannerBg, this.bannerLabel])
      .setScrollFactor(0)
      .setDepth(1014)
      .setVisible(false);

    // Build Skill Buttons
    this.buildSkillButtons();

    // Build Victory/Defeat Modal
    this.modalBackdrop = scene.add.graphics();
    this.modalBox = scene.add.graphics();
    this.modalTitleText = scene.add
      .text(0, -76, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffd166',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: 300 },
      })
      .setOrigin(0.5, 0.5);

    this.modalBodyText = scene.add
      .text(0, -18, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#dee2e6',
        align: 'center',
        wordWrap: { width: 290 },
      })
      .setOrigin(0.5, 0.5);

    this.modalSoulsText = scene.add
      .text(0, 34, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#90e0ef',
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5, 0.5);

    this.modalLootText = scene.add
      .text(0, 52, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#a5f3fc',
        align: 'center',
        wordWrap: { width: 290 },
      })
      .setOrigin(0.5, 0.5)
      .setVisible(false);

    this.restartBtnBg = scene.add.graphics();
    this.restartBtnBg.fillStyle(0x9d0208, 0.95);
    this.restartBtnBg.fillRoundedRect(-90, -20, 180, 40, 6);
    this.restartBtnBg.lineStyle(2, 0xffba08, 1);
    this.restartBtnBg.strokeRoundedRect(-90, -20, 180, 40, 6);

    this.restartBtnText = scene.add
      .text(0, 0, 'Nova Incursão', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5);

    this.restartBtnZone = scene.add
      .zone(0, 0, 180, 40)
      .setOrigin(0.5, 0.5)
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

    // Setup Keyboard Controls
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
    if (
      this.lastSnapshot.runStatus === 'victory' ||
      this.lastSnapshot.runStatus === 'defeat'
    ) {
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

    // 1. Hero HP + Souls + Room Indicator + Bag Count
    const clampedHp = Math.max(0, Math.min(snapshot.hp, snapshot.maxHp));
    this.hpText.setText(`HP ${Math.ceil(clampedHp)}/${snapshot.maxHp}`);
    this.soulsText.setText(`Almas: ${snapshot.souls}`);
    this.roomText.setText(`Sala ${snapshot.roomNumber}/${snapshot.totalRooms}`);
    this.roomTitleText.setText(snapshot.roomTitle || '');
    this.bagBtnText.setText(`Bolsa (${snapshot.bagCount ?? 0})`);

    this.drawHeroHpBar(clampedHp, snapshot.maxHp);

    // 2. Boss HP Bar (Room 5)
    const showBossBar =
      snapshot.isBossRoom &&
      typeof snapshot.bossMaxHp === 'number' &&
      snapshot.bossMaxHp > 0;
    this.bossContainer.setVisible(showBossBar);
    if (showBossBar) {
      const bossMax = snapshot.bossMaxHp ?? 1;
      const bossHp = Math.max(0, Math.min(snapshot.bossHp ?? 0, bossMax));
      this.bossNameText.setText(snapshot.bossName || 'Carcereiro Infernal');
      this.bossHpText.setText(`${Math.ceil(bossHp)}/${bossMax}`);
      this.drawBossHpBar(bossHp, bossMax);
    }

    // 3. Narrative / Status Banner
    const resolvedBanner =
      snapshot.bannerText ??
      (snapshot.runStatus === 'room_cleared'
        ? dialoguesData.entries.room_clear.shortText
        : '');
    if (
      resolvedBanner &&
      snapshot.runStatus !== 'victory' &&
      snapshot.runStatus !== 'defeat'
    ) {
      this.bannerContainer.setVisible(true);
      this.bannerLabel.setText(resolvedBanner);
      this.drawBannerBox();
    } else {
      this.bannerContainer.setVisible(false);
    }

    // 4. Skill Buttons Cooldowns & Potion Charges
    for (const btn of this.skillButtons) {
      const cdRemainingMs = Math.max(0, snapshot.skillCooldownsMs[btn.skill.id] ?? 0);
      const isOnCooldown = cdRemainingMs > 0;
      const isOutOfCharges =
        btn.skill.slot === 'potion' && snapshot.potionCharges <= 0;

      if (btn.chargesText) {
        btn.chargesText.setText(`${snapshot.potionCharges}/${snapshot.maxPotionCharges}`);
      }

      btn.labelText.setVisible(!isOnCooldown);

      if (isOnCooldown) {
        btn.cooldownText.setY(btn.chargesText ? -5 : 0);
        btn.cooldownText.setVisible(true);
        btn.cooldownText.setText(`${(cdRemainingMs / 1000).toFixed(1)}s`);
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

    // 5. Victory / Defeat Modal
    if (snapshot.runStatus === 'victory' || snapshot.runStatus === 'defeat') {
      this.modalContainer.setVisible(true);
      const isVictory = snapshot.runStatus === 'victory';
      const entry = isVictory
        ? dialoguesData.entries.run_victory
        : dialoguesData.entries.run_death;

      const lootText = snapshot.lootSummaryText?.trim() ?? '';
      const hasLootSummary = lootText.length > 0;

      this.modalTitleText.setText(entry.title);
      this.modalTitleText.setColor(isVictory ? '#ffd166' : '#ff4d6d');
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

    // Top Panel Layout
    this.topPanelBg.clear();
    this.topPanelBg.fillStyle(0x090c14, 0.82);
    const topBarHeight = isMobile ? 58 : 52;
    this.topPanelBg.fillRect(0, 0, w, topBarHeight);
    this.topPanelBg.lineStyle(1, 0x2b3448, 0.9);
    this.topPanelBg.lineBetween(0, topBarHeight, w, topBarHeight);

    if (isMobile) {
      this.hpText.setPosition(12, 8);
      this.soulsText.setPosition(12, 34);
      this.roomText.setOrigin(1, 0).setPosition(w - 12, 8);
      this.roomTitleText.setOrigin(1, 0).setPosition(w - 12, 30);
      this.bagBtnContainer.setPosition(w - 58, h - 222);
    } else {
      this.hpText.setPosition(16, 8);
      this.soulsText.setPosition(230, 16);
      this.roomText.setOrigin(1, 0).setPosition(w - 16, 8);
      this.roomTitleText.setOrigin(1, 0).setPosition(w - 16, 28);
      this.bagBtnContainer.setPosition(462, 26);
    }

    // Boss Container Layout
    this.bossContainer.setPosition(w / 2, isMobile ? 84 : 78);

    // Banner Container Layout
    const bannerY = this.lastSnapshot.isBossRoom
      ? isMobile
        ? 126
        : 120
      : isMobile
        ? 82
        : 76;
    this.bannerContainer.setPosition(w / 2, bannerY);
    this.bannerLabel.setWordWrapWidth(isMobile ? w - 40 : 460);

    // Skill Action Buttons Layout (Ergonomic 1-thumb reach in Mobile & Desktop)
    this.positionSkillButtons(isMobile, w, h);

    // Modal Layout
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

    this.topPanelBg.destroy();
    this.hpBarGraphic.destroy();
    this.hpText.destroy();
    this.soulsText.destroy();
    this.roomText.destroy();
    this.roomTitleText.destroy();
    this.bagBtnContainer.destroy();
    this.bossContainer.destroy();
    this.bannerContainer.destroy();
    this.modalContainer.destroy();

    for (const btn of this.skillButtons) {
      btn.container.destroy();
    }
  }

  private buildSkillButtons(): void {
    const orderedSlots: SkillSlot[] = ['dash', 'active_1', 'active_2', 'potion'];
    const defaultShortLabels: Record<SkillSlot, string> = {
      dash: 'Dash',
      active_1: 'Carmesim',
      active_2: 'Erupção',
      potion: 'Poção',
    };
    const defaultHotkeys: Record<SkillSlot, string> = {
      dash: 'ESP/SHIFT',
      active_1: '1 / J',
      active_2: '2 / K',
      potion: '3 / Q',
    };

    orderedSlots.forEach((slot, idx) => {
      const skill = this.skillBySlot.get(slot) ?? this.skills[idx];
      if (!skill) {
        return;
      }

      const radius = slot === 'dash' ? 30 : 28;
      const bg = this.scene.add.graphics();
      const cdOverlay = this.scene.add.graphics();

      const shortName = defaultShortLabels[slot] || skill.name.split(' ')[0];
      const labelText = this.scene.add
        .text(0, -4, shortName, {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5, 0.5);

      const hotkeyText = this.scene.add
        .text(0, radius + 10, defaultHotkeys[slot], {
          fontFamily: 'monospace',
          fontSize: '9px',
          color: '#adb5bd',
        })
        .setOrigin(0.5, 0.5);

      const cooldownText = this.scene.add
        .text(0, 0, '', {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#ffd166',
          fontStyle: 'bold',
        })
        .setOrigin(0.5, 0.5)
        .setVisible(false);

      const children: Phaser.GameObjects.GameObject[] = [
        bg,
        cdOverlay,
        labelText,
        hotkeyText,
        cooldownText,
      ];

      let chargesText: Phaser.GameObjects.Text | undefined;
      if (slot === 'potion') {
        chargesText = this.scene.add
          .text(0, 12, '3/3', {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#80ed99',
            fontStyle: 'bold',
          })
          .setOrigin(0.5, 0.5);
        children.push(chargesText);
      }

      const hitZone = this.scene.add
        .zone(0, 0, radius * 2 + 8, radius * 2 + 8)
        .setOrigin(0.5, 0.5)
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
          if (
            this.lastSnapshot.runStatus === 'victory' ||
            this.lastSnapshot.runStatus === 'defeat'
          ) {
            return;
          }
          if (pointer.id >= 0) {
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
        container,
        bg,
        cdOverlay,
        hitZone,
        labelText,
        hotkeyText,
        cooldownText,
        chargesText,
        radius,
      });
    });
  }

  private positionSkillButtons(isMobile: boolean, w: number, h: number): void {
    // Ergonomic arc for 1-thumb reach in mobile_portrait (360x640) and clean cluster in desktop (800x600)
    const positionsBySlot: Record<SkillSlot, { x: number; y: number }> = isMobile
      ? {
          dash: { x: w - 58, y: h - 76 },
          active_1: { x: w - 130, y: h - 78 },
          active_2: { x: w - 116, y: h - 148 },
          potion: { x: w - 48, y: h - 154 },
        }
      : {
          dash: { x: w - 246, y: h - 54 },
          active_1: { x: w - 174, y: h - 54 },
          active_2: { x: w - 102, y: h - 54 },
          potion: { x: w - 38, y: h - 54 },
        };

    for (const btn of this.skillButtons) {
      const pos = positionsBySlot[btn.skill.slot] ?? { x: w - 60, y: h - 60 };
      btn.container.setPosition(pos.x, pos.y);
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const code = event.code;
    const key = event.key.toLowerCase();

    if (
      this.lastSnapshot.runStatus === 'victory' ||
      this.lastSnapshot.runStatus === 'defeat'
    ) {
      if (code === 'Enter' || key === 'r') {
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

    if (key === 'i' || key === 'b') {
      this.callbacks.onToggleInventory?.();
    }
  }

  private drawHeroHpBar(hp: number, maxHp: number): void {
    const isMobile = this.viewport.mode === 'mobile_portrait';
    const x = isMobile ? 112 : 118;
    const y = 10;
    const width = isMobile ? 96 : 100;
    const height = 12;
    const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;

    this.hpBarGraphic.clear();
    this.hpBarGraphic.fillStyle(0x1b1f2a, 0.95);
    this.hpBarGraphic.fillRoundedRect(x, y, width, height, 3);

    if (ratio > 0) {
      const fillColor = ratio > 0.35 ? 0xd90429 : 0xff4d6d;
      this.hpBarGraphic.fillStyle(fillColor, 1);
      this.hpBarGraphic.fillRoundedRect(x, y, Math.max(4, width * ratio), height, 3);
    }

    this.hpBarGraphic.lineStyle(1, 0xadb5bd, 0.8);
    this.hpBarGraphic.strokeRoundedRect(x, y, width, height, 3);
  }

  private drawBossHpBar(bossHp: number, bossMaxHp: number): void {
    const isMobile = this.viewport.mode === 'mobile_portrait';
    const width = isMobile ? 280 : 380;
    const height = 14;
    const ratio = bossMaxHp > 0 ? Math.max(0, Math.min(1, bossHp / bossMaxHp)) : 0;

    this.bossBarGraphic.clear();
    this.bossBarGraphic.fillStyle(0x160a12, 0.92);
    this.bossBarGraphic.fillRoundedRect(-width / 2, -height / 2, width, height, 4);

    if (ratio > 0) {
      this.bossBarGraphic.fillStyle(0xe85d04, 0.95);
      this.bossBarGraphic.fillRoundedRect(
        -width / 2,
        -height / 2,
        Math.max(4, width * ratio),
        height,
        4
      );
    }

    this.bossBarGraphic.lineStyle(1.5, 0xffba08, 0.95);
    this.bossBarGraphic.strokeRoundedRect(-width / 2, -height / 2, width, height, 4);
  }

  private drawBannerBox(): void {
    const isMobile = this.viewport.mode === 'mobile_portrait';
    const width = isMobile ? this.viewport.width - 24 : 490;
    const height = isMobile ? 38 : 32;

    this.bannerBg.clear();
    this.bannerBg.fillStyle(0x0b0f19, 0.84);
    this.bannerBg.fillRoundedRect(-width / 2, -height / 2, width, height, 5);
    this.bannerBg.lineStyle(1, 0x48cae4, 0.65);
    this.bannerBg.strokeRoundedRect(-width / 2, -height / 2, width, height, 5);
  }

  private drawSkillButtonState(
    btn: SkillButtonView,
    cdRemainingMs: number,
    totalCooldownMs: number,
    isOutOfCharges: boolean
  ): void {
    const palette = this.getForceColors(btn.skill.force, btn.skill.slot);
    const isReady = cdRemainingMs <= 0 && !isOutOfCharges;

    btn.bg.clear();
    btn.bg.fillStyle(palette.fill, isReady ? 0.88 : 0.38);
    btn.bg.fillCircle(0, 0, btn.radius);
    btn.bg.lineStyle(2, palette.stroke, isReady ? 1 : 0.45);
    btn.bg.strokeCircle(0, 0, btn.radius);

    btn.cdOverlay.clear();
    if (cdRemainingMs > 0 && totalCooldownMs > 0) {
      const ratio = Math.min(1, cdRemainingMs / totalCooldownMs);
      btn.cdOverlay.fillStyle(0x05070c, 0.72);
      btn.cdOverlay.slice(
        0,
        0,
        btn.radius - 2,
        Phaser.Math.DegToRad(-90),
        Phaser.Math.DegToRad(-90 + 360 * ratio),
        false
      );
      btn.cdOverlay.fillPath();
    }
  }

  private getForceColors(
    force: ForceType,
    slot: SkillSlot
  ): { fill: number; stroke: number } {
    if (slot === 'potion') {
      return { fill: 0x1b4332, stroke: 0x52b788 };
    }
    switch (force) {
      case 'inferno':
        return { fill: 0x6a1b09, stroke: 0xf48c06 };
      case 'submundo':
        return { fill: 0x590d22, stroke: 0xff4d6d };
      case 'empireo':
        return { fill: 0x1d3557, stroke: 0xffd166 };
      default:
        return { fill: 0x1a2a3a, stroke: 0x48cae4 };
    }
  }

  private drawModalBackground(isVictory: boolean, hasLootSummary = false): void {
    const w = this.viewport.width;
    const h = this.viewport.height;
    const isMobile = this.viewport.mode === 'mobile_portrait';
    const boxW = isMobile ? w - 32 : 440;
    const boxH = hasLootSummary ? (isMobile ? 284 : 264) : isMobile ? 250 : 230;

    this.modalBackdrop.clear();
    this.modalBackdrop.fillStyle(0x04060a, 0.78);
    this.modalBackdrop.fillRect(-w / 2, -h / 2, w, h);

    this.modalBox.clear();
    this.modalBox.fillStyle(0x101420, 0.96);
    this.modalBox.fillRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, 8);
    this.modalBox.lineStyle(2, isVictory ? 0xffd166 : 0xd90429, 1);
    this.modalBox.strokeRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, 8);
  }
}
