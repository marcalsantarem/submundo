import Phaser from 'phaser';
import { resolveViewportConfig, type CampaignStageId, type ViewportConfig } from '../../core/index';
import {
  DF_FONTS,
  DF_PALETTE,
  drawOrnamentalDivider,
  drawOrnateButton,
  drawOrnatePanel,
} from './DarkFantasyUiBuilder';

/** Missão listada no portão (T-147): aceita e ainda não cumprida. */
export interface GateMissionEntry {
  stageId: CampaignStageId;
  title: string;
  /** Quem pediu (ex.: "Lyra"). */
  giverName?: string;
  /** Ícone da folha `mission_icons`; sem ícone, desenha uma espada. */
  icon?: 'herb' | 'tools' | null;
}

const MISSION_ICONS_TEXTURE = 'mission_icons';
const MISSION_ICON_FRAME: Record<'herb' | 'tools', number> = { herb: 0, tools: 1 };

export interface GateModalCallbacks {
  onSelectStage: (stageId: CampaignStageId) => void;
  onClose: () => void;
}

interface GateRowView {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Graphics;
  iconImage: Phaser.GameObjects.Image;
  title: Phaser.GameObjects.Text;
  giver: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
  entry: GateMissionEntry | null;
  hovered: boolean;
}

const PANEL_W = 440;
const ROW_W = 380;
const ROW_H = 56;
const ROW_GAP = 10;
const MAX_ROWS = 4;

/**
 * Tela do portão da Vila (T-139, T-147): lista as missões aceitas e ainda não
 * cumpridas, com o ícone e quem pediu. Clicar (ou 1-4) entra na dungeon.
 */
export class GateModal {
  private readonly scene: Phaser.Scene;
  private readonly callbacks: GateModalCallbacks;
  private viewport: ViewportConfig;
  private opened = false;
  private entries: GateMissionEntry[] = [];

  private readonly root: Phaser.GameObjects.Container;
  private readonly backdrop: Phaser.GameObjects.Graphics;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private readonly rows: GateRowView[] = [];
  private readonly closeBg: Phaser.GameObjects.Graphics;
  private readonly closeText: Phaser.GameObjects.Text;
  private readonly closeZone: Phaser.GameObjects.Zone;
  private readonly keydownHandler: (event: KeyboardEvent) => void;

  constructor(scene: Phaser.Scene, callbacks: GateModalCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.viewport = resolveViewportConfig(scene.scale.width || 960, scene.scale.height || 540);

    this.backdrop = scene.add.graphics();
    const backdropZone = scene.add.zone(0, 0, 2000, 2000).setInteractive();
    backdropZone.on(
      'pointerdown',
      (_p: Phaser.Input.Pointer, _x: number, _y: number, event?: Phaser.Types.Input.EventData) => {
        event?.stopPropagation?.();
      }
    );
    this.panel = scene.add.graphics();
    this.title = scene.add
      .text(0, 0, 'Portão da Vila', {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '20px',
        color: DF_PALETTE.textGold,
        fontStyle: 'bold',
        stroke: '#05070c',
        strokeThickness: 3,
        resolution: 2,
      })
      .setOrigin(0.5);
    this.subtitle = scene.add
      .text(0, 0, 'Missões aceitas', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '12px',
        color: DF_PALETTE.textMuted,
        resolution: 2,
      })
      .setOrigin(0.5);

    const children: Phaser.GameObjects.GameObject[] = [
      this.backdrop,
      backdropZone,
      this.panel,
      this.title,
      this.subtitle,
    ];

    for (let i = 0; i < MAX_ROWS; i++) {
      const row = this.createRow();
      this.rows.push(row);
      children.push(row.container);
    }

    this.closeBg = scene.add.graphics();
    this.closeText = scene.add
      .text(0, 0, 'Fechar', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '13px',
        color: DF_PALETTE.textLight,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0.5);
    this.closeZone = scene.add.zone(0, 0, 140, 34).setInteractive({ useHandCursor: true });
    this.closeZone.on(
      'pointerdown',
      (_p: Phaser.Input.Pointer, _x: number, _y: number, event?: Phaser.Types.Input.EventData) => {
        event?.stopPropagation?.();
        this.close();
      }
    );
    children.push(this.closeBg, this.closeText, this.closeZone);

