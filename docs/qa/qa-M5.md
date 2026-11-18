# Relatório de Validação QA — Marco 5 (`v0.5.0`): Personagem (Spritesheets 80×80 24f, Weapons & Animações Vivo/Espectro)

- **Data:** 2026-11-18
- **Responsável:** AG03 (QA)
- **Briefings:** `BRF-058_AG03_qa-m5.md` (T-067) + `BRF-066_AG03_qa-m5-80x80-weapons.md` (T-086) + `BRF-070_AG03_qa-m5-animacoes-24f.md` (T-090)
- **Veredito:**
  - **Rodada 16f (`T-067` / `T-086`):** **PASSA** — *0 bloqueantes, 0 graves, 0 menores*
  - **Reteste 24f (`T-087` a `T-090`, `BRF-070`):** **PASSA COM RESSALVAS** — *0 bloqueantes, 0 graves, 0 menores; auditoria binária/estática 100% verde via Python, pendente confirmação de `typecheck`, `vitest run`, `build` e Playwright no CI/ambiente com Node.js*

---

## 1. Estabilidade da Suíte Automatizada (3× `npm test`)

`npm run typecheck` passou com `0` erros e `npm run build` concluiu em `65 ms`. A suíte completa (Vitest `core` + E2E Playwright em Chromium headless contra `dist/`) foi executada **3 vezes consecutivas** com resultado idêntico (**0% flakiness, 0 erros**):

| Execução | Arquivos de Teste | Total de Testes (`core` + E2E) | Status | Duração |
| :--- | :--- | :--- | :--- | :--- |
| **1ª Execução** | `13 passed (13)` | `56 passed (56)` (50 `core` + 6 E2E) | ✅ Passou | `33023 ms` (`m5-hero.spec.ts`: `9141 ms`) |
| **2ª Execução** | `13 passed (13)` | `56 passed (56)` (50 `core` + 6 E2E) | ✅ Passou | `30847 ms` (`m5-hero.spec.ts`: `9438 ms`) |
| **3ª Execução** | `13 passed (13)` | `56 passed (56)` (50 `core` + 6 E2E) | ✅ Passou | `30395 ms` (`m5-hero.spec.ts`: `9185 ms`) |

### Cobertura dos Arquivos de Teste
- `tests/core/` (8 arquivos, **50 testes** — 100% verdes nas 3 execuções): `architecture.test.ts` (7), `campaign.test.ts` (6), `combat.test.ts` (7), `dungeon.test.ts` (4), `loot.test.ts` (8), `m1-integration.test.ts` (3), `progression.test.ts` (8), `synergies.test.ts` (7).
- `tests/e2e/m1-dungeon.spec.ts` (1 teste): ✅ verde nas 3 execuções.
- `tests/e2e/m2-loot.spec.ts` (1 teste): ✅ verde nas 3 execuções.
- `tests/e2e/m3-hub.spec.ts` (1 teste): ✅ verde nas 3 execuções.
- `tests/e2e/m4-campaign.spec.ts` (2 testes): ✅ verde nas 3 execuções.
- `tests/e2e/m5-hero.spec.ts` (1 teste): ✅ verde nas 3 execuções.

---

## 2. Cobertura E2E do M5 (`tests/e2e/m5-hero.spec.ts`)

- **Boot `v0.5.0`:** Título `SUBMUNDO v0.5.0`, `0` erros de console, `0` `pageerror` e `0` respostas HTTP `404`.
- **Spritesheets `80×80` e `weapons` em `BootScene`:**
  - `hero_living`: `1280×80` px, `frameTotal === 17` (`16` frames de `80×80` px + `__BASE`).
  - `hero_wraith`: `1280×80` px, `frameTotal === 17` (`16` frames de `80×80` px + `__BASE`).
  - `weapons`: `192×48` px, `frameTotal === 5` (`4` frames de `48×48` px + `__BASE`).
- **10 Animações Registradas (`scene.anims`):**
  - Prólogo (Herói Vivo): `hero_living_idle`, `hero_living_walk`, `hero_living_attack`, `hero_living_dash`, `hero_living_hit`.
  - Ato 1+ (Herói Espectro): `hero_wraith_idle`, `hero_wraith_walk`, `hero_wraith_attack`, `hero_wraith_dash`, `hero_wraith_hit`.
