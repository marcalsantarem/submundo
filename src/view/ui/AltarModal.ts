import Phaser from 'phaser';
import {
  AltarUpgradeDef,
  AltarUpgradeId,
  StatBonus,
  ViewportConfig,
  resolveViewportConfig,
} from '../../core/index';
import dialoguesData from '../../data/dialogues.json';

export interface AltarModalSnapshot {
  souls: number;
  altarLevels: Record<AltarUpgradeId, number>;
  upgrades: AltarUpgradeDef[];
  getCost: (def: AltarUpgradeDef, level: number) => number;
}

interface AltarRowView {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  nameText: Phaser.GameObjects.Text;
  levelText: Phaser.GameObjects.Text;
  bonusText: Phaser.GameObjects.Text;
  descText: Phaser.GameObjects.Text;
  costText: Phaser.GameObjects.Text;
  btnContainer: Phaser.GameObjects.Container;
  btnBg: Phaser.GameObjects.Graphics;
  btnText: Phaser.GameObjects.Text;
  btnZone: Phaser.GameObjects.Zone;
  boundUpgradeId: AltarUpgradeId | null;
  canPurchase: boolean;
}

const FONT_TITLE =
  "'Cinzel', 'Palatino Linotype', 'Book Antiqua', Georgia, serif";
const FONT_BODY =
  "'Segoe UI', 'Inter', system-ui, -apple-system, sans-serif";

const MAX_ROWS_PER_PAGE = 5;
const UI_ICONS_KEY = 'ui_icons';
const ICON_SOULS_FRAME = 10;

const PALETTE = {
  BG_DEEP: 0x0d0f16,
  BG_SURFACE: 0x161924,
  BORDER_BRONZE: 0x8a7048,
  BORDER_STEEL: 0x525a6e,
  CLOSE_FILL: 0x2b1215,
  BUY_FILL: 0x172b3a,
  BUY_STROKE: 0x48cae4,
} as const;

export class AltarModal {
  private readonly scene: Phaser.Scene;
  private readonly callbacks: {
    onPurchaseUpgrade: (id: AltarUpgradeId) => void;
    onClose: () => void;
  };

  private viewport: ViewportConfig;
  private opened = false;
  private page = 0;
  private lastSnapshot: AltarModalSnapshot = {
    souls: 0,
    altarLevels: {
      vitality: 0,
      might: 0,
      bastion: 0,
      swiftness: 0,
      fortune: 0,
    },
    upgrades: [],
    getCost: () => 0,
  };

  private readonly rootContainer: Phaser.GameObjects.Container;
  private readonly backdropGraphic: Phaser.GameObjects.Graphics;
  private readonly backdropZone: Phaser.GameObjects.Zone;
  private readonly panelGraphic: Phaser.GameObjects.Graphics;
  private readonly soulsBgGraphic: Phaser.GameObjects.Graphics;
  private readonly soulsIcon: Phaser.GameObjects.Image | null;
  private readonly soulsFallbackGraphic: Phaser.GameObjects.Graphics;

  private readonly titleText: Phaser.GameObjects.Text;
  private readonly soulsText: Phaser.GameObjects.Text;
  private readonly introText: Phaser.GameObjects.Text;
  private readonly emptyText: Phaser.GameObjects.Text;

  private readonly closeBtnContainer: Phaser.GameObjects.Container;
  private readonly closeBtnBg: Phaser.GameObjects.Graphics;
  private readonly closeBtnText: Phaser.GameObjects.Text;
  private readonly closeBtnZone: Phaser.GameObjects.Zone;

  private readonly prevPageContainer: Phaser.GameObjects.Container;
  private readonly prevPageBg: Phaser.GameObjects.Graphics;
  private readonly prevPageText: Phaser.GameObjects.Text;
  private readonly prevPageZone: Phaser.GameObjects.Zone;

  private readonly nextPageContainer: Phaser.GameObjects.Container;
  private readonly nextPageBg: Phaser.GameObjects.Graphics;
  private readonly nextPageText: Phaser.GameObjects.Text;
  private readonly nextPageZone: Phaser.GameObjects.Zone;

