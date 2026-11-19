import Phaser from 'phaser';
import {
  EquipSlot,
  EquippedGear,
  ForceType,
  HeroStats,
  ItemInstance,
  Rarity,
  ViewportConfig,
  resolveViewportConfig,
} from '../../core/index';
import {
  FONT_BODY,
  FONT_TITLE,
  ItemTooltipCard,
  SLOT_ICON_FRAME,
  calculateItemPower,
} from './ItemTooltipCard';

export interface InventoryHudSnapshot {
  equipped: EquippedGear;
  bag: ItemInstance[];
  heroStats: HeroStats;
  lifeSteal: number;
  cooldownReduction: number;
  luck: number;
  activeForces: Record<'inferno' | 'submundo' | 'empireo', number>;
}

type MobileTab = 'equipment' | 'bag';

interface EquipSlotCardView {
  slot: EquipSlot;
  container: Phaser.GameObjects.Container;
  boxBg: Phaser.GameObjects.Graphics;
  iconImage: Phaser.GameObjects.Image | null;
  fallbackIconText: Phaser.GameObjects.Text;
  slotLabelText: Phaser.GameObjects.Text;
  itemNameText: Phaser.GameObjects.Text;
  hitZone: Phaser.GameObjects.Zone;
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
}

// Grade 2 colunas x 3 linhas conforme ref_diablo_equipment_panel.jpg:
// Linha 1: ELMO | ARMA
// Linha 2: ARMADURA | AMULETO
// Linha 3: BOTA | ANEL
export const EQUIP_SLOT_ORDER: EquipSlot[] = [
  'helm',
  'weapon',
  'armor',
  'amulet',
  'boots',
  'ring',
];

const SLOT_LABELS: Record<EquipSlot, string> = {
  helm: 'ELMO',
  weapon: 'ARMA',
  armor: 'ARMADURA',
  amulet: 'AMULETO',
  boots: 'BOTA',
  ring: 'ANEL',
};

const SLOT_SUBLABELS: Record<EquipSlot, string> = {
  helm: 'Elmo',
  weapon: 'Arma',
  armor: 'Armadura',
  amulet: 'Amuleto',
  boots: 'Bota',
  ring: 'Anel',
};

const RARITY_HEX: Record<Rarity, string> = {
  common: '#94a3b8',
  magic: '#60a5fa',
  rare: '#facc15',
  legendary: '#f97316',
};

const RARITY_NUM: Record<Rarity, number> = {
  common: 0x94a3b8,
  magic: 0x60a5fa,
  rare: 0xfacc15,
  legendary: 0xf97316,
};

const RARITY_FILL: Record<Rarity, number> = {
  common: 0x1a202c,
  magic: 0x14253d,
  rare: 0x2f2811,
  legendary: 0x3b1c0e,
};

const FORCE_NUM: Record<ForceType, number> = {
  inferno: 0xf97316,
  submundo: 0xfb7185,
  empireo: 0xfde047,
  none: 0x64748b,
};

