import type Phaser from 'phaser';

/**
 * T-073 / BRF-145 — Visual theme of the test arena per biome (Decisions #20/#21, guia visual 3.3).
 *
 * Every biome ships the same frame contract as `dungeon_basic_*` for tiles/doors; props differ, so
 * the core prop names (`pillar`, `chest_closed`, ...) are mapped here to biome frames keeping their
 * role: blocking props map to solid-looking frames, decor maps to flat frames. Frame names come from
 * `scripts/art/biomes/out/<id>.manifest.json` (index = position in the sheet).
 * The Vila Natal (`village`) is the hub, not a battle dungeon, so it is not a test-arena biome.
 */

export const BIOME_IDS = [
  'herb_field',
  'village_grotto',
  'village_mine',
  'mine_depths',
  'ancient_seal',
  'submundo_abyss',
] as const;
export type BiomeId = (typeof BIOME_IDS)[number];
/** `dungeon_basic` = Masmorra Básica (default / fallback). */
export type ArenaBiomeId = BiomeId | 'dungeon_basic';

/** Core prop names emitted by `src/core/dungeon/DungeonMap.ts`. */
export type CorePropName =
  | 'pillar' | 'pillar_broken'
  | 'chest_closed' | 'barrel' | 'urn' | 'rubble'
  | 'bones' | 'skulls_candle' | 'chain';

export interface PropLight {
  color: number;
  /** Halo diameter in px. */
  size: number;
  alpha: number;
  /** Halo centre offset from the sprite's top-left (floor) or base (tall). */
  dy?: number;
}

export interface BiomeLighting {
  /** Darkness layer over floor/walls (normal blend, under the actors). */
  ambientColor: number;
  ambientAlpha: number;
  /** Torch halo (wide) and flame core colors. */
  torchColor: number;
  torchCore: number;
  /** Multiplier of the torch halos' alpha (day biomes = weaker). */
  torchIntensity: number;
  /** Soft light around the hero (dark biomes only). */
  heroLight?: { color: number; alpha: number; w: number; h: number };
  /** Tint applied to tall props (they can draw above the darkness layer). */
  tallTint: number;
}

export interface BiomeTheme {
  id: ArenaBiomeId;
  /** True when the biome's textures were missing and `dungeon_basic_*` is drawn instead. */
  textureFallback: boolean;
  tilesKey: string;
  doorsKey: string;
  propsKey: string;
  tallKey: string;
  torchAnim: string;
  /** Frame index of each prop name in `propsKey` / `tallKey`. */
  propFrames: readonly string[];
  tallFrames: readonly string[];
  /** core prop -> candidate frames (picked deterministically by position). */
  floorMap: Record<Exclude<CorePropName, 'pillar' | 'pillar_broken'>, readonly string[]>;
  tallMap: Record<'pillar' | 'pillar_broken', readonly string[]>;
  /** Props that emit light (frame name -> halo). */
  propLights: Readonly<Record<string, PropLight>>;
  lighting: BiomeLighting;
}

type ThemeSpec = Omit<BiomeTheme, 'id' | 'textureFallback' | 'tilesKey' | 'doorsKey' | 'propsKey' | 'tallKey' | 'torchAnim'>;

const TORCH = ['torch_0', 'torch_1', 'torch_2', 'torch_3'] as const;

