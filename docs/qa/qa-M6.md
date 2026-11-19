# Relatório de Validação QA — Marco 6 (`v0.6.0`): Monstros & Bosses 20f na `testArena`

- **Data:** 2026-11-19
- **Responsável:** AG03 (QA)
- **Briefing:** `BRF-098_AG03_qa-m6.md` (T-071b)
- **Veredito:** **PASSA COM RESSALVAS** — *0 bloqueantes, 0 graves, 0 menores* (ressalva exclusiva de ambiente: `node`, `npm` e `npx` ausentes no `PATH` deste Windows; auditoria binária/estática 100% verde via Python 3.14, ficando pendente confirmação de `typecheck`, `vitest run`, `build` e Playwright no CI / ambiente com Node + Chromium).

---

## 1. Auditoria Binária e Estática Local (Python 3.14)

### 1.1. Spritesheets PNG (`public/assets/sprites/`) e `manifest.json`

Todos os 8 spritesheets foram validados quanto à assinatura PNG (`89 50 4E 47 0D 0A 1A 0A`), chunk `IHDR` (`13` bytes), dimensões exatas e correspondência com `public/assets/sprites/manifest.json` (exatamente 20 frames canônicos: `idle0..3`, `walk0..5`, `attack0..5`, `death0..3`):

| Spritesheet | Dimensões (`IHDR`) | Frame | Frames no `manifest.json` | Tamanho em Disco | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `slime.png` | `1600×80` px | `80×80` | `20` canônicos | `2.709` bytes | ✅ Válido |
| `cave_bat.png` | `1600×80` px | `80×80` | `20` canônicos | `5.327` bytes | ✅ Válido |
| `wolf.png` | `1600×80` px | `80×80` | `20` canônicos | `10.524` bytes | ✅ Válido |
| `skeleton.png` | `1600×80` px | `80×80` | `20` canônicos | `10.161` bytes | ✅ Válido |
| `skeleton_archer.png` | `1600×80` px | `80×80` | `20` canônicos | `9.803` bytes | ✅ Válido |
| `wolf_alpha.png` | `1600×80` px | `80×80` | `20` canônicos | `13.153` bytes | ✅ Válido |
| `skeleton_chief.png` | `1600×80` px | `80×80` | `20` canônicos | `12.948` bytes | ✅ Válido |
| `karnak.png` | `1920×96` px | `96×96` | `20` canônicos | `34.467` bytes | ✅ Válido |

### 1.2. Contratos de Código & Catálogo (`src/`)

- **`src/view/sprites/CombatVfx.ts` (`15–133`, `237–246`):** `createMonsterAnimSpecs` e `ANIMATED_MONSTER_KEYS` cobrem todos os 8 monstros/bosses (`slime`, `cave_bat`, `wolf`, `skeleton`, `skeleton_archer`, `skeleton_chief`, `wolf_alpha`, `karnak`).
- **`src/view/scenes/BootScene.ts` (`56–60`, `126–180`, `223–225`):** `SPRITESHEET_SPECS` pré-carrega os 8 spritesheets (`80×80` para os 7 primeiros e `96×96` para `karnak`) e inicia `DungeonScene` com `{ testArena: true }`.
- **`src/view/scenes/DungeonScene.ts` (`100–112`, `726–729`, `1150–1199`):** `TEST_ARENA_WAVE_1` (5 monstros comuns), `TEST_ARENA_WAVE_2` (`wolf_alpha`, `karnak`, `skeleton_chief`), fundo `#000000` e escala `1.06` para `karnak`.
- **`src/data/monsters.json` (`1–170`):** 12 registros válidos (4 legados: `abyssal_slime`, `bone_sentinel`, `infernal_warden`, `abyss_herald`; 5 comuns M6: `slime`, `cave_bat`, `wolf`, `skeleton`, `skeleton_archer`; 3 bosses M6: `wolf_alpha`, `karnak`, `skeleton_chief`).
- **`src/version.ts` (`1`):** `GAME_VERSION = '0.6.0'`.

---

## 2. Cobertura de Testes Automatizados Criada

- **`tests/core/m6-monsters-assets.test.ts` (NOVO — Node puro, zero `phaser`, 5 testes):**
  1. Assinatura PNG + `IHDR` dos 8 spritesheets M6 (`1600×80` e `1920×96`).
  2. Validação de `manifest.json` (8 entradas, dimensões e 20 frames canônicos).
  3. Cobertura de `createMonsterAnimSpecs` e `ANIMATED_MONSTER_KEYS` em `CombatVfx.ts`.
  4. Pré-carregamento em `SPRITESHEET_SPECS` de `BootScene.ts` (`80×80` e `96×96`).
  5. Validação estrutural dos 12 registros em `src/data/monsters.json`.
- **`tests/e2e/m6-monsters.spec.ts` (NOVO — Playwright E2E, 1 teste):**
  - Boot na `testArena` (`SUBMUNDO v0.6.0`, `isTestArena === true`, `testArenaWave === 1`, fundo `#000000`, `hero_living`, zero `consoleErrors`/`pageErrors`/`404`).
  - Inspeção das 8 texturas (`frameTotal === 21`, `80×80` / `96×96`) e 32 animações (`idle` 4f, `walk` 6f, `attack` 6f, `death` 4f).
  - Validação da Onda 1 (5 monstros vivos), eliminação da Onda 1 e transição para Onda 2 (`wolf_alpha`, `karnak` em escala `1.06`, `skeleton_chief`), gerando capturas em `/tmp/qa-m6/` (`m6_pc_wave1.png`, `m6_pc_wave2.png` em `800×600` e `m6_mobile_wave2.png` em `360×640`).
- **Revisão Estática (`strict: true`):** ambos os arquivos verificados quanto a `zero any`, ausência de `phaser` no teste de `core` e execução de todas as regexes de contrato contra os arquivos reais em `src/`.

---

## 3. Classificação de Achados

- **Bloqueantes:** 0
- **Graves:** 0
- **Menores:** 0

---

## 4. O que Não Pôde Ser Executado Localmente (Pendência de CI)

- **Restrição do ambiente local Windows:** `node`, `npm` e `npx` não estão disponíveis no `PATH` (somente `Python 3.14` encontrado).
- **Itens pendentes de execução no CI / ambiente com Node.js + Chromium:**
  - `npm run typecheck` (`tsc --noEmit` sobre `src/` e `tests/`);
  - `npm test` (3× execuções de `vitest run`, incluindo `tests/core/m6-monsters-assets.test.ts`);
  - `npm run build` (`vite build` e medição do tamanho total de `dist/`);
  - Execução Playwright em Chromium headless (`tests/e2e/m6-monsters.spec.ts` e geração das capturas `/tmp/qa-m6/`).

---

## 5. Roteiro Curto de Teste Manual para o Dono

1. **Onda 1 na `testArena` (PC `800×600`):** Abra o preview `dev`, confirme o título `SUBMUNDO v0.6.0`, fundo `#000000`, `hero_living` e os 5 monstros comuns (`slime`, `cave_bat`, `wolf`, `skeleton`, `skeleton_archer`) com animações de 20 frames.
2. **Onda 2 & Bosses (PC e Mobile `360×640`):** Derrote os 5 monstros da Onda 1 e confirme o spawn de `wolf_alpha`, `karnak` (escala `1.06`, orientado para a direita) e `skeleton_chief`, verificando fluidez das animações e legibilidade no viewport retrato.
