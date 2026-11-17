# BRF-022 — AG08 — T-016 Ícones de equipamentos/drops e VFX das 3 Forças

**Leia:** `docs/agentes/AG08_Arte.md`, `docs/guia_visual.md`, `scripts/art/generateSprites.mjs`, `src/view/sprites/CombatVfx.ts`. **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono:** Autorização explícita da `T-016` (M2 `v0.2.0`).
**Contrato:**
- Novos spritesheets Pixel Art gerados por `scripts/art/generateSprites.mjs` em `public/assets/sprites/`:
  - `loot_icons.png` (`64x16` px, 4 frames `16x16`: `0 = icon_weapon`, `1 = icon_armor`, `2 = icon_amulet`, `3 = icon_ring`).
  - `loot_drops.png` (`64x16` px, 4 frames `16x16`: orbes/baús de drop por raridade `0 = common #e4e4e7`, `1 = magic #38bdf8`, `2 = rare #facc15`, `3 = legendary #f97316`).
  - Atualizar `public/assets/sprites/manifest.json` preservando os 6 sprites do M1 e incluindo `loot_icons` e `loot_drops`.
- Novos métodos em `CombatVfxManager` (`src/view/sprites/CombatVfx.ts`), preservando todos os métodos do M1:
  - `showEmberExplosion(x: number, y: number, radius: number): void` (explosão ígnea `#f97316`/`#ef4444`)
  - `showLightningChain(points: Array<{ x: number; y: number }>): void` (raios angulares em cadeia `#facc15`/`#e0fbfc`)
  - `showBleedEffect(x: number, y: number): void` (gotículas carmesim `#ef4444`)
  - `showLootDropBeam(x: number, y: number, rarity: 'common' | 'magic' | 'rare' | 'legendary'): void` (feixe vertical brilhante na cor da raridade)
  - `showItemPickupBanner(x: number, y: number, label: string, colorHex: string): void` (texto flutuante ao coletar item)
**Fazer:**
1. Atualizar `scripts/art/generateSprites.mjs`, rodar `node scripts/art/generateSprites.mjs` e documentar os novos sheets em `docs/guia_visual.md`.
2. Atualizar `src/view/sprites/CombatVfx.ts` com os 5 novos VFX.
**Permitido:** `scripts/art/generateSprites.mjs`, `public/assets/sprites/`, `src/view/sprites/CombatVfx.ts`, `docs/guia_visual.md`.
**Proibido:** `public/icons/`, `src/core/`, `src/view/scenes/`, `src/view/ui/`, `tests/` e comandos git.
**Pronto quando:** `loot_icons.png` e `loot_drops.png` válidos, `manifest.json` atualizado e `npm run typecheck` verde.
**Entrega:** até 6 linhas: arquivos atualizados, sprites gerados, métodos VFX adicionados e resultado de `typecheck`.
