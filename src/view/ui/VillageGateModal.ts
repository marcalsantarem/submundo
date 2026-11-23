import Phaser from 'phaser';
import {
  type CampaignStageId,
  type ViewportConfig,
  resolveViewportConfig,
} from '../../core/index';
import type {
  VillageDungeonEntry,
  VillageDungeonStatus,
} from '../../core/progression/VillageHubManager';
import {
  DF_FONTS,
  DF_PALETTE,
  type OrnateButtonVariant,
  drawOrnamentalDivider,
  drawOrnateButton,
  drawOrnatePanel,
} from './DarkFantasyUiBuilder';

export interface VillageGateModalCallbacks {
  onSelectStage: (stageId: CampaignStageId) => void;
  onClose: () => void;
}

interface GateCardView {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  orderBadgeBg: Phaser.GameObjects.Graphics;
  orderBadgeText: Phaser.GameObjects.Text;
  nameText: Phaser.GameObjects.Text;
  subtitleText: Phaser.GameObjects.Text;
  descText: Phaser.GameObjects.Text;
  statusBadgeBg: Phaser.GameObjects.Graphics;
  statusBadgeText: Phaser.GameObjects.Text;
  btnContainer: Phaser.GameObjects.Container;
  btnBg: Phaser.GameObjects.Graphics;
  btnText: Phaser.GameObjects.Text;
  btnZone: Phaser.GameObjects.Zone;
  boundStageId: CampaignStageId | null;
  canEnter: boolean;
  status: VillageDungeonStatus;
  btnHovered: boolean;
  btnPressed: boolean;
}

const MAX_STAGE_CARDS = 3;

export class VillageGateModal {
  private readonly scene: Phaser.Scene;
  private readonly callbacks: VillageGateModalCallbacks;

  private viewport: ViewportConfig;
  private opened = false;
  private entries: VillageDungeonEntry[] = [];

  private readonly rootContainer: Phaser.GameObjects.Container;
  private readonly backdropGraphic: Phaser.GameObjects.Graphics;
  private readonly backdropZone: Phaser.GameObjects.Zone;
  private readonly panelGraphic: Phaser.GameObjects.Graphics;

  private readonly titleText: Phaser.GameObjects.Text;
  private readonly subtitleText: Phaser.GameObjects.Text;

  private readonly closeBtnContainer: Phaser.GameObjects.Container;
  private readonly closeBtnBg: Phaser.GameObjects.Graphics;
  private readonly closeBtnText: Phaser.GameObjects.Text;
  private readonly closeBtnZone: Phaser.GameObjects.Zone;

  private readonly cards: GateCardView[] = [];
  private readonly keydownHandler: (event: KeyboardEvent) => void;

