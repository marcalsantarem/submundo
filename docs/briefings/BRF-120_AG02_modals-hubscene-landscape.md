# BRF-120 — AG02 (UI): Modais 2D Dark Fantasy e `HubScene` em Modo Paisagem Exclusivo (`960×540`)

## Contexto
Conforme a Decisão #16, o jogo agora opera exclusivamente em **Modo Paisagem (`960×540`, `16:9`)** com identidade 2D Dark Fantasy unificada em `src/view/ui/DarkFantasyUiBuilder.ts`. Com `960×540` de largura em todas as plataformas, **não precisamos mais de abas mobile apertadas** — todos os modais usam layouts horizontais amplos, limpos e confortáveis ao toque e ao mouse!

## Arquivos sob sua posse
- `src/view/ui/ItemTooltipCard.ts`
- `src/view/ui/InventoryModal.ts`
- `src/view/ui/BlacksmithModal.ts`
- `src/view/ui/AltarModal.ts`
- `src/view/ui/DialogueBox.ts`
- `src/view/scenes/HubScene.ts`

## Tarefas Obrigatórias
1. **Eliminar 100% dos ramos `mobile_portrait`:** `ViewportMode` agora é exclusivamente `'landscape'` (`960×540`).
2. **Consumir `src/view/ui/DarkFantasyUiBuilder.ts` em todos os arquivos:**
   - Importar `DF_FONTS`, `DF_PALETTE`, `DF_RARITY_THEME`, `DF_FORCE_THEME`, `DF_EQUIP_SLOT_ORDER`, `DF_SLOT_META`, `drawOrnatePanel`, `drawRaritySlotFrame`, `drawOrnamentalDivider`, `drawSkullCrest`, `drawStarCrest`, `drawOrnateButton`, `formatStatNumber`, `hasUiTextureFrame`.
   - Zero `monospace` em todos os arquivos.
3. **`src/view/ui/ItemTooltipCard.ts` (Paisagem `960×540`):**
   - Manter o visual Diablo Dark Fantasy aprovado (cabeçalho de raridade, emblema estrela/crânio, caixa do ícone 2D `ui_icons` frames `12..17`, Poder do Item em destaque, divisor ornamental, atributo primário por slot, afixos `◆` com deltas verde/vermelho, aspecto lendário `★`, Nível Requerido e crânio no rodapé).
   - Em `960×540`, quando inspecionando um item da mochila com outro já equipado no mesmo slot, exibir os dois cards lado a lado (`Item Inspecionado` à esquerda e `"EQUIPADO ATUALMENTE"` à direita) com total legibilidade e botões `EQUIPAR` / `FECHAR` grandes o suficiente para toque.
4. **`src/view/ui/InventoryModal.ts` (Paisagem `960×540` sem abas):**
   - Painel principal amplo (`880×486` centralizado em `960×540`) usando `drawOrnatePanel`:
     - **Coluna Esquerda (`EQUIPAMENTO`, largura ~360px):** Grade **2 colunas × 3 linhas** dos **6 slots** (`ELMO | ARMA`, `ARMADURA | AMULETO`, `BOTA | ANEL`) com caixas `70×70` (`drawRaritySlotFrame` + ícone `ui_icons` `12..17` + rótulo superior colorido + sub-rótulo inferior), e abaixo a placa ornamental com `drawSkullCrest` exibindo `Poder de Ataque`, `Armadura` e `Vida`.
     - **Coluna Direita (`MOCHILA`, largura ~470px):** Grade `4×4` (16 slots grandes e clicáveis/tocáveis com ícone 2D, borda de raridade, Poder do Item e indicador `▲`/`▼` de upgrade), barra de paginação se necessário e legenda discreta das 3 Forças ativas.
   - Suportar clique/toque (fixa o `ItemTooltipCard` com botões) e hover no mouse (preview lateral não-bloqueante).
5. **`src/view/ui/BlacksmithModal.ts` e `src/view/ui/AltarModal.ts` (Paisagem `960×540`):**
   - Layout paisagem amplo (`860×470` no Ferreiro em 2 colunas: Aprimorar Itens dos 6 slots à esquerda + Forjar Relíquias à direita; `780×460` no Altar de Almas com lista limpa das bênçãos) usando `DarkFantasyUiBuilder.ts`.
6. **`src/view/ui/DialogueBox.ts` (Paisagem `960×540`):**
   - Caixa narrativa inferior elegante (`820×148` posicionada na base da tela `960×540`), retrato 2D `128×128` em moldura ornamentada à esquerda, nome do personagem em `Cinzel`, fala em sans-serif nítida e botão `Continuar`/`Fechar` à direita.
7. **`src/view/scenes/HubScene.ts` (Paisagem `960×540`):**
   - Remover todos os ramos `mobile_portrait`, unificar `worldZoom = 1.45`, usar `960×540` como dimensões padrão da vila/refúgio e distribuir confortavelmente os 4 NPCs/estações (Altar/Mestre, Ferreiro, Baú/Vendedora, Portal/Portão) no mapa paisagem `960×540` com os 6 slots preservados.

## Restrições
- Compatibilidade estrita com TypeScript `strict: true` (zero `'mobile_portrait'`).
- **PROIBIDO** executar comandos `git`.
