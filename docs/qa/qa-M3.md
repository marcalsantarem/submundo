# Relatório de Validação QA — Marco 3 (`v0.3.0`): Refúgio no Submundo, Altar, Ferreiro & Meta-Progressão

- **Data:** 2026-11-17
- **Responsável:** AG03 (QA)
- **Briefing:** `BRF-040_AG03_validacao-m3.md` (T-038)
- **Veredito:** **PASSA COM RESSALVAS (menores não-bloqueantes)** — *0 bloqueantes, 0 graves, 2 menores*.

---

## 1. Estabilidade da Suíte Automatizada (3x `npm test`)

`npm run typecheck` passou com `0` erros. A suíte completa (Vitest unitário/integração de `src/core/` + 3 suítes E2E em navegador Chromium real contra `dist/`) foi executada 3 vezes seguidas sem falhas ou flakiness:

| Execução | Arquivos de Teste | Total de Testes (`core` + E2E) | Status | Duração Total |
| :--- | :--- | :--- | :--- | :--- |
| **1ª Execução** | 10 passed (10) | 46 passed (43 `core` + 3 E2E) | ✅ Passou | `14352 ms` (`core`: `193 ms`, M1 E2E: `3654 ms`, M2 E2E: `5056 ms`, M3 E2E: `5443 ms`) |
| **2ª Execução** | 10 passed (10) | 46 passed (43 `core` + 3 E2E) | ✅ Passou | `15073 ms` (`core`: `181 ms`, M1 E2E: `3702 ms`, M2 E2E: `5533 ms`, M3 E2E: `5654 ms`) |
| **3ª Execução** | 10 passed (10) | 46 passed (43 `core` + 3 E2E) | ✅ Passou | `14593 ms` (`core`: `182 ms`, M1 E2E: `3377 ms`, M2 E2E: `5313 ms`, M3 E2E: `5718 ms`) |

### Cobertura dos Arquivos de Teste
- `tests/core/architecture.test.ts` (7 testes): versão `0.3.0`, `resolveViewportConfig` (`800x600` PC e `360x640` Mobile), zero Phaser em `src/core/index.ts`, contratos de loot/sinergias, multi-touch (`activePointers >= 4` + `touch-action: none`) e tags/registro PWA.
- `tests/core/combat.test.ts` (7 testes): movimentação, dano/crítico, ataque básico automático, skills e IA/morte.
- `tests/core/dungeon.test.ts` (4 testes): PRNG determinístico, 5 salas e transições `victory`/`defeat`.
- `tests/core/loot.test.ts` (8 testes): zero Phaser em `src/core/loot/*`, cores por raridade, chance de drop, afixos/poderes lendários, equipar/desequipar, recálculo de atributos e extração vs perda total ao morrer.
- `tests/core/m1-integration.test.ts` (3 testes): regressão integrada da incursão Salas 1→5, preservação de Almas e zero Phaser em todo `src/core/**/*.ts`.
- `tests/core/progression.test.ts` (7 testes): zero Phaser em `src/core/progression/*`, `StorageAdapter` (`submundo_save_v1`), compra de bênçãos no Altar de Almas, melhoria `+1`/`+2` e forja Rara/Lendária no Ferreiro, gestão do Baú (`stash`) e `applyRunOutcomeToProfile` (vitória vs derrota).
- `tests/core/synergies.test.ts` (7 testes): 3 Forças (🔥 Inferno, 🩸 Submundo, ⚡ Empíreo) e 6 poderes lendários.
- `tests/e2e/m1-dungeon.spec.ts` (1 suíte E2E): regressão completa do M1 em Chromium headless (`800x600` e `360x640`).
- `tests/e2e/m2-loot.spec.ts` (1 suíte E2E): regressão completa do M2 em Chromium headless (`800x600` e `360x640`).
- `tests/e2e/m3-hub.spec.ts` (1 suíte E2E): validação completa do M3 em Chromium headless (`800x600` e `360x640`).

---

## 2. Regressão M1/M2 (Incluindo Ressalvas `T-039` e `T-040`) e Cobertura do M3

