import Phaser from 'phaser';
import {
  BlacksmithForgeDef,
  ItemInstance,
  StatBonus,
  ViewportConfig,
  resolveViewportConfig,
} from '../../core/index';
import dialoguesData from '../../data/dialogues.json';
import {
  DF_FONTS,
  DF_FORCE_THEME,
  DF_PALETTE,
  DF_RARITY_THEME,
  DF_SLOT_META,
  DF_UI_ICONS_KEY,
  DF_UI_ICON_FRAMES,
  drawOrnamentalDivider,
  drawOrnateButton,
  drawOrnatePanel,
  drawRaritySlotFrame,
  formatStatNumber,
  hasUiTextureFrame,
} from './DarkFantasyUiBuilder';

export interface BlacksmithModalSnapshot {
  souls: number;
  generalEssences: number;
  items: ItemInstance[];
  itemUpgradeLevels: Record<string, number>;
  maxUpgradeLevel: number;
  getUpgradeCost: (level: number) => number;
  forgeRecipes: BlacksmithForgeDef[];
}

interface BlacksmithItemRowView {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  slotFrameBg: Phaser.GameObjects.Graphics;
  slotIcon: Phaser.GameObjects.Image | null;
  nameText: Phaser.GameObjects.Text;
  levelText: Phaser.GameObjects.Text;
  statsText: Phaser.GameObjects.Text;
  costText: Phaser.GameObjects.Text;
  btnContainer: Phaser.GameObjects.Container;
  btnBg: Phaser.GameObjects.Graphics;
  btnText: Phaser.GameObjects.Text;
  btnZone: Phaser.GameObjects.Zone;
  boundInstanceId: string | null;
  canUpgrade: boolean;
}

interface ForgeCardView {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  essenceIcon: Phaser.GameObjects.Image | null;
  titleText: Phaser.GameObjects.Text;
  descText: Phaser.GameObjects.Text;
  costText: Phaser.GameObjects.Text;
  btnContainer: Phaser.GameObjects.Container;
  btnBg: Phaser.GameObjects.Graphics;
  btnText: Phaser.GameObjects.Text;
  btnZone: Phaser.GameObjects.Zone;
  boundRecipeId: string | null;
  canForge: boolean;
}

const MAX_ITEM_ROWS = 4;
const MAX_FORGE_CARDS = 2;

export class BlacksmithModal {
  private readonly scene: Phaser.Scene;
  private readonly callbacks: {
    onUpgradeItem: (instanceId: string) => void;
    onForgeRecipe: (recipeId: string) => void;
    onClose: () => void;
  };

  private viewport: ViewportConfig;
  private opened = false;
  private itemPage = 0;
  private lastSnapshot: BlacksmithModalSnapshot = {
    souls: 0,
    generalEssences: 0,
    items: [],
    itemUpgradeLevels: {},
    maxUpgradeLevel: 5,
    getUpgradeCost: () => 0,
    forgeRecipes: [],
  };

  private readonly rootContainer: Phaser.GameObjects.Container;
  private readonly backdropGraphic: Phaser.GameObjects.Graphics;
  private readonly backdropZone: Phaser.GameObjects.Zone;
  private readonly panelGraphic: Phaser.GameObjects.Graphics;
  private readonly balancesBgGraphic: Phaser.GameObjects.Graphics;
  private readonly tipBgGraphic: Phaser.GameObjects.Graphics;

  private readonly soulsIcon: Phaser.GameObjects.Image | null;
  private readonly essenceIcon: Phaser.GameObjects.Image | null;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly soulsBalanceText: Phaser.GameObjects.Text;
  private readonly essenceBalanceText: Phaser.GameObjects.Text;
  private readonly itemsHeaderText: Phaser.GameObjects.Text;
  private readonly forgeHeaderText: Phaser.GameObjects.Text;
  private readonly emptyItemsText: Phaser.GameObjects.Text;
  private readonly tipText: Phaser.GameObjects.Text;

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

