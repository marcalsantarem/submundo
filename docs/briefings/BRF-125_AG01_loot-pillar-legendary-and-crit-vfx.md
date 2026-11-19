# BRF-125 — AG01 (Gameplay): Pilar de Luz em Loots Lendários, Tag de Loot no Chão e Números `CRÍTICO!` em `Cinzel`

## Contexto
Com base na referência visual `assets/mockups/ref_landscape_hud.jpg` e na orientação explícita do dono do projeto:
- **REGRA INEGOCIÁVEL DO DONO:** O **pilar de luz vertical** no chão deve aparecer **EXCLUSIVAMENTE em itens Lendários (`item.rarity === 'legendary'`)**. Itens Comuns, Mágicos e Raros **NÃO** devem ter pilar de luz vertical (apenas o brilho sutil no chão + tag de nome).

## Arquivos sob sua posse
- `src/view/sprites/CombatVfx.ts`
- `src/view/scenes/DungeonScene.ts`

## Tarefas Obrigatórias
1. **Pilar de Luz Vertical (APENAS Lendários) e Tag de Loot no Chão (`src/view/scenes/DungeonScene.ts`):**
   - Inspecionar `GroundDrop`, `spawnGroundDrop`, coleta de drop e `clearGroundDrops`.
   - Para **TODOS** os itens dropados no chão: adicionar uma tag discreta acima do drop no formato `[Nome do Item (Raridade)]` (ex.: `[Montante das Cinzas (Lendário)]`), com fundo escuro translúcido (`0x090b10`, alpha `0.78`), texto colorido pela raridade (`legendary: '#f97316'`, `rare: '#facc15'`, `magic: '#60a5fa'`, `common: '#cbd5e1'`) em `DF_FONTS.BODY` (`'Segoe UI', 'Inter', system-ui, -apple-system, sans-serif`, `resolution: 2`).
   - **EXCLUSIVAMENTE quando `item.rarity === 'legendary'`:** desenhar um **pilar de luz vertical dourado/alaranjado** (`0xf97316` externo translúcido + `0xfde047` núcleo brilhante + `0xfffbeb` feixe central fino, altura ~`190px` subindo a partir do item com decaimento suave de alpha em camadas e pulsação sutil em tween), além de anel radiante no chão.
   - Garantir que `clearGroundDrops()` e a coleta do item destruam corretamente o pilar (quando existir), o tween e a tag de texto sem vazamento de memória nem objetos órfãos.
   - Aproveitar e atualizar o único `fontFamily: 'monospace'` remanescente em `DungeonScene.ts` (rótulo `'Portal Espectral'`) para `DF_FONTS.TITLE` com `resolution: 2`.
2. **Números de Dano e `CRÍTICO!` em `Cinzel` (`src/view/sprites/CombatVfx.ts`):**
   - Substituir todas as ocorrências de `fontFamily: 'monospace'` em `CombatVfx.ts` por `DF_FONTS.TITLE` (`'Cinzel', 'Palatino Linotype', 'Book Antiqua', Georgia, serif`) ou `DF_FONTS.BODY` com `resolution: 2`.
   - Em `spawnDamageNumber` (quando `isCrit === true`): renderizar o texto dourado **`CRÍTICO!`** (em `Cinzel`, bold, `#f3e6cc`/`#fde047`, contorno escuro) logo acima do número de dano ampliado em dourado/creme (`#fef08a`) com leve efeito pop de escala, seguindo a estética de `assets/mockups/ref_landscape_hud.jpg`.
   - Manter formatação limpa com separador `.` para números grandes (ou `formatStatNumber` de `DarkFantasyUiBuilder.ts`).

## Restrições
- **ATENÇÃO:** Verificar duas vezes que o pilar de luz vertical só é criado se `item.rarity === 'legendary'`.
- Compatibilidade total com `strict: true` do TypeScript.
- **PROIBIDO** executar comandos `git`.
