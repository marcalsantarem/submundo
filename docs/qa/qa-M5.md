# Relatório de Validação QA — Marco 5 (`v0.5.0`): Personagem (Spritesheets 48×48 & Animações Vivo/Espectro)

- **Data:** 2026-11-17
- **Responsável:** AG03 (QA)
- **Briefing:** `BRF-058_AG03_qa-m5.md` (T-067)
- **Veredito:** **PASSA** — *0 bloqueantes, 0 graves, 0 menores*

---

## 1. Estabilidade da Suíte Automatizada (3× `npm test`)

`npm run typecheck` passou com `0` erros e `npm run build` concluiu em `65 ms`. A suíte completa (Vitest `core` + E2E Playwright em Chromium headless contra `dist/`) foi executada **3 vezes consecutivas** com resultado idêntico (**0% flakiness, 0 erros**):

| Execução | Arquivos de Teste | Total de Testes (`core` + E2E) | Status | Duração |
| :--- | :--- | :--- | :--- | :--- |
| **1ª Execução** | `13 passed (13)` | `56 passed (56)` (50 `core` + 6 E2E) | ✅ Passou | `32215 ms` (`m5-hero.spec.ts`: `9507 ms`) |
| **2ª Execução** | `13 passed (13)` | `56 passed (56)` (50 `core` + 6 E2E) | ✅ Passou | `32997 ms` (`m5-hero.spec.ts`: `9885 ms`) |
| **3ª Execução** | `13 passed (13)` | `56 passed (56)` (50 `core` + 6 E2E) | ✅ Passou | `33450 ms` (`m5-hero.spec.ts`: `9961 ms`) |

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
- **Spritesheets `48×48` em `BootScene`:**
  - `hero_living`: `768×48` px, `16` frames de `48×48` px.
  - `hero_wraith`: `768×48` px, `16` frames de `48×48` px.
- **10 Animações Registradas (`scene.anims`):**
  - Prólogo (Herói Vivo): `hero_living_idle`, `hero_living_walk`, `hero_living_attack`, `hero_living_dash`, `hero_living_hit`.
  - Ato 1+ (Herói Espectro): `hero_wraith_idle`, `hero_wraith_walk`, `hero_wraith_attack`, `hero_wraith_dash`, `hero_wraith_hit`.
- **Prólogo (Vila Natal e Gruta da Cachoeira):**
  - `heroSprite.texture.key === 'hero_living'` e animação inicial `hero_living_idle`.
  - Movimento esquerda (`KeyA`) aplica `flipX = true` e `hero_living_walk`; movimento direita (`KeyD`) aplica `flipX = false` e `hero_living_walk`.
  - Na Gruta da Cachoeira (`prologue_grotto`), ataque básico automático ativa `hero_living_attack` e `spectral_dash` ativa `hero_living_dash`.
- **Ato 1 (Refúgio no Submundo e Masmorra):**
  - Via `localStorage` (`submundo_save_v1`) com `campaign.phase = 'act1'`, `HubScene` carrega `heroSprite.texture.key === 'hero_wraith'` em `hero_wraith_idle`, alternando para `hero_wraith_walk` ao mover.
  - Em `act1_submundo` no viewport Mobile (`360×640`), confirma `hero_wraith` e transição para `hero_wraith_attack` em combate.

---

## 3. Build de Release (`npm run build`), Tamanho em `dist/` e Capturas

Comando executado: `tsc --noEmit && vite build` (`65 ms`, zero erros). Tamanho total de `dist/`: **`2.2M`**.

| Arquivo em `dist/` | Tamanho | Observação |
| :--- | :--- | :--- |
| `dist/assets/app.js` | `1557.03 kB` (`1.6M`) | Bundle JS completo (`Phaser 3.80` + `core` + `view` + M5) |
| `dist/index.html` | `1.07 kB` (`1.8K`) | Entrada HTML (`SUBMUNDO v0.5.0`) |
| `dist/assets/sprites/hero_living.png` | `3.4K` | Spritesheet `768×48` (16 frames `48×48`, Herói Vivo) |
| `dist/assets/sprites/hero_wraith.png` | `3.4K` | Spritesheet `768×48` (16 frames `48×48`, Herói Espectro) |

### Capturas Visuais Geradas (`/tmp/qa-m5/`)
- `/tmp/qa-m5/m5_pc_prologue_village.png` — PC (`800×600`): Herói vivo (`hero_living`) na Vila Natal.
- `/tmp/qa-m5/m5_pc_prologue_dungeon.png` — PC (`800×600`): Herói vivo em combate na Gruta da Cachoeira.
- `/tmp/qa-m5/m5_pc_act1_refuge.png` — PC (`800×600`): Herói espectro (`hero_wraith`) no Refúgio do Submundo.
- `/tmp/qa-m5/m5_mobile_act1_dungeon.png` — Mobile (`360×640`): Herói espectro em combate na masmorra do Ato 1.

---

## 4. Classificação de Achados

- **Bloqueantes:** 0
- **Graves:** 0
- **Menores:** 0

---

## 5. O que Não Pôde Ser Verificado Automaticamente & Roteiro para o Dono

### O que requer validação humana no aparelho real
- Fluidez subjetiva dos frames de caminhada, golpe e dash `48×48` em 60 FPS no navegador do PC e do celular, além da leitura visual da silhueta do Herói Vivo vs. Espectro em tela pequena.

### Roteiro Curto de Teste Manual para o Dono
1. **Prólogo — Herói Vivo (PC `800×600`):**
   - Inicie um jogo limpo na Vila Natal, feche o diálogo inicial e mova com `WASD`/Setas para esquerda e direita observando o `flipX` e a animação de caminhada da armadura viva.
   - Entre na **Gruta da Cachoeira** e observe o ataque automático e a Esquiva Espectral (`Espaço`/`Shift`).
2. **Ato 1 — Herói Espectro (PC e Celular `9:16`):**
   - Avance até o Ato 1 (ou carregue perfil no Ato 1), confirme o sprite espectral (`hero_wraith`) no **Refúgio no Submundo** e entre na masmorra para validar a silhueta e animação em combate mobile.
