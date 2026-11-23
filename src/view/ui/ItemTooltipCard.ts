import Phaser from 'phaser';
import {
  EquipSlot,
  ItemInstance,
  Rarity,
  StatBonus,
  ViewportConfig,
  resolveViewportConfig,
} from '../../core/index';
import {
  DF_FONTS,
  DF_FORCE_THEME,
  DF_PALETTE,
  DF_RARITY_THEME,
  DF_SLOT_META,
  DF_UI_ICONS_KEY,
  type OrnateButtonVariant,
  drawOrnamentalDivider,
  drawOrnateButton,
  drawOrnatePanel,
  drawRaritySlotFrame,
  drawSkullCrest,
  drawStarCrest,
  formatStatNumber,
  hasUiTextureFrame,
} from './DarkFantasyUiBuilder';

export const FONT_TITLE = DF_FONTS.TITLE;
export const FONT_BODY = DF_FONTS.BODY;

export interface ItemTooltipCardOptions {
  isEquipped: boolean;
  equippedInSlot: ItemInstance | null;
  pinned?: boolean;
  onEquip?: (instanceId: string) => void;
  onUnequip?: (slot: EquipSlot) => void;
  onClose?: () => void;
}

export const SLOT_ICON_FRAME: Record<EquipSlot, number> = {
  weapon: DF_SLOT_META.weapon.iconFrame,
  armor: DF_SLOT_META.armor.iconFrame,
  amulet: DF_SLOT_META.amulet.iconFrame,
  ring: DF_SLOT_META.ring.iconFrame,
  helm: DF_SLOT_META.helm.iconFrame,
  boots: DF_SLOT_META.boots.iconFrame,
};

export const SLOT_TYPE_LABELS: Record<EquipSlot, Record<Rarity, string>> = {
  weapon: DF_SLOT_META.weapon.typeByRarity,
  armor: DF_SLOT_META.armor.typeByRarity,
  helm: DF_SLOT_META.helm.typeByRarity,
  boots: DF_SLOT_META.boots.typeByRarity,
  amulet: DF_SLOT_META.amulet.typeByRarity,
  ring: DF_SLOT_META.ring.typeByRarity,
};

