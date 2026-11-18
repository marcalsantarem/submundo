# BRF-063 — AG07 (Arquiteto): Atualizar BootScene para 80×80 + weapons.png (T-085a)

## Objetivo
Atualizar `SPRITESHEET_SPECS` em `src/view/scenes/BootScene.ts` para as novas dimensões `80×80` de `hero_living` e `hero_wraith` e adicionar o preload de `weapons.png` (`48×48`).

## Arquivos sob sua posse
- `src/view/scenes/BootScene.ts`

## Requisitos Técnicos
1. Em `SPRITESHEET_SPECS`:
   - Atualizar `hero_living`: `frameWidth: 80, frameHeight: 80`.
   - Atualizar `hero_wraith`: `frameWidth: 80, frameHeight: 80`.
   - Adicionar:
     ```ts
     {
       key: 'weapons',
       file: 'assets/sprites/weapons.png',
       frameWidth: 48,
       frameHeight: 48,
       fallbackColor: 0x94a3b8,
     }
     ```
2. Validar com `npm run typecheck` e `npx vitest run tests/core/`.

## Restrições
- Não tocar em `DungeonScene.ts`, `HubScene.ts`, `src/core/` ou `git`.