- **Regressão M1 & M2:** `m1-dungeon.spec.ts` e `m2-loot.spec.ts` passam 100% verdes, iniciando pela `HubScene` e atravessando `enterDungeon()` sem regressões no combate, drops, sinergias ou PWA.
- **Verificação da Ressalva `T-039` (Sobreposição no `InventoryModal`):** Confirmada corrigida em `src/view/ui/InventoryModal.ts:857-874` e `950-960` (posicionamento dinâmico de `detailText.y` e `statsText.y` após `nameText.y + nameText.height` + truncamento seguro via `setTextClamped`). Validada tanto visualmente em `docs/qa/screenshots/m2-pc-800x600.png` quanto por asserção geométrica direta no navegador real em `tests/e2e/m3-hub.spec.ts:278-281` e `319-321`.
- **Verificação da Ressalva `T-040` (Remoção de `submundo_icon_master.png` de `dist/`):** Confirmada corrigida. `dist/assets/icons/` não existe mais no build de produção, reduzindo o pacote total de `dist/` de `3,19 MB` (M2) para **`2,02 MB`** (M3, mesmo com os novos sprites e código do Refúgio).
- **Boot no Refúgio & Persistência (`LocalStorage`):** `BootScene` inicia em `HubScene` com título `SUBMUNDO v0.3.0`, expõe `window.__SUBMUNDO_HUB_DEBUG__` e persiste automaticamente o `SaveProfile` em `localStorage` (`SAVE_STORAGE_KEY = 'submundo_save_v1'`).
- **Altar de Almas (`AltarModal`):** Concessão de recursos via `grantTestResources(500, 3)`, abertura via `openAltar()`, clique real nos botões `Aprimorar` de *Vitalidade Espectral* (`Nv. 0 → 1`, `-30 Almas`, `+20 HP Máx`) e *Fúria das Sombras* (`Nv. 0 → 1`, `-35 Almas`, `+3 ATQ`), com gravação imediata no `localStorage`.
- **Ferreiro Espiritual (`BlacksmithModal`) & Baú (`InventoryModal`):** Abertura via `openBlacksmith()`, forja de relíquia Lendária (`-1 Essência`, `-120 Almas`) e Rara (`-80 Almas`) enviadas ao Baú, e melhoria `+1` (`-40 Almas`) elevando `powerScore` e atributos base. Abertura do Baú via `openStash()` e equipamento do item `+1` com 1 clique.
- **Integração `HubScene ⇄ DungeonScene`:** Ao chamar `enterDungeon()`, `window.__SUBMUNDO_DEBUG__.getHero()` reflete exatamente os bônus acumulados do Altar (`baseStats.maxHp = 140`, `baseStats.attack = 21`) somados ao item `+1` equipado no Refúgio.
- **Extração na Vitória vs. Morte Punitiva:**
  - **Vitória (Sala 5 — `infernal_warden`):** Coleta de drop na masmorra, abate do Boss concedendo `+1 Essência de General` e retorno via `returnToHub()` preservando o equipamento do Hub, adicionando o drop extraído ao Baú e somando Almas + Essência ao perfil (`runsCompleted = 1`, `bossesDefeated = 1`).
  - **Morte Punitiva:** Em nova incursão, o herói limpa a Sala 1, coleta um drop mágico na Sala 2 e morre (`status = 'defeat'`). Ao retornar ao Hub via `returnToHub()`, o jogador **mantém 100% das Almas coletadas** e **preserva todo o equipamento/Baú do Hub**, perdendo exclusivamente o drop não extraído daquela incursão (`runsFailed = 1`).

---

## 3. Build de Release (`npm run build`), Tamanho em `dist/` e Capturas

Comando executado: `tsc --noEmit && vite build` (concluído em `65 ms`, zero erros). Total em `dist/`: **`2.0M`** (`2.023.060 B` em 18 arquivos).

| Arquivo em `dist/` | Tamanho | Observação |
| :--- | :--- | :--- |
| `dist/assets/app.js` | `1.47 MB` (`1.509.269 B`) | Bundle JS (Phaser 3.80 + `core` + `view` + Hub/Modais + JSONs) |
| `dist/icons/icon-512.png` | `379.95 kB` (`379.951 B`) | Ícone PWA 512x512 |
| `dist/icons/icon-192.png` | `64.58 kB` (`64.581 B`) | Ícone PWA 192x192 |
| `dist/icons/apple-touch-icon.png` | `57.46 kB` (`57.460 B`) | Ícone iOS Home Screen 180x180 |
| `dist/assets/sprites/manifest.json` | `2.70 kB` (`2.700 B`) | Manifesto de sprites (incluindo `hub_tiles` e `hub_npcs`) |
| `dist/sw.js` | `2.31 kB` (`2.314 B`) | Service Worker offline-first |
| `dist/index.html` | `1.79 kB` (`1.790 B`) | Entrada HTML + meta tags PWA/iOS |
| `dist/manifest.webmanifest` | `506 B` | Manifesto Web App |
| `dist/assets/sprites/*.png` (10 spritesheets) | `4.49 kB` (`4.489 B` total) | Inclui novos `hub_npcs.png` (`856 B`) e `hub_tiles.png` (`394 B`) |

