# BRF-152 — AG07 (Arquiteto): Preload dos Assets da Vila Natal, Boot no Hub e Versão 0.9.0 (T-140)

- **Task:** `T-140` (M9 — `v0.9.0`)
- **Agente:** `AG07 (Arquiteto)`
- **Arquivos sob sua posse exclusiva nesta onda:**
  - `src/view/scenes/BootScene.ts`
  - `src/core/index.ts`
  - `package.json`
  - `src/version.ts`
  - `tests/core/architecture.test.ts`
  - `public/sw.js`

## Objetivo
Pré-carregar todos os novos spritesheets da Vila Natal e dos 3 NPCs (`T-133` e `T-134`) em `BootScene.ts`, registrar suas animações globais, iniciar o jogo por padrão na `HubScene` (preservando boot direto em `DungeonScene` com `{ testArena: true }` apenas quando houver query params de teste de arena na URL), atualizar contratos em `src/core/index.ts` e subir a versão do projeto para `0.9.0`.

## Requisitos Técnicos Obrigatórios

1. **`src/view/scenes/BootScene.ts`:**
   - Adicionar em `SPRITESHEET_SPECS` os 8 novos assets da Vila Natal (dimensões exatas do `public/assets/sprites/manifest.json`):
     - `village_hub_tiles`: `'assets/sprites/village_hub_tiles.png'`, `frameWidth: 32`, `frameHeight: 32`, `fallbackColor: 0x4b382a`
     - `village_hub_props`: `'assets/sprites/village_hub_props.png'`, `frameWidth: 32`, `frameHeight: 32`, `fallbackColor: 0x78350f`
     - `village_hub_props_large`: `'assets/sprites/village_hub_props_large.png'`, `frameWidth: 64`, `frameHeight: 64`, `fallbackColor: 0x92400e`
     - `village_hub_house`: `'assets/sprites/village_hub_house.png'`, `frameWidth: 224`, `frameHeight: 192`, `fallbackColor: 0x713f12`
     - `village_hub_gate`: `'assets/sprites/village_hub_gate.png'`, `frameWidth: 192`, `frameHeight: 160`, `fallbackColor: 0x57534e`
     - `npc_weapon_master`: `'assets/sprites/npc_weapon_master.png'`, `frameWidth: 80`, `frameHeight: 80`, `fallbackColor: 0x64748b`
     - `npc_lyra`: `'assets/sprites/npc_lyra.png'`, `frameWidth: 80`, `frameHeight: 80`, `fallbackColor: 0x15803d`
     - `npc_gorran`: `'assets/sprites/npc_gorran.png'`, `frameWidth: 80`, `frameHeight: 80`, `fallbackColor: 0xb45309`
   - Todos esses 8 assets são Pixel Art e devem receber `Phaser.Textures.FilterMode.NEAREST` (já garantido por não estarem em `LINEAR_TEXTURE_KEYS`).
   - Em `createGlobalAnimations()`, registrar com segurança (verificando `this.textures.exists(key)` e existência do frame final antes de criar):
     - `village_campfire_idle`: `village_hub_props` frames `6..9`, `frameRate: 8`, `repeat: -1`
     - `village_brazier_idle`: `village_hub_props` frames `10..13`, `frameRate: 8`, `repeat: -1`
     - `village_torch_idle`: `village_hub_props` frames `14..17`, `frameRate: 8`, `repeat: -1`
     - `village_forge_idle`: `village_hub_props` frames `18..21`, `frameRate: 8`, `repeat: -1`
     - `village_campfire_large_idle`: `village_hub_props_large` frames `0..3`, `frameRate: 8`, `repeat: -1`
     - `village_forge_large_idle`: `village_hub_props_large` frames `4..7`, `frameRate: 8`, `repeat: -1`
     - `npc_weapon_master_idle`: `npc_weapon_master` frames `0..3`, `frameRate: 5`, `repeat: -1`
     - `npc_lyra_idle`: `npc_lyra` frames `0..3`, `frameRate: 5`, `repeat: -1`
     - `npc_gorran_idle`: `npc_gorran` frames `0..3`, `frameRate: 5`, `repeat: -1`
     - `npc_gorran_hammer`: `npc_gorran` frames `4..7`, `frameRate: 7`, `repeat: -1`
   - **Cena Inicial em `BootScene.create()`:**
     - Verificar `window.location.search` (quando `typeof window !== 'undefined'`): se a query string contiver `testArena`, `biome`, `map` ou `seed` (ex.: `params.has('testArena') || params.has('biome') || params.has('map') || params.has('seed')`), iniciar `this.scene.start('DungeonScene', { testArena: true })` (mantendo 100% de compatibilidade com os testes E2E de M8!).
     - Caso contrário (abertura padrão `/` do jogo no M9), iniciar **`this.scene.start('HubScene')`** (com fallback para `DungeonScene` se `HubScene` não estiver registrada no scene manager).

2. **`src/core/index.ts`:**
   - Na interface `HubTransitionData`, adicionar os campos opcionais:
     - `returnedFromDungeon?: boolean;`
     - `applyOutcome?: boolean;`
   - Reexportar os símbolos de `./progression/VillageHubManager`:
     - `export * from './progression/VillageHubManager';`

3. **Subir Versão para `0.9.0`:**
   - `package.json`: `"version": "0.9.0"`
   - `src/version.ts`: `export const GAME_VERSION = '0.9.0';`
   - `tests/core/architecture.test.ts`: atualizar asserção de versão para `'0.9.0'`
   - `public/sw.js`: atualizar `CACHE_NAME` para `'submundo-v0.9.0'`

## Restrições
- **Proibido executar comandos `git`.**
- Não editar `HubScene.ts`, `DungeonScene.ts` ou arquivos em `src/view/ui/` (estão com `AG02` e `AG01` em paralelo).
