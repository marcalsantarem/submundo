# Relatório de Validação QA — Marco 11: Menu-hub

- **Data:** 2026-11-24
- **Responsável:** AG03 (QA)
- **Briefing:** `BRF-174_AG03_validacao-m11.md` (`T-164`)
- **Commit validado:** `24bd676` (branch `dev`) + specs desta validação (não commitados)
- **Escopo (Decisões #28/#29):** o jogo abre no `MenuHubScene`; a Vila saiu do fluxo; Forja, Personagem, Habilidades e Configurações bloqueados ("Em breve"); painel "Escolher dungeon" com a "Masmorra teste" (testArena); Inventário dentro do menu; todo fim de dungeon volta ao menu (`returnToHub`); `?test`/`?map`/`?biome`/`?seed` abrem a testArena direto; `SaveProfile.menuUnlocks`.
- **Rodadas:** **1 rodada completa** (Decisão #25); só o `m2-loot` foi repetido (falha de ambiente: "Timed out waiting 15000ms from config.webServer" na subida do preview) e passou.
- **Veredito:** **PASSA COM RESSALVAS** — *0 bloqueantes, 3 graves, 5 menores*. A suíte passa, mas 3 defeitos reais de `src/` estão provados por testes marcados como falha esperada (`test.fail`, ver Seção 3). Os graves não travam o jogo; o mais sério é **Almas e runs contadas em dobro na volta ao menu**. Recomendo uma task de ressalvas (T-165) antes da tag.

---

## 1. Resultados da rodada oficial

| Item | Resultado |
| :--- | :--- |
| `npm test` (Vitest) | **163/163** (23 arquivos) |
| `npm run build` (`tsc --noEmit` + `vite build`) | OK; `dist/` **4,3 MB**; `index-*.js` **1.822 kB** (gzip **439 kB**; no M10: 1.922/466 kB). Só o aviso de chunk > 500 kB |
| E2E `m1-dungeon` | 1/1 |
| E2E `m11-menu` (novo) | **13/13** (10 normais + 3 falhas esperadas, ver Seção 3), 2,6 min |
| E2E `m2-loot` | 1/1 (repetido: 1ª tentativa caiu na subida do servidor) |
| E2E `m5-hero` | 1/1 |
| E2E `m6-monsters` | 1/1 |
| E2E `m7-ui-landscape` | 3/3 |
| E2E `m8-biomes` | 11/11 |
| E2E `m8-dungeon-basic` | 3/3 |
| E2E `m8-ground-pickup` | 1/1 |
| E2E aposentados (`skip`) | `m3-hub` 1, `m4-campaign` 1 (stub), `m9-village` 4, `m10-prologue` 3, `m10-timing` 1 = **10 pulados** |
| Total E2E | **35 passam**, 10 pulados de propósito, 0 falhas. A `m4` já não gera o erro de ambiente do `campaign.json` (virou stub sem imports) |

Versão: `package.json` e `src/version.ts` seguem em `0.9.1` (M11 só vira tag junto do agrupamento do roadmap).

---

## 2. Testes antigos: o que foi reescrito e o que foi aposentado

Os E2E antigos entravam pela Vila (`__SUBMUNDO_HUB_DEBUG__`, `ensureHubScene`). Novo helper em `tests/e2e/helpers/landscape.ts`: `openAct1Run` (abre `/?test`, limpa o save e chama `restartRun(stageId)` do debug da DungeonScene), `waitForMenuHub`, `menuButtonPoint`.

| Spec | Decisão | Por quê / como |
| :--- | :--- | :--- |
| `m1-dungeon` | **Reescrito** (2 trechos) | Entrava no Ato 1 pelo `hub.enterDungeon`. Agora `openAct1Run(page)`. Mesmas asserções (5 salas, skills, Boss, 21 monstros). |
| `m2-loot` | **Reescrito** (2 trechos) | Idem. Loot, equipar, vitória e derrota seguem cobertos. |
| `m5-hero` | **Reescrito** | Partes 1-3 (herói "vivo", animações, andar) eram na Vila; passaram para a `mission_herbs` na DungeonScene (`__SUBMUNDO_DEBUG__.scene`). Partes 5-6 (Ato 1, herói espectro) entram por `openAct1Run`. Removidas as asserções de fase de campanha e de "Vila Natal Viva". Capturas `m5_pc_prologue_village.png`/`m5_pc_act1_refuge.png` passam a mostrar a dungeon (arquivos em tmp, não estão em `docs/qa`). |
| `m7-ui-landscape` | **Reescrito** (testes 2 e 3) | A raiz agora abre o menu: valida `rotate-overlay`, abre o Inventário **por clique/toque real** no botão "Inventário", captura e fecha com Escape. O teste 1 (estático, spritesheets/PWA/fontes) ficou igual. Perda: o teste não confere mais as texturas `ui_icons`/`portraits` em runtime (o menu não expõe a cena); a conferência estática de dimensões continua. |
| `m3-hub` | **Aposentado** (`describe.skip`) | Era o Altar, o Ferreiro e o Baú da Vila; Forja/Personagem estão bloqueados. Extração, morte punitiva e equipar do Baú passaram para a `m11-menu`. Reativar quando a Forja voltar. |
| `m4-campaign` | **Aposentado** (arquivo virou stub) | Todo o conteúdo era o prólogo antigo (`prologue_grotto/mine/seal`, Queda da Vila, Ferreiro). Já nem carregava (erro de ambiente do `campaign.json`). Histórico no Git. |
| `m9-village` | **Aposentado** (`describe.skip`) | Vila Natal, Mestre/Lyra/Gorran e portão saíram do fluxo. |
| `m10-prologue`, `m10-timing` | **Aposentados** (`describe.skip`) | Dependiam da Vila. O prólogo novo vem no M12. |
| `m6`, `m8-*` | Sem mudança | Já entram por `?test`/`?map`/`?biome`/`?seed`. |

---

## 3. Novo: `tests/e2e/m11-menu.spec.ts` (13 testes)

Técnica: as capturas e os avisos (toasts) são verificados por um **espião de texto** (`fillText`/`strokeText` do canvas), já que o menu não expõe a cena. Cliques/toques reais em coordenadas lógicas 960×540.

| # | Cenário | Resultado |
| :--- | :--- | :--- |
| 1 | PC `960×540`: abre no menu (`selected: masmorras`, `unlocked` = masmorras + inventário, painel aberto, sem dungeon); 4 bloqueados mostram "Em breve" e não abrem nada; Voltar fecha o painel; Inventário abre/fecha (X e Escape); "Masmorra teste" + Entrar abre a testArena | passa |
| 2 | Mobile `844×390` (toque): o mesmo fluxo | passa |
| 3 | `?test`, `?map=giant&seed=707`, `?biome=dungeon_basic`, `?seed=101` abrem a testArena direto | passa |
| 4 | Saves antigos: sem `menuUnlocks` (com Almas/Essências), `menuUnlocks` inválido, sem save, JSON corrompido → menu normal (só masmorras e inventário) | passa |
| 5 | Vitória do Ato 1 (via menu → `restartRun`): Enter volta ao menu, aviso "Vitória! +N Almas…", item extraído 1×, save antes do menu correto | passa |
| 6 | **Almas e runs entram no perfil UMA vez** | **falha esperada** (G1) |
| 7 | Derrota do Ato 1: aviso "Derrota. +N Almas salvas…", item da run perdido, `runsFailed` | passa |
| 8 | Missão do prólogo: botão "Voltar ao menu" aparece; Enter volta; "+0 Almas" (Decisão #27) | passa |
| 9 | **Masmorra teste: ao terminar volta ao menu** | **falha esperada** (G2) |
| 10 | Equipar item do Baú pelo menu (clique real) persiste no save | passa |
| 11 | **Mochila cheia 30/30**: Desequipar é bloqueado com o aviso "Baú cheio…", item continua equipado, nada some; equipar no slot vazio mantém o total de itens | passa |
| 12 | **Mochila cheia 30/30**: vitória com item novo volta ao menu sem erro; Baú nunca passa de 30; menu continua utilizável | passa (ver M3) |
| 13 | **Voltar e depois clicar em Masmorras reabre o painel** | **falha esperada** (G3) |

Os 3 `test.fail` passam enquanto o defeito existir e **viram vermelhos quando alguém corrigir**: aí é só remover a linha `test.fail(...)` do teste.

---

## 4. Defeitos

### Graves

**G1 — Almas, Essências e contadores de run entram em dobro na volta ao menu.**
`DungeonScene.ts:3491` já aplica o `RunEndReport` ao perfil e persiste; `MenuHubScene.ts:163` aplica o **mesmo** `fromRun` de novo ao abrir. Medido: começou com 100 Almas, a run rendeu 309, o menu mostra **718** (= 100 + 2×309; ver `m11_volta_dungeon_aviso.png`). `runsCompleted`/`bossesDefeated`/`runsFailed` também dobram. Os itens não duplicam porque `storeRunItems` ignora ids já guardados. Passos: abrir o menu → Masmorra teste → (debug) `restartRun('act1_submundo')` → vencer → Enter. Teste: `m11-menu` #6. Hoje só o Ato 1 e as missões geram relatório (a Masmorra teste não, ver G2), então no jogo normal ainda não aparece; vira real assim que houver dungeon pelo menu com relatório. Correção sugerida (AG04/AG02): aplicar em um lugar só (o menu **ou** a dungeon).

**G2 — A "Masmorra teste" não tem caminho de volta ao menu.**
Ao terminar, `DungeonScene.ts:3333/3354` (`restartTestArena`) mostra "Teste finalizado — Toque ou pressione Enter para reiniciar" e **reinicia a arena**; o herói é imortal na testArena (`:1603`, `:1621`), não há `RunEndReport` e o botão da HUD só aparece com a run encerrada. Único jeito de sair: recarregar a página. Isto contradiz "todo fim de dungeon volta ao menu" do BRF-174/Decisão #29. Também significa que Almas/itens da Masmorra teste **não** chegam ao perfil (itens pegos na testArena somem ao sair). Passos: Menu → Masmorra teste → chegar à zona do chefe e matar → Enter. Teste: `m11-menu` #9 (captura `m11_teste_finalizado.png`).

**G3 — Botão "Masmorras" morto depois de "Voltar".**
No painel "Escolher dungeon", "Voltar" fecha o painel (`MenuHubScene.ts:502`). Depois disso clique/toque em **Masmorras** não reabre (o estado fica `selected: masmorras`, `rightPanelOpen: false`); `select('masmorras')` (debug) funciona e clicar em Inventário e fechar também "destrava". Funciona no PC e no toque. Hipótese: `repaintButtons()` roda dentro do `pointerdown` do "Voltar", refazendo o botão interativo no mesmo quadro (`paintButton` empilha ainda um `on('pointerdown')` a cada repintura, `:347`). Teste: `m11-menu` #13.

### Menores

- **M1 — Layout "mobile" do menu é código morto.** O jogo é sempre 960×540 lógico, então `computeLayout` (`MenuHubScene.ts:196`, `h <= 420 || w/h > 2`) nunca ativa. No celular `844×390` vale o layout de PC reduzido pelo FIT (fator ≈0,72): botões de 50 px lógicos viram ≈36 px físicos, abaixo do alvo de toque de 44 px. Funciona (os testes de toque passam), mas é apertado.
- **M2 — Rótulo errado no fim do Ato 1.** O botão do painel de vitória/derrota do Ato 1 ainda diz "Nova Incursão" (`DungeonHud.ts:1214`) mas leva ao menu; só as missões dizem "Voltar ao menu". O Ato 1 não é acessível pelo menu hoje.
- **M3 — Baú cheio descarta item da run em silêncio.** Com 30/30, `storeRunItems` (`ProfileManager.ts:639`) ignora o item, e o aviso da volta ainda diz "N item(ns) obtido(s)" (`MenuHubScene.ts:599-602`, usa `keptItems`). Não quebra nada (o teste #12 confirma menu normal e Baú em 30), mas o jogador perde o item sem saber.
- **M4 — A Masmorra teste mostra o objetivo "A Plantação de Ervas — Sala 1/3".** O tracker da HUD vem do `currentStageId` da campanha (`m11_dungeon_teste_pc.png`). Parece herança do prólogo antigo; não afeta a jogabilidade.
- **M5 — O aviso "Baú cheio" é pouco visível** (toast pequeno no rodapé por 2,6 s, `m11_bau_cheio_aviso.png`). E o menu não expõe o toast/cena no debug (`getToast` ajudaria os testes).

Pendências antigas sem mudança: chunk > 500 kB; `m4` aposentada.

---

## 5. Capturas novas (`docs/qa/screenshots/m11_*`)

`m11_menu_pc`, `m11_menu_mobile`, `m11_painel_masmorras_pc/mobile`, `m11_em_breve_pc/mobile`, `m11_inventario_pc/mobile`, `m11_inventario_equipar`, `m11_inventario_cheio`, `m11_bau_cheio_aviso`, `m11_dungeon_teste_pc/mobile`, `m11_fim_dungeon_vitoria`, `m11_fim_missao_voltar_ao_menu`, `m11_volta_dungeon_aviso` (mostra as Almas em dobro), `m11_volta_bau_cheio`, `m11_teste_finalizado`. As specs `m1`, `m2` e `m7` regravaram suas capturas (`m1-*`, `m2-*`, `m7-*`); `m7` agora mostra o Inventário no menu em vez da Vila. Nenhuma captura de outro marco foi apagada.

---

## 6. Não verificado automaticamente

- Aparelho real (toque, tamanho dos botões, áudio do clique, orientação).
- Aparência do "Em breve" e do aviso de volta depois de 1,6 s / 4,2 s (só conferi o texto e a captura).
- Percurso da Masmorra teste até o chefe jogando de verdade (o teste #9 usa atalho: teletransporta aos gatilhos). Os E2E `m8` cobrem o percurso real.

## 7. Roteiro curto para o dono (aparelho real)

1. Abra o jogo: deve cair no **menu** com "Escolher dungeon" aberto à direita.
2. Toque em Forja, Personagem, Habilidades e Configurações: cada um mostra **"Em breve"** e nada abre.
3. Toque em **Voltar** no painel e depois em **Masmorras** (G3: provavelmente não reabre; abra o Inventário e feche para destravar).
4. Toque em **Inventário**: abre; equipe um item; feche no X.
5. Em **Masmorra teste → Entrar**, jogue até o fim e veja o que acontece em "Teste finalizado" (G2: reinicia a arena, não volta ao menu).
6. Abra o jogo com `?test` na URL: deve cair direto na arena.
7. Confira se as Almas do topo batem com o que o aviso de volta anunciou (G1: dobram quando há relatório).
8. Mochila cheia: com 30 itens no Baú, tente Desequipar um item e veja se o aviso "Baú cheio" é legível.

## 8. Próximo passo

Task de ressalvas T-165 (G1 AG04/AG02, G2 AG01, G3 AG02, M1-M5 ao gosto do líder), seguida de reteste só de `m11-menu` (remover os 3 `test.fail`), antes de versão/commit/PR/tag.
