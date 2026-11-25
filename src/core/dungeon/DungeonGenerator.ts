import type { BiomeId, CampaignStageDef } from '../index';

export interface RoomSpawn {
  defId: string;
  x: number;
  y: number;
}

export interface RoomSpec {
  roomNumber: number;
  isBossRoom: boolean;
  title: string;
  spawns: RoomSpawn[];
  biome?: BiomeId;
  difficultyScale?: number;
}

const DEFAULT_ARENA_WIDTH = 960;
const DEFAULT_ARENA_HEIGHT = 540;
const DEFAULT_SEED = 1337;
const SAFE_BORDER_MARGIN = 48;
const SAFE_HERO_RADIUS = 110;

const ROOM_TEMPLATES: ReadonlyArray<{
  roomNumber: number;
  isBossRoom: boolean;
  title: string;
  monsters: ReadonlyArray<string>;
}> = [
  {
    roomNumber: 1,
    isBossRoom: false,
    title: 'Sala 1 — Entrada Abissal',
    monsters: ['abyssal_slime', 'abyssal_slime', 'abyssal_slime'],
  },
  {
    roomNumber: 2,
    isBossRoom: false,
    title: 'Sala 2 — Corredor de Ossos',
    monsters: ['abyssal_slime', 'abyssal_slime', 'abyssal_slime', 'bone_sentinel'],
  },
  {
    roomNumber: 3,
    isBossRoom: false,
    title: 'Sala 3 — Cripta Profana',
    monsters: ['abyssal_slime', 'abyssal_slime', 'bone_sentinel', 'bone_sentinel', 'bone_sentinel'],
  },
  {
    roomNumber: 4,
    isBossRoom: false,
    title: 'Sala 4 — Antecâmara das Cinzas',
    monsters: [
      'abyssal_slime',
      'abyssal_slime',
      'abyssal_slime',
      'bone_sentinel',
      'bone_sentinel',
      'bone_sentinel',
    ],
  },
  {
    roomNumber: 5,
    isBossRoom: true,
    title: 'Sala 5 — Trono do Carcereiro Infernal',
    monsters: ['infernal_warden', 'bone_sentinel', 'abyssal_slime'],
  },
];

/**
 * PRNG determinístico Mulberry32 retornando floats no intervalo [0, 1).
 */
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function computeSafeSpawnPoint(
  rng: () => number,
  arenaWidth: number,
  arenaHeight: number,
  margin: number,
  heroStartX: number,
  heroStartY: number,
  minHeroDist: number
): { x: number; y: number } {
  const minX = margin;
  const maxX = Math.max(margin, arenaWidth - margin);
  const minY = margin;
  const maxY = Math.max(margin, arenaHeight - margin);

  for (let attempt = 0; attempt < 20; attempt++) {
    const candidateX = Math.round(minX + rng() * (maxX - minX));
    const candidateY = Math.round(minY + rng() * (maxY - minY));
    const dist = Math.hypot(candidateX - heroStartX, candidateY - heroStartY);
    if (dist >= minHeroDist) {
      return { x: candidateX, y: candidateY };
    }
  }

  const angle = rng() * Math.PI * 2;
  const fallbackX = clamp(
    Math.round(heroStartX + Math.cos(angle) * minHeroDist),
    minX,
    maxX
  );
  const fallbackY = clamp(
    Math.round(heroStartY + Math.sin(angle) * minHeroDist),
    minY,
    maxY
  );
  return { x: fallbackX, y: fallbackY };
}

function generateStageRooms(
  stage: CampaignStageDef,
  rng: () => number,
  arenaWidth: number,
  arenaHeight: number,
  margin: number,
  heroStartX: number,
  heroStartY: number,
  minHeroDist: number
): RoomSpec[] {
  const totalRooms = Math.max(1, Math.floor(stage.totalRooms));
  const pool = stage.monsterPool.length > 0 ? stage.monsterPool : ['abyssal_slime'];
  const rooms: RoomSpec[] = [];

  for (let roomIndex = 0; roomIndex < totalRooms; roomIndex++) {
    const roomNumber = roomIndex + 1;
    const isBossRoom = roomIndex === totalRooms - 1;
    const monsterIds: string[] = [];

    if (isBossRoom) {
      // `bossId` is optional (e.g. `mission_herbs` has no boss).
      if (stage.bossId) {
        monsterIds.push(stage.bossId);
      }
      const escortCount = stage.difficultyScale >= 0.85 ? 2 : 1;
      for (let i = 0; i < escortCount; i++) {
        const pick = pool[Math.floor(rng() * pool.length)];
        monsterIds.push(pick);
      }
    } else {
      const count = 2 + roomIndex + (stage.difficultyScale >= 1 ? 1 : 0);
      for (let i = 0; i < count; i++) {
        const pick = pool[Math.floor(rng() * pool.length)];
        monsterIds.push(pick);
      }
    }

    const spawns: RoomSpawn[] = monsterIds.map((defId) => {
      const pos = computeSafeSpawnPoint(
        rng,
        arenaWidth,
        arenaHeight,
        margin,
        heroStartX,
        heroStartY,
        minHeroDist
      );
      return {
        defId,
        x: pos.x,
        y: pos.y,
      };
    });

    rooms.push({
      roomNumber,
      isBossRoom,
      title: isBossRoom
        ? `Sala ${roomNumber} — ${stage.name} (Chefe)`
        : `Sala ${roomNumber} — ${stage.name}`,
      spawns,
      biome: stage.biome,
      difficultyScale: stage.difficultyScale,
    });
  }

  return rooms;
}

/**
 * Gera exatamente 5 salas padrão (Salas 1 a 4 normais progressivas + Sala 5 Boss com escolta)
 * ou salas configuradas pelo estágio da campanha quando `stage` é fornecido.
 */
export function generateDungeonRooms(
  arenaWidth: number = DEFAULT_ARENA_WIDTH,
  arenaHeight: number = DEFAULT_ARENA_HEIGHT,
  seed: number = DEFAULT_SEED,
  stage?: CampaignStageDef
): RoomSpec[] {
  const rng = createSeededRng(seed);
  const margin = Math.min(
    SAFE_BORDER_MARGIN,
    Math.floor(Math.min(arenaWidth, arenaHeight) * 0.15)
  );
  const heroStartX = arenaWidth / 2;
  const heroStartY = arenaHeight / 2;
  const minHeroDist = Math.min(
    SAFE_HERO_RADIUS,
    Math.floor(Math.min(arenaWidth, arenaHeight) * 0.28)
  );

  if (stage) {
    return generateStageRooms(
      stage,
      rng,
      arenaWidth,
      arenaHeight,
      margin,
      heroStartX,
      heroStartY,
      minHeroDist
    );
  }

  return ROOM_TEMPLATES.map((template) => {
    const spawns: RoomSpawn[] = template.monsters.map((defId) => {
      const pos = computeSafeSpawnPoint(
        rng,
        arenaWidth,
        arenaHeight,
        margin,
        heroStartX,
        heroStartY,
        minHeroDist
      );
      return {
        defId,
        x: pos.x,
        y: pos.y,
      };
    });

    return {
      roomNumber: template.roomNumber,
      isBossRoom: template.isBossRoom,
      title: template.title,
      spawns,
    };
  });
}
