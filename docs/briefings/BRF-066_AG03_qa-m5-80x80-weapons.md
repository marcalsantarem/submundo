# BRF-066 — AG03 (QA): Atualizar E2E do M5 para 80×80 + Weapons e Validar Suíte 3× (T-086)

## Objetivo
Atualizar `tests/e2e/m5-hero.spec.ts` para validar os novos spritesheets `80×80` (`hero_living.png` e `hero_wraith.png`, `1280×80`, 16 frames), `weapons.png` (`192×48`, 4 frames) e o `HeroWeaponRig` acoplado, rodar `npm run build` + `npm test` 3× e atualizar `docs/qa/qa-M5.md` e as 4 capturas em `/tmp/qa-m5/`.

## Arquivos sob sua posse
- `tests/e2e/m5-hero.spec.ts`
- `docs/qa/qa-M5.md`

## Requisitos Técnicos
1. **Atualizar `tests/e2e/m5-hero.spec.ts`:**
   - Atualizar asserções de `hero_living` e `hero_wraith` para `width === 1280`, `height === 80`, `frameTotal === 17` (`16` frames + `__BASE`).
   - Validar textura `weapons`: `width === 192`, `height === 48`, `frameTotal === 5` (`4` frames + `__BASE`).
   - Validar que o `weaponRig` está presente e visível no `HubScene` e `DungeonScene` (verificando sprite filho/acoplado com `texture.key === 'weapons'` e frame `0` no Prólogo sem arma elemental, e frame `1` ou correspondente no Ato 1 / arma equipada).
   - Manter geração das 4 capturas em `/tmp/qa-m5/`:
     - `m5_pc_prologue_village.png`
     - `m5_pc_prologue_dungeon.png`
     - `m5_pc_act1_refuge.png`
     - `m5_mobile_act1_dungeon.png`
2. **Validar `npm run typecheck && npm run build` e rodar `npm test` 3× consecutivas.**
3. **Atualizar `docs/qa/qa-M5.md`** com os novos números da suíte 3× e tamanho do `dist/`.

## Restrições
- Não tocar em `src/` ou `git`.
