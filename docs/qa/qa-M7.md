# Relatório de Validação QA — Marco 7 (`v0.7.0`): UI 2D Dark Fantasy, 6 Slots, Gerador de UI/Cards e Modo Paisagem Exclusivo (`960×540`)

- **Data:** 2026-11-19
- **Responsável:** AG03 (QA)
- **Briefing:** `BRF-123_AG03_qa-m7.md` (`T-081`)
- **Veredito:** **PASSA COM RESSALVAS** — *0 bloqueantes, 0 graves, 3 achados menores* (3 referências cosméticas residuais a `monospace` em `src/view/scenes/BootScene.ts:219,227` e `src/view/scenes/DungeonScene.ts:1456`, além da ressalva de ambiente local: `node`, `npm` e `npx` ausentes no `PATH` deste Windows; todas as auditorias binárias/estáticas foram executadas via Python 3.14, ficando `typecheck`, `vitest run` (3×), `vite build` e Playwright pendentes de confirmação no CI do GitHub Actions).

---

## 1. Matriz de Verificações Executadas Localmente (Python 3.14)

### 1.1. Assets 2D de UI, Mockup e Manifestos PWA

| Artefato | Verificação Executada | Resultado Medido | Status |
| :--- | :--- | :--- | :--- |
| `public/assets/sprites/ui_icons.png` | Assinatura PNG + `IHDR` (`13` bytes) + tamanho | `1152×64` px, `112.266` bytes | ✅ Válido |
| `public/assets/sprites/portraits.png` | Assinatura PNG + `IHDR` (`13` bytes) + tamanho | `1024×128` px, `218.995` bytes | ✅ Válido |
| `assets/mockups/preview_m7_ui_generator_cards.png` | Presença + Assinatura PNG + `IHDR` | `1768×624` px, `423.168` bytes | ✅ Válido |
| `public/assets/sprites/manifest.json` (`ui_icons`) | Dimensões, frame `64×64`, 18 frames (`slot_helm`, `slot_boots`) | `1152×64`, `64×64`, `18` frames completos | ✅ Válido |
| `public/assets/sprites/manifest.json` (`portraits`) | Dimensões, frame `128×128`, 8 frames | `1024×128`, `128×128`, `8` frames completos | ✅ Válido |
| `public/manifest.webmanifest` | JSON válido + `"orientation": "landscape"` + PWA fields | `orientation="landscape"`, `display="standalone"`, `short_name="SUBMUNDO"` | ✅ Válido |
| `index.html` | Presença de `#rotate-overlay`, `id="rotate-overlay"` e fonte `Cinzel` | Ambos presentes (`fonts.googleapis.com` + `@media (orientation: portrait)`) | ✅ Válido |

### 1.2. Catálogo de Dados (6 Slots)

| Arquivo | Verificação Executada | Resultado Medido | Status |
| :--- | :--- | :--- | :--- |
| `src/data/items.json` | Total de itens e distribuição nos 6 slots | `24` itens (`weapon: 4`, `armor: 4`, `helm: 4`, `boots: 4`, `amulet: 4`, `ring: 4`) | ✅ Válido |
| `src/data/affixes.json` | Total de afixos e cobertura dos 6 slots (`allowedSlots`) | `36` afixos cobrindo todos os 6 slots (`weapon: 16`, `armor: 15`, `helm: 15`, `boots: 17`, `amulet: 20`, `ring: 23`) | ✅ Válido |

### 1.3. Auditoria de Arquitetura, Tipografia, Artefatos M7 e Versão `0.7.0`

