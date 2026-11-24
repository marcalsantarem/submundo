# Relatório de Validação QA — Marco 10 (`v0.9.1`): Missões do Prólogo

- **Data:** 2026-11-24
- **Responsável:** AG03 (QA)
- **Briefing:** `BRF-162_AG03_validacao-m10.md` (`T-149`)
- **Commit validado:** `871f8da` (código do M10) + `0d94ac4` (só docs, Decisão #25), branch `dev`, com os specs desta validação (não commitados)
- **Escopo (Decisão #24):** o prólogo em 3 missões com marcadores ("!" amarelo, "?" cinza, "?" amarelo): Mestre → Lyra (Plantação de Ervas, sala gigante, 10 ervas) e Gorran (Mina Iluminada, 4 salas, 6 ferramentas, Chefe da Matilha, "algo estranho") em qualquer ordem → entrega → missão 3 do Mestre (Fundo da Mina, Karnak invencível) → morte → "Fim do Prólogo" → Ato 1. Sem teleporte entre salas; derrota sem custo.
- **Rodadas:** **1 rodada completa** (Decisão #25, comunicada pelo AG00 durante a validação: a suíte roda 1 vez e só os arquivos que falharem são repetidos). Antes dela houve a rodada 0 (diagnóstico, antes dos ajustes).
- **Revalidação (T-156, BRF-168, commits `54c0bf4` + `94d63af`):** **PASSA COM RESSALVAS** — ver Seção 7.
- **Veredito (validação original):** **PASSA COM RESSALVAS** — *0 bloqueantes, 0 graves, 8 menores* (ver Seção 3). A rodada oficial passou inteira (Vitest 141/141, build OK e todos os E2E, 30 testes), tirando a `m4` com o erro de ambiente já conhecido; nenhum arquivo precisou ser repetido. O prólogo inteiro roda nas duas ordens, com o Karnak invencível e a passagem ao Ato 1. Nenhuma quebra de comportamento em `src/`; as ressalvas são visuais, de narrativa e de duração/dificuldade.

---

## 1. Testes Criados e Alterados

### 1.1. Novo: `tests/e2e/m10-prologue.spec.ts` (**3 testes**)

| # | Teste | O que verifica |
| :--- | :--- | :--- |
| 1 | PC `960×540`, Ervas antes da Mina | Save limpo. **Marcadores em cada passo**, pela API (`getQuestMarkers`), pelo estado da Vila e pelo que está desenhado (`villageWorld.getQuestMarkerKinds()`): início só "!" no Mestre e portão sem "!" (portão abre a fala de trancado); introdução do Mestre (`quest_master_intro`) → "!" em Lyra e Gorran, tracker "Falar com Lyra e Gorran"; aceitar Lyra (`quest_lyra_offer`) → "?" cinza nela e "!" no portão; aceitar Gorran → "?" cinza nos dois; falas de andamento (`quest_lyra_progress`) e espera do Mestre (`quest_master_wait`), com orador e texto iguais ao `dialogues.json`. **Portão** lista as duas missões; tecla real `1` entra nas **Ervas**: mapa `giant`, 3 zonas, 10 ervas, contador do HUD `0/10`; o herói anda até uma erva pelo piloto (`autoWalkTo`) e a **tecla `E` colhe**: objetivo e HUD vão a `1/10`. `completeMissionNow` → vitória; **`Enter` no painel** volta à Vila com o herói no portão. "?" amarelo na Lyra, tracker "Volte a Lyra", portão só com a Mina; entrega (`quest_lyra_turnin`) e fala de depois (`quest_lyra_done`). **Mina**: `rooms`, 4 salas, 6 ferramentas, `wolf_alpha` só na sala 4; o herói atravessa as salas com o piloto (o debug zera os monstros de cada sala, as portas abrem pelo jogo), o **Chefe da Matilha aparece** ao entrar na sala 4; com a sala limpa, o herói anda até o ponto do **"algo estranho"** e a fala `mission_mine_strange` aparece no banner. Vitória, volta pelo portão, "?" amarelo no Gorran, entrega. **Missão entregue não aparece mais no portão** (lista vazia). **Missão 3**: "!" no Mestre → `quest_master_depths_offer` → "?" cinza no Mestre e "!" no portão. **Fundo da Mina**: 5 salas, sem objetivo; na sala 5 a fala `mission_depths_karnak`, o Karnak luta com o herói (auto-ataque) e **o HP dele nunca cai** (9999/9999); o herói **morre de verdade** pelo Karnak, a tela **"Fim do Prólogo"** aparece (título do `dialogues.json` e botão "Continuar"), o save já está em `act1` com as 3 missões `turned_in`; `Enter` ("Continuar") leva ao **Ato 1** (HubScene sem a Vila). Save final: fase `act1`, `act1_submundo`, as 3 missões em `completedStages`. Zero erros de console/página/404. |
| 2 | Mobile `844×390` (`hasTouch`), Mina antes das Ervas | O mesmo fluxo na **ordem 2→1** (Mina primeiro), com as capturas mobile. |
| 3 | Derrota numa missão não muda o estado | Nas Ervas, na Mina e no Fundo da Mina (fora da sala do Karnak) o herói **morre pelo combate** (debug deixa o herói com 1 HP e encosta um monstro): `defeat`, sem "Fim do Prólogo", volta pelo portão e o save (estados das missões, `completedStages`, fase) e os marcadores ficam iguais; o portão continua listando as mesmas missões. |

### 1.2. Novo: `tests/e2e/m10-timing.spec.ts` (**1 teste, só com `M10_TIMING=1`**)

Mede o tempo de cada missão **jogada pelo piloto**, sem atalho de vitória: o piloto (`autoWalkTo`) leva o herói até o monstro mais próximo (o auto-ataque normal resolve), até os itens (colhidos com a tecla `E`), até a próxima sala e até o "algo estranho". Cura de emergência quando o HP cai abaixo de 30 (contada). Fica pulado na suíte normal porque leva ~8 min.

### 1.3. Specs ajustados ao M10

| Spec | Ajuste |
| :--- | :--- |
| `m5-hero.spec.ts` | Entrava em `prologue_grotto` (fase que não existe mais) e esperava `totalRooms === 3`: falhava com timeout. Agora entra em `mission_herbs` e espera `getMissionState()`. O save de Ato 1 usa as missões novas em `completedStages`. |
| `m9-village.spec.ts` | Testes 1 e 4 seguiam o fluxo do M9 (Mestre libera o portão, Gruta/Mina/Selo, `forceClearRoom`/`advanceRoom`). Agora: Mestre (teclado + `E`) faz a introdução e **não** libera o portão; Lyra (`E` / toque no Interagir) dá as Ervas e libera; portão (teclado real até ele + `E`) lista só `mission_herbs`, com "Pedido de Lyra"; clique/toque real na linha inicia a missão; vitória por `completeMissionNow`; derrota pelo combate; marcadores conferidos pelo que está desenhado. Testes 2 (colisão) e 3 (falas soltas de Lyra/Gorran antes do Mestre) seguem iguais. |
| `m1`, `m2`, `m3` | Sem mudança: já passam (entram direto no Ato 1, onde `forceClearRoom`/`advanceRoom` continuam valendo). |
| `m4-campaign.spec.ts` | **Não alterado.** Continua sem carregar pelo erro de ambiente do `campaign.json` (Seção 2). Além disso o conteúdo dele é do prólogo antigo (`prologue_grotto → prologue_mine → prologue_seal`, Arauto do Abismo) e falharia mesmo carregando; a progressão do prólogo agora é coberta pela `m10`. Sugestão: reescrever ou aposentar a parte de campanha da `m4` num próximo marco. |

---

## 2. Resultados

### 2.1. Rodada 0 (diagnóstico, antes dos ajustes, commit `871f8da`)

Vitest 141/141, build OK. E2E: m1, m2, m3, m6, m7 (3/3), m8-biomes (11/11), m8-dungeon-basic (3/3), m8-ground-pickup passaram; **m5 falhou** (fase `prologue_grotto` removida) e **m9 falhou 2 de 4** (fluxo do portão do M9); m4 com o erro de ambiente.

### 2.2. Rodada oficial (`npm test` → `npm run build` → E2E um arquivo por vez, `--workers=1`)

| Rodada | Vitest | Build | m1 | m10-prologue | m10-timing | m2 | m3 | m4 | m5 | m6 | m7 | m8-biomes | m8-dungeon-basic | m8-ground-pickup | m9-village |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | 141/141 | OK | 1/1 | 3/3 (5,8 min) | pulado (só com `M10_TIMING=1`) | 1/1 | 1/1 | ⚠️ ambiente | 1/1 | 1/1 | 3/3 | 11/11 | 3/3 | 1/1 | 4/4 |

- Só 1 rodada (Decisão #25, aplicada a pedido do AG00 durante esta validação). Nenhum arquivo falhou, então nada foi repetido.
- Antes da rodada oficial, cada spec novo/ajustado também passou isolado: `m10-prologue` (PC 3,4 min; mobile + derrota 2,8 min), `m9-village` 4/4, `m5-hero` 1/1; e a `m10-timing` passou com `M10_TIMING=1` (8,1 min).

- **m4 (conhecido, não corrigido):** `TypeError: Module "file:///C:/Repos/submundo/src/data/campaign.json" needs an import attribute of "type: json"` → "No tests found". Erro de ambiente do Node do Playwright ao importar `src/core/progression/CampaignManager.ts`, não do jogo.
- **Build de release:** `tsc --noEmit` + `vite build` OK; `dist/` com **3,5 MB**; `dist/assets/index-*.js` com **1.922 kB** (gzip **466 kB**; no M9 eram 1.882/453 kB). O Vite avisa sobre chunk > 500 kB (só aviso).
- **Versão:** `package.json` e `src/version.ts` em `0.9.1`.

### 2.3. Tempo das missões (piloto, `m10-timing`, Chromium headless sem GPU)

| Missão | Tempo de jogo | Tempo real | Curas de emergência | FPS médio | Resultado |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Plantação de Ervas | **146 s** (2:26) | 148 s | 2 | 24 | vitória (10/10 ervas) |
| Mina Iluminada | **231 s** (3:51) | 231 s | 6 | 20 | vitória (6/6, "algo estranho" visto) |
| Fundo da Mina | **96 s** (1:36) | 96 s | 2 | 19 | Fim do Prólogo (Karnak alcançado aos 90 s; o herói morre em ~4 s) |

- Outra medida das Ervas (tentativa anterior): 142,5 s. O "tempo de jogo" é o relógio da cena (`elapsedMs`); com FPS baixo o passo é limitado a 100 ms, então tempo de jogo ≈ tempo real aqui.
- O piloto não usa esquiva, skills nem poções e anda até cada monstro; um jogador real tende a ser mais rápido na Mina (o piloto volta atrás para buscar ferramentas de corredor) e mais lento no Fundo da Mina (que ficou bem abaixo dos ~3 min da Decisão #24).
- **6 curas na Mina:** sem elas o herói (Nv. 1, 120 HP) teria morrido. Na corrida de desenvolvimento do AG01 (`t129`) o herói também chegou a 1 HP na Mina. Ver menor 6.

---

## 3. Classificação de Achados

- **Bloqueantes:** 0
- **Graves:** 0
- **Menores:**
  1. **Retrato da Lyra usa o do Mestre** (já sabido; `PortraitId` sem `village_healer`, T-137/T-147).
  2. **Plantação de Ervas: bloco preto e "Ervas x/10" duplicado** (já sabido): o vazio fora do mapa aparece como um retângulo preto no canto superior esquerdo (ver `m10_herbs_counter_pc.png`) e há um texto de objetivo duplicado no topo do mundo.
  3. **"!" do portão colado no topo do mapa** (já sabido): o marcador fica cortado na borda superior (ver `m10_village_turnin_pc.png`, perto de `x≈680`).
  4. **Depois do "Fim do Prólogo" o Ato 1 abre com as falas da queda antiga** (`src/view/scenes/HubScene.ts:1507-1508`): `triggeredVillageFall` ainda dispara `village_fall_boss` / `village_fall_pact` / `act1_briefing`, e a primeira fala é do **Arauto do Abismo**: "O Selo caiu e sua vila já arde em cinzas…" (ver `m10_act1_pc.png`). O herói acabou de morrer para o Karnak no Fundo da Mina e o Selo não existe mais no prólogo. Narrativa (AG06/AG02).
  5. **Banner do Ato 1 na volta à Vila** (`src/view/scenes/HubScene.ts:1947`): ao voltar de uma missão aparece "Extração completa! +0 Almas, +0 Essências, 0 item(ns) no Baú." — termos do Ato 1 (Almas, Baú) no prólogo (ver `m10_village_turnin_pc.png`). Também aparece no Refúgio depois do "Fim do Prólogo".
  6. **Duração e dificuldade fora da meta de ~3 min** (Seção 2.3): Mina ~3:51 com 6 curas de emergência (herói Nv. 1 quase sempre perto de morrer), Fundo da Mina ~1:36. Só medida de piloto; sugere revisão de balanceamento (AG01) no M11/M13.
  7. **Debug: morte do herói "por fora" não vira derrota** (`src/view/scenes/DungeonScene.ts:706-737`): a cena só confere a derrota dentro do tick de combate com o herói vivo; zerar `hero.isAlive` pelo debug deixa o herói com 0 HP e a missão em andamento para sempre. Não acontece jogando (a morte vem do combate), mas pegou os specs; agora eles matam o herói pelo combate.
  8. **E2E `m4-campaign`** sem carregar no Playwright local e com conteúdo do prólogo antigo (Seção 1.3).
- **Efeito colateral das rodadas (só arquivos de QA):** os specs existentes regravam as próprias capturas versionadas (`m1/m2/m3-*`, `m7-*`, `m8_*`, `m9_village_*`). As `m9_village_*` agora mostram o fluxo do M10 (introdução do Mestre, portão com as Ervas). Nenhuma captura versionada foi apagada.

---

## 4. Capturas Geradas (`docs/qa/screenshots/`)

PC `960×540` (`_pc`) na ordem Ervas → Mina; mobile `844×390` (`_mobile`) na ordem Mina → Ervas.

| Tela | Arquivos |
| :--- | :--- |
| Vila no início ("!" só no Mestre) | `m10_village_start_{pc,mobile}.png` |
| "!" em Lyra e Gorran após a introdução | `m10_village_markers_{pc,mobile}.png` |
| "?" cinza nos dois e "!" no portão | `m10_village_accepted_{pc,mobile}.png` |
| Portão com as duas missões aceitas | `m10_gate_{pc,mobile}.png` |
| Ervas com o contador `1/10` no HUD | `m10_herbs_counter_{pc,mobile}.png` |
| Mina: Chefe da Matilha na sala 4 | `m10_mine_boss_{pc,mobile}.png` |
| Mina: "algo estranho" | `m10_mine_strange_{pc,mobile}.png` |
| "?" amarelo para entregar | `m10_village_turnin_{pc,mobile}.png` |
| "!" do Mestre com a missão 3 | `m10_village_master_depths_{pc,mobile}.png` |
| Karnak (9999/9999) | `m10_karnak_{pc,mobile}.png` |
| "Fim do Prólogo" | `m10_prologue_end_{pc,mobile}.png` |
| Ato 1 depois do "Continuar" | `m10_act1_{pc,mobile}.png` |

Não houve ferramenta na sala 1 da Mina nas corridas que geraram as capturas, então não há `m10_mine_counter_*` (o teste colhe uma ferramenta só quando existe uma na sala 1; o contador da Mina aparece `0/6` em `m10_mine_boss_*`).

---

## 5. O que Não Foi Verificado Automaticamente

- Missões **inteiras jogadas** dentro da suíte: a `m10-prologue` colhe 1 erva/ferramenta de verdade e atravessa as salas, mas limpa os monstros pelo debug e completa com `completeMissionNow`. A campanha jogada de ponta a ponta só roda na `m10-timing` (manual, com curas de emergência).
- Toque e joystick em celular real (o E2E mobile usa teclado/debug para andar; o toque foi coberto na `m9`).
- Tempo de missão com jogador humano (a medida é do piloto, no headless sem GPU).
- Qualidade visual (iluminação das salas escuras, brilho das ervas, animação do "algo estranho" e do Karnak): só pelas capturas.
- Áudio.

---

## 6. Roteiro de Teste Manual para o Dono (`https://dev--submundo-game.netlify.app`)

Para começar do zero: **Config. → Resetar progresso** na Vila (ou limpar os dados do site).

### 6.1. No PC (`F12` aberto no Console)
1. Abra a raiz: título `SUBMUNDO v0.9.1`, Vila com **"!" amarelo só sobre o Mestre**; tracker "Falar com o Mestre". Console sem erros.
2. Vá ao portão e aperte `E`: fala de portão trancado.
3. Fale com o Mestre (`E`): introdução; o "!" dele some e aparece sobre **Lyra e Gorran**; tracker "Falar com Lyra e Gorran".
4. Fale com a Lyra: ela pede as ervas; o "!" vira **"?" cinza** e o portão ganha **"!"**. Fale com o Gorran: mesma coisa (ferramentas).
5. No portão (`E`): a lista mostra **as duas missões** ("Pedido de Lyra" / "Pedido de Gorran"). Escolha a que quiser (a ordem é livre).
6. **Plantação de Ervas:** sala gigante com 3 zonas de slimes; colha as 10 ervas (perto, `E` ou clique) e veja o contador "Ervas x/10" subir no HUD. Ao terminar, painel de vitória → `Enter` → herói aparece **no portão**. Sabido: bloco preto no canto e texto "Ervas x/10" duplicado no topo do mundo.
7. **Mina Iluminada:** 4 salas com corredores (sem teleporte), 6 ferramentas (algumas nos corredores), **Chefe da Matilha** na sala 4 e, no fim, um brilho vermelho: ande até ele e leia a fala do "algo estranho".
8. Na Vila: **"?" amarelo** sobre quem deu a missão; fale para entregar. A missão entregue **some do portão**.
9. Morra em uma missão de propósito: volta ao portão e nada muda (a missão continua aceita).
10. Com as duas entregues: **"!" no Mestre**; ele dá a missão 3 (Fundo da Mina).
11. **Fundo da Mina:** 5 salas escuras; na sala 5 o **Karnak** fala e a barra dele fica em 9999/9999 por mais que você bata. Ao morrer: tela **"Fim do Prólogo"** → **Continuar** leva ao Refúgio (Ato 1). Sabido: lá aparecem as falas antigas do Arauto ("O Selo caiu…").
12. Recarregue: continua no Ato 1.

### 6.2. No celular (paisagem)
1. Repita 3 a 6 pelo joystick e pelo botão **Interagir/Pegar**; confira que o contador do objetivo e os marcadores ficam legíveis.
2. Faça a Mina e veja se o "algo estranho" e o Chefe da Matilha aparecem sem cortes.
3. Toque em **Continuar** na tela "Fim do Prólogo".
4. Anote quanto tempo levou cada missão (meta da Decisão #24: ~3 min).

---

## 7. Revalidação (T-156, BRF-168)

- **Data:** 2026-11-24 · **Responsável:** AG03 · **Commits:** `54c0bf4` (T-150 a T-155, Decisão #26) e `94d63af` (T-157, Decisão #27, entrou durante a revalidação a pedido do AG00), branch `dev`, com os specs abaixo (não commitados).
- **Veredito:** **PASSA COM RESSALVAS** — *0 bloqueantes, 0 graves, 3 menores pendentes*. As ressalvas 1 a 5 da validação original foram resolvidas; a 6 melhorou (tempos perto de ~3 min).

### 7.1. O que mudou no jogo e foi verificado

| Mudança | Como o E2E confere (`m10-prologue`) |
| :--- | :--- |
| Sem ondas: monstros já no mapa, adormecidos | `monstersAlive === monstersTotal` (Ervas 15, Mina 20, Fundo 22; Karnak fora), todos vivos no início, `monstersDormant > 0`; Chefe da Matilha já no mapa ao entrar na Mina |
| "Elimine todos os monstros X/Y" no tracker | texto do tracker `0/Y` no início e `Y/Y` depois de matar todos; Ervas não fecha só com os monstros (faltam ervas) |
| Portas não selam | `doorsOpen` todo `true` e `getSealedDoorIds() = []` |
| 5 ervas / 4 ferramentas | objetivo, coletáveis e contador do HUD (`0/5`→`1/5`, `0/4`→`1/4`) |
| Itens pegos ficam no perfil (vitória e derrota) | item de teste pego no chão da missão → está no Baú/equipado do perfil após a vitória (Ervas) e após a derrota (Ervas e Mina) |
| Minimapa | dungeon: `hud.getMinimapState()` em modo `layout` com salas (> 0), corredores na Mina/Fundo, inimigos e coletáveis restantes; Vila: `villageHud.getMinimapState()` com planta (`planRects > 0`), 3 NPCs e portão |
| Banner de volta | "Missão cumprida: <missão>. Fale com Lyra/Gorran." na vitória; na derrota, "recuou ferido"; nunca "Extração"/"Almas"/"Baú" |
| Ato 1 | fila de falas = `act1_arrival_1..3` (Guerreiro Espectral / Emissário); sem `village_fall_*`, `act1_briefing` nem o Arauto; sem banner "Extração" no Refúgio |
| Retrato da Lyra | `portraitId = village_healer`, sprite visível no **frame 8** |
| **T-157 / Decisão #27 — prólogo sem Almas** | modal de fim: título "<MISSÃO> — MISSÃO CUMPRIDA" ou "DERROTADO", botão "Voltar à Vila", linhas de Almas e de itens escondidas; contador de Almas/Essências do HUD escondido; `hero.souls = 0`; perfil com `souls = 0`, `generalEssences = 0` e `totalSoulsEarned = 0` após cada missão (vitória e derrota) e depois do "Fim do Prólogo" (antes do T-157 o Refúgio abria com **Almas: 8**) |

### 7.2. Specs alterados

- `tests/e2e/m10-prologue.spec.ts`: tudo da tabela acima (helpers `expectPlacedMissionStart`, `pickTestItem`/`expectItemKept`, `expectVillageMinimap`, `dungeonMinimap`, `trackerText`, `outcomeModal`, `expectNoPrologueSouls`, `dialoguePortrait`/`dialogueQueue`); `killZone`/`goToZone` aceitam poupar um monstro (o Chefe, para a captura).
- `tests/e2e/m10-timing.spec.ts`: comentário do novo modelo e contador de abates no log.
- `tests/e2e/m7-ui-landscape.spec.ts`: `portraits.png` agora tem **9 frames (1152×128)** — o frame 8 é a Lyra (T-153). Mudança de asset esperada.
- `tests/e2e/m5-hero.spec.ts:713`: espera da animação de ataque no Ato 1 mobile de 3 s → 8 s. O herói ataca (o slime perde HP), mas a animação `hit` corta a de ataque e o golpe seguinte vem em ~2 s; a janela de 3 s ficou curta. Não é defeito de jogo.

### 7.3. Resultados

| Rodada | Vitest | Build | m1 | m10-prologue | m2 | m3 | m4 | m5 | m6 | m7 | m8-biomes | m8-dungeon-basic | m8-ground-pickup | m9 | m10-timing |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 (`54c0bf4`) | 150/150 | OK | 1/1 | 3/3 (8,5 min) | 1/1 | 1/1 | ⚠️ ambiente | ❌ 0/1 | 1/1 | ❌ 1/3 | 11/11 | 3/3 | 1/1 | 4/4 | pulado |
| Repetição só dos que falharam | — | — | — | — | — | — | — | ❌ (mesmo ponto) → ajuste do spec | — | ✅ 3/3 (após ajuste) | — | — | — | — | — |
| Após `94d63af` (T-157): build + E2E do prólogo/modal/Almas | 158/158 | OK | 1/1 | **3/3** (7,0 min) | — | 1/1 | — | **1/1** | — | — | — | — | — | 4/4 | — |

- **m4:** mesmo erro de ambiente conhecido (`campaign.json` precisa de import attribute → "No tests found").
- **Build:** `dist/` **3,5 MB**; `index-*.js` **1.937 kB** (gzip **470 kB**). Aviso de chunk > 500 kB (só aviso).
- **Karnak:** na rodada 1 o herói não morreu sozinho em 60 s (o spec usa o atalho de debug nesse caso); após `94d63af` a morte foi natural nas duas ordens (PC e mobile). HP do Karnak sempre 9999/9999.

### 7.4. Tempo das missões (`m10-timing`, piloto, 1 rodada, após `94d63af`)

| Missão | Tempo de jogo | Curas de emergência | FPS médio | Resultado | Antes (validação original) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Plantação de Ervas | **149 s** (2:29) | 1 | 24 | vitória | 146 s, 2 curas |
| Mina Iluminada | **217 s** (3:37) | 2 | 20 | vitória | 231 s, 6 curas |
| Fundo da Mina | **149 s** (2:29) | 1 | 19 | Fim do Prólogo | 96 s, 2 curas |

Total ~8,6 min. O piloto caça o monstro mais próximo (acordando também os de outras salas) e não usa esquiva/skills/poções.

### 7.5. Ressalvas

- **Resolvidas:** 1 (retrato da Lyra), 2 (bloco preto e "Ervas x/10" duplicado não aparecem nas capturas das Ervas), 3 ("!" do portão abaixo da placa SAÍDA, ver `m10_return_banner_pc.png`), 4 (Ato 1 sem o Arauto), 5 (banner sem "Extração"); e Almas no prólogo (Decisão #27).
- **Pendentes (menores):**
  1. **Duração/dificuldade (ex-6):** Mina ~3:37 com 2 curas (herói Nv. 1); as outras ~2:30. Perto da meta de ~3 min; só medida de piloto.
  2. **Debug: morte "por fora" não vira derrota (ex-7)**, `src/view/scenes/DungeonScene.ts` (derrota só conferida no tick de combate). Não afeta o jogo.
  3. **E2E `m4-campaign` (ex-8):** não carrega no Playwright local e tem conteúdo do prólogo antigo.
- **Observação (sem defeito):** no Ato 1 a animação `hit` interrompe a de ataque do herói (motivo do ajuste da `m5`).

### 7.6. Capturas novas (`docs/qa/screenshots/`, `_pc` e `_mobile`)

`m10_minimap_village_*`, `m10_minimap_dungeon_*` (Ervas, `0/15` e `0/5`), `m10_monster_counter_*` (Mina, `0/20` e `0/4`), `m10_mine_boss_*`, `m10_mission_end_pc` (modal "Missão cumprida" sem Almas), `m10_mission_defeat_pc` (modal "Derrotado"), `m10_return_banner_*`, `m10_lyra_*`, `m10_act1_*` (Ato 1 com "O Despertar" e Almas: 0); as demais `m10_*` foram regravadas. Nenhuma captura de outro marco foi apagada (as rodadas regravam as próprias `m1`–`m9`).

### 7.7. Roteiro manual atualizado (dono)

1. **Config. → Resetar progresso.** Vila com "!" só no Mestre; o minimapa mostra a clareira, NPCs e portão.
2. Fale com Mestre, Lyra (retrato **dela**) e Gorran; o "!" do portão fica logo **abaixo** da placa SAÍDA.
3. **Ervas:** os slimes já estão nos canteiros (parados até você chegar perto); tracker "Elimine todos os monstros 0/15" e "Ervas 0/5"; minimapa com a planta, você, monstros e ervas. Pegue um item que cair.
4. Ao terminar: modal "**A PLANTAÇÃO DE ERVAS — MISSÃO CUMPRIDA**", botão **Voltar à Vila**, sem Almas/itens; topo do HUD sem Almas/Essências o tempo todo. Na Vila: banner "Missão cumprida…" e o item no Inventário.
5. **Mina:** 20 monstros, 4 ferramentas, portas sempre abertas, Chefe da Matilha na sala 4, "algo estranho" no fim. Morra uma vez de propósito: modal "**DERROTADO**", o item pego continua no Inventário e a missão continua aceita.
6. **Fundo da Mina:** Karnak invencível → "Fim do Prólogo" → Continuar → falas "O Despertar" (sem o Arauto) e **Almas: 0** no Refúgio.
7. Anote o tempo de cada missão (piloto: ~2:30 / ~3:40 / ~2:30).