  private readonly itemRows: BlacksmithItemRowView[] = [];
  private readonly forgeCards: ForgeCardView[] = [];
  private readonly keydownHandler: (event: KeyboardEvent) => void;

  constructor(
    scene: Phaser.Scene,
    callbacks: {
      onUpgradeItem: (instanceId: string) => void;
      onForgeRecipe: (recipeId: string) => void;
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
    this.balancesBgGraphic = scene.add.graphics();
    this.tipBgGraphic = scene.add.graphics();

    this.soulsIcon = hasUiTextureFrame(
      scene,
      DF_UI_ICONS_KEY,
      DF_UI_ICON_FRAMES.souls
    )
      ? scene.add
          .image(0, 0, DF_UI_ICONS_KEY, DF_UI_ICON_FRAMES.souls)
          .setOrigin(0.5)
      : null;
    this.essenceIcon = hasUiTextureFrame(
      scene,
      DF_UI_ICONS_KEY,
      DF_UI_ICON_FRAMES.essence
    )
      ? scene.add
          .image(0, 0, DF_UI_ICONS_KEY, DF_UI_ICON_FRAMES.essence)
          .setOrigin(0.5)
      : null;

    this.titleText = scene.add
      .text(0, 0, 'FERREIRO ESPIRITUAL', {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '17px',
        color: DF_PALETTE.textGold,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0, 0.5);

    this.soulsBalanceText = scene.add
      .text(0, 0, 'Almas: 0', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '12px',
        color: DF_PALETTE.textBlue,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0, 0.5);

    this.essenceBalanceText = scene.add
      .text(0, 0, 'Essências de General: 0', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '12px',
        color: DF_RARITY_THEME.legendary.accentHex,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0, 0.5);

    this.itemsHeaderText = scene.add.text(0, 0, 'APRIMORAR ITENS (0)', {
      fontFamily: DF_FONTS.TITLE,
      fontSize: '12px',
      color: DF_PALETTE.textParchment,
      fontStyle: 'bold',
      resolution: 2,
    });

    this.forgeHeaderText = scene.add.text(0, 0, 'FORJAR RELÍQUIAS', {
      fontFamily: DF_FONTS.TITLE,
      fontSize: '12px',
      color: DF_PALETTE.textGold,
      fontStyle: 'bold',
      resolution: 2,
    });

    this.emptyItemsText = scene.add
      .text(
        0,
        0,
        'Nenhum item equipado ou no baú.\nForje um equipamento ou explore a Fenda.',
        {
          fontFamily: DF_FONTS.BODY,
          fontSize: '11px',
          color: DF_PALETTE.textMuted,
          align: 'center',
          resolution: 2,
        }
      )
      .setOrigin(0.5, 0.5);

    this.tipText = scene.add.text(
      0,
      0,
      dialoguesData.entries.blacksmith_intro.shortText,
      {
        fontFamily: DF_FONTS.BODY,
        fontSize: '11px',
        color: DF_PALETTE.textLight,
        lineSpacing: 3,
        resolution: 2,
      }
    );

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

    // Controles de paginação da lista de aprimoramento
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
      .zone(0, 0, 74, 26)
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
        if (!this.opened || this.itemPage <= 0) {
          return;
        }
        this.itemPage -= 1;
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
      .zone(0, 0, 74, 26)
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
        if (this.itemPage < totalPages - 1) {
          this.itemPage += 1;
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
      this.balancesBgGraphic,
      this.tipBgGraphic,
      this.titleText,
      this.soulsBalanceText,
      this.essenceBalanceText,
      this.itemsHeaderText,
      this.forgeHeaderText,
      this.emptyItemsText,
      this.tipText,
      this.closeBtnContainer,
      this.prevPageContainer,
      this.nextPageContainer,
      this.pageInfoText,
    ];
    if (this.soulsIcon) {
      rootChildren.push(this.soulsIcon);
    }
    if (this.essenceIcon) {
      rootChildren.push(this.essenceIcon);
    }

    // Linhas de Aprimoramento de Itens (suporta os 6 slots via DF_SLOT_META)
    for (let i = 0; i < MAX_ITEM_ROWS; i += 1) {
      const bg = scene.add.graphics();
      const slotFrameBg = scene.add.graphics();
      const slotIcon = hasUiTextureFrame(
        scene,
        DF_UI_ICONS_KEY,
        DF_SLOT_META.weapon.iconFrame
      )
        ? scene.add
            .image(0, 0, DF_UI_ICONS_KEY, DF_SLOT_META.weapon.iconFrame)
            .setOrigin(0.5)
        : null;
      const nameText = scene.add.text(0, 0, '', {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '12px',
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
      const statsText = scene.add.text(0, 0, '', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '10px',
        color: DF_PALETTE.textLight,
        resolution: 2,
      });
      const costText = scene.add.text(0, 0, '', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '10px',
        color: DF_PALETTE.textBlue,
        fontStyle: 'bold',
        resolution: 2,
      });

      const btnBg = scene.add.graphics();
      const btnText = scene.add
        .text(0, 0, 'Aprimorar', {
          fontFamily: DF_FONTS.BODY,
          fontSize: '11px',
          color: DF_PALETTE.textParchment,
          fontStyle: 'bold',
          resolution: 2,
        })
        .setOrigin(0.5, 0.5);
      const btnZone = scene.add
        .zone(0, 0, 98, 28)
        .setOrigin(0.5, 0.5)
        .setInteractive({ useHandCursor: true });

      const btnContainer = scene.add.container(0, 0, [btnBg, btnText, btnZone]);

      const rowChildren: Phaser.GameObjects.GameObject[] = [bg, slotFrameBg];
      if (slotIcon) {
        rowChildren.push(slotIcon);
      }
      rowChildren.push(
        nameText,
        levelText,
        statsText,
        costText,
        btnContainer
      );

      const rowView: BlacksmithItemRowView = {
        container: scene.add.container(0, 0, rowChildren),
        bg,
        slotFrameBg,
        slotIcon,
        nameText,
        levelText,
        statsText,
        costText,
        btnContainer,
        btnBg,
        btnText,
        btnZone,
        boundInstanceId: null,
        canUpgrade: false,
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
          if (!this.opened || !rowView.boundInstanceId || !rowView.canUpgrade) {
            return;
          }
          this.callbacks.onUpgradeItem(rowView.boundInstanceId);
        }
      );

      this.itemRows.push(rowView);
      rootChildren.push(rowView.container);
    }

    // Cards de Forja de Relíquias (Coluna Direita)
    for (let i = 0; i < MAX_FORGE_CARDS; i += 1) {
      const bg = scene.add.graphics();
      const essenceIcon = hasUiTextureFrame(
        scene,
        DF_UI_ICONS_KEY,
        DF_UI_ICON_FRAMES.essence
      )
        ? scene.add
            .image(0, 0, DF_UI_ICONS_KEY, DF_UI_ICON_FRAMES.essence)
            .setOrigin(0.5)
        : null;
      const titleText = scene.add.text(0, 0, '', {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '12px',
        color: DF_RARITY_THEME.rare.hex,
        fontStyle: 'bold',
        resolution: 2,
      });
      const descText = scene.add.text(0, 0, '', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '10px',
        color: DF_PALETTE.textLight,
        lineSpacing: 2,
        resolution: 2,
      });
      const costText = scene.add.text(0, 0, '', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '11px',
        color: DF_PALETTE.textGold,
        fontStyle: 'bold',
        resolution: 2,
      });

      const btnBg = scene.add.graphics();
      const btnText = scene.add
        .text(0, 0, 'Forjar', {
          fontFamily: DF_FONTS.TITLE,
          fontSize: '11px',
          color: DF_PALETTE.textParchment,
          fontStyle: 'bold',
          resolution: 2,
        })
        .setOrigin(0.5, 0.5);
      const btnZone = scene.add
        .zone(0, 0, 96, 30)
        .setOrigin(0.5, 0.5)
        .setInteractive({ useHandCursor: true });

      const btnContainer = scene.add.container(0, 0, [btnBg, btnText, btnZone]);

      const cardChildren: Phaser.GameObjects.GameObject[] = [bg];
      if (essenceIcon) {
        cardChildren.push(essenceIcon);
      }
      cardChildren.push(titleText, descText, costText, btnContainer);

      const cardView: ForgeCardView = {
        container: scene.add.container(0, 0, cardChildren),
        bg,
        essenceIcon,
        titleText,
        descText,
        costText,
        btnContainer,
        btnBg,
        btnText,
        btnZone,
        boundRecipeId: null,
        canForge: false,
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
          if (!this.opened || !cardView.boundRecipeId || !cardView.canForge) {
            return;
          }
          this.callbacks.onForgeRecipe(cardView.boundRecipeId);
        }
      );