| Critério | Escopo Verificado | Resultado | Status |
| :--- | :--- | :--- | :--- |
| Zero `phaser` em `src/core/` | Todos os `.ts` em `src/core/` | `0` ocorrências | ✅ Válido |
| Zero `mobile_portrait` | `src/view/ui/`, `src/view/scenes/`, `src/core/index.ts` | `0` ocorrências | ✅ Válido |
| Zero `monospace` em `src/view/ui/` e `src/core/index.ts` | Todos os módulos de UI (`DarkFantasyUiBuilder.ts`, `ItemTooltipCard.ts`, `InventoryModal.ts`, `DungeonHud.ts`, `HubHud.ts`, `BlacksmithModal.ts`, `AltarModal.ts`, `DialogueBox.ts`, etc.) | `0` ocorrências | ✅ Válido |
| Zero `monospace` em `src/view/scenes/` | `BootScene.ts`, `DungeonScene.ts`, `HubScene.ts` | `3` ocorrências residuais (ver Seção 3 — Menores) | ⚠️ Menor |
| Artefatos obrigatórios do M7 | `DarkFantasyUiBuilder.ts`, `uiCardGenerator.py` (`py_compile`), `preview_m7_ui_generator_cards.png`, `m7-ui-landscape.spec.ts` | Todos presentes (`32.816` B, `74.149` B com sintaxe Python OK, `423.168` B, `13.991` B) | ✅ Válido |
| Consistência de versão `0.7.0` | `package.json`, `src/version.ts:1`, `tests/core/architecture.test.ts:20-21` | Todos alinhados em `0.7.0` | ✅ Válido |

---

## 2. Cobertura de Testes Automatizados (Inventário Atual)

- **Unitários / Core (`tests/core/`):** **11 arquivos, 68 testes** (`architecture.test.ts`: 8, `campaign.test.ts`: 6, `combat.test.ts`: 7, `dungeon.test.ts`: 4, `hero-animations.test.ts`: 4, `loot.test.ts`: 9, `m1-integration.test.ts`: 3, `m6-monsters-assets.test.ts`: 5, `monsters-m6.test.ts`: 7, `progression.test.ts`: 8, `synergies.test.ts`: 7).
- **E2E Playwright (`tests/e2e/`):** **7 specs, 10 testes** + `playwright.config.ts` (`viewport: { width: 960, height: 540 }`) e `tests/e2e/helpers/landscape.ts`:
  - `m1-dungeon.spec.ts` (1), `m2-loot.spec.ts` (1), `m3-hub.spec.ts` (1), `m4-campaign.spec.ts` (2), `m5-hero.spec.ts` (1), `m6-monsters.spec.ts` (1): todos migrados para **PC Paisagem (`960×540`)** e **Mobile Paisagem (`844×390`, `hasTouch: true`)** com asserção de proporção `16:9` (`Phaser.Scale.FIT`).
  - `m7-ui-landscape.spec.ts` (3 testes): auditoria de assets 2D/manifests/UI sem `monospace`/`mobile_portrait`, fluxo PC `960×540` com abertura do inventário (`KeyI`) e captura `docs/qa/screenshots/m7-desktop-landscape.png`, e fluxo Mobile Paisagem `844×390` (`hasTouch: true`) abrindo inventário pelo botão Mochila e salvando `docs/qa/screenshots/m7-mobile-landscape.png`.

---

## 3. Classificação de Achados

- **Bloqueantes:** 0
- **Graves:** 0
- **Menores:** 3 ocorrências cosméticas de `fontFamily: 'monospace'` em `src/view/scenes/` (nenhuma em `src/view/ui/`):
  1. `src/view/scenes/BootScene.ts:219` — texto temporário `'SUBMUNDO'` na tela de boot usa `fontFamily: 'monospace'`.
  2. `src/view/scenes/BootScene.ts:227` — texto temporário `` `v${GAME_VERSION}` `` na tela de boot usa `fontFamily: 'monospace'`.
  3. `src/view/scenes/DungeonScene.ts:1456` — rótulo flutuante `'Portal Espectral'` ao limpar sala usa `fontFamily: 'monospace'` em vez de `DF_FONTS.TITLE` / `DF_FONTS.BODY`.
  - *Impacto:* Apenas estético (não afeta gameplay, layout paisagem nem os modais/HUDs 2D em `src/view/ui/`). Sugestão: registrar no backlog para alinhar com `DF_FONTS` na próxima rodada.

