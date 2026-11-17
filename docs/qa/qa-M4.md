# Relatório de Validação QA — Marco 4 (`v0.4.0`): Prólogo (Vila Natal), Campanha, Retratos 2D, 36 Afixos & SFX Web Audio

- **Data:** 2026-11-17
- **Responsável:** AG03 (QA)
- **Briefing:** `BRF-052_AG03_validacao-m4.md` (T-050)
- **Veredito:** **PASSA** — *0 bloqueantes, 0 graves, 0 menores* (reteste pós-`T-053`; 1ª rodada teve 1 bloqueante corrigido na `T-053`).

---

## 1. Estabilidade da Suíte Automatizada (3x `npm test`)

`npm run typecheck` passou com `0` erros e `npm run build` concluiu em `65 ms`. A suíte completa (Vitest `core` + E2E Playwright em Chromium headless contra `dist/`) foi executada **3 vezes seguidas** com resultado idêntico:

| Execução | Arquivos de Teste | Total de Testes (`core` + E2E) | Status | Duração |
| :--- | :--- | :--- | :--- | :--- |
| **1ª Execução** | 11 passed, 1 failed | 53 passed, 1 failed (49 `core` + 4/5 E2E) | ❌ Falhou (Bloqueante #1) | `21588 ms` (`core`: `164 ms`, M1: `3526 ms`, M2: `5357 ms`, M3: `6125 ms`, M4: `6416 ms`) |
| **2ª Execução** | 11 passed, 1 failed | 53 passed, 1 failed (49 `core` + 4/5 E2E) | ❌ Falhou (Bloqueante #1) | `22014 ms` (`core`: `185 ms`, M1: `3804 ms`, M2: `5295 ms`, M3: `6226 ms`, M4: `6497 ms`) |
| **3ª Execução** | 11 passed, 1 failed | 53 passed, 1 failed (49 `core` + 4/5 E2E) | ❌ Falhou (Bloqueante #1) | `21788 ms` (`core`: `173 ms`, M1: `3561 ms`, M2: `5514 ms`, M3: `6042 ms`, M4: `6491 ms`) |

### Cobertura dos Arquivos de Teste
- `tests/core/` (8 arquivos, **49 testes** — 100% verdes nas 3 execuções): `architecture.test.ts` (7), `campaign.test.ts` (6), `combat.test.ts` (7), `dungeon.test.ts` (4), `loot.test.ts` (8), `m1-integration.test.ts` (3), `progression.test.ts` (7), `synergies.test.ts` (7).
- `tests/e2e/m1-dungeon.spec.ts` (1 teste): ✅ verde nas 3 execuções.
- `tests/e2e/m2-loot.spec.ts` (1 teste): ✅ verde nas 3 execuções.
- `tests/e2e/m3-hub.spec.ts` (1 teste): ✅ verde nas 3 execuções.
- `tests/e2e/m4-campaign.spec.ts` (2 testes):
  - Teste 1 (Prólogo boot limpo, `DialogueBox` com retrato 2D `weapon_master`, `SoundManager` mute/persistência, 36 afixos, ressalvas `T-051` no `BlacksmithModal`, capturas PC `800x600` e Mobile `360x640`): ✅ **verde nas 3 execuções**.
  - Teste 2 (Progressão da Campanha `prologue_grotto` → `prologue_mine` → `prologue_seal` → Queda da Vila → `act1_submundo` + retrato `emissary`): ❌ **falha determinística nas 3 execuções**, comprovando o **Bloqueante #1**.

---

## 2. Regressão M1/M2/M3 (Incluindo `T-051` e `T-052`) & Cobertura M4

- **Regressão M1/M2/M3:** `m1-dungeon.spec.ts`, `m2-loot.spec.ts` e `m3-hub.spec.ts` passaram 100% verdes nas 3 execuções.
- **Verificação da Ressalva `T-051` (`BlacksmithModal.ts`):** Confirmada corrigida em `src/view/ui/BlacksmithModal.ts:814-820` (`wordWrapWidth(w - btnW - 30)`) e `src/view/ui/BlacksmithModal.ts:935-941` (checagem `!item.name.includes(\`(+${level})\`)`). Validada no navegador real (`800x600`): `costText` não encosta no botão `Forjar` e `row.nameText` não duplica `(+1) +1`.
- **Verificação da Ressalva `T-052` (`village_tiles.png`):** Confirmada corrigida via inspeção visual em `docs/qa/screenshots/m4-pc-800x600.png` e `docs/qa/screenshots/m4-mobile-360x640.png` — o chão de grama da Vila Natal agora apresenta textura orgânica contínua sem listras verticais marrons.
- **Prólogo & Retratos 2D (`DialogueBox`):** Boot limpo inicia em `HubScene` (`SUBMUNDO v0.4.0`, `Vila Natal — Campo de Treino`, `phase === 'prologue'`, `prologue_grotto`), carrega `portraits`, `village_tiles` e `village_npcs` e abre automaticamente o `DialogueBox` exibindo o retrato 2D do `MESTRE DE ARMAS` (`weapon_master`, frame `2`), avançando e fechando por teclado sem erros.
- **36 Afixos & Web Audio SFX (`SoundManager`):** Confirmados **36 afixos** em `src/data/affixes.json`. Botão `Som` no `HubHud` alterna `SoundManager` e persiste `submundo_muted_v1` (`'true'`/`'false'`) em `localStorage` sem exceções em ambiente headless.
- **Progressão da Campanha (Prólogo → Queda da Vila → Ato 1):** `prologue_grotto` (3 salas) conclui com `status === 'victory'`, mas ao retornar ao `HubScene` o progresso da campanha é zerado pelo **Bloqueante #1**, impedindo o desbloqueio persistente de `prologue_mine`, `prologue_seal` e a transição para o Ato 1.

---

## 3. Build de Release (`npm run build`), Tamanho em `dist/` e Capturas

Comando executado: `tsc --noEmit && vite build` (`65 ms`, zero erros). Total em `dist/`: **`2.2M`** (`2.149.781 B` em 22 arquivos).

| Arquivo em `dist/` | Tamanho | Observação |
| :--- | :--- | :--- |
| `dist/assets/app.js` | `1.51 MB` (`1.585.477 B`) | Bundle JS (`Phaser 3.80` + `core` + `view` + Campanha + `SoundManager`) |
| `dist/icons/icon-512.png` | `371.05 kB` (`379.951 B`) | Ícone PWA 512x512 |
| `dist/icons/icon-192.png` | `63.07 kB` (`64.581 B`) | Ícone PWA 192x192 |
| `dist/icons/apple-touch-icon.png` | `56.11 kB` (`57.460 B`) | Ícone iOS Home Screen |
| `dist/assets/sprites/portraits.png` | `41.29 kB` (`42.282 B`) | Atlas de 8 retratos 2D estilizados |
| `dist/assets/sprites/manifest.json` | `3.84 kB` (`3.933 B`) | Manifesto de sprites (inclui `portraits`, `village_tiles`, `village_npcs`) |
| `dist/sw.js` + `dist/index.html` + `dist/manifest.webmanifest` | `4.61 kB` (`4.610 B`) | Entrada PWA e Service Worker |
| `dist/assets/sprites/*.png` (13 spritesheets) | `7.92 kB` (`8.107 B` total) | Inclui `village_npcs.png` (`644 B`) e `village_tiles.png` (`490 B`) |

- **Console / Page Errors:** `0` erros no Teste 1 (`m4-campaign.spec.ts`).
- **Capturas geradas e inspecionadas:**
  - PC Desktop Paisagem (`800x600`): `docs/qa/screenshots/m4-pc-800x600.png` — Vila Natal Viva com `DialogueBox` aberto e retrato 2D do Mestre de Armas.
  - Mobile Retrato (`360x640`): `docs/qa/screenshots/m4-mobile-360x640.png` — Vila Natal Mobile 9:16 com joystick virtual, 4 estações, seletor de fase e botão `Som`.

---

## 4. Classificação de Achados

### Bloqueantes (1)
1. **`loadOrCreateProfile()` descarta o objeto `campaign` ao carregar o perfil salvo (`localStorage`), apagando todo o progresso da Campanha**
   - **Local:** `src/core/progression/ProfileManager.ts:161-193` (chamado em `src/view/scenes/HubScene.ts:221`).
   - **Descrição:** Ao vencer uma masmorra em `DungeonScene.ts:985-1004`, `applyStageOutcomeToCampaign()` e `persistProfile()` gravam corretamente `profile.campaign` (`completedStages`, `currentStageId`, `phase`, `villageFallTriggered`, `seenDialogues`) no `localStorage`. Porém, ao retornar para `HubScene` (`HubScene.ts:221`) ou recarregar a página, `loadOrCreateProfile()` (`ProfileManager.ts:161-193`) reconstrói o objeto `SaveProfile` copiando `version`, `souls`, `generalEssences`, `altarLevels`, `equipped`, `stash`, `maxStashSize`, `itemUpgradeLevels` e `stats`, **omitindo `campaign`**. Em seguida, `ensureCampaignProgress(this.profile)` (`HubScene.ts:222`) vê `profile.campaign === undefined` e reinicia a campanha para o estado padrão (`prologue`, `prologue_grotto`, `completedStages: []`, `villageFallTriggered: false`).
   - **Passo a passo:**
     1. Iniciar o jogo no Prólogo (`prologue_grotto`), vencer a Gruta da Cachoeira (3/3 salas) e clicar para retornar à Vila Natal.
     2. Observar que `prologue_mine` (*A Mina Abandonada*) não aparece desbloqueada e `profile.campaign.completedStages` continua vazio (`[]`), como provado em `tests/e2e/m4-campaign.spec.ts:214`.
   - **Recomendação:** Incluir `...(loaded.campaign ? { campaign: loaded.campaign } : {})` (ou normalizar via `ensureCampaignProgress`) no retorno de `loadOrCreateProfile()` em `src/core/progression/ProfileManager.ts:161-193` e adicionar teste unitário em `tests/core/progression.test.ts` garantindo que `loadOrCreateProfile()` preserva `campaign` após `persistProfile()`.

### Graves (0)
- Nenhum.

### Menores (0)
- Nenhum.

---

## 5. O que Não Pôde Ser Verificado Automaticamente & Roteiro para o Dono

### O que requer validação humana no aparelho real
- Qualidade subjetiva e volume dos 17 SFX procedurais (Web Audio API) em alto-falantes de PC e celular após interação real.
- Fluidez da transição narrativa completa (*Gruta da Cachoeira* → *Mina Abandonada* → *O Selo Antigo* → Queda da Vila / Pacto Celestial → *Refúgio do Submundo*) após correção do Bloqueante #1.

### Roteiro Curto de Teste para o Dono (após correção e reteste do Bloqueante #1)
1. **Prólogo na Vila Natal (PC `800x600` e Celular `9:16`):**
   - Abra o jogo e confirme o diálogo automático do **Mestre de Armas** com retrato 2D e o gramado verde contínuo da Vila Natal.
   - Teste o botão **`Som`** no topo direito (mudo/ativo) e entre na **Gruta da Cachoeira** (3 salas).
2. **Desbloqueio e Transição para o Ato 1:**
   - Vença a Gruta da Cachoeira e confirme o desbloqueio da **Mina Abandonada**; avance até vencer **O Selo Antigo** (4 salas, boss Arauto do Abismo).
   - Ao retornar, confirme o diálogo do **Pacto Celestial** com retrato do **Emissário Celestial** e a mudança do cenário para o **Refúgio no Submundo (Ato 1)**.

---

## Reteste (Após T-053)

- **Data:** 2026-11-17
- **Correção verificada:** `T-053` em `src/core/progression/ProfileManager.ts` (`loadOrCreateProfile()` preserva e normaliza `campaign`).
- **Typecheck & Build:** `npm run typecheck` (`0` erros) e `npm run build` (`65 ms`, `dist/index.html` `1.07 kB`, `dist/assets/app.js` `1549.56 kB`, total `dist/` = **`2.2M`**).
- **Estabilidade 3x (`npm test`):** **12/12 arquivos, 55/55 testes verdes nas 3 execuções** (`50` `core` + `5` E2E, incluindo `tests/e2e/m4-campaign.spec.ts` **2/2**):
  - **1ª Execução:** `12 passed (12)`, `55 passed (55)` em `21723 ms` (`m4-campaign.spec.ts`: `6393 ms`) — ✅
  - **2ª Execução:** `12 passed (12)`, `55 passed (55)` em `21322 ms` (`m4-campaign.spec.ts`: `6638 ms`) — ✅
  - **3ª Execução:** `12 passed (12)`, `55 passed (55)` em `23101 ms` (`m4-campaign.spec.ts`: `7086 ms`) — ✅
- **Veredito Final:** **PASSA** — `0` bloqueantes, `0` graves, `0` menores.
