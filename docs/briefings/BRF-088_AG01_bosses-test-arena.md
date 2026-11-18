# BRF-088 — AG01 (Gameplay) — T-099b Bosses Animados na `CombatVfx.ts` e `testArena` (`DungeonScene.ts`)

**Leia:** [docs/agentes/AG01_Gameplay.md](../agentes/AG01_Gameplay.md), [src/view/sprites/CombatVfx.ts](../../src/view/sprites/CombatVfx.ts), [src/view/scenes/DungeonScene.ts](../../src/view/scenes/DungeonScene.ts). **Regra:** respostas curtas; **PROIBIDO** editar `BootScene.ts`, `src/core/`, `tests/` ou executar `git`.

**Contrato (com AG08/T-097 e AG07/T-099a):**
- `wolf_alpha`: spritesheet `1600×80` (20 frames `80×80`: `0..3 idle`, `4..9 walk`, `10..15 attack`, `16..19 death`).
- `karnak`: spritesheet `1920×96` (20 frames `96×96`: `0..3 idle`, `4..9 walk`, `10..15 attack`, `16..19 death`).

**Fazer:**
1. **`src/view/sprites/CombatVfx.ts`:**
   - Adicionar `...createMonsterAnimSpecs('wolf_alpha', 6, 12)` e `...createMonsterAnimSpecs('karnak', 6, 9)` em `ANIMATION_SPECS`.
   - Incluir `'wolf_alpha'` e `'karnak'` em `ANIMATED_MONSTER_KEYS`.
2. **`src/view/scenes/DungeonScene.ts`:**
   - Incluir `'wolf_alpha'` e `'karnak'` no conjunto de monstros animados (`ANIMATED_80X80_MONSTERS` -> pode manter ou renomear localmente para `ANIMATED_SPRITESHEET_MONSTERS`) com escala `0.88` (assim `wolf_alpha` `80×80` e `karnak` `96×96` mantêm a proporção exata em relação ao Herói `80×80` na escala `0.88`!) e `offsetY` da barra de HP = `46` para `karnak` / `40` para `wolf_alpha`.
   - Adicionar fallbacks para `'wolf_alpha'` (`80×80`) e `'karnak'` (`96×96`) em `ensureCampaignFallbackTextures()`.
   - Atualizar `TEST_ARENA_SPAWNS` para incluir **`wolf_alpha`** e **`karnak`** junto aos monstros ativos (`slime`, `cave_bat`, `wolf`, `skeleton` — e manter `skeleton_archer` ou todos os 7 bem espaçados ao redor do centro para o dono ver todos os novos sprites e animações na sala preta!).

**Permitido:** `src/view/sprites/CombatVfx.ts`, `src/view/scenes/DungeonScene.ts`.
**Proibido:** `BootScene.ts`, `src/core/`, `tests/`, e qualquer comando `git`.

**Entrega:** até 8 linhas: alterações em `CombatVfx.ts` e `DungeonScene.ts`, mais revisão estática (`strict: true`).