---

## 4. O que Não Pôde Ser Executado Localmente (Pendência de CI)

- **Restrição do ambiente local Windows:** `node`, `npm`, `npx`, `node_modules/`, `dist/` e WSL não estão instalados neste host (somente `Python 3.14.7` disponível).
- **Validações delegadas ao CI do GitHub Actions (antes do PR `dev` → `main`):**
  - `npm run typecheck` (`tsc --noEmit` em `src/` e `tests/`);
  - `npm test` (3× execuções consecutivas de `vitest run` confirmando 68/68 testes estáveis);
  - `npm run build` (`vite build` e medição do tamanho final do bundle `dist/`);
  - `npx playwright test` em Chromium headless (10 testes em `m1`..`m7` e geração das capturas `docs/qa/screenshots/m7-desktop-landscape.png` e `m7-mobile-landscape.png`).

---

## 5. Roteiro de Teste Manual para o Dono (`https://dev--submundo-game.netlify.app`)

### 5.1. Validação no PC Desktop (Paisagem `960×540`)
1. **Abertura e Moldura `16:9`:** Acesse `https://dev--submundo-game.netlify.app`, confirme título `SUBMUNDO v0.7.0`, canvas centralizado em proporção `16:9` com moldura sombria, tipografia `Cinzel` / sans-serif limpa (sem cara pixelada/monospace na HUD) e zero erros no Console (`F12`).
2. **HUD de Combate 2D:** Verifique no topo esquerdo o retrato circular do herói + barra de HP/XP e objetivo; no topo direito os contadores de Almas/Essências, minimapa circular e botões utilitários (`AUTO`, Mochila, Áudio); na base direita o arco de ataque + skills + poção com ícones 2D nítidos (`ui_icons.png`).
3. **Inventário 6 Slots & Tooltip Comparativo:** Pressione `I` (ou clique no botão **Mochila**). Confirme o modal Dark Fantasy com **6 slots de equipamento** (`Elmo`, `Arma`, `Armadura`, `Amuleto`, `Bota`, `Anel`), grade `4×4` da mochila, resumo de atributos e clique em um item para abrir o card comparativo (`ItemTooltipCard`) com botão **EQUIPAR** / **FECHAR**. Pressione `Esc` para fechar.
4. **Hub, Altar, Ferreiro e Diálogos (se navegar ao Hub):** Confirme `HubHud`, `AltarModal`, `BlacksmithModal` e `DialogueBox` com retratos 2D nítidos (`128×128`), sem sobreposição de textos.

### 5.2. Validação no Celular (Mobile Paisagem — 2 Mãos)
1. **Aviso de Rotação em Retrato (`#rotate-overlay`):** Abra `https://dev--submundo-game.netlify.app` com o celular em pé (retrato) e confirme que surge o aviso **"GIRE O DISPOSITIVO"** com ícone animado e botão *"Continuar mesmo assim"*.
2. **Modo Paisagem 2 Mãos:** Gire o celular para a horizontal (paisagem). Confirme que o aviso desaparece automaticamente e o jogo preenche a tela em proporção `16:9` sem cortes laterais ou barras sobrepostas.
3. **Controles Touch (2 Mãos):** Com o polegar esquerdo, arraste o joystick virtual para movimentar o herói; com o polegar direito, acione o botão de ataque, Esquiva (Dash), habilidades ativas e Poção simultaneamente (multitoque).
4. **Mochila e Toque em Itens:** Toque no botão **Mochila** no canto superior direito, confira a legibilidade dos 6 slots e da grade `4×4`, toque em um item para abrir o tooltip com botões grandes de toque (**EQUIPAR** / **FECHAR**) e feche o modal sem travamentos.
