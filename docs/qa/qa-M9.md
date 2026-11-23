# Relatório de Validação QA — Marco 9 (`v0.9.0`): Novo Hub Funcional — Vila Natal

- **Data:** 2026-11-23
- **Responsável:** AG03 (QA)
- **Briefing:** `BRF-154_AG03_validacao-m9.md` (`T-141`)
- **Commit validado:** `8d22f3d` (branch `M9`) + specs desta validação (não commitados)
- **Escopo (Decisão #23):** a URL raiz abre a Vila Natal (`HubScene`, fase `prologue`); testArena só com `?test`, `?map=`, `?biome=` ou `?seed=` (T-140). Na Vila: 3 NPCs (Mestre com "!", Lyra, Gorran), botão "Interagir" (tecla `E`), colisão com casa/forja/paliçada, portão que só libera depois de falar com o Mestre e abre a lista das dungeons do prólogo, volta da dungeon no portão (vitória ou derrota), HUD da vila sem AUTO/skills/poções/esquiva/moedas (T-138, T-139).
- **Veredito:** **PASSA COM RESSALVAS** — *0 bloqueantes, 0 graves, 3 menores* (ver Seção 3). A suíte passou em 3 rodadas completas seguidas (Vitest 113/113, build OK e todos os E2E), tirando a `m4` com o erro de ambiente já conhecido. Nenhuma quebra de comportamento em `src/`.

---

## 1. Testes Criados e Alterados

### 1.1. Novo: `tests/e2e/m9-village.spec.ts` (**4 testes**)

| # | Teste | O que verifica |
| :--- | :--- | :--- |
| 1 | Fluxo completo no PC `960×540` | Raiz abre a `HubScene` na fase `prologue` (título `SUBMUNDO v0.9.0`, canvas `16:9`, sem `DungeonScene` ativa, sem a `HubHud` antiga nem as 4 estações, `VillageHud` presente); herói nasce no início `(672, 244)`; falas de boas-vindas fecham com `Enter`. **"!"** desenhado sobre o Mestre (`alertNpcId='master'`, gráfico não vazio) e tracker "Falar com o Mestre". **Portão travado:** `openGate()` mostra a fala `village_gate_locked` (orador e texto iguais ao `dialogues.json`) sem abrir a lista, e o portão fechado bloqueia a passagem (setas reais). **Mestre:** caminhada com setas reais até ele, `nearby='master'`, tecla `E` abre `village_master_mission_grotto`, libera o portão (sprite aberto, colisão do meio removida), tracker muda para "Saia pelo portão" e o "!" some; `E` de novo dá `village_master_idle`. **Portão:** caminhada com setas até o portão, `E` abre a lista com Gruta **liberada**, Mina e Selo **travadas** (ids e nomes iguais ao `campaign.json`); clique real na Mina não faz nada; clique real na Gruta inicia a `DungeonScene` com `stageId=prologue_grotto`. **Vitória** (debug) → volta à Vila com o herói no portão `(831, 184)`, Gruta concluída, portão trava de novo até falar com o Mestre ("!" volta). Mestre dá a Mina; lista mostra Gruta **concluída**, Mina liberada, Selo travado; tecla `2` entra na Mina. **Derrota** (debug) → herói no portão, Mina continua liberada, `runsFailed=1`. **Recarregar:** perfil persiste (portão liberado, Gruta concluída, missão atual = Mina), herói no início, sem as boas-vindas. Zero erros de console/página/404. |
| 2 | Colisão (setas reais) | Herói posicionado em área livre e empurrado com as setas: para na **casa** (`y≈171`, antes do limite da clareira `150`), na **forja** (`y≈223`), na **paliçada leste** (`x≈995`, antes do limite do mapa `1010`) e na **paliçada sul** (`y≈374`, antes do limite `410`); controle em área livre anda normal. |
| 3 | Lyra e Gorran | Perto de cada um, `E` abre `village_<npc>_idle` e, na segunda vez, `village_<npc>_idle_2` (orador e texto iguais ao `dialogues.json`); falar com eles não libera o portão. |
| 4 | Mobile paisagem `844×390` (`hasTouch`) | Vila renderiza (canvas `16:9`, `maxTouchPoints>0`, `#rotate-overlay` oculto); **toque** no Interagir longe de tudo não abre nada; perto do Mestre o toque abre a missão e libera o portão; perto do portão o toque abre a lista; toque na Gruta inicia a dungeon; vitória volta no portão. Zero erros. |

O debug só posiciona o herói (setup), encerra as runs (vitória/derrota) e, nos passos 7–8 do teste 1, usa `talkTo('master')`/`openGate()` para ir mais rápido depois que o mesmo caminho já foi feito por teclado.

### 1.2. Specs ajustados à nova entrada

| Spec | Ajuste |
| :--- | :--- |
| `m6-monsters.spec.ts` | Abre a testArena com `/?test` (PC e mobile). Antes falhava com `window.__SUBMUNDO_DEBUG__.getMonsters is not a function` (a raiz agora é a Vila). |
| `m7-ui-landscape.spec.ts` | Os 2 testes de cena inicial validam a Vila: esperam `getVillageState()`, conferem `HubScene` e abrem o Inventário pelo botão **Mochila da `VillageHud`** (clique real no PC e no mobile). Antes falhavam: o spec tomava a Vila por dungeon (`__SUBMUNDO_DEBUG__` existe na Vila, ver menor 1) e procurava a `HubHud` antiga (`Cannot read properties of undefined (reading 'hud')`). |
| `m3-hub.spec.ts` | Já passava (troca para o Ato 1 logo no início). Ganhou a checagem do boot na Vila (estado da Vila, portão travado, tracker "Falar com o Mestre", sem estações antigas) e uma espera explícita pela recriação da cena ao sair do prólogo (`setCampaignPhase` reinicia a `HubScene`), que antes era corrida implícita. |

---

## 2. Resultados das Rodadas (`npm test` → `npm run build` → E2E um arquivo por vez, `--workers=1`)

| Rodada | Vitest | Build | m1 | m2 | m3 | m4 | m5 | m6 | m7 | m8-biomes | m8-dungeon-basic | m8-ground-pickup | m9-village |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | 113/113 | OK | 1/1 | 1/1 | 1/1 | ⚠️ ambiente | 1/1 | 1/1 | 3/3 | 11/11 | 3/3 | 1/1 | 4/4 |
| 2 | 113/113 | OK | 1/1 | 1/1 | 1/1 | ⚠️ ambiente | 1/1 | 1/1 | 3/3 | 11/11 | 3/3 | 1/1 | 4/4 |
| 3 | 113/113 | OK | 1/1 | 1/1 | 1/1 | ⚠️ ambiente | 1/1 | 1/1 | 3/3 | 11/11 | 3/3 | 1/1 | 4/4 |

- **m4 (conhecido, não corrigido):** `TypeError: Module "file:///C:/Repos/submundo/src/data/campaign.json" needs an import attribute of "type: json"` ao carregar o spec no Node do Playwright → "No tests found". Erro de ambiente, não do jogo.
- **Rodada 0 (antes dos ajustes, commit `8d22f3d`):** m1, m2, m3, m5, m8 (3 specs) passaram; **m6** e **m7** (2 de 3) falharam pela nova entrada, como previsto no briefing.
- **Build de release:** `tsc --noEmit` + `vite build` OK; `dist/` com **3,5 MB**; `dist/assets/index-*.js` com **1.882 kB** (gzip **453 kB**; no M8 eram 1.833/440 kB). O Vite avisa sobre chunk > 500 kB (só aviso).
- **Versão:** `package.json`, `src/version.ts` e título da página em `0.9.0`.

---

## 3. Classificação de Achados

- **Bloqueantes:** 0
- **Graves:** 0
- **Menores:**
  1. **Debug da Vila em `window.__SUBMUNDO_DEBUG__`** (`src/view/scenes/HubScene.ts:860-862`): a Vila cria/mescla `getVillageState/talkTo/openGate` no objeto de debug da dungeon. Na Vila ele existe sem `scene`/`getHero`/`getMonsters`, e ao voltar da dungeon continua apontando para a `DungeonScene` encerrada. Specs que detectam "estou na dungeon" por `typeof window.__SUBMUNDO_DEBUG__` erram (foi o que quebrou a m7). Só afeta testes; os specs agora usam `__SUBMUNDO_HUB_DEBUG__.getVillageState()`.
  2. **Selo "E" no botão Interagir também no celular** (`src/view/ui/VillageHud.ts:218`): o atalho de teclado aparece no toque (ver `m9_village_*_mobile.png`). Estético.
  3. **E2E `m4-campaign`** continua sem carregar no Playwright local (Seção 2).
- **Efeito colateral das rodadas (só arquivos de QA):** os specs existentes regravam as próprias capturas versionadas (`m1/m2/m3-*-960x540|844x390.png`, `m7-*-landscape.png`, `m8_biome_*`, `m8_map_*`); as de m1/m2/m3/m7 passam a mostrar a Vila. Nenhuma captura versionada foi apagada.

---

## 4. Capturas Geradas (`docs/qa/screenshots/`)

| Tela | PC `960×540` | Mobile `844×390` |
| :--- | :--- | :--- |
| Vila (início, "!" no Mestre, tracker "Falar com o Mestre") | `m9_village_pc.png` | `m9_village_mobile.png` |
| Diálogo do Mestre (missão da Gruta) | `m9_village_master_dialogue_pc.png` | `m9_village_master_dialogue_mobile.png` |
| Modal do portão (Gruta liberada, Mina e Selo com cadeado) | `m9_village_gate_modal_pc.png` | `m9_village_gate_modal_mobile.png` |
| Volta da dungeon no portão (após a vitória na Gruta) | `m9_village_gate_return_pc.png` | `m9_village_gate_return_mobile.png` |

---

## 5. O que Não Foi Verificado Automaticamente

- Toque e joystick em celular real (o E2E usa `touchscreen.tap` do Chromium com `hasTouch`; o andar no mobile não foi testado pelo joystick).
- Vitória e derrota **jogadas**: o E2E encerra as runs pelo debug; o caminho real (vencer o chefe / morrer e apertar o botão de voltar) fica para o roteiro manual.
- Velocidade de caminhada e FPS reais: o Chromium headless deste Windows roda sem GPU (o herói anda mais devagar que em aparelho real).
- Qualidade visual (iluminação, profundidade herói × objetos, animação da fogueira/forja/Gorran): só pelas capturas e jogando.
- Selo Antigo e a queda da Vila no fim do prólogo (fora do escopo do M9; M10).

---

## 6. Roteiro de Teste Manual para o Dono (`https://m9--submundo-game.netlify.app`)

### 6.1. URLs
| O quê | URL |
| :--- | :--- |
| Vila Natal (entrada do jogo) | `https://m9--submundo-game.netlify.app/` |
| Fase de testes (Mina Iluminada) | `https://m9--submundo-game.netlify.app/?biome=village_mine` |
| Fase de testes (Masmorra Básica) | `https://m9--submundo-game.netlify.app/?test` |

Para começar do zero: **Config. → Resetar progresso** na Vila (ou limpar os dados do site).

### 6.2. No PC (`F12` aberto no Console)
1. Abra a raiz: título `SUBMUNDO v0.9.0`, Vila com fogueira, forja e braseiro animados, nomes sobre os 3 NPCs e **"!"** sobre o Mestre. Feche as boas-vindas (`Enter`). Console sem erros.
2. HUD: retrato, vida, tracker "Falar com o Mestre", minimapa, Inventário, Áudio, Config. e o botão **Interagir** no lugar do Ataque. Não deve haver AUTO, skills, poções, esquiva nem moedas.
3. Ande com `WASD`/setas e esbarre na casa, na forja e na paliçada (não atravessa).
4. Vá ao portão antes de falar com o Mestre e aperte `E`: aparece a fala de portão trancado.
5. Fale com o Mestre (`E`): missão da Gruta; o "!" some, o portão abre e o tracker vira "Saia pelo portão".
6. Fale com Lyra e Gorran duas vezes cada (falas diferentes).
7. No portão, `E`: lista com Gruta liberada e Mina/Selo com cadeado. Escolha a Gruta.
8. Vença a Gruta e volte: o herói aparece **no portão**, a Gruta aparece concluída e o "!" volta ao Mestre (próxima missão: Mina).
9. Entre de novo, **morra** e volte: o herói aparece no portão e a missão continua liberada.
10. Recarregue a página: o progresso continua (portão no mesmo estado).
11. Abra `?biome=village_mine`: deve ir direto para a fase de testes, não para a Vila.

### 6.3. No celular (paisagem)
1. Abra a raiz: sem cortes, HUD legível, FPS estável ao andar pelo joystick.
2. Chegue perto do Mestre e toque em **Interagir**; depois no portão, toque em Interagir e toque na Gruta.
3. Confira que tocar no Interagir não mexe o joystick e que, longe de NPCs/portão, o toque não faz nada.
4. Sabido: o botão Interagir mostra o selo "E" do teclado também no celular (menor 2).
