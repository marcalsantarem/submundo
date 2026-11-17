# Backlog de Tasks — SUBMUNDO

| ID | Descrição curta | Marco | Agente(s) | Estado |
| :--- | :--- | :--- | :--- | :--- |
| T-001 | Setup TS + Vite + Phaser 3 + Vitest, câmera adaptativa (`800x600` PC / `9:16` Mobile), `BootScene` e contratos `src/core/index.ts` (tam. M) | M1 | AG07 (Arquiteto) | feita |
| T-002 | Configuração de deploy no Netlify (`netlify.toml`) e workflow de CI no GitHub Actions (`.github/workflows/ci.yml`) (tam. P) | M1 | AG10 (Plataforma) | feita |
| T-003 | Glossário oficial e lore base (`docs/narrativa.md`) com nomes canônicos do Espectro, 3 monstros e 2 skills do M1 (tam. P) | M1 | AG06 (Narrativa) | feita |
| T-004 | Dados iniciais de balanceamento em `src/data/monsters.json` (Slime, Esqueleto, Boss) e `src/data/skills.json` (Dash, 2 Skills, Poção) (tam. P) | M1 | AG04 (Sistemas/Meta) | feita |
| T-005 | Guia visual (`docs/guia_visual.md`) e gerador via código de spritesheets/tilesets Pixel Art (`.png` em `assets/`) para herói, monstros e masmorra (tam. M) | M1 | AG08 (Arte) | feita |
| T-006 | Lógica pura de entidades, atributos, ataque básico automático, Dash, 2 Skills, Poção e IA dos 3 monstros em `src/core/entities/` e `src/core/combat/` (tam. M) | M1 | AG01 (Gameplay) | feita |
| T-007 | Gerador de incursão de 4 salas + 1 Boss, progressão de ondas e estado da run (vitória/morte) em `src/core/dungeon/` (tam. M) | M1 | AG01 (Gameplay) | feita |
| T-008 | HUD responsivo (`800x600` PC / `9:16` Mobile), joystick virtual flutuante de 1 polegar, botões de Dash/Skills/Poção e input `WASD`/Setas em `src/view/ui/` (tam. M) | M1 | AG02 (UI) | feita |
| T-009 | `DungeonScene` integrando `src/core/`, renderização das 4 salas + Boss, animações de sprites e VFX de combate em `src/view/scenes/DungeonScene.ts` e `src/view/sprites/` (tam. M) | M1 | AG01 (Gameplay) + AG08 (Arte) | feita |
| T-010 | Validação do M1 (suíte 3x, Playwright no navegador real, capturas PC `800x600` e Mobile `9:16`, `docs/qa/qa-M1.md`) e tag `v0.1.0` (tam. M) | M1 | AG03 (QA) + AG00 (Líder) | feita (passa com 2 ressalvas menores) |
| T-011 | Ressalva do QA do M1 no HUD: ocultar rótulo do botão de skill durante o cooldown em `src/view/ui/DungeonHud.ts` (tam. P) | M2 | AG02 (UI) | feita |
| T-012 | Ressalva do QA do M1 na cena: adicionar `return;` após `advanceRoomNow()` em `forceClearRoom` em `src/view/scenes/DungeonScene.ts` (tam. P) | M2 | AG01 (Gameplay) | feita |
| T-013 | Contratos de tipos em `src/core/index.ts` para Equipamentos (`EquipSlot`, `Rarity`, `AffixDef`, `ItemDef`, `ItemInstance`, `StatusEffectType`, `LegendaryPowerId`) (tam. P) | M2 | AG07 (Arquiteto) | feita |
| T-014 | Glossário e textos canônicos de itens base, afixos, poderes lendários e das 3 Forças (`Inferno`, `Submundo`, `Empíreo`) em `docs/narrativa.md` e `src/data/dialogues.json` (tam. P) | M2 | AG06 (Narrativa) | feita |
| T-015 | Catálogo JSON de equipamentos base (4 slots: Arma, Armadura, Amuleto, Anel) e afixos/poderes lendários em `src/data/items.json` e `src/data/affixes.json` (tam. P) | M2 | AG04 (Sistemas/Meta) | feita |
| T-016 | Ícones Pixel Art/2D para os 4 slots de equipamento e drops por raridade em `public/assets/sprites/` + VFX das 3 Forças em `src/view/sprites/CombatVfx.ts` (tam. M) | M2 | AG08 (Arte) | feita |
| T-017 | Gerador determinístico de loot (4 raridades), inventário da run, cálculo de bônus equipados e perda de loot da run na morte em `src/core/loot/` (tam. M) | M2 | AG04 (Sistemas/Meta) | feita |
| T-018 | Sinergias das 3 Forças no combate (`Brasa` 5 cargas, `Sangramento & Roubo de Vida`, `Julgamento & Raio` em críticos) e poderes lendários em `src/core/combat/` (tam. M) | M2 | AG01 (Gameplay) | feita |
| T-019 | Painel responsivo de Inventário e Equipamentos (4 slots, cores de raridade, comparação de atributos e equipar com 1 toque) em `src/view/ui/` (tam. M) | M2 | AG02 (UI) | feita |
| T-020 | Drops físicos na `DungeonScene.ts`, coleta de itens, aplicação de equipamentos/sinergias em tempo real e resumo de espólios extraídos/perdidos (tam. M) | M2 | AG01 (Gameplay) | feita |
| T-021 | Subir versão do projeto para `0.2.0` em `package.json`, `src/version.ts` e `tests/core/architecture.test.ts` (tam. P) | M2 | AG07 (Arquiteto) | em andamento |
| T-022 | Validação do M2 (suíte 3x, Playwright, capturas PC `800x600` e Mobile `9:16`, `docs/qa/qa-M2.md`) e tag `v0.2.0` (tam. M) | M2 | AG03 (QA) + AG00 (Líder) | a fazer |
| T-023 | Habilitar multi-touch (`input: { activePointers: 4 }`) em `src/main.ts` e `touch-action: none` em `index.html` para uso simultâneo de joystick e skills no celular (tam. P) | M2 | AG07 (Arquiteto) | feita |
| T-024 | Garantir suporte a múltiplos dedos e `pointercancel` no `VirtualJoystick.ts` e botões do `DungeonHud.ts` (tam. P) | M2 | AG02 (UI) | feita |
| T-025 | Ajustar balanceamento inicial do Boss (`infernal_warden`) e monstros em `src/data/monsters.json` após feedback de dificuldade no teste real (tam. P) | M2 | AG04 (Sistemas/Meta) | feita |
| T-026 | Gerador via código e PNGs do ícone oficial do app SUBMUNDO (`public/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png` 180x180) (tam. P) | M2 | AG08 (Arte) | feita |
| T-027 | Configurar PWA instalável (`public/manifest.webmanifest`, `public/sw.js` e cabeçalhos PWA em `netlify.toml`) (tam. P) | M2 | AG10 (Plataforma) | feita |
| T-028 | Adicionar meta tags iOS (`apple-mobile-web-app-capable`, `apple-touch-icon`, `viewport-fit=cover`) em `index.html` e registro do Service Worker em `src/main.ts` (tam. P) | M2 | AG07 (Arquiteto) | feita |
| T-029 | Contratos de tipos da progressão permanente em `src/core/index.ts` (`SaveProfile`, `AltarUpgradeDef`, `BlacksmithRecipe`, `HubSummary`, `RunTransitionPayload`) e persistência `LocalStorage` em `src/core/progression/StorageAdapter.ts` (tam. P) | M3 | AG07 (Arquiteto) | a fazer |
| T-030 | Glossário e diálogos do Refúgio no Submundo (Emissário Celestial, Ferreiro Espiritual, Altar de Almas, Portal da Fenda e Essência de General) em `docs/narrativa.md` e `src/data/dialogues.json` (tam. P) | M3 | AG06 (Narrativa) | a fazer |
| T-031 | Catálogo JSON de upgrades do Altar de Almas, custos do Ferreiro (`+1`, `+2`, `+3`) e forja com Essência de General em `src/data/progression.json` (tam. P) | M3 | AG04 (Sistemas/Meta) | a fazer |
| T-032 | Spritesheets Pixel Art do Refúgio no Submundo (`hub_tiles.png` e `hub_npcs.png`: Emissário, Ferreiro, Altar, Portal) em `public/assets/sprites/`, `manifest.json` e `docs/guia_visual.md` (tam. P) | M3 | AG08 (Arte) | a fazer |
| T-033 | Lógica pura de progressão permanente em `src/core/progression/ProfileManager.ts` (Almas, Essências, Baú/itens persistidos, Altar de Almas, Ferreiro e `buildHeroFromProfile`) + `tests/core/progression.test.ts` (tam. M) | M3 | AG04 (Sistemas/Meta) | a fazer |
| T-034 | Modais responsivos e HUD do Refúgio (`AltarModal.ts`, `BlacksmithModal.ts` e `HubHud.ts` para PC `800x600` e Mobile `360x640`) em `src/view/ui/` (tam. M) | M3 | AG02 (UI) | a fazer |
| T-035 | Cena interativa do Refúgio no Submundo (`src/view/scenes/HubScene.ts`) com Portal da Masmorra, Altar, Ferreiro, Baú persistente e movimentação híbrida (tam. M) | M3 | AG02 (UI) | a fazer |
| T-036 | Integração `HubScene ⇄ DungeonScene` (aplicar bônus do Altar e gear salvo na entrada, drop de Essência de General no Boss e gravação do retorno ao Hub) em `src/view/scenes/DungeonScene.ts` (tam. M) | M3 | AG01 (Gameplay) | a fazer |
| T-037 | Registrar `HubScene` em `src/main.ts` e `BootScene.ts` (pré-carregar `hub_tiles`/`hub_npcs`, iniciar no Refúgio) e subir versão para `0.3.0` (tam. P) | M3 | AG07 (Arquiteto) | a fazer |
| T-038 | Validação do M3 (suíte 3x, Playwright percorrendo Hub → Altar/Ferreiro → Masmorra → retorno ao Hub, capturas PC/Mobile, `docs/qa/qa-M3.md`) e tag `v0.3.0` (tam. M) | M3 | AG03 (QA) + AG00 (Líder) | a fazer |

