import Phaser from 'phaser';
import { EquipSlot, ForceType, Rarity } from '../../core/index';

export const DF_FONTS = {
  TITLE: "'Cinzel', 'Palatino Linotype', 'Book Antiqua', Georgia, serif",
  BODY: "'Segoe UI', 'Inter', system-ui, -apple-system, sans-serif",
} as const;

export const DF_PALETTE = {
  obsidianBg: 0x0c0e14,
  innerSurface: 0x141822,
  deepRecess: 0x090b10,
  metalBorder: 0x4b5563,
  metalHighlight: 0x6b7280,
  metalDark: 0x262d3a,
  bronzeBorder: 0x8a7048,
  bronzeDark: 0x5c4a30,
  agedGold: 0xd4a95a,
  goldBright: 0xf1d28a,
  shadow: 0x000000,
  headerBg: 0x1d212d,
  textParchment: '#f3e6cc',
  textLight: '#e2e8f0',
  textMuted: '#94a3b8',
  textGold: '#e7c47a',
  textSuccess: '#4ade80',
  textDanger: '#f87171',
  textCrimson: '#fb7185',
  textBlue: '#60a5fa',
  buttonGoldFill: 0x382a16,
  buttonGoldBorder: 0xd4a95a,
  buttonGoldHighlight: 0xf1d28a,
  buttonCrimsonFill: 0x45171d,
  buttonCrimsonBorder: 0xc9414f,
  buttonCrimsonHighlight: 0xf4717f,
  buttonBlueFill: 0x162944,
  buttonBlueBorder: 0x4f8bd6,
  buttonBlueHighlight: 0x93c5fd,
  buttonEmeraldFill: 0x133326,
  buttonEmeraldBorder: 0x34a875,
  buttonEmeraldHighlight: 0x6ee7b7,
  buttonIronFill: 0x1e2432,
  buttonIronBorder: 0x647082,
  buttonIronHighlight: 0x94a3b8,
  buttonDisabledFill: 0x171b24,
  buttonDisabledBorder: 0x374151,
} as const;

export interface RarityVisualTheme {
  label: string;
  hex: string;
  border: number;
  innerBorder: number;
  headerBg: number;
  headerGlow: number;
  slotBg: number;
  gemColor: number;
  accentHex: string;
}

export const DF_RARITY_THEME: Record<Rarity, RarityVisualTheme> = {
  common: {
    label: 'Comum',
    hex: '#94a3b8',
    border: 0x94a3b8,
    innerBorder: 0x64748b,
    headerBg: 0x252b37,
    headerGlow: 0x475569,
    slotBg: 0x181e29,
    gemColor: 0x94a3b8,
    accentHex: '#cbd5e1',
  },
  magic: {
    label: 'Mágico',
    hex: '#60a5fa',
    border: 0x60a5fa,
    innerBorder: 0x3b82f6,
    headerBg: 0x162945,
    headerGlow: 0x2563eb,
    slotBg: 0x132238,
    gemColor: 0x38bdf8,
    accentHex: '#93c5fd',
  },
  rare: {
    label: 'Raro',
    hex: '#facc15',
    border: 0xfacc15,
    innerBorder: 0xd4a017,
    headerBg: 0x3a2f12,
    headerGlow: 0xca8a04,
    slotBg: 0x2c2410,
    gemColor: 0xfde047,
    accentHex: '#fde047',
  },
  legendary: {
    label: 'Lendário',
    hex: '#f97316',
    border: 0xf97316,
    innerBorder: 0xea580c,
    headerBg: 0x472111,
    headerGlow: 0xea580c,
    slotBg: 0x37190c,
    gemColor: 0xfb923c,
    accentHex: '#fdba74',
  },
};

export interface ForceVisualTheme {
  label: string;
  hex: string;
  color: number;
}

export const DF_FORCE_THEME: Record<ForceType, ForceVisualTheme> = {
  inferno: {
    label: 'Inferno',
    hex: '#f97316',
    color: 0xf97316,
  },
  submundo: {
    label: 'Submundo',
    hex: '#fb7185',
    color: 0xfb7185,
  },
  empireo: {
    label: 'Empíreo',
    hex: '#fde047',
    color: 0xfde047,
  },
  none: {
    label: 'Neutro',
    hex: '#94a3b8',
    color: 0x94a3b8,
  },
};

export const DF_UI_ICONS_KEY = 'ui_icons' as const;

export const DF_UI_ICON_FRAMES = {
  attack: 0,
  dash: 1,
  skillInferno: 2,
  skillEmpireo: 3,
  skillSubmundo: 4,
  potion: 5,
  bag: 6,
  settings: 7,
  audioOn: 8,
  audioOff: 9,
  souls: 10,
  essence: 11,
  slotWeapon: 12,
  slotArmor: 13,
  slotAmulet: 14,
  slotRing: 15,
  slotHelm: 16,
  slotBoots: 17,
} as const;

export const DF_EQUIP_SLOT_ORDER: readonly EquipSlot[] = [
  'helm',
  'weapon',
  'armor',
  'amulet',
  'boots',
  'ring',
];

export type SlotLabelUpper =
  | 'ELMO'
  | 'ARMA'
  | 'ARMADURA'
  | 'AMULETO'
  | 'BOTA'
  | 'ANEL';