- **Console / Page Errors:** `0` erros de console (`console.error`) e `0` exceções não tratadas (`pageerror`).
- **Capturas do M3 geradas e inspecionadas:**
  - PC Desktop Paisagem (`800x600`): `docs/qa/screenshots/m3-pc-800x600.png` — `HubScene` com `BlacksmithModal` aberto exibindo saldos de Almas/Essências, lista `APRIMORAR ITENS` com item Lendário `+1/+5` e cards `FORJAR RELÍQUIAS`.
  - Mobile Retrato (`360x640`): `docs/qa/screenshots/m3-mobile-360x640.png` — `HubScene` mobile 9:16 com `AltarModal` aberto exibindo as 5 bênçãos permanentes e níveis atualizados (`Nv. 1/5`).

---

## 4. Classificação de Achados

### Bloqueantes (0)
- Nenhum.

### Graves (0)
- Nenhum.

### Menores (2)
1. **Texto de custo (`Custo: 1 Essência + 120 Almas`) encosta na borda esquerda do botão `Forjar` no `BlacksmithModal` (Desktop `800x600`)**
   - **Local:** `src/view/ui/BlacksmithModal.ts:812-816` e `869-876`.
   - **Descrição:** Na coluna direita do layout desktop (`rightColW = 282`), `card.costText` é posicionado em `x = left` (`-131`), `y = bottom - 22` (`+33`) sem `wordWrapWidth`, na mesma faixa vertical do `card.btnContainer` (`x = +35..+131`, `y = +27..+55`). Quando o custo combina Essência + Almas (`"Custo: 1 Essência + 120 Almas"`, ~174px de largura), a palavra `"Almas"` toca/sobrepõe a borda esquerda do botão `Forjar` (visível em `docs/qa/screenshots/m3-pc-800x600.png`).
   - **Passo a passo:** Abrir o **Ferreiro Espiritual** em `800x600` e observar o rodapé do card `"Forjar Relíquia Lendária"`.
   - **Recomendação:** Subir `card.costText` no desktop para `bottom - 36` (acima do topo do botão) ou definir `wordWrapWidth(w - btnW - 24)`.

2. **Sufixo de melhoria duplicado (`(+N) +N`) na formatação de nome do `BlacksmithModal`**
   - **Local:** `src/core/progression/ProfileManager.ts:357-358` e `src/view/ui/BlacksmithModal.ts:931-935`.
   - **Descrição:** `upgradeItemWithBlacksmith` (`ProfileManager.ts:358`) já grava `(+${newLevel})` em `item.name`, e `BlacksmithModal.ts:931-934` concatena `const suffix = level > 0 ? " +${level}" : ""` novamente em `row.nameText` (`[${SLOT_LABELS[item.slot]}] ${item.name}${suffix}`), gerando sufixo duplicado `(+1) +1` quando o nome do item cabe em 1 linha.
   - **Passo a passo:** Aprimorar um equipamento de nome curto para `+1` no Ferreiro e observar o título da linha em `APRIMORAR ITENS`.
   - **Recomendação:** Remover a variável `suffix` em `BlacksmithModal.ts:931-934`, exibindo apenas `[${SLOT_LABELS[item.slot]}] ${item.name}`.

---

## 5. O que Não Pôde Ser Verificado Automaticamente & Roteiro para o Dono

### O que requer validação humana no aparelho real
- Sensação tátil de navegação pelo **Refúgio no Submundo** com joystick virtual no celular e toque direto nas 4 estações (`Emissário Celestial`, `Ferreiro Espiritual`, `Altar de Almas` e `Portal da Fenda`).
- Persistência entre fechamento e reabertura real do app instalado na Tela de Início (PWA standalone no iOS/Android).

### Roteiro Curto de Teste para o Dono (4 minutos)
1. **No Refúgio do Submundo (Celular 9:16 ou PC `800x600`):**
   - Abra o jogo: confirme que ele inicia diretamente no **Refúgio do Submundo** (`SUBMUNDO v0.3.0`).
   - Caminhe até o **Emissário Celestial** (ou toque nele / pressione `E`/`Espaço`) para ler as orientações do Refúgio.
   - Abra o **Altar de Almas** e o **Ferreiro Espiritual** pelos botões do HUD ou interagindo com os NPCs.
2. **Incursão, Morte Punitiva e Extração:**
   - Entre na masmorra pelo **Portal da Fenda** (ou botão **`Entrar na Fenda`**).
   - Derrote alguns monstros na Sala 1 para coletar Almas, pegue um item no chão e **deixe o herói morrer**: ao clicar em retornar ao Refúgio, confirme que suas **Almas foram salvas** no topo do Hub, mas o item não extraído foi perdido.
   - Gaste as Almas no **Altar de Almas** para subir *Vitalidade Espectral* ou *Fúria das Sombras*, entre novamente na Fenda e vença o **Carcereiro Infernal** na Sala 5/5 para extrair os novos equipamentos para o **Baú** e ganhar **+1 Essência de General** para forjar uma relíquia Lendária no Ferreiro.
   - Recarregue a página (`F5` ou fechar/abrir o app) e confirme que Almas, Essências, níveis do Altar e itens permanecem salvos.