- **`HeroWeaponRig` e Prólogo (Vila Natal e Gruta da Cachoeira):**
  - `heroSprite.texture.key === 'hero_living'` e animação inicial `hero_living_idle`.
  - `weaponRig.weaponSprite` presente e visível no `HubScene` e `DungeonScene` com `texture.key === 'weapons'` e frame `0` (sem arma elemental no Prólogo).
  - Movimento esquerda (`KeyA`) aplica `flipX = true` e `hero_living_walk`; movimento direita (`KeyD`) aplica `flipX = false` e `hero_living_walk`.
  - Na Gruta da Cachoeira (`prologue_grotto`), ataque básico automático ativa `hero_living_attack` e `spectral_dash` ativa `hero_living_dash`.
- **`HeroWeaponRig` e Ato 1 (Refúgio no Submundo e Masmorra):**
  - Via `localStorage` (`submundo_save_v1`) com `campaign.phase = 'act1'`, `HubScene` carrega `heroSprite.texture.key === 'hero_wraith'` em `hero_wraith_idle`, alternando para `hero_wraith_walk` ao mover, e `weaponRig.weaponSprite` visível com `texture.key === 'weapons'` e frame `1`.
  - Em `act1_submundo` no viewport Mobile (`360×640`), confirma `hero_wraith`, `weaponRig.weaponSprite` visível no frame `1` e transição para `hero_wraith_attack` em combate.

---

## 3. Build de Release (`npm run build`), Tamanho em `dist/` e Capturas

Comando executado: `tsc --noEmit && vite build` (`65 ms`, zero erros). Tamanho total de `dist/`: **`2.3M`**.

| Arquivo em `dist/` | Tamanho | Observação |
| :--- | :--- | :--- |
| `dist/assets/app.js` | `1570.31 kB` (`1.6M`) | Bundle JS completo (`Phaser 3.80` + `core` + `view` + M5 `80×80` + `HeroWeaponRig`) |
| `dist/index.html` | `1.07 kB` | Entrada HTML (`SUBMUNDO v0.5.0`) |
| `dist/assets/sprites/hero_living.png` | `23K` | Spritesheet `1280×80` (16 frames `80×80`, Herói Vivo) |
| `dist/assets/sprites/hero_wraith.png` | `34K` | Spritesheet `1280×80` (16 frames `80×80`, Herói Espectro) |
| `dist/assets/sprites/weapons.png` | `6.1K` | Spritesheet `192×48` (4 frames `48×48`, Armas do `HeroWeaponRig`) |

### Capturas Visuais Geradas (`/tmp/qa-m5/`)
- `/tmp/qa-m5/m5_pc_prologue_village.png` (`70K`) — PC (`800×600`): Herói vivo (`hero_living`) com espada (`weapons` frame `0`) na Vila Natal.
- `/tmp/qa-m5/m5_pc_prologue_dungeon.png` (`80K`) — PC (`800×600`): Herói vivo em combate na Gruta da Cachoeira.
- `/tmp/qa-m5/m5_pc_act1_refuge.png` (`72K`) — PC (`800×600`): Herói espectro (`hero_wraith`) com lâmina espectral (`weapons` frame `1`) no Refúgio do Submundo.
- `/tmp/qa-m5/m5_mobile_act1_dungeon.png` (`51K`) — Mobile (`360×640`): Herói espectro em combate na masmorra do Ato 1.

---

## 4. Classificação de Achados

- **Bloqueantes:** 0
- **Graves:** 0
- **Menores:** 0

---

## 5. O que Não Pôde Ser Verificado Automaticamente & Roteiro para o Dono

### O que requer validação humana no aparelho real
- Fluidez subjetiva dos frames de caminhada, golpe e dash `80×80` e do balanço/swing do `HeroWeaponRig` em 60 FPS no navegador do PC e do celular, além da leitura visual da silhueta do Herói Vivo vs. Espectro em tela pequena.

### Roteiro Curto de Teste Manual para o Dono
1. **Prólogo — Herói Vivo + Arma (PC `800×600`):**
   - Inicie um jogo limpo na Vila Natal, feche o diálogo inicial e mova com `WASD`/Setas para esquerda e direita observando o `flipX`, a animação `80×80` de caminhada da armadura viva e a espada acoplada (`HeroWeaponRig`).
   - Entre na **Gruta da Cachoeira** e observe o ataque automático (com swing da arma) e a Esquiva Espectral (`Espaço`/`Shift`).
