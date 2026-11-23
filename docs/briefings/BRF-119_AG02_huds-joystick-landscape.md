# BRF-119 — AG02 (UI): Reposicionamento de `DungeonHud.ts`, `VirtualJoystick.ts` e `HubHud.ts` para Paisagem Exclusivo (`960×540`, 2 Mãos)

## Contexto
Conforme a Decisão #16, o jogo agora opera exclusivamente em **Modo Paisagem (`960×540`, `16:9`)** e no mobile é jogado com **as duas mãos**. Além disso, `src/view/ui/DarkFantasyUiBuilder.ts` fornece a paleta, tipografia (`Cinzel` + Sans, `resolution: 2`) e utilitários 2D Dark Fantasy unificados.

## Arquivos sob sua posse
- `src/view/ui/VirtualJoystick.ts`
- `src/view/ui/DungeonHud.ts`
- `src/view/ui/HubHud.ts`

## Tarefas Obrigatórias
1. **Eliminar todos os ramos `mobile_portrait`:** `ViewportMode` agora é exclusivamente `'landscape'` (`960×540`).
2. **Consumir `DarkFantasyUiBuilder.ts`:** usar `DF_FONTS`, `DF_PALETTE`, `drawOrnatePanel`, `drawOrnateButton`, `drawOrnamentalDivider` e zero `monospace`.
3. **`src/view/ui/VirtualJoystick.ts` (Ergonomia Polegar Esquerdo em `960×540`):**
   - Zona de ativação flutuante em toda a **metade esquerda da tela** (`x <= width * 0.46`, `y >= 90`) — nunca interferindo com os botões de combate do lado direito nem com a barra superior.
   - Indicador translúcido discreto ancorado no canto inferior esquerdo (`x = 96, y = height - 96`, raio base `46`, raio knob `20`) com anel metálico bronze/aço Dark Fantasy e brilho sutil ao arrastar.
   - Sempre disponível para toque/arraste no lado esquerdo (funciona em mobile paisagem 2 mãos e não interfere com `WASD`/Setas no PC).
4. **`src/view/ui/DungeonHud.ts` (Layout Paisagem 2 Mãos `960×540`):**
   - **Topo Esquerdo:** Retrato circular `64×64` (frame `hero_living`/`hero_wraith` com máscara circular e anel metálico), badge de nível, nome em `Cinzel`, barra de HP metálica (`188×18`) e tracker compacto de objetivo/sala logo abaixo.
   - **Topo Centro:** Barra de HP de Boss (quando em sala de boss) + banner narrativo/status elegante com `drawOrnatePanel`.
   - **Topo Direito:** Minimapa circular (`r = 42`), pílulas de Almas e Essências com ícones `ui_icons`, e trio de botões utilitários circulares (`AUTO`, `Mochila` com badge de itens, `Áudio/Mute`) bem espaçados sem invadir o topo centro.
   - **Inferior Esquerdo:** Espaço livre para o `VirtualJoystick` (polegar esquerdo).
   - **Inferior Direito (Polegar Direito):** Botão principal de Ataque (`r = 38`, em `x = width - 82, y = height - 82`) cercado pelo arco ergonômico dos 4 botões de ação (`Dash`, `Skill 1`, `Skill 2`, `Poção`, `r = 25`, raio do arco ~`96px`), com cooldown radial suave, cargas de poção e etiquetas de atalho (`SPACE`, `1`, `2`, `Q`).
   - **Modal de Fim de Run (Vitória/Derrota):** Estilizado com `drawOrnatePanel`, `drawOrnamentalDivider` e `drawOrnateButton` de `DarkFantasyUiBuilder.ts`.
5. **`src/view/ui/HubHud.ts` (Layout Paisagem 2 Mãos `960×540`):**
   - **Barra Superior:** Título da área (`Vila Natal` / `Refúgio do Submundo`) em `Cinzel` à esquerda; Almas, Essências e `Equip: X/6 | Baú: Y` ao centro/direita; botões `Áudio` e `Resetar` no canto superior direito.
   - **Inferior Esquerdo:** Espaço limpo para o `VirtualJoystick` (polegar esquerdo).
   - **Inferior Direito:** Cluster organizado de botões chanfrados 2D (`Altar`, `Ferreiro`, `Inventário`, `Fenda/Entrar`) e botão contextual `Interagir [E]` acima deles quando perto de um NPC/estação.

## Restrições
- Compatibilidade estrita com TypeScript `strict: true` (zero referências a `'mobile_portrait'`).
- **PROIBIDO** executar comandos `git`.
