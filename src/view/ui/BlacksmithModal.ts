import Phaser from 'phaser';
import {
  BlacksmithForgeDef,
  EquipSlot,
  ForceType,
  ItemInstance,
  Rarity,
  StatBonus,
  ViewportConfig,
  resolveViewportConfig,
} from '../../core/index';
import dialoguesData from '../../data/dialogues.json';

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

const SLOT_LABELS: Record<EquipSlot, string> = {
  weapon: 'Arma',
  armor: 'Armadura',
  amulet: 'Amuleto',
  ring: 'Anel',
};

const SLOT_ICON_FRAME: Record<EquipSlot, number> = {
  weapon: 12,
  armor: 13,
  amulet: 14,
  ring: 15,
};

const UI_ICONS_KEY = 'ui_icons';
const ICON_SOULS_FRAME = 10;
const ICON_ESSENCE_FRAME = 11;

const PALETTE = {
  BG_DEEP: 0x0d0f16,
  BG_SURFACE: 0x161924,
  BORDER_BRONZE: 0x8a7048,
  BORDER_STEEL: 0x525a6e,
  CLOSE_FILL: 0x2b1215,
  UPGRADE_FILL: 0x172b3a,
  UPGRADE_STROKE: 0x48cae4,
  FORGE_FILL: 0x3b1912,
} as const;

const RARITY_HEX: Record<Rarity, string> = {
  common: '#e4e4e7',
  magic: '#38bdf8',
  rare: '#facc15',
  legendary: '#f97316',
};

const RARITY_NUM: Record<Rarity, number> = {
  common: 0x8a7048,
  magic: 0x38bdf8,
  rare: 0xfacc15,
  legendary: 0xf97316,
};

