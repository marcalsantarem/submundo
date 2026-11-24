/**
 * VillageAssets (T-140, BRF-151): contrato das folhas da Vila Natal e dos NPCs.
 * Fonte: scripts/art/out/village_hub.manifest.json e village_npcs.manifest.json
 * (unidos em public/assets/sprites/manifest.json). Módulo de dados puro, sem Phaser.
 * Footprints em pixels relativos à origem do sprite (x/y = canto superior esquerdo).
 */

export interface VillageFootprint {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface VillageOrigin {
  x: number;
  y: number;
}

export interface VillageAnimSpec {
  key: string;
  texture: VillageTextureKey;
  frames: readonly number[];
  frameRate: number;
  repeat: number;
  repeatDelay?: number;
}

export const VILLAGE_TEXTURES = {
  tiles: 'village_hub_tiles',
  house: 'village_hub_house',
  palisade: 'village_hub_palisade',
  gate: 'village_hub_gate',
  campfire: 'village_hub_campfire',
  forge: 'village_hub_forge',
  brazier: 'village_hub_brazier',
  torch: 'village_hub_torch',
  cart: 'village_hub_cart',
  props: 'village_hub_props',
  light: 'village_hub_light',
  npcMaster: 'village_npc_master',
  npcLyra: 'village_npc_lyra',
  npcGorran: 'village_npc_gorran',
} as const;

export type VillageTextureKey = (typeof VILLAGE_TEXTURES)[keyof typeof VILLAGE_TEXTURES];

export const VILLAGE_TEXTURE_KEYS: readonly VillageTextureKey[] = Object.values(VILLAGE_TEXTURES);

function indexOf<T extends string>(names: readonly T[]): Readonly<Record<T, number>> {
  const out = {} as Record<T, number>;
  names.forEach((n, i) => {
    out[n] = i;
  });
  return out;
}

const IDLE_FRAMES = ['idle0', 'idle1', 'idle2', 'idle3', 'idle4', 'idle5'] as const;

/** Nomes de frame na ordem da folha (índice = posição). */
export const VILLAGE_FRAME_NAMES = {
  village_hub_tiles: [
    'dirt_0', 'dirt_1', 'dirt_2', 'dirt_3', 'dirt_pebbles', 'dirt_cracks', 'dirt_tufts', 'dirt_damp',
    'grass_0', 'grass_1', 'grass_2', 'grass_flowers', 'grass_tall',
    'edge_0001', 'edge_0010', 'edge_0011', 'edge_0100', 'edge_0101', 'edge_0110', 'edge_0111',
    'edge_1000', 'edge_1001', 'edge_1010', 'edge_1011', 'edge_1100', 'edge_1101', 'edge_1110',
    'path_v', 'path_h', 'path_x', 'cobble_0', 'cobble_1',
  ],
  village_hub_house: ['house'],
  village_hub_palisade: ['h_0', 'h_1', 'h_broken', 'v_0', 'v_1', 'corner', 'post', 'spikes'],
  village_hub_gate: ['gate_closed', 'gate_open'],
  village_hub_campfire: ['campfire_0', 'campfire_1', 'campfire_2', 'campfire_3', 'campfire_4', 'campfire_5'],
  village_hub_forge: ['forge_0', 'forge_1', 'forge_2', 'forge_3'],
  village_hub_brazier: ['brazier_0', 'brazier_1', 'brazier_2', 'brazier_3'],
  village_hub_torch: ['torch_0', 'torch_1', 'torch_2', 'torch_3'],
  village_hub_cart: ['cart'],
  village_hub_props: [
    'anvil', 'firewood', 'barrel', 'crate', 'sacks', 'pots', 'herb_rack', 'weapon_rack', 'bench', 'bucket',
  ],
  village_hub_light: ['light_warm'],
  village_npc_master: IDLE_FRAMES,
  village_npc_lyra: IDLE_FRAMES,
  village_npc_gorran: [
    ...IDLE_FRAMES,
    'hammer0', 'hammer1', 'hammer2', 'hammer3', 'hammer4', 'hammer5', 'hammer6', 'hammer7',
  ],
} as const satisfies Record<VillageTextureKey, readonly string[]>;

type FrameNameOf<K extends VillageTextureKey> = (typeof VILLAGE_FRAME_NAMES)[K][number];

/** Nome de frame → índice, por textura. Ex.: VILLAGE_FRAMES.village_hub_gate.gate_open === 1. */
export const VILLAGE_FRAMES: { readonly [K in VillageTextureKey]: Readonly<Record<FrameNameOf<K>, number>> } =
  Object.fromEntries(
    Object.entries(VILLAGE_FRAME_NAMES).map(([k, names]) => [k, indexOf(names as readonly string[])]),
  ) as never;

/** Dimensões de frame por folha (iguais ao manifest). */
export const VILLAGE_FRAME_SIZES: Readonly<Record<VillageTextureKey, { frameWidth: number; frameHeight: number }>> = {
  village_hub_tiles: { frameWidth: 32, frameHeight: 32 },
  village_hub_house: { frameWidth: 176, frameHeight: 160 },
  village_hub_palisade: { frameWidth: 32, frameHeight: 80 },
  village_hub_gate: { frameWidth: 176, frameHeight: 152 },
  village_hub_campfire: { frameWidth: 64, frameHeight: 64 },
  village_hub_forge: { frameWidth: 64, frameHeight: 80 },
  village_hub_brazier: { frameWidth: 32, frameHeight: 64 },
  village_hub_torch: { frameWidth: 32, frameHeight: 80 },
  village_hub_cart: { frameWidth: 112, frameHeight: 80 },
  village_hub_props: { frameWidth: 64, frameHeight: 64 },
  village_hub_light: { frameWidth: 128, frameHeight: 128 },
  village_npc_master: { frameWidth: 80, frameHeight: 80 },
  village_npc_lyra: { frameWidth: 80, frameHeight: 80 },
  village_npc_gorran: { frameWidth: 80, frameHeight: 80 },
};

/** Origens (setOrigin). `village_hub_tiles` não tem origem no fragmento: use (0, 0) para grade. */
export const VILLAGE_ORIGINS: Readonly<Record<VillageTextureKey, VillageOrigin>> = {
  village_hub_tiles: { x: 0, y: 0 },
  village_hub_house: { x: 0.5, y: 0.95 },
  village_hub_palisade: { x: 0.5, y: 0.95 },
  village_hub_gate: { x: 0.5, y: 0.947368 },
  village_hub_campfire: { x: 0.5, y: 0.875 },
  village_hub_forge: { x: 0.5, y: 0.95 },
  village_hub_brazier: { x: 0.5, y: 0.953125 },
  village_hub_torch: { x: 0.5, y: 0.95 },
  village_hub_cart: { x: 0.5, y: 0.9 },
  village_hub_props: { x: 0.5, y: 0.9375 },
  village_hub_light: { x: 0.5, y: 0.5 },
  village_npc_master: { x: 0.5, y: 0.95 },
  village_npc_lyra: { x: 0.5, y: 0.95 },
  village_npc_gorran: { x: 0.5, y: 0.95 },
};

const fp = (x: number, y: number, w: number, h: number): VillageFootprint => ({ x, y, w, h });
const same = <N extends string>(names: readonly N[], rects: readonly VillageFootprint[]) =>
  Object.fromEntries(names.map((n) => [n, rects])) as Record<N, readonly VillageFootprint[]>;

/**
 * Footprints de colisão por textura → frame (só os que o fragmento define).
 * Coordenadas relativas ao ponto de origem do sprite (pés), em pixels da folha.
 */
export const VILLAGE_FOOTPRINTS = {
  village_hub_house: { house: [fp(-72, -44, 144, 44)] },
  village_hub_palisade: {
    ...same(['h_0', 'h_1', 'h_broken'], [fp(-16, -6, 32, 6)]),
    ...same(['v_0', 'v_1'], [fp(-5, -32, 10, 32)]),
    corner: [fp(-10, -10, 20, 10)],
    post: [fp(-6, -6, 12, 6)],
    spikes: [fp(-12, -6, 24, 6)],
  },
  village_hub_gate: {
    gate_closed: [fp(-80, -14, 32, 14), fp(48, -14, 32, 14), fp(-48, -6, 96, 6)],
    gate_open: [fp(-80, -14, 32, 14), fp(48, -14, 32, 14)],
  },
  village_hub_campfire: same(VILLAGE_FRAME_NAMES.village_hub_campfire, [fp(-20, -14, 40, 14)]),
  village_hub_forge: same(VILLAGE_FRAME_NAMES.village_hub_forge, [fp(-28, -16, 56, 16)]),
  village_hub_brazier: same(VILLAGE_FRAME_NAMES.village_hub_brazier, [fp(-7, -4, 14, 4)]),
  village_hub_torch: same(VILLAGE_FRAME_NAMES.village_hub_torch, [fp(-3, -3, 6, 3)]),
  village_hub_cart: { cart: [fp(-38, -14, 84, 14)] },
  village_hub_props: {
    anvil: [fp(-13, -6, 26, 6)],
    firewood: [fp(-28, -8, 58, 8)],
    barrel: [fp(-12, -6, 24, 6)],
    crate: [fp(-18, -8, 36, 8)],
    sacks: [fp(-20, -8, 38, 8)],
    pots: [fp(-18, -6, 36, 6)],
    herb_rack: [fp(-25, -4, 50, 4)],
    weapon_rack: [fp(-25, -4, 50, 4)],
    bench: [fp(-26, -4, 52, 4)],
    bucket: [fp(-8, -4, 16, 4)],
  },
} as const satisfies Partial<Record<VillageTextureKey, Record<string, readonly VillageFootprint[]>>>;

/** Footprints de um frame (vazio se a peça não colide). */
export function villageFootprint(texture: VillageTextureKey, frame: string): readonly VillageFootprint[] {
  const byFrame = (VILLAGE_FOOTPRINTS as Partial<Record<string, Record<string, readonly VillageFootprint[]>>>)[texture];
  return byFrame?.[frame] ?? [];
}

export const VILLAGE_ANIMS = {
  campfire: 'village_hub_campfire',
  forge: 'village_hub_forge',
  brazier: 'village_hub_brazier',
  torch: 'village_hub_torch',
  masterIdle: 'village_npc_master_idle',
  lyraIdle: 'village_npc_lyra_idle',
  gorranIdle: 'village_npc_gorran_idle',
  gorranHammer: 'village_npc_gorran_hammer',
} as const;

export type VillageAnimKey = (typeof VILLAGE_ANIMS)[keyof typeof VILLAGE_ANIMS];

const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** Animações (fps do fragmento). Criadas no BootScene. */
export const VILLAGE_ANIM_SPECS: readonly VillageAnimSpec[] = [
  { key: VILLAGE_ANIMS.campfire, texture: 'village_hub_campfire', frames: range(0, 5), frameRate: 10, repeat: -1 },
  { key: VILLAGE_ANIMS.forge, texture: 'village_hub_forge', frames: range(0, 3), frameRate: 6, repeat: -1 },
  { key: VILLAGE_ANIMS.brazier, texture: 'village_hub_brazier', frames: range(0, 3), frameRate: 8, repeat: -1 },
  { key: VILLAGE_ANIMS.torch, texture: 'village_hub_torch', frames: range(0, 3), frameRate: 8, repeat: -1 },
  { key: VILLAGE_ANIMS.masterIdle, texture: 'village_npc_master', frames: range(0, 5), frameRate: 5, repeat: -1 },
  { key: VILLAGE_ANIMS.lyraIdle, texture: 'village_npc_lyra', frames: range(0, 5), frameRate: 5, repeat: -1 },
  { key: VILLAGE_ANIMS.gorranIdle, texture: 'village_npc_gorran', frames: range(0, 5), frameRate: 5, repeat: -1 },
  {
    key: VILLAGE_ANIMS.gorranHammer,
    texture: 'village_npc_gorran',
    frames: range(6, 13),
    frameRate: 10,
    repeat: -1,
    repeatDelay: 400,
  },
];

/** Índice absoluto na folha `village_npc_gorran` (frame `hammer5`) em que o martelo bate. */
export const GORRAN_HAMMER_IMPACT_FRAME = 11;
/** Deslocamento do ponto de impacto (faíscas) relativo à origem do Gorran, em pixels da folha. */
export const GORRAN_HAMMER_IMPACT_OFFSET: Readonly<{ dx: number; dy: number }> = { dx: -28.7, dy: -17.3 };

/** Cor de fallback (retângulo) se a folha falhar ao carregar. */
export const VILLAGE_FALLBACK_COLORS: Readonly<Record<VillageTextureKey, number>> = {
  village_hub_tiles: 0x57534e,
  village_hub_house: 0x78350f,
  village_hub_palisade: 0x44403c,
  village_hub_gate: 0x57534e,
  village_hub_campfire: 0xf97316,
  village_hub_forge: 0x9a3412,
  village_hub_brazier: 0xd97706,
  village_hub_torch: 0xfacc15,
  village_hub_cart: 0x78350f,
  village_hub_props: 0x92400e,
  village_hub_light: 0xfde68a,
  village_npc_master: 0x7c3aed,
  village_npc_lyra: 0x22c55e,
  village_npc_gorran: 0xb45309,
};
