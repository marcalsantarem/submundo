import Phaser from 'phaser';
import {
  EquipSlot,
  EquippedGear,
  HeroStats,
  ItemInstance,
  ViewportConfig,
  resolveViewportConfig,
} from '../../core/index';
import {
  DF_EQUIP_SLOT_ORDER,
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
  drawSkullCrest,
  formatStatNumber,
  hasUiTextureFrame,
} from './DarkFantasyUiBuilder';
import { ItemTooltipCard, calculateItemPower } from './ItemTooltipCard';

export interface InventoryHudSnapshot {
  equipped: EquippedGear;
  bag: ItemInstance[];
  /** Capacidade do baú (opcional): habilita o aviso "Baú cheio". */
  bagCapacity?: number;
  heroStats: HeroStats;
  lifeSteal: number;
  cooldownReduction: number;
  luck: number;
  activeForces: Record<'inferno' | 'submundo' | 'empireo', number>;
}

interface EquipSlotCardView {
  slot: EquipSlot;
  container: Phaser.GameObjects.Container;
  boxBg: Phaser.GameObjects.Graphics;
  iconImage: Phaser.GameObjects.Image | null;
  fallbackIconText: Phaser.GameObjects.Text;
  slotLabelText: Phaser.GameObjects.Text;
  itemNameText: Phaser.GameObjects.Text;
  hitZone: Phaser.GameObjects.Zone;
  hovered: boolean;
}

interface BagCellView {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  iconImage: Phaser.GameObjects.Image | null;
  fallbackIconText: Phaser.GameObjects.Text;
  powerText: Phaser.GameObjects.Text;
  compareText: Phaser.GameObjects.Text;
  nameText: Phaser.GameObjects.Text;
  hitZone: Phaser.GameObjects.Zone;
  boundItem: ItemInstance | null;
  hovered: boolean;
}

// Grade 2 colunas x 3 linhas:
// Linha 1: ELMO | ARMA
// Linha 2: ARMADURA | AMULETO
// Linha 3: BOTA | ANEL
export const EQUIP_SLOT_ORDER: EquipSlot[] = [...DF_EQUIP_SLOT_ORDER];

const BAG_GRID_COLS = 4;
const BAG_GRID_ROWS = 4;
const BAG_PAGE_SIZE = BAG_GRID_COLS * BAG_GRID_ROWS; // 16 slots

export class InventoryModal {
  private readonly scene: Phaser.Scene;
  private readonly callbacks: {
    onEquipItem: (instanceId: string) => void;
    onUnequipSlot: (slot: EquipSlot) => void;
    onClose: () => void;
  };

  private viewport: ViewportConfig;
  private displayScale = 1;
  private opened = false;
  private bagPage = 0;
  private lastSnapshot: InventoryHudSnapshot;

  private readonly tooltipCard: ItemTooltipCard;
  private readonly rootContainer: Phaser.GameObjects.Container;
  private readonly backdropGraphic: Phaser.GameObjects.Graphics;
  private readonly backdropZone: Phaser.GameObjects.Zone;
  private readonly panelGraphic: Phaser.GameObjects.Graphics;
  private readonly statsBgGraphic: Phaser.GameObjects.Graphics;

  private readonly titleText: Phaser.GameObjects.Text;
  private readonly closeBtnContainer: Phaser.GameObjects.Container;
  private readonly closeBtnBg: Phaser.GameObjects.Graphics;
  private readonly closeBtnText: Phaser.GameObjects.Text;
  private readonly closeBtnZone: Phaser.GameObjects.Zone;

  private readonly equipmentSection: Phaser.GameObjects.Container;
  private readonly equipHeaderText: Phaser.GameObjects.Text;
  private readonly slotCards: EquipSlotCardView[] = [];
  private readonly statsPrimaryText: Phaser.GameObjects.Text;
  private readonly statsSecondaryText: Phaser.GameObjects.Text;

  private readonly bagSection: Phaser.GameObjects.Container;
  private readonly bagHeaderIcon: Phaser.GameObjects.Image | null;
  private readonly bagHeaderText: Phaser.GameObjects.Text;
  private readonly forcesLegendText: Phaser.GameObjects.Text;
  private readonly emptyBagText: Phaser.GameObjects.Text;
  private readonly bagCells: BagCellView[] = [];

  private readonly prevPageContainer: Phaser.GameObjects.Container;
  private readonly prevPageBg: Phaser.GameObjects.Graphics;
  private readonly prevPageText: Phaser.GameObjects.Text;
  private readonly prevPageZone: Phaser.GameObjects.Zone;

  private readonly nextPageContainer: Phaser.GameObjects.Container;
  private readonly nextPageBg: Phaser.GameObjects.Graphics;
  private readonly nextPageText: Phaser.GameObjects.Text;
  private readonly nextPageZone: Phaser.GameObjects.Zone;

