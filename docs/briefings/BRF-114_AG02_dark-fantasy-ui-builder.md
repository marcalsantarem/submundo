# BRF-114 — AG02 (UI): Construtor Reutilizável de UI 2D Dark Fantasy (`src/view/ui/DarkFantasyUiBuilder.ts`)

## Contexto
Conforme a Decisão #16, todas as telas de UI do SUBMUNDO (Inventário, Cards de Item, Ferreiro, Altar de Almas, Diálogos, DungeonHud e HubHud) devem compartilhar a mesma identidade visual **Arte 2D estilizada Dark Fantasy** aprovada no painel `EQUIPAMENTO` de 6 slots e no `ItemTooltipCard` estilo Diablo, rodando exclusivamente em **Modo Paisagem (`960×540`, `16:9`)**.

## Arquivo sob sua posse
- `src/view/ui/DarkFantasyUiBuilder.ts` (criar novo arquivo)

## Especificações Obrigatórias
Exportar um módulo limpo, tipado (`strict: true`, zero `any`, zero `monospace`), pronto para ser importado por todas as UIs do jogo:

1. **Tipografia (`DF_FONTS`):**
   - `TITLE = "'Cinzel', 'Palatino Linotype', 'Book Antiqua', Georgia, serif"`
   - `BODY = "'Segoe UI', 'Inter', system-ui, -apple-system, sans-serif"`
2. **Paleta & Temas de Raridade (`DF_PALETTE`, `DF_RARITY_THEME`, `DF_FORCE_THEME`):**
   - Fundo obsidiana escuro (`0x0c0e14`), superfície interna (`0x141822`), moldura metálica externa (`0x4b5563` / `0x8a7048`), ouro envelhecido (`0xd4a95a`), texto pergaminho (`#f3e6cc`, `#e2e8f0`, `#94a3b8`).
   - `DF_RARITY_THEME: Record<Rarity, RarityVisualTheme>` para `common`, `magic`, `rare`, `legendary` com: `label`, `hex`, `border`, `innerBorder`, `headerBg`, `headerGlow`, `slotBg`, `gemColor`, `accentHex`.
   - `DF_FORCE_THEME: Record<ForceType, { label: string; hex: string; color: number }>`.
3. **Metadados dos 6 Slots (`DF_EQUIP_SLOT_ORDER`, `DF_SLOT_META`):**
   - Ordem canônica 2×3: `['helm', 'weapon', 'armor', 'amulet', 'boots', 'ring']`.
   - `DF_SLOT_META: Record<EquipSlot, SlotVisualMeta>` contendo:
     - `labelUpper`: `'ELMO' | 'ARMA' | 'ARMADURA' | 'AMULETO' | 'BOTA' | 'ANEL'`
     - `labelTitle`: `'Elmo' | 'Arma' | 'Armadura' | 'Amuleto' | 'Bota' | 'Anel'`
     - `iconFrame`: `weapon: 12, armor: 13, amulet: 14, ring: 15, helm: 16, boots: 17` (alinhado a `public/assets/sprites/manifest.json`)
     - `typeByRarity: Record<Rarity, string>` (ex.: `'Arma de Duas Mãos Lendária'`, `'Armadura de Peito Rara'`, `'Elmo Mágico'`, `'Botas Raras'`, etc.).
4. **Funções Construtoras 2D Reutilizáveis (Phaser Graphics & Text):**
   - `getChamferPoints(x, y, w, h, bevel)`
   - `drawOrnatePanel(gfx, opts)`: desenha janela/modal 2D Dark Fantasy com sombra projetada, corpo obsidiana chanfrado, faixa opcional de cabeçalho com degradê em degraus suaves, moldura externa metálica dupla, linha interna dourada/bronze e ornamentos de canto (losangos/rebites).
   - `drawRaritySlotFrame(gfx, opts)`: desenha caixa de slot 2D com moldura escura externa, moldura interna na cor da raridade, chanfros triangulares laterais, losango de gema no topo central e engaste circular de gema no canto inferior direito (igual ao mockup aprovado).
   - `drawOrnamentalDivider(gfx, x, y, width, color?)`: linha metálica horizontal com losango central vazado.
   - `drawSkullCrest(gfx, x, y, scale?, tint?)`: emblema vetorial 2D limpo de crânio com ornamentos laterais (usado na placa de atributos e cards Raro/Mágico).
   - `drawStarCrest(gfx, x, y, scale?, fillColor?, strokeColor?)`: emblema vetorial 2D de estrela de 8 pontas em moldura metálica (usado no topo de cards Lendários).
   - `drawOrnateButton(gfx, x, y, w, h, opts)`: botão chanfrado 2D metálico com brilho superior, borda dourada/carmesim/azul e suporte a estado desabilitado/hover.
   - `createTitleText(scene, x, y, text, opts?)` e `createBodyText(scene, x, y, text, opts?)`: fábricas de `Phaser.GameObjects.Text` com `resolution: 2` e estilo consistente.
   - `formatStatNumber(value)`: formata inteiros com separador de milhar `.` (ex.: `1.420`, `3.200`).
   - `hasUiTextureFrame(scene, key, frame)`: verificação segura de frame em textura carregada.

## Restrições
- Não importar nada que quebre `strict: true`.
- Não editar outros arquivos nesta task (apenas criar `src/view/ui/DarkFantasyUiBuilder.ts`).
- **PROIBIDO** executar comandos `git`.
