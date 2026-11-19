# BRF-078 — AG01 (Gameplay) — T-069b Registro das Animações dos 5 Monstros em `CombatVfx.ts`

**Leia:** [docs/agentes/AG01_Gameplay.md](../agentes/AG01_Gameplay.md), [src/view/sprites/CombatVfx.ts](../../src/view/sprites/CombatVfx.ts). **Regra:** respostas curtas; **PROIBIDO** editar `BootScene.ts`, `DungeonScene.ts` (isso será na T-070), `src/core/`, `tests/` ou executar `git`.

**Contrato (com AG08 na T-069a):**
Cada um dos 5 novos monstros (`slime`, `cave_bat`, `wolf`, `skeleton`, `skeleton_archer`) terá um spritesheet `1600×80` (20 frames `80×80`) com o mesmo layout de frames:
- `*_idle`: `frames: [0, 1, 2, 3]`, `frameRate: 6` (ou `8` no `cave_bat`), `repeat: -1`
- `*_walk`: `frames: [4, 5, 6, 7, 8, 9]`, `frameRate: 10` (ou `12` no `cave_bat` e `wolf`), `repeat: -1`
- `*_attack`: `frames: [10, 11, 12, 13, 14, 15]`, `frameRate: 16`, `repeat: 0`
- `*_death`: `frames: [16, 17, 18, 19]`, `frameRate: 10`, `repeat: 0`

**Fazer (apenas em `src/view/sprites/CombatVfx.ts`):**
1. Adicionar em `ANIMATION_SPECS` as **20 animações** para `slime`, `cave_bat`, `wolf`, `skeleton` e `skeleton_archer` (`idle`, `walk`, `attack`, `death`).
   - Remover/substituir o antigo `bat_idle` (`frames: [0, 1]`) por `cave_bat_idle` (e manter `slime_idle` antigo para `abyssal_slime`, `sentinel_idle` para `bone_sentinel`, `warden_idle` para `infernal_warden`, para não quebrar legados).
2. Conferir que `registerGameAnimations(scene)` lida perfeitamente com 20 frames (`texture.frameTotal === 21 > 19 + 1`).
3. Exportar helper `export function resolveMonsterAnimKey(spriteKey: string, state: 'idle' | 'walk' | 'attack' | 'death'): string | null` que retorna `${spriteKey}_${state}` para os 5 novos monstros (`slime`, `cave_bat`, `wolf`, `skeleton`, `skeleton_archer`) e fallback seguro (`slime_idle`, `sentinel_idle`, `warden_idle`) para os legados.

**Permitido:** `src/view/sprites/CombatVfx.ts`.
**Proibido:** qualquer outro arquivo e comandos `git`.

**Pronto quando:** `CombatVfx.ts` registra as 20 animações e exporta `resolveMonsterAnimKey` sem erros de tipo (`strict: true`).

**Entrega:** até 6 linhas: (1) alterações em `CombatVfx.ts`, (2) revisão estática (`strict: true`).
