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

    this.titleText = scene.add.text(0, 0, 'ALTAR DE ALMAS', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#ffd166',
      fontStyle: 'bold',
    });

    this.soulsText = scene.add.text(0, 0, 'Almas disponíveis: 0', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#90e0ef',
      fontStyle: 'bold',
    });

    this.introText = scene.add.text(0, 0, dialoguesData.entries.altar_intro.shortText, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#cbd5e1',
    });

    this.emptyText = scene.add
      .text(0, 0, 'Nenhuma bênção disponível no Altar.', {
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

    // Pagination Controls (used only if > 5 upgrades exist)
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
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#cbd5e1',
      })
      .setOrigin(0.5, 0.5);

    const rootChildren: Phaser.GameObjects.GameObject[] = [
      this.backdropGraphic,
      this.backdropZone,
      this.panelGraphic,
      this.soulsBgGraphic,
      this.titleText,
      this.soulsText,
      this.introText,
      this.emptyText,
      this.closeBtnContainer,
      this.prevPageContainer,
      this.nextPageContainer,
      this.pageInfoText,
    ];

    for (let i = 0; i < MAX_ROWS_PER_PAGE; i++) {
      const bg = scene.add.graphics();
      const nameText = scene.add.text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#f8fafc',
        fontStyle: 'bold',
      });
      const levelText = scene.add
        .text(0, 0, '', {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#ffd166',
          fontStyle: 'bold',
        })
        .setOrigin(1, 0);
      const bonusText = scene.add.text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#80ed99',
        fontStyle: 'bold',
      });
      const descText = scene.add.text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#94a3b8',
      });
      const costText = scene.add
        .text(0, 0, '', {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#90e0ef',
          fontStyle: 'bold',
        })
        .setOrigin(1, 0);

      const btnBg = scene.add.graphics();
      const btnText = scene.add
        .text(0, 0, 'Aprimorar', {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#ffffff',
          fontStyle: 'bold',
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
    this.backdropGraphic.fillStyle(0x04060a, 0.82);
    this.backdropGraphic.fillRect(-w / 2, -h / 2, w, h);
    this.backdropZone.setSize(w, h);

    const boxW = isMobile ? w - 20 : 680;
    const boxH = isMobile ? h - 44 : 520;

    this.panelGraphic.clear();
    this.panelGraphic.fillStyle(0x0f1420, 0.97);
    this.panelGraphic.fillRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, 8);
    this.panelGraphic.lineStyle(2, 0x3b4252, 1);
    this.panelGraphic.strokeRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, 8);

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
    this.closeBtnBg.clear();
    this.closeBtnBg.fillStyle(0x7f1d1d, 0.92);
    this.closeBtnBg.fillRoundedRect(-closeW / 2, -closeH / 2, closeW, closeH, 5);
    this.closeBtnBg.lineStyle(1.5, 0xfca5a5, 0.85);
    this.closeBtnBg.strokeRoundedRect(-closeW / 2, -closeH / 2, closeW, closeH, 5);

    const soulsBarY = topEdge + (isMobile ? 32 : 34);
    const soulsBarH = isMobile ? 24 : 26;
    this.soulsBgGraphic.clear();
    this.soulsBgGraphic.fillStyle(0x161d2e, 0.92);
    this.soulsBgGraphic.fillRoundedRect(leftEdge, soulsBarY, innerW, soulsBarH, 5);
    this.soulsBgGraphic.lineStyle(1, 0x2b3448, 0.9);
    this.soulsBgGraphic.strokeRoundedRect(leftEdge, soulsBarY, innerW, soulsBarH, 5);

    this.soulsText.setFontSize(isMobile ? 11 : 12);
    this.soulsText.setPosition(leftEdge + 10, soulsBarY + (isMobile ? 5 : 6));

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

      row.bg.clear();
      row.bg.fillStyle(0x141b2d, 0.94);
      row.bg.fillRoundedRect(-rowW / 2, -rowH / 2, rowW, rowH, 6);
      row.bg.lineStyle(
        1.5,
        isMax ? 0xffd166 : canAfford ? 0x48cae4 : 0x334155,
        0.92
      );
      row.bg.strokeRoundedRect(-rowW / 2, -rowH / 2, rowW, rowH, 6);

      this.setTextClamped(row.nameText, def.name, 1);
      row.levelText.setText(`Nv. ${level}/${def.maxLevel}`);
      row.levelText.setColor(isMax ? '#ffd166' : '#cbd5e1');

      const bonusStr = this.formatBonusSummary(def.bonusPerLevel, level);
      this.setTextClamped(row.bonusText, bonusStr, 1);
      this.setTextClamped(row.descText, def.description, isMobile ? 2 : 1);

      if (isMax) {
        row.costText.setText('Nível Máximo');
        row.costText.setColor('#ffd166');
      } else {
        row.costText.setText(`Custo: ${cost} Almas`);
        row.costText.setColor(canAfford ? '#90e0ef' : '#f87171');
      }

      row.btnBg.clear();
      if (isMax) {
        row.btnBg.fillStyle(0x1e293b, 0.92);
        row.btnBg.lineStyle(1, 0x64748b, 0.8);
        row.btnText.setText('Máximo');
        row.btnText.setColor('#ffd166');
      } else if (canAfford) {
        row.btnBg.fillStyle(0x155e75, 0.96);
        row.btnBg.lineStyle(1.5, 0x48cae4, 1);
        row.btnText.setText('Aprimorar');
        row.btnText.setColor('#ffffff');
      } else {
        row.btnBg.fillStyle(0x1e293b, 0.78);
        row.btnBg.lineStyle(1, 0x475569, 0.75);
        row.btnText.setText('Aprimorar');
        row.btnText.setColor('#64748b');
      }
      row.btnBg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 5);
      row.btnBg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 5);
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
    bg.clear();
    bg.fillStyle(enabled ? 0x1e293b : 0x0f172a, 0.95);
    bg.fillRoundedRect(-34, -12, 68, 24, 4);
    bg.lineStyle(1, enabled ? 0x64748b : 0x334155, 0.9);
    bg.strokeRoundedRect(-34, -12, 68, 24, 4);
    label.setColor(enabled ? '#f8fafc' : '#475569');
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
