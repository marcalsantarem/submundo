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
| T-011 | Ressalva do QA do M1 no HUD: ocultar rótulo do botão de skill durante o cooldown em `src/view/ui/DungeonHud.ts` (tam. P) | M2 | AG02 (UI) | a fazer |
| T-012 | Ressalva do QA do M1 na cena: adicionar `return;` após `advanceRoomNow()` em `forceClearRoom` em `src/view/scenes/DungeonScene.ts` (tam. P) | M2 | AG01 (Gameplay) | a fazer |
| T-013 | Contratos de tipos em `src/core/index.ts` para Equipamentos (`EquipSlot`, `Rarity`, `AffixDef`, `ItemDef`, `ItemInstance`, `StatusEffectType`, `LegendaryPowerId`) (tam. P) | M2 | AG07 (Arquiteto) | a fazer |
| T-014 | Glossário e textos canônicos de itens base, afixos, poderes lendários e das 3 Forças (`Inferno`, `Submundo`, `Empíreo`) em `docs/narrativa.md` e `src/data/dialogues.json` (tam. P) | M2 | AG06 (Narrativa) | a fazer |
| T-015 | Catálogo JSON de equipamentos base (4 slots: Arma, Armadura, Amuleto, Anel) e afixos/poderes lendários em `src/data/items.json` e `src/data/affixes.json` (tam. P) | M2 | AG04 (Sistemas/Meta) | a fazer |
| T-016 | Ícones Pixel Art/2D para os 4 slots de equipamento e drops por raridade em `public/assets/sprites/` + VFX das 3 Forças em `src/view/sprites/CombatVfx.ts` (tam. M) | M2 | AG08 (Arte) | a fazer |
| T-017 | Gerador determinístico de loot (4 raridades), inventário da run, cálculo de bônus equipados e perda de loot da run na morte em `src/core/loot/` (tam. M) | M2 | AG04 (Sistemas/Meta) | a fazer |
| T-018 | Sinergias das 3 Forças no combate (`Brasa` 5 cargas, `Sangramento & Roubo de Vida`, `Julgamento & Raio` em críticos) e poderes lendários em `src/core/combat/` (tam. M) | M2 | AG01 (Gameplay) | a fazer |
| T-019 | Painel responsivo de Inventário e Equipamentos (4 slots, cores de raridade, comparação de atributos e equipar com 1 toque) em `src/view/ui/` (tam. M) | M2 | AG02 (UI) | a fazer |
| T-020 | Drops físicos na `DungeonScene.ts`, coleta de itens, aplicação de equipamentos/sinergias em tempo real e resumo de espólios extraídos/perdidos (tam. M) | M2 | AG01 (Gameplay) | a fazer |
| T-021 | Subir versão do projeto para `0.2.0` em `package.json`, `src/version.ts` e `tests/core/architecture.test.ts` (tam. P) | M2 | AG07 (Arquiteto) | a fazer |
| T-022 | Validação do M2 (suíte 3x, Playwright, capturas PC `800x600` e Mobile `9:16`, `docs/qa/qa-M2.md`) e tag `v0.2.0` (tam. M) | M2 | AG03 (QA) + AG00 (Líder) | a fazer |