  private readonly pageInfoText: Phaser.GameObjects.Text;
  private readonly keydownHandler: (event: KeyboardEvent) => void;

  private equipBoxSize = 70;
  private statsBoxWidth = 332;
  private statsBoxHeight = 82;
  private bagCellWidth = 108;
  private bagCellHeight = 80;

  constructor(
    scene: Phaser.Scene,
    callbacks: {
      onEquipItem: (instanceId: string) => void;
      onUnequipSlot: (slot: EquipSlot) => void;
      onClose: () => void;
    }
  ) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.viewport = resolveViewportConfig(
      scene.scale.width || 960,
      scene.scale.height || 540
    );
    this.tooltipCard = new ItemTooltipCard(scene);

    this.lastSnapshot = {
      equipped: {
        weapon: null,
        armor: null,
        helm: null,
        boots: null,
        amulet: null,
        ring: null,
      },
      bag: [],
      heroStats: {
        maxHp: 120,
        hp: 120,
        attack: 18,
        defense: 4,
        moveSpeed: 140,
        attackRange: 52,
        attackCooldownMs: 650,
        critChance: 0.1,
        critMultiplier: 1.5,
      },
      lifeSteal: 0,
      cooldownReduction: 0,
      luck: 0,
      activeForces: { inferno: 0, submundo: 0, empireo: 0 },
    };

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
      .text(0, 0, 'INVENTÁRIO & EQUIPAMENTO', {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '18px',
        color: DF_PALETTE.textGold,
        fontStyle: 'bold',
        letterSpacing: 2,
        resolution: 2,
      })
      .setOrigin(0.5, 0.5);

