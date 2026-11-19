import Phaser from 'phaser';
import {
  EquipSlot,
  EquippedGear,
  ForceType,
  HeroStats,
  ItemInstance,
  Rarity,
  StatBonus,
  ViewportConfig,
  resolveViewportConfig,
} from '../../core/index';

export interface InventoryHudSnapshot {
  equipped: EquippedGear;
  bag: ItemInstance[];
  heroStats: HeroStats;
  lifeSteal: number;
  cooldownReduction: number;
  luck: number;
  activeForces: Record<'inferno' | 'submundo' | 'empireo', number>;
}

interface EquipSlotCardView {
  slot: EquipSlot;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  iconImage: Phaser.GameObjects.Image | null;
  headerText: Phaser.GameObjects.Text;
  powerText: Phaser.GameObjects.Text;
  nameText: Phaser.GameObjects.Text;
  detailText: Phaser.GameObjects.Text;
  hitZone: Phaser.GameObjects.Zone;
}

interface BagRowView {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  nameText: Phaser.GameObjects.Text;
  compareText: Phaser.GameObjects.Text;
  statsText: Phaser.GameObjects.Text;
  metaText: Phaser.GameObjects.Text;
  actionText: Phaser.GameObjects.Text;
  hitZone: Phaser.GameObjects.Zone;
  boundInstanceId: string | null;
}

const EQUIP_SLOT_ORDER: EquipSlot[] = ['weapon', 'armor', 'amulet', 'ring'];

const SLOT_LABELS: Record<EquipSlot, string> = {
  weapon: 'Arma',
  armor: 'Armadura',
  amulet: 'Amuleto',
  ring: 'Anel',
};

const RARITY_HEX: Record<Rarity, string> = {
  common: '#e4e4e7',
  magic: '#38bdf8',
  rare: '#facc15',
  legendary: '#f97316',
};

