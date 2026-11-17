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
      this.pageInfoText,
    ];

    // Build 4 Equipped Slot Cards
    for (const slot of EQUIP_SLOT_ORDER) {
      const bg = scene.add.graphics();
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

      const container = scene.add.container(0, 0, [
        bg,
        headerText,
        powerText,
        nameText,
        detailText,
        hitZone,
      ]);

      this.slotCards.push({
        slot,
        container,
        bg,
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
    this.panelGraphic.fillStyle(0x0f1420, 0.97);
    this.panelGraphic.fillRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, 8);
    this.panelGraphic.lineStyle(2, 0x3b4252, 1);
    this.panelGraphic.strokeRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, 8);

    // Header + Close
    const leftEdge = -boxW / 2 + 16;
    const rightEdge = boxW / 2 - 16;
    const topEdge = -boxH / 2 + 14;

    this.titleText.setText(isMobile ? 'INVENTÁRIO' : 'INVENTÁRIO E EQUIPAMENTOS');
    this.titleText.setFontSize(isMobile ? 14 : 15);
    this.titleText.setPosition(leftEdge, topEdge);

    const closeW = isMobile ? 72 : 84;
    const closeH = 28;
    this.closeBtnContainer.setPosition(rightEdge - closeW / 2, topEdge + 12);
    this.closeBtnZone.setSize(closeW, closeH);
    this.closeBtnBg.clear();
    this.closeBtnBg.fillStyle(0x7f1d1d, 0.92);
    this.closeBtnBg.fillRoundedRect(-closeW / 2, -closeH / 2, closeW, closeH, 5);
    this.closeBtnBg.lineStyle(1.5, 0xfca5a5, 0.85);
    this.closeBtnBg.strokeRoundedRect(-closeW / 2, -closeH / 2, closeW, closeH, 5);

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
    this.statsBgGraphic.fillStyle(0x161d2e, 0.92);
    this.statsBgGraphic.fillRoundedRect(leftEdge, statsY, innerW, statsH, 5);
    this.statsBgGraphic.lineStyle(1, 0x2b3448, 0.9);
    this.statsBgGraphic.strokeRoundedRect(leftEdge, statsY, innerW, statsH, 5);
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

    card.nameText.setFontSize(isMobile ? 10 : 12);
    card.nameText.setWordWrapWidth(w - 16);
    card.nameText.setPosition(left, top + (isMobile ? 14 : 17));

    card.detailText.setFontSize(isMobile ? 9 : 10);
    card.detailText.setWordWrapWidth(w - 16);
    card.detailText.setPosition(left, top + (isMobile ? 36 : 42));
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

    row.nameText.setFontSize(isMobile ? 11 : 12);
    row.nameText.setWordWrapWidth(w - 105);
    row.nameText.setPosition(left, top);

    row.compareText.setFontSize(isMobile ? 10 : 11);
    row.compareText.setPosition(right, top);

    row.statsText.setFontSize(10);
    row.statsText.setWordWrapWidth(w - 20);
    row.statsText.setPosition(left, top + 20);

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

      card.bg.clear();
      if (item) {
        const borderNum = RARITY_NUM[item.rarity];
        const borderHex = RARITY_HEX[item.rarity];
        card.bg.fillStyle(0x161f33, 0.95);
        card.bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 6);
        card.bg.lineStyle(2, borderNum, 0.95);
        card.bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 6);

        card.headerText.setText(
          `${SLOT_LABELS[card.slot]} · ${FORCE_LABELS[item.force]}`
        );
        card.headerText.setColor(FORCE_HEX[item.force]);
        card.powerText.setText(`P:${item.powerScore}`);
        card.nameText.setText(item.name);
        card.nameText.setColor(borderHex);

        const bonusLine = this.formatItemBonuses(item, isMobile ? 2 : 3);
        const tail = isMobile
          ? bonusLine || 'Toque p/ remover'
          : `${bonusLine}${item.legendaryPower ? ` | ${item.legendaryPower.name}` : ''}`;
        card.detailText.setText(tail || 'Equipado (toque p/ remover)');
        card.detailText.setColor('#cbd5e1');
      } else {
        card.bg.fillStyle(0x111622, 0.78);
        card.bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 6);
        card.bg.lineStyle(1, 0x334155, 0.85);
        card.bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 6);

        card.headerText.setText(SLOT_LABELS[card.slot]);
        card.headerText.setColor('#64748b');
        card.powerText.setText('');
        card.nameText.setText('— Vazio —');
        card.nameText.setColor('#64748b');
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
      const borderNum = RARITY_NUM[item.rarity];
      const borderHex = RARITY_HEX[item.rarity];

      row.bg.clear();
      row.bg.fillStyle(0x141b2d, 0.94);
      row.bg.fillRoundedRect(-rowW / 2, -rowH / 2, rowW, rowH, 6);
      row.bg.lineStyle(1.5, borderNum, 0.9);
      row.bg.strokeRoundedRect(-rowW / 2, -rowH / 2, rowW, rowH, 6);

      row.nameText.setText(`[${SLOT_LABELS[item.slot]}] ${item.name}`);
      row.nameText.setColor(borderHex);

      const equippedInSlot = snap.equipped[item.slot];
      const currentScore = equippedInSlot ? equippedInSlot.powerScore : 0;
      const delta = item.powerScore - currentScore;
      const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;
      const deltaColor =
        delta > 0 ? '#80ed99' : delta < 0 ? '#ff4d6d' : '#adb5bd';
      row.compareText.setText(`P:${item.powerScore} (${deltaStr})`);
      row.compareText.setColor(deltaColor);

      const bonusStr = this.formatItemBonuses(item, isMobile ? 3 : 4);
      row.statsText.setText(bonusStr || 'Sem bônus adicionais');

      const forceLabel = FORCE_LABELS[item.force];
      const meta = item.legendaryPower
        ? `${forceLabel} · ${item.legendaryPower.name}`
        : `${forceLabel} · ${item.affixes.length} afixo(s)`;
      row.metaText.setText(meta);
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
    bg.fillStyle(enabled ? 0x1e293b : 0x0f172a, 0.95);
    bg.fillRoundedRect(-34, -13, 68, 26, 4);
    bg.lineStyle(1, enabled ? 0x64748b : 0x334155, 0.9);
    bg.strokeRoundedRect(-34, -13, 68, 26, 4);
    label.setColor(enabled ? '#f8fafc' : '#475569');
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
}
