import Phaser from 'phaser';
import {
  AltarUpgradeDef,
  AltarUpgradeId,
  StatBonus,
  ViewportConfig,
  resolveViewportConfig,
} from '../../core/index';
import dialoguesData from '../../data/dialogues.json';
import {
  DF_FONTS,
  DF_PALETTE,
  DF_UI_ICONS_KEY,
  DF_UI_ICON_FRAMES,
  drawOrnamentalDivider,
  drawOrnateButton,
  drawOrnatePanel,
  drawSkullCrest,
  formatStatNumber,
  hasUiTextureFrame,
} from './DarkFantasyUiBuilder';

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

const MAX_ROWS_PER_PAGE = 5;

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
    this.soulsBgGraphic = scene.add.graphics();

    this.soulsIcon = hasUiTextureFrame(
      scene,
      DF_UI_ICONS_KEY,
      DF_UI_ICON_FRAMES.souls
    )
      ? scene.add
          .image(0, 0, DF_UI_ICONS_KEY, DF_UI_ICON_FRAMES.souls)
          .setOrigin(0.5)
      : null;

    this.soulsFallbackGraphic = scene.add.graphics();
    this.drawSoulsFallbackDiamond();

    this.titleText = scene.add
      .text(0, 0, 'ALTAR DE ALMAS', {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '17px',
        color: DF_PALETTE.textGold,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0, 0.5);

    this.soulsText = scene.add
      .text(0, 0, 'Almas disponíveis: 0', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '12px',
        color: DF_PALETTE.textBlue,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0, 0.5);

    this.introText = scene.add.text(
      0,
      0,
      dialoguesData.entries.altar_intro.shortText,
      {
        fontFamily: DF_FONTS.BODY,
        fontSize: '11px',
        color: DF_PALETTE.textLight,
        resolution: 2,
      }
    );

    this.emptyText = scene.add
      .text(0, 0, 'Nenhuma bênção disponível no Altar.', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '12px',
        color: DF_PALETTE.textMuted,
        align: 'center',
        resolution: 2,
      })
      .setOrigin(0.5, 0.5);

    // Botão Fechar
    this.closeBtnBg = scene.add.graphics();
    this.closeBtnText = scene.add
      .text(0, 0, 'Fechar', {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '12px',
        color: DF_PALETTE.textParchment,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0.5, 0.5);
    this.closeBtnZone = scene.add
      .zone(0, 0, 88, 28)
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

    // Paginação (exibida apenas se houver mais de 5 bênçãos)
    this.prevPageBg = scene.add.graphics();
    this.prevPageText = scene.add
      .text(0, 0, '◄ Ant', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '11px',
        color: DF_PALETTE.textParchment,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0.5, 0.5);
    this.prevPageZone = scene.add
      .zone(0, 0, 74, 24)
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
      .text(0, 0, 'Próx ►', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '11px',
        color: DF_PALETTE.textParchment,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0.5, 0.5);
    this.nextPageZone = scene.add
      .zone(0, 0, 74, 24)
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
        fontFamily: DF_FONTS.BODY,
        fontSize: '11px',
        color: DF_PALETTE.textMuted,
        fontStyle: 'bold',
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

    for (let i = 0; i < MAX_ROWS_PER_PAGE; i += 1) {
      const bg = scene.add.graphics();
      const nameText = scene.add.text(0, 0, '', {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '13px',
        color: DF_PALETTE.textParchment,
        fontStyle: 'bold',
        resolution: 2,
      });
      const levelText = scene.add
        .text(0, 0, '', {
          fontFamily: DF_FONTS.BODY,
          fontSize: '11px',
          color: DF_PALETTE.textGold,
          fontStyle: 'bold',
          resolution: 2,
        })
        .setOrigin(1, 0);
      const bonusText = scene.add.text(0, 0, '', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '11px',
        color: DF_PALETTE.textSuccess,
        fontStyle: 'bold',
        resolution: 2,
      });
      const descText = scene.add.text(0, 0, '', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '10px',
        color: DF_PALETTE.textMuted,
        resolution: 2,
      });
      const costText = scene.add
        .text(0, 0, '', {
          fontFamily: DF_FONTS.BODY,
          fontSize: '11px',
          color: DF_PALETTE.textBlue,
          fontStyle: 'bold',
          resolution: 2,
        })
        .setOrigin(1, 0);

      const btnBg = scene.add.graphics();
      const btnText = scene.add
        .text(0, 0, 'Aprimorar', {
          fontFamily: DF_FONTS.TITLE,
          fontSize: '11px',
          color: DF_PALETTE.textParchment,
          fontStyle: 'bold',
          resolution: 2,
        })
        .setOrigin(0.5, 0.5);
      const btnZone = scene.add
        .zone(0, 0, 114, 32)
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

    this.rootContainer.setPosition(w / 2, h / 2);

    this.backdropGraphic.clear();
    this.backdropGraphic.fillStyle(0x04060a, 0.84);
    this.backdropGraphic.fillRect(-w / 2, -h / 2, w, h);
    this.backdropZone.setSize(w, h);

    // Painel Paisagem Amplo 780x460 centralizado em 960x540
    const boxW = Math.min(780, w - 24);
    const boxH = Math.min(460, h - 24);
    const headerH = 42;

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
      headerGlowColor: DF_PALETTE.buttonBlueBorder,
      headerGlowAlpha: 0.16,
      shadow: true,
      cornerOrnaments: true,
      clear: true,
    });

    // Crânio ornamental discreto coroando o topo central do Altar
    drawSkullCrest(this.panelGraphic, 0, -boxH / 2 + 1, 0.85);

    const leftEdge = -boxW / 2 + 18;
    const rightEdge = boxW / 2 - 18;
    const topEdge = -boxH / 2;
    const innerW = boxW - 36;

    this.titleText.setPosition(leftEdge, topEdge + headerH / 2 + 4);

    const closeW = 88;
    const closeH = 28;
    this.closeBtnContainer.setPosition(
      rightEdge - closeW / 2,
      topEdge + headerH / 2 + 4
    );
    this.closeBtnZone.setSize(closeW, closeH);
    this.drawCloseButton(false);

    // Barra de saldo de Almas
    const soulsBarY = topEdge + headerH + 10;
    const soulsBarH = 28;
    drawOrnatePanel(this.soulsBgGraphic, {
      x: leftEdge,
      y: soulsBarY,
      width: innerW,
      height: soulsBarH,
      bevel: 5,
      fillColor: DF_PALETTE.deepRecess,
      fillAlpha: 0.95,
      innerFillColor: DF_PALETTE.obsidianBg,
      outerBorderColor: DF_PALETTE.metalBorder,
      innerBorderColor: DF_PALETTE.metalDark,
      shadow: false,
      cornerOrnaments: false,
      clear: true,
    });

    const iconSize = 16;
    const iconCenterX = leftEdge + 16;
    const iconCenterY = soulsBarY + soulsBarH / 2;
    this.soulsIcon
      ?.setPosition(iconCenterX, iconCenterY)
      .setDisplaySize(iconSize, iconSize);
    this.soulsFallbackGraphic.setPosition(iconCenterX, iconCenterY);

    this.soulsText.setPosition(leftEdge + 29, iconCenterY);

    const introY = soulsBarY + soulsBarH + 6;
    this.introText.setWordWrapWidth(innerW);
    this.introText.setPosition(leftEdge, introY);

    const dividerY = introY + 20;
    drawOrnamentalDivider(this.panelGraphic, leftEdge, dividerY, innerW);

    const listTop = dividerY + 8;
    const rowH = 60;
    const gap = 6;

    this.rows.forEach((row, idx) => {
      const cy = listTop + idx * (rowH + gap) + rowH / 2;
      this.layoutRow(row, 0, cy, innerW, rowH);
    });

    this.emptyText.setPosition(0, listTop + 130);

    const pageY = boxH / 2 - 18;
    this.prevPageContainer.setPosition(-80, pageY);
    this.pageInfoText.setPosition(0, pageY);
    this.nextPageContainer.setPosition(80, pageY);

    this.renderSnapshot();
  }

  public destroy(): void {
    this.scene.input.keyboard?.off('keydown', this.keydownHandler);
    this.rootContainer.destroy(true);
  }

  private getTotalPages(): number {
    return Math.max(
      1,
      Math.ceil(this.lastSnapshot.upgrades.length / MAX_ROWS_PER_PAGE)
    );
  }

  private drawCloseButton(hovered: boolean): void {
    drawOrnateButton(this.closeBtnBg, -44, -14, 88, 28, {
      variant: 'crimson',
      bevel: 5,
      hovered,
      clear: true,
    });
  }

  private layoutRow(
    row: AltarRowView,
    cx: number,
    cy: number,
    w: number,
    h: number
  ): void {
    row.container.setPosition(cx, cy);
    row.container.setData('rowW', w);
    row.container.setData('rowH', h);

    const left = -w / 2 + 14;
    const right = w / 2 - 14;
    const top = -h / 2 + 7;

    const btnW = 114;
    const btnH = 32;
    row.container.setData('btnW', btnW);
    row.container.setData('btnH', btnH);

    const infoRightX = right - btnW - 16;
    const textMaxW = Math.max(220, infoRightX - left - 120);

    row.nameText.setWordWrapWidth(textMaxW);
    row.nameText.setPosition(left, top);

    row.bonusText.setWordWrapWidth(textMaxW + 40);
    row.bonusText.setPosition(left, top + 18);

    row.descText.setWordWrapWidth(infoRightX - left - 16);
    row.descText.setPosition(left, top + 34);

    row.levelText.setPosition(infoRightX, top + 2);
    row.costText.setPosition(infoRightX, top + 22);

    row.btnContainer.setPosition(right - btnW / 2, 0);
    row.btnZone.setSize(btnW, btnH);
  }

  private renderSnapshot(): void {
    const snap = this.lastSnapshot;

    const hasSoulsIcon =
      this.soulsIcon !== null &&
      hasUiTextureFrame(this.scene, DF_UI_ICONS_KEY, DF_UI_ICON_FRAMES.souls);
    this.soulsIcon?.setVisible(hasSoulsIcon);
    if (hasSoulsIcon && this.soulsIcon) {
      this.soulsIcon.setFrame(DF_UI_ICON_FRAMES.souls);
    }
    this.soulsFallbackGraphic.setVisible(!hasSoulsIcon);

    this.soulsText.setText(`Almas disponíveis: ${formatStatNumber(snap.souls)}`);
    this.setTextClamped(
      this.introText,
      dialoguesData.entries.altar_intro.shortText,
      1
    );

    const upgrades = snap.upgrades;
    this.emptyText.setVisible(upgrades.length === 0);

    const totalPages = this.getTotalPages();
    const startIdx = this.page * MAX_ROWS_PER_PAGE;
    const pageUpgrades = upgrades.slice(startIdx, startIdx + MAX_ROWS_PER_PAGE);

    for (let i = 0; i < this.rows.length; i += 1) {
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

      const rowW = (row.container.getData('rowW') as number) || 744;
      const rowH = (row.container.getData('rowH') as number) || 60;
      const btnW = (row.container.getData('btnW') as number) || 114;
      const btnH = (row.container.getData('btnH') as number) || 32;

      const outerBorder = isMax
        ? DF_PALETTE.bronzeBorder
        : canAfford
          ? DF_PALETTE.buttonBlueBorder
          : DF_PALETTE.metalBorder;

      drawOrnatePanel(row.bg, {
        x: -rowW / 2,
        y: -rowH / 2,
        width: rowW,
        height: rowH,
        bevel: 6,
        fillColor: DF_PALETTE.deepRecess,
        fillAlpha: 0.95,
        innerFillColor: DF_PALETTE.innerSurface,
        outerBorderColor: outerBorder,
        innerBorderColor: isMax ? DF_PALETTE.bronzeDark : DF_PALETTE.metalDark,
        shadow: false,
        cornerOrnaments: false,
        clear: true,
      });

      this.setTextClamped(row.nameText, def.name, 1);
      row.levelText.setText(`Nv. ${level}/${def.maxLevel}`);
      row.levelText.setColor(
        isMax ? DF_PALETTE.textGold : DF_PALETTE.textLight
      );

      const bonusStr = this.formatBonusSummary(def.bonusPerLevel, level);
      this.setTextClamped(row.bonusText, bonusStr, 1);
      this.setTextClamped(row.descText, def.description, 1);

      if (isMax) {
        row.costText.setText('Nível Máximo');
        row.costText.setColor(DF_PALETTE.textGold);
      } else {
        row.costText.setText(`Custo: ${formatStatNumber(cost)} Almas`);
        row.costText.setColor(
          canAfford ? DF_PALETTE.textBlue : DF_PALETTE.textDanger
        );
      }

      if (isMax) {
        drawOrnateButton(row.btnBg, -btnW / 2, -btnH / 2, btnW, btnH, {
          variant: 'gold',
          bevel: 5,
          disabled: true,
          clear: true,
        });
        row.btnText.setText('Máximo').setColor(DF_PALETTE.textGold);
      } else if (canAfford) {
        drawOrnateButton(row.btnBg, -btnW / 2, -btnH / 2, btnW, btnH, {
          variant: 'blue',
          bevel: 5,
          clear: true,
        });
        row.btnText.setText('Aprimorar').setColor(DF_PALETTE.textParchment);
      } else {
        drawOrnateButton(row.btnBg, -btnW / 2, -btnH / 2, btnW, btnH, {
          variant: 'iron',
          bevel: 5,
          disabled: true,
          clear: true,
        });
        row.btnText.setText('Aprimorar').setColor(DF_PALETTE.textMuted);
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
    drawOrnateButton(bg, -37, -12, 74, 24, {
      variant: 'iron',
      bevel: 4,
      disabled: !enabled,
      clear: true,
    });
    label.setColor(enabled ? DF_PALETTE.textParchment : DF_PALETTE.textMuted);
  }

  private drawSoulsFallbackDiamond(): void {
    this.soulsFallbackGraphic.clear();
    this.soulsFallbackGraphic.fillStyle(DF_PALETTE.buttonBlueHighlight, 0.95);
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
        : formatStatNumber(val);
      const totalText = isPercent
        ? `${Math.round(total * 100)}%`
        : formatStatNumber(total);

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