    this.root = scene.add
      .container(0, 0, children)
      .setScrollFactor(0)
      .setDepth(1300)
      .setVisible(false);

    this.keydownHandler = (event: KeyboardEvent) => {
      if (!this.opened) {
        return;
      }
      if (event.code === 'Escape') {
        event.preventDefault();
        this.close();
      } else if (/^Digit[1-9]$/.test(event.code)) {
        const entry = this.entries[Number(event.code.slice(5)) - 1];
        if (entry) {
          this.callbacks.onSelectStage(entry.stageId);
        }
      }
    };
    scene.input.keyboard?.on('keydown', this.keydownHandler);

    this.layout();
  }

  public isOpen(): boolean {
    return this.opened;
  }

  public open(entries: GateMissionEntry[]): void {
    this.entries = entries.slice(0, MAX_ROWS);
    this.opened = true;
    this.layout();
    this.root.setVisible(true);
  }

  public close(): void {
    if (!this.opened) {
      return;
    }
    this.opened = false;
    this.root.setVisible(false);
    this.callbacks.onClose();
  }

  /** Fecha sem disparar `onClose` (troca de cena). */
  public hide(): void {
    this.opened = false;
    this.root.setVisible(false);
  }

  public resize(viewport: ViewportConfig): void {
    this.viewport = viewport;
    this.layout();
  }

  public destroy(): void {
    this.scene.input.keyboard?.off('keydown', this.keydownHandler);
    this.root.destroy();
  }

  private createRow(): GateRowView {
    const scene = this.scene;
    const bg = scene.add.graphics();
    const icon = scene.add.graphics();
    const iconImage = scene.add.image(-ROW_W / 2 + 28, 0, '__DEFAULT').setScale(2).setVisible(false);
    const title = scene.add
      .text(-ROW_W / 2 + 52, -8, '', {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '14px',
        color: DF_PALETTE.textParchment,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0, 0.5);
    const giver = scene.add
      .text(-ROW_W / 2 + 52, 11, '', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '11px',
        color: DF_PALETTE.textMuted,
        resolution: 2,
      })
      .setOrigin(0, 0.5);
    const status = scene.add
      .text(ROW_W / 2 - 16, 0, '', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '12px',
        color: DF_PALETTE.textMuted,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(1, 0.5);
    const zone = scene.add.zone(0, 0, ROW_W, ROW_H).setInteractive({ useHandCursor: true });
    const container = scene.add.container(0, 0, [bg, icon, iconImage, title, giver, status, zone]);
    const row: GateRowView = {
      container,
      bg,
      icon,
      iconImage,
      title,
      giver,
      status,
      zone,
      entry: null,
      hovered: false,
    };

    zone.on('pointerover', () => {
      row.hovered = true;
      this.drawRow(row);
    });
    zone.on('pointerout', () => {
      row.hovered = false;
      this.drawRow(row);
    });
    zone.on(
      'pointerdown',
      (_p: Phaser.Input.Pointer, _x: number, _y: number, event?: Phaser.Types.Input.EventData) => {
        event?.stopPropagation?.();
        if (row.entry) {
          this.callbacks.onSelectStage(row.entry.stageId);
        }
      }
    );
    return row;
  }

  private layout(): void {
    const w = this.viewport.width;
    const h = this.viewport.height;
    const count = Math.max(1, this.entries.length);
    const listH = count * ROW_H + (count - 1) * ROW_GAP;
    const panelH = 96 + listH + 66;
    const top = -panelH / 2;

    this.root.setPosition(w / 2, h / 2);
    this.backdrop.clear();
    this.backdrop.fillStyle(0x05070c, 0.62);
    this.backdrop.fillRect(-w / 2, -h / 2, w, h);

    drawOrnatePanel(this.panel, {
      x: -PANEL_W / 2,
      y: top,
      width: PANEL_W,
      height: panelH,
      bevel: 12,
      fillColor: DF_PALETTE.obsidianBg,
      fillAlpha: 0.97,
      innerFillColor: DF_PALETTE.innerSurface,
      outerBorderColor: DF_PALETTE.metalBorder,
      innerBorderColor: DF_PALETTE.bronzeBorder,
      accentColor: DF_PALETTE.agedGold,
      headerHeight: 64,
      headerColor: DF_PALETTE.headerBg,
      headerGlowColor: DF_PALETTE.agedGold,
      headerGlowAlpha: 0.12,
      shadow: true,
      cornerOrnaments: true,
      clear: true,
    });
    drawOrnamentalDivider(this.panel, -PANEL_W / 2 + 28, top + 66, PANEL_W - 56);
    this.title.setPosition(0, top + 26);
    this.subtitle.setPosition(0, top + 48);

    const listTop = top + 84;
    this.rows.forEach((row, i) => {
      const entry = this.entries[i] ?? null;
      row.entry = entry;
      row.container.setVisible(entry !== null);
      row.container.setPosition(0, listTop + i * (ROW_H + ROW_GAP) + ROW_H / 2);
      if (entry) {
        row.title.setText(`${i + 1}. ${entry.title}`);
        row.giver.setText(entry.giverName ? `Pedido de ${entry.giverName}` : '');
        row.title.setY(entry.giverName ? -8 : 0);
        this.drawRow(row);
      }
    });

    const closeY = top + panelH - 32;
    drawOrnateButton(this.closeBg, -70, closeY - 17, 140, 34, { variant: 'iron', bevel: 6, clear: true });
    this.closeText.setPosition(0, closeY);
    this.closeZone.setPosition(0, closeY);
  }

  private drawRow(row: GateRowView): void {
    const entry = row.entry;
    if (!entry) {
      return;
    }
    drawOrnateButton(row.bg, -ROW_W / 2, -ROW_H / 2, ROW_W, ROW_H, {
      variant: 'gold',
      bevel: 8,
      hovered: row.hovered,
      clear: true,
    });
    row.title.setColor(DF_PALETTE.textParchment);
    row.status.setText('Entrar ›').setColor(DF_PALETTE.textGold);

    const g = row.icon;
    g.clear();
    const ix = -ROW_W / 2 + 28;
    g.fillStyle(DF_PALETTE.deepRecess, 0.95);
    g.fillCircle(ix, 0, 17);
    g.lineStyle(1.5, DF_PALETTE.agedGold, 0.95);
    g.strokeCircle(ix, 0, 17);

    const iconFrame = entry.icon ? MISSION_ICON_FRAME[entry.icon] : -1;
    const tex = this.scene.textures.exists(MISSION_ICONS_TEXTURE)
      ? this.scene.textures.get(MISSION_ICONS_TEXTURE)
      : null;
    if (iconFrame >= 0 && tex?.has(String(iconFrame))) {
      row.iconImage.setTexture(MISSION_ICONS_TEXTURE, iconFrame).setPosition(ix, 0).setVisible(true);
      return;
    }
    row.iconImage.setVisible(false);
    if (entry.icon === 'herb') {
      // Reserva: folhas verdes.
      g.fillStyle(0x4ade80, 1);
      g.fillEllipse(ix - 4, 0, 7, 12);
      g.fillEllipse(ix + 4, 0, 7, 12);
      g.fillStyle(0x166534, 1);
      g.fillRect(ix - 0.8, 2, 1.6, 7);
    } else if (entry.icon === 'tools') {
      // Reserva: martelo.
      g.fillStyle(0x94a3b8, 1);
      g.fillRect(ix - 7, -7, 12, 5);
      g.fillStyle(0x92400e, 1);
      g.fillRect(ix - 2, -2, 3, 11);
    } else {
      // Espada (missão sem item).
      g.lineStyle(2.4, 0xf1d28a, 1);
      g.lineBetween(ix - 6, 6, ix + 6, -6);
      g.lineStyle(2, 0xd4a95a, 1);
      g.lineBetween(ix - 6, 0, ix, 6);
    }
  }
}
