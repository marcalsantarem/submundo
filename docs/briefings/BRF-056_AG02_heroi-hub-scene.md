# BRF-056 — AG02 (UI): Integração do Herói 48×48 na HubScene (T-065)

## Objetivo
Integrar os novos spritesheets `hero_living` (Prólogo — Vila Natal) e `hero_wraith` (Ato 1 — Refúgio no Submundo) na `HubScene.ts` com animações `idle`/`walk` e `flipX` direcional.

## Arquivos sob sua posse
- `src/view/scenes/HubScene.ts`

## Requisitos Técnicos
1. **Seleção de Sprite por Fase da Campanha:**
   - Em `create()`, usar `const heroKey = campaign.phase === 'prologue' ? 'hero_living' : 'hero_wraith';` (armazenar em `private heroSpriteKey: 'hero_living' | 'hero_wraith'`).
   - Criar `this.heroSprite` usando `this.heroSpriteKey`, frame `0`, `.setScale(1.1)` e `.setDepth(20)`.
   - Tocar `${this.heroSpriteKey}_idle` se a animação existir.
2. **Fallback em `ensureTextures()`:**
   - Garantir que `hero_living` e `hero_wraith` tenham fallback `48×48` gerado em `ensureTextures()` caso não tenham sido pré-carregados.
3. **Animação de Movimento e `flipX`:**
   - No `update()`, ao mover o herói:
     - Se `Math.abs(dx) > 0.5`, atualizar `this.heroSprite.setFlipX(dx < 0)`.
     - Se estiver em movimento (`Math.hypot(dx, dy) > 0.5`) e existir `${this.heroSpriteKey}_walk`, chamar `this.heroSprite.play(\`${this.heroSpriteKey}_walk\`, true)`.
     - Caso contrário, se existir `${this.heroSpriteKey}_idle`, chamar `this.heroSprite.play(\`${this.heroSpriteKey}_idle\`, true)`.
   - Garantir que `heroAura` no Prólogo (`campaign.phase === 'prologue'`) seja bem sutil/dourada ou discreta, e no Ato 1 seja ciano espectral.

## Restrições
- Não tocar em `src/core/`, `BootScene.ts`, `DungeonScene.ts`, `CombatVfx.ts` ou `git`.
- Nota: as animações `hero_living_idle`, `hero_living_walk`, `hero_wraith_idle` e `hero_wraith_walk` serão registradas por `registerGameAnimations(this)` em `CombatVfx.ts` (T-064 em paralelo). Verifique que `HubScene.ts` já chama `registerGameAnimations(this)` ou que usa `this.anims.exists(...)` com segurança.
- Validar com `npm run typecheck` antes de responder.