  private readonly pageInfoText: Phaser.GameObjects.Text;

  private readonly rows: AltarRowView[] = [];
  private readonly keydownHandler: (event: KeyboardEvent) => void;

  constructor(
    scene: Phaser.Scene,
    callbacks: {
      onPurchaseUpgrade: (id: AltarUpgradeId) => void;
      onClose: () => void;
    }
  ) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.viewport = resolveViewportConfig(
      scene.scale.width || 800,
      scene.scale.height || 600
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
    this.soulsBgGraphic = scene.add.graphics();

    this.soulsIcon = this.hasTextureFrame(UI_ICONS_KEY, ICON_SOULS_FRAME)
      ? scene.add.image(0, 0, UI_ICONS_KEY, ICON_SOULS_FRAME).setOrigin(0.5)
      : null;

    this.soulsFallbackGraphic = scene.add.graphics();
    this.drawSoulsFallbackDiamond();

    this.titleText = scene.add.text(0, 0, 'ALTAR DE ALMAS', {
      fontFamily: FONT_TITLE,
      fontSize: '15px',
      color: '#f0c46c',
      fontStyle: 'bold',
      resolution: 2,
    });

    this.soulsText = scene.add.text(0, 0, 'Almas disponíveis: 0', {
      fontFamily: FONT_BODY,
      fontSize: '12px',
      color: '#90e0ef',
      fontStyle: 'bold',
      resolution: 2,
    });

    this.introText = scene.add.text(0, 0, dialoguesData.entries.altar_intro.shortText, {
      fontFamily: FONT_BODY,
      fontSize: '10px',
      color: '#cbd5e1',
      resolution: 2,
    });

    this.emptyText = scene.add
      .text(0, 0, 'Nenhuma bênção disponível no Altar.', {
        fontFamily: FONT_BODY,
        fontSize: '11px',
        color: '#64748b',
        align: 'center',
        resolution: 2,
      })
      .setOrigin(0.5, 0.5);

    // Close Button
    this.closeBtnBg = scene.add.graphics();
    this.closeBtnText = scene.add
      .text(0, 0, 'Fechar', {
        fontFamily: FONT_BODY,
        fontSize: '12px',
        color: '#f8e7c2',
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0.5, 0.5);
    this.closeBtnZone = scene.add
      .zone(0, 0, 84, 28)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });

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

