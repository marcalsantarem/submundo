# BRF-058 — AG03 (QA): Validação Final do M5 (`v0.5.0`) (T-067)

## Objetivo
Executar a validação completa do marco **M5 (Personagem)** para a versão `0.5.0`: suíte completa 3×, novo teste E2E Playwright validando os spritesheets `48×48` e animações do Herói no Prólogo (`hero_living`) e no Ato 1 (`hero_wraith`), capturas PC (`800×600`) e Mobile (`360×640`), e relatório `docs/qa/qa-M5.md`.

## Arquivos sob sua posse
- `tests/e2e/m5-hero.spec.ts` (novo)
- `docs/qa/qa-M5.md` (novo)
- Capturas temporárias em `docs/qa/screenshots-m5/` ou no diretório de artefatos conforme necessidade (não commitar binários desnecessários se já forem pro artefato, ou salvar em `docs/qa/screenshots-m5/` se leve; preferir `docs/qa/qa-M5.md` limpo)

## Requisitos Técnicos
1. **Teste E2E `tests/e2e/m5-hero.spec.ts`:**
   - Validar boot `v0.5.0` sem erros de console/pageerror/404.
   - Validar que `BootScene` carregou as texturas `hero_living` (`768×48`, 16 frames `48×48`) e `hero_wraith` (`768×48`, 16 frames `48×48`) e que as 10 animações (`hero_living_idle/walk/attack/dash/hit` e `hero_wraith_idle/walk/attack/dash/hit`) estão registradas no `scene.anims`.
   - Validar **Prólogo (Vila Natal e Gruta da Cachoeira)**: `heroSprite.texture.key === 'hero_living'`, `flipX` responde ao movimento esquerda/direita, animação muda para `hero_living_walk` ao mover e `hero_living_attack` / `hero_living_dash` funcionam na masmorra.
   - Validar **Ato 1 (Refúgio no Submundo e Masmorra)**: via `localStorage` com `campaign.phase = 'act1'`, confirmar `heroSprite.texture.key === 'hero_wraith'`, animação `hero_wraith_idle`/`walk`/`attack`.
   - Salvar 4 capturas visuais para inspeção do dono (em `/tmp/qa-m5/` ou `docs/qa/m5-*.png` — se salvar em `/tmp/qa-m5/` o AG00 copia para os artefatos sem poluir o repo!):
     - `m5_pc_prologue_village.png` (800×600, herói vivo na Vila Natal)
     - `m5_pc_prologue_dungeon.png` (800×600, herói vivo em combate na Gruta)
     - `m5_pc_act1_refuge.png` (800×600, herói espectro no Refúgio)
     - `m5_mobile_act1_dungeon.png` (360×640, herói espectro em combate mobile)
2. **Suíte Completa 3× (`npm run typecheck && npm run build && npm test`):**
   - Rodar `npm test` 3 vezes consecutivas após criar `m5-hero.spec.ts` e confirmar zero flakiness e 0 erros.
3. **Relatório `docs/qa/qa-M5.md`:**
   - Seguir o padrão de `docs/qa/qa-M4.md`: resumo executivo, veredito (`PASSA` / `PASSA COM RESSALVAS` / `FALHA`), resultados das 3 execuções, cobertura E2E do M5, tamanho do `dist/`, e roteiro rápido de teste manual para o dono.

## Restrições
- **Reportar, não corrigir** código de jogo (`src/`).
- **Lembrete do shim Playwright:** `npm run build` antes de `npm test`; não usar `page.reload()` (usar `page.goto('/')`).
- Não executar `git`.
