# BRF-123 — AG03 (QA): Relatório Final de Validação do Marco M7 (`docs/qa/qa-M7.md`) (`T-081`)

## Contexto
Todas as entregas do **Marco M7 (`v0.7.0`: UI 2D Dark Fantasy, 6 Slots, Gerador de UI/Cards e Modo Paisagem Exclusivo `960×540`)** foram concluídas e integradas. Precisamos gerar o relatório oficial de QA em `docs/qa/qa-M7.md` seguindo o padrão de `docs/qa/qa-M6.md`.

## Arquivos sob sua posse
- `docs/qa/qa-M7.md` (criar novo)

## Tarefas Obrigatórias
1. Executar todas as verificações possíveis no ambiente local (Python):
   - Integridade de `public/assets/sprites/ui_icons.png` (`1152×64`, 18 frames), `public/assets/sprites/portraits.png` (`1024×128`, 8 frames), `public/assets/sprites/manifest.json` e `public/manifest.webmanifest` (`"orientation": "landscape"`).
   - Integridade de `src/data/items.json` (24 itens, 4 por slot nos 6 slots) e `src/data/affixes.json` (cobertura de todos os 6 slots).
   - Ausência total de `monospace` e `mobile_portrait` em `src/view/ui/`, `src/view/scenes/` e `src/core/index.ts`.
   - Zero imports de `phaser` em `src/core/`.
   - Presença de `src/view/ui/DarkFantasyUiBuilder.ts`, `scripts/art/uiCardGenerator.py`, `assets/mockups/preview_m7_ui_generator_cards.png` e `tests/e2e/m7-ui-landscape.spec.ts`.
   - Consistência de versão `0.7.0` em `package.json`, `src/version.ts` e `tests/core/architecture.test.ts`.
2. Registrar em `docs/qa/qa-M7.md`:
   - Resumo executivo e veredito (`PASSA` ou `PASSA COM RESSALVA` registrando que Vitest/Playwright/Vite build rodam no CI do GitHub Actions pela ausência de Node no Windows local).
   - Matriz de verificações executadas.
   - Roteiro claro e objetivo de teste manual para o dono validar no navegador (PC `960×540` e Mobile Paisagem 2 mãos em `https://dev--submundo-game.netlify.app`).

## Restrições
- Reportar apenas — não corrigir arquivos de `src/`.
- **PROIBIDO** executar comandos `git`.