export type SlotLabelTitle =
  | 'Elmo'
  | 'Arma'
  | 'Armadura'
  | 'Amuleto'
  | 'Bota'
  | 'Anel';

export interface SlotVisualMeta {
  labelUpper: SlotLabelUpper;
  labelTitle: SlotLabelTitle;
  iconFrame: number;
  typeByRarity: Record<Rarity, string>;
}

export const DF_SLOT_META: Record<EquipSlot, SlotVisualMeta> = {
  helm: {
    labelUpper: 'ELMO',
    labelTitle: 'Elmo',
    iconFrame: 16,
    typeByRarity: {
      common: 'Elmo Comum',
      magic: 'Elmo Mágico',
      rare: 'Elmo Raro',
      legendary: 'Elmo Lendário',
    },
  },
  weapon: {
    labelUpper: 'ARMA',
    labelTitle: 'Arma',
    iconFrame: 12,
    typeByRarity: {
      common: 'Arma Comum',
      magic: 'Arma Mágica',
      rare: 'Arma Rara',
      legendary: 'Arma de Duas Mãos Lendária',
    },
  },
  armor: {
    labelUpper: 'ARMADURA',
    labelTitle: 'Armadura',
    iconFrame: 13,
    typeByRarity: {
      common: 'Armadura de Peito Comum',
      magic: 'Armadura de Peito Mágica',
      rare: 'Armadura de Peito Rara',
      legendary: 'Armadura de Peito Lendária',
    },
  },
  amulet: {
    labelUpper: 'AMULETO',
    labelTitle: 'Amuleto',
    iconFrame: 14,
    typeByRarity: {
      common: 'Amuleto Comum',
      magic: 'Amuleto Mágico',
      rare: 'Amuleto Raro',
      legendary: 'Amuleto Lendário',
    },
  },
  boots: {
    labelUpper: 'BOTA',
    labelTitle: 'Bota',
    iconFrame: 17,
    typeByRarity: {
      common: 'Botas Comuns',
      magic: 'Botas Mágicas',
      rare: 'Botas Raras',
      legendary: 'Botas Lendárias',
    },
  },
  ring: {
    labelUpper: 'ANEL',
    labelTitle: 'Anel',
    iconFrame: 15,
    typeByRarity: {
      common: 'Anel Comum',
      magic: 'Anel Mágico',
      rare: 'Anel Raro',
      legendary: 'Anel Lendário',
    },
  },
};

export interface OrnatePanelOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  bevel?: number;
  fillColor?: number;
  fillAlpha?: number;
  innerFillColor?: number;
  outerBorderColor?: number;
  innerBorderColor?: number;
  accentColor?: number;
  headerHeight?: number;
  headerColor?: number;
  headerGlowColor?: number;
  headerGlowAlpha?: number;
  shadow?: boolean;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowAlpha?: number;
  cornerOrnaments?: boolean;
  clear?: boolean;
}

export interface RaritySlotFrameOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  rarity?: Rarity | null;
  bevel?: number;
  selected?: boolean;
  hovered?: boolean;
  empty?: boolean;
  fillColor?: number;
  gemColor?: number;
  showTopGem?: boolean;
  showCornerGem?: boolean;
  clear?: boolean;
}

export type OrnateButtonVariant =
  | 'gold'
  | 'crimson'
  | 'blue'
  | 'emerald'
  | 'iron';

export interface OrnateButtonOptions {
  variant?: OrnateButtonVariant;
  bevel?: number;
  hovered?: boolean;
  pressed?: boolean;
  disabled?: boolean;
  fillColor?: number;
  borderColor?: number;
  highlightColor?: number;
  clear?: boolean;
}

export interface DarkFantasyTextOptions {
  fontSize?: number | string;
  color?: string;
  fontStyle?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  wordWrapWidth?: number;
  lineSpacing?: number;
  stroke?: string;
  strokeThickness?: number;
  shadow?: boolean;
  originX?: number;
  originY?: number;
  resolution?: number;
}

interface ButtonPalette {
  fill: number;
  border: number;
  highlight: number;
}

const BUTTON_VARIANTS: Record<OrnateButtonVariant, ButtonPalette> = {
  gold: {
    fill: DF_PALETTE.buttonGoldFill,
    border: DF_PALETTE.buttonGoldBorder,
    highlight: DF_PALETTE.buttonGoldHighlight,
  },
  crimson: {
    fill: DF_PALETTE.buttonCrimsonFill,
    border: DF_PALETTE.buttonCrimsonBorder,
    highlight: DF_PALETTE.buttonCrimsonHighlight,
  },
  blue: {
    fill: DF_PALETTE.buttonBlueFill,
    border: DF_PALETTE.buttonBlueBorder,
    highlight: DF_PALETTE.buttonBlueHighlight,
  },
  emerald: {
    fill: DF_PALETTE.buttonEmeraldFill,
    border: DF_PALETTE.buttonEmeraldBorder,
    highlight: DF_PALETTE.buttonEmeraldHighlight,
  },
  iron: {
    fill: DF_PALETTE.buttonIronFill,
    border: DF_PALETTE.buttonIronBorder,
    highlight: DF_PALETTE.buttonIronHighlight,
  },
};