const SPECS: Record<ArenaBiomeId, ThemeSpec> = {
  dungeon_basic: {
    propFrames: [...TORCH, 'chest_closed', 'barrel', 'urn', 'bones', 'rubble', 'chain', 'skulls_candle'],
    tallFrames: ['pillar', 'pillar_broken'],
    tallMap: { pillar: ['pillar'], pillar_broken: ['pillar_broken'] },
    // `chain` belongs on the wall face (guia 3.3), never loose on the floor (T-128 note).
    floorMap: {
      chest_closed: ['chest_closed'], barrel: ['barrel'], urn: ['urn'], rubble: ['rubble'],
      bones: ['bones'], skulls_candle: ['skulls_candle'], chain: ['bones', 'rubble'],
    },
    propLights: { skulls_candle: { color: 0xf59e0b, size: 48, alpha: 0.35, dy: 8 } },
    lighting: {
      ambientColor: 0x05070d, ambientAlpha: 0.14,
      torchColor: 0xf59e0b, torchCore: 0xfde047, torchIntensity: 1,
      tallTint: 0xffffff,
    },
  },
  herb_field: {
    propFrames: [...TORCH, 'herb_bed_basil', 'herb_bed_lavender', 'herb_bed_sprouts', 'basket_herbs',
      'trail_ew', 'trail_ns', 'trail_ne', 'trail_nw', 'trail_se', 'trail_sw', 'watering_can', 'rocks',
      'flower_bush', 'seed_sack'],
    tallFrames: ['scarecrow', 'well', 'tree_apple', 'sunflowers'],
    tallMap: { pillar: ['tree_apple', 'sunflowers', 'well'], pillar_broken: ['scarecrow'] },
    floorMap: {
      chest_closed: ['herb_bed_basil', 'herb_bed_lavender', 'herb_bed_sprouts'],
      barrel: ['seed_sack'], urn: ['basket_herbs'], rubble: ['rocks'],
      bones: ['flower_bush'], skulls_candle: ['watering_can'], chain: ['flower_bush'],
    },
    propLights: {},
    // Daytime: no darkness, only a warm glow around the lanterns.
    lighting: {
      ambientColor: 0x000000, ambientAlpha: 0,
      torchColor: 0xf97316, torchCore: 0xfdba74, torchIntensity: 0.45,
      tallTint: 0xffffff,
    },
  },
  village_grotto: {
    propFrames: [...TORCH, 'mushrooms_floor', 'puddle', 'rocks_wet', 'stalagmite', 'crystal', 'sulfur_spring',
      'bones', 'fern', 'stream_top_l', 'stream_top_r', 'falls_pool_l', 'falls_pool_r'],
    tallFrames: ['waterfall_l_0', 'waterfall_r_0', 'waterfall_l_1', 'waterfall_r_1', 'waterfall_l_2',
      'waterfall_r_2', 'stalagmite_tall', 'giant_mushroom', 'rock_column'],
    tallMap: { pillar: ['rock_column', 'giant_mushroom'], pillar_broken: ['stalagmite_tall'] },
    floorMap: {
      chest_closed: ['crystal'], barrel: ['stalagmite'], urn: ['rocks_wet'], rubble: ['rocks_wet'],
      bones: ['bones', 'fern'], skulls_candle: ['mushrooms_floor'], chain: ['puddle', 'sulfur_spring', 'fern'],
    },
    propLights: {
      mushrooms_floor: { color: 0x22d3ee, size: 56, alpha: 0.3, dy: 18 },
      crystal: { color: 0x67e8f9, size: 64, alpha: 0.32, dy: 14 },
      giant_mushroom: { color: 0x22d3ee, size: 96, alpha: 0.3, dy: -40 },
    },
    lighting: {
      ambientColor: 0x03121a, ambientAlpha: 0.4,
      torchColor: 0x22d3ee, torchCore: 0xa5f3fc, torchIntensity: 0.85,
      tallTint: 0xc7d2d8,
    },
  },
  village_mine: {
    propFrames: [...TORCH, 'mine_cart', 'mine_cart_ore', 'crate', 'ore_pile', 'pick_shovel', 'rope_coil',
      'sacks', 'barrel', 'rail_v', 'rail_h', 'rail_bend_se', 'rail_bend_sw', 'rail_bend_ne', 'rail_bend_nw', 'rail_stop'],
    tallFrames: ['support_post', 'lantern_post', 'crate_stack', 'rock_column'],
    tallMap: { pillar: ['support_post', 'lantern_post'], pillar_broken: ['crate_stack', 'rock_column'] },
    floorMap: {
      chest_closed: ['mine_cart', 'mine_cart_ore'], barrel: ['barrel'], urn: ['crate'], rubble: ['ore_pile'],
      bones: ['pick_shovel'], skulls_candle: ['sacks'], chain: ['rope_coil'],
    },
    propLights: { lantern_post: { color: 0xf59e0b, size: 120, alpha: 0.32, dy: -44 } },
    lighting: {
      ambientColor: 0x0b0703, ambientAlpha: 0.34,
      torchColor: 0xf59e0b, torchCore: 0xfde047, torchIntensity: 1,
      tallTint: 0xe7dccd,
    },
  },
  mine_depths: {
    propFrames: [...TORCH, 'stalagmite_small', 'rocks', 'broken_beam', 'miner_remains', 'puddle',
      'glow_mushrooms', 'floor_crystals', 'cart_wreck', 'bones', 'dead_lantern'],
    tallFrames: ['stalagmite_tall', 'stalactite', 'crystal_column', 'snapped_post'],
    tallMap: { pillar: ['stalagmite_tall', 'crystal_column'], pillar_broken: ['snapped_post'] },
    floorMap: {
      chest_closed: ['cart_wreck'], barrel: ['stalagmite_small'], urn: ['broken_beam'], rubble: ['rocks'],
      bones: ['bones', 'miner_remains'], skulls_candle: ['glow_mushrooms', 'floor_crystals'],
      chain: ['puddle', 'dead_lantern'],
    },
    propLights: {
      glow_mushrooms: { color: 0x818cf8, size: 56, alpha: 0.3, dy: 18 },
      floor_crystals: { color: 0x2dd4bf, size: 60, alpha: 0.32, dy: 16 },
      crystal_column: { color: 0x2dd4bf, size: 110, alpha: 0.32, dy: -36 },
    },
    lighting: {
      ambientColor: 0x01050b, ambientAlpha: 0.58,
      torchColor: 0x2dd4bf, torchCore: 0x99f6e4, torchIntensity: 0.9,
      heroLight: { color: 0x9fd8e6, alpha: 0.2, w: 300, h: 230 },
      tallTint: 0xaab4bf,
    },
  },
  ancient_seal: {
    propFrames: [...TORCH, 'rune_plaque', 'column_drum', 'statue_head', 'candles', 'offering_bowl',
      'carved_debris', 'urn', 'bones', 'seal_tl', 'seal_tr', 'seal_bl', 'seal_br'],
    tallFrames: ['column', 'column_broken', 'rune_obelisk', 'angel_statue'],
    tallMap: { pillar: ['column', 'rune_obelisk'], pillar_broken: ['column_broken', 'angel_statue'] },
    floorMap: {
      chest_closed: ['statue_head'], barrel: ['column_drum'], urn: ['urn'], rubble: ['carved_debris'],
      bones: ['bones'], skulls_candle: ['candles'], chain: ['rune_plaque', 'offering_bowl'],
    },
    propLights: {
      candles: { color: 0xf59e0b, size: 56, alpha: 0.36, dy: 10 },
      rune_obelisk: { color: 0x60a5fa, size: 90, alpha: 0.26, dy: -40 },
    },
    lighting: {
      ambientColor: 0x04050e, ambientAlpha: 0.4,
      torchColor: 0xf59e0b, torchCore: 0xfde68a, torchIntensity: 1,
      tallTint: 0xc9ccd8,
    },
  },
  submundo_abyss: {
    propFrames: [...TORCH, 'ember_vent', 'bone_pile', 'skull_pile', 'chain', 'obsidian_shards', 'ember_brazier',
      'ribcage', 'spikes', 'soul_candle', 'ash_pile'],
    tallFrames: ['obsidian_spire', 'chained_pillar', 'bone_totem', 'brazier_tall'],
    tallMap: { pillar: ['obsidian_spire', 'chained_pillar', 'bone_totem'], pillar_broken: ['brazier_tall'] },
    floorMap: {
      chest_closed: ['bone_pile'], barrel: ['ribcage'], urn: ['ember_brazier'], rubble: ['obsidian_shards', 'spikes'],
      bones: ['ash_pile', 'skull_pile'], skulls_candle: ['soul_candle'], chain: ['ember_vent'],
    },
    propLights: {
      ember_vent: { color: 0xef4444, size: 56, alpha: 0.3, dy: 16 },
      ember_brazier: { color: 0xf97316, size: 84, alpha: 0.36, dy: 10 },
      soul_candle: { color: 0x60a5fa, size: 56, alpha: 0.36, dy: 10 },
      brazier_tall: { color: 0xf97316, size: 130, alpha: 0.38, dy: -48 },
    },
    lighting: {
      ambientColor: 0x060208, ambientAlpha: 0.6,
      torchColor: 0x3b82f6, torchCore: 0xbfdbfe, torchIntensity: 1,
      heroLight: { color: 0x93c5fd, alpha: 0.2, w: 300, h: 230 },
      tallTint: 0xb4adb8,
    },
  },
};

