import { describe, expect, it } from 'vitest';
import {
  createSeededRng,
  generateDungeonRooms,
} from '../../src/core/dungeon/DungeonGenerator';
import {
  advanceToNextRoom,
  createDungeonRun,
  evaluateRoomState,
  getCurrentRoom,
} from '../../src/core/dungeon/DungeonRun';

describe('DungeonGenerator & DungeonRun (M1 T-007)', () => {
  it('produces deterministic sequences with createSeededRng and generateDungeonRooms', () => {
    const rngA = createSeededRng(424242);
    const rngB = createSeededRng(424242);
    const rngDiff = createSeededRng(999999);

    const seqA = Array.from({ length: 10 }, () => rngA());
    const seqB = Array.from({ length: 10 }, () => rngB());
    const seqDiff = Array.from({ length: 10 }, () => rngDiff());

    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqDiff);

    const roomsA = generateDungeonRooms(800, 600, 777);
    const roomsB = generateDungeonRooms(800, 600, 777);
    const roomsC = generateDungeonRooms(800, 600, 888);

    expect(roomsA).toEqual(roomsB);
    expect(roomsA).not.toEqual(roomsC);
  });

  it('generates 4 progressive normal rooms and 1 Boss room with escort and safe spawn margins', () => {
    const width = 800;
    const height = 600;
    const rooms = generateDungeonRooms(width, height, 1337);

    expect(rooms).toHaveLength(5);

    for (let i = 0; i < 4; i++) {
      const room = rooms[i];
      expect(room.roomNumber).toBe(i + 1);
      expect(room.isBossRoom).toBe(false);
      expect(room.spawns.length).toBeGreaterThanOrEqual(3);
      expect(
        room.spawns.every(
          (s) => s.defId === 'abyssal_slime' || s.defId === 'bone_sentinel'
        )
      ).toBe(true);
      if (i > 0) {
        expect(room.spawns.length).toBeGreaterThanOrEqual(rooms[i - 1].spawns.length);
      }
    }

    const bossRoom = rooms[4];
    expect(bossRoom.roomNumber).toBe(5);
    expect(bossRoom.isBossRoom).toBe(true);
    expect(bossRoom.spawns.some((s) => s.defId === 'infernal_warden')).toBe(true);
    expect(bossRoom.spawns.length).toBeGreaterThan(1);

    const heroStartX = width / 2;
    const heroStartY = height / 2;
    for (const room of rooms) {
      for (const spawn of room.spawns) {
        expect(spawn.x).toBeGreaterThanOrEqual(48);
        expect(spawn.x).toBeLessThanOrEqual(width - 48);
        expect(spawn.y).toBeGreaterThanOrEqual(48);
        expect(spawn.y).toBeLessThanOrEqual(height - 48);
        expect(Math.hypot(spawn.x - heroStartX, spawn.y - heroStartY)).toBeGreaterThanOrEqual(
          100
        );
      }
    }
  });

  it('transitions across rooms 1 to 5 and reaches victory when clearing room 5', () => {
    const run = createDungeonRun(800, 600, 2026);
    expect(run.status).toBe('in_progress');
    expect(run.totalRooms).toBe(5);
    expect(getCurrentRoom(run).roomNumber).toBe(1);

    for (let roomNum = 1; roomNum <= 4; roomNum++) {
      expect(getCurrentRoom(run).roomNumber).toBe(roomNum);
      expect(evaluateRoomState(run, 2, true)).toBe('in_progress');
      expect(evaluateRoomState(run, 0, true)).toBe('room_cleared');
      expect(run.status).toBe('room_cleared');

      const nextRoom = advanceToNextRoom(run);
      expect(nextRoom).not.toBeNull();
      expect(nextRoom?.roomNumber).toBe(roomNum + 1);
      expect(run.status).toBe('in_progress');
    }

    expect(getCurrentRoom(run).roomNumber).toBe(5);
    expect(getCurrentRoom(run).isBossRoom).toBe(true);
    expect(evaluateRoomState(run, 1, true)).toBe('in_progress');
    expect(evaluateRoomState(run, 0, true)).toBe('victory');
    expect(run.status).toBe('victory');
    expect(advanceToNextRoom(run)).toBeNull();
  });

  it('transitions to defeat when hero dies and blocks room advancement', () => {
    const run = createDungeonRun(360, 640, 555);
    expect(evaluateRoomState(run, 3, false)).toBe('defeat');
    expect(run.status).toBe('defeat');
    expect(advanceToNextRoom(run)).toBeNull();
    expect(evaluateRoomState(run, 0, true)).toBe('defeat');
  });
});
