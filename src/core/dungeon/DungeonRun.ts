import { generateDungeonRooms, type RoomSpec } from './DungeonGenerator';

export type RunStatus = 'in_progress' | 'room_cleared' | 'victory' | 'defeat';

export interface DungeonRunState {
  seed: number;
  currentRoomIndex: number;
  totalRooms: number;
  rooms: RoomSpec[];
  status: RunStatus;
  soulsCollected: number;
  monstersKilled: number;
  elapsedMs: number;
}

export function createDungeonRun(
  arenaWidth: number = 800,
  arenaHeight: number = 600,
  seed: number = 1337
): DungeonRunState {
  const rooms = generateDungeonRooms(arenaWidth, arenaHeight, seed);
  return {
    seed,
    currentRoomIndex: 0,
    totalRooms: rooms.length,
    rooms,
    status: 'in_progress',
    soulsCollected: 0,
    monstersKilled: 0,
    elapsedMs: 0,
  };
}

export function getCurrentRoom(run: DungeonRunState): RoomSpec {
  const clampedIndex = Math.max(0, Math.min(run.currentRoomIndex, run.rooms.length - 1));
  return run.rooms[clampedIndex];
}

export function evaluateRoomState(
  run: DungeonRunState,
  livingMonstersCount: number,
  heroAlive: boolean
): RunStatus {
  if (!heroAlive || run.status === 'defeat') {
    run.status = 'defeat';
    return run.status;
  }

  if (run.status === 'victory') {
    return run.status;
  }

  if (livingMonstersCount <= 0) {
    const currentRoom = getCurrentRoom(run);
    const isFinalRoom =
      currentRoom.isBossRoom || run.currentRoomIndex >= run.totalRooms - 1;
    run.status = isFinalRoom ? 'victory' : 'room_cleared';
    return run.status;
  }

  run.status = 'in_progress';
  return run.status;
}

export function advanceToNextRoom(run: DungeonRunState): RoomSpec | null {
  if (run.status === 'defeat' || run.status === 'victory') {
    return null;
  }

  if (run.currentRoomIndex + 1 >= run.rooms.length) {
    return null;
  }

  run.currentRoomIndex += 1;
  run.status = 'in_progress';
  return getCurrentRoom(run);
}
