# BRF-037 — AG02 — T-035 Cena interativa do Refúgio no Submundo (HubScene)

**Leia:** `docs/agentes/AG02_UI.md`, `src/core/index.ts`, `src/core/progression/ProfileManager.ts`, `src/view/ui/AltarModal.ts`, `src/view/ui/BlacksmithModal.ts`, `src/view/ui/HubHud.ts`, `src/view/ui/InventoryModal.ts`, `src/data/dialogues.json`. **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono:** Autorização explícita da `T-035` (M3 `v0.3.0`).
**Contrato (`src/view/scenes/HubScene.ts`):**
- `export interface SubmundoHubDebugApi { scene: HubScene; getProfile: () => SaveProfile; openAltar: () => void; openBlacksmith: () => void; openStash: () => void; enterDungeon: () => void; grantTestResources: (souls: number, essences?: number) => void; }`
- Expor `window.__SUBMUNDO_HUB_DEBUG__` quando em `HubScene`.
- Receber `HubTransitionData` no `create(data?: HubTransitionData)`:
  - Carregar `SaveProfile` via `loadOrCreateProfile()`. Se `data?.fromRun` existir, aplicar `applyRunOutcomeToProfile(this.profile, data.fromRun)`, chamar `persistProfile(this.profile)` e exibir banner resumindo Almas/Essências/espólios da incursão (ou `hub_welcome` na entrada inicial).
- Renderizar o Refúgio no Submundo (`800x600` PC e `360x640` Mobile) usando `hub_tiles` (com fallback se ausente) + 4 estações interativas usando `hub_npcs` (frames `0 = emissary`, `1 = blacksmith`, `2 = soul_altar`, `3 = rift_portal`) + sprite do Espectro (`wraith_warrior`) controlável via `HubHud` (`WASD`/Joystick).
- Aproximar-se (`<= 58px`) de uma estação destaca rótulo/`nearbyStationLabel` e permite interagir (`E`/Espaço/botão `Interagir`) ou clicar/tocar nos NPCs ou nos atalhos diretos do `HubHud`:
  - **Altar de Almas:** abre `AltarModal`, executa `purchaseAltarUpgrade` + `persistProfile`.
  - **Ferreiro Espiritual:** abre `BlacksmithModal`, executa `upgradeItemWithBlacksmith` / `forgeItemWithBlacksmith` + `persistProfile`.
  - **Baú / Arsenal:** abre `InventoryModal` conectado a `equipStashItem` / `unequipProfileSlot` + `persistProfile`.
  - **Emissário Celestial:** exibe diálogo temático/lore do Refúgio.
  - **Portal da Fenda (`enterDungeon`):** chama `persistProfile(this.profile)` e inicia `this.scene.start('DungeonScene', { profileSnapshot: this.profile })`.
**Fazer:** Criar `src/view/scenes/HubScene.ts` com `resize` e limpeza completa em `SHUTDOWN`.
**Permitido:** `src/view/scenes/HubScene.ts`.
**Proibido:** `src/core/`, `src/view/scenes/DungeonScene.ts`, `src/view/scenes/BootScene.ts`, `src/main.ts`, `tests/` e comandos git.
**Pronto quando:** `npm run typecheck` e `npm run build` passarem 100% verdes.
**Entrega:** até 6 linhas: funcionalidades implementadas em `HubScene.ts`, responsividade e resultado de `typecheck`/`build`.
