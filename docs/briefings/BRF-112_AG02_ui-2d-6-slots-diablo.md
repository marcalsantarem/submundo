# BRF-112 — AG02 (UI): Painel de Equipamento 6 Slots (2×3) e Tipografia/Visual 2D Dark Fantasy (Zero Aspecto Pixel Art)

## Contexto
O dono determinou duas correções fundamentais na `T-108` (Decisão #14 e Decisão #15):
1. **As telas de UI não são Pixel Art:** Modais, cards de item e o painel de inventário devem ter acabamento **Arte 2D estilizada Dark Fantasy de alta definição** — sem fontes `monospace`/pixeladas e sem visual blocudo.
2. **6 Tipos de Equipamento:** `weapon` (Arma), `armor` (Armadura), `helm` (Elmo), `boots` (Bota), `amulet` (Amuleto) e `ring` (Anel), organizados em grade **2 colunas × 3 linhas** no painel `EQUIPAMENTO` conforme `assets/mockups/ref_diablo_equipment_panel.jpg`.

## Arquivos sob sua posse
- `src/view/ui/ItemTooltipCard.ts`
- `src/view/ui/InventoryModal.ts`
- `src/view/ui/BlacksmithModal.ts`
- `src/view/ui/AltarModal.ts`
- `src/view/ui/DialogueBox.ts`
- `src/view/ui/HubHud.ts`
- `src/view/scenes/HubScene.ts`

## Especificações Obrigatórias

### 1. Tipografia e Estilo 2D Dark Fantasy (Zero `monospace` nas telas de UI)
- Definir e usar em todos os modais e cards:
  - `FONT_TITLE = "'Cinzel', 'Palatino Linotype', 'Book Antiqua', Georgia, serif"` para títulos de janelas (`EQUIPAMENTO`, `MOCHILA`, `FERREIRO`, `ALTAR DE ALMAS`), nomes de itens nos cards (`MACHADO DA FÚRIA`), números de Poder do Item (`725`) e nomes de NPCs.
  - `FONT_BODY = "'Segoe UI', 'Inter', system-ui, -apple-system, sans-serif"` para subtítulos de tipo/raridade, atributos primários, afixos (`+45 de Força`), aspectos lendários, botões e descrições.
- Substituir todas as ocorrências de `fontFamily: 'monospace'` em `ItemTooltipCard.ts`, `InventoryModal.ts`, `BlacksmithModal.ts`, `AltarModal.ts`, `DialogueBox.ts` e `HubHud.ts` por `FONT_TITLE` ou `FONT_BODY` com `resolution: 2` nos textos Phaser para máxima nitidez 2D.

### 2. Suporte aos 6 Slots em `ItemTooltipCard.ts`
- Mapear todos os 6 slots (`EquipSlot`: `'weapon' | 'armor' | 'helm' | 'boots' | 'amulet' | 'ring'`):
  - Frames em `ui_icons` (`64×64`, 18 frames, conforme `public/assets/sprites/manifest.json`):
    - `weapon`: `12`
    - `armor`: `13`
    - `amulet`: `14`
    - `ring`: `15`
    - `helm`: `16`
    - `boots`: `17`
  - Subtítulos de tipo por raridade (`SLOT_TYPE_LABELS`):
    - `weapon`: `Arma Comum` / `Arma Mágica` / `Arma Rara` / `Arma de Duas Mãos Lendária`
    - `armor`: `Armadura de Peito Comum` / `Armadura de Peito Mágica` / `Armadura de Peito Rara` / `Armadura de Peito Lendária`
    - `helm`: `Elmo Comum` / `Elmo Mágico` / `Elmo Raro` / `Elmo Lendário`
    - `boots`: `Botas Comuns` / `Botas Mágicas` / `Botas Raras` / `Botas Lendárias`
    - `amulet`: `Amuleto Comum` / `Amuleto Mágico` / `Amuleto Raro` / `Amuleto Lendário`
    - `ring`: `Anel Comum` / `Anel Mágico` / `Anel Raro` / `Anel Lendário`
  - Atributo principal abaixo do 1º divisor ornamental:
    - `weapon`: `${primaryVal} de Dano por Segundo`
    - `armor`, `helm`, `boots`: `${primaryVal} de Armadura`
    - `amulet`: `+${primaryVal} de Vida Máxima`
    - `ring`: `+${primaryVal}% de Chance de Acerto Crítico`

### 3. Grade 2×3 de 6 Slots em `InventoryModal.ts` (`EQUIPAMENTO`)
- Ordem exata da grade **2 colunas × 3 linhas** no painel `EQUIPAMENTO` (conforme `assets/mockups/ref_diablo_equipment_panel.jpg`):
  - Linha 1: `helm` (`ELMO` / `Elmo`) | `weapon` (`ARMA` / `Arma`)
  - Linha 2: `armor` (`ARMADURA` / `Armadura`) | `amulet` (`AMULETO` / `Amuleto`)
  - Linha 3: `boots` (`BOTA` / `Bota`) | `ring` (`ANEL` / `Anel`)
- Cada slot (`66×66` no PC, `74×74` no Mobile) exibe:
  - Rótulo superior em caixa alta colorido pela raridade equipada (`ELMO`, `ARMA`, `ARMADURA`, `AMULETO`, `BOTA`, `ANEL`).
  - Moldura dupla chanfrada 2D com fundo de raridade, losango de gema no topo da moldura, ícone 2D suave (`ui_icons` frames `16, 12, 13, 14, 17, 15`), chanfros laterais e engaste de gema no canto inferior direito.
  - Sub-rótulo inferior (`Elmo`, `Arma`, `Armadura`, `Amuleto`, `Bota`, `Anel`).
- Abaixo da grade 2×3, exibir a placa ornamental com crânio centralizado no topo e os 3 atributos consolidados:
  - `Poder de Ataque: X`
  - `Armadura: Y`
  - `Vida: Z`
- Ao clicar ou passar o mouse em qualquer um dos 6 slots equipados ou nos 16 slots da mochila, atualizar o `ItemTooltipCard` (e card de comparação `"EQUIPADO ATUALMENTE"` quando houver item equipado no mesmo slot).

### 4. Compatibilidade de 6 Slots em `BlacksmithModal.ts` e `HubScene.ts`
- Atualizar mapas/listas de `EquipSlot` em `BlacksmithModal.ts` e `HubScene.ts` para incluir `helm` (Elmo, frame `16`) e `boots` (Bota, frame `17`).

## Restrições
- Não importar Phaser em `src/core/`.
- Manter compatibilidade com `strict: true` do TypeScript.
- **PROIBIDO** executar comandos `git`.
