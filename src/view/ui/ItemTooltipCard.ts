import Phaser from 'phaser';
import {
  EquipSlot,
  ForceType,
  ItemInstance,
  Rarity,
  StatBonus,
  ViewportConfig,
  resolveViewportConfig,
} from '../../core/index';

export const FONT_TITLE =
  "'Cinzel', 'Palatino Linotype', 'Book Antiqua', Georgia, serif";
export const FONT_BODY =
  "'Segoe UI', 'Inter', system-ui, -apple-system, sans-serif";

export interface ItemTooltipCardOptions {
  isEquipped: boolean;
  equippedInSlot: ItemInstance | null;
  pinned?: boolean;
  onEquip?: (instanceId: string) => void;
  onUnequip?: (slot: EquipSlot) => void;
  onClose?: () => void;
}

const UI_ICONS_KEY = 'ui_icons';

export const SLOT_ICON_FRAME: Record<EquipSlot, number> = {
  weapon: 12,
  armor: 13,
  amulet: 14,
  ring: 15,
  helm: 16,
  boots: 17,
};

const SLOT_LABELS: Record<EquipSlot, string> = {
  weapon: 'Arma',
  armor: 'Armadura',
  helm: 'Elmo',
  boots: 'Bota',
  amulet: 'Amuleto',
  ring: 'Anel',
};