function clampUnit(value: number): number {
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

function blendHexColor(colorA: number, colorB: number, t: number): number {
  const ratio = clampUnit(t);
  const rA = (colorA >> 16) & 0xff;
  const gA = (colorA >> 8) & 0xff;
  const bA = colorA & 0xff;

  const rB = (colorB >> 16) & 0xff;
  const gB = (colorB >> 8) & 0xff;
  const bB = colorB & 0xff;

  const r = Math.round(rA + (rB - rA) * ratio);
  const g = Math.round(gA + (gB - gA) * ratio);
  const b = Math.round(bA + (bB - bA) * ratio);

  return (r << 16) | (g << 8) | b;
}

/**
 * Retorna os pontos de um retângulo com os 4 cantos chanfrados (octógono simétrico).
 */
export function getChamferPoints(
  x: number,
  y: number,
  w: number,
  h: number,
  bevel: number
): Phaser.Geom.Point[] {
  const safeW = Math.max(0, w);
  const safeH = Math.max(0, h);
  const b = Math.max(0, Math.min(bevel, safeW / 2, safeH / 2));

  if (b === 0) {
    return [
      new Phaser.Geom.Point(x, y),
      new Phaser.Geom.Point(x + safeW, y),
      new Phaser.Geom.Point(x + safeW, y + safeH),
      new Phaser.Geom.Point(x, y + safeH),
    ];
  }

  return [
    new Phaser.Geom.Point(x + b, y),
    new Phaser.Geom.Point(x + safeW - b, y),
    new Phaser.Geom.Point(x + safeW, y + b),
    new Phaser.Geom.Point(x + safeW, y + safeH - b),
    new Phaser.Geom.Point(x + safeW - b, y + safeH),
    new Phaser.Geom.Point(x + b, y + safeH),
    new Phaser.Geom.Point(x, y + safeH - b),
    new Phaser.Geom.Point(x, y + b),
  ];
}

function drawDiamond(
  gfx: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fillColor?: number,
  fillAlpha = 1,
  strokeColor?: number,
  strokeWidth = 1,
  strokeAlpha = 1
): void {
  const pts = [
    new Phaser.Geom.Point(cx, cy - ry),
    new Phaser.Geom.Point(cx + rx, cy),
    new Phaser.Geom.Point(cx, cy + ry),
    new Phaser.Geom.Point(cx - rx, cy),
  ];
  if (typeof fillColor === 'number') {
    gfx.fillStyle(fillColor, fillAlpha);
    gfx.fillPoints(pts, true);
  }
  if (typeof strokeColor === 'number') {
    gfx.lineStyle(strokeWidth, strokeColor, strokeAlpha);
    gfx.strokePoints(pts, true);
  }
}

/**
 * Desenha janela/modal 2D Dark Fantasy com sombra projetada, corpo obsidiana
 * chanfrado, faixa opcional de cabeçalho em degradê por degraus suaves, moldura
 * externa metálica dupla, linha interna dourada/bronze e ornamentos de canto.
 */
export function drawOrnatePanel(
  gfx: Phaser.GameObjects.Graphics,
  opts: OrnatePanelOptions
): void {
  if (opts.clear) {
    gfx.clear();
  }

  const { x, y, width, height } = opts;
  const bevel = opts.bevel ?? 10;
  const fillColor = opts.fillColor ?? DF_PALETTE.obsidianBg;
  const fillAlpha = opts.fillAlpha ?? 0.97;
  const innerFillColor = opts.innerFillColor ?? DF_PALETTE.innerSurface;
  const outerBorderColor = opts.outerBorderColor ?? DF_PALETTE.metalBorder;
  const innerBorderColor = opts.innerBorderColor ?? DF_PALETTE.bronzeBorder;
  const accentColor = opts.accentColor ?? DF_PALETTE.agedGold;
  const headerHeight = opts.headerHeight ?? 0;
  const headerColor = opts.headerColor ?? DF_PALETTE.headerBg;
  const headerGlowColor = opts.headerGlowColor ?? accentColor;
  const headerGlowAlpha = opts.headerGlowAlpha ?? 0.18;
  const showShadow = opts.shadow ?? true;
  const shadowOffsetX = opts.shadowOffsetX ?? 4;
  const shadowOffsetY = opts.shadowOffsetY ?? 6;
  const shadowAlpha = opts.shadowAlpha ?? 0.55;
  const cornerOrnaments = opts.cornerOrnaments ?? true;

  // 1. Sombra projetada chanfrada
  if (showShadow) {
    const shadowPts = getChamferPoints(
      x + shadowOffsetX,
      y + shadowOffsetY,
      width,
      height,
      bevel
    );
    gfx.fillStyle(DF_PALETTE.shadow, shadowAlpha);
    gfx.fillPoints(shadowPts, true);
  }

  // 2. Corpo obsidiana externo
  const outerPts = getChamferPoints(x, y, width, height, bevel);
  gfx.fillStyle(fillColor, fillAlpha);
  gfx.fillPoints(outerPts, true);

  // 3. Superfície interna recuada
  const inset = 4;
  const innerW = Math.max(0, width - inset * 2);
  const innerH = Math.max(0, height - inset * 2);
  const innerBevel = Math.max(0, bevel - 2);
  const innerPts = getChamferPoints(
    x + inset,
    y + inset,
    innerW,
    innerH,
    innerBevel
  );
  if (innerW > 0 && innerH > 0) {
    gfx.fillStyle(innerFillColor, Math.min(1, fillAlpha));
    gfx.fillPoints(innerPts, true);
  }

  // 4. Faixa opcional de cabeçalho com degradê suave em degraus
  if (headerHeight > 0 && innerW > 4) {
    const clampedHeaderH = Math.min(headerHeight, Math.max(0, innerH - 2));
    const hTop = y + inset;
    const steps = 6;
    const stepH = clampedHeaderH / steps;
    const topBandColor = blendHexColor(headerColor, headerGlowColor, 0.28);
    const bottomBandColor = blendHexColor(headerColor, fillColor, 0.35);

    for (let i = 0; i < steps; i++) {
      const bandTop = hTop + i * stepH;
      const bandBottom = hTop + (i + 1) * stepH;
      const bandT = steps > 1 ? i / (steps - 1) : 0;
      const bandColor = blendHexColor(topBandColor, bottomBandColor, bandT);
      const trim =
        bandTop - hTop < innerBevel
          ? Math.max(0, innerBevel - (bandTop - hTop))
          : 0;
      const bandX = x + inset + trim;
      const bandW = Math.max(0, innerW - trim * 2);
      if (bandW > 0) {
        gfx.fillStyle(bandColor, 0.94);
        gfx.fillRect(bandX, bandTop, bandW, bandBottom - bandTop + 0.5);
      }
    }

    // Brilho superior discreto no cabeçalho
    const glowH = Math.max(2, Math.round(clampedHeaderH * 0.36));
    const glowX = x + inset + innerBevel;
    const glowW = Math.max(0, innerW - innerBevel * 2);
    if (glowW > 0) {
      gfx.fillStyle(headerGlowColor, headerGlowAlpha);
      gfx.fillRect(glowX, hTop + 1, glowW, glowH);
    }

    // Linha divisória metálica sob o cabeçalho
    const dividerY = hTop + clampedHeaderH;
    gfx.lineStyle(1.5, innerBorderColor, 0.95);
    gfx.lineBetween(x + inset + 2, dividerY, x + width - inset - 2, dividerY);
    gfx.lineStyle(1, accentColor, 0.45);
    gfx.lineBetween(
      x + inset + 12,
      dividerY - 1.5,
      x + width - inset - 12,
      dividerY - 1.5
    );
  }

  // 5. Moldura externa metálica dupla + filete interno dourado/bronze
  gfx.lineStyle(2.5, outerBorderColor, 1);
  gfx.strokePoints(outerPts, true);

  const midPts = getChamferPoints(
    x + 2,
    y + 2,
    Math.max(0, width - 4),
    Math.max(0, height - 4),
    Math.max(0, bevel - 1)
  );
  gfx.lineStyle(1, DF_PALETTE.metalDark, 0.9);
  gfx.strokePoints(midPts, true);

  if (innerW > 0 && innerH > 0) {
    gfx.lineStyle(1.25, innerBorderColor, 0.95);
    gfx.strokePoints(innerPts, true);
  }

  // 6. Ornamentos metálicos nos 4 cantos (losangos/rebites)
  if (cornerOrnaments && width >= 36 && height >= 36) {
    const offset = Math.max(6, Math.round(bevel * 0.65) + 2);
    const corners: Array<{ cx: number; cy: number }> = [
      { cx: x + offset, cy: y + offset },
      { cx: x + width - offset, cy: y + offset },
      { cx: x + width - offset, cy: y + height - offset },
      { cx: x + offset, cy: y + height - offset },
    ];
    for (const corner of corners) {
      drawDiamond(
        gfx,
        corner.cx,
        corner.cy,
        4.2,
        4.2,
        DF_PALETTE.metalDark,
        1,
        innerBorderColor,
        1.1,
        1
      );
      drawDiamond(gfx, corner.cx, corner.cy, 1.8, 1.8, accentColor, 0.95);
    }
  }
}

/**
 * Desenha caixa de slot 2D de equipamento/item com moldura escura externa,
 * moldura interna na cor da raridade, chanfros triangulares laterais, losango
 * de gema no topo central e engaste circular de gema no canto inferior direito.
 */
export function drawRaritySlotFrame(
  gfx: Phaser.GameObjects.Graphics,
  opts: RaritySlotFrameOptions
): void {
  if (opts.clear) {
    gfx.clear();
  }

  const { x, y, width, height } = opts;
  const bevel = opts.bevel ?? 6;
  const isEmpty = opts.empty ?? !opts.rarity;
  const theme = opts.rarity ? DF_RARITY_THEME[opts.rarity] : null;
  const selected = opts.selected ?? false;
  const hovered = opts.hovered ?? false;

  const baseFill =
    opts.fillColor ??
    (isEmpty || !theme ? DF_PALETTE.innerSurface : theme.slotBg);
  const rarityBorder =
    isEmpty || !theme ? DF_PALETTE.metalBorder : theme.border;
  const rarityInner =
    isEmpty || !theme ? DF_PALETTE.metalDark : theme.innerBorder;
  const gemColor =
    opts.gemColor ?? (isEmpty || !theme ? DF_PALETTE.metalDark : theme.gemColor);

  const outerPts = getChamferPoints(x, y, width, height, bevel);
  const inset = 3;
  const innerW = Math.max(0, width - inset * 2);
  const innerH = Math.max(0, height - inset * 2);
  const innerPts = getChamferPoints(
    x + inset,
    y + inset,
    innerW,
    innerH,
    Math.max(0, bevel - 2)
  );

  // Moldura escura externa
  gfx.fillStyle(DF_PALETTE.obsidianBg, 0.98);
  gfx.fillPoints(outerPts, true);

  // Fundo interno do slot
  if (innerW > 0 && innerH > 0) {
    gfx.fillStyle(baseFill, 0.96);
    gfx.fillPoints(innerPts, true);

    // Brilho sutil no terço superior
    const sheenColor = isEmpty || !theme ? DF_PALETTE.metalHighlight : theme.headerGlow;
    const sheenAlpha = hovered || selected ? 0.24 : isEmpty ? 0.08 : 0.16;
    const sheenTrim = Math.max(0, bevel - 2);
    const sheenW = Math.max(0, innerW - sheenTrim * 2);
    if (sheenW > 0) {
      gfx.fillStyle(sheenColor, sheenAlpha);
      gfx.fillRect(
        x + inset + sheenTrim,
        y + inset + 1,
        sheenW,
        Math.max(3, Math.round(innerH * 0.34))
      );
    }
  }

  // Contorno externo metálico escuro
  gfx.lineStyle(
    selected ? 2.2 : 1.8,
    selected ? DF_PALETTE.goldBright : hovered ? DF_PALETTE.bronzeBorder : 0x363e4d,
    1
  );
  gfx.strokePoints(outerPts, true);

  // Moldura interna na cor da raridade
  if (innerW > 0 && innerH > 0) {
    gfx.lineStyle(selected || hovered ? 2.2 : 1.7, rarityBorder, isEmpty ? 0.72 : 0.96);
    gfx.strokePoints(innerPts, true);

    if (innerW > 10 && innerH > 10) {
      const deepPts = getChamferPoints(
        x + inset + 2,
        y + inset + 2,
        innerW - 4,
        innerH - 4,
        Math.max(0, bevel - 3)
      );
      gfx.lineStyle(0.9, rarityInner, isEmpty ? 0.35 : 0.55);
      gfx.strokePoints(deepPts, true);
    }
  }

  // Chanfros triangulares laterais (esquerdo e direito no eixo central)
  const midY = y + height / 2;
  const notchDepth = Math.min(5, Math.max(3, Math.round(width * 0.08)));
  const notchHalfH = Math.min(7, Math.max(4, Math.round(height * 0.12)));

  const leftNotch = [
    new Phaser.Geom.Point(x + 1, midY - notchHalfH),
    new Phaser.Geom.Point(x + 1 + notchDepth, midY),
    new Phaser.Geom.Point(x + 1, midY + notchHalfH),
  ];
  const rightNotch = [
    new Phaser.Geom.Point(x + width - 1, midY - notchHalfH),
    new Phaser.Geom.Point(x + width - 1 - notchDepth, midY),
    new Phaser.Geom.Point(x + width - 1, midY + notchHalfH),
  ];
  gfx.fillStyle(DF_PALETTE.obsidianBg, 1);
  gfx.fillPoints(leftNotch, true);
  gfx.fillPoints(rightNotch, true);
  gfx.lineStyle(1, isEmpty ? DF_PALETTE.metalBorder : rarityBorder, 0.85);
  gfx.strokePoints(leftNotch, true);
  gfx.strokePoints(rightNotch, true);

  // Losango de gema no topo central
  const showTopGem = opts.showTopGem ?? true;
  if (showTopGem && width >= 28) {
    const topCx = x + width / 2;
    const topCy = y + 2;
    drawDiamond(
      gfx,
      topCx,
      topCy,
      5.5,
      4.5,
      DF_PALETTE.obsidianBg,
      1,
      DF_PALETTE.bronzeBorder,
      1.1,
      1
    );
    drawDiamond(
      gfx,
      topCx,
      topCy,
      3.4,
      2.8,
      isEmpty ? DF_PALETTE.metalDark : rarityBorder,
      isEmpty ? 0.8 : 1
    );
    if (!isEmpty) {
      gfx.fillStyle(0xffffff, 0.55);
      gfx.fillCircle(topCx - 0.8, topCy - 0.8, 0.9);
    }
  }

  // Engaste circular de gema no canto inferior direito
  const showCornerGem = opts.showCornerGem ?? true;
  if (showCornerGem && width >= 28 && height >= 28) {
    const socketRadius = Math.min(6, Math.max(4, Math.round(Math.min(width, height) * 0.1)));
    const gemCx = x + width - socketRadius - 3;
    const gemCy = y + height - socketRadius - 3;

    gfx.fillStyle(DF_PALETTE.obsidianBg, 1);
    gfx.fillCircle(gemCx, gemCy, socketRadius + 1.5);
    gfx.lineStyle(1.2, DF_PALETTE.bronzeBorder, 0.95);
    gfx.strokeCircle(gemCx, gemCy, socketRadius + 1.5);

    gfx.fillStyle(gemColor, isEmpty ? 0.55 : 0.98);
    gfx.fillCircle(gemCx, gemCy, socketRadius - 1);

    if (!isEmpty) {
      gfx.fillStyle(0xffffff, 0.55);
      gfx.fillCircle(
        gemCx - socketRadius * 0.28,
        gemCy - socketRadius * 0.28,
        Math.max(1, socketRadius * 0.28)
      );
    }
  }
}

/**
 * Desenha linha metálica horizontal de (x, y) até (x + width, y) com losango
 * central vazado e remates sutis nas extremidades.
 */
export function drawOrnamentalDivider(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  color: number = DF_PALETTE.bronzeBorder
): void {
  if (width <= 8) {
    return;
  }

  const cx = x + width / 2;
  const gap = Math.min(10, width * 0.18);
  const leftEnd = cx - gap;
  const rightStart = cx + gap;

  // Linha principal
  gfx.lineStyle(1.2, color, 0.9);
  if (leftEnd > x) {
    gfx.lineBetween(x + 3, y, leftEnd, y);
  }
  if (rightStart < x + width) {
    gfx.lineBetween(rightStart, y, x + width - 3, y);
  }

  // Filete sutil de brilho acima da linha
  const highlight = blendHexColor(color, DF_PALETTE.goldBright, 0.4);
  gfx.lineStyle(0.8, highlight, 0.35);
  if (leftEnd - x > 14) {
    gfx.lineBetween(x + 12, y - 1, leftEnd - 2, y - 1);
  }
  if (x + width - rightStart > 14) {
    gfx.lineBetween(rightStart + 2, y - 1, x + width - 12, y - 1);
  }

  // Pontos de remate nas pontas
  gfx.fillStyle(color, 0.9);
  gfx.fillCircle(x + 2, y, 1.5);
  gfx.fillCircle(x + width - 2, y, 1.5);

  // Losango central vazado
  drawDiamond(
    gfx,
    cx,
    y,
    5.5,
    4,
    DF_PALETTE.obsidianBg,
    0.95,
    highlight,
    1.3,
    1
  );
  drawDiamond(gfx, cx, y, 2.2, 1.6, undefined, 0, color, 0.9, 0.85);
}

/**
 * Emblema vetorial 2D limpo de crânio com ornamentos laterais estilizados,
 * centralizado em (x, y).
 */
export function drawSkullCrest(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  scale = 1,
  tint: number = 0xd6cab2
): void {
  const s = Math.max(0.25, scale);
  const metalColor = DF_PALETTE.bronzeBorder;
  const metalBright = DF_PALETTE.agedGold;

  // Ornamentos laterais (volutas/asas metálicas simétricas)
  for (const dir of [-1, 1] as const) {
    const wingPts = [
      new Phaser.Geom.Point(x + dir * 7 * s, y - 2 * s),
      new Phaser.Geom.Point(x + dir * 16 * s, y - 5 * s),
      new Phaser.Geom.Point(x + dir * 20 * s, y - 1 * s),
      new Phaser.Geom.Point(x + dir * 14 * s, y + 3 * s),
      new Phaser.Geom.Point(x + dir * 8 * s, y + 2 * s),
    ];
    gfx.fillStyle(DF_PALETTE.metalDark, 0.95);
    gfx.fillPoints(wingPts, true);
    gfx.lineStyle(1.1 * s, metalColor, 0.95);
    gfx.strokePoints(wingPts, true);

    gfx.lineStyle(0.9 * s, metalBright, 0.65);
    gfx.lineBetween(
      x + dir * 10 * s,
      y - 1.5 * s,
      x + dir * 16.5 * s,
      y - 2.5 * s
    );
  }

  // Medalhão de fundo escuro
  gfx.fillStyle(DF_PALETTE.obsidianBg, 1);
  gfx.fillCircle(x, y, 9.5 * s);
  gfx.lineStyle(1.4 * s, metalColor, 1);
  gfx.strokeCircle(x, y, 9.5 * s);

  // Crânio superior (calota)
  gfx.fillStyle(tint, 0.96);
  gfx.fillCircle(x, y - 1.6 * s, 5.6 * s);

  // Maçãs do rosto e maxilar
  const jawPts = [
    new Phaser.Geom.Point(x - 4.4 * s, y + 0.5 * s),
    new Phaser.Geom.Point(x + 4.4 * s, y + 0.5 * s),
    new Phaser.Geom.Point(x + 3.2 * s, y + 5.8 * s),
    new Phaser.Geom.Point(x - 3.2 * s, y + 5.8 * s),
  ];
  gfx.fillPoints(jawPts, true);

  // Contorno sutil do crânio
  gfx.lineStyle(0.8 * s, DF_PALETTE.bronzeDark, 0.7);
  gfx.strokeCircle(x, y - 1.6 * s, 5.6 * s);

  // Órbitas oculares escuras
  gfx.fillStyle(DF_PALETTE.obsidianBg, 1);
  gfx.fillCircle(x - 2.1 * s, y - 1.2 * s, 1.55 * s);
  gfx.fillCircle(x + 2.1 * s, y - 1.2 * s, 1.55 * s);

  // Cavidade nasal triangular invertida
  gfx.fillPoints(
    [
      new Phaser.Geom.Point(x, y + 0.3 * s),
      new Phaser.Geom.Point(x + 1.0 * s, y + 2.3 * s),
      new Phaser.Geom.Point(x - 1.0 * s, y + 2.3 * s),
    ],
    true
  );

  // Separação dos dentes
  gfx.lineStyle(0.9 * s, DF_PALETTE.obsidianBg, 0.95);
  gfx.lineBetween(x - 1.4 * s, y + 3.6 * s, x - 1.4 * s, y + 5.8 * s);
  gfx.lineBetween(x, y + 3.6 * s, x, y + 5.8 * s);
  gfx.lineBetween(x + 1.4 * s, y + 3.6 * s, x + 1.4 * s, y + 5.8 * s);
}

/**
 * Emblema vetorial 2D de estrela de 8 pontas em moldura metálica,
 * centralizado em (x, y) (usado no topo de cards Lendários e destaques).
 */
export function drawStarCrest(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  scale = 1,
  fillColor: number = DF_RARITY_THEME.legendary.border,
  strokeColor: number = DF_PALETTE.agedGold
): void {
  const s = Math.max(0.25, scale);

  // Medalhão metálico externo
  const outerR = 11 * s;
  gfx.fillStyle(DF_PALETTE.obsidianBg, 1);
  gfx.fillCircle(x, y, outerR);
  gfx.lineStyle(1.6 * s, DF_PALETTE.bronzeBorder, 1);
  gfx.strokeCircle(x, y, outerR);
  gfx.lineStyle(0.9 * s, strokeColor, 0.7);
  gfx.strokeCircle(x, y, outerR - 2.2 * s);

  // Estrela de 8 pontas (16 vértices alternados: 4 cardeais, 4 diagonais e 8 vales)
  const starPts: Phaser.Geom.Point[] = [];
  const totalTips = 8;
  const totalVertices = totalTips * 2;

  for (let i = 0; i < totalVertices; i++) {
    const angle = (i * Math.PI) / totalTips - Math.PI / 2;
    const isTip = i % 2 === 0;
    let radius: number;
    if (isTip) {
      const tipIndex = i / 2;
      const isCardinal = tipIndex % 2 === 0;
      radius = (isCardinal ? 9.2 : 6.6) * s;
    } else {
      radius = 3.1 * s;
    }
    starPts.push(
      new Phaser.Geom.Point(
        x + Math.cos(angle) * radius,
        y + Math.sin(angle) * radius
      )
    );
  }

  gfx.fillStyle(fillColor, 1);
  gfx.fillPoints(starPts, true);
  gfx.lineStyle(1.1 * s, strokeColor, 0.95);
  gfx.strokePoints(starPts, true);

  // Núcleo brilhante central
  const coreColor = blendHexColor(fillColor, 0xffffff, 0.55);
  drawDiamond(gfx, x, y, 2.3 * s, 2.3 * s, coreColor, 0.95);
}

/**
 * Desenha botão chanfrado 2D metálico com brilho superior, borda dourada,
 * carmesim, azul, esmeralda ou ferro, com suporte a hover, pressed e disabled.
 */
export function drawOrnateButton(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: OrnateButtonOptions = {}
): void {
  if (opts.clear) {
    gfx.clear();
  }

  const bevel = opts.bevel ?? 6;
  const variant = opts.variant ?? 'gold';
  const palette = BUTTON_VARIANTS[variant];
  const disabled = opts.disabled ?? false;
  const hovered = !disabled && (opts.hovered ?? false);
  const pressed = !disabled && (opts.pressed ?? false);

  const baseFill = disabled
    ? DF_PALETTE.buttonDisabledFill
    : (opts.fillColor ?? palette.fill);
  const baseBorder = disabled
    ? DF_PALETTE.buttonDisabledBorder
    : (opts.borderColor ?? palette.border);
  const baseHighlight = disabled
    ? DF_PALETTE.metalBorder
    : (opts.highlightColor ?? palette.highlight);

  const fillTone = pressed
    ? blendHexColor(baseFill, DF_PALETTE.obsidianBg, 0.35)
    : hovered
      ? blendHexColor(baseFill, baseHighlight, 0.2)
      : baseFill;
  const borderTone = hovered
    ? blendHexColor(baseBorder, baseHighlight, 0.45)
    : baseBorder;

  const outerPts = getChamferPoints(x, y, w, h, bevel);

  // Sombra sutil sob o botão (removida quando pressionado)
  if (!pressed && !disabled) {
    const shadowPts = getChamferPoints(x + 1, y + 2, w, h, bevel);
    gfx.fillStyle(DF_PALETTE.shadow, 0.45);
    gfx.fillPoints(shadowPts, true);
  }

  // Corpo principal chanfrado
  gfx.fillStyle(fillTone, disabled ? 0.72 : 0.96);
  gfx.fillPoints(outerPts, true);

  // Brilho superior em faixa horizontal
  if (!disabled && h >= 12) {
    const trim = Math.min(bevel, w / 2);
    const topBandW = Math.max(0, w - trim * 2);
    const topBandH = Math.max(2, Math.round(h * 0.42));
    if (topBandW > 0) {
      gfx.fillStyle(baseHighlight, pressed ? 0.06 : hovered ? 0.22 : 0.14);
      gfx.fillRect(x + trim, y + 1.5, topBandW, topBandH);
    }

    // Linha especular fina no topo
    if (topBandW > 4) {
      gfx.lineStyle(1, baseHighlight, pressed ? 0.15 : hovered ? 0.65 : 0.4);
      gfx.lineBetween(x + trim + 1, y + 2, x + w - trim - 1, y + 2);
    }
  }

  // Moldura externa e filete interno
  gfx.lineStyle(hovered ? 2 : 1.6, borderTone, disabled ? 0.6 : 0.98);
  gfx.strokePoints(outerPts, true);

  if (w > 12 && h > 10) {
    const innerPts = getChamferPoints(
      x + 2.5,
      y + 2.5,
      w - 5,
      h - 5,
      Math.max(0, bevel - 2)
    );
    gfx.lineStyle(0.9, baseHighlight, disabled ? 0.15 : hovered ? 0.48 : 0.28);
    gfx.strokePoints(innerPts, true);
  }

  // Rebites metálicos laterais para botões largos
  if (w >= 48 && h >= 20) {
    const rivetY = y + h / 2;
    const rivetOffset = Math.max(5, Math.round(bevel * 0.85) + 2);
    const rivetColor = disabled ? DF_PALETTE.metalDark : borderTone;
    drawDiamond(gfx, x + rivetOffset, rivetY, 2.2, 2.2, rivetColor, disabled ? 0.5 : 0.9);
    drawDiamond(gfx, x + w - rivetOffset, rivetY, 2.2, 2.2, rivetColor, disabled ? 0.5 : 0.9);
  }
}

function buildTextStyle(
  fontFamily: string,
  defaultSize: string,
  defaultColor: string,
  defaultStyle: string,
  opts: DarkFantasyTextOptions
): Phaser.Types.GameObjects.Text.TextStyle {
  const fontSize =
    typeof opts.fontSize === 'number'
      ? `${opts.fontSize}px`
      : (opts.fontSize ?? defaultSize);

  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily,
    fontSize,
    color: opts.color ?? defaultColor,
    fontStyle: opts.fontStyle ?? defaultStyle,
    align: opts.align ?? 'left',
    resolution: opts.resolution ?? 2,
  };

  if (typeof opts.wordWrapWidth === 'number' && opts.wordWrapWidth > 0) {
    style.wordWrap = { width: opts.wordWrapWidth };
  }

  if (opts.stroke) {
    style.stroke = opts.stroke;
    style.strokeThickness = opts.strokeThickness ?? 2;
  }

  if (opts.shadow) {
    style.shadow = {
      offsetX: 1,
      offsetY: 2,
      color: '#000000',
      blur: 3,
      fill: true,
      stroke: false,
    };
  }

  return style;
}