    // Pagination Controls (used only if > 5 upgrades exist)
    this.prevPageBg = scene.add.graphics();
    this.prevPageText = scene.add
      .text(0, 0, '< Ant', {
        fontFamily: FONT_BODY,
        fontSize: '11px',
        color: '#f8fafc',
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0.5, 0.5);
    this.prevPageZone = scene.add
      .zone(0, 0, 68, 24)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });
    this.prevPageZone.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event?: Phaser.Types.Input.EventData
      ) => {
        event?.stopPropagation?.();
        if (!this.opened || this.page <= 0) {
          return;
        }
        this.page -= 1;
        this.renderSnapshot();
      }
    );
    this.prevPageContainer = scene.add.container(0, 0, [
      this.prevPageBg,
      this.prevPageText,
      this.prevPageZone,
    ]);

    this.nextPageBg = scene.add.graphics();
    this.nextPageText = scene.add
      .text(0, 0, 'Próx >', {
        fontFamily: FONT_BODY,
        fontSize: '11px',
        color: '#f8fafc',
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0.5, 0.5);
    this.nextPageZone = scene.add
      .zone(0, 0, 68, 24)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });
    this.nextPageZone.on(
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
        const totalPages = this.getTotalPages();
        if (this.page < totalPages - 1) {
          this.page += 1;
          this.renderSnapshot();
        }
      }
    );
    this.nextPageContainer = scene.add.container(0, 0, [
      this.nextPageBg,
      this.nextPageText,
      this.nextPageZone,
    ]);

    this.pageInfoText = scene.add
      .text(0, 0, '1/1', {
        fontFamily: FONT_BODY,
        fontSize: '11px',
        color: '#cbd5e1',
        resolution: 2,
      })
      .setOrigin(0.5, 0.5);

    const rootChildren: Phaser.GameObjects.GameObject[] = [
      this.backdropGraphic,
      this.backdropZone,
      this.panelGraphic,
      this.soulsBgGraphic,
      this.soulsFallbackGraphic,
      this.titleText,
      this.soulsText,
      this.introText,
      this.emptyText,
      this.closeBtnContainer,
      this.prevPageContainer,
      this.nextPageContainer,
      this.pageInfoText,
    ];
    if (this.soulsIcon) {
      rootChildren.splice(5, 0, this.soulsIcon);
    }

    for (let i = 0; i < MAX_ROWS_PER_PAGE; i++) {
      const bg = scene.add.graphics();
      const nameText = scene.add.text(0, 0, '', {
        fontFamily: FONT_TITLE,
        fontSize: '12px',
        color: '#f8fafc',
        fontStyle: 'bold',
        resolution: 2,
      });
      const levelText = scene.add
        .text(0, 0, '', {
          fontFamily: FONT_BODY,
          fontSize: '11px',
          color: '#f0c46c',
          fontStyle: 'bold',
          resolution: 2,
        })
        .setOrigin(1, 0);
      const bonusText = scene.add.text(0, 0, '', {
        fontFamily: FONT_BODY,
        fontSize: '10px',
        color: '#80ed99',
        fontStyle: 'bold',
        resolution: 2,
      });
      const descText = scene.add.text(0, 0, '', {
        fontFamily: FONT_BODY,
        fontSize: '10px',
        color: '#94a3b8',
        resolution: 2,
      });
      const costText = scene.add
        .text(0, 0, '', {
          fontFamily: FONT_BODY,
          fontSize: '10px',
          color: '#90e0ef',
          fontStyle: 'bold',
          resolution: 2,
        })
        .setOrigin(1, 0);

      const btnBg = scene.add.graphics();
      const btnText = scene.add
        .text(0, 0, 'Aprimorar', {
          fontFamily: FONT_BODY,
          fontSize: '11px',
          color: '#ffffff',
          fontStyle: 'bold',
          resolution: 2,
        })
        .setOrigin(0.5, 0.5);
      const btnZone = scene.add
        .zone(0, 0, 100, 28)
        .setOrigin(0.5, 0.5)
        .setInteractive({ useHandCursor: true });

      const btnContainer = scene.add.container(0, 0, [btnBg, btnText, btnZone]);

      const rowView: AltarRowView = {
        container: scene.add.container(0, 0, [
          bg,
          nameText,
          levelText,
          bonusText,
          descText,
          costText,
          btnContainer,
        ]),
        bg,
        nameText,
        levelText,
        bonusText,
        descText,
        costText,
        btnContainer,
        btnBg,
        btnText,
        btnZone,
        boundUpgradeId: null,
        canPurchase: false,
      };

      btnZone.on(
        'pointerdown',
        (
          _pointer: Phaser.Input.Pointer,
          _lx: number,
          _ly: number,
          event?: Phaser.Types.Input.EventData
        ) => {
          event?.stopPropagation?.();
          if (!this.opened || !rowView.boundUpgradeId || !rowView.canPurchase) {
            return;
          }
          this.callbacks.onPurchaseUpgrade(rowView.boundUpgradeId);
        }
      );

      this.rows.push(rowView);
      rootChildren.push(rowView.container);
    }

    this.rootContainer = scene.add
      .container(this.viewport.width / 2, this.viewport.height / 2, rootChildren)
      .setScrollFactor(0)
      .setDepth(1080)
      .setVisible(false);

    this.keydownHandler = (event: KeyboardEvent) => {
      if (!this.opened) {
        return;
      }
      if (event.code === 'Escape') {
        this.close();
        this.callbacks.onClose();
      }
    };
    scene.input.keyboard?.on('keydown', this.keydownHandler);

    this.resize(this.viewport);
  }

  public open(snap: AltarModalSnapshot): void {
    this.opened = true;
    this.page = 0;
    this.rootContainer.setVisible(true);
    this.update(snap);
  }

  public update(snap: AltarModalSnapshot): void {
    this.lastSnapshot = snap;
    const totalPages = this.getTotalPages();
    if (this.page >= totalPages) {
      this.page = Math.max(0, totalPages - 1);
    }
    this.renderSnapshot();
  }

  public close(): void {
    this.opened = false;
    this.rootContainer.setVisible(false);
  }

  public isOpen(): boolean {
    return this.opened;
  }

  public resize(viewport: ViewportConfig): void {
    this.viewport = viewport;
    const w = viewport.width;
    const h = viewport.height;
    const isMobile = viewport.mode === 'mobile_portrait';

    this.rootContainer.setPosition(w / 2, h / 2);

    this.backdropGraphic.clear();
    this.backdropGraphic.fillStyle(0x04060a, 0.84);
    this.backdropGraphic.fillRect(-w / 2, -h / 2, w, h);
    this.backdropZone.setSize(w, h);

    const boxW = isMobile ? w - 20 : 680;
    const boxH = isMobile ? h - 44 : 520;

    this.panelGraphic.clear();
    this.drawChamferedPanel(
      this.panelGraphic,
      -boxW / 2,
      -boxH / 2,
      boxW,
      boxH,
      12,
      PALETTE.BG_DEEP,
      0.97,
      PALETTE.BORDER_BRONZE,
      PALETTE.BORDER_STEEL
    );

    const leftEdge = -boxW / 2 + 16;
    const rightEdge = boxW / 2 - 16;
    const topEdge = -boxH / 2 + 14;
    const innerW = boxW - 32;

    this.titleText.setFontSize(isMobile ? 14 : 16);
    this.titleText.setPosition(leftEdge, topEdge + 2);

    const closeW = isMobile ? 72 : 84;
    const closeH = isMobile ? 26 : 28;
    this.closeBtnContainer.setPosition(rightEdge - closeW / 2, topEdge + 12);
    this.closeBtnZone.setSize(closeW, closeH);
    this.drawChamferedButton(
      this.closeBtnBg,
      closeW,
      closeH,
      5,
      PALETTE.CLOSE_FILL,
      PALETTE.BORDER_BRONZE
    );

    const soulsBarY = topEdge + (isMobile ? 32 : 34);
    const soulsBarH = isMobile ? 24 : 26;
    this.drawChamferedBox(
      this.soulsBgGraphic,
      leftEdge,
      soulsBarY,
      innerW,
      soulsBarH,
      5,
      PALETTE.BG_SURFACE,
      0.95,
      PALETTE.BORDER_STEEL,
      1.2
    );

    const iconSize = isMobile ? 14 : 16;
    const iconCenterX = leftEdge + 14;
    const iconCenterY = soulsBarY + soulsBarH / 2;
    this.soulsIcon?.setPosition(iconCenterX, iconCenterY).setDisplaySize(iconSize, iconSize);
    this.soulsFallbackGraphic.setPosition(iconCenterX, iconCenterY);

    this.soulsText.setFontSize(isMobile ? 11 : 12);
    this.soulsText.setPosition(leftEdge + 26, soulsBarY + (isMobile ? 5 : 6));

    const introY = soulsBarY + soulsBarH + 7;
    this.introText.setFontSize(isMobile ? 9 : 10);
    this.introText.setWordWrapWidth(innerW);
    this.introText.setPosition(leftEdge, introY);

    const listTop = introY + (isMobile ? 28 : 22);
    const rowH = isMobile ? 86 : 74;
    const gap = isMobile ? 6 : 8;

    this.rows.forEach((row, idx) => {
      const cy = listTop + idx * (rowH + gap) + rowH / 2;
      this.layoutRow(row, 0, cy, innerW, rowH, isMobile);
    });

    this.emptyText.setPosition(0, listTop + 140);

    const pageY = boxH / 2 - 18;
    this.prevPageContainer.setPosition(-76, pageY);
    this.pageInfoText.setPosition(0, pageY);
    this.nextPageContainer.setPosition(76, pageY);

    this.renderSnapshot();
  }

  public destroy(): void {
    this.scene.input.keyboard?.off('keydown', this.keydownHandler);
    this.rootContainer.destroy();
  }

  private getTotalPages(): number {
    return Math.max(1, Math.ceil(this.lastSnapshot.upgrades.length / MAX_ROWS_PER_PAGE));
  }

  private layoutRow(
    row: AltarRowView,
    cx: number,
    cy: number,
    w: number,
    h: number,
    isMobile: boolean
  ): void {
    row.container.setPosition(cx, cy);
    row.container.setData('rowW', w);
    row.container.setData('rowH', h);

    const left = -w / 2 + 10;
    const right = w / 2 - 10;
    const top = -h / 2 + 8;

    const btnW = isMobile ? 92 : 112;
    const btnH = isMobile ? 28 : 30;
    row.container.setData('btnW', btnW);
    row.container.setData('btnH', btnH);

    row.nameText.setFontSize(isMobile ? 11 : 12);
    row.nameText.setWordWrapWidth(w - (isMobile ? 96 : 160));
    row.nameText.setPosition(left, top);

    row.levelText.setFontSize(isMobile ? 10 : 11);
    row.levelText.setPosition(right, top);

    row.bonusText.setFontSize(isMobile ? 10 : 11);
    row.bonusText.setWordWrapWidth(w - btnW - 28);
    row.bonusText.setPosition(left, top + (isMobile ? 18 : 20));

    row.descText.setFontSize(isMobile ? 9 : 10);
    row.descText.setWordWrapWidth(w - btnW - 28);
    row.descText.setPosition(left, top + (isMobile ? 36 : 39));

    row.costText.setFontSize(isMobile ? 9 : 10);
    row.costText.setPosition(right, top + (isMobile ? 20 : 19));

    row.btnContainer.setPosition(right - btnW / 2, h / 2 - btnH / 2 - 8);
    row.btnZone.setSize(btnW, btnH);
  }

  private renderSnapshot(): void {
    const snap = this.lastSnapshot;
    const isMobile = this.viewport.mode === 'mobile_portrait';

    const hasSoulsIcon =
      this.soulsIcon !== null &&
      this.hasTextureFrame(UI_ICONS_KEY, ICON_SOULS_FRAME);
    this.soulsIcon?.setVisible(hasSoulsIcon);
    if (hasSoulsIcon && this.soulsIcon) {
      this.soulsIcon.setFrame(ICON_SOULS_FRAME);
    }
    this.soulsFallbackGraphic.setVisible(!hasSoulsIcon);

    this.soulsText.setText(`Almas disponíveis: ${snap.souls}`);
    this.setTextClamped(
      this.introText,
      dialoguesData.entries.altar_intro.shortText,
      isMobile ? 2 : 1
    );

    const upgrades = snap.upgrades;
    this.emptyText.setVisible(upgrades.length === 0);

    const totalPages = this.getTotalPages();
    const startIdx = this.page * MAX_ROWS_PER_PAGE;
    const pageUpgrades = upgrades.slice(startIdx, startIdx + MAX_ROWS_PER_PAGE);

    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i];
      const def = pageUpgrades[i];
      if (!def) {
        row.boundUpgradeId = null;
        row.canPurchase = false;
        row.container.setVisible(false);
        continue;
      }

      row.boundUpgradeId = def.id;
      row.container.setVisible(true);

      const level = snap.altarLevels[def.id] ?? 0;
      const isMax = level >= def.maxLevel;
      const cost = isMax ? 0 : snap.getCost(def, level);
      const canAfford = !isMax && snap.souls >= cost;
      row.canPurchase = canAfford;

      const rowW = (row.container.getData('rowW') as number) || 308;
      const rowH = (row.container.getData('rowH') as number) || 86;
      const btnW = (row.container.getData('btnW') as number) || 92;
      const btnH = (row.container.getData('btnH') as number) || 28;

      const rowBorder = isMax
        ? PALETTE.BORDER_BRONZE
        : canAfford
          ? PALETTE.BUY_STROKE
          : PALETTE.BORDER_STEEL;

      this.drawChamferedBox(
        row.bg,
        -rowW / 2,
        -rowH / 2,
        rowW,
        rowH,
        6,
        PALETTE.BG_SURFACE,
        0.95,
        rowBorder,
        1.5
      );

      this.setTextClamped(row.nameText, def.name, 1);
      row.levelText.setText(`Nv. ${level}/${def.maxLevel}`);
      row.levelText.setColor(isMax ? '#f0c46c' : '#cbd5e1');

      const bonusStr = this.formatBonusSummary(def.bonusPerLevel, level);
      this.setTextClamped(row.bonusText, bonusStr, 1);
      this.setTextClamped(row.descText, def.description, isMobile ? 2 : 1);

      if (isMax) {
        row.costText.setText('Nível Máximo');
        row.costText.setColor('#f0c46c');
      } else {
        row.costText.setText(`Custo: ${cost} Almas`);
        row.costText.setColor(canAfford ? '#90e0ef' : '#f87171');
      }

      if (isMax) {
        this.drawChamferedButton(
          row.btnBg,
          btnW,
          btnH,
          5,
          PALETTE.BG_DEEP,
          PALETTE.BORDER_BRONZE
        );
        row.btnText.setText('Máximo').setColor('#f0c46c');
      } else if (canAfford) {
        this.drawChamferedButton(
          row.btnBg,
          btnW,
          btnH,
          5,
          PALETTE.BUY_FILL,
          PALETTE.BUY_STROKE
        );
        row.btnText.setText('Aprimorar').setColor('#ffffff');
      } else {
        this.drawChamferedButton(
          row.btnBg,
          btnW,
          btnH,
          5,
          PALETTE.BG_DEEP,
          PALETTE.BORDER_STEEL
        );
        row.btnText.setText('Aprimorar').setColor('#64748b');
      }
    }

    const showPagination = upgrades.length > MAX_ROWS_PER_PAGE;
    this.prevPageContainer.setVisible(showPagination);
    this.nextPageContainer.setVisible(showPagination);
    this.pageInfoText.setVisible(showPagination);

    if (showPagination) {
      this.pageInfoText.setText(`${this.page + 1}/${totalPages}`);
      this.drawPageButton(this.prevPageBg, this.prevPageText, this.page > 0);
      this.drawPageButton(
        this.nextPageBg,
        this.nextPageText,
        this.page < totalPages - 1
      );
    }
  }

  private drawPageButton(
    bg: Phaser.GameObjects.Graphics,
    label: Phaser.GameObjects.Text,
    enabled: boolean
  ): void {
    this.drawChamferedButton(
      bg,
      68,
      24,
      4,
      enabled ? PALETTE.BG_SURFACE : PALETTE.BG_DEEP,
      enabled ? PALETTE.BORDER_BRONZE : PALETTE.BORDER_STEEL
    );
    label.setColor(enabled ? '#f8fafc' : '#475569');
  }

  private drawChamferedPanel(
    gfx: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    bevel: number,
    fillColor: number,
    fillAlpha: number,
    outerStroke: number,
    innerStroke: number
  ): void {
    const outerPts = this.getChamferPoints(x, y, w, h, bevel);
    const innerPts = this.getChamferPoints(x + 4, y + 4, w - 8, h - 8, Math.max(4, bevel - 3));

    gfx.fillStyle(fillColor, fillAlpha);
    gfx.fillPoints(outerPts, true);
    gfx.lineStyle(1, innerStroke, 0.7);
    gfx.strokePoints(innerPts, true, true);
    gfx.lineStyle(2, outerStroke, 0.96);
    gfx.strokePoints(outerPts, true, true);
  }

  private drawChamferedBox(
    gfx: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    bevel: number,
    fillColor: number,
    fillAlpha: number,
    strokeColor: number,
    lineWidth: number
  ): void {
    gfx.clear();
    const pts = this.getChamferPoints(x, y, w, h, bevel);
    gfx.fillStyle(fillColor, fillAlpha);
    gfx.fillPoints(pts, true);
    gfx.lineStyle(lineWidth, strokeColor, 0.92);
    gfx.strokePoints(pts, true, true);
  }

  private drawChamferedButton(
    gfx: Phaser.GameObjects.Graphics,
    w: number,
    h: number,
    bevel: number,
    fillColor: number,
    strokeColor: number
  ): void {
    gfx.clear();
    const outerPts = this.getChamferPoints(-w / 2, -h / 2, w, h, bevel);
    const innerPts = this.getChamferPoints(
      -w / 2 + 2,
      -h / 2 + 2,
      Math.max(4, w - 4),
      Math.max(4, h - 4),
      Math.max(2, bevel - 1)
    );
    gfx.fillStyle(fillColor, 0.95);
    gfx.fillPoints(outerPts, true);
    gfx.lineStyle(1, PALETTE.BG_DEEP, 0.85);
    gfx.strokePoints(innerPts, true, true);
    gfx.lineStyle(1.5, strokeColor, 0.95);
    gfx.strokePoints(outerPts, true, true);
  }

  private drawSoulsFallbackDiamond(): void {
    this.soulsFallbackGraphic.clear();
    this.soulsFallbackGraphic.fillStyle(0x90e0ef, 0.95);
    this.soulsFallbackGraphic.fillPoints(
      [
        { x: 0, y: -5 },
        { x: 5, y: 0 },
        { x: 0, y: 5 },
        { x: -5, y: 0 },
      ],
      true
    );
  }

  private hasTextureFrame(key: string, frame: number): boolean {
    if (!this.scene.textures?.exists(key)) {
      return false;
    }
    return this.scene.textures.get(key).has(String(frame));
  }

  private getChamferPoints(
    x: number,
    y: number,
    w: number,
    h: number,
    bevel: number
  ): Array<{ x: number; y: number }> {
    const b = Math.min(bevel, w * 0.35, h * 0.35);
    return [
      { x: x + b, y },
      { x: x + w - b, y },
      { x: x + w, y: y + b },
      { x: x + w, y: y + h - b },
      { x: x + w - b, y: y + h },
      { x: x + b, y: y + h },
      { x, y: y + h - b },
      { x, y: y + b },
    ];
  }

  private formatBonusSummary(bonusPerLevel: StatBonus, level: number): string {
    const parts: string[] = [];
    const entries = Object.entries(bonusPerLevel) as Array<
      [keyof StatBonus, number | undefined]
    >;

    for (const [key, val] of entries) {
      if (typeof val !== 'number' || val === 0) {
        continue;
      }
      const total = val * level;
      const isPercent =
        key === 'cooldownReduction' ||
        key === 'critChance' ||
        key === 'critMultiplier' ||
        key === 'lifeSteal' ||
        key === 'luck';

      const perText = isPercent
        ? `${Math.round(val * 100)}%`
        : `${Math.round(val)}`;
      const totalText = isPercent
        ? `${Math.round(total * 100)}%`
        : `${Math.round(total)}`;

      const label = this.getStatLabel(key);
      if (level > 0) {
        parts.push(`${label} +${perText}/nv (Atual: +${totalText})`);
      } else {
        parts.push(`${label} +${perText}/nv`);
      }
    }

    return parts.join(' | ') || 'Bônus permanente';
  }

  private getStatLabel(stat: keyof StatBonus): string {
    switch (stat) {
      case 'maxHp':
        return 'HP Máx';
      case 'attack':
        return 'ATQ';
      case 'defense':
        return 'DEF';
      case 'moveSpeed':
        return 'VEL';
      case 'cooldownReduction':
        return 'Recarga';
      case 'critChance':
        return 'CRIT';
      case 'critMultiplier':
        return 'Dano Crít.';
      case 'lifeSteal':
        return 'Roubo Vida';
      case 'luck':
        return 'Sorte';
      case 'attackRange':
        return 'Alcance';
      default:
        return String(stat);
    }
  }

  private setTextClamped(
    textObj: Phaser.GameObjects.Text,
    fullText: string,
    maxLines: number
  ): void {
    const cleanText = fullText.trim();
    if (!cleanText || maxLines <= 0) {
      textObj.setText('');
      return;
    }

    const wrapped = textObj.getWrappedText(cleanText);
    if (wrapped.length <= maxLines) {
      textObj.setText(cleanText);
      return;
    }

    let low = 1;
    let high = cleanText.length - 1;
    let best = '...';

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = `${cleanText.slice(0, mid).trimEnd()}...`;
      if (textObj.getWrappedText(candidate).length <= maxLines) {
        best = candidate;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    textObj.setText(best);
  }
}