      this.forgeCards.push(cardView);
      rootChildren.push(cardView.container);
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

  public open(snap: BlacksmithModalSnapshot): void {
    this.opened = true;
    this.itemPage = 0;
    this.rootContainer.setVisible(true);
    this.update(snap);
  }

  public update(snap: BlacksmithModalSnapshot): void {
    this.lastSnapshot = snap;
    const totalPages = this.getTotalPages();
    if (this.itemPage >= totalPages) {
      this.itemPage = Math.max(0, totalPages - 1);
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

    // Painel Paisagem Amplo 860x470 centralizado em 960x540
    const boxW = Math.min(860, w - 24);
    const boxH = Math.min(470, h - 24);
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
      headerGlowColor: DF_RARITY_THEME.legendary.headerGlow,
      headerGlowAlpha: 0.16,
      shadow: true,
      cornerOrnaments: true,
      clear: true,
    });

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

    // Barra de Saldos (Almas + Essências de General)
    const balY = topEdge + headerH + 12;
    const balH = 28;
    drawOrnatePanel(this.balancesBgGraphic, {
      x: leftEdge,
      y: balY,
      width: innerW,
      height: balH,
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

    const balCenterY = balY + balH / 2;
    const balIconSize = 16;
    const hasSoulsIcon =
      this.soulsIcon !== null &&
      hasUiTextureFrame(this.scene, DF_UI_ICONS_KEY, DF_UI_ICON_FRAMES.souls);
    const hasEssenceIcon =
      this.essenceIcon !== null &&
      hasUiTextureFrame(this.scene, DF_UI_ICONS_KEY, DF_UI_ICON_FRAMES.essence);

    if (this.soulsIcon) {
      this.soulsIcon
        .setVisible(hasSoulsIcon)
        .setPosition(leftEdge + 16, balCenterY)
        .setDisplaySize(balIconSize, balIconSize);
    }
    this.soulsBalanceText.setPosition(
      leftEdge + (hasSoulsIcon ? 28 : 12),
      balCenterY
    );

    const essenceColX = leftEdge + 220;
    if (this.essenceIcon) {
      this.essenceIcon
        .setVisible(hasEssenceIcon)
        .setPosition(essenceColX, balCenterY)
        .setDisplaySize(balIconSize, balIconSize);
    }
    this.essenceBalanceText.setPosition(
      essenceColX + (hasEssenceIcon ? 14 : 0),
      balCenterY
    );

    // Layout 2 Colunas: Aprimorar Itens (Esquerda) + Forjar Relíquias (Direita)
    const bodyHeaderY = balY + balH + 12;
    const colGap = 18;
    const leftColW = Math.round((innerW - colGap) * 0.56);
    const rightColLeft = leftEdge + leftColW + colGap;
    const rightColW = rightEdge - rightColLeft;

    // Divisória vertical sutil entre as 2 colunas
    const divX = leftEdge + leftColW + colGap / 2;
    this.panelGraphic.lineStyle(1.2, DF_PALETTE.bronzeDark, 0.85);
    this.panelGraphic.lineBetween(divX, bodyHeaderY, divX, boxH / 2 - 16);

    this.itemsHeaderText.setPosition(leftEdge, bodyHeaderY);
    this.forgeHeaderText.setPosition(rightColLeft, bodyHeaderY);

    drawOrnamentalDivider(
      this.panelGraphic,
      leftEdge,
      bodyHeaderY + 17,
      leftColW
    );
    drawOrnamentalDivider(
      this.panelGraphic,
      rightColLeft,
      bodyHeaderY + 17,
      rightColW
    );

    const listTop = bodyHeaderY + 26;
    const rowH = 72;
    const rowGap = 7;
    const leftCenterX = leftEdge + leftColW / 2;
    this.itemRows.forEach((row, idx) => {
      const cy = listTop + idx * (rowH + rowGap) + rowH / 2;
      this.layoutItemRow(row, leftCenterX, cy, leftColW, rowH);
    });

    this.emptyItemsText.setPosition(leftCenterX, listTop + 130);

    const rightCenterX = rightColLeft + rightColW / 2;
    const forgeH = 112;
    const forgeGap = 10;
    this.forgeCards.forEach((card, idx) => {
      const cy = listTop + idx * (forgeH + forgeGap) + forgeH / 2;
      this.layoutForgeCard(card, rightCenterX, cy, rightColW, forgeH);
    });

    // Painel de dica/lore do Ferreiro na base da coluna direita
    const tipY = listTop + MAX_FORGE_CARDS * forgeH + forgeGap + 12;
    const tipH = Math.max(66, boxH / 2 - 16 - tipY);
    this.tipBgGraphic.setVisible(true);
    drawOrnatePanel(this.tipBgGraphic, {
      x: rightColLeft,
      y: tipY,
      width: rightColW,
      height: tipH,
      bevel: 6,
      fillColor: DF_PALETTE.deepRecess,
      fillAlpha: 0.92,
      innerFillColor: DF_PALETTE.obsidianBg,
      outerBorderColor: DF_PALETTE.bronzeDark,
      innerBorderColor: DF_PALETTE.metalDark,
      shadow: false,
      cornerOrnaments: false,
      clear: true,
    });

    this.tipText.setVisible(true);
    this.tipText.setWordWrapWidth(rightColW - 22);
    this.tipText.setPosition(rightColLeft + 11, tipY + 10);
    this.setTextClamped(
      this.tipText,
      dialoguesData.entries.blacksmith_intro.shortText,
      3
    );

    const pageY = boxH / 2 - 22;
    this.prevPageContainer.setPosition(leftCenterX - 80, pageY);
    this.pageInfoText.setPosition(leftCenterX, pageY);
    this.nextPageContainer.setPosition(leftCenterX + 80, pageY);

    this.renderSnapshot();
  }

  public destroy(): void {
    this.scene.input.keyboard?.off('keydown', this.keydownHandler);
    this.rootContainer.destroy(true);
  }

  private getPageSize(): number {
    return MAX_ITEM_ROWS;
  }

  private getTotalPages(): number {
    return Math.max(
      1,
      Math.ceil(this.lastSnapshot.items.length / this.getPageSize())
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

  private layoutItemRow(
    row: BlacksmithItemRowView,
    cx: number,
    cy: number,
    w: number,
    h: number
  ): void {
    row.container.setPosition(cx, cy);
    row.container.setData('rowW', w);
    row.container.setData('rowH', h);

    const left = -w / 2 + 10;
    const right = w / 2 - 10;
    const top = -h / 2 + 7;
    const bottom = h / 2 - 7;

    const btnW = 98;
    const btnH = 28;
    const slotBoxSize = 42;
    row.container.setData('btnW', btnW);
    row.container.setData('btnH', btnH);
    row.container.setData('leftX', left);
    row.container.setData('topY', top);
    row.container.setData('slotBoxSize', slotBoxSize);

    const slotCenterX = left + slotBoxSize / 2;
    row.slotIcon?.setPosition(slotCenterX, 0);
    row.slotIcon?.setDisplaySize(slotBoxSize - 12, slotBoxSize - 12);

    const textLeft = left + slotBoxSize + 10;
    row.nameText.setPosition(textLeft, top);
    row.nameText.setWordWrapWidth(w - slotBoxSize - 110);

    row.levelText.setPosition(right, top);

    row.statsText.setPosition(textLeft, top + 19);
    row.statsText.setWordWrapWidth(w - slotBoxSize - btnW - 32);

    row.costText.setPosition(textLeft, bottom - 15);

    row.btnContainer.setPosition(right - btnW / 2, bottom - btnH / 2 + 1);
    row.btnZone.setSize(btnW, btnH);
  }

  private layoutForgeCard(
    card: ForgeCardView,
    cx: number,
    cy: number,
    w: number,
    h: number
  ): void {
    card.container.setPosition(cx, cy);
    card.container.setData('cardW', w);
    card.container.setData('cardH', h);

    const left = -w / 2 + 12;
    const right = w / 2 - 12;
    const top = -h / 2 + 9;
    const bottom = h / 2 - 9;

    const btnW = 94;
    const btnH = 30;
    card.container.setData('btnW', btnW);
    card.container.setData('btnH', btnH);
    card.container.setData('leftX', left);

    card.titleText.setWordWrapWidth(w - 24);
    card.titleText.setPosition(left, top);

    card.descText.setWordWrapWidth(w - 24);
    card.descText.setPosition(left, top + 20);

    const iconSize = 15;
    const footerCenterY = bottom - btnH / 2;
    card.essenceIcon
      ?.setPosition(left + iconSize / 2, footerCenterY)
      .setDisplaySize(iconSize, iconSize);
    card.container.setData('costY', footerCenterY);

    card.costText.setOrigin(0, 0.5);
    card.costText.setWordWrapWidth(w - btnW - 48);

    card.btnContainer.setPosition(right - btnW / 2, footerCenterY);
    card.btnZone.setSize(btnW, btnH);
  }

  private renderSnapshot(): void {
    const snap = this.lastSnapshot;

    this.soulsBalanceText.setText(`Almas: ${formatStatNumber(snap.souls)}`);
    this.essenceBalanceText.setText(
      `Essências de General: ${formatStatNumber(snap.generalEssences)}`
    );

    // Renderizar Cards de Forja
    for (let i = 0; i < this.forgeCards.length; i += 1) {
      const card = this.forgeCards[i];
      const recipe = snap.forgeRecipes[i];
      if (!recipe) {
        card.boundRecipeId = null;
        card.canForge = false;
        card.container.setVisible(false);
        continue;
      }

      card.boundRecipeId = recipe.id;
      card.container.setVisible(true);

      const canAfford =
        snap.souls >= recipe.soulCost &&
        snap.generalEssences >= recipe.essenceCost;
      card.canForge = canAfford;

      const cardW = (card.container.getData('cardW') as number) || 320;
      const cardH = (card.container.getData('cardH') as number) || 112;
      const btnW = (card.container.getData('btnW') as number) || 94;
      const btnH = (card.container.getData('btnH') as number) || 30;
      const leftX = (card.container.getData('leftX') as number) ?? -cardW / 2 + 12;
      const costY = (card.container.getData('costY') as number) ?? 0;

      const rarityTheme = DF_RARITY_THEME[recipe.rarity];

      drawOrnatePanel(card.bg, {
        x: -cardW / 2,
        y: -cardH / 2,
        width: cardW,
        height: cardH,
        bevel: 7,
        fillColor: DF_PALETTE.deepRecess,
        fillAlpha: 0.96,
        innerFillColor: DF_PALETTE.innerSurface,
        outerBorderColor: canAfford
          ? rarityTheme.border
          : DF_PALETTE.metalBorder,
        innerBorderColor: canAfford
          ? rarityTheme.innerBorder
          : DF_PALETTE.metalDark,
        accentColor: rarityTheme.gemColor,
        shadow: false,
        cornerOrnaments: false,
        clear: true,
      });

      this.setTextClamped(card.titleText, recipe.name, 1);
      card.titleText.setColor(rarityTheme.hex);

      this.setTextClamped(card.descText, recipe.description, 2);

      const hasEssenceIcon =
        recipe.essenceCost > 0 &&
        card.essenceIcon !== null &&
        hasUiTextureFrame(
          this.scene,
          DF_UI_ICONS_KEY,
          DF_UI_ICON_FRAMES.essence
        );
      card.essenceIcon?.setVisible(hasEssenceIcon);
      card.costText.setPosition(leftX + (hasEssenceIcon ? 20 : 0), costY);

      const costParts: string[] = [];
      if (recipe.essenceCost > 0) {
        costParts.push(`${formatStatNumber(recipe.essenceCost)} Essência`);
      }
      if (recipe.soulCost > 0) {
        costParts.push(`${formatStatNumber(recipe.soulCost)} Almas`);
      }
      card.costText.setText(`Custo: ${costParts.join(' + ')}`);
      card.costText.setColor(
        canAfford ? DF_PALETTE.textGold : DF_PALETTE.textDanger
      );

      drawOrnateButton(card.btnBg, -btnW / 2, -btnH / 2, btnW, btnH, {
        variant: recipe.rarity === 'legendary' ? 'gold' : 'crimson',
        bevel: 5,
        disabled: !canAfford,
        clear: true,
      });
      card.btnText.setColor(
        canAfford ? DF_PALETTE.textParchment : DF_PALETTE.textMuted
      );
    }

    // Renderizar Lista de Aprimoramento de Itens (6 slots)
    this.itemsHeaderText.setText(
      `APRIMORAR ITENS (${snap.items.length} — até +${snap.maxUpgradeLevel})`
    );
    this.emptyItemsText.setVisible(snap.items.length === 0);

    const pageSize = this.getPageSize();
    const totalPages = this.getTotalPages();
    const startIdx = this.itemPage * pageSize;
    const pageItems = snap.items.slice(startIdx, startIdx + pageSize);

    for (let i = 0; i < this.itemRows.length; i += 1) {
      const row = this.itemRows[i];
      const item = pageItems[i];
      if (!item || i >= pageSize) {
        row.boundInstanceId = null;
        row.canUpgrade = false;
        row.container.setVisible(false);
        continue;
      }

      row.boundInstanceId = item.instanceId;
      row.container.setVisible(true);

      const level = snap.itemUpgradeLevels[item.instanceId] ?? 0;
      const isMax = level >= snap.maxUpgradeLevel;
      const cost = isMax ? 0 : snap.getUpgradeCost(level);
      const canAfford = !isMax && snap.souls >= cost;
      row.canUpgrade = canAfford;

      const rowW = (row.container.getData('rowW') as number) || 460;
      const rowH = (row.container.getData('rowH') as number) || 72;
      const btnW = (row.container.getData('btnW') as number) || 98;
      const btnH = (row.container.getData('btnH') as number) || 28;
      const leftX = (row.container.getData('leftX') as number) ?? -rowW / 2 + 10;
      const slotBoxSize = (row.container.getData('slotBoxSize') as number) || 42;

      const rarityTheme = DF_RARITY_THEME[item.rarity];
      const slotMeta = DF_SLOT_META[item.slot];
      const forceTheme = DF_FORCE_THEME[item.force];

      drawOrnatePanel(row.bg, {
        x: -rowW / 2,
        y: -rowH / 2,
        width: rowW,
        height: rowH,
        bevel: 6,
        fillColor: DF_PALETTE.deepRecess,
        fillAlpha: 0.95,
        innerFillColor: DF_PALETTE.innerSurface,
        outerBorderColor: rarityTheme.border,
        innerBorderColor: rarityTheme.innerBorder,
        shadow: false,
        cornerOrnaments: false,
        clear: true,
      });

      drawRaritySlotFrame(row.slotFrameBg, {
        x: leftX,
        y: -slotBoxSize / 2,
        width: slotBoxSize,
        height: slotBoxSize,
        rarity: item.rarity,
        bevel: 5,
        gemColor:
          item.force !== 'none' ? forceTheme.color : rarityTheme.gemColor,
        showTopGem: false,
        showCornerGem: true,
        clear: true,
      });

      const hasSlotIcon =
        row.slotIcon !== null &&
        hasUiTextureFrame(this.scene, DF_UI_ICONS_KEY, slotMeta.iconFrame);
      if (row.slotIcon) {
        row.slotIcon.setVisible(hasSlotIcon);
        if (hasSlotIcon) {
          row.slotIcon.setFrame(slotMeta.iconFrame);
        }
      }

      const suffix =
        level > 0 && !item.name.includes(`(+${level})`) ? ` (+${level})` : '';
      this.setTextClamped(
        row.nameText,
        `[${slotMeta.labelTitle}] ${item.name}${suffix}`,
        1
      );
      row.nameText.setColor(rarityTheme.hex);

      row.levelText.setText(`+${level}/+${snap.maxUpgradeLevel}`);
      row.levelText.setColor(
        isMax ? DF_PALETTE.textGold : DF_PALETTE.textLight
      );

      const bonuses = this.formatItemBonuses(item, 3);
      const statsLine = `${forceTheme.label} · ${bonuses || `Poder ${formatStatNumber(item.powerScore)}`}`;
      this.setTextClamped(row.statsText, statsLine, 1);

      if (isMax) {
        row.costText.setText('Aprimoramento Máximo');
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

    // Paginação
    const showPagination = snap.items.length > pageSize;
    this.prevPageContainer.setVisible(showPagination);
    this.nextPageContainer.setVisible(showPagination);
    this.pageInfoText.setVisible(showPagination);

    if (showPagination) {
      this.pageInfoText.setText(`${this.itemPage + 1}/${totalPages}`);
      this.drawPageButton(this.prevPageBg, this.prevPageText, this.itemPage > 0);
      this.drawPageButton(
        this.nextPageBg,
        this.nextPageText,
        this.itemPage < totalPages - 1
      );
    }
  }

  private drawPageButton(
    bg: Phaser.GameObjects.Graphics,
    label: Phaser.GameObjects.Text,
    enabled: boolean
  ): void {
    drawOrnateButton(bg, -37, -13, 74, 26, {
      variant: 'iron',
      bevel: 4,
      disabled: !enabled,
      clear: true,
    });
    label.setColor(enabled ? DF_PALETTE.textParchment : DF_PALETTE.textMuted);
  }

  private formatItemBonuses(item: ItemInstance, maxEntries: number): string {
    const totals: StatBonus = { ...item.baseBonuses };
    for (const affix of item.affixes) {
      for (const [k, v] of Object.entries(affix.bonuses) as Array<
        [keyof StatBonus, number | undefined]
      >) {
        if (typeof v === 'number') {
          totals[k] = (totals[k] ?? 0) + v;
        }
      }
    }

    const parts: string[] = [];
    if (totals.attack) parts.push(`ATQ +${formatStatNumber(totals.attack)}`);
    if (totals.maxHp) parts.push(`HP +${formatStatNumber(totals.maxHp)}`);
    if (totals.defense) parts.push(`DEF +${formatStatNumber(totals.defense)}`);
    if (totals.moveSpeed)
      parts.push(`VEL +${formatStatNumber(totals.moveSpeed)}`);
    if (totals.critChance)
      parts.push(`CRIT +${Math.round(totals.critChance * 100)}%`);
    if (totals.lifeSteal)
      parts.push(`Roubo +${Math.round(totals.lifeSteal * 100)}%`);
    if (totals.cooldownReduction)
      parts.push(`Rec +${Math.round(totals.cooldownReduction * 100)}%`);
    if (totals.luck) parts.push(`Sorte +${Math.round(totals.luck * 100)}%`);

    return parts.slice(0, maxEntries).join(', ');
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