function applyTextPostOptions(
  textObj: Phaser.GameObjects.Text,
  opts: DarkFantasyTextOptions
): Phaser.GameObjects.Text {
  if (typeof opts.originX === 'number' || typeof opts.originY === 'number') {
    textObj.setOrigin(opts.originX ?? 0, opts.originY ?? opts.originX ?? 0);
  }
  if (typeof opts.lineSpacing === 'number') {
    textObj.setLineSpacing(opts.lineSpacing);
  }
  return textObj;
}

/**
 * Fábrica de texto de título Dark Fantasy usando tipografia serifada Cinzel com
 * resolution: 2.
 */
export function createTitleText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  opts: DarkFantasyTextOptions = {}
): Phaser.GameObjects.Text {
  const style = buildTextStyle(
    DF_FONTS.TITLE,
    '16px',
    DF_PALETTE.textParchment,
    'bold',
    {
      shadow: true,
      ...opts,
    }
  );
  const textObj = scene.add.text(x, y, text, style);
  return applyTextPostOptions(textObj, opts);
}

/**
 * Fábrica de texto de corpo Dark Fantasy usando tipografia Sans limpa com
 * resolution: 2.
 */
export function createBodyText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  opts: DarkFantasyTextOptions = {}
): Phaser.GameObjects.Text {
  const style = buildTextStyle(
    DF_FONTS.BODY,
    '12px',
    DF_PALETTE.textLight,
    'normal',
    opts
  );
  const textObj = scene.add.text(x, y, text, style);
  return applyTextPostOptions(textObj, opts);
}

/**
 * Formata inteiros com separador de milhar "." (ex.: 1420 -> "1.420", 3200 -> "3.200").
 */
export function formatStatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded).toString();
  return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/**
 * Verifica de forma segura se uma textura carregada na cena contém o frame informado.
 */
export function hasUiTextureFrame(
  scene: Phaser.Scene,
  key: string,
  frame: string | number
): boolean {
  if (!scene.textures || !scene.textures.exists(key)) {
    return false;
  }
  const texture = scene.textures.get(key);
  if (!texture || texture.key === '__MISSING') {
    return false;
  }
  const frameKey = String(frame);
  if (texture.has(frameKey)) {
    return true;
  }
  return texture.getFrameNames().includes(frameKey);
}