export function isBiomeId(id: string | null | undefined): id is BiomeId {
  return !!id && (BIOME_IDS as readonly string[]).includes(id);
}

/** `?biome=<id>` of the URL; `dungeon_basic` when absent or invalid (`village` is the hub). */
export function resolveTestArenaBiome(): ArenaBiomeId {
  if (typeof window === 'undefined') return 'dungeon_basic';
  const raw = new URLSearchParams(window.location.search).get('biome');
  return isBiomeId(raw) ? raw : 'dungeon_basic';
}

function keysFor(id: ArenaBiomeId) {
  const prefix = id === 'dungeon_basic' ? 'dungeon_basic' : `biome_${id}`;
  return {
    tilesKey: `${prefix}_tiles`,
    doorsKey: `${prefix}_doors`,
    propsKey: `${prefix}_props`,
    tallKey: `${prefix}_props_tall`,
    torchAnim: `${prefix}_torch`,
  };
}

/**
 * Theme for a biome. Textures fall back to `dungeon_basic_*` (with its prop mapping) when the
 * biome's tile sheet is not loaded; the lighting still follows the requested biome.
 */
export function getBiomeTheme(id: ArenaBiomeId, textures?: Phaser.Textures.TextureManager): BiomeTheme {
  const keys = keysFor(id);
  const loaded = !textures || id === 'dungeon_basic' || textures.exists(keys.tilesKey);
  const artId: ArenaBiomeId = loaded ? id : 'dungeon_basic';
  const art = SPECS[artId];
  return {
    ...keysFor(artId),
    ...art,
    lighting: SPECS[id].lighting,
    id,
    textureFallback: !loaded,
  };
}

/** Deterministic pick among a prop's candidate frames (stable per position). */
export function pickPropFrame(candidates: readonly string[], x: number, y: number): string {
  const h = (Math.imul(Math.floor(x), 73856093) ^ Math.imul(Math.floor(y), 19349663)) >>> 0;
  return candidates[h % candidates.length];
}

/** Frame name for a core prop in this theme (`undefined` = not drawn). */
export function themePropFrame(theme: BiomeTheme, name: string, x: number, y: number): string | undefined {
  if (name === 'pillar' || name === 'pillar_broken') {
    return pickPropFrame(theme.tallMap[name], x, y);
  }
  const list = (theme.floorMap as Record<string, readonly string[]>)[name];
  return list ? pickPropFrame(list, x, y) : undefined;
}
