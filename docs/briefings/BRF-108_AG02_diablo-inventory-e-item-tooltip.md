# BRF-108 — AG02 (UI) — T-108 `ItemTooltipCard.ts` + Novo `InventoryModal.ts` Estilo Diablo

**Leia:** [docs/agentes/AG02_UI.md](../agentes/AG02_UI.md), `assets/mockups/ref_diablo_item_tooltip.jpg`, `assets/mockups/ref_diablo_equipment_panel.jpg`, [src/view/ui/InventoryModal.ts](../../src/view/ui/InventoryModal.ts). **Regra:** respostas curtas; **PROIBIDO** editar `src/core/`, `DungeonHud.ts`, `HubHud.ts`, `tests/` ou executar `git`.

**Decisão do dono (Decisão #15):**
Inspecione as duas imagens de referência em `assets/mockups/ref_diablo_item_tooltip.jpg` e `assets/mockups/ref_diablo_equipment_panel.jpg` com `read_file` e implemente:

1. **Criar `src/view/ui/ItemTooltipCard.ts`:**
   - Card/modal de inspeção de item estilo Diablo (`depth: 1120`, `scrollFactor(0)`, responsivo em `800×600` e `360×640`, backdrop escuro clicável para fechar).
   - **Cabeçalho com gradiente/faixa colorida por raridade** (`legendary` cobre/laranja `#f97316`, `rare` dourado `#facc15`, `magic` azul `#60a5fa`, `common` aço `#94a3b8`), moldura metálica dupla chanfrada e emblema estrela/ornamento no topo + caveirinha/ornamento discreto na base.
   - **Nome do item** em destaque na cor da raridade + subtítulo (`Arma · Lendário`, etc.).
   - **Caixa quadrada do ícone** (`ui_icons` frame `12..15` conforme o `slot`, com fallback seguro `hasTextureFrame`) à esquerda + **Poder do Item** (número calculado deterministicamente a partir dos stats base + afixos + raridade) grande ao lado.
   - **Divisória ornamental `── ◇ ──`**.
   - **Stat principal destacado** (ex.: `+18 de Ataque`, `+12 de Defesa`, etc.).
   - **Lista de afixos** com marcador `◆` (losango) e indicador verde/vermelho comparando com o item atualmente equipado no mesmo slot (quando aplicável).
   - **Bloco de Poder Lendário** em laranja/âmbar (`★ Nome: descrição`) quando `item.legendaryPower` existir.
   - **Rodapé:** Força elemental (`Inferno` / `Submundo` / `Empíreo`) + **Botões `EQUIPAR` (ou `DESEQUIPAR` se já estiver equipado) e `FECHAR`**.
   - API pública limpa: `open(item, options: { isEquipped: boolean; equippedInSlot: ItemInstance | null; onEquip?: (id) => void; onUnequip?: (slot) => void })`, `close()`, `isOpen()`, `resize(viewport)`, `destroy()`.

2. **Refatorar `src/view/ui/InventoryModal.ts`:**
   - Seguir a estética de `assets/mockups/ref_diablo_equipment_panel.jpg`:
     - Cabeçalho ornamental **`EQUIPAMENTO`** com placa escura bronzeada + botão `X` vermelho no canto superior direito;
     - **4 Slots Equipados em grade quadrada 2×2** (`ARMA`, `ARMADURA`, `AMULETO`, `ANEL`): caixa quadrada metálica com fundo/borda na cor da raridade, losango/gema no topo, gema de raridade/força no canto inferior direito, ícone 2D `ui_icons` (`12..15`) grande e nítido no centro, rótulo do slot acima e nome curto abaixo. Tocar no slot abre o `ItemTooltipCard` (com `isEquipped: true` e opção `DESEQUIPAR`).
     - **Painel de Atributos com caveira ornamental no topo:** mostrando `Poder de Ataque`, `Armadura` (Defesa), `Vida` (e `Crítico %` / `Forças` de forma limpa).
     - **Mochila:**
       - No **PC (`800×600`)**: coluna esquerda = `EQUIPAMENTO` (2×2 + Painel de Atributos); coluna direita = `MOCHILA DA INCURSÃO` (grade de slots quadrados ou lista compacta limpa por raridade + paginação).
       - No **Mobile (`360×640`)**: abas limpas **`EQUIPAMENTO` | `MOCHILA (N)`** no topo para não espremer tudo numa tela só, deixando a visualização exatamente espaçosa e legível como na referência!
     - Tocar em qualquer item da mochila abre o `ItemTooltipCard` (comparando com o item equipado no mesmo slot e permitindo `EQUIPAR`).
   - Preservar 100% da API pública de `InventoryModal` (`open`, `close`, `isOpen`, `update`, `resize`, `destroy`) e fechar o `ItemTooltipCard` automaticamente ao fechar o `InventoryModal`.

**Permitido:** `src/view/ui/ItemTooltipCard.ts` (novo), `src/view/ui/InventoryModal.ts`.
**Proibido:** `src/core/`, `DungeonHud.ts`, `HubHud.ts`, `tests/`, e qualquer comando `git`.

**Entrega:** até 8 linhas: (1) arquivos criados/alterados, (2) aderência às duas referências em `360×640` e `800×600`, (3) revisão estática (`strict: true`).
