# BRF-055 — AG01 (Gameplay): Animações do Herói 48×48 e Integração na DungeonScene (T-064)

## Objetivo
Registrar todas as animações 48×48 de `hero_living` e `hero_wraith` em `CombatVfx.ts` e integrá-las na `DungeonScene.ts` (troca automática Prólogo vs. Ato 1, `walk`/`idle`/`attack`/`dash`/`hit`, `flipX` direcional e arco de corte rúnico).

## Arquivos sob sua posse
- `src/view/sprites/CombatVfx.ts`
- `src/view/scenes/DungeonScene.ts`

## Requisitos Técnicos
1. **Contrato dos Spritesheets (`768×48`, 16 frames `48×48`):**
   - `hero_living` e `hero_wraith`:
     - `idle`: frames `[0, 1, 2, 3]`, `frameRate: 6`, `repeat: -1`
     - `walk`: frames `[4, 5, 6, 7]`, `frameRate: 10`, `repeat: -1`
     - `attack`: frames `[8, 9, 10, 11]`, `frameRate: 14`, `repeat: 0`
     - `dash`: frames `[12, 13]`, `frameRate: 12`, `repeat: 0`
     - `hit`: frames `[14, 15]`, `frameRate: 12`, `repeat: 0`
   - Registrar em `ANIMATION_SPECS` de `CombatVfx.ts` as chaves `hero_living_idle`, `hero_living_walk`, `hero_living_attack`, `hero_living_dash`, `hero_living_hit`, `hero_wraith_idle`, `hero_wraith_walk`, `hero_wraith_attack`, `hero_wraith_dash`, `hero_wraith_hit`.
   - Manter as specs antigas `wraith_*` apenas como fallback caso `wraith_warrior` exista, sem quebrar compatibilidade.
2. **Arco de Corte (`CombatVfx.showSlashEffect`):**
   - Aprimorar o arco de corte rúnico com traço duplo + partículas sutis de faísca. Aceitar parâmetro opcional `isWraith?: boolean` (default `true`): `hero_living` usa aço/ouro (`0xe2e8f0` / `0xfacc15`), `hero_wraith` usa ciano rúnico (`0x38bdf8` / `0xe0f2fe`).
3. **Integração em `DungeonScene.ts`:**
   - Definir `const heroKey = this.activeStage.phase === 'prologue' ? 'hero_living' : 'hero_wraith';` (armazenar em campo `private heroSpriteKey: 'hero_living' | 'hero_wraith'`).
   - Criar/atualizar `this.heroSprite` com `heroKey`, frame `0`, `.setScale(1.1)` e `.setDepth(20)`.
   - Controlar estado de animação não-interruptível (`attack`, `dash`, `hit`): enquanto uma animação de ação (`repeat: 0`) estiver tocando, não sobrescrever com `walk`/`idle`; ao completar (`ANIMATION_COMPLETE`), retornar para `walk` ou `idle` conforme velocidade atual.
   - No `update()`, quando o herói estiver se movendo e sem animação de ação em curso, tocar `${this.heroSpriteKey}_walk`; quando parado, `${this.heroSpriteKey}_idle`.
   - Aplicar `this.heroSprite.setFlipX(...)` de acordo com a direção horizontal do movimento e também virar na direção do alvo ao disparar `hero_basic_attack`.
   - No evento `hero_damaged`, tocar `${this.heroSpriteKey}_hit` (se existir) além do flash de dano.
   - Passar `this.heroSpriteKey === 'hero_wraith'` para `this.vfx.showSlashEffect(...)`.

## Restrições
- Não tocar em `src/core/`, `BootScene.ts`, `HubScene.ts`, `package.json` ou `git`.
- Validar com `npm run typecheck` e `npx vitest run tests/core/` antes de responder.