2. **Ato 1 — Herói Espectro + Arma (PC e Celular `9:16`):**
   - Avance até o Ato 1 (ou carregue perfil no Ato 1), confirme o sprite espectral (`hero_wraith`) e a lâmina espectral no **Refúgio no Submundo** e entre na masmorra para validar a silhueta e animação em combate mobile.

---

## 6. Reteste — Refação de Animações 24 Frames (`T-087` a `T-090`, `BRF-070`)

- **Data do Reteste:** 2026-11-18
- **Contexto (Decisão #8):** Refação dos spritesheets `hero_living.png` e `hero_wraith.png` para **24 frames (`1920×80`, `80×80`/frame)** com passos reais (`walk` 6f), `attack` 6f, `dash` 4f e `hit` 4f (`T-087`), integrados em `CombatVfx.ts`, `HeroWeaponRig.ts`, `DungeonScene.ts` e `HubScene.ts` (`T-088`/`T-089`), já validados visualmente pelo dono no preview `dev`.
- **Veredito do Reteste:** **PASSA COM RESSALVAS** — *0 bloqueantes, 0 graves, 0 menores* (ressalva exclusiva de ambiente: `node`/`npm` ausentes neste Windows, ficando pendente confirmação de execução no CI do GitHub Actions e Playwright em ambiente com Node + Chromium).

### 6.1. Novos Tamanhos e Cabeçalhos dos Spritesheets (`public/assets/sprites/`)

Verificados localmente via auditoria binária em Python (`PNG signature` + chunk `IHDR` + decodificação RGBA completa):

| Arquivo | Dimensões (`IHDR`) | Frames | Tamanho em Disco | Status |
| :--- | :--- | :--- | :--- | :--- |
| `public/assets/sprites/hero_living.png` | `1920×80` px | `24` (`80×80`) | `22.959 bytes` (`22.42 KiB`) | ✅ Válido |
| `public/assets/sprites/hero_wraith.png` | `1920×80` px | `24` (`80×80`) | `27.693 bytes` (`27.04 KiB`) | ✅ Válido |
| `public/assets/sprites/weapons.png` | `192×48` px | `4` (`48×48`) | `6.239 bytes` (`6.09 KiB`) | ✅ Válido |

### 6.2. Auditoria Anti-Deslizamento e Consistência Código × Manifesto (Python)

- **Anti-deslizamento na faixa inferior das pernas (`y = 50..78` inclusive, `80×29 = 2.320 px`, tolerância de canal `> 2`):**
  - `hero_living` — `walk0 (4)` vs `walk3 (7)`: **`24.01%`** (`557/2320` px da faixa; `90.13%` na união não-transparente) — **> 20% ✅**
  - `hero_living` — `idle0 (0)` vs `attack2 (12)`: **`30.13%`** (`699/2320` px da faixa; `90.43%` na união não-transparente) — **> 20% ✅**
  - `hero_wraith` — `walk0 (4)` vs `walk3 (7)`: **`28.88%`** (`29.31%` exato `680/2320`; `85.03%` na união não-transparente) — **> 20% ✅**
  - `hero_wraith` — `idle0 (0)` vs `attack2 (12)`: **`34.22%`** (`794/2320` px da faixa; `85.65%` na união não-transparente) — **> 20% ✅**
- **Contrato `manifest.json` × `HeroWeaponRig.ts`:**
  - `public/assets/sprites/manifest.json` contém exatamente os **24 nomes canônicos** (`idle0..3`, `walk0..5`, `attack0..5`, `dash0..3`, `hit0..3`) e **24 `handAnchors` finitos** para `hero_living` e `hero_wraith`.
  - `src/view/sprites/HeroWeaponRig.ts:16-46` (`HERO_HAND_ANCHORS`) possui **24/24 correspondência exata** com `manifest.json` (zero drift).
- **Contrato `CombatVfx.ts` (`ANIMATION_SPECS`):**
  - `src/view/sprites/CombatVfx.ts:15-87` registra todas as 10 animações com ranges exatos: `*_idle` `[0..3]` (4f), `*_walk` `[4..9]` (6f), `*_attack` `[10..15]` (6f), `*_dash` `[16..19]` (4f), `*_hit` `[20..23]` (4f), e `HERO_WALK_FOOTSTEP_FRAMES = [4, 7]` (`CombatVfx.ts:5`).

### 6.3. Nova Cobertura de Testes Automatizados

- **`tests/core/hero-animations.test.ts` (NOVO — Node puro, zero `phaser`, +4 testes → `tests/core/` passa para 9 arquivos / 54 testes):**
  1. Valida assinatura PNG + `IHDR` de `hero_living.png` (`1920×80`), `hero_wraith.png` (`1920×80`) e `weapons.png` (`192×48`).
  2. Valida os 24 nomes canônicos de `frames` e 24 `handAnchors` finitos no `manifest.json` para `hero_living` e `hero_wraith` (mais dimensões de `weapons`).
  3. Lê `src/view/sprites/HeroWeaponRig.ts` como texto e exige igualdade exata dos 24 `HERO_HAND_ANCHORS` com o `manifest.json`.
  4. Lê `src/view/sprites/CombatVfx.ts` como texto e valida os ranges exatos `0..23` das 10 animações e `HERO_WALK_FOOTSTEP_FRAMES = [4, 7]`.
- **`tests/e2e/m5-hero.spec.ts` (ATUALIZADO):**
  - Dimensões e frames de `hero_living` e `hero_wraith` atualizados para `{ width: 1920, height: 80, frameTotal: 25, frameCount: 24, frameWidth: 80, frameHeight: 80 }` (`weapons` mantido em `192×48`, `frameTotal: 5`, `frameCount: 4`).
  - Valida `scene.anims.get(key)?.frames.length` para todas as 10 animações (`4`, `6`, `6`, `4`, `4` em `hero_living_*` e `hero_wraith_*`).
  - Adiciona checagem anti-deslizamento em `<canvas>` 2D offscreen no navegador comparando `walk0 (4)` vs `walk3 (7)` e `idle0 (0)` vs `attack2 (12)` na faixa `y = 50..78` (`> 20%` em ambos spritesheets).
  - Amostra `heroSprite.frame.name` durante movimento (`KeyA`/`KeyD` na Vila Natal e `KeyD` no Refúgio) garantindo que todos os frames ficam em `4..9` e progridem (`>= 2` frames distintos, sem travamento).
  - Mantém compatibilidade com `T-088` (`hero_living_attack` e `hero_wraith_attack` parados perto do monstro + `crimson_cleave` + `spectral_dash`), as 4 capturas em `/tmp/qa-m5/` e zero `consoleErrors`/`pageErrors`/`404`.
- **Revisão Estática (`strict: true`):** ambos os arquivos foram auditados para conformidade com `tsconfig.json` (`strict: true`, `ES2022` + `DOM`, `@types/node` 22, zero `any`, balanço sintático e simulação das regex em Python — **0 defeitos**).

### 6.4. O que NÃO Pôde Ser Executado Localmente (Pendência de CI)

- **Restrição do ambiente local Windows:** `node`, `npm` e `npx` não estão disponíveis no `PATH` (somente `Python 3.14` encontrado).
- **Itens pendentes de confirmação em ambiente com Node.js / CI (`.github/workflows/ci.yml`):**
  - `npm run typecheck` (`tsc --noEmit` sobre `src/` e `tests/`);
  - `npm test` (`vitest run` — 3× execuções esperadas com **9 arquivos / 54 testes**, incluindo os 4 novos testes de `tests/core/hero-animations.test.ts`);
  - `npm run build` (`vite build` e nova medição do tamanho total de `dist/`);
  - Execução da suíte Playwright em Chromium headless (`tests/e2e/m5-hero.spec.ts` com checagem anti-deslizamento no navegador e regeneração das 4 capturas em `/tmp/qa-m5/`).
- **Achados do reteste:** **0 bloqueantes, 0 graves, 0 menores.**
- **Próximo passo:** AG00 realizar commit/push na `dev` e confirmar o workflow verde do GitHub Actions (`typecheck`, `vitest run`, `build`) + rodada Playwright em ambiente com Node/Chromium antes de fechar o PR da `v0.5.0`.