const REQUIRED_LEVEL_BY_RARITY: Record<Rarity, number> = {
  common: 1,
  magic: 1,
  rare: 3,
  legendary: 5,
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
  {
    key: 'critChance',
    label: 'Chance de Acerto Crítico',
    isPercent: true,
    weight: 600,
  },
  {
    key: 'critMultiplier',
    label: 'Dano Crítico',
    isPercent: true,
    weight: 180,
  },
  { key: 'lifeSteal', label: 'Roubo de Vida', isPercent: true, weight: 700 },
  {
    key: 'cooldownReduction',
    label: 'Redução de Recarga',
    isPercent: true,
    weight: 500,
  },
  {
    key: 'moveSpeed',
    label: 'Velocidade de Movimento',
    isPercent: false,
    weight: 2,
  },
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
  return Number.isInteger(value) ? formatStatNumber(value) : value.toFixed(1);
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
        text: `${formatStatNumber(primaryVal)} de Dano por Segundo`,
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
        text: `${formatStatNumber(primaryVal)} de Armadura`,
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
        text: `+${formatStatNumber(primaryVal)} de Vida Máxima`,
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

interface CardBuildConfig {
  item: ItemInstance;
  cardWidth: number;
  badgeLabel?: string;
  compareAgainst: ItemInstance | null;
  showActionButtons: boolean;
  isEquipped: boolean;
  onPrimaryAction?: () => void;
  onCloseAction?: () => void;
}

interface BuiltCardResult {
  container: Phaser.GameObjects.Container;
  width: number;
  height: number;
}

export class ItemTooltipCard {
  private readonly scene: Phaser.Scene;
  private viewport: ViewportConfig;
  private opened = false;
  private pinned = true;
  private openedAtMs = 0;
  private currentItem: ItemInstance | null = null;
  private currentOptions:
    | (ItemTooltipCardOptions & { hoverSide?: 'left' | 'right' })
    | null = null;

  private readonly rootContainer: Phaser.GameObjects.Container;
  private readonly backdropGraphic: Phaser.GameObjects.Graphics;
  private readonly backdropZone: Phaser.GameObjects.Zone;
  private readonly cardsStage: Phaser.GameObjects.Container;
  private readonly cardHitBlocker: Phaser.GameObjects.Zone;
  private readonly dynamicGroup: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.viewport = resolveViewportConfig(
      scene.scale.width || 960,
      scene.scale.height || 540
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

    this.cardHitBlocker = scene.add
      .zone(0, 0, 10, 10)
      .setOrigin(0.5, 0.5)
      .setInteractive();
    this.cardHitBlocker.on(
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

    this.dynamicGroup = scene.add.container(0, 0);
    this.cardsStage = scene.add.container(0, 0, [
      this.cardHitBlocker,
      this.dynamicGroup,
    ]);

    this.rootContainer = scene.add
      .container(this.viewport.width / 2, this.viewport.height / 2, [
        this.backdropGraphic,
        this.backdropZone,
        this.cardsStage,
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
    this.rebuildCards();
    this.positionCardsStage();
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
      this.rebuildCards();
      this.positionCardsStage();
    }
  }

  public destroy(): void {
    this.dynamicGroup.removeAll(true);
    this.rootContainer.destroy(true);
  }

  private syncInteractivity(): void {
    if (this.pinned) {
      this.backdropGraphic.setVisible(true);
      this.backdropZone.setInteractive({ useHandCursor: false });
      this.cardHitBlocker.setInteractive();
    } else {
      this.backdropGraphic.setVisible(false);
      this.backdropZone.disableInteractive();
      this.cardHitBlocker.disableInteractive();
    }
  }

  private positionCardsStage(): void {
    if (!this.pinned) {
      const side = this.currentOptions?.hoverSide ?? 'right';
      const offsetX = Math.min(220, Math.round(this.viewport.width * 0.23));
      this.cardsStage.setPosition(side === 'left' ? -offsetX : offsetX, 0);
    } else {
      this.cardsStage.setPosition(0, 0);
    }
  }

  private rebuildCards(): void {
    const item = this.currentItem;
    const options = this.currentOptions;
    if (!item || !options) {
      return;
    }

    this.dynamicGroup.removeAll(true);

    const showSideBySideComparison =
      this.pinned &&
      !options.isEquipped &&
      options.equippedInSlot !== null;

    if (showSideBySideComparison && options.equippedInSlot) {
      const gap = 18;
      const cardW = Math.min(356, Math.floor((this.viewport.width - 56 - gap) / 2));

      const leftCard = this.buildSingleCard({
        item,
        cardWidth: cardW,
        compareAgainst: options.equippedInSlot,
        showActionButtons: true,
        isEquipped: false,
        onPrimaryAction: () => {
          const current = this.currentItem;
          const opts = this.currentOptions;
          if (!current || !opts) {
            return;
          }
          this.close();
          opts.onEquip?.(current.instanceId);
        },
        onCloseAction: () => {
          const opts = this.currentOptions;
          this.close();
          opts?.onClose?.();
        },
      });

      const rightCard = this.buildSingleCard({
        item: options.equippedInSlot,
        cardWidth: cardW,
        badgeLabel: 'EQUIPADO ATUALMENTE',
        compareAgainst: null,
        showActionButtons: false,
        isEquipped: true,
      });

      const offsetX = (cardW + gap) / 2;
      leftCard.container.setPosition(-offsetX, 0);
      rightCard.container.setPosition(offsetX, 0);

      this.dynamicGroup.add([leftCard.container, rightCard.container]);

      const totalW = cardW * 2 + gap;
      const totalH = Math.max(leftCard.height, rightCard.height);
      this.fitScaleWithinViewport(totalW, totalH);
      this.cardHitBlocker.setSize(totalW, totalH);
      return;
    }

    const singleW = Math.min(372, this.viewport.width - 48);
    const singleCard = this.buildSingleCard({
      item,
      cardWidth: singleW,
      badgeLabel: options.isEquipped ? 'EQUIPADO ATUALMENTE' : undefined,
      compareAgainst:
        !options.isEquipped && options.equippedInSlot
          ? options.equippedInSlot
          : null,
      showActionButtons: this.pinned,
      isEquipped: options.isEquipped,
      onPrimaryAction: () => {
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
      },
      onCloseAction: () => {
        const opts = this.currentOptions;
        this.close();
        opts?.onClose?.();
      },
    });

    singleCard.container.setPosition(0, 0);
    this.dynamicGroup.add(singleCard.container);

    this.fitScaleWithinViewport(singleCard.width, singleCard.height);
    this.cardHitBlocker.setSize(singleCard.width, singleCard.height);
  }

  private fitScaleWithinViewport(contentW: number, contentH: number): void {
    const maxW = this.viewport.width - 28;
    const maxH = this.viewport.height - 28;
    const scaleX = contentW > maxW ? maxW / contentW : 1;
    const scaleY = contentH > maxH ? maxH / contentH : 1;
    const scale = Math.min(1, scaleX, scaleY);
    this.dynamicGroup.setScale(scale);
  }

  private buildSingleCard(cfg: CardBuildConfig): BuiltCardResult {
    const { item, cardWidth } = cfg;
    const theme = DF_RARITY_THEME[item.rarity];
    const slotMeta = DF_SLOT_META[item.slot];
    const forceTheme = DF_FORCE_THEME[item.force];

    const padX = 18;
    const innerW = cardWidth - padX * 2;
    const children: Phaser.GameObjects.GameObject[] = [];
    const bgGfx = this.scene.add.graphics();

    let cursorY = 18;

    // Badge superior opcional ("EQUIPADO ATUALMENTE")
    if (cfg.badgeLabel) {
      const badgeTxt = this.scene.add
        .text(0, cursorY, cfg.badgeLabel, {
          fontFamily: DF_FONTS.TITLE,
          fontSize: '10px',
          color: DF_PALETTE.textGold,
          fontStyle: 'bold',
          align: 'center',
          resolution: 2,
        })
        .setOrigin(0.5, 0);
      children.push(badgeTxt);
      cursorY += badgeTxt.height + 4;
    }

    // 1. Nome do item + Subtítulo de raridade e slot
    const titleText = this.scene.add
      .text(0, cursorY, item.name.toUpperCase(), {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '15px',
        color: theme.hex,
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: innerW - 10 },
        resolution: 2,
      })
      .setOrigin(0.5, 0);
    children.push(titleText);
    cursorY += titleText.height + 3;

    const typeSubtitle =
      slotMeta.typeByRarity[item.rarity] ?? `${slotMeta.labelTitle} ${theme.label}`;
    const subtitleText = this.scene.add
      .text(0, cursorY, typeSubtitle, {
        fontFamily: DF_FONTS.BODY,
        fontSize: '11px',
        color: DF_PALETTE.textLight,
        align: 'center',
        resolution: 2,
      })
      .setOrigin(0.5, 0);
    children.push(subtitleText);
    cursorY += subtitleText.height + 10;

    const headerHeight = cursorY - 6;

    // 2. Caixa do ícone 2D (ui_icons frames 12..17) à esquerda + Poder do Item à direita
    const iconBoxSize = 66;
    const iconBoxX = -innerW / 2 + iconBoxSize / 2;
    const iconBoxY = cursorY + iconBoxSize / 2;

    const iconFrameGfx = this.scene.add.graphics();
    drawRaritySlotFrame(iconFrameGfx, {
      x: iconBoxX - iconBoxSize / 2,
      y: iconBoxY - iconBoxSize / 2,
      width: iconBoxSize,
      height: iconBoxSize,
      rarity: item.rarity,
      bevel: 6,
      gemColor: item.force !== 'none' ? forceTheme.color : theme.gemColor,
      showTopGem: true,
      showCornerGem: true,
    });
    children.push(iconFrameGfx);

    if (hasUiTextureFrame(this.scene, DF_UI_ICONS_KEY, slotMeta.iconFrame)) {
      const iconImg = this.scene.add
        .image(iconBoxX, iconBoxY, DF_UI_ICONS_KEY, slotMeta.iconFrame)
        .setOrigin(0.5)
        .setDisplaySize(iconBoxSize - 14, iconBoxSize - 14);
      children.push(iconImg);
    } else {
      const fallbackTxt = this.scene.add
        .text(iconBoxX, iconBoxY, slotMeta.labelUpper[0] ?? '?', {
          fontFamily: DF_FONTS.TITLE,
          fontSize: '22px',
          color: theme.hex,
          fontStyle: 'bold',
          resolution: 2,
        })
        .setOrigin(0.5);
      children.push(fallbackTxt);
    }

    const powerScore = calculateItemPower(item);
    const powerCenterX =
      iconBoxX + iconBoxSize / 2 + (innerW - iconBoxSize) / 2;

    const powerNumText = this.scene.add
      .text(powerCenterX, iconBoxY - 12, formatStatNumber(powerScore), {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '26px',
        color: DF_PALETTE.textParchment,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0.5);
    children.push(powerNumText);

    const powerLabelText = this.scene.add
      .text(powerCenterX, iconBoxY + 12, 'Poder do Item', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '11px',
        color: DF_PALETTE.textMuted,
        resolution: 2,
      })
      .setOrigin(0.5);
    children.push(powerLabelText);

    if (cfg.compareAgainst) {
      const eqPower = calculateItemPower(cfg.compareAgainst);
      const powerDelta = powerScore - eqPower;
      if (powerDelta !== 0) {
        const isUp = powerDelta > 0;
        const deltaBadge = this.scene.add
          .text(
            powerCenterX,
            iconBoxY + 25,
            `${isUp ? '▲ +' : '▼ '}${formatStatNumber(powerDelta)} vs. Equipado`,
            {
              fontFamily: DF_FONTS.BODY,
              fontSize: '10px',
              color: isUp ? DF_PALETTE.textSuccess : DF_PALETTE.textDanger,
              fontStyle: 'bold',
              resolution: 2,
            }
          )
          .setOrigin(0.5);
        children.push(deltaBadge);
      }
    }

    cursorY += iconBoxSize + 10;

    // 3. Divisor ornamental
    cursorY = this.addDivider(children, cursorY, innerW);

    // 4. Atributo primário por slot + Comparação
    const baseEntries = this.extractStatEntries(item.baseBonuses);
    const equippedCombined = cfg.compareAgainst
      ? combineItemStats(cfg.compareAgainst)
      : null;
    const itemCombined = combineItemStats(item);

    const primaryAttr = formatPrimarySlotAttribute(item, itemCombined, powerScore);
    const primaryText = this.scene.add
      .text(0, cursorY, primaryAttr.text, {
        fontFamily: DF_FONTS.BODY,
        fontSize: '14px',
        color: DF_PALETTE.textParchment,
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: innerW },
        resolution: 2,
      })
      .setOrigin(0.5, 0);
    children.push(primaryText);
    cursorY += primaryText.height + 4;

    if (equippedCombined) {
      const primaryDelta =
        (itemCombined[primaryAttr.statKey] ?? 0) -
        (equippedCombined[primaryAttr.statKey] ?? 0);
      if (Math.abs(primaryDelta) > 0.0001) {
        const isUp = primaryDelta > 0;
        const deltaText = this.scene.add
          .text(
            0,
            cursorY,
            `${isUp ? '▲' : '▼'} ${formatSignedDelta(primaryDelta, primaryAttr.isPercent)} ${primaryAttr.label}`,
            {
              fontFamily: DF_FONTS.BODY,
              fontSize: '11px',
              color: isUp ? DF_PALETTE.textSuccess : DF_PALETTE.textDanger,
              fontStyle: 'bold',
              resolution: 2,
            }
          )
          .setOrigin(0.5, 0);
        children.push(deltaText);
        cursorY += deltaText.height + 4;
      }
    }

    // Demais stats base (exceto o atributo primário)
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

    // 5. Lista de afixos com marcador ◆ e deltas verde/vermelho
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

    cursorY += 4;

    // 6. Aspecto Lendário ★
    if (item.legendaryPower) {
      cursorY = this.addDivider(children, cursorY, innerW);
      const legendText = this.scene.add
        .text(
          -innerW / 2 + 2,
          cursorY,
          `★ ${item.legendaryPower.name}: ${item.legendaryPower.description}`,
          {
            fontFamily: DF_FONTS.BODY,
            fontSize: '11px',
            color: DF_RARITY_THEME.legendary.accentHex,
            wordWrap: { width: innerW - 4 },
            lineSpacing: 2,
            resolution: 2,
          }
        )
        .setOrigin(0, 0);
      children.push(legendText);
      cursorY += legendText.height + 6;
    }

    // 7. Rodapé informativo: Força + Nível Requerido
    cursorY = this.addDivider(children, cursorY, innerW);

    const reqLevel = REQUIRED_LEVEL_BY_RARITY[item.rarity];
    const forceText = this.scene.add
      .text(-innerW / 2 + 4, cursorY, `Força: ${forceTheme.label}`, {
        fontFamily: DF_FONTS.BODY,
        fontSize: '11px',
        color: forceTheme.hex,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0, 0);
    children.push(forceText);

    const reqLevelText = this.scene.add
      .text(innerW / 2 - 4, cursorY, `Nível Requerido: ${reqLevel}`, {
        fontFamily: DF_FONTS.BODY,
        fontSize: '11px',
        color: DF_PALETTE.textMuted,
        resolution: 2,
      })
      .setOrigin(1, 0);
    children.push(reqLevelText);

    cursorY += Math.max(forceText.height, reqLevelText.height) + 10;

    // 8. Botões grandes para toque/mouse (EQUIPAR/DESEQUIPAR + FECHAR)
    if (cfg.showActionButtons) {
      const btnHeight = 36;
      const btnGap = 12;
      const btnWidth = (innerW - btnGap) / 2;
      const btnY = cursorY + btnHeight / 2;

      const primaryLabel = cfg.isEquipped ? 'DESEQUIPAR' : 'EQUIPAR';
      const primaryVariant: OrnateButtonVariant = cfg.isEquipped
        ? 'crimson'
        : 'emerald';

      this.addActionButton(
        children,
        -btnWidth / 2 - btnGap / 2,
        btnY,
        btnWidth,
        btnHeight,
        primaryLabel,
        primaryVariant,
        () => cfg.onPrimaryAction?.()
      );

      this.addActionButton(
        children,
        btnWidth / 2 + btnGap / 2,
        btnY,
        btnWidth,
        btnHeight,
        'FECHAR',
        'iron',
        () => cfg.onCloseAction?.()
      );

      cursorY += btnHeight + 18;
    } else {
      cursorY += 14;
    }

    const cardHeight = cursorY;
    const left = -cardWidth / 2;
    const top = -cardHeight / 2;

    drawOrnatePanel(bgGfx, {
      x: left,
      y: top,
      width: cardWidth,
      height: cardHeight,
      bevel: 10,
      fillColor: DF_PALETTE.obsidianBg,
      fillAlpha: 0.98,
      innerFillColor: DF_PALETTE.innerSurface,
      outerBorderColor: DF_PALETTE.bronzeBorder,
      innerBorderColor: theme.border,
      accentColor: theme.gemColor,
      headerHeight,
      headerColor: theme.headerBg,
      headerGlowColor: theme.headerGlow,
      headerGlowAlpha: 0.22,
      shadow: true,
      cornerOrnaments: true,
    });

    // Emblema estrela no topo central
    drawStarCrest(
      bgGfx,
      0,
      top + 1,
      item.rarity === 'legendary' ? 1.05 : 0.85,
      theme.border,
      DF_PALETTE.agedGold
    );

    // Crânio ornamental no rodapé central
    drawSkullCrest(bgGfx, 0, top + cardHeight - 1, 0.82);

    const offsetY = -cardHeight / 2;
    for (const child of children) {
      if ('y' in child && typeof (child as { y: number }).y === 'number') {
        (child as { y: number }).y += offsetY;
      }
    }

    const container = this.scene.add.container(0, 0, [bgGfx, ...children]);
    return {
      container,
      width: cardWidth,
      height: cardHeight,
    };
  }

  private addDivider(
    children: Phaser.GameObjects.GameObject[],
    y: number,
    innerW: number
  ): number {
    const gfx = this.scene.add.graphics();
    drawOrnamentalDivider(gfx, -innerW / 2 + 4, y + 5, innerW - 8);
    children.push(gfx);
    return y + 13;
  }

  private addBulletStatRow(
    children: Phaser.GameObjects.GameObject[],
    y: number,
    innerW: number,
    label: string,
    delta: number,
    isPercent: boolean
  ): number {
    const leftX = -innerW / 2 + 4;
    const diamond = this.scene.add
      .text(leftX, y, '◆', {
        fontFamily: DF_FONTS.BODY,
        fontSize: '10px',
        color: DF_PALETTE.textGold,
        resolution: 2,
      })
      .setOrigin(0, 0);
    children.push(diamond);

    const hasDelta = Math.abs(delta) > 0.0001;
    const deltaWidth = hasDelta ? 62 : 0;

    const text = this.scene.add
      .text(leftX + 14, y, label, {
        fontFamily: DF_FONTS.BODY,
        fontSize: '12px',
        color: DF_PALETTE.textLight,
        wordWrap: { width: innerW - 22 - deltaWidth },
        resolution: 2,
      })
      .setOrigin(0, 0);
    children.push(text);

    if (hasDelta) {
      const isUp = delta > 0;
      const deltaTxt = this.scene.add
        .text(innerW / 2 - 4, y, `(${formatSignedDelta(delta, isPercent)})`, {
          fontFamily: DF_FONTS.BODY,
          fontSize: '11px',
          color: isUp ? DF_PALETTE.textSuccess : DF_PALETTE.textDanger,
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
    variant: OrnateButtonVariant,
    onClick: () => void
  ): void {
    const bg = this.scene.add.graphics();
    const renderBtn = (hovered: boolean) => {
      drawOrnateButton(bg, x - width / 2, y - height / 2, width, height, {
        variant,
        bevel: 6,
        hovered,
        clear: true,
      });
    };
    renderBtn(false);
    children.push(bg);

    const txt = this.scene.add
      .text(x, y, label, {
        fontFamily: DF_FONTS.TITLE,
        fontSize: '12px',
        color: DF_PALETTE.textParchment,
        fontStyle: 'bold',
        resolution: 2,
      })
      .setOrigin(0.5);
    children.push(txt);

    const zone = this.scene.add.zone(x, y, width, height).setOrigin(0.5);
    if (this.pinned) {
      zone.setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => renderBtn(true));
      zone.on('pointerout', () => renderBtn(false));
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
