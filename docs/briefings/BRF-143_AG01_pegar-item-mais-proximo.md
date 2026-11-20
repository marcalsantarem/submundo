# BRF-143 — AG01 — T-132 Ação "pegar item mais próximo" na DungeonScene
**Leia:** `docs/agentes/AG01_Gameplay.md`, a decisão #21 em `docs/decisoes.md` e, em `src/view/scenes/DungeonScene.ts`, a coleta por clique da T-125 (caminhada até o item, cancelamento, mochila cheia), a criação do `DungeonHud` (callbacks) e a montagem do `HudSnapshot`. **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono (#21):** além do clique no item, um botão "Pegar" na roda de ação (e a tecla `E`) coleta o **item mais próximo no chão**. A coleta automática por proximidade continua desligada; as almas seguem automáticas.
**Contrato (o AG02 faz o botão no `DungeonHud.ts` em paralelo):** callback `onPickupNearest?: () => void` e campos do snapshot `pickupAvailable?: boolean` e `pickupRarity?: 'common' | 'magic' | 'rare' | 'legendary'`. Se o tipo ainda não existir no HUD quando você compilar, espere o AG02 e confira de novo; não edite `DungeonHud.ts`.
**Fazer:**
(1) `pickUpNearestDrop()`: pega o drop mais próximo dos pés do herói num raio de busca de **~180 px** de mundo. Se estiver a até ~70 px (o mesmo alcance do clique), coleta na hora. Se estiver mais longe, reaproveita a caminhada automática da T-125 até ele (com os mesmos cancelamentos). Fora do raio, nada acontece. Mochila cheia mostra o mesmo banner. Ligue ao `onPickupNearest` na criação do HUD.
(2) No snapshot de cada frame: `pickupAvailable` = existe drop no raio de busca, e `pickupRarity` = a raridade do mais próximo. O cálculo é barato (itera `groundDrops`).
(3) Vale na campanha e na testArena. Não altere o clique no item nem a regra de almas.
(4) Debug: `pickUpNearest()` em `window.__SUBMUNDO_DEBUG__`.
**Permitido:** `src/view/scenes/DungeonScene.ts`. **Proibido:** `DungeonHud.ts`, `src/core/`, assets, `tests/`, Git.
**Pronto quando:** `npm test`, `npm run build` e `npx playwright test tests/e2e/m8-ground-pickup.spec.ts --workers=1` passam. Se conseguir, confira no navegador (porta 5197, encerre depois): item a ~120 px, tecla `E`, o herói caminha e coleta; item a ~400 px, `E` não faz nada.
**Entrega:** até 6 linhas: o que mudou, os raios usados e o que não foi verificado.