  constructor(scene: Phaser.Scene, callbacks: VillageGateModalCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.viewport = resolveViewportConfig(
      scene.scale.width || 960,
      scene.scale.height || 540
    );

    this.backdropGraphic = scene.add.graphics();
    this.backdropZone = scene.add
      .zone(0, 0, this.viewport.width, this.viewport.height)
      .setOrigin(0.5, 0.5)
      .setInteractive();

    this.backdropZone.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event?: Phaser.Types.Input.EventData
      ) => {
        event?.stopPropagation?.();
      }
    );

    this.panelGraphic = scene.add.graphics();

    this.titleText = scene.add
      .text(0, 0, 'PORTÃO DE SAÍDA', {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '18px',
        color: DF_PALETTE.textGold,
        fontStyle: 'bold',
        stroke: '#05070c',
        strokeThickness: 3,
        resolution: 2,
      })
      .setOrigin(0, 0.5);

    this.subtitleText = scene.add
      .text(0, 0, 'Escolha a missão nos arredores da Vila Natal', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '12px',
        color: DF_PALETTE.textParchment,
        resolution: 2,
      })
      .setOrigin(0, 0.5);

    this.closeBtnBg = scene.add.graphics();
    this.closeBtnText = scene.add
      .text(0, 0, 'X', {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '13px',
        color: DF_PALETTE.textParchment,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0.5, 0.5);
    this.closeBtnZone = scene.add
      .zone(0, 0, 36, 28)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });

    this.closeBtnZone.on('pointerover', () => this.drawCloseButton(true));
    this.closeBtnZone.on('pointerout', () => this.drawCloseButton(false));
    this.closeBtnZone.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event?: Phaser.Types.Input.EventData
      ) => {
        event?.stopPropagation?.();
        if (!this.opened) {
          return;
        }
        this.close();
        this.callbacks.onClose();
      }
    );

    this.closeBtnContainer = scene.add.container(0, 0, [
      this.closeBtnBg,
      this.closeBtnText,
      this.closeBtnZone,
    ]);

    const rootChildren: Phaser.GameObjects.GameObject[] = [
      this.backdropGraphic,
      this.backdropZone,
      this.panelGraphic,
      this.titleText,
      this.subtitleText,
      this.closeBtnContainer,
    ];

    for (let i = 0; i < MAX_STAGE_CARDS; i += 1) {
      const card = this.createCardView(i);
      this.cards.push(card);
      rootChildren.push(card.container);
    }

    this.rootContainer = scene.add
      .container(this.viewport.width / 2, this.viewport.height / 2, rootChildren)
      .setScrollFactor(0)
      .setDepth(2300)
      .setVisible(false);

    this.keydownHandler = (event: KeyboardEvent) => {
      if (!this.opened) {
        return;
      }
      if (event.code === 'Escape') {
        event.preventDefault();
        this.close();
        this.callbacks.onClose();
      }
    };
    scene.input.keyboard?.on('keydown', this.keydownHandler);

    this.resize(this.viewport);
  }

  public open(entries: VillageDungeonEntry[]): void {
    this.entries = [...entries];
    this.opened = true;
    this.rootContainer.setVisible(true);
    this.renderCards();
  }

  public close(): void {
    this.opened = false;
    this.rootContainer.setVisible(false);
  }

  public isOpen(): boolean {
    return this.opened;
  }

  public getEntries(): VillageDungeonEntry[] {
    return [...this.entries];
  }

  public selectStage(stageId: CampaignStageId): boolean {
    const entry = this.entries.find((item) => item.stage.id === stageId);
    if (!entry || !entry.canEnter || entry.status === 'locked') {
      return false;
    }
    this.close();
    this.callbacks.onSelectStage(stageId);
    return true;
  }

  public resize(viewport: ViewportConfig): void {
    this.viewport = viewport;
    const w = viewport.width;
    const h = viewport.height;

    this.rootContainer.setPosition(w / 2, h / 2);

    this.backdropGraphic.clear();
    this.backdropGraphic.fillStyle(0x04060a, 0.84);
    this.backdropGraphic.fillRect(-w / 2, -h / 2, w, h);
    this.backdropZone.setSize(w, h);

    const boxW = Math.min(720, w - 32);
    const boxH = Math.min(436, h - 28);
    const headerH = 46;

    drawOrnatePanel(this.panelGraphic, {
      x: -boxW / 2,
      y: -boxH / 2,
      width: boxW,
      height: boxH,
      bevel: 12,
      fillColor: DF_PALETTE.obsidianBg,
      fillAlpha: 0.98,
      innerFillColor: DF_PALETTE.innerSurface,
      outerBorderColor: DF_PALETTE.bronzeBorder,
      innerBorderColor: DF_PALETTE.metalBorder,
      accentColor: DF_PALETTE.agedGold,
      headerHeight: headerH,
      headerColor: DF_PALETTE.headerBg,
      headerGlowColor: DF_PALETTE.agedGold,
      headerGlowAlpha: 0.16,
      shadow: true,
      cornerOrnaments: true,
      clear: true,
    });

    const leftEdge = -boxW / 2 + 22;
    const rightEdge = boxW / 2 - 22;
    const topEdge = -boxH / 2;
    const innerW = boxW - 44;

    this.titleText.setPosition(leftEdge, topEdge + headerH / 2 + 3);

    const closeW = 36;
    const closeH = 28;
    this.closeBtnContainer.setPosition(
      rightEdge - closeW / 2,
      topEdge + headerH / 2 + 3
    );
    this.closeBtnZone.setSize(closeW, closeH);
    this.drawCloseButton(false);

    const subtitleY = topEdge + headerH + 20;
    this.subtitleText.setPosition(leftEdge, subtitleY);

    const dividerY = subtitleY + 18;
    drawOrnamentalDivider(this.panelGraphic, leftEdge, dividerY, innerW);

    const listTop = dividerY + 14;
    const cardH = 98;
    const gap = 12;

    this.cards.forEach((card, index) => {
      const cy = listTop + index * (cardH + gap) + cardH / 2;
      this.layoutCard(card, 0, cy, innerW, cardH);
    });

    this.renderCards();
  }

  public destroy(): void {
    this.scene.input.keyboard?.off('keydown', this.keydownHandler);
    this.rootContainer.destroy(true);
  }

  private createCardView(index: number): GateCardView {
    const bg = this.scene.add.graphics();
    const orderBadgeBg = this.scene.add.graphics();
    const orderBadgeText = this.scene.add
      .text(0, 0, `${index + 1}`, {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '13px',
        color: DF_PALETTE.textGold,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0.5, 0.5);

    const nameText = this.scene.add.text(0, 0, '', {
      fontFamily: DF_FONTS.TITLE,
      fontSize: '15px',
      color: DF_PALETTE.textParchment,
      fontStyle: 'bold',
      resolution: 2,
    });

    const subtitleText = this.scene.add.text(0, 0, '', {
      fontFamily: DF_FONTS.BODY,
      fontSize: '11px',
      color: DF_PALETTE.textGold,
      fontStyle: 'bold',
      resolution: 2,
    });

    const descText = this.scene.add.text(0, 0, '', {
      fontFamily: DF_FONTS.BODY,
      fontSize: '11px',
      color: DF_PALETTE.textMuted,
      resolution: 2,
    });

    const statusBadgeBg = this.scene.add.graphics();
    const statusBadgeText = this.scene.add
      .text(0, 0, '', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '10px',
        color: DF_PALETTE.textGold,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0.5, 0.5);

    const btnBg = this.scene.add.graphics();
    const btnText = this.scene.add
      .text(0, 0, 'Entrar', {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '12px',
        color: DF_PALETTE.textParchment,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0.5, 0.5);
    const btnZone = this.scene.add
      .zone(0, 0, 124, 36)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });

    const btnContainer = this.scene.add.container(0, 0, [
      btnBg,
      btnText,
      btnZone,
    ]);

    const card: GateCardView = {
      container: this.scene.add.container(0, 0, [
        bg,
        orderBadgeBg,
        orderBadgeText,
        nameText,
        subtitleText,
        descText,
        statusBadgeBg,
        statusBadgeText,
        btnContainer,
      ]),
      bg,
      orderBadgeBg,
      orderBadgeText,
      nameText,
      subtitleText,
      descText,
      statusBadgeBg,
      statusBadgeText,
      btnContainer,
      btnBg,
      btnText,
      btnZone,
      boundStageId: null,
      canEnter: false,
      status: 'locked',
      btnHovered: false,
      btnPressed: false,
    };

    btnZone.on('pointerover', () => {
      card.btnHovered = true;
      this.redrawCardButton(card);
    });
    btnZone.on('pointerout', () => {
      card.btnHovered = false;
      card.btnPressed = false;
      this.redrawCardButton(card);
    });
    btnZone.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event?: Phaser.Types.Input.EventData
      ) => {
        event?.stopPropagation?.();
        if (!this.opened || !card.boundStageId || !card.canEnter) {
          return;
        }
        card.btnPressed = true;
        this.redrawCardButton(card);
        this.selectStage(card.boundStageId);
      }
    );
    btnZone.on('pointerup', () => {
      card.btnPressed = false;
      this.redrawCardButton(card);
    });

    return card;
  }

  private layoutCard(
    card: GateCardView,
    cx: number,
    cy: number,
    w: number,
    h: number
  ): void {
    card.container.setPosition(cx, cy);
    card.container.setData('cardW', w);
    card.container.setData('cardH', h);

    const btnW = 124;
    const btnH = 36;
    card.container.setData('btnW', btnW);
    card.container.setData('btnH', btnH);

    const left = -w / 2 + 54;
    const right = w / 2 - 18;
    const top = -h / 2 + 12;

    const badgeCx = -w / 2 + 28;
    const badgeCy = 0;
    card.orderBadgeText.setPosition(badgeCx, badgeCy);

    const infoRightX = right - btnW - 18;
    const textMaxW = Math.max(240, infoRightX - left - 8);

    card.nameText.setPosition(left, top);
    card.subtitleText.setPosition(left, top + 23);
    card.descText.setWordWrapWidth(textMaxW);
    card.descText.setPosition(left, top + 43);

    card.btnContainer.setPosition(right - btnW / 2, 12);
    card.btnZone.setSize(btnW, btnH);
  }

  private renderCards(): void {
    for (let i = 0; i < this.cards.length; i += 1) {
      const card = this.cards[i];
      const entry = this.entries[i];
      if (!entry) {
        card.boundStageId = null;
        card.canEnter = false;
        card.container.setVisible(false);
        continue;
      }

      card.container.setVisible(true);
      card.boundStageId = entry.stage.id;
      card.canEnter = entry.canEnter;
      card.status = entry.status;

      const cardW = (card.container.getData('cardW') as number) || 676;
      const cardH = (card.container.getData('cardH') as number) || 98;
      const isLocked = entry.status === 'locked';
      const isCompleted = entry.status === 'completed';

      const outerBorder = isLocked
        ? DF_PALETTE.metalDark
        : isCompleted
          ? DF_PALETTE.buttonEmeraldBorder
          : entry.isNextMission
            ? DF_PALETTE.agedGold
            : DF_PALETTE.bronzeBorder;

      const innerFill = isLocked ? 0x0b0e15 : DF_PALETTE.innerSurface;

      drawOrnatePanel(card.bg, {
        x: -cardW / 2,
        y: -cardH / 2,
        width: cardW,
        height: cardH,
        bevel: 8,
        fillColor: DF_PALETTE.deepRecess,
        fillAlpha: isLocked ? 0.88 : 0.96,
        innerFillColor: innerFill,
        outerBorderColor: outerBorder,
        innerBorderColor: isLocked
          ? DF_PALETTE.metalDark
          : DF_PALETTE.metalBorder,
        accentColor: outerBorder,
        shadow: false,
        cornerOrnaments: !isLocked,
        clear: true,
      });

      // Order medallion on the left
      const badgeCx = -cardW / 2 + 28;
      card.orderBadgeBg.clear();
      card.orderBadgeBg.fillStyle(
        isLocked ? 0x111520 : DF_PALETTE.obsidianBg,
        0.96
      );
      card.orderBadgeBg.fillCircle(badgeCx, 0, 15);
      card.orderBadgeBg.lineStyle(1.6, outerBorder, isLocked ? 0.6 : 0.95);
      card.orderBadgeBg.strokeCircle(badgeCx, 0, 15);
      card.orderBadgeText
        .setText(`${i + 1}`)
        .setColor(
          isLocked
            ? DF_PALETTE.textMuted
            : isCompleted
              ? DF_PALETTE.textSuccess
              : DF_PALETTE.textGold
        );

      card.nameText
        .setText(entry.stage.name)
        .setColor(isLocked ? DF_PALETTE.textMuted : DF_PALETTE.textParchment);

      card.subtitleText
        .setText(
          `${entry.stage.subtitle} · ${entry.stage.totalRooms} Câmaras`
        )
        .setColor(
          isLocked
            ? '#64748b'
            : isCompleted
              ? DF_PALETTE.textSuccess
              : DF_PALETTE.textGold
        );

      card.descText
        .setText(entry.stage.description)
        .setColor(isLocked ? '#64748b' : DF_PALETTE.textLight);

      // Status Badge (Top-Right of card, above Action Button)
      const rightEdge = cardW / 2 - 18;
      const btnW = (card.container.getData('btnW') as number) || 124;
      const badgeW = 124;
      const badgeH = 20;
      const statusCx = rightEdge - btnW / 2;
      const statusCy = -cardH / 2 + 21;

      let statusLabel: string;
      let statusTextColor: string;
      let statusFill: number;
      let statusBorder: number;

      if (isCompleted) {
        statusLabel = '✓ CONCLUÍDA';
        statusTextColor = DF_PALETTE.textSuccess;
        statusFill = 0x0f291e;
        statusBorder = DF_PALETTE.buttonEmeraldBorder;
      } else if (!isLocked) {
        statusLabel = entry.isNextMission ? 'MISSÃO ATUAL' : 'LIBERADA';
        statusTextColor = DF_PALETTE.textGold;
        statusFill = 0x2c2110;
        statusBorder = DF_PALETTE.agedGold;
      } else {
        statusLabel = '🔒 TRAVADA';
        statusTextColor = DF_PALETTE.textMuted;
        statusFill = 0x141822;
        statusBorder = DF_PALETTE.metalBorder;
      }

      card.statusBadgeBg.clear();
      card.statusBadgeBg.fillStyle(statusFill, 0.95);
      card.statusBadgeBg.fillRoundedRect(
        statusCx - badgeW / 2,
        statusCy - badgeH / 2,
        badgeW,
        badgeH,
        4
      );
      card.statusBadgeBg.lineStyle(1.2, statusBorder, 0.9);
      card.statusBadgeBg.strokeRoundedRect(
        statusCx - badgeW / 2,
        statusCy - badgeH / 2,
        badgeW,
        badgeH,
        4
      );
      card.statusBadgeText
        .setPosition(statusCx, statusCy)
        .setText(statusLabel)
        .setColor(statusTextColor);

      this.redrawCardButton(card);
    }
  }

  private redrawCardButton(card: GateCardView): void {
    const btnW = (card.container.getData('btnW') as number) || 124;
    const btnH = (card.container.getData('btnH') as number) || 36;

    let variant: OrnateButtonVariant = 'iron';
    let label = 'Travada';
    let textColor: string = DF_PALETTE.textMuted;
    const disabled = !card.canEnter || card.status === 'locked';

    if (card.status === 'available') {
      variant = 'gold';
      label = 'Entrar';
      textColor = disabled ? DF_PALETTE.textMuted : DF_PALETTE.textParchment;
    } else if (card.status === 'completed') {
      variant = 'emerald';
      label = 'Explorar';
      textColor = disabled ? DF_PALETTE.textMuted : '#ecfdf5';
    }

    drawOrnateButton(card.btnBg, -btnW / 2, -btnH / 2, btnW, btnH, {
      variant,
      bevel: 6,
      hovered: card.btnHovered,
      pressed: card.btnPressed,
      disabled,
      clear: true,
    });

    card.btnText.setText(label).setColor(textColor);
  }

  private drawCloseButton(hovered: boolean): void {
    drawOrnateButton(this.closeBtnBg, -18, -14, 36, 28, {
      variant: 'crimson',
      bevel: 5,
      hovered,
      clear: true,
    });
  }
}