export const SLOT_TYPE_LABELS: Record<EquipSlot, Record<Rarity, string>> = {
  weapon: {
    common: 'Arma Comum',
    magic: 'Arma Mágica',
    rare: 'Arma Rara',
    legendary: 'Arma de Duas Mãos Lendária',
  },
  armor: {
    common: 'Armadura de Peito Comum',
    magic: 'Armadura de Peito Mágica',
    rare: 'Armadura de Peito Rara',
    legendary: 'Armadura de Peito Lendária',
  },
  helm: {
    common: 'Elmo Comum',
    magic: 'Elmo Mágico',
    rare: 'Elmo Raro',
    legendary: 'Elmo Lendário',
  },
  boots: {
    common: 'Botas Comuns',
    magic: 'Botas Mágicas',
    rare: 'Botas Raras',
    legendary: 'Botas Lendárias',
  },
  amulet: {
    common: 'Amuleto Comum',
    magic: 'Amuleto Mágico',
    rare: 'Amuleto Raro',
    legendary: 'Amuleto Lendário',
  },
  ring: {
    common: 'Anel Comum',
    magic: 'Anel Mágico',
    rare: 'Anel Raro',
    legendary: 'Anel Lendário',
  },
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

const RARITY_HEADER_BG: Record<Rarity, number> = {
  common: 0x262d3a,
  magic: 0x192c47,
  rare: 0x3b3113,
  legendary: 0x452212,
};

const FORCE_LABELS: Record<ForceType, string> = {
  inferno: 'Inferno',
  submundo: 'Submundo',
  empireo: 'Empíreo',
  none: 'Neutro',
};

const FORCE_HEX: Record<ForceType, string> = {
  inferno: '#f97316',
  submundo: '#fb7185',
  empireo: '#fde047',
  none: '#94a3b8',
};

const FORCE_NUM: Record<ForceType, number> = {
  inferno: 0xf97316,
  submundo: 0xfb7185,
  empireo: 0xfde047,
  none: 0x94a3b8,
};

interface StatDisplayEntry {
  key: keyof StatBonus;
  label: string;
  value: number;
  isPercent: boolean;
}

const STAT_META: Array<{
  key: keyof StatBonus;
  label: string;
  isPercent: boolean;
  weight: number;
}> = [
  { key: 'attack', label: 'Ataque', isPercent: false, weight: 12 },
  { key: 'defense', label: 'Armadura', isPercent: false, weight: 12 },
  { key: 'maxHp', label: 'Vida Máxima', isPercent: false, weight: 2.5 },
  { key: 'critChance', label: 'Chance de Acerto Crítico', isPercent: true, weight: 600 },
  { key: 'critMultiplier', label: 'Dano Crítico', isPercent: true, weight: 180 },
  { key: 'lifeSteal', label: 'Roubo de Vida', isPercent: true, weight: 700 },
  { key: 'cooldownReduction', label: 'Redução de Recarga', isPercent: true, weight: 500 },
  { key: 'moveSpeed', label: 'Velocidade de Movimento', isPercent: false, weight: 2 },
  { key: 'attackRange', label: 'Alcance', isPercent: false, weight: 2 },
  { key: 'luck', label: 'Sorte', isPercent: true, weight: 400 },
];

export function calculateItemPower(item: ItemInstance): number {
  const rarityBonus: Record<Rarity, number> = {
    common: 40,
    magic: 120,
    rare: 240,
    legendary: 380,
  };

  let score = rarityBonus[item.rarity];
  const combined = combineItemStats(item);
  for (const meta of STAT_META) {
    const val = combined[meta.key] ?? 0;
    if (val > 0) {
      score += val * meta.weight;
    }
  }
  if (item.legendaryPower) {
    score += 95;
  }
  return Math.max(Math.round(score), item.powerScore || 0);
}

function combineItemStats(item: ItemInstance): StatBonus {
  const totals: StatBonus = {};
  const addBonus = (bonus: StatBonus | undefined) => {
    if (!bonus) {
      return;
    }
    for (const meta of STAT_META) {
      const value = bonus[meta.key];
      if (typeof value === 'number' && value !== 0) {
        totals[meta.key] = (totals[meta.key] ?? 0) + value;
      }
    }
  };
  addBonus(item.baseBonuses);
  for (const affix of item.affixes) {
    addBonus(affix.bonuses);
  }
  return totals;
}

function formatStatValue(value: number, isPercent: boolean): string {
  if (isPercent) {
    const pct = value <= 1 && value >= -1 ? value * 100 : value;
    return `${Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(1)}%`;
  }
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function formatSignedDelta(delta: number, isPercent: boolean): string {
  const sign = delta > 0 ? '+' : '-';
  return `${sign}${formatStatValue(Math.abs(delta), isPercent)}`;
}

function formatPrimarySlotAttribute(
  item: ItemInstance,
  combined: StatBonus,
  powerScore: number
): {
  text: string;
  statKey: keyof StatBonus;
  label: string;
  isPercent: boolean;
} {
  switch (item.slot) {
    case 'weapon': {
      const raw =
        item.baseBonuses.attack ??
        combined.attack ??
        Math.max(12, Math.round(powerScore * 0.25));
      const primaryVal = Math.max(1, Math.round(raw));
      return {
        text: `${primaryVal} de Dano por Segundo`,
        statKey: 'attack',
        label: 'Dano por Segundo',
        isPercent: false,
      };
    }
    case 'armor':
    case 'helm':
    case 'boots': {
      const raw =
        item.baseBonuses.defense ??
        combined.defense ??
        Math.max(8, Math.round(powerScore * 0.22));
      const primaryVal = Math.max(1, Math.round(raw));
      return {
        text: `${primaryVal} de Armadura`,
        statKey: 'defense',
        label: 'Armadura',
        isPercent: false,
      };
    }
    case 'amulet': {
      const raw =
        item.baseBonuses.maxHp ??
        combined.maxHp ??
        Math.max(25, Math.round(powerScore * 0.35));
      const primaryVal = Math.max(1, Math.round(raw));
      return {
        text: `+${primaryVal} de Vida Máxima`,
        statKey: 'maxHp',
        label: 'Vida Máxima',
        isPercent: false,
      };
    }
    case 'ring': {
      const raw = item.baseBonuses.critChance ?? combined.critChance ?? 0.05;
      const pct = raw <= 1 ? raw * 100 : raw;
      const primaryVal = Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(1);
      return {
        text: `+${primaryVal}% de Chance de Acerto Crítico`,
        statKey: 'critChance',
        label: 'Chance de Acerto Crítico',
        isPercent: true,
      };
    }
  }
}

function hasTextureFrame(
  scene: Phaser.Scene,
  key: string,
  frame: number
): boolean {
  if (!scene.textures.exists(key)) {
    return false;
  }
  const tex = scene.textures.get(key);
  return tex.has(String(frame)) || tex.has(frame as unknown as string);
}

export class ItemTooltipCard {
  private readonly scene: Phaser.Scene;
  private viewport: ViewportConfig;
  private opened = false;
  private pinned = true;
  private openedAtMs = 0;
  private currentItem: ItemInstance | null = null;
  private currentOptions: ItemTooltipCardOptions | null = null;

  private readonly rootContainer: Phaser.GameObjects.Container;
  private readonly backdropGraphic: Phaser.GameObjects.Graphics;
  private readonly backdropZone: Phaser.GameObjects.Zone;
  private readonly cardContainer: Phaser.GameObjects.Container;
  private readonly cardBg: Phaser.GameObjects.Graphics;
  private readonly dynamicGroup: Phaser.GameObjects.Container;

  private cardWidth = 340;
  private cardHeight = 420;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.viewport = resolveViewportConfig(
      scene.scale.width || 800,
      scene.scale.height || 600
    );

    this.backdropGraphic = scene.add.graphics();
    this.backdropZone = scene.add
      .zone(0, 0, this.viewport.width, this.viewport.height)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: false });

    this.backdropZone.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _lx: number,
        _ly: number,
        event?: Phaser.Types.Input.EventData
      ) => {
        if (Date.now() - this.openedAtMs < 180) {
          return;
        }
        event?.stopPropagation?.();
        if (this.opened) {
          const opts = this.currentOptions;
          this.close();
          opts?.onClose?.();
        }
      }
    );

    this.cardBg = scene.add.graphics();
    this.dynamicGroup = scene.add.container(0, 0);

    const cardHitBlocker = scene.add
      .zone(0, 0, 10, 10)
      .setOrigin(0.5, 0.5)
      .setInteractive();
    cardHitBlocker.on(
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
    cardHitBlocker.setName('cardHitBlocker');

    this.cardContainer = scene.add.container(0, 0, [
      cardHitBlocker,
      this.cardBg,
      this.dynamicGroup,
    ]);

    this.rootContainer = scene.add
      .container(this.viewport.width / 2, this.viewport.height / 2, [
        this.backdropGraphic,
        this.backdropZone,
        this.cardContainer,
      ])
      .setScrollFactor(0)
      .setDepth(1120)
      .setVisible(false);

    this.resize(this.viewport);
  }

  public open(
    item: ItemInstance,
    options: ItemTooltipCardOptions & { hoverSide?: 'left' | 'right' }
  ): void {
    this.currentItem = item;
    this.currentOptions = options;
    this.pinned = options.pinned ?? true;
    this.opened = true;
    this.openedAtMs = Date.now();
    this.rootContainer.setVisible(true);
    this.syncInteractivity();
    this.rebuildCard();

    if (!this.pinned && this.viewport.mode !== 'mobile_portrait') {
      const side = options.hoverSide ?? 'right';
      this.cardContainer.setPosition(side === 'left' ? -180 : 180, 0);
    } else {
      this.cardContainer.setPosition(0, 0);
    }
  }

  public close(): void {
    this.opened = false;
    this.pinned = false;
    this.currentItem = null;
    this.currentOptions = null;
    this.rootContainer.setVisible(false);
    this.dynamicGroup.removeAll(true);
  }

  public isOpen(): boolean {
    return this.opened;
  }

  public isPinned(): boolean {
    return this.opened && this.pinned;
  }

  public resize(viewport: ViewportConfig): void {
    this.viewport = viewport;
    const w = viewport.width;
    const h = viewport.height;

    this.rootContainer.setPosition(w / 2, h / 2);

    this.backdropGraphic.clear();
    this.backdropGraphic.fillStyle(0x030509, 0.78);
    this.backdropGraphic.fillRect(-w / 2, -h / 2, w, h);

    this.backdropZone.setSize(w, h);

    if (this.opened && this.currentItem) {
      this.rebuildCard();
    }
  }

  public destroy(): void {
    this.dynamicGroup.removeAll(true);
    this.rootContainer.destroy(true);
  }

  private syncInteractivity(): void {
    const hitBlocker = this.cardContainer.getByName('cardHitBlocker') as
      | Phaser.GameObjects.Zone
      | undefined;

    if (this.pinned) {
      this.backdropGraphic.setVisible(true);
      this.backdropZone.setInteractive({ useHandCursor: false });
      hitBlocker?.setInteractive();
    } else {
      this.backdropGraphic.setVisible(false);
      this.backdropZone.disableInteractive();
      hitBlocker?.disableInteractive();
    }
  }

  private rebuildCard(): void {
    const item = this.currentItem;
    const options = this.currentOptions;
    if (!item || !options) {
      return;
    }

    this.dynamicGroup.removeAll(true);

    const isMobile = this.viewport.mode === 'mobile_portrait';
    this.cardWidth = isMobile
      ? Math.min(326, this.viewport.width - 24)
      : Math.min(372, this.viewport.width - 60);

    const padX = isMobile ? 16 : 18;
    const innerW = this.cardWidth - padX * 2;
    const rarityColor = RARITY_NUM[item.rarity];
    const rarityHex = RARITY_HEX[item.rarity];

    const children: Phaser.GameObjects.GameObject[] = [];
    let cursorY = 18;

    // 1. Nome do item + Subtítulo (no cabeçalho colorido 2D)
    const headerTop = 8;
    const titleText = this.scene.add
      .text(0, cursorY, item.name.toUpperCase(), {
        fontFamily: FONT_TITLE,
        fontSize: isMobile ? '15px' : '16px',
        color: rarityHex,
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: innerW - 12 },
        resolution: 2,
      })
      .setOrigin(0.5, 0);
    children.push(titleText);
    cursorY += titleText.height + 3;

    const typeSubtitle =
      SLOT_TYPE_LABELS[item.slot]?.[item.rarity] ??
      `${SLOT_LABELS[item.slot]} ${item.rarity}`;
    const subtitleText = this.scene.add
      .text(0, cursorY, typeSubtitle, {
        fontFamily: FONT_BODY,
        fontSize: '11px',
        color: '#cbd5e1',
        align: 'center',
        resolution: 2,
      })
      .setOrigin(0.5, 0);
    children.push(subtitleText);
    cursorY += subtitleText.height + 10;

    const headerHeight = cursorY - headerTop;

    // 2. Caixa do ícone 2D à esquerda + Poder do Item grande à direita
    const iconBoxSize = isMobile ? 64 : 68;
    const iconBoxX = -innerW / 2 + iconBoxSize / 2;
    const iconBoxY = cursorY + iconBoxSize / 2;

    const iconBoxBg = this.scene.add.graphics();
    iconBoxBg.fillStyle(0x0c0e14, 1);
    iconBoxBg.fillRoundedRect(
      iconBoxX - iconBoxSize / 2,
      iconBoxY - iconBoxSize / 2,
      iconBoxSize,
      iconBoxSize,
      5
    );
    iconBoxBg.lineStyle(2, rarityColor, 0.92);
    iconBoxBg.strokeRoundedRect(
      iconBoxX - iconBoxSize / 2,
      iconBoxY - iconBoxSize / 2,
      iconBoxSize,
      iconBoxSize,
      5
    );
    children.push(iconBoxBg);

    const frame = SLOT_ICON_FRAME[item.slot];
    if (hasTextureFrame(this.scene, UI_ICONS_KEY, frame)) {
      const iconImg = this.scene.add
        .image(iconBoxX, iconBoxY, UI_ICONS_KEY, frame)
        .setOrigin(0.5)
        .setDisplaySize(iconBoxSize - 12, iconBoxSize - 12);
      children.push(iconImg);
    } else {
      const fallbackTxt = this.scene.add
        .text(iconBoxX, iconBoxY, SLOT_LABELS[item.slot][0] ?? '?', {
          fontFamily: FONT_TITLE,
          fontSize: '22px',
          color: rarityHex,
          fontStyle: 'bold',
          resolution: 2,
        })
        .setOrigin(0.5);
      children.push(fallbackTxt);
    }

    // Gema da Força no canto inferior direito da caixa do ícone
    if (item.force !== 'none') {
      const gemGfx = this.scene.add.graphics();
      const gx = iconBoxX + iconBoxSize / 2 - 8;
      const gy = iconBoxY + iconBoxSize / 2 - 8;
      gemGfx.fillStyle(0x090b10, 1);
      gemGfx.fillCircle(gx, gy, 6);
      gemGfx.fillStyle(FORCE_NUM[item.force], 1);
      gemGfx.fillCircle(gx, gy, 4);
      children.push(gemGfx);
    }

    const powerScore = calculateItemPower(item);
    const powerCenterX = iconBoxX + iconBoxSize / 2 + (innerW - iconBoxSize) / 2;

    const powerNumText = this.scene.add
      .text(powerCenterX, iconBoxY - 12, `${powerScore}`, {
        fontFamily: FONT_TITLE,
        fontSize: isMobile ? '24px' : '26px',
        color: '#f8fafc',
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0.5);
    children.push(powerNumText);

    const powerLabelText = this.scene.add
      .text(powerCenterX, iconBoxY + 13, 'Poder do Item', {
        fontFamily: FONT_BODY,
        fontSize: '11px',
        color: '#cbd5e1',
        resolution: 2,
      })
      .setOrigin(0.5);
    children.push(powerLabelText);

    cursorY += iconBoxSize + 10;

    // 3. 1º Divisor ornamental ── ◇ ──
    cursorY = this.addOrnamentalDivider(children, cursorY, innerW);

    // 4. Atributo principal do slot + Comparação
    const baseEntries = this.extractStatEntries(item.baseBonuses);
    const equippedCombined =
      !options.isEquipped && options.equippedInSlot
        ? combineItemStats(options.equippedInSlot)
        : null;
    const itemCombined = combineItemStats(item);

    const primaryAttr = formatPrimarySlotAttribute(item, itemCombined, powerScore);
    const primaryText = this.scene.add
      .text(0, cursorY, primaryAttr.text, {
        fontFamily: FONT_BODY,
        fontSize: isMobile ? '14px' : '15px',
        color: '#f8fafc',
        fontStyle: 'bold',
        align: 'center',
        resolution: 2,
      })
      .setOrigin(0.5, 0);
    children.push(primaryText);
    cursorY += primaryText.height + 5;

    // Demais stats base (exceto o atributo primário já exibido)
    for (const entry of baseEntries) {
      if (entry.key === primaryAttr.statKey) {
        continue;
      }
      const delta = equippedCombined
        ? (itemCombined[entry.key] ?? 0) - (equippedCombined[entry.key] ?? 0)
        : 0;
      cursorY = this.addBulletStatRow(
        children,
        cursorY,
        innerW,
        `+${formatStatValue(entry.value, entry.isPercent)} de ${entry.label}`,
        delta,
        entry.isPercent
      );
    }

    // 5. Lista de afixos com marcador ◆ e comparação verde/vermelha
    for (const affix of item.affixes) {
      const affixEntries = this.extractStatEntries(affix.bonuses);
      if (affixEntries.length === 0) {
        cursorY = this.addBulletStatRow(
          children,
          cursorY,
          innerW,
          affix.description,
          0,
          false
        );
        continue;
      }
      for (const entry of affixEntries) {
        const delta = equippedCombined
          ? (itemCombined[entry.key] ?? 0) - (equippedCombined[entry.key] ?? 0)
          : 0;
        cursorY = this.addBulletStatRow(
          children,
          cursorY,
          innerW,
          `+${formatStatValue(entry.value, entry.isPercent)} de ${entry.label}`,
          delta,
          entry.isPercent
        );
      }
    }

    // Comparação resumida para o atributo principal caso não esteja equipado
    if (equippedCombined) {
      const primaryDelta =
        (itemCombined[primaryAttr.statKey] ?? 0) -
        (equippedCombined[primaryAttr.statKey] ?? 0);
      if (Math.abs(primaryDelta) > 0.0001) {
        const isUp = primaryDelta > 0;
        const deltaText = this.scene.add
          .text(
            0,
            cursorY + 2,
            `vs. Equipado: ${formatSignedDelta(primaryDelta, primaryAttr.isPercent)} ${primaryAttr.label}`,
            {
              fontFamily: FONT_BODY,
              fontSize: '11px',
              color: isUp ? '#4ade80' : '#f87171',
              fontStyle: 'bold',
              resolution: 2,
            }
          )
          .setOrigin(0.5, 0);
        children.push(deltaText);
        cursorY += deltaText.height + 4;
      }
    }

    cursorY += 4;

    // 6. Bloco de Poder Lendário (se existir)
    if (item.legendaryPower) {
      cursorY = this.addOrnamentalDivider(children, cursorY, innerW);
      const legendText = this.scene.add
        .text(
          -innerW / 2 + 2,
          cursorY,
          `★ ${item.legendaryPower.name}: ${item.legendaryPower.description}`,
          {
            fontFamily: FONT_BODY,
            fontSize: '11px',
            color: '#fb923c',
            wordWrap: { width: innerW - 4 },
            lineSpacing: 2,
            resolution: 2,
          }
        )
        .setOrigin(0, 0);
      children.push(legendText);
      cursorY += legendText.height + 8;
    }

    // 7. Bloco de comparação "EQUIPADO ATUALMENTE" (quando inspecionando item da mochila com slot ocupado)
    if (!options.isEquipped && options.equippedInSlot) {
      const eq = options.equippedInSlot;
      const eqPower = calculateItemPower(eq);
      const eqCombined = combineItemStats(eq);
      const eqPrimary = formatPrimarySlotAttribute(eq, eqCombined, eqPower);
      const eqRarityHex = RARITY_HEX[eq.rarity];

      cursorY = this.addOrnamentalDivider(children, cursorY, innerW);

      const cmpBadge = this.scene.add
        .text(0, cursorY, 'EQUIPADO ATUALMENTE', {
          fontFamily: FONT_TITLE,
          fontSize: '10px',
          color: '#f5d076',
          fontStyle: 'bold',
          resolution: 2,
        })
        .setOrigin(0.5, 0);
      children.push(cmpBadge);
      cursorY += cmpBadge.height + 3;

      const cmpItemTitle = this.scene.add
        .text(0, cursorY, `${eq.name} (Poder ${eqPower})`, {
          fontFamily: FONT_TITLE,
          fontSize: '12px',
          color: eqRarityHex,
          fontStyle: 'bold',
          align: 'center',
          wordWrap: { width: innerW - 8 },
          resolution: 2,
        })
        .setOrigin(0.5, 0);
      children.push(cmpItemTitle);
      cursorY += cmpItemTitle.height + 2;

      const cmpPrimaryTxt = this.scene.add
        .text(0, cursorY, eqPrimary.text, {
          fontFamily: FONT_BODY,
          fontSize: '11px',
          color: '#cbd5e1',
          align: 'center',
          resolution: 2,
        })
        .setOrigin(0.5, 0);
      children.push(cmpPrimaryTxt);
      cursorY += cmpPrimaryTxt.height + 6;
    }

    // 8. Rodapé: Força elemental + Botões EQUIPAR/DESEQUIPAR e FECHAR
    cursorY = this.addOrnamentalDivider(children, cursorY, innerW);

    const forceText = this.scene.add
      .text(0, cursorY, `Força: ${FORCE_LABELS[item.force]}`, {
        fontFamily: FONT_BODY,
        fontSize: '11px',
        color: FORCE_HEX[item.force],
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0.5, 0);
    children.push(forceText);
    cursorY += forceText.height + 10;

    const btnHeight = isMobile ? 36 : 34;
    const btnGap = 10;
    const btnWidth = (innerW - btnGap) / 2;
    const btnY = cursorY + btnHeight / 2;

    const primaryLabel = options.isEquipped ? 'DESEQUIPAR' : 'EQUIPAR';
    const primaryFill = options.isEquipped ? 0x451a1a : 0x1d3b2a;
    const primaryStroke = options.isEquipped ? 0xc2410c : 0x4ade80;

    this.addActionButton(
      children,
      -btnWidth / 2 - btnGap / 2,
      btnY,
      btnWidth,
      btnHeight,
      primaryLabel,
      primaryFill,
      primaryStroke,
      '#f8fafc',
      () => {
        const current = this.currentItem;
        const opts = this.currentOptions;
        if (!current || !opts) {
          return;
        }
        this.close();
        if (opts.isEquipped) {
          opts.onUnequip?.(current.slot);
        } else {
          opts.onEquip?.(current.instanceId);
        }
      }
    );

    this.addActionButton(
      children,
      btnWidth / 2 + btnGap / 2,
      btnY,
      btnWidth,
      btnHeight,
      'FECHAR',
      0x1e2433,
      0x64748b,
      '#e2e8f0',
      () => {
        const opts = this.currentOptions;
        this.close();
        opts?.onClose?.();
      }
    );

    cursorY += btnHeight + 18;
    this.cardHeight = cursorY;

    const offsetY = -this.cardHeight / 2;
    for (const child of children) {
      if ('y' in child && typeof (child as { y: number }).y === 'number') {
        (child as { y: number }).y += offsetY;
      }
      this.dynamicGroup.add(child);
    }

    const hitBlocker = this.cardContainer.getByName('cardHitBlocker') as
      | Phaser.GameObjects.Zone
      | undefined;
    hitBlocker?.setSize(this.cardWidth, this.cardHeight);

    this.drawCardFrame(
      rarityColor,
      RARITY_HEADER_BG[item.rarity],
      headerHeight
    );
  }

  private drawCardFrame(
    rarityColor: number,
    headerBgColor: number,
    headerHeight: number
  ): void {
    const w = this.cardWidth;
    const h = this.cardHeight;
    const left = -w / 2;
    const top = -h / 2;

    this.cardBg.clear();

    // Sombra externa suave 2D
    this.cardBg.fillStyle(0x000000, 0.58);
    this.cardBg.fillRoundedRect(left + 4, top + 6, w, h, 5);

    // Fundo escuro base
    this.cardBg.fillStyle(0x11141c, 0.98);
    this.cardBg.fillRoundedRect(left, top, w, h, 4);

    // Cabeçalho com gradiente simulado por raridade
    this.cardBg.fillStyle(headerBgColor, 0.94);
    this.cardBg.fillRect(left + 5, top + 5, w - 10, headerHeight + 4);
    this.cardBg.fillStyle(rarityColor, 0.16);
    this.cardBg.fillRect(
      left + 5,
      top + 5,
      w - 10,
      Math.round(headerHeight * 0.45)
    );

    // Moldura metálica dupla chanfrada 2D
    this.cardBg.lineStyle(2, 0x7a6849, 1);
    this.cardBg.strokeRect(left, top, w, h);

    this.cardBg.lineStyle(1.5, rarityColor, 0.88);
    this.cardBg.strokeRect(left + 4, top + 4, w - 8, h - 8);

    // Ornamentos nos 4 cantos
    const cornerSize = 6;
    this.cardBg.fillStyle(0x8a7552, 1);
    this.cardBg.fillRect(left + 2, top + 2, cornerSize, cornerSize);
    this.cardBg.fillRect(left + w - cornerSize - 2, top + 2, cornerSize, cornerSize);
    this.cardBg.fillRect(left + 2, top + h - cornerSize - 2, cornerSize, cornerSize);
    this.cardBg.fillRect(
      left + w - cornerSize - 2,
      top + h - cornerSize - 2,
      cornerSize,
      cornerSize
    );

    // Emblema estrela/diamante no topo central
    const topY = top + 1;
    this.cardBg.fillStyle(0x1a1e28, 1);
    this.cardBg.fillCircle(0, topY, 10);
    this.cardBg.lineStyle(1.5, 0x8a7552, 1);
    this.cardBg.strokeCircle(0, topY, 10);
    this.cardBg.fillStyle(rarityColor, 1);
    this.cardBg.fillPoints(
      [
        new Phaser.Geom.Point(0, topY - 6),
        new Phaser.Geom.Point(5, topY),
        new Phaser.Geom.Point(0, topY + 6),
        new Phaser.Geom.Point(-5, topY),
      ],
      true
    );

    // Crânio ornamental na base central
    const botY = top + h - 1;
    this.cardBg.fillStyle(0x1a1e28, 1);
    this.cardBg.fillRoundedRect(-12, botY - 8, 24, 14, 4);
    this.cardBg.lineStyle(1, 0x7a6849, 1);
    this.cardBg.strokeRoundedRect(-12, botY - 8, 24, 14, 4);
    this.cardBg.fillStyle(0xcbd5e1, 0.9);
    this.cardBg.fillCircle(0, botY - 2, 4.5);
    this.cardBg.fillRect(-2.5, botY + 1, 5, 3);
    this.cardBg.fillStyle(0x11141c, 1);
    this.cardBg.fillCircle(-1.6, botY - 2, 1.1);
    this.cardBg.fillCircle(1.6, botY - 2, 1.1);
  }

  private addOrnamentalDivider(
    children: Phaser.GameObjects.GameObject[],
    y: number,
    innerW: number
  ): number {
    const gfx = this.scene.add.graphics();
    gfx.lineStyle(1, 0x5c513e, 0.9);
    gfx.lineBetween(-innerW / 2 + 8, y + 5, -10, y + 5);
    gfx.lineBetween(10, y + 5, innerW / 2 - 8, y + 5);
    gfx.lineStyle(1.2, 0x8a7552, 1);
    gfx.strokePoints(
      [
        new Phaser.Geom.Point(0, y + 1),
        new Phaser.Geom.Point(5, y + 5),
        new Phaser.Geom.Point(0, y + 9),
        new Phaser.Geom.Point(-5, y + 5),
      ],
      true
    );
    children.push(gfx);
    return y + 14;
  }

  private addBulletStatRow(
    children: Phaser.GameObjects.GameObject[],
    y: number,
    innerW: number,
    label: string,
    delta: number,
    isPercent: boolean
  ): number {
    const leftX = -innerW / 2 + 6;
    const diamond = this.scene.add
      .text(leftX, y, '◆', {
        fontFamily: FONT_BODY,
        fontSize: '11px',
        color: '#94a3b8',
        resolution: 2,
      })
      .setOrigin(0, 0);
    children.push(diamond);

    const hasDelta = Math.abs(delta) > 0.0001;
    const deltaWidth = hasDelta ? 58 : 0;

    const text = this.scene.add
      .text(leftX + 14, y, label, {
        fontFamily: FONT_BODY,
        fontSize: '12px',
        color: '#e2e8f0',
        wordWrap: { width: innerW - 24 - deltaWidth },
        resolution: 2,
      })
      .setOrigin(0, 0);
    children.push(text);

    if (hasDelta) {
      const isUp = delta > 0;
      const deltaTxt = this.scene.add
        .text(innerW / 2 - 4, y, `(${formatSignedDelta(delta, isPercent)})`, {
          fontFamily: FONT_BODY,
          fontSize: '11px',
          color: isUp ? '#4ade80' : '#f87171',
          fontStyle: 'bold',
          resolution: 2,
        })
        .setOrigin(1, 0);
      children.push(deltaTxt);
    }

    return y + Math.max(16, text.height + 3);
  }

  private addActionButton(
    children: Phaser.GameObjects.GameObject[],
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    fillColor: number,
    borderColor: number,
    textColor: string,
    onClick: () => void
  ): void {
    const bg = this.scene.add.graphics();
    bg.fillStyle(fillColor, 0.96);
    bg.fillRoundedRect(x - width / 2, y - height / 2, width, height, 4);
    bg.lineStyle(1.5, borderColor, 0.95);
    bg.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 4);
    children.push(bg);

    const txt = this.scene.add
      .text(x, y, label, {
        fontFamily: FONT_BODY,
        fontSize: '12px',
        color: textColor,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0.5);
    children.push(txt);

    const zone = this.scene.add
      .zone(x, y, width, height)
      .setOrigin(0.5);
    if (this.pinned) {
      zone.setInteractive({ useHandCursor: true });
      zone.on(
        'pointerdown',
        (
          _pointer: Phaser.Input.Pointer,
          _lx: number,
          _ly: number,
          event?: Phaser.Types.Input.EventData
        ) => {
          event?.stopPropagation?.();
          onClick();
        }
      );
    }
    children.push(zone);
  }

  private extractStatEntries(
    bonuses: StatBonus | undefined
  ): StatDisplayEntry[] {
    if (!bonuses) {
      return [];
    }
    const result: StatDisplayEntry[] = [];
    for (const meta of STAT_META) {
      const value = bonuses[meta.key];
      if (typeof value === 'number' && value !== 0) {
        result.push({
          key: meta.key,
          label: meta.label,
          value,
          isPercent: meta.isPercent,
        });
      }
    }
    return result;
  }
}
