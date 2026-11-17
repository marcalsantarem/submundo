# BRF-009 — AG08 — T-009 Animações de sprites e VFX de combate no Phaser 3

**Leia:** `docs/agentes/AG08_Arte.md`, `docs/guia_visual.md`. **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono:** Decisão #5 (M1 `v0.1.0`).
**Contrato:**
- `src/view/sprites/CombatVfx.ts`:
  - `registerGameAnimations(scene: Phaser.Scene): void`: registra (se ainda não existirem) as animações para `wraith_warrior` (`wraith_idle`, `wraith_attack`, `wraith_dash`), `abyssal_slime` (`slime_idle`), `bone_sentinel` (`sentinel_idle`), `infernal_warden` (`warden_idle`).
  - `CombatVfxManager`:
    - `constructor(scene: Phaser.Scene)`
    - `showDamageNumber(x: number, y: number, amount: number, isCrit?: boolean, isHeroDamage?: boolean): void`
    - `showHealEffect(x: number, y: number, amount: number): void`
    - `showSlashEffect(fromX: number, fromY: number, toX: number, toY: number): void`
    - `showSkillAreaEffect(x: number, y: number, radius: number, force: 'inferno' | 'submundo' | 'empireo' | 'none'): void`
    - `showDashTrail(x: number, y: number): void`
    - `showSoulCollectEffect(fromX: number, fromY: number, souls: number): void`
**Fazer:**
1. Implementar `src/view/sprites/CombatVfx.ts` usando gráficos/tweens/textos do Phaser 3 dentro da paleta Dark Fantasy (`#38bdf8` espiritual, `#ef4444` carmesim, `#f97316` fogo infernal, `#facc15` crítico).
**Permitido:** `src/view/sprites/CombatVfx.ts`.
**Proibido:** `src/core/`, `src/view/scenes/`, `src/view/ui/` e comandos git (`commit`, `push`, `branch`, `checkout`, `reset`, `stash`).
**Pronto quando:** `npm run typecheck` passar sem erros em `src/view/sprites/CombatVfx.ts`.
**Entrega:** até 5 linhas: arquivo criado, efeitos implementados, validação `typecheck` e o que não foi testado.
