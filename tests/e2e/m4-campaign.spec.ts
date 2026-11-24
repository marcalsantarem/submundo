import { test } from '@playwright/test';

// APOSENTADO — M11 (Decisão #29): todo o conteúdo da m4 era do prólogo antigo e da Vila
// (prologue_grotto -> prologue_mine -> prologue_seal -> Queda da Vila, DialogueBox na Vila,
// Ferreiro T-051). A Vila saiu do fluxo e o arquivo nem carregava no Playwright
// (erro de ambiente: `campaign.json` sem `type: json`).
// O histórico do arquivo original está no Git. O novo prólogo vem no M12.
test.describe.skip('SUBMUNDO M4 — Campaign / Prólogo antigo (aposentado no M11)', () => {
  test('aposentado: Vila e prólogo antigo fora do fluxo (Decisão #29)', () => {});
});
