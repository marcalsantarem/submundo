# Backlog de Tasks — SUBMUNDO

| ID | Descrição curta | Marco | Agente(s) | Estado |
| :--- | :--- | :--- | :--- | :--- |
| T-001 | Setup TS + Vite + Phaser 3 + Vitest, câmera adaptativa (`800x600` PC / `9:16` Mobile), `BootScene` e contratos `src/core/index.ts` (tam. M) | M1 | AG07 (Arquiteto) | feita |
| T-002 | Configuração de deploy no Netlify (`netlify.toml`) e workflow de CI no GitHub Actions (`.github/workflows/ci.yml`) (tam. P) | M1 | AG10 (Plataforma) | feita |
| T-003 | Glossário oficial e lore base (`docs/narrativa.md`) com nomes canônicos do Espectro, 3 monstros e 2 skills do M1 (tam. P) | M1 | AG06 (Narrativa) | feita |
| T-004 | Dados iniciais de balanceamento em `src/data/monsters.json` (Slime, Esqueleto, Boss) e `src/data/skills.json` (Dash, 2 Skills, Poção) (tam. P) | M1 | AG04 (Sistemas/Meta) | feita |
| T-005 | Guia visual (`docs/guia_visual.md`) e gerador via código de spritesheets/tilesets Pixel Art (`.png` em `assets/`) para herói, monstros e masmorra (tam. M) | M1 | AG08 (Arte) | feita |
| T-006 | Lógica pura de entidades, atributos, ataque básico automático, Dash, 2 Skills, Poção e IA dos 3 monstros em `src/core/entities/` e `src/core/combat/` (tam. M) | M1 | AG01 (Gameplay) | em andamento |
| T-007 | Gerador de incursão de 4 salas + 1 Boss, progressão de ondas e estado da run (vitória/morte) em `src/core/dungeon/` (tam. M) | M1 | AG01 (Gameplay) | em andamento |
| T-008 | HUD responsivo (`800x600` PC / `9:16` Mobile), joystick virtual flutuante de 1 polegar, botões de Dash/Skills/Poção e input `WASD`/Setas em `src/view/ui/` (tam. M) | M1 | AG02 (UI) | a fazer |
| T-009 | `DungeonScene` integrando `src/core/`, renderização das 4 salas + Boss, animações de sprites e VFX de combate em `src/view/scenes/DungeonScene.ts` e `src/view/sprites/` (tam. M) | M1 | AG01 (Gameplay) + AG08 (Arte) | a fazer |
| T-010 | Validação do M1 (suíte 3x, Playwright no navegador real, capturas PC `800x600` e Mobile `9:16`, `docs/qa/qa-M1.md`) e tag `v0.1.0` (tam. M) | M1 | AG03 (QA) + AG00 (Líder) | a fazer |