const RARITY_NUM: Record<Rarity, number> = {
  common: 0xe4e4e7,
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

const FORCE_HEX: Record<ForceType, string> = {
  inferno: '#f48c06',
  submundo: '#ff4d6d',
  empireo: '#ffd166',
  none: '#94a3b8',
};

const MAX_BAG_ROWS = 4;

const UI_ICONS_KEY = 'ui_icons';

const BAG_ICON_FRAME = 6;

const SLOT_ICON_FRAME: Record<EquipSlot, number> = {
  weapon: 12,
  armor: 13,
  amulet: 14,
  ring: 15,
};

const PALETTE = {
  panelBg: 0x0d0f16,
  surfaceBg: 0x161924,
  emptyBg: 0x10131c,
  bronze: 0x8a7048,
  steel: 0x525a6e,
  goldSubtle: 0xc29b61,
  closeBg: 0x4c1319,
  closeBorder: 0x9f343e,
} as const;

export class InventoryModal {
  private readonly scene: Phaser.Scene;
  private readonly callbacks: {
    onEquipItem: (instanceId: string) => void;
    onUnequipSlot: (slot: EquipSlot) => void;
    onClose: () => void;
  };

  private viewport: ViewportConfig;
  private opened = false;
  private bagPage = 0;
  private lastSnapshot: InventoryHudSnapshot;

  private readonly rootContainer: Phaser.GameObjects.Container;
  private readonly backdropGraphic: Phaser.GameObjects.Graphics;
  private readonly backdropZone: Phaser.GameObjects.Zone;
  private readonly panelGraphic: Phaser.GameObjects.Graphics;
  private readonly statsBgGraphic: Phaser.GameObjects.Graphics;

  private readonly bagHeaderIcon: Phaser.GameObjects.Image | null;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly infernoForceText: Phaser.GameObjects.Text;
  private readonly submundoForceText: Phaser.GameObjects.Text;
  private readonly empireoForceText: Phaser.GameObjects.Text;
  private readonly statsText: Phaser.GameObjects.Text;
  private readonly equippedHeaderText: Phaser.GameObjects.Text;
  private readonly bagHeaderText: Phaser.GameObjects.Text;
  private readonly emptyBagText: Phaser.GameObjects.Text;

  private readonly closeBtnBg: Phaser.GameObjects.Graphics;
  private readonly closeBtnText: Phaser.GameObjects.Text;
  private readonly closeBtnZone: Phaser.GameObjects.Zone;
  private readonly closeBtnContainer: Phaser.GameObjects.Container;

  private readonly prevPageContainer: Phaser.GameObjects.Container;
  private readonly prevPageBg: Phaser.GameObjects.Graphics;
  private readonly prevPageText: Phaser.GameObjects.Text;
  private readonly prevPageZone: Phaser.GameObjects.Zone;

  private readonly nextPageContainer: Phaser.GameObjects.Container;
  private readonly nextPageBg: Phaser.GameObjects.Graphics;
  private readonly nextPageText: Phaser.GameObjects.Text;
  private readonly nextPageZone: Phaser.GameObjects.Zone;

  private readonly pageInfoText: Phaser.GameObjects.Text;

  private readonly slotCards: EquipSlotCardView[] = [];
  private readonly bagRows: BagRowView[] = [];
  private readonly keydownHandler: (event: KeyboardEvent) => void;

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

    this.lastSnapshot = {
      equipped: { weapon: null, armor: null, amulet: null, ring: null },
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
    this.statsBgGraphic = scene.add.graphics();

    this.bagHeaderIcon = this.hasTextureFrame(UI_ICONS_KEY, BAG_ICON_FRAME)
      ? scene.add.image(0, 0, UI_ICONS_KEY, BAG_ICON_FRAME).setOrigin(0.5)
      : null;

    this.titleText = scene.add.text(0, 0, 'INVENTÁRIO E EQUIPAMENTOS', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#ffd166',
      fontStyle: 'bold',
    });

    this.infernoForceText = scene.add.text(0, 0, 'Inferno: 0', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: FORCE_HEX.inferno,
      fontStyle: 'bold',
    });
    this.submundoForceText = scene.add.text(0, 0, 'Submundo: 0', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: FORCE_HEX.submundo,
      fontStyle: 'bold',
    });
    this.empireoForceText = scene.add.text(0, 0, 'Empíreo: 0', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: FORCE_HEX.empireo,
      fontStyle: 'bold',
    });

    this.statsText = scene.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#e2e8f0',
    });

    this.equippedHeaderText = scene.add.text(0, 0, 'EQUIPADOS (toque p/ remover)', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#94a3b8',
      fontStyle: 'bold',
    });

    this.bagHeaderText = scene.add.text(0, 0, 'MOCHILA (0 — toque p/ equipar)', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#94a3b8',
      fontStyle: 'bold',
    });

    this.emptyBagText = scene.add
      .text(0, 0, 'Mochila vazia.\nDerrote inimigos para obter itens.', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#64748b',
        align: 'center',
      })
      .setOrigin(0.5, 0.5);

    // Close Button
    this.closeBtnBg = scene.add.graphics();
    this.closeBtnText = scene.add
      .text(0, 0, 'Fechar', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#f8fafc',
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

    // Pagination Controls
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
      .zone(0, 0, 68, 26)
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
      .text(0, 0, 'Próx >', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#f8fafc',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5);
    this.nextPageZone = scene.add
      .zone(0, 0, 68, 26)
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
        if (this.bagPage < totalPages - 1) {
          this.bagPage += 1;
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
      this.statsBgGraphic,
    ];
    if (this.bagHeaderIcon) {
      rootChildren.push(this.bagHeaderIcon);
    }
    rootChildren.push(
      this.titleText,
      this.infernoForceText,
      this.submundoForceText,
      this.empireoForceText,
      this.statsText,
      this.equippedHeaderText,
      this.bagHeaderText,
      this.emptyBagText,
      this.closeBtnContainer,
      this.prevPageContainer,
      this.nextPageContainer,
      this.pageInfoText
    );

    // Build 4 Equipped Slot Cards
    for (const slot of EQUIP_SLOT_ORDER) {
      const bg = scene.add.graphics();
      const iconFrame = SLOT_ICON_FRAME[slot];
      const iconImage = this.hasTextureFrame(UI_ICONS_KEY, iconFrame)
        ? scene.add.image(0, 0, UI_ICONS_KEY, iconFrame).setOrigin(0.5)
        : null;
      const headerText = scene.add.text(0, 0, SLOT_LABELS[slot], {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#94a3b8',
        fontStyle: 'bold',
      });
      const powerText = scene.add
        .text(0, 0, '', {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#ffd166',
          fontStyle: 'bold',
        })
        .setOrigin(1, 0);
      const nameText = scene.add.text(0, 0, 'Vazio', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#64748b',
        fontStyle: 'bold',
      });
      const detailText = scene.add.text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#cbd5e1',
      });
      const hitZone = scene.add
        .zone(0, 0, 100, 60)
        .setOrigin(0.5, 0.5)
        .setInteractive({ useHandCursor: true });

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
          if (this.lastSnapshot.equipped[slot]) {
            this.callbacks.onUnequipSlot(slot);
          }
        }
      );

      const cardChildren: Phaser.GameObjects.GameObject[] = [bg];
      if (iconImage) {
        cardChildren.push(iconImage);
      }
      cardChildren.push(headerText, powerText, nameText, detailText, hitZone);

      const container = scene.add.container(0, 0, cardChildren);

      this.slotCards.push({
        slot,
        container,
        bg,
        iconImage,
        headerText,
        powerText,
        nameText,
        detailText,
        hitZone,
      });
      rootChildren.push(container);
    }

    // Build Pooled Bag Rows
    for (let i = 0; i < MAX_BAG_ROWS; i++) {
      const bg = scene.add.graphics();
      const nameText = scene.add.text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#f8fafc',
        fontStyle: 'bold',
      });
      const compareText = scene.add
        .text(0, 0, '', {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#80ed99',
          fontStyle: 'bold',
        })
        .setOrigin(1, 0);
      const statsText = scene.add.text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#cbd5e1',
      });
      const metaText = scene.add.text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#94a3b8',
      });
      const actionText = scene.add
        .text(0, 0, '[Equipar]', {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#80ed99',
          fontStyle: 'bold',
        })
        .setOrigin(1, 1);

      const hitZone = scene.add
        .zone(0, 0, 100, 60)
        .setOrigin(0.5, 0.5)
        .setInteractive({ useHandCursor: true });

      const rowView: BagRowView = {
        container: scene.add.container(0, 0, [
          bg,
          nameText,
          compareText,
          statsText,
          metaText,
          actionText,
          hitZone,
        ]),
        bg,
        nameText,
        compareText,
        statsText,
        metaText,
        actionText,
        hitZone,
        boundInstanceId: null,
      };

      hitZone.on(
        'pointerdown',
        (
          _pointer: Phaser.Input.Pointer,
          _lx: number,
          _ly: number,
          event?: Phaser.Types.Input.EventData
        ) => {
          event?.stopPropagation?.();
          if (!this.opened || !rowView.boundInstanceId) {
            return;
          }
          this.callbacks.onEquipItem(rowView.boundInstanceId);
        }
      );

      this.bagRows.push(rowView);
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

  public open(snapshot: InventoryHudSnapshot): void {
    this.opened = true;
    this.bagPage = 0;
    this.rootContainer.setVisible(true);
    this.update(snapshot);
  }

  public close(): void {
    this.opened = false;
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
    const w = viewport.width;
    const h = viewport.height;
    const isMobile = viewport.mode === 'mobile_portrait';

    this.rootContainer.setPosition(w / 2, h / 2);

    this.backdropGraphic.clear();
    this.backdropGraphic.fillStyle(0x04060a, 0.82);
    this.backdropGraphic.fillRect(-w / 2, -h / 2, w, h);
    this.backdropZone.setSize(w, h);

    const boxW = isMobile ? w - 20 : 720;
    const boxH = isMobile ? h - 52 : 510;

    this.panelGraphic.clear();
    this.fillChamferedRect(
      this.panelGraphic,
      -boxW / 2,
      -boxH / 2,
      boxW,
      boxH,
      10,
      PALETTE.panelBg,
      0.97
    );
    this.strokeChamferedRect(
      this.panelGraphic,
      -boxW / 2,
      -boxH / 2,
      boxW,
      boxH,
      10,
      2,
      PALETTE.bronze,
      0.95
    );
    this.strokeChamferedRect(
      this.panelGraphic,
      -boxW / 2 + 4,
      -boxH / 2 + 4,
      boxW - 8,
      boxH - 8,
      8,
      1,
      PALETTE.steel,
      0.78
    );

    // Header + Close
    const leftEdge = -boxW / 2 + 16;
    const rightEdge = boxW / 2 - 16;
    const topEdge = -boxH / 2 + 14;

    const hasBagIcon =
      this.bagHeaderIcon !== null &&
      this.hasTextureFrame(UI_ICONS_KEY, BAG_ICON_FRAME);
    const bagIconSize = isMobile ? 16 : 18;
    if (this.bagHeaderIcon) {
      this.bagHeaderIcon.setVisible(hasBagIcon);
      if (hasBagIcon) {
        this.bagHeaderIcon
          .setFrame(BAG_ICON_FRAME)
          .setDisplaySize(bagIconSize, bagIconSize)
          .setPosition(leftEdge + bagIconSize / 2, topEdge + (isMobile ? 8 : 9));
      }
    }

    const titleX = hasBagIcon ? leftEdge + bagIconSize + 7 : leftEdge;
    this.titleText.setText(isMobile ? 'INVENTÁRIO' : 'INVENTÁRIO E EQUIPAMENTOS');
    this.titleText.setFontSize(isMobile ? 14 : 15);
    this.titleText.setPosition(titleX, topEdge);

    const closeW = isMobile ? 72 : 84;
    const closeH = 28;
    this.closeBtnContainer.setPosition(rightEdge - closeW / 2, topEdge + 12);
    this.closeBtnZone.setSize(closeW, closeH);
    this.closeBtnBg.clear();
    this.fillChamferedRect(
      this.closeBtnBg,
      -closeW / 2,
      -closeH / 2,
      closeW,
      closeH,
      5,
      PALETTE.closeBg,
      0.95
    );
    this.strokeChamferedRect(
      this.closeBtnBg,
      -closeW / 2,
      -closeH / 2,
      closeW,
      closeH,
      5,
      1.5,
      PALETTE.closeBorder,
      0.92
    );

    // Active Forces
    const forcesY = topEdge + 22;
    this.infernoForceText.setPosition(leftEdge, forcesY);
    this.submundoForceText.setPosition(leftEdge + (isMobile ? 78 : 104), forcesY);
    this.empireoForceText.setPosition(leftEdge + (isMobile ? 158 : 216), forcesY);

    // Stats strip
    const statsY = forcesY + 18;
    const statsH = isMobile ? 34 : 26;
    const innerW = boxW - 32;
    this.statsBgGraphic.clear();
    this.fillChamferedRect(
      this.statsBgGraphic,
      leftEdge,
      statsY,
      innerW,
      statsH,
      5,
      PALETTE.surfaceBg,
      0.94
    );
    this.strokeChamferedRect(
      this.statsBgGraphic,
      leftEdge,
      statsY,
      innerW,
      statsH,
      5,
      1,
      PALETTE.steel,
      0.85
    );
    // Subtle golden divider below stats strip
    this.panelGraphic.lineStyle(1, PALETTE.bronze, 0.5);
    this.panelGraphic.lineBetween(
      leftEdge,
      statsY + statsH + 6,
      rightEdge,
      statsY + statsH + 6
    );
    this.statsText.setFontSize(isMobile ? 10 : 11);
    this.statsText.setPosition(leftEdge + 8, statsY + (isMobile ? 5 : 6));

    // Equipped & Bag Sections
    if (isMobile) {
      const equipHeaderY = statsY + statsH + 10;
      this.equippedHeaderText.setFontSize(10);
      this.equippedHeaderText.setPosition(leftEdge, equipHeaderY);

      const gridTop = equipHeaderY + 16;
      const cardW = (innerW - 8) / 2;
      const cardH = 66;
      this.slotCards.forEach((card, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const cx = leftEdge + col * (cardW + 8) + cardW / 2;
        const cy = gridTop + row * (cardH + 6) + cardH / 2;
        this.layoutSlotCard(card, cx, cy, cardW, cardH, true);
      });

      const bagHeaderY = gridTop + cardH * 2 + 16;
      this.panelGraphic.lineStyle(1, PALETTE.bronze, 0.45);
      this.panelGraphic.lineBetween(
        leftEdge,
        bagHeaderY - 7,
        rightEdge,
        bagHeaderY - 7
      );
      this.bagHeaderText.setFontSize(10);
      this.bagHeaderText.setPosition(leftEdge, bagHeaderY);

      const bagTop = bagHeaderY + 16;
      const rowW = innerW;
      const rowH = 78;
      this.bagRows.forEach((row, idx) => {
        const cy = bagTop + idx * (rowH + 6) + rowH / 2;
        this.layoutBagRow(row, 0, cy, rowW, rowH, true);
      });

      this.emptyBagText.setPosition(0, bagTop + 115);

      const pageY = boxH / 2 - 22;
      this.prevPageContainer.setPosition(-78, pageY);
      this.pageInfoText.setPosition(0, pageY);
      this.nextPageContainer.setPosition(78, pageY);
    } else {
      const bodyHeaderY = statsY + statsH + 12;
      const leftColW = 284;
      const rightColLeft = leftEdge + leftColW + 16;
      const rightColW = rightEdge - rightColLeft;

      // Subtle bronze/steel vertical divider between equipped & bag columns
      this.panelGraphic.lineStyle(1, PALETTE.bronze, 0.45);
      this.panelGraphic.lineBetween(
        leftEdge + leftColW + 8,
        bodyHeaderY,
        leftEdge + leftColW + 8,
        boxH / 2 - 14
      );

      this.equippedHeaderText.setFontSize(11);
      this.equippedHeaderText.setPosition(leftEdge, bodyHeaderY);
      this.bagHeaderText.setFontSize(11);
      this.bagHeaderText.setPosition(rightColLeft, bodyHeaderY);

      const listTop = bodyHeaderY + 18;
      const slotH = 84;
      this.slotCards.forEach((card, idx) => {
        const cx = leftEdge + leftColW / 2;
        const cy = listTop + idx * (slotH + 8) + slotH / 2;
        this.layoutSlotCard(card, cx, cy, leftColW, slotH, false);
      });

      const rowH = 80;
      const rowCenterX = rightColLeft + rightColW / 2;
      this.bagRows.forEach((row, idx) => {
        const cy = listTop + idx * (rowH + 8) + rowH / 2;
        this.layoutBagRow(row, rowCenterX, cy, rightColW, rowH, false);
      });

      this.emptyBagText.setPosition(rowCenterX, listTop + 140);

      const pageY = boxH / 2 - 22;
      this.prevPageContainer.setPosition(rowCenterX - 80, pageY);
      this.pageInfoText.setPosition(rowCenterX, pageY);
      this.nextPageContainer.setPosition(rowCenterX + 80, pageY);
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
    return Math.max(1, Math.ceil(this.lastSnapshot.bag.length / pageSize));
  }

  private layoutSlotCard(
    card: EquipSlotCardView,
    cx: number,
    cy: number,
    w: number,
    h: number,
    isMobile: boolean
  ): void {
    card.container.setPosition(cx, cy);
    card.container.setData('cardW', w);
    card.container.setData('cardH', h);
    card.hitZone.setSize(w, h);

    const left = -w / 2 + 8;
    const right = w / 2 - 8;
    const top = -h / 2 + 6;

    card.headerText.setFontSize(isMobile ? 9 : 10);
    card.headerText.setPosition(left, top);

    card.powerText.setFontSize(isMobile ? 9 : 10);
    card.powerText.setPosition(right, top);

    const iconFrame = SLOT_ICON_FRAME[card.slot];
    const hasIcon =
      card.iconImage !== null && this.hasTextureFrame(UI_ICONS_KEY, iconFrame);
    const iconBoxSize = isMobile ? 24 : 34;
    const iconTop = top + (isMobile ? 16 : 20);

    if (card.iconImage) {
      card.iconImage.setVisible(hasIcon);
      if (hasIcon) {
        const iconDisplay = isMobile ? 20 : 28;
        card.iconImage
          .setFrame(iconFrame)
          .setDisplaySize(iconDisplay, iconDisplay)
          .setPosition(left + iconBoxSize / 2, iconTop + iconBoxSize / 2);
      }
    }

    const textLeft = hasIcon ? left + iconBoxSize + 6 : left;
    const textWidth = Math.max(64, right - textLeft);

    card.nameText.setFontSize(isMobile ? 10 : 11);
    card.nameText.setWordWrapWidth(textWidth);
    card.nameText.setPosition(textLeft, top + (isMobile ? 13 : 16));

    card.detailText.setFontSize(isMobile ? 9 : 10);
    card.detailText.setWordWrapWidth(textWidth);
    card.detailText.setPosition(textLeft, top + (isMobile ? 31 : 36));
  }

  private layoutBagRow(
    row: BagRowView,
    cx: number,
    cy: number,
    w: number,
    h: number,
    isMobile: boolean
  ): void {
    row.container.setPosition(cx, cy);
    row.container.setData('rowW', w);
    row.container.setData('rowH', h);
    row.hitZone.setSize(w, h);

    const left = -w / 2 + 10;
    const right = w / 2 - 10;
    const top = -h / 2 + 7;
    const bottom = h / 2 - 7;

    row.nameText.setFontSize(isMobile ? 10 : 11);
    row.nameText.setWordWrapWidth(w - 105);
    row.nameText.setPosition(left, top);

    row.compareText.setFontSize(isMobile ? 10 : 11);
    row.compareText.setPosition(right, top);

    row.statsText.setFontSize(10);
    row.statsText.setWordWrapWidth(w - 20);
    row.statsText.setPosition(left, top + 18);

    row.metaText.setFontSize(isMobile ? 9 : 10);
    row.metaText.setWordWrapWidth(w - 86);
    row.metaText.setPosition(left, bottom - 13);

    row.actionText.setFontSize(10);
    row.actionText.setPosition(right, bottom);
  }

  private renderSnapshot(): void {
    const snap = this.lastSnapshot;
    const isMobile = this.viewport.mode === 'mobile_portrait';

    // Forces
    if (isMobile) {
      this.infernoForceText.setText(`Inf:${snap.activeForces.inferno}`);
      this.submundoForceText.setText(`Sub:${snap.activeForces.submundo}`);
      this.empireoForceText.setText(`Emp:${snap.activeForces.empireo}`);
    } else {
      this.infernoForceText.setText(`Inferno: ${snap.activeForces.inferno}`);
      this.submundoForceText.setText(`Submundo: ${snap.activeForces.submundo}`);
      this.empireoForceText.setText(`Empíreo: ${snap.activeForces.empireo}`);
    }

    // Hero Stats
    const s = snap.heroStats;
    const critPct = this.formatPercent(s.critChance);
    const stealPct = this.formatPercent(snap.lifeSteal);
    const cdrPct = this.formatPercent(snap.cooldownReduction);
    const luckPct = this.formatPercent(snap.luck);

    if (isMobile) {
      this.statsText.setText(
        `HP ${Math.ceil(s.hp)}/${s.maxHp} | ATQ ${s.attack} | DEF ${s.defense} | VEL ${s.moveSpeed}\n` +
          `CRIT ${critPct} | Roubo ${stealPct} | Rec ${cdrPct} | Sorte ${luckPct}`
      );
    } else {
      this.statsText.setText(
        `HP ${Math.ceil(s.hp)}/${s.maxHp} | ATQ ${s.attack} | DEF ${s.defense} | VEL ${s.moveSpeed} | CRIT ${critPct} | Roubo ${stealPct} | Rec ${cdrPct} | Sorte ${luckPct}`
      );
    }

    // Equipped Cards
    for (const card of this.slotCards) {
      const item = snap.equipped[card.slot];
      const cardW = (card.container.getData('cardW') as number) || 150;
      const cardH = (card.container.getData('cardH') as number) || 66;
      const cardLeft = -cardW / 2 + 8;
      const cardTop = -cardH / 2 + 6;
      const cardBottom = cardH / 2 - 5;
      const iconBoxSize = isMobile ? 24 : 34;
      const iconTop = cardTop + (isMobile ? 16 : 20);
      const hasIcon =
        card.iconImage !== null &&
        this.hasTextureFrame(UI_ICONS_KEY, SLOT_ICON_FRAME[card.slot]);

      card.bg.clear();
      if (item) {
        const borderNum = RARITY_NUM[item.rarity];
        const borderHex = RARITY_HEX[item.rarity];
        this.fillChamferedRect(
          card.bg,
          -cardW / 2,
          -cardH / 2,
          cardW,
          cardH,
          6,
          PALETTE.surfaceBg,
          0.96
        );
        this.strokeChamferedRect(
          card.bg,
          -cardW / 2,
          -cardH / 2,
          cardW,
          cardH,
          6,
          1.8,
          borderNum,
          0.95
        );
        this.strokeChamferedRect(
          card.bg,
          -cardW / 2 + 2.5,
          -cardH / 2 + 2.5,
          cardW - 5,
          cardH - 5,
          4.5,
          0.8,
          PALETTE.bronze,
          0.55
        );
        if (hasIcon && card.iconImage) {
          this.fillChamferedRect(
            card.bg,
            cardLeft,
            iconTop,
            iconBoxSize,
            iconBoxSize,
            4,
            PALETTE.panelBg,
            0.95
          );
          this.strokeChamferedRect(
            card.bg,
            cardLeft,
            iconTop,
            iconBoxSize,
            iconBoxSize,
            4,
            1.2,
            borderNum,
            0.85
          );
          card.iconImage.setAlpha(1);
        }

        card.headerText.setText(
          `${SLOT_LABELS[card.slot]} · ${FORCE_LABELS[item.force]}`
        );
        card.headerText.setColor(FORCE_HEX[item.force]);
        card.powerText.setText(`P:${item.powerScore}`);

        this.setTextClamped(card.nameText, item.name, 2);
        card.nameText.setColor(borderHex);

        const minDetailY = cardTop + (isMobile ? 30 : 35);
        const detailY = Math.max(
          minDetailY,
          card.nameText.y + card.nameText.height + (isMobile ? 3 : 4)
        );
        card.detailText.setY(detailY);

        const bonusLine = this.formatItemBonuses(item, isMobile ? 2 : 3);
        const tail = isMobile
          ? bonusLine || 'Toque p/ remover'
          : `${bonusLine}${item.legendaryPower ? ` | ${item.legendaryPower.name}` : ''}`;
        const detailLineH = isMobile ? 11 : 13;
        const maxDetailLines = cardBottom - detailY >= detailLineH * 2 ? 2 : 1;
        this.setTextClamped(
          card.detailText,
          tail || 'Equipado (toque p/ remover)',
          maxDetailLines
        );
        card.detailText.setColor('#cbd5e1');
      } else {
        this.fillChamferedRect(
          card.bg,
          -cardW / 2,
          -cardH / 2,
          cardW,
          cardH,
          6,
          PALETTE.emptyBg,
          0.84
        );
        this.strokeChamferedRect(
          card.bg,
          -cardW / 2,
          -cardH / 2,
          cardW,
          cardH,
          6,
          1,
          PALETTE.steel,
          0.72
        );
        if (hasIcon && card.iconImage) {
          this.fillChamferedRect(
            card.bg,
            cardLeft,
            iconTop,
            iconBoxSize,
            iconBoxSize,
            4,
            PALETTE.panelBg,
            0.78
          );
          this.strokeChamferedRect(
            card.bg,
            cardLeft,
            iconTop,
            iconBoxSize,
            iconBoxSize,
            4,
            1,
            PALETTE.steel,
            0.55
          );
          card.iconImage.setAlpha(0.32);
        }

        card.headerText.setText(SLOT_LABELS[card.slot]);
        card.headerText.setColor('#64748b');
        card.powerText.setText('');
        card.nameText.setText('— Vazio —');
        card.nameText.setColor('#64748b');
        card.detailText.setY(cardTop + (isMobile ? 31 : 36));
        card.detailText.setText('Nenhum item equipado');
        card.detailText.setColor('#475569');
      }
    }

    // Bag List (Paginated)
    this.bagHeaderText.setText(
      `MOCHILA (${snap.bag.length} — toque p/ equipar)`
    );

    const pageSize = this.getPageSize();
    const totalPages = this.getTotalPages();
    const startIdx = this.bagPage * pageSize;
    const pageItems = snap.bag.slice(startIdx, startIdx + pageSize);

    this.emptyBagText.setVisible(snap.bag.length === 0);

    for (let i = 0; i < this.bagRows.length; i++) {
      const row = this.bagRows[i];
      const item = pageItems[i];
      if (!item || i >= pageSize) {
        row.boundInstanceId = null;
        row.container.setVisible(false);
        continue;
      }

      row.boundInstanceId = item.instanceId;
      row.container.setVisible(true);

      const rowW = (row.container.getData('rowW') as number) || 316;
      const rowH = (row.container.getData('rowH') as number) || 78;
      const rowTop = -rowH / 2 + 7;
      const borderNum = RARITY_NUM[item.rarity];
      const borderHex = RARITY_HEX[item.rarity];

      row.bg.clear();
      this.fillChamferedRect(
        row.bg,
        -rowW / 2,
        -rowH / 2,
        rowW,
        rowH,
        6,
        PALETTE.surfaceBg,
        0.95
      );
      this.strokeChamferedRect(
        row.bg,
        -rowW / 2,
        -rowH / 2,
        rowW,
        rowH,
        6,
        1.5,
        borderNum,
        0.9
      );
      this.strokeChamferedRect(
        row.bg,
        -rowW / 2 + 2,
        -rowH / 2 + 2,
        rowW - 4,
        rowH - 4,
        4.5,
        0.7,
        PALETTE.steel,
        0.45
      );

      const equippedInSlot = snap.equipped[item.slot];
      const currentScore = equippedInSlot ? equippedInSlot.powerScore : 0;
      const delta = item.powerScore - currentScore;
      const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;
      const deltaColor =
        delta > 0 ? '#80ed99' : delta < 0 ? '#ff4d6d' : '#adb5bd';
      row.compareText.setText(`P:${item.powerScore} (${deltaStr})`);
      row.compareText.setColor(deltaColor);

      const availableNameW = Math.max(
        120,
        rowW - 20 - Math.ceil(row.compareText.width) - 10
      );
      row.nameText.setWordWrapWidth(availableNameW);
      this.setTextClamped(
        row.nameText,
        `[${SLOT_LABELS[item.slot]}] ${item.name}`,
        2
      );
      row.nameText.setColor(borderHex);

      const statsY = Math.max(
        rowTop + 18,
        row.nameText.y + row.nameText.height + 4
      );
      row.statsText.setY(statsY);
      const bonusStr = this.formatItemBonuses(item, isMobile ? 3 : 4);
      const maxStatsLines = statsY + 26 <= row.metaText.y - 3 ? 2 : 1;
      this.setTextClamped(
        row.statsText,
        bonusStr || 'Sem bônus adicionais',
        maxStatsLines
      );

      const forceLabel = FORCE_LABELS[item.force];
      const meta = item.legendaryPower
        ? `${forceLabel} · ${item.legendaryPower.name}`
        : `${forceLabel} · ${item.affixes.length} afixo(s)`;
      this.setTextClamped(row.metaText, meta, 1);
      row.metaText.setColor(FORCE_HEX[item.force]);
    }

    // Pagination buttons state
    const showPagination = snap.bag.length > pageSize;
    this.prevPageContainer.setVisible(showPagination);
    this.nextPageContainer.setVisible(showPagination);
    this.pageInfoText.setVisible(showPagination);

    if (showPagination) {
      this.pageInfoText.setText(`${this.bagPage + 1}/${totalPages}`);
      this.drawPageButton(this.prevPageBg, this.prevPageText, this.bagPage > 0);
      this.drawPageButton(
        this.nextPageBg,
        this.nextPageText,
        this.bagPage < totalPages - 1
      );
    }
  }

  private drawPageButton(
    bg: Phaser.GameObjects.Graphics,
    label: Phaser.GameObjects.Text,
    enabled: boolean
  ): void {
    bg.clear();
    this.fillChamferedRect(
      bg,
      -34,
      -13,
      68,
      26,
      4,
      enabled ? PALETTE.surfaceBg : PALETTE.panelBg,
      0.95
    );
    this.strokeChamferedRect(
      bg,
      -34,
      -13,
      68,
      26,
      4,
      1.2,
      enabled ? PALETTE.bronze : PALETTE.steel,
      enabled ? 0.92 : 0.45
    );
    label.setColor(enabled ? '#f8fafc' : '#475569');
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
    if (totals.critChance) parts.push(`CRIT +${this.formatPercent(totals.critChance)}`);
    if (totals.critMultiplier)
      parts.push(`DMG CRIT +${this.formatPercent(totals.critMultiplier)}`);
    if (totals.lifeSteal) parts.push(`Roubo +${this.formatPercent(totals.lifeSteal)}`);
    if (totals.cooldownReduction)
      parts.push(`Rec +${this.formatPercent(totals.cooldownReduction)}`);
    if (totals.luck) parts.push(`Sorte +${this.formatPercent(totals.luck)}`);
    if (totals.attackRange) parts.push(`Alc +${Math.round(totals.attackRange)}`);

    return parts.slice(0, maxEntries).join(', ');
  }

  private formatPercent(value: number): string {
    const pct = Math.abs(value) <= 1 ? value * 100 : value;
    return `${Math.round(pct)}%`;
  }

  private hasTextureFrame(key: string, frame: number): boolean {
    if (!this.scene.textures.exists(key)) {
      return false;
    }
    return this.scene.textures.get(key).has(String(frame));
  }

  private buildChamferedPoints(
    x: number,
    y: number,
    w: number,
    h: number,
    bevel: number
  ): Phaser.Types.Math.Vector2Like[] {
    const b = Math.min(bevel, w * 0.25, h * 0.25);
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

  private fillChamferedRect(
    gfx: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    bevel: number,
    color: number,
    alpha: number
  ): void {
    gfx.fillStyle(color, alpha);
    gfx.fillPoints(this.buildChamferedPoints(x, y, w, h, bevel), true);
  }

  private strokeChamferedRect(
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
    gfx.lineStyle(lineWidth, color, alpha);
    gfx.strokePoints(this.buildChamferedPoints(x, y, w, h, bevel), true, true);
  }
}