const UI_ICONS_KEY = 'ui_icons';
const BAG_ICON_FRAME = 6;

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
  private opened = false;
  private mobileTab: MobileTab = 'equipment';
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

  private readonly tabsContainer: Phaser.GameObjects.Container;
  private readonly tabEquipBg: Phaser.GameObjects.Graphics;
  private readonly tabEquipText: Phaser.GameObjects.Text;
  private readonly tabEquipZone: Phaser.GameObjects.Zone;
  private readonly tabBagBg: Phaser.GameObjects.Graphics;
  private readonly tabBagText: Phaser.GameObjects.Text;
  private readonly tabBagZone: Phaser.GameObjects.Zone;

  private readonly equipmentSection: Phaser.GameObjects.Container;
  private readonly slotCards: EquipSlotCardView[] = [];
  private readonly statsPrimaryText: Phaser.GameObjects.Text;
  private readonly statsForcesText: Phaser.GameObjects.Text;

  private readonly bagSection: Phaser.GameObjects.Container;
  private readonly bagHeaderIcon: Phaser.GameObjects.Image | null;
  private readonly bagHeaderText: Phaser.GameObjects.Text;
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

  private equipBoxSize = 66;
  private statsBoxWidth = 280;
  private statsBoxHeight = 96;
  private bagCellWidth = 80;
  private bagCellHeight = 82;

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
      scene.scale.width || 800,
      scene.scale.height || 600
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
      .text(0, 0, 'EQUIPAMENTO', {
        fontFamily: FONT_TITLE,
        fontSize: '18px',
        color: '#f5d076',
        fontStyle: 'bold',
        letterSpacing: 2,
        resolution: 2,
      })
      .setOrigin(0.5, 0.5);

    // Botão X vermelho no canto superior direito
    this.closeBtnBg = scene.add.graphics();
    this.closeBtnText = scene.add
      .text(0, 0, 'X', {
        fontFamily: FONT_BODY,
        fontSize: '15px',
        color: '#fecaca',
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0.5, 0.5);
    this.closeBtnZone = scene.add
      .zone(0, 0, 32, 32)
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

    // Abas Mobile (EQUIPAMENTO | MOCHILA)
    this.tabEquipBg = scene.add.graphics();
    this.tabEquipText = scene.add
      .text(0, 0, 'EQUIPAMENTO', {
        fontFamily: FONT_TITLE,
        fontSize: '12px',
        color: '#f5d076',
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0.5);
    this.tabEquipZone = scene.add
      .zone(0, 0, 140, 32)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.tabEquipZone.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event?: Phaser.Types.Input.EventData
      ) => {
        event?.stopPropagation?.();
        this.mobileTab = 'equipment';
        this.applySectionVisibility();
        this.drawMobileTabs();
      }
    );

    this.tabBagBg = scene.add.graphics();
    this.tabBagText = scene.add
      .text(0, 0, 'MOCHILA (0)', {
        fontFamily: FONT_TITLE,
        fontSize: '12px',
        color: '#94a3b8',
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0.5);
    this.tabBagZone = scene.add
      .zone(0, 0, 140, 32)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.tabBagZone.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event?: Phaser.Types.Input.EventData
      ) => {
        event?.stopPropagation?.();
        this.mobileTab = 'bag';
        this.applySectionVisibility();
        this.drawMobileTabs();
      }
    );

    this.tabsContainer = scene.add.container(0, 0, [
      this.tabEquipBg,
      this.tabEquipText,
      this.tabEquipZone,
      this.tabBagBg,
      this.tabBagText,
      this.tabBagZone,
    ]);

    // Seção Equipamento (6 slots 2x3 + Placa Ornamental de Atributos com crânio)
    this.equipmentSection = scene.add.container(0, 0);
    for (const slot of EQUIP_SLOT_ORDER) {
      const boxBg = scene.add.graphics();
      const frame = SLOT_ICON_FRAME[slot];
      const iconImage = this.hasTextureFrame(UI_ICONS_KEY, frame)
        ? scene.add.image(0, 0, UI_ICONS_KEY, frame).setOrigin(0.5)
        : null;
      const fallbackIconText = scene.add
        .text(0, 0, SLOT_LABELS[slot][0] ?? '?', {
          fontFamily: FONT_TITLE,
          fontSize: '20px',
          color: '#64748b',
          fontStyle: 'bold',
          resolution: 2,
        })
        .setOrigin(0.5);

      const slotLabelText = scene.add
        .text(0, 0, SLOT_LABELS[slot], {
          fontFamily: FONT_BODY,
          fontSize: '11px',
          color: '#94a3b8',
          fontStyle: 'bold',
          resolution: 2,
        })
        .setOrigin(0.5);

      const itemNameText = scene.add
        .text(0, 0, SLOT_SUBLABELS[slot], {
          fontFamily: FONT_BODY,
          fontSize: '11px',
          color: '#94a3b8',
          resolution: 2,
        })
        .setOrigin(0.5);

      const hitZone = scene.add
        .zone(0, 0, 74, 96)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      const children: Phaser.GameObjects.GameObject[] = [boxBg];
      if (iconImage) {
        children.push(iconImage);
      }
      children.push(fallbackIconText, slotLabelText, itemNameText, hitZone);

      const cardContainer = scene.add.container(0, 0, children);

      hitZone.on('pointerover', () => {
        if (!this.opened || this.tooltipCard.isPinned()) {
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

      this.slotCards.push({
        slot,
        container: cardContainer,
        boxBg,
        iconImage,
        fallbackIconText,
        slotLabelText,
        itemNameText,
        hitZone,
      });
      this.equipmentSection.add(cardContainer);
    }

    this.statsBgGraphic = scene.add.graphics();
    this.statsPrimaryText = scene.add
      .text(0, 0, '', {
        fontFamily: FONT_BODY,
        fontSize: '13px',
        color: '#f8fafc',
        fontStyle: 'bold',
        align: 'center',
        lineSpacing: 4,
        resolution: 2,
      })
      .setOrigin(0.5, 0.5);
    this.statsForcesText = scene.add
      .text(0, 0, '', {
        fontFamily: FONT_BODY,
        fontSize: '10px',
        color: '#cbd5e1',
        align: 'center',
        resolution: 2,
      })
      .setOrigin(0.5, 0.5);

    this.equipmentSection.add([
      this.statsBgGraphic,
      this.statsPrimaryText,
      this.statsForcesText,
    ]);

    // Seção Mochila (Grade 4x4 = 16 slots + paginação)
    this.bagSection = scene.add.container(0, 0);
    this.bagHeaderIcon = this.hasTextureFrame(UI_ICONS_KEY, BAG_ICON_FRAME)
      ? scene.add.image(0, 0, UI_ICONS_KEY, BAG_ICON_FRAME).setOrigin(0.5)
      : null;
    this.bagHeaderText = scene.add
      .text(0, 0, 'MOCHILA DA INCURSÃO (0)', {
        fontFamily: FONT_TITLE,
        fontSize: '12px',
        color: '#f5d076',
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0, 0.5);
    this.emptyBagText = scene.add
      .text(0, 0, 'Mochila vazia.\nDerrote monstros para obter itens.', {
        fontFamily: FONT_BODY,
        fontSize: '12px',
        color: '#64748b',
        align: 'center',
        resolution: 2,
      })
      .setOrigin(0.5);

    if (this.bagHeaderIcon) {
      this.bagSection.add(this.bagHeaderIcon);
    }
    this.bagSection.add([this.bagHeaderText, this.emptyBagText]);

    for (let i = 0; i < BAG_PAGE_SIZE; i += 1) {
      const bg = scene.add.graphics();
      const iconImage = this.hasTextureFrame(
        UI_ICONS_KEY,
        SLOT_ICON_FRAME.weapon
      )
        ? scene.add
            .image(0, 0, UI_ICONS_KEY, SLOT_ICON_FRAME.weapon)
            .setOrigin(0.5)
        : null;
      const fallbackIconText = scene.add
        .text(0, 0, '?', {
          fontFamily: FONT_TITLE,
          fontSize: '18px',
          color: '#cbd5e1',
          fontStyle: 'bold',
          resolution: 2,
        })
        .setOrigin(0.5);
      const powerText = scene.add
        .text(0, 0, '', {
          fontFamily: FONT_TITLE,
          fontSize: '10px',
          color: '#e2e8f0',
          fontStyle: 'bold',
          resolution: 2,
        })
        .setOrigin(0, 0.5);
      const compareText = scene.add
        .text(0, 0, '', {
          fontFamily: FONT_BODY,
          fontSize: '11px',
          color: '#4ade80',
          fontStyle: 'bold',
          resolution: 2,
        })
        .setOrigin(1, 0.5);
      const nameText = scene.add
        .text(0, 0, '', {
          fontFamily: FONT_BODY,
          fontSize: '10px',
          color: '#e2e8f0',
          align: 'center',
          resolution: 2,
        })
        .setOrigin(0.5, 0.5);
      const hitZone = scene.add
        .zone(0, 0, 76, 78)
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
      };

      hitZone.on('pointerover', () => {
        if (!this.opened || !cellView.boundItem || this.tooltipCard.isPinned()) {
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

    // Paginação
    this.prevPageBg = scene.add.graphics();
    this.prevPageText = scene.add
      .text(0, 0, '◄ Anterior', {
        fontFamily: FONT_BODY,
        fontSize: '11px',
        color: '#e2e8f0',
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0.5);
    this.prevPageZone = scene.add
      .zone(0, 0, 92, 28)
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
        fontFamily: FONT_BODY,
        fontSize: '11px',
        color: '#e2e8f0',
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0.5);
    this.nextPageZone = scene.add
      .zone(0, 0, 92, 28)
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
        fontFamily: FONT_BODY,
        fontSize: '11px',
        color: '#cbd5e1',
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
        this.tabsContainer,
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
    this.mobileTab = 'equipment';
    this.rootContainer.setVisible(true);
    this.update(snapshot);
    this.applySectionVisibility();
    this.drawMobileTabs();
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

  public resize(viewport: ViewportConfig): void {
    this.viewport = viewport;
    this.tooltipCard.resize(viewport);

    const w = viewport.width;
    const h = viewport.height;
    const isMobile = viewport.mode === 'mobile_portrait';

    this.rootContainer.setPosition(w / 2, h / 2);

    this.backdropGraphic.clear();
    this.backdropGraphic.fillStyle(0x04060a, 0.84);
    this.backdropGraphic.fillRect(-w / 2, -h / 2, w, h);
    this.backdropZone.setSize(w, h);

    const panelW = isMobile ? Math.min(342, w - 16) : Math.min(756, w - 32);
    const panelH = isMobile ? Math.min(606, h - 24) : Math.min(556, h - 32);
    const headerH = isMobile ? 42 : 44;

    this.drawPanelFrame(panelW, panelH, headerH, isMobile);

    this.titleText.setFontSize(isMobile ? '17px' : '18px');
    this.titleText.setPosition(0, -panelH / 2 + headerH / 2 + 2);

    this.closeBtnContainer.setPosition(
      panelW / 2 - 22,
      -panelH / 2 + headerH / 2 + 2
    );
    this.drawCloseButton();

    if (isMobile) {
      this.tabsContainer.setVisible(true);
      const tabY = -panelH / 2 + headerH + 20;
      const tabW = (panelW - 36) / 2;
      this.tabsContainer.setPosition(0, tabY);

      this.tabEquipText.setPosition(-tabW / 2 - 4, 0);
      this.tabEquipZone.setPosition(-tabW / 2 - 4, 0).setSize(tabW, 28);
      this.tabBagText.setPosition(tabW / 2 + 4, 0);
      this.tabBagZone.setPosition(tabW / 2 + 4, 0).setSize(tabW, 28);

      // Aba Equipamento 2x3 (Mobile 360x640, slot 74x74)
      this.equipmentSection.setPosition(0, 0);
      this.equipBoxSize = 74;
      const colOffset = 76;
      const row1Y = -panelH / 2 + headerH + 92;
      const row2Y = row1Y + 114;
      const row3Y = row2Y + 114;

      const coords: Array<{ x: number; y: number }> = [
        { x: -colOffset, y: row1Y },
        { x: colOffset, y: row1Y },
        { x: -colOffset, y: row2Y },
        { x: colOffset, y: row2Y },
        { x: -colOffset, y: row3Y },
        { x: colOffset, y: row3Y },
      ];
      this.positionEquipCards(coords);

      this.statsBoxWidth = panelW - 32;
      this.statsBoxHeight = 96;
      const statsY = panelH / 2 - this.statsBoxHeight / 2 - 18;
      this.positionStatsPanel(0, statsY);

      // Aba Mochila 4x4 = 16 slots (Mobile 360x640)
      this.bagSection.setPosition(0, 0);
      const bagTopY = -panelH / 2 + headerH + 52;
      if (this.bagHeaderIcon) {
        this.bagHeaderIcon
          .setPosition(-panelW / 2 + 26, bagTopY)
          .setDisplaySize(18, 18);
        this.bagHeaderText.setPosition(-panelW / 2 + 42, bagTopY);
      } else {
        this.bagHeaderText.setPosition(-panelW / 2 + 18, bagTopY);
      }

      const gap = 6;
      this.bagCellWidth = Math.floor(
        (panelW - 32 - gap * (BAG_GRID_COLS - 1)) / BAG_GRID_COLS
      );
      this.bagCellHeight = 82;
      const gridStartY = bagTopY + 62;
      this.positionBagGrid(0, gridStartY, gap);

      const pagY = panelH / 2 - 26;
      this.positionPagination(0, pagY, panelW - 36);
      this.emptyBagText.setPosition(0, gridStartY + this.bagCellHeight * 1.5);
    } else {
      this.tabsContainer.setVisible(false);

      // Desktop 800x600: Coluna Esquerda (Equipamento 2x3 + Placa Atributos) | Coluna Direita (Mochila 4x4)
      const leftCenterX = -panelW / 4 - 4;
      const rightCenterX = panelW / 4 + 4;

      this.equipmentSection.setPosition(leftCenterX, 0);
      this.equipBoxSize = 66;
      const colOffset = 74;
      const row1Y = -panelH / 2 + headerH + 64;
      const row2Y = row1Y + 108;
      const row3Y = row2Y + 108;
      const coords: Array<{ x: number; y: number }> = [
        { x: -colOffset, y: row1Y },
        { x: colOffset, y: row1Y },
        { x: -colOffset, y: row2Y },
        { x: colOffset, y: row2Y },
        { x: -colOffset, y: row3Y },
        { x: colOffset, y: row3Y },
      ];
      this.positionEquipCards(coords);

      this.statsBoxWidth = panelW / 2 - 44;
      this.statsBoxHeight = 96;
      const statsY = panelH / 2 - this.statsBoxHeight / 2 - 18;
      this.positionStatsPanel(0, statsY);

      this.bagSection.setPosition(rightCenterX, 0);
      const rightColW = panelW / 2 - 36;
      const bagTopY = -panelH / 2 + headerH + 22;
      if (this.bagHeaderIcon) {
        this.bagHeaderIcon
          .setPosition(-rightColW / 2 + 10, bagTopY)
          .setDisplaySize(18, 18);
        this.bagHeaderText.setPosition(-rightColW / 2 + 26, bagTopY);
      } else {
        this.bagHeaderText.setPosition(-rightColW / 2 + 2, bagTopY);
      }

      const gap = 8;
      this.bagCellWidth = Math.floor(
        (rightColW - gap * (BAG_GRID_COLS - 1)) / BAG_GRID_COLS
      );
      this.bagCellHeight = 82;
      const gridStartY = bagTopY + 62;
      this.positionBagGrid(0, gridStartY, gap);

      const pagY = panelH / 2 - 26;
      this.positionPagination(0, pagY, rightColW);
      this.emptyBagText.setPosition(0, gridStartY + this.bagCellHeight * 1.5);
    }

    this.applySectionVisibility();
    this.drawMobileTabs();
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
          .setDisplaySize(this.equipBoxSize - 14, this.equipBoxSize - 14);
      }
      card.fallbackIconText.setPosition(0, 0);
      card.hitZone
        .setPosition(0, 0)
        .setSize(this.equipBoxSize + 12, this.equipBoxSize + 28);
    });
  }

  private positionStatsPanel(x: number, y: number): void {
    this.drawStatsFrame(x, y, this.statsBoxWidth, this.statsBoxHeight);
    this.statsPrimaryText.setPosition(x, y - 6);
    this.statsForcesText.setPosition(x, y + this.statsBoxHeight / 2 - 14);
  }

  private positionBagGrid(
    centerX: number,
    firstRowY: number,
    gap: number
  ): void {
    const stepX = this.bagCellWidth + gap;
    const stepY = this.bagCellHeight + gap;
    const iconSize = Math.min(40, this.bagCellWidth - 26);

    for (let i = 0; i < this.bagCells.length; i += 1) {
      const col = i % BAG_GRID_COLS;
      const row = Math.floor(i / BAG_GRID_COLS);
      const cx = centerX + (col - (BAG_GRID_COLS - 1) / 2) * stepX;
      const cy = firstRowY + row * stepY;

      const cell = this.bagCells[i];
      cell.container.setPosition(cx, cy);
      if (cell.iconImage) {
        cell.iconImage.setPosition(0, -4).setDisplaySize(iconSize, iconSize);
      }
      cell.fallbackIconText.setPosition(0, -4);
      cell.powerText.setPosition(
        -this.bagCellWidth / 2 + 5,
        -this.bagCellHeight / 2 + 10
      );
      cell.compareText.setPosition(
        this.bagCellWidth / 2 - 5,
        -this.bagCellHeight / 2 + 10
      );
      cell.nameText.setPosition(0, this.bagCellHeight / 2 - 11);
      cell.hitZone.setSize(this.bagCellWidth, this.bagCellHeight);
    }
  }

  private positionPagination(centerX: number, y: number, width: number): void {
    const btnW = 90;
    const btnH = 28;
    const edgeOffset = Math.max(btnW / 2 + 28, width / 2 - btnW / 2);

    this.prevPageContainer.setPosition(centerX - edgeOffset, y);
    this.prevPageZone.setSize(btnW, btnH);
    this.nextPageContainer.setPosition(centerX + edgeOffset, y);
    this.nextPageZone.setSize(btnW, btnH);
    this.pageInfoText.setPosition(centerX, y);
  }

  private applySectionVisibility(): void {
    const isMobile = this.viewport.mode === 'mobile_portrait';
    if (!isMobile) {
      this.equipmentSection.setVisible(true);
      this.bagSection.setVisible(true);
      return;
    }
    this.equipmentSection.setVisible(this.mobileTab === 'equipment');
    this.bagSection.setVisible(this.mobileTab === 'bag');
  }

  private renderSnapshot(): void {
    this.renderEquippedSlots();
    this.renderStatsPanel();
    this.renderBagGrid();
  }

  private renderEquippedSlots(): void {
    for (const card of this.slotCards) {
      const item = this.lastSnapshot.equipped[card.slot];
      const boxSize = this.equipBoxSize;
      const half = boxSize / 2;

      card.boxBg.clear();

      // Chanfros laterais ornamentais (esquerda e direita) estilo ref_diablo_equipment_panel.jpg
      card.boxBg.fillStyle(0x3a3227, 1);
      card.boxBg.fillPoints(
        [
          new Phaser.Geom.Point(-half - 5, 0),
          new Phaser.Geom.Point(-half, -6),
          new Phaser.Geom.Point(-half, 6),
        ],
        true
      );
      card.boxBg.fillPoints(
        [
          new Phaser.Geom.Point(half + 5, 0),
          new Phaser.Geom.Point(half, -6),
          new Phaser.Geom.Point(half, 6),
        ],
        true
      );
      card.boxBg.lineStyle(1, 0x7c6848, 0.9);
      card.boxBg.strokePoints(
        [
          new Phaser.Geom.Point(-half - 5, 0),
          new Phaser.Geom.Point(-half, -6),
          new Phaser.Geom.Point(-half, 6),
        ],
        true
      );
      card.boxBg.strokePoints(
        [
          new Phaser.Geom.Point(half + 5, 0),
          new Phaser.Geom.Point(half, -6),
          new Phaser.Geom.Point(half, 6),
        ],
        true
      );

      if (item) {
        const rarityNum = RARITY_NUM[item.rarity];
        const rarityHex = RARITY_HEX[item.rarity];

        // Moldura externa metálica + Fundo interno colorido pela raridade
        card.boxBg.fillStyle(0x1b1815, 1);
        card.boxBg.fillRect(-half - 2, -half - 2, boxSize + 4, boxSize + 4);
        card.boxBg.lineStyle(1.5, 0x6e5c42, 0.95);
        card.boxBg.strokeRect(-half - 2, -half - 2, boxSize + 4, boxSize + 4);

        card.boxBg.fillStyle(RARITY_FILL[item.rarity], 0.96);
        card.boxBg.fillRect(-half, -half, boxSize, boxSize);
        card.boxBg.lineStyle(2, rarityNum, 0.96);
        card.boxBg.strokeRect(-half, -half, boxSize, boxSize);
        card.boxBg.lineStyle(1, 0x0b0e14, 0.9);
        card.boxBg.strokeRect(-half + 3, -half + 3, boxSize - 6, boxSize - 6);

        // Losango de gema no topo central da moldura
        card.boxBg.fillStyle(0x0b0e14, 1);
        card.boxBg.fillPoints(
          [
            new Phaser.Geom.Point(0, -half - 6),
            new Phaser.Geom.Point(6, -half),
            new Phaser.Geom.Point(0, -half + 6),
            new Phaser.Geom.Point(-6, -half),
          ],
          true
        );
        card.boxBg.fillStyle(rarityNum, 1);
        card.boxBg.fillPoints(
          [
            new Phaser.Geom.Point(0, -half - 4.5),
            new Phaser.Geom.Point(4.5, -half),
            new Phaser.Geom.Point(0, -half + 4.5),
            new Phaser.Geom.Point(-4.5, -half),
          ],
          true
        );

        // Engaste de gema no canto inferior direito
        const gemX = half - 9;
        const gemY = half - 9;
        const gemColor =
          item.force !== 'none' ? FORCE_NUM[item.force] : rarityNum;
        card.boxBg.fillStyle(0x090b10, 1);
        card.boxBg.fillCircle(gemX, gemY, 6);
        card.boxBg.lineStyle(1, 0x8a7048, 0.95);
        card.boxBg.strokeCircle(gemX, gemY, 6);
        card.boxBg.fillStyle(gemColor, 1);
        card.boxBg.fillCircle(gemX, gemY, 4);

        if (card.iconImage) {
          card.iconImage.setVisible(true).setAlpha(1).clearTint();
          card.fallbackIconText.setVisible(false);
        } else {
          card.fallbackIconText.setVisible(true).setColor(rarityHex);
        }

        card.slotLabelText.setText(SLOT_LABELS[card.slot]).setColor(rarityHex);
        card.itemNameText
          .setText(SLOT_SUBLABELS[card.slot])
          .setColor(rarityHex);
      } else {
        card.boxBg.fillStyle(0x11151f, 0.95);
        card.boxBg.fillRect(-half, -half, boxSize, boxSize);
        card.boxBg.lineStyle(1.5, 0x4b5563, 0.85);
        card.boxBg.strokeRect(-half, -half, boxSize, boxSize);
        card.boxBg.lineStyle(1, 0x1e293b, 0.8);
        card.boxBg.strokeRect(-half + 4, -half + 4, boxSize - 8, boxSize - 8);

        // Losango discreto no topo da moldura vazia
        card.boxBg.fillStyle(0x334155, 1);
        card.boxBg.fillPoints(
          [
            new Phaser.Geom.Point(0, -half - 4),
            new Phaser.Geom.Point(4, -half),
            new Phaser.Geom.Point(0, -half + 4),
            new Phaser.Geom.Point(-4, -half),
          ],
          true
        );

        // Engaste vazio no canto inferior direito
        const gemX = half - 9;
        const gemY = half - 9;
        card.boxBg.fillStyle(0x090b10, 0.9);
        card.boxBg.fillCircle(gemX, gemY, 5.5);
        card.boxBg.lineStyle(1, 0x475569, 0.8);
        card.boxBg.strokeCircle(gemX, gemY, 5.5);

        if (card.iconImage) {
          card.iconImage.setVisible(true).setAlpha(0.24).setTint(0x64748b);
          card.fallbackIconText.setVisible(false);
        } else {
          card.fallbackIconText.setVisible(true).setColor('#475569');
        }

        card.slotLabelText.setText(SLOT_LABELS[card.slot]).setColor('#94a3b8');
        card.itemNameText
          .setText(SLOT_SUBLABELS[card.slot])
          .setColor('#94a3b8');
      }
    }
  }

  private renderStatsPanel(): void {
    const s = this.lastSnapshot.heroStats;
    const f = this.lastSnapshot.activeForces;
    const critPct = Math.round(s.critChance * 100);

    this.statsPrimaryText.setText(
      `Poder de Ataque: ${Math.round(s.attack)}\n` +
        `Armadura: ${Math.round(s.defense)}\n` +
        `Vida: ${Math.round(s.maxHp)}`
    );

    this.statsForcesText.setText(
      `Crítico: ${critPct}%  |  Inferno ${f.inferno} · Submundo ${f.submundo} · Empíreo ${f.empireo}`
    );
  }

  private renderBagGrid(): void {
    const totalItems = this.lastSnapshot.bag.length;
    this.bagHeaderText.setText(`MOCHILA DA INCURSÃO (${totalItems})`);
    this.tabBagText.setText(`MOCHILA (${totalItems})`);

    const totalPages = this.getTotalPages();
    const startIdx = this.bagPage * BAG_PAGE_SIZE;
    const pageItems = this.lastSnapshot.bag.slice(
      startIdx,
      startIdx + BAG_PAGE_SIZE
    );

    this.emptyBagText.setVisible(totalItems === 0);

    for (let i = 0; i < this.bagCells.length; i += 1) {
      const cell = this.bagCells[i];
      const item = pageItems[i] ?? null;
      cell.boundItem = item;
      cell.bg.clear();

      if (!item) {
        cell.container.setVisible(totalItems > 0);
        cell.bg.fillStyle(0x10131c, 0.72);
        cell.bg.fillRoundedRect(
          -this.bagCellWidth / 2,
          -this.bagCellHeight / 2,
          this.bagCellWidth,
          this.bagCellHeight,
          4
        );
        cell.bg.lineStyle(1, 0x2d3648, 0.7);
        cell.bg.strokeRoundedRect(
          -this.bagCellWidth / 2,
          -this.bagCellHeight / 2,
          this.bagCellWidth,
          this.bagCellHeight,
          4
        );
        cell.iconImage?.setVisible(false);
        cell.fallbackIconText.setVisible(false);
        cell.powerText.setVisible(false);
        cell.compareText.setVisible(false);
        cell.nameText.setVisible(false);
        continue;
      }

      cell.container.setVisible(true);
      const rarityNum = RARITY_NUM[item.rarity];
      const rarityHex = RARITY_HEX[item.rarity];
      const halfW = this.bagCellWidth / 2;
      const halfH = this.bagCellHeight / 2;

      cell.bg.fillStyle(RARITY_FILL[item.rarity], 0.94);
      cell.bg.fillRoundedRect(
        -halfW,
        -halfH,
        this.bagCellWidth,
        this.bagCellHeight,
        4
      );
      cell.bg.lineStyle(1.8, rarityNum, 0.92);
      cell.bg.strokeRoundedRect(
        -halfW,
        -halfH,
        this.bagCellWidth,
        this.bagCellHeight,
        4
      );

      if (item.force !== 'none') {
        cell.bg.fillStyle(FORCE_NUM[item.force], 1);
        cell.bg.fillCircle(halfW - 8, halfH - 22, 3.5);
      }

      const frame = SLOT_ICON_FRAME[item.slot];
      if (cell.iconImage && this.hasTextureFrame(UI_ICONS_KEY, frame)) {
        cell.iconImage.setFrame(frame).setVisible(true);
        cell.fallbackIconText.setVisible(false);
      } else {
        cell.iconImage?.setVisible(false);
        cell.fallbackIconText
          .setText(SLOT_LABELS[item.slot][0] ?? '?')
          .setColor(rarityHex)
          .setVisible(true);
      }

      const itemPower = calculateItemPower(item);
      cell.powerText
        .setText(`${itemPower}`)
        .setColor('#f8fafc')
        .setVisible(true);

      const equipped = this.lastSnapshot.equipped[item.slot];
      const eqPower = equipped ? calculateItemPower(equipped) : 0;
      const delta = itemPower - eqPower;
      if (!equipped || delta > 0) {
        cell.compareText.setText('▲').setColor('#4ade80').setVisible(true);
      } else if (delta < 0) {
        cell.compareText.setText('▼').setColor('#f87171').setVisible(true);
      } else {
        cell.compareText.setText('=').setColor('#94a3b8').setVisible(true);
      }

      cell.nameText
        .setText(this.truncateName(item.name, 10))
        .setColor(rarityHex)
        .setVisible(true);
    }

    this.pageInfoText.setText(`${this.bagPage + 1}/${totalPages}`);
    const hasPrev = this.bagPage > 0;
    const hasNext = this.bagPage < totalPages - 1;
    this.drawPaginationButton(this.prevPageBg, this.prevPageText, hasPrev);
    this.drawPaginationButton(this.nextPageBg, this.nextPageText, hasNext);
  }

  private drawPanelFrame(
    panelW: number,
    panelH: number,
    headerH: number,
    isMobile: boolean
  ): void {
    const left = -panelW / 2;
    const top = -panelH / 2;

    this.panelGraphic.clear();

    // Sombra externa
    this.panelGraphic.fillStyle(0x000000, 0.55);
    this.panelGraphic.fillRoundedRect(left + 5, top + 6, panelW, panelH, 4);

    // Fundo principal escuro 2D Dark Fantasy
    this.panelGraphic.fillStyle(0x161c22, 0.98);
    this.panelGraphic.fillRect(left, top, panelW, panelH);

    // Placa escura bronzeada do cabeçalho
    this.panelGraphic.fillStyle(0x212326, 1);
    this.panelGraphic.fillRect(left + 4, top + 4, panelW - 8, headerH);
    this.panelGraphic.lineStyle(1.5, 0x8a7048, 0.95);
    this.panelGraphic.lineBetween(
      left + 4,
      top + headerH + 4,
      left + panelW - 4,
      top + headerH + 4
    );

    // Moldura dupla chanfrada
    this.panelGraphic.lineStyle(2.5, 0x7c6848, 1);
    this.panelGraphic.strokeRect(left, top, panelW, panelH);
    this.panelGraphic.lineStyle(1.5, 0x3f4756, 0.95);
    this.panelGraphic.strokeRect(left + 5, top + 5, panelW - 10, panelH - 10);

    // Ornamentos nos cantos
    const c = 7;
    this.panelGraphic.fillStyle(0x9a825c, 1);
    this.panelGraphic.fillRect(left + 2, top + 2, c, c);
    this.panelGraphic.fillRect(left + panelW - c - 2, top + 2, c, c);
    this.panelGraphic.fillRect(left + 2, top + panelH - c - 2, c, c);
    this.panelGraphic.fillRect(
      left + panelW - c - 2,
      top + panelH - c - 2,
      c,
      c
    );

    // Divisória vertical no PC entre Equipamento e Mochila
    if (!isMobile) {
      this.panelGraphic.lineStyle(1.5, 0x4a4337, 0.9);
      this.panelGraphic.lineBetween(
        0,
        top + headerH + 16,
        0,
        top + panelH - 16
      );
    }
  }

  private drawStatsFrame(x: number, y: number, w: number, h: number): void {
    const left = x - w / 2;
    const top = y - h / 2;

    this.statsBgGraphic.clear();
    this.statsBgGraphic.fillStyle(0x1b1a17, 0.96);
    this.statsBgGraphic.fillRect(left, top, w, h);

    this.statsBgGraphic.lineStyle(2, 0x8a7048, 1);
    this.statsBgGraphic.strokeRect(left, top, w, h);
    this.statsBgGraphic.lineStyle(1, 0x3b3328, 0.9);
    this.statsBgGraphic.strokeRect(left + 4, top + 4, w - 8, h - 8);

    // Crânio ornamental no topo central
    const skY = top;
    this.statsBgGraphic.fillStyle(0x26231e, 1);
    this.statsBgGraphic.fillRoundedRect(x - 18, skY - 10, 36, 20, 6);
    this.statsBgGraphic.lineStyle(1.5, 0x8a7048, 1);
    this.statsBgGraphic.strokeRoundedRect(x - 18, skY - 10, 36, 20, 6);

    this.statsBgGraphic.fillStyle(0xd6d3d1, 0.95);
    this.statsBgGraphic.fillCircle(x, skY - 2, 6);
    this.statsBgGraphic.fillRect(x - 3.5, skY + 2, 7, 4);

    // Olhos e nariz do crânio
    this.statsBgGraphic.fillStyle(0x141820, 1);
    this.statsBgGraphic.fillCircle(x - 2.2, skY - 2, 1.5);
    this.statsBgGraphic.fillCircle(x + 2.2, skY - 2, 1.5);
    this.statsBgGraphic.fillRect(x - 0.8, skY + 0.5, 1.6, 1.8);
  }

  private drawCloseButton(): void {
    this.closeBtnBg.clear();
    this.closeBtnBg.fillStyle(0x7f1d1d, 0.98);
    this.closeBtnBg.fillRoundedRect(-15, -15, 30, 30, 3);
    this.closeBtnBg.lineStyle(1.5, 0xef4444, 0.95);
    this.closeBtnBg.strokeRoundedRect(-15, -15, 30, 30, 3);
  }

  private drawMobileTabs(): void {
    const isMobile = this.viewport.mode === 'mobile_portrait';
    if (!isMobile) {
      return;
    }
    const panelW = Math.min(342, this.viewport.width - 16);
    const tabW = (panelW - 36) / 2;

    this.drawTabButton(
      this.tabEquipBg,
      this.tabEquipText,
      -tabW / 2 - 4,
      tabW,
      28,
      this.mobileTab === 'equipment'
    );
    this.drawTabButton(
      this.tabBagBg,
      this.tabBagText,
      tabW / 2 + 4,
      tabW,
      28,
      this.mobileTab === 'bag'
    );
  }

  private drawTabButton(
    gfx: Phaser.GameObjects.Graphics,
    text: Phaser.GameObjects.Text,
    x: number,
    w: number,
    h: number,
    active: boolean
  ): void {
    gfx.clear();
    gfx.fillStyle(active ? 0x2a2319 : 0x11151e, 0.98);
    gfx.fillRoundedRect(x - w / 2, -h / 2, w, h, 3);
    gfx.lineStyle(1.5, active ? 0xc29b61 : 0x3b4454, 0.95);
    gfx.strokeRoundedRect(x - w / 2, -h / 2, w, h, 3);
    text.setColor(active ? '#f5d076' : '#94a3b8');
  }

  private drawPaginationButton(
    gfx: Phaser.GameObjects.Graphics,
    text: Phaser.GameObjects.Text,
    enabled: boolean
  ): void {
    gfx.clear();
    gfx.fillStyle(enabled ? 0x222838 : 0x131722, 0.95);
    gfx.fillRoundedRect(-45, -14, 90, 28, 4);
    gfx.lineStyle(1, enabled ? 0x8a7048 : 0x2c3444, 0.9);
    gfx.strokeRoundedRect(-45, -14, 90, 28, 4);
    text.setColor(enabled ? '#f8fafc' : '#475569');
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

  private hasTextureFrame(key: string, frame: number): boolean {
    if (!this.scene.textures.exists(key)) {
      return false;
    }
    const tex = this.scene.textures.get(key);
    return tex.has(String(frame)) || tex.has(frame as unknown as string);
  }
}
