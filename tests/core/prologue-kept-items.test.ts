import { describe, expect, it } from 'vitest';
import type { ItemInstance, RunEndReport } from '../../src/core';
import { createSeededRng } from '../../src/core/dungeon/DungeonGenerator';
import { generateItemDrop } from '../../src/core/loot/LootGenerator';
import { createRunInventory, resolveRunEndLoot } from '../../src/core/loot/Inventory';
import {
  applyRunOutcomeToProfile,
  createDefaultProfile,
  isPrologueMissionReport,
} from '../../src/core/progression/ProfileManager';
import type { CampaignStageId, SaveProfile } from '../../src/core';

// T-150 (Decisão #26): itens pegos numa missão do prólogo ficam com o jogador na vitória e na derrota.

function drop(seed: number, slot: ItemInstance['slot'], prefix: string): ItemInstance {
  return generateItemDrop({
    rng: createSeededRng(seed),
    forcedRarity: 'magic',
    forcedSlot: slot,
    idPrefix: prefix,
  });
}

/** Monta o relatório como a DungeonScene: resolveRunEndLoot e filtro do gear que veio da Vila. */
function buildReport(
  profile: SaveProfile,
  stageId: CampaignStageId,
  victory: boolean,
  runEquipped: ItemInstance[],
  runBag: ItemInstance[]
): RunEndReport {
  const inv = createRunInventory();
  const hubIds = new Set<string>();
  for (const item of Object.values(profile.equipped)) {
    if (item) {
      inv.equipped[item.slot] = item;
      hubIds.add(item.instanceId);
    }
  }
  for (const item of runEquipped) {
    inv.equipped[item.slot] = item;
  }
  inv.bag.push(...runBag);
  const { kept, lost } = resolveRunEndLoot(inv, victory);
  return {
    victory,
    soulsGained: 10,
    essencesGained: 0,
    monstersKilled: 5,
    bossDefeated: false,
    keptItems: kept.filter((i) => !hubIds.has(i.instanceId)),
    lostItems: lost.filter((i) => !hubIds.has(i.instanceId)),
    stageId,
  };
}

function allIds(profile: SaveProfile): string[] {
  return [
    ...Object.values(profile.equipped).filter((i): i is ItemInstance => i !== null),
    ...profile.stash,
  ].map((i) => i.instanceId);
}

describe('Itens da missão mantidos no prólogo (T-150)', () => {
  it('identifica relatórios de missão do prólogo', () => {
    const base = { victory: true, soulsGained: 0, essencesGained: 0, monstersKilled: 0, bossDefeated: false, keptItems: [], lostItems: [] };
    expect(isPrologueMissionReport({ ...base, stageId: 'mission_herbs' })).toBe(true);
    expect(isPrologueMissionReport({ ...base, stageId: 'mission_depths' })).toBe(true);
    expect(isPrologueMissionReport({ ...base, stageId: 'act1_submundo' })).toBe(false);
    expect(isPrologueMissionReport(base)).toBe(false);
  });

  it('vitória: item equipado na missão continua equipado e o da mochila vai ao Baú', () => {
    const profile = createDefaultProfile();
    const hubWeapon = drop(1, 'weapon', 'hub');
    profile.equipped.weapon = hubWeapon;
    const helm = drop(2, 'helm', 'run');
    const extraWeapon = drop(3, 'weapon', 'run');

    const report = buildReport(profile, 'mission_herbs', true, [helm], [extraWeapon]);
    applyRunOutcomeToProfile(profile, report);

    expect(profile.equipped.weapon?.instanceId).toBe(hubWeapon.instanceId);
    expect(profile.equipped.helm?.instanceId).toBe(helm.instanceId);
    expect(profile.stash.map((i) => i.instanceId)).toEqual([extraWeapon.instanceId]);
  });

  it('derrota: os itens pegos na missão não se perdem', () => {
    const profile = createDefaultProfile();
    const hubWeapon = drop(4, 'weapon', 'hub');
    profile.equipped.weapon = hubWeapon;
    const boots = drop(5, 'boots', 'run');
    const ring = drop(6, 'ring', 'run');
    const extraWeapon = drop(7, 'weapon', 'run');

    const report = buildReport(profile, 'mission_mine', false, [boots], [ring, extraWeapon]);
    expect(report.keptItems).toHaveLength(0);
    applyRunOutcomeToProfile(profile, report);

    expect(profile.stats.runsFailed).toBe(1);
    expect(profile.souls).toBe(10);
    expect(profile.equipped.weapon?.instanceId).toBe(hubWeapon.instanceId);
    expect(profile.equipped.boots?.instanceId).toBe(boots.instanceId);
    expect(profile.equipped.ring?.instanceId).toBe(ring.instanceId);
    expect(profile.stash.map((i) => i.instanceId)).toEqual([extraWeapon.instanceId]);
  });

  it('não duplica ao aplicar o mesmo relatório duas vezes (vitória e derrota)', () => {
    for (const victory of [true, false]) {
      const profile = createDefaultProfile();
      const items = [drop(8, 'amulet', 'run'), drop(9, 'amulet', 'run'), drop(10, 'armor', 'run')];
      const report = buildReport(profile, 'mission_depths', victory, [items[0]], items.slice(1));
      applyRunOutcomeToProfile(profile, report);
      applyRunOutcomeToProfile(profile, report);
      const ids = allIds(profile);
      expect(ids).toHaveLength(3);
      expect(new Set(ids).size).toBe(3);
    }
  });

  it('fora do prólogo a morte continua descartando os itens da run', () => {
    const profile = createDefaultProfile();
    const report = buildReport(profile, 'act1_submundo', false, [drop(11, 'helm', 'run')], [drop(12, 'ring', 'run')]);
    applyRunOutcomeToProfile(profile, report);
    expect(allIds(profile)).toHaveLength(0);
  });
});
