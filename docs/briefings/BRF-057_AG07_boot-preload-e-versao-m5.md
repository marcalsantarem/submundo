# BRF-057 — AG07 (Arquiteto): Preload dos Sprites 48×48 do Herói e Versão 0.5.0 (T-066)

## Objetivo
Pré-carregar `hero_living.png` e `hero_wraith.png` (`48×48`) na `BootScene.ts` e atualizar a versão do projeto para `0.5.0`.

## Arquivos sob sua posse
- `src/view/scenes/BootScene.ts`
- `package.json`
- `src/version.ts`
- `index.html` (se contiver versão)
- `tests/core/architecture.test.ts`
- `tests/e2e/m2-loot.spec.ts`
- `tests/e2e/m3-hub.spec.ts`
- `tests/e2e/m4-campaign.spec.ts`

## Requisitos Técnicos
1. **`BootScene.ts`:**
   - Adicionar ao array `SPRITESHEET_SPECS`:
     - `{ key: 'hero_living', file: 'assets/sprites/hero_living.png', frameWidth: 48, frameHeight: 48, fallbackColor: 0xe2e8f0 }`
     - `{ key: 'hero_wraith', file: 'assets/sprites/hero_wraith.png', frameWidth: 48, frameHeight: 48, fallbackColor: 0x38bdf8 }`
   - Manter `wraith_warrior` por compatibilidade até remoção definitiva futura, se necessário.
2. **Versão `0.5.0`:**
   - Atualizar `package.json` (`"version": "0.5.0"`), `src/version.ts` (`export const GAME_VERSION = '0.5.0';`), e `index.html` (`<title>SUBMUNDO v0.5.0</title>`, se presente).
   - Atualizar os asserts de versão `0.4.0` → `0.5.0` em `tests/core/architecture.test.ts`, `tests/e2e/m2-loot.spec.ts`, `tests/e2e/m3-hub.spec.ts` e `tests/e2e/m4-campaign.spec.ts`.

## Restrições
- Não tocar em `src/core/` (exceto via testes se aplicável), `DungeonScene.ts`, `HubScene.ts`, `CombatVfx.ts` ou `git`.
- Validar com `npm run typecheck` e `npx vitest run tests/core/` antes de responder.
