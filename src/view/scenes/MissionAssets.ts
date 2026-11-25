/**
 * MissionAssets (T-148, BRF-161): contrato das folhas das missões do prólogo.
 * Fonte: scripts/art/out/mission_art.manifest.json (unido em public/assets/sprites/manifest.json).
 * Módulo de dados puro, sem Phaser. Texturas e animações são criadas no BootScene.
 */

export interface MissionOrigin {
  x: number;
  y: number;
}

export interface MissionAnimSpec {
  key: MissionAnimKey;
  texture: MissionTextureKey;
  frames: readonly number[];
  frameRate: number;
  repeat: number;
}

export const MISSION_TEXTURES = {
  questMarkers: 'quest_markers',
  herb: 'mission_herb',
  tools: 'mission_tools',
  strange: 'mission_strange',
  icons: 'mission_icons',
} as const;

export type MissionTextureKey = (typeof MISSION_TEXTURES)[keyof typeof MISSION_TEXTURES];

export const MISSION_TEXTURE_KEYS: readonly MissionTextureKey[] = Object.values(MISSION_TEXTURES);

/** Índices de frame nomeados (estáticos). */
export const MISSION_FRAMES = {
  quest_markers: { avail0: 0, progress0: 4, ready0: 8 },
  mission_herb: { glow0: 0, picked: 4 },
  mission_tools: { glow0: 0, empty: 4 },
  mission_strange: { pulse0: 0 },
  mission_icons: { icon_herb: 0, icon_tools: 1 },
} as const satisfies Record<MissionTextureKey, Record<string, number>>;

/** Dimensões de frame por folha (iguais ao manifest). */
export const MISSION_FRAME_SIZES: Readonly<Record<MissionTextureKey, { frameWidth: number; frameHeight: number }>> = {
  quest_markers: { frameWidth: 16, frameHeight: 24 },
  mission_herb: { frameWidth: 32, frameHeight: 32 },
  mission_tools: { frameWidth: 32, frameHeight: 32 },
  mission_strange: { frameWidth: 48, frameHeight: 48 },
  mission_icons: { frameWidth: 16, frameHeight: 16 },
};

/** Origens (setOrigin). */
export const MISSION_ORIGINS: Readonly<Record<MissionTextureKey, MissionOrigin>> = {
  quest_markers: { x: 0.5, y: 1.0 },
  mission_herb: { x: 0.5, y: 0.875 },
  mission_tools: { x: 0.5, y: 0.875 },
  mission_strange: { x: 0.5, y: 0.7916666666666666 },
  mission_icons: { x: 0.5, y: 0.5 },
};

/**
 * Deslocamento vertical (px) do marcador de missão acima do topo da cabeça do NPC.
 * Somar ao topo do sprite do NPC; o marcador usa origem (0.5, 1).
 */
export const QUEST_MARKER_HEAD_OFFSET_Y = -4;

export const MISSION_ANIMS = {
  markerAvail: 'quest_marker_avail',
  markerProgress: 'quest_marker_progress',
  markerReady: 'quest_marker_ready',
  herbGlow: 'mission_herb_glow',
  toolsGlow: 'mission_tools_glow',
  strangePulse: 'mission_strange_pulse',
} as const;

export type MissionAnimKey = (typeof MISSION_ANIMS)[keyof typeof MISSION_ANIMS];

/** Animações (fps do fragmento). Criadas no BootScene. */
export const MISSION_ANIM_SPECS: readonly MissionAnimSpec[] = [
  { key: MISSION_ANIMS.markerAvail, texture: 'quest_markers', frames: [0, 1, 2, 3], frameRate: 6, repeat: -1 },
  { key: MISSION_ANIMS.markerProgress, texture: 'quest_markers', frames: [4, 5, 6, 7], frameRate: 4, repeat: -1 },
  { key: MISSION_ANIMS.markerReady, texture: 'quest_markers', frames: [8, 9, 10, 11], frameRate: 6, repeat: -1 },
  { key: MISSION_ANIMS.herbGlow, texture: 'mission_herb', frames: [0, 1, 2, 3], frameRate: 6, repeat: -1 },
  { key: MISSION_ANIMS.toolsGlow, texture: 'mission_tools', frames: [0, 1, 2, 3], frameRate: 6, repeat: -1 },
  { key: MISSION_ANIMS.strangePulse, texture: 'mission_strange', frames: [0, 1, 2, 3, 4, 5], frameRate: 6, repeat: -1 },
];

/** Cor de fallback (retângulo) se a folha falhar ao carregar. */
export const MISSION_FALLBACK_COLORS: Readonly<Record<MissionTextureKey, number>> = {
  quest_markers: 0xfacc15,
  mission_herb: 0x22c55e,
  mission_tools: 0x78716c,
  mission_strange: 0x7c3aed,
  mission_icons: 0xe5e7eb,
};
