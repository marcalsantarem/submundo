# BRF-124 — AG02 (UI): Polimento Fino do HUD Paisagem e D-Pad Translúcido (`ref_landscape_hud.jpg`)

## Contexto
O dono enviou `assets/mockups/ref_landscape_hud.jpg` como referência direta para o acabamento final do HUD paisagem (`960×540`, `16:9`) — mantendo o visual enxuto da Decisão #14 (**sem** Loja, Passe ou Chat).

## Arquivos sob sua posse
- `src/view/ui/DungeonHud.ts`
- `src/view/ui/VirtualJoystick.ts`

## Especificações Obrigatórias (Inspecione `assets/mockups/ref_landscape_hud.jpg` via `read_file` antes de editar)
1. **Cluster de Combate Inferior Direito (`DungeonHud.ts`):**
   - **Botão Principal `Ataque`:** círculo maior (`r = 42`, posição `x = w - 92, y = h - 104`), anel duplo metálico escuro + anel brilhante alaranjado/bronze (`0xf97316` / `0xd4a95a`), ícone `ui_icons` frame `0` centralizado levemente acima e rótulo `Ataque` em `DF_FONTS.TITLE` (`Cinzel`, `resolution: 2`) na parte inferior interna do círculo.
   - **Botão `Esquiva` (`dash`):** posicionado no canto inferior direito **abaixo** do botão de Ataque (`r = 22`, `x = w - 42, y = h - 38`), com ícone da bota (`ui_icons` frame `1`), cooldown radial escuro e texto limpo `Esquiva` alinhado à esquerda do botão (`x = -22 - 8`, origin `(1, 0.5)`) — exatamente como no mockup!
   - **Poção (`potion`):** à esquerda-inferior do botão de Ataque (`r = 24`, `x = atkX - 88, y = atkY + 38`) com ícone do frasco vermelho (`ui_icons` frame `5`) e badge de cargas nítido.
   - **Skills Ativas (`active_1` e `active_2`):** dispostas em arco limpo ao redor do topo-esquerdo do botão de Ataque:
     - `active_1`: `r = 26`, `x = atkX - 94, y = atkY - 30`
     - `active_2`: `r = 26`, `x = atkX - 38, y = atkY - 94`
     - Ambas com anel metálico escuro, cooldown radial escuro translúcido e contador grande legível (`3s`, `5s`) centralizado em `DF_FONTS.TITLE` (`resolution: 2`).
   - Manter a compatibilidade dos atalhos de teclado (`SPACE`, `1`, `2`, `Q`) em pílulas discretas ou integradas sem poluir.
2. **D-Pad / Joystick Virtual Translúcido (`VirtualJoystick.ts`):**
   - Estilizar o estado de repouso (ancorado em `x = 104, y = h - 104`, raio `54`) exatamente como no mockup: círculo translúcido escuro com anel externo fino claro translúcido, anel interno sutil, **4 setas triangulares direcionais sutis** apontando para Cima, Baixo, Esquerda e Direita, e botão circular central translúcido (`r = 18`) que acompanha suavemente o arraste do polegar esquerdo (ativação flutuante na metade esquerda `x <= w * 0.46`, `y >= 90`).
3. **Topo Esquerdo Limpo (`DungeonHud.ts`):**
   - Retrato circular (`r = 32`) com moldura metálica dupla ornamentada + badge `Nv. 1` na base do retrato, nome do herói em `Cinzel` (`GUERREIRO`), barra de HP vermelha metálica e barra secundária âmbar fina abaixo.
   - Tracker de Missão/Objetivo logo abaixo do frame do herói em estilo **limpo e aberto (sem caixa fechada pesada)**: losango dourado ornamentado (`◆`) + título em `Cinzel` (`Campanha` / nome do estágio) + objetivo da sala em `DF_FONTS.BODY` + linha divisória fina abaixo.
4. **Topo Direito Limpo (`DungeonHud.ts`):**
   - Minimapa circular maior (`r = 46`) no canto superior direito (`x = w - 60, y = 60`).
   - Contadores de **Almas** e **Essências** em linha limpa à esquerda do minimapa (`y = 26`, ícone 2D + número nítido com contorno escuro, sem pílulas pesadas).
   - Trio de botões circulares escuros metálicos alinhados logo abaixo do minimapa (`y = 128`, `r = 18`):
     - `AUTO` (texto `AUTO` dentro do círculo)
     - `Inventário` (ícone de mochila `ui_icons` frame `6` + badge de itens + texto `Inventário` limpo abaixo)
     - `Áudio` (ícone de áudio `ui_icons` frame `8`/`9` + texto `Áudio` limpo abaixo)
   - Preservar `bagBtnContainer` e assinaturas públicas para não quebrar `DungeonScene.ts` nem `tests/e2e/`.

## Restrições
- Zero `'monospace'` e zero `'mobile_portrait'`.
- Consumir `DarkFantasyUiBuilder.ts` e garantir conformidade estrita com TypeScript `strict: true`.
- **PROIBIDO** executar comandos `git`.
