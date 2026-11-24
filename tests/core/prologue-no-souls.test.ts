import { describe, expect, it } from 'vitest';
import type { CampaignStageId, RunEndReport } from '../../src/core';
import {
  applyRunOutcomeToProfile,
  createDefaultProfile,
} from '../../src/core/progression/ProfileManager';

// Decisão #27: o prólogo não conta Almas (nem Essências), na vitória ou na derrota. Ato 1 segue igual.

function report(stageId: CampaignStageId | undefined, victory: boolean): RunEndReport {
  return {
    victory,
    soulsGained: 37,
    essencesGained: 4,
    monstersKilled: 9,
    bossDefeated: victory,
    keptItems: [],
    lostItems: [],
    stageId,
  };
}

const prologueStages: CampaignStageId[] = ['mission_herbs', 'mission_mine', 'mission_depths'];

describe('Prólogo não conta Almas (Decisão #27)', () => {
  for (const stageId of prologueStages) {
    for (const victory of [true, false]) {
      it(`${stageId} (${victory ? 'vitória' : 'derrota'}) não credita Almas nem Essências`, () => {
        const profile = createDefaultProfile();
        profile.souls = 5;
        profile.generalEssences = 2;
        applyRunOutcomeToProfile(profile, report(stageId, victory));
        expect(profile.souls).toBe(5);
        expect(profile.generalEssences).toBe(2);
        expect(profile.stats.totalSoulsEarned).toBe(0);
        if (victory) {
          expect(profile.stats.runsCompleted).toBe(1);
        } else {
          expect(profile.stats.runsFailed).toBe(1);
        }
      });
    }
  }

  it('Ato 1 continua creditando Almas e Essências (vitória e derrota)', () => {
    for (const victory of [true, false]) {
      const profile = createDefaultProfile();
      applyRunOutcomeToProfile(profile, report('act1_submundo', victory));
      expect(profile.souls).toBe(37);
      expect(profile.stats.totalSoulsEarned).toBe(37);
      expect(profile.generalEssences).toBe(4);
    }
  });

  it('relatório sem stageId mantém o comportamento antigo', () => {
    const profile = createDefaultProfile();
    applyRunOutcomeToProfile(profile, report(undefined, true));
    expect(profile.souls).toBe(37);
  });
});
