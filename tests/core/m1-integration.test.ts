import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import dialoguesData from '../../src/data/dialogues.json';
import monstersData from '../../src/data/monsters.json';
import skillsData from '../../src/data/skills.json';
import {
  distanceBetween,
  findNearestLivingMonster,
  tickCombat,
  triggerHeroSkill,
} from '../../src/core/combat/CombatEngine';
import { createSeededRng } from '../../src/core/dungeon/DungeonGenerator';
import {
  advanceToNextRoom,
  createDungeonRun,
  evaluateRoomState,
  getCurrentRoom,
} from '../../src/core/dungeon/DungeonRun';
import { applyDamageToHero, createHero, moveHero } from '../../src/core/entities/Hero';
import { spawnMonster } from '../../src/core/entities/Monster';
import type { MonsterDef, SkillDef } from '../../src/core/index';

const MONSTER_DEFS = monstersData as MonsterDef[];
const SKILL_DEFS = skillsData as SkillDef[];

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectTsFiles(full));
    } else if (full.endsWith('.ts')) {
      results.push(full);
    }
  }
  return results;
}

describe('M1 Full Dungeon Run Integration (T-010)', () => {
  it('completes a full 5-room dungeon run from Room 1 to Boss victory using movement, auto-attack, dash, skills, and potion', () => {
    const arenaWidth = 800;
    const arenaHeight = 600;
    const rng = createSeededRng(20261117);
    const run = createDungeonRun(arenaWidth, arenaHeight, 1337);
    // Boost hero stats slightly for fast deterministic simulation while exercising all systems
    const hero = createHero(
      { x: 400, y: 300 },
      { maxHp: 260, hp: 260, attack: 28, defense: 8, moveSpeed: 180 }
    );

    const defMap = new Map<string, MonsterDef>(MONSTER_DEFS.map((d) => [d.id, d]));

    let dashUsed = false;
    let active1Used = false;
    let active2Used = false;
    let potionUsed = false;
    let nowMs = 0;
    const deltaMs = 50;

    for (let roomIndex = 0; roomIndex < run.totalRooms; roomIndex++) {
      const room = getCurrentRoom(run);
      expect(room.roomNumber).toBe(roomIndex + 1);
      expect(room.isBossRoom).toBe(roomIndex === 4);

      hero.position = { x: arenaWidth / 2, y: arenaHeight / 2 };
      const monsters = room.spawns.map((s, idx) =>
        spawnMonster(defMap.get(s.defId)!, `r${room.roomNumber}_m${idx}`, { x: s.x, y: s.y })
      );

      if (room.isBossRoom) {
        expect(monsters.some((m) => m.defId === 'infernal_warden' && m.type === 'boss')).toBe(
          true
        );
      }

      let safetySteps = 0;
      while (monsters.some((m) => m.isAlive) && hero.isAlive && safetySteps < 2000) {
        safetySteps += 1;
        nowMs += deltaMs;
        run.elapsedMs += deltaMs;

        const target = findNearestLivingMonster(hero.position, monsters);
        if (target) {
          const dist = distanceBetween(hero.position, target.position);
          if (dist > hero.stats.attackRange * 0.8) {
            const dx = target.position.x - hero.position.x;
            const dy = target.position.y - hero.position.y;
            moveHero(hero, { x: dx, y: dy }, deltaMs, {
              width: arenaWidth,
              height: arenaHeight,
              padding: 36,
            });
          }

          // Use Spectral Dash when approaching monsters
          const dashEvents = triggerHeroSkill(hero, 'spectral_dash', monsters, nowMs, {
            bounds: { width: arenaWidth, height: arenaHeight, padding: 36 },
            direction: hero.facing,
            rng,
          });
          if (dashEvents.some((e) => e.type === 'hero_dash')) {
            dashUsed = true;
          }

          // Use active AoE skills when in range
          if (dist <= 125) {
            const e2 = triggerHeroSkill(hero, 'infernal_eruption', monsters, nowMs, { rng });
            if (e2.length > 0) {
              active2Used = true;
              for (const ev of e2) {
                if (ev.type === 'monster_killed') {
                  run.monstersKilled += 1;
                  run.soulsCollected += ev.value ?? 0;
                }
              }
            }
          }
          if (dist <= 78) {
            const e1 = triggerHeroSkill(hero, 'crimson_cleave', monsters, nowMs, { rng });
            if (e1.length > 0) {
              active1Used = true;
              for (const ev of e1) {
                if (ev.type === 'monster_killed') {
                  run.monstersKilled += 1;
                  run.soulsCollected += ev.value ?? 0;
                }
              }
            }
          }
        }

        // Trigger potion if hero took damage or force a test damage in room 2 to verify potion in run
        if (!potionUsed && room.roomNumber === 2 && hero.stats.hp === hero.stats.maxHp) {
          applyDamageToHero(hero, 40, nowMs + 1000);
        }
        if (hero.stats.hp <= hero.stats.maxHp * 0.85 && hero.potionCharges > 0) {
          const pEvents = triggerHeroSkill(hero, 'soul_potion', monsters, nowMs, { rng });
          if (pEvents.some((e) => e.type === 'hero_healed')) {
            potionUsed = true;
          }
        }

        const tickEvents = tickCombat(hero, monsters, deltaMs, nowMs, rng);
        for (const ev of tickEvents) {
          if (ev.type === 'monster_killed') {
            run.monstersKilled += 1;
            run.soulsCollected += ev.value ?? 0;
          }
        }

        const livingCount = monsters.filter((m) => m.isAlive).length;
        evaluateRoomState(run, livingCount, hero.isAlive);
      }

      expect(hero.isAlive).toBe(true);
      expect(monsters.every((m) => !m.isAlive)).toBe(true);

      if (roomIndex < run.totalRooms - 1) {
        expect(run.status).toBe('room_cleared');
        const nextRoom = advanceToNextRoom(run);
        expect(nextRoom).not.toBeNull();
        expect(run.status).toBe('in_progress');
      } else {
        expect(run.status).toBe('victory');
      }
    }

    expect(dashUsed).toBe(true);
    expect(active1Used).toBe(true);
    expect(active2Used).toBe(true);
    expect(potionUsed).toBe(true);
    expect(run.monstersKilled).toBe(21); // 3 + 4 + 5 + 6 + 3 = 21 total monsters across 5 rooms
    expect(run.soulsCollected).toBe(hero.souls);
    expect(hero.souls).toBeGreaterThanOrEqual(250);
  });

  it('preserves collected Souls when the hero dies mid-run (Defeat loop risk rule)', () => {
    const run = createDungeonRun(360, 640, 999);
    const hero = createHero({ x: 180, y: 320 });
    const slimeDef = MONSTER_DEFS.find((m) => m.id === 'abyssal_slime')!;
    const bossDef = MONSTER_DEFS.find((m) => m.id === 'infernal_warden')!;

    const slime = spawnMonster(slimeDef, 's1', { x: 190, y: 320 });
    // Kill slime with Eruption
    hero.stats.attack = 50;
    const killEvents = triggerHeroSkill(hero, 'infernal_eruption', [slime], 1000, {
      rng: () => 0.99,
    });
    expect(killEvents.some((e) => e.type === 'monster_killed')).toBe(true);
    expect(hero.souls).toBe(slimeDef.soulReward);
    run.soulsCollected += slimeDef.soulReward;

    // Now hero takes fatal damage from Boss
    const boss = spawnMonster(bossDef, 'b1', { x: 185, y: 320 });
    applyDamageToHero(hero, 999, 2000);
    expect(hero.isAlive).toBe(false);

    const status = evaluateRoomState(run, 1, hero.isAlive);
    expect(status).toBe('defeat');
    expect(hero.souls).toBe(slimeDef.soulReward);
    expect(run.soulsCollected).toBe(slimeDef.soulReward);
    expect(tickCombat(hero, [boss], 16, 2500)).toHaveLength(0);
  });

  it('enforces zero Phaser imports in all src/core/**/*.ts files and validates JSON catalogs', () => {
    const coreDir = resolve(process.cwd(), 'src/core');
    const coreFiles = collectTsFiles(coreDir);
    expect(coreFiles.length).toBeGreaterThanOrEqual(6);

    for (const file of coreFiles) {
      const source = readFileSync(file, 'utf-8');
      expect(source).not.toMatch(/from\s+['"]phaser['"]/i);
      expect(source).not.toMatch(/import\s+['"]phaser['"]/i);
    }

    expect(MONSTER_DEFS.map((m) => m.id)).toEqual([
      'abyssal_slime',
      'bone_sentinel',
      'infernal_warden',
      'cave_bat',
      'abyss_herald',
    ]);
    expect(SKILL_DEFS.map((s) => s.id)).toEqual([
      'spectral_dash',
      'crimson_cleave',
      'infernal_eruption',
      'soul_potion',
    ]);
    expect(dialoguesData.entries.dungeon_enter.shortText.length).toBeGreaterThan(10);
    expect(dialoguesData.entries.boss_intro.shortText.length).toBeGreaterThan(10);
    expect(dialoguesData.entries.run_victory.title.length).toBeGreaterThan(5);
    expect(dialoguesData.entries.run_death.title.length).toBeGreaterThan(5);
  });
});