    // Botão X carmesim no canto superior direito
    this.closeBtnBg = scene.add.graphics();
    this.closeBtnText = scene.add
      .text(0, 0, 'X', {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '14px',
        color: DF_PALETTE.textParchment,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0.5, 0.5);
    this.closeBtnZone = scene.add
      .zone(0, 0, 32, 32)
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

    // Coluna Esquerda: Equipamento (6 slots 2x3 + Placa Ornamental de Atributos)
    this.equipmentSection = scene.add.container(0, 0);
    this.equipHeaderText = scene.add
      .text(0, 0, 'EQUIPAMENTO', {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '13px',
        color: DF_PALETTE.textGold,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0.5, 0.5);
    this.equipmentSection.add(this.equipHeaderText);

    for (const slot of DF_EQUIP_SLOT_ORDER) {
      const slotMeta = DF_SLOT_META[slot];
      const boxBg = scene.add.graphics();
      const iconImage = hasUiTextureFrame(
        scene,
        DF_UI_ICONS_KEY,
        slotMeta.iconFrame
      )
        ? scene.add
            .image(0, 0, DF_UI_ICONS_KEY, slotMeta.iconFrame)
            .setOrigin(0.5)
        : null;
      const fallbackIconText = scene.add
        .text(0, 0, slotMeta.labelUpper[0] ?? '?', {
          fontFamily: DF_FONTS.TITLE,
          fontSize: '20px',
          color: DF_PALETTE.textMuted,
          fontStyle: 'bold',
          resolution: 2,
        })
        .setOrigin(0.5);

      const slotLabelText = scene.add
        .text(0, 0, slotMeta.labelUpper, {
          fontFamily: DF_FONTS.BODY,
          fontSize: '11px',
          color: DF_PALETTE.textMuted,
          fontStyle: 'bold',
          resolution: 2,
        })
        .setOrigin(0.5);

      const itemNameText = scene.add
        .text(0, 0, slotMeta.labelTitle, {
          fontFamily: DF_FONTS.BODY,
          fontSize: '10px',
          color: DF_PALETTE.textMuted,
          resolution: 2,
        })
        .setOrigin(0.5);

      const hitZone = scene.add
        .zone(0, 0, 82, 98)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      const children: Phaser.GameObjects.GameObject[] = [boxBg];
      if (iconImage) {
        children.push(iconImage);
      }
      children.push(fallbackIconText, slotLabelText, itemNameText, hitZone);

      const cardContainer = scene.add.container(0, 0, children);
      const cardView: EquipSlotCardView = {
        slot,
        container: cardContainer,
        boxBg,
        iconImage,
        fallbackIconText,
        slotLabelText,
        itemNameText,
        hitZone,
        hovered: false,
      };

      hitZone.on('pointerover', () => {
        if (!this.opened) {
          return;
        }
        cardView.hovered = true;
        this.renderSingleEquippedSlot(cardView);
        if (this.tooltipCard.isPinned()) {
          return;
        }
        const equippedItem = this.lastSnapshot.equipped[slot];
        if (!equippedItem) {
          return;
        }
        this.tooltipCard.open(equippedItem, {
          isEquipped: true,
          equippedInSlot: equippedItem,
          pinned: false,
          hoverSide: 'right',
          onUnequip: (targetSlot) => {
            this.callbacks.onUnequipSlot(targetSlot);
          },
        });
      });

      hitZone.on('pointerout', () => {
        cardView.hovered = false;
        this.renderSingleEquippedSlot(cardView);
        if (this.tooltipCard.isOpen() && !this.tooltipCard.isPinned()) {
          this.tooltipCard.close();
        }
      });

      hitZone.on(
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
          const equippedItem = this.lastSnapshot.equipped[slot];
          if (!equippedItem) {
            return;
          }
          this.tooltipCard.open(equippedItem, {
            isEquipped: true,
            equippedInSlot: equippedItem,
            pinned: true,
            onUnequip: (targetSlot) => {
              this.callbacks.onUnequipSlot(targetSlot);
            },
          });
        }
      );

      this.slotCards.push(cardView);
      this.equipmentSection.add(cardContainer);
    }

    this.statsBgGraphic = scene.add.graphics();
    this.statsPrimaryText = scene.add
      .text(0, 0, '', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '12px',
        color: DF_PALETTE.textParchment,
        fontStyle: 'bold',
        align: 'center',
        lineSpacing: 3,
        resolution: 2,
      })
      .setOrigin(0.5, 0.5);
    this.statsSecondaryText = scene.add
      .text(0, 0, '', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '10px',
        color: DF_PALETTE.textMuted,
        align: 'center',
        resolution: 2,
      })
      .setOrigin(0.5, 0.5);

    this.equipmentSection.add([
      this.statsBgGraphic,
      this.statsPrimaryText,
      this.statsSecondaryText,
    ]);

    // Coluna Direita: Mochila (Grade 4x4 = 16 slots + paginação + legenda das 3 Forças)
    this.bagSection = scene.add.container(0, 0);
    this.bagHeaderIcon = hasUiTextureFrame(
      scene,
      DF_UI_ICONS_KEY,
      DF_UI_ICON_FRAMES.bag
    )
      ? scene.add
          .image(0, 0, DF_UI_ICONS_KEY, DF_UI_ICON_FRAMES.bag)
          .setOrigin(0.5)
      : null;
    this.bagHeaderText = scene.add
      .text(0, 0, 'MOCHILA (0)', {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '13px',
        color: DF_PALETTE.textGold,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0, 0.5);
    this.forcesLegendText = scene.add
      .text(0, 0, '', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '10px',
        color: DF_PALETTE.textLight,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(1, 0.5);
    this.emptyBagText = scene.add
      .text(0, 0, 'Mochila vazia.\nDerrote monstros para obter itens.', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '12px',
        color: DF_PALETTE.textMuted,
        align: 'center',
        resolution: 2,
      })
      .setOrigin(0.5);

    if (this.bagHeaderIcon) {
      this.bagSection.add(this.bagHeaderIcon);
    }
    this.bagSection.add([
      this.bagHeaderText,
      this.forcesLegendText,
      this.emptyBagText,
    ]);

    for (let i = 0; i < BAG_PAGE_SIZE; i += 1) {
      const bg = scene.add.graphics();
      const iconImage = hasUiTextureFrame(
        scene,
        DF_UI_ICONS_KEY,
        DF_SLOT_META.weapon.iconFrame
      )
        ? scene.add
            .image(0, 0, DF_UI_ICONS_KEY, DF_SLOT_META.weapon.iconFrame)
            .setOrigin(0.5)
        : null;
      const fallbackIconText = scene.add
        .text(0, 0, '?', {
          fontFamily: DF_FONTS.TITLE,
          fontSize: '18px',
          color: DF_PALETTE.textLight,
          fontStyle: 'bold',
          resolution: 2,
        })
        .setOrigin(0.5);
      const powerText = scene.add
        .text(0, 0, '', {
          fontFamily: DF_FONTS.TITLE,
          fontSize: '10px',
          color: DF_PALETTE.textParchment,
          fontStyle: 'bold',
          resolution: 2,
        })
        .setOrigin(0, 0.5);
      const compareText = scene.add
        .text(0, 0, '', {
          fontFamily: DF_FONTS.BODY,
          fontSize: '11px',
          color: DF_PALETTE.textSuccess,
          fontStyle: 'bold',
          resolution: 2,
        })
        .setOrigin(1, 0.5);
      const nameText = scene.add
        .text(0, 0, '', {
          fontFamily: DF_FONTS.BODY,
          fontSize: '10px',
          color: DF_PALETTE.textLight,
          align: 'center',
          resolution: 2,
        })
        .setOrigin(0.5, 0.5);
      const hitZone = scene.add
        .zone(0, 0, 108, 80)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      const cellChildren: Phaser.GameObjects.GameObject[] = [bg];
      if (iconImage) {
        cellChildren.push(iconImage);
      }
      cellChildren.push(
        fallbackIconText,
        powerText,
        compareText,
        nameText,
        hitZone
      );
      const cellContainer = scene.add.container(0, 0, cellChildren);

      const cellView: BagCellView = {
        container: cellContainer,
        bg,
        iconImage,
        fallbackIconText,
        powerText,
        compareText,
        nameText,
        hitZone,
        boundItem: null,
        hovered: false,
      };

      hitZone.on('pointerover', () => {
        if (!this.opened || !cellView.boundItem) {
          return;
        }
        cellView.hovered = true;
        this.renderSingleBagCell(cellView);
        if (this.tooltipCard.isPinned()) {
          return;
        }
        const item = cellView.boundItem;
        this.tooltipCard.open(item, {
          isEquipped: false,
          equippedInSlot: this.lastSnapshot.equipped[item.slot],
          pinned: false,
          hoverSide: 'left',
          onEquip: (instanceId) => {
            this.callbacks.onEquipItem(instanceId);
          },
        });
      });

      hitZone.on('pointerout', () => {
        cellView.hovered = false;
        this.renderSingleBagCell(cellView);
        if (this.tooltipCard.isOpen() && !this.tooltipCard.isPinned()) {
          this.tooltipCard.close();
        }
      });

      hitZone.on(
        'pointerdown',
        (
          _pointer: Phaser.Input.Pointer,
          _lx: number,
          _ly: number,
          event?: Phaser.Types.Input.EventData
        ) => {
          event?.stopPropagation?.();
          if (!this.opened || !cellView.boundItem) {
            return;
          }
          const item = cellView.boundItem;
          this.tooltipCard.open(item, {
            isEquipped: false,
            equippedInSlot: this.lastSnapshot.equipped[item.slot],
            pinned: true,
            onEquip: (instanceId) => {
              this.callbacks.onEquipItem(instanceId);
            },
          });
        }
      );

      this.bagCells.push(cellView);
      this.bagSection.add(cellContainer);
    }

    // Paginação da Mochila
    this.prevPageBg = scene.add.graphics();
    this.prevPageText = scene.add
      .text(0, 0, '◄ Anterior', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '11px',
        color: DF_PALETTE.textParchment,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0.5);
    this.prevPageZone = scene.add
      .zone(0, 0, 96, 28)
      .setOrigin(0.5)
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
        if (!this.opened || this.bagPage <= 0) {
          return;
        }
        this.bagPage -= 1;
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
      .text(0, 0, 'Próxima ►', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '11px',
        color: DF_PALETTE.textParchment,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0.5);
    this.nextPageZone = scene.add
      .zone(0, 0, 96, 28)
      .setOrigin(0.5)
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
        const totalPages = this.getTotalPages();
        if (!this.opened || this.bagPage >= totalPages - 1) {
          return;
        }
        this.bagPage += 1;
        this.renderSnapshot();
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
      .setOrigin(0.5);

    this.bagSection.add([
      this.prevPageContainer,
      this.nextPageContainer,
      this.pageInfoText,
    ]);

    this.rootContainer = scene.add
      .container(this.viewport.width / 2, this.viewport.height / 2, [
        this.backdropGraphic,
        this.backdropZone,
        this.panelGraphic,
        this.titleText,
        this.closeBtnContainer,
        this.equipmentSection,
        this.bagSection,
      ])
      .setScrollFactor(0)
      .setDepth(1080)
      .setVisible(false);

    this.keydownHandler = (event: KeyboardEvent) => {
      if (!this.opened) {
        return;
      }
      if (event.code === 'Escape') {
        if (this.tooltipCard.isOpen()) {
          this.tooltipCard.close();
          return;
        }
        this.close();
        this.callbacks.onClose();
      }
    };
    scene.input.keyboard?.on('keydown', this.keydownHandler);

    this.resize(this.viewport);
  }

  public open(snapshot: InventoryHudSnapshot): void {
    this.opened = true;
    this.bagPage = 0;
    this.rootContainer.setVisible(true);
    this.update(snapshot);
  }

  public close(): void {
    this.opened = false;
    this.tooltipCard.close();
    this.rootContainer.setVisible(false);
  }

  public isOpen(): boolean {
    return this.opened;
  }

  public update(snapshot: InventoryHudSnapshot): void {
    this.lastSnapshot = snapshot;
    const totalPages = this.getTotalPages();
    if (this.bagPage >= totalPages) {
      this.bagPage = Math.max(0, totalPages - 1);
    }
    this.renderSnapshot();
  }

  /** Reduz o modal para caber em telas menores (ex.: menu-hub mobile 844x390). */
  public setDisplayScale(scale: number): void {
    this.displayScale = Math.max(0.3, Math.min(1, scale));
    this.resize(this.viewport);
  }

  public resize(viewport: ViewportConfig): void {
    this.viewport = viewport;
    this.tooltipCard.resize(viewport);

    const w = viewport.width / this.displayScale;
    const h = viewport.height / this.displayScale;

    this.rootContainer.setPosition(viewport.width / 2, viewport.height / 2);
    this.rootContainer.setScale(this.displayScale);

    this.backdropGraphic.clear();
    this.backdropGraphic.fillStyle(0x04060a, 0.84);
    this.backdropGraphic.fillRect(-w / 2, -h / 2, w, h);
    this.backdropZone.setSize(w, h);

    // Painel Paisagem Amplo 880x486 centralizado em 960x540
    const panelW = Math.min(880, w - 24);
    const panelH = Math.min(486, h - 24);
    const headerH = 42;

    const innerPadX = 18;
    const leftColW = Math.min(360, Math.round((panelW - innerPadX * 2) * 0.42));
    const dividerX = -panelW / 2 + innerPadX + leftColW + 10;
    const leftCenterX = -panelW / 2 + innerPadX + leftColW / 2;
    const rightColLeft = dividerX + 14;
    const rightColW = panelW / 2 - innerPadX - rightColLeft;
    const rightCenterX = rightColLeft + rightColW / 2;

    this.drawPanelFrame(panelW, panelH, headerH, dividerX);

    this.titleText.setPosition(0, -panelH / 2 + headerH / 2 + 4);

    this.closeBtnContainer.setPosition(
      panelW / 2 - 26,
      -panelH / 2 + headerH / 2 + 4
    );
    this.drawCloseButton(false);

    // Coluna Esquerda: EQUIPAMENTO (2x3 slots 70x70 + Placa de Atributos com crânio)
    this.equipmentSection.setPosition(leftCenterX, 0);
    const contentTopY = -panelH / 2 + headerH + 18;
    this.equipHeaderText.setPosition(0, contentTopY);

    this.equipBoxSize = 70;
    const colOffset = Math.min(82, Math.floor(leftColW * 0.24));
    const row1Y = contentTopY + 58;
    const row2Y = row1Y + 104;
    const row3Y = row2Y + 104;

    const coords: Array<{ x: number; y: number }> = [
      { x: -colOffset, y: row1Y },
      { x: colOffset, y: row1Y },
      { x: -colOffset, y: row2Y },
      { x: colOffset, y: row2Y },
      { x: -colOffset, y: row3Y },
      { x: colOffset, y: row3Y },
    ];
    this.positionEquipCards(coords);

    this.statsBoxWidth = Math.min(336, leftColW - 14);
    this.statsBoxHeight = 82;
    const statsY = panelH / 2 - this.statsBoxHeight / 2 - 14;
    this.positionStatsPanel(0, statsY);

    // Coluna Direita: MOCHILA (4x4 = 16 slots + legenda das 3 Forças + paginação)
    this.bagSection.setPosition(rightCenterX, 0);
    const bagTopY = contentTopY;
    if (this.bagHeaderIcon) {
      this.bagHeaderIcon
        .setPosition(-rightColW / 2 + 10, bagTopY)
        .setDisplaySize(18, 18);
      this.bagHeaderText.setPosition(-rightColW / 2 + 26, bagTopY);
    } else {
      this.bagHeaderText.setPosition(-rightColW / 2 + 2, bagTopY);
    }
    this.forcesLegendText.setPosition(rightColW / 2 - 2, bagTopY);

    const gap = 8;
    const pagY = panelH / 2 - 26;
    const gridTopEdge = bagTopY + 18;
    const gridBottomEdge = pagY - 22;
    const availableGridH = Math.max(240, gridBottomEdge - gridTopEdge);

    this.bagCellWidth = Math.floor(
      (rightColW - gap * (BAG_GRID_COLS - 1)) / BAG_GRID_COLS
    );
    this.bagCellHeight = Math.floor(
      (availableGridH - gap * (BAG_GRID_ROWS - 1)) / BAG_GRID_ROWS
    );
    const gridFirstRowCenterY = gridTopEdge + this.bagCellHeight / 2;
    this.positionBagGrid(0, gridFirstRowCenterY, gap);

    this.positionPagination(0, pagY, rightColW);
    this.emptyBagText.setPosition(
      0,
      gridTopEdge + availableGridH / 2
    );

    this.renderSnapshot();
  }

  public destroy(): void {
    this.scene.input.keyboard?.off('keydown', this.keydownHandler);
    this.tooltipCard.destroy();
    this.rootContainer.destroy(true);
  }

  private positionEquipCards(coords: Array<{ x: number; y: number }>): void {
    const half = this.equipBoxSize / 2;
    this.slotCards.forEach((card, idx) => {
      const pos = coords[idx] ?? { x: 0, y: 0 };
      card.container.setPosition(pos.x, pos.y);
      card.slotLabelText.setPosition(0, -half - 11);
      card.itemNameText.setPosition(0, half + 11);
      if (card.iconImage) {
        card.iconImage
          .setPosition(0, 0)
          .setDisplaySize(this.equipBoxSize - 16, this.equipBoxSize - 16);
      }
      card.fallbackIconText.setPosition(0, 0);
      card.hitZone
        .setPosition(0, 0)
        .setSize(this.equipBoxSize + 14, this.equipBoxSize + 28);
    });
  }

  private positionStatsPanel(x: number, y: number): void {
    this.drawStatsFrame(x, y, this.statsBoxWidth, this.statsBoxHeight);
    this.statsPrimaryText.setPosition(x, y - 4);
    this.statsSecondaryText.setPosition(x, y + this.statsBoxHeight / 2 - 12);
  }

  private positionBagGrid(
    centerX: number,
    firstRowY: number,
    gap: number
  ): void {
    const stepX = this.bagCellWidth + gap;
    const stepY = this.bagCellHeight + gap;
    const iconSize = Math.min(40, this.bagCellHeight - 34, this.bagCellWidth - 28);

    for (let i = 0; i < this.bagCells.length; i += 1) {
      const col = i % BAG_GRID_COLS;
      const row = Math.floor(i / BAG_GRID_COLS);
      const cx = centerX + (col - (BAG_GRID_COLS - 1) / 2) * stepX;
      const cy = firstRowY + row * stepY;

      const cell = this.bagCells[i];
      cell.container.setPosition(cx, cy);
      if (cell.iconImage) {
        cell.iconImage.setPosition(0, -2).setDisplaySize(iconSize, iconSize);
      }
      cell.fallbackIconText.setPosition(0, -2);
      cell.powerText.setPosition(
        -this.bagCellWidth / 2 + 7,
        -this.bagCellHeight / 2 + 11
      );
      cell.compareText.setPosition(
        this.bagCellWidth / 2 - 7,
        -this.bagCellHeight / 2 + 11
      );
      cell.nameText.setPosition(0, this.bagCellHeight / 2 - 11);
      cell.hitZone.setSize(this.bagCellWidth, this.bagCellHeight);
    }
  }

  private positionPagination(centerX: number, y: number, width: number): void {
    const btnW = 96;
    const btnH = 28;
    const edgeOffset = Math.max(btnW / 2 + 32, width / 2 - btnW / 2);

    this.prevPageContainer.setPosition(centerX - edgeOffset, y);
    this.prevPageZone.setSize(btnW, btnH);
    this.nextPageContainer.setPosition(centerX + edgeOffset, y);
    this.nextPageZone.setSize(btnW, btnH);
    this.pageInfoText.setPosition(centerX, y);
  }

  private renderSnapshot(): void {
    this.renderEquippedSlots();
    this.renderStatsPanel();
    this.renderBagGrid();
  }

  private renderEquippedSlots(): void {
    for (const card of this.slotCards) {
      this.renderSingleEquippedSlot(card);
    }
  }

  private renderSingleEquippedSlot(card: EquipSlotCardView): void {
    const item = this.lastSnapshot.equipped[card.slot];
    const slotMeta = DF_SLOT_META[card.slot];
    const boxSize = this.equipBoxSize;
    const half = boxSize / 2;

    if (item) {
      const rarityTheme = DF_RARITY_THEME[item.rarity];
      const gemColor =
        item.force !== 'none'
          ? DF_FORCE_THEME[item.force].color
          : rarityTheme.gemColor;

      drawRaritySlotFrame(card.boxBg, {
        x: -half,
        y: -half,
        width: boxSize,
        height: boxSize,
        rarity: item.rarity,
        bevel: 6,
        hovered: card.hovered,
        gemColor,
        showTopGem: true,
        showCornerGem: true,
        clear: true,
      });

      if (card.iconImage) {
        card.iconImage.setVisible(true).setAlpha(1).clearTint();
        card.fallbackIconText.setVisible(false);
      } else {
        card.fallbackIconText.setVisible(true).setColor(rarityTheme.hex);
      }

      card.slotLabelText
        .setText(slotMeta.labelUpper)
        .setColor(rarityTheme.hex);
      card.itemNameText
        .setText(this.truncateName(item.name, 14))
        .setColor(rarityTheme.accentHex);
    } else {
      drawRaritySlotFrame(card.boxBg, {
        x: -half,
        y: -half,
        width: boxSize,
        height: boxSize,
        rarity: null,
        empty: true,
        bevel: 6,
        hovered: card.hovered,
        showTopGem: true,
        showCornerGem: true,
        clear: true,
      });

      if (card.iconImage) {
        card.iconImage.setVisible(true).setAlpha(0.24).setTint(0x64748b);
        card.fallbackIconText.setVisible(false);
      } else {
        card.fallbackIconText.setVisible(true).setColor(DF_PALETTE.textMuted);
      }

      card.slotLabelText
        .setText(slotMeta.labelUpper)
        .setColor(DF_PALETTE.textMuted);
      card.itemNameText
        .setText(slotMeta.labelTitle)
        .setColor(DF_PALETTE.textMuted);
    }
  }

  private renderStatsPanel(): void {
    const s = this.lastSnapshot.heroStats;
    const f = this.lastSnapshot.activeForces;
    const critPct = Math.round(s.critChance * 100);
    const lsPct = Math.round(this.lastSnapshot.lifeSteal * 100);
    const cdrPct = Math.round(this.lastSnapshot.cooldownReduction * 100);

    this.statsPrimaryText.setText(
      `Poder de Ataque: ${formatStatNumber(s.attack)}\n` +
        `Armadura: ${formatStatNumber(s.defense)}   ·   Vida: ${formatStatNumber(s.maxHp)}`
    );

    const extraParts = [`Crítico: ${critPct}%`];
    if (lsPct > 0) {
      extraParts.push(`Roubo: ${lsPct}%`);
    }
    if (cdrPct > 0) {
      extraParts.push(`Recarga: -${cdrPct}%`);
    }
    this.statsSecondaryText.setText(extraParts.join('  ·  '));

    this.forcesLegendText.setText(
      `${DF_FORCE_THEME.inferno.label} ${f.inferno}  ·  ${DF_FORCE_THEME.submundo.label} ${f.submundo}  ·  ${DF_FORCE_THEME.empireo.label} ${f.empireo}`
    );
  }

  private renderBagGrid(): void {
    const totalItems = this.lastSnapshot.bag.length;
    const cap = this.lastSnapshot.bagCapacity;
    if (cap !== undefined && totalItems >= cap) {
      this.bagHeaderText.setText(`MOCHILA (${totalItems}/${cap}) · BAÚ CHEIO`);
      this.bagHeaderText.setColor('#ff6b5a').setFontSize(16);
    } else {
      this.bagHeaderText.setText(`MOCHILA (${totalItems})`);
      this.bagHeaderText.setColor(DF_PALETTE.textGold).setFontSize(13);
    }

    const totalPages = this.getTotalPages();
    const startIdx = this.bagPage * BAG_PAGE_SIZE;
    const pageItems = this.lastSnapshot.bag.slice(
      startIdx,
      startIdx + BAG_PAGE_SIZE
    );

    this.emptyBagText.setVisible(totalItems === 0);

    for (let i = 0; i < this.bagCells.length; i += 1) {
      const cell = this.bagCells[i];
      cell.boundItem = pageItems[i] ?? null;
      this.renderSingleBagCell(cell);
    }

    const showPagination = totalPages > 1;
    this.prevPageContainer.setVisible(showPagination);
    this.nextPageContainer.setVisible(showPagination);
    this.pageInfoText.setVisible(showPagination);

    if (showPagination) {
      this.pageInfoText.setText(`${this.bagPage + 1}/${totalPages}`);
      this.drawPaginationButton(
        this.prevPageBg,
        this.prevPageText,
        this.bagPage > 0
      );
      this.drawPaginationButton(
        this.nextPageBg,
        this.nextPageText,
        this.bagPage < totalPages - 1
      );
    }
  }

  private renderSingleBagCell(cell: BagCellView): void {
    const item = cell.boundItem;
    const totalItems = this.lastSnapshot.bag.length;
    const halfW = this.bagCellWidth / 2;
    const halfH = this.bagCellHeight / 2;

    if (!item) {
      cell.container.setVisible(totalItems > 0);
      drawRaritySlotFrame(cell.bg, {
        x: -halfW,
        y: -halfH,
        width: this.bagCellWidth,
        height: this.bagCellHeight,
        rarity: null,
        empty: true,
        bevel: 5,
        fillColor: DF_PALETTE.deepRecess,
        showTopGem: false,
        showCornerGem: false,
        clear: true,
      });
      cell.iconImage?.setVisible(false);
      cell.fallbackIconText.setVisible(false);
      cell.powerText.setVisible(false);
      cell.compareText.setVisible(false);
      cell.nameText.setVisible(false);
      return;
    }

    cell.container.setVisible(true);
    const rarityTheme = DF_RARITY_THEME[item.rarity];
    const slotMeta = DF_SLOT_META[item.slot];
    const gemColor =
      item.force !== 'none'
        ? DF_FORCE_THEME[item.force].color
        : rarityTheme.gemColor;

    drawRaritySlotFrame(cell.bg, {
      x: -halfW,
      y: -halfH,
      width: this.bagCellWidth,
      height: this.bagCellHeight,
      rarity: item.rarity,
      bevel: 5,
      hovered: cell.hovered,
      gemColor,
      showTopGem: false,
      showCornerGem: true,
      clear: true,
    });

    if (
      cell.iconImage &&
      hasUiTextureFrame(this.scene, DF_UI_ICONS_KEY, slotMeta.iconFrame)
    ) {
      cell.iconImage.setFrame(slotMeta.iconFrame).setVisible(true);
      cell.fallbackIconText.setVisible(false);
    } else {
      cell.iconImage?.setVisible(false);
      cell.fallbackIconText
        .setText(slotMeta.labelUpper[0] ?? '?')
        .setColor(rarityTheme.hex)
        .setVisible(true);
    }

    const itemPower = calculateItemPower(item);
    cell.powerText
      .setText(formatStatNumber(itemPower))
      .setColor(DF_PALETTE.textParchment)
      .setVisible(true);

    const equipped = this.lastSnapshot.equipped[item.slot];
    const eqPower = equipped ? calculateItemPower(equipped) : 0;
    const delta = itemPower - eqPower;
    if (!equipped || delta > 0) {
      cell.compareText
        .setText('▲')
        .setColor(DF_PALETTE.textSuccess)
        .setVisible(true);
    } else if (delta < 0) {
      cell.compareText
        .setText('▼')
        .setColor(DF_PALETTE.textDanger)
        .setVisible(true);
    } else {
      cell.compareText
        .setText('=')
        .setColor(DF_PALETTE.textMuted)
        .setVisible(true);
    }

    cell.nameText
      .setText(this.truncateName(item.name, 13))
      .setColor(rarityTheme.hex)
      .setVisible(true);
  }

  private drawPanelFrame(
    panelW: number,
    panelH: number,
    headerH: number,
    dividerX: number
  ): void {
    const left = -panelW / 2;
    const top = -panelH / 2;

    drawOrnatePanel(this.panelGraphic, {
      x: left,
      y: top,
      width: panelW,
      height: panelH,
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
      headerGlowAlpha: 0.14,
      shadow: true,
      cornerOrnaments: true,
      clear: true,
    });

    // Divisória vertical ornamental separando Equipamento (esquerda) e Mochila (direita)
    const divTop = top + headerH + 14;
    const divBottom = top + panelH - 16;
    this.panelGraphic.lineStyle(1.4, DF_PALETTE.bronzeDark, 0.9);
    this.panelGraphic.lineBetween(dividerX, divTop, dividerX, divBottom);
    this.panelGraphic.lineStyle(0.8, DF_PALETTE.agedGold, 0.35);
    this.panelGraphic.lineBetween(
      dividerX + 1.5,
      divTop + 12,
      dividerX + 1.5,
      divBottom - 12
    );

    // Divisória horizontal sutil sob o cabeçalho da coluna direita
    drawOrnamentalDivider(
      this.panelGraphic,
      dividerX + 14,
      top + headerH + 31,
      panelW / 2 - 18 - (dividerX + 14)
    );
  }

  private drawStatsFrame(x: number, y: number, w: number, h: number): void {
    const left = x - w / 2;
    const top = y - h / 2;

    drawOrnatePanel(this.statsBgGraphic, {
      x: left,
      y: top,
      width: w,
      height: h,
      bevel: 8,
      fillColor: DF_PALETTE.deepRecess,
      fillAlpha: 0.96,
      innerFillColor: DF_PALETTE.obsidianBg,
      outerBorderColor: DF_PALETTE.bronzeBorder,
      innerBorderColor: DF_PALETTE.bronzeDark,
      accentColor: DF_PALETTE.agedGold,
      shadow: false,
      cornerOrnaments: false,
      clear: true,
    });

    // Crânio ornamental coroando o topo central da placa de atributos
    drawSkullCrest(this.statsBgGraphic, x, top + 1, 0.9);
  }

  private drawCloseButton(hovered: boolean): void {
    drawOrnateButton(this.closeBtnBg, -16, -16, 32, 32, {
      variant: 'crimson',
      bevel: 5,
      hovered,
      clear: true,
    });
  }

  private drawPaginationButton(
    gfx: Phaser.GameObjects.Graphics,
    text: Phaser.GameObjects.Text,
    enabled: boolean
  ): void {
    drawOrnateButton(gfx, -48, -14, 96, 28, {
      variant: 'iron',
      bevel: 5,
      disabled: !enabled,
      clear: true,
    });
    text.setColor(enabled ? DF_PALETTE.textParchment : DF_PALETTE.textMuted);
  }

  private getTotalPages(): number {
    return Math.max(1, Math.ceil(this.lastSnapshot.bag.length / BAG_PAGE_SIZE));
  }

  private truncateName(name: string, maxLen: number): string {
    if (name.length <= maxLen) {
      return name;
    }
    return `${name.slice(0, Math.max(1, maxLen - 1))}…`;
  }
}