const FORCE_LABELS: Record<ForceType, string> = {
  inferno: 'Inferno',
  submundo: 'Submundo',
  empireo: 'Empíreo',
  none: 'Neutro',
};

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
    this.balancesBgGraphic = scene.add.graphics();
    this.tipBgGraphic = scene.add.graphics();

    this.soulsIcon = this.hasTextureFrame(UI_ICONS_KEY, ICON_SOULS_FRAME)
      ? scene.add.image(0, 0, UI_ICONS_KEY, ICON_SOULS_FRAME).setOrigin(0.5)
      : null;
    this.essenceIcon = this.hasTextureFrame(UI_ICONS_KEY, ICON_ESSENCE_FRAME)
      ? scene.add.image(0, 0, UI_ICONS_KEY, ICON_ESSENCE_FRAME).setOrigin(0.5)
      : null;

    this.titleText = scene.add.text(0, 0, 'FERREIRO ESPIRITUAL', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#f0c46c',
      fontStyle: 'bold',
    });

    this.soulsBalanceText = scene.add.text(0, 0, 'Almas: 0', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#90e0ef',
      fontStyle: 'bold',
    });

    this.essenceBalanceText = scene.add.text(0, 0, 'Essências de General: 0', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#f4a261',
      fontStyle: 'bold',
    });

    this.itemsHeaderText = scene.add.text(0, 0, 'APRIMORAR ITENS (0)', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#cbd5e1',
      fontStyle: 'bold',
    });

    this.forgeHeaderText = scene.add.text(0, 0, 'FORJAR RELÍQUIAS', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#f0c46c',
      fontStyle: 'bold',
    });

    this.emptyItemsText = scene.add
      .text(
        0,
        0,
        'Nenhum item equipado ou no baú.\nForje um equipamento ou explore a Fenda.',
        {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#64748b',
          align: 'center',
        }
      )
      .setOrigin(0.5, 0.5);

    this.tipText = scene.add.text(
      0,
      0,
      dialoguesData.entries.blacksmith_intro.shortText,
      {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#cbd5e1',
      }
    );

    // Close Button
    this.closeBtnBg = scene.add.graphics();
    this.closeBtnText = scene.add
      .text(0, 0, 'Fechar', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#f8e7c2',
        fontStyle: 'bold',
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

    // Pagination Controls for Item Upgrade List
    this.prevPageBg = scene.add.graphics();
    this.prevPageText = scene.add
      .text(0, 0, '< Ant', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#f8fafc',
        fontStyle: 'bold',
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
      .text(0, 0, 'Próx >', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#f8fafc',
        fontStyle: 'bold',
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
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#cbd5e1',
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

    // Build Item Upgrade Rows
    for (let i = 0; i < MAX_ITEM_ROWS; i++) {
      const bg = scene.add.graphics();
      const slotIcon = this.hasTextureFrame(UI_ICONS_KEY, SLOT_ICON_FRAME.weapon)
        ? scene.add.image(0, 0, UI_ICONS_KEY, SLOT_ICON_FRAME.weapon).setOrigin(0.5)
        : null;
      const nameText = scene.add.text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#f8fafc',
        fontStyle: 'bold',
      });
      const levelText = scene.add
        .text(0, 0, '', {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#f0c46c',
          fontStyle: 'bold',
        })
        .setOrigin(1, 0);
      const statsText = scene.add.text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#cbd5e1',
      });
      const costText = scene.add.text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#90e0ef',
        fontStyle: 'bold',
      });

      const btnBg = scene.add.graphics();
      const btnText = scene.add
        .text(0, 0, 'Aprimorar', {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5, 0.5);
      const btnZone = scene.add
        .zone(0, 0, 92, 26)
        .setOrigin(0.5, 0.5)
        .setInteractive({ useHandCursor: true });

      const btnContainer = scene.add.container(0, 0, [btnBg, btnText, btnZone]);

      const rowChildren: Phaser.GameObjects.GameObject[] = [bg];
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

    // Build Forge Recipe Cards
    for (let i = 0; i < MAX_FORGE_CARDS; i++) {
      const bg = scene.add.graphics();
      const essenceIcon = this.hasTextureFrame(UI_ICONS_KEY, ICON_ESSENCE_FRAME)
        ? scene.add.image(0, 0, UI_ICONS_KEY, ICON_ESSENCE_FRAME).setOrigin(0.5)
        : null;
      const titleText = scene.add.text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#facc15',
        fontStyle: 'bold',
      });
      const descText = scene.add.text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#cbd5e1',
      });
      const costText = scene.add.text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#f4a261',
        fontStyle: 'bold',
      });

      const btnBg = scene.add.graphics();
      const btnText = scene.add
        .text(0, 0, 'Forjar', {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5, 0.5);
      const btnZone = scene.add
        .zone(0, 0, 86, 26)
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
    const isMobile = viewport.mode === 'mobile_portrait';

    this.rootContainer.setPosition(w / 2, h / 2);

    this.backdropGraphic.clear();
    this.backdropGraphic.fillStyle(0x04060a, 0.84);
    this.backdropGraphic.fillRect(-w / 2, -h / 2, w, h);
    this.backdropZone.setSize(w, h);

    const boxW = isMobile ? w - 20 : 720;
    const boxH = isMobile ? h - 44 : 524;

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

    this.titleText.setText(isMobile ? 'FERREIRO' : 'FERREIRO ESPIRITUAL');
    this.titleText.setFontSize(isMobile ? 14 : 15);
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

    const balY = topEdge + (isMobile ? 30 : 34);
    const balH = isMobile ? 24 : 26;
    this.drawChamferedBox(
      this.balancesBgGraphic,
      leftEdge,
      balY,
      innerW,
      balH,
      5,
      PALETTE.BG_SURFACE,
      0.95,
      PALETTE.BORDER_STEEL,
      1.2
    );

    const balCenterY = balY + balH / 2;
    const balIconSize = isMobile ? 14 : 16;
    const hasSoulsIcon =
      this.soulsIcon !== null &&
      this.hasTextureFrame(UI_ICONS_KEY, ICON_SOULS_FRAME);
    const hasEssenceIcon =
      this.essenceIcon !== null &&
      this.hasTextureFrame(UI_ICONS_KEY, ICON_ESSENCE_FRAME);

    if (this.soulsIcon) {
      this.soulsIcon
        .setVisible(hasSoulsIcon)
        .setPosition(leftEdge + 14, balCenterY)
        .setDisplaySize(balIconSize, balIconSize);
    }
    this.soulsBalanceText.setFontSize(isMobile ? 10 : 11);
    this.soulsBalanceText.setPosition(
      leftEdge + (hasSoulsIcon ? 25 : 10),
      balY + (isMobile ? 6 : 6)
    );

    const essenceColX = leftEdge + (isMobile ? 148 : 196);
    if (this.essenceIcon) {
      this.essenceIcon
        .setVisible(hasEssenceIcon)
        .setPosition(essenceColX, balCenterY)
        .setDisplaySize(balIconSize, balIconSize);
    }
    this.essenceBalanceText.setFontSize(isMobile ? 10 : 11);
    this.essenceBalanceText.setPosition(
      essenceColX + (hasEssenceIcon ? 11 : 0),
      balY + (isMobile ? 6 : 6)
    );

    if (isMobile) {
      // Stacked on Mobile: Forge Cards top, Item Upgrade Rows bottom
      const forgeHeaderY = balY + balH + 8;
      this.forgeHeaderText.setFontSize(10);
      this.forgeHeaderText.setPosition(leftEdge, forgeHeaderY);

      const forgeTop = forgeHeaderY + 16;
      const forgeH = 74;
      this.forgeCards.forEach((card, idx) => {
        const cy = forgeTop + idx * (forgeH + 6) + forgeH / 2;
        this.layoutForgeCard(card, 0, cy, innerW, forgeH, true);
      });

      const itemsHeaderY = forgeTop + forgeH * MAX_FORGE_CARDS + 14;
      this.itemsHeaderText.setFontSize(10);
      this.itemsHeaderText.setPosition(leftEdge, itemsHeaderY);

      const itemsTop = itemsHeaderY + 16;
      const rowH = 84;
      this.itemRows.forEach((row, idx) => {
        const cy = itemsTop + idx * (rowH + 6) + rowH / 2;
        this.layoutItemRow(row, 0, cy, innerW, rowH, true);
      });

      this.emptyItemsText.setPosition(0, itemsTop + 115);

      this.tipBgGraphic.clear();
      this.tipBgGraphic.setVisible(false);
      this.tipText.setVisible(false);

      const pageY = boxH / 2 - 20;
      this.prevPageContainer.setPosition(-76, pageY);
      this.pageInfoText.setPosition(0, pageY);
      this.nextPageContainer.setPosition(76, pageY);
    } else {
      // Split Two-Column on Desktop 800x600
      const bodyHeaderY = balY + balH + 12;
      const leftColW = 390;
      const rightColLeft = leftEdge + leftColW + 16;
      const rightColW = rightEdge - rightColLeft;

      this.itemsHeaderText.setFontSize(11);
      this.itemsHeaderText.setPosition(leftEdge, bodyHeaderY);
      this.forgeHeaderText.setFontSize(11);
      this.forgeHeaderText.setPosition(rightColLeft, bodyHeaderY);

      const listTop = bodyHeaderY + 18;
      const rowH = 84;
      const leftCenterX = leftEdge + leftColW / 2;
      this.itemRows.forEach((row, idx) => {
        const cy = listTop + idx * (rowH + 8) + rowH / 2;
        this.layoutItemRow(row, leftCenterX, cy, leftColW, rowH, false);
      });

      this.emptyItemsText.setPosition(leftCenterX, listTop + 150);

      const rightCenterX = rightColLeft + rightColW / 2;
      const forgeH = 124;
      this.forgeCards.forEach((card, idx) => {
        const cy = listTop + idx * (forgeH + 10) + forgeH / 2;
        this.layoutForgeCard(card, rightCenterX, cy, rightColW, forgeH, false);
      });

      const tipY = listTop + forgeH * MAX_FORGE_CARDS + 26;
      const tipH = 82;
      this.tipBgGraphic.setVisible(true);
      this.drawChamferedBox(
        this.tipBgGraphic,
        rightColLeft,
        tipY,
        rightColW,
        tipH,
        6,
        PALETTE.BG_SURFACE,
        0.92,
        PALETTE.BORDER_STEEL,
        1.2
      );

      this.tipText.setVisible(true);
      this.tipText.setFontSize(10);
      this.tipText.setWordWrapWidth(rightColW - 18);
      this.tipText.setPosition(rightColLeft + 9, tipY + 10);
      this.setTextClamped(
        this.tipText,
        dialoguesData.entries.blacksmith_intro.shortText,
        4
      );

      const pageY = boxH / 2 - 22;
      this.prevPageContainer.setPosition(leftCenterX - 78, pageY);
      this.pageInfoText.setPosition(leftCenterX, pageY);
      this.nextPageContainer.setPosition(leftCenterX + 78, pageY);
    }

    this.renderSnapshot();
  }

  public destroy(): void {
    this.scene.input.keyboard?.off('keydown', this.keydownHandler);
    this.rootContainer.destroy();
  }

  private getPageSize(): number {
    return this.viewport.mode === 'mobile_portrait' ? 3 : 4;
  }

  private getTotalPages(): number {
    const pageSize = this.getPageSize();
    return Math.max(1, Math.ceil(this.lastSnapshot.items.length / pageSize));
  }

  private layoutItemRow(
    row: BlacksmithItemRowView,
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
    const top = -h / 2 + 7;
    const bottom = h / 2 - 8;

    const btnW = isMobile ? 86 : 94;
    const btnH = isMobile ? 26 : 28;
    row.container.setData('btnW', btnW);
    row.container.setData('btnH', btnH);
    row.container.setData('leftX', left);
    row.container.setData('topY', top);

    const iconSize = isMobile ? 18 : 22;
    row.slotIcon?.setPosition(left + iconSize / 2, top + iconSize / 2);
    row.slotIcon?.setDisplaySize(iconSize, iconSize);

    row.nameText.setFontSize(isMobile ? 10 : 11);
    row.levelText.setFontSize(isMobile ? 10 : 11);
    row.levelText.setPosition(right, top);

    row.statsText.setFontSize(isMobile ? 9 : 10);
    row.costText.setFontSize(isMobile ? 9 : 10);
    row.costText.setPosition(left, bottom - 14);

    row.btnContainer.setPosition(right - btnW / 2, bottom - btnH / 2 + 1);
    row.btnZone.setSize(btnW, btnH);
  }

  private layoutForgeCard(
    card: ForgeCardView,
    cx: number,
    cy: number,
    w: number,
    h: number,
    isMobile: boolean
  ): void {
    card.container.setPosition(cx, cy);
    card.container.setData('cardW', w);
    card.container.setData('cardH', h);

    const left = -w / 2 + 10;
    const right = w / 2 - 10;
    const top = -h / 2 + 7;
    const bottom = h / 2 - 7;

    const btnW = isMobile ? 76 : 96;
    const btnH = isMobile ? 26 : 28;
    card.container.setData('btnW', btnW);
    card.container.setData('btnH', btnH);
    card.container.setData('leftX', left);

    card.titleText.setFontSize(isMobile ? 10 : 11);
    card.titleText.setWordWrapWidth(w - 20);
    card.titleText.setPosition(left, top);

    const iconSize = isMobile ? 13 : 15;
    if (isMobile) {
      card.descText.setFontSize(9);
      card.descText.setWordWrapWidth(w - btnW - 24);
      card.descText.setPosition(left, top + 16);

      card.essenceIcon
        ?.setPosition(left + iconSize / 2, bottom - 7)
        .setDisplaySize(iconSize, iconSize);
      card.container.setData('costY', bottom - 13);

      card.costText.setFontSize(9);
      card.costText.setOrigin(0, 0);
      card.costText.setWordWrapWidth(w - btnW - 40);

      card.btnContainer.setPosition(right - btnW / 2, bottom - btnH / 2 + 1);
    } else {
      card.descText.setFontSize(10);
      card.descText.setWordWrapWidth(w - 20);
      card.descText.setPosition(left, top + 20);

      card.essenceIcon
        ?.setPosition(left + iconSize / 2, bottom - btnH / 2)
        .setDisplaySize(iconSize, iconSize);
      card.container.setData('costY', bottom - btnH / 2);

      card.costText.setFontSize(10);
      card.costText.setOrigin(0, 0.5);
      card.costText.setWordWrapWidth(w - btnW - 46);

      card.btnContainer.setPosition(right - btnW / 2, bottom - btnH / 2);
    }

    card.btnZone.setSize(btnW, btnH);
  }

  private renderSnapshot(): void {
    const snap = this.lastSnapshot;
    const isMobile = this.viewport.mode === 'mobile_portrait';

    this.soulsBalanceText.setText(`Almas: ${snap.souls}`);
    this.essenceBalanceText.setText(
      isMobile
        ? `Essências: ${snap.generalEssences}`
        : `Essências de General: ${snap.generalEssences}`
    );

    // Render Forge Cards
    for (let i = 0; i < this.forgeCards.length; i++) {
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

      const cardW = (card.container.getData('cardW') as number) || 280;
      const cardH = (card.container.getData('cardH') as number) || 74;
      const btnW = (card.container.getData('btnW') as number) || 76;
      const btnH = (card.container.getData('btnH') as number) || 26;
      const leftX = (card.container.getData('leftX') as number) ?? -cardW / 2 + 10;
      const costY = (card.container.getData('costY') as number) ?? 0;

      const rarityNum = RARITY_NUM[recipe.rarity];
      const rarityHex = RARITY_HEX[recipe.rarity];

      this.drawChamferedBox(
        card.bg,
        -cardW / 2,
        -cardH / 2,
        cardW,
        cardH,
        6,
        PALETTE.BG_SURFACE,
        0.95,
        canAfford ? rarityNum : PALETTE.BORDER_STEEL,
        1.5
      );

      this.setTextClamped(card.titleText, recipe.name, 1);
      card.titleText.setColor(rarityHex);

      this.setTextClamped(card.descText, recipe.description, isMobile ? 2 : 3);

      const hasEssenceIcon =
        recipe.essenceCost > 0 &&
        card.essenceIcon !== null &&
        this.hasTextureFrame(UI_ICONS_KEY, ICON_ESSENCE_FRAME);
      card.essenceIcon?.setVisible(hasEssenceIcon);
      card.costText.setPosition(
        leftX + (hasEssenceIcon ? (isMobile ? 17 : 19) : 0),
        costY
      );

      const costParts: string[] = [];
      if (recipe.essenceCost > 0) {
        costParts.push(`${recipe.essenceCost} Essência`);
      }
      if (recipe.soulCost > 0) {
        costParts.push(`${recipe.soulCost} Almas`);
      }
      card.costText.setText(`Custo: ${costParts.join(' + ')}`);
      card.costText.setColor(canAfford ? '#f0c46c' : '#f87171');

      this.drawChamferedButton(
        card.btnBg,
        btnW,
        btnH,
        5,
        canAfford ? PALETTE.FORGE_FILL : PALETTE.BG_DEEP,
        canAfford ? rarityNum : PALETTE.BORDER_STEEL
      );
      card.btnText.setColor(canAfford ? '#ffffff' : '#64748b');
    }

    // Render Item Upgrade List
    this.itemsHeaderText.setText(
      `APRIMORAR ITENS (${snap.items.length} — até +${snap.maxUpgradeLevel})`
    );
    this.emptyItemsText.setVisible(snap.items.length === 0);

    const pageSize = this.getPageSize();
    const totalPages = this.getTotalPages();
    const startIdx = this.itemPage * pageSize;
    const pageItems = snap.items.slice(startIdx, startIdx + pageSize);

    for (let i = 0; i < this.itemRows.length; i++) {
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

      const rowW = (row.container.getData('rowW') as number) || 308;
      const rowH = (row.container.getData('rowH') as number) || 84;
      const btnW = (row.container.getData('btnW') as number) || 86;
      const btnH = (row.container.getData('btnH') as number) || 26;
      const leftX = (row.container.getData('leftX') as number) ?? -rowW / 2 + 10;
      const topY = (row.container.getData('topY') as number) ?? -rowH / 2 + 7;

      const borderNum = RARITY_NUM[item.rarity];
      const borderHex = RARITY_HEX[item.rarity];

      this.drawChamferedBox(
        row.bg,
        -rowW / 2,
        -rowH / 2,
        rowW,
        rowH,
        6,
        PALETTE.BG_SURFACE,
        0.95,
        borderNum,
        1.5
      );

      const slotFrame = SLOT_ICON_FRAME[item.slot];
      const hasSlotIcon =
        row.slotIcon !== null &&
        this.hasTextureFrame(UI_ICONS_KEY, slotFrame);
      if (row.slotIcon) {
        row.slotIcon.setVisible(hasSlotIcon);
        if (hasSlotIcon) {
          row.slotIcon.setFrame(slotFrame);
        }
      }

      const iconOffset = hasSlotIcon ? (isMobile ? 23 : 27) : 0;
      row.nameText.setPosition(leftX + iconOffset, topY);
      row.nameText.setWordWrapWidth(rowW - 94 - iconOffset);
      row.statsText.setPosition(leftX + iconOffset, topY + 20);
      row.statsText.setWordWrapWidth(rowW - btnW - 24 - iconOffset);

      const suffix =
        level > 0 && !item.name.includes(`(+${level})`) ? ` (+${level})` : '';
      this.setTextClamped(
        row.nameText,
        `[${SLOT_LABELS[item.slot]}] ${item.name}${suffix}`,
        1
      );
      row.nameText.setColor(borderHex);

      row.levelText.setText(`+${level}/+${snap.maxUpgradeLevel}`);
      row.levelText.setColor(isMax ? '#f0c46c' : '#cbd5e1');

      const bonuses = this.formatItemBonuses(item, isMobile ? 2 : 3);
      const statsLine = `${FORCE_LABELS[item.force]} · ${bonuses || `Poder ${item.powerScore}`}`;
      this.setTextClamped(row.statsText, statsLine, isMobile ? 2 : 1);

      if (isMax) {
        row.costText.setText('Aprimoramento Máximo');
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
          PALETTE.UPGRADE_FILL,
          PALETTE.UPGRADE_STROKE
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

    // Pagination buttons
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
    const innerPts = this.getChamferPoints(
      x + 4,
      y + 4,
      w - 8,
      h - 8,
      Math.max(4, bevel - 3)
    );

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
    if (totals.attack) parts.push(`ATQ +${Math.round(totals.attack)}`);
    if (totals.maxHp) parts.push(`HP +${Math.round(totals.maxHp)}`);
    if (totals.defense) parts.push(`DEF +${Math.round(totals.defense)}`);
    if (totals.moveSpeed) parts.push(`VEL +${Math.round(totals.moveSpeed)}`);
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
