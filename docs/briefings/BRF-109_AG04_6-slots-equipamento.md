# BRF-109 — AG04 (Sistemas/Meta) — T-108a Expandir Equipamentos de 4 para 6 Slots (`weapon`, `armor`, `helm`, `boots`, `amulet`, `ring`)

**Leia:** [docs/agentes/AG04_Sistemas_Meta.md](../agentes/AG04_Sistemas_Meta.md), [src/core/index.ts](../../src/core/index.ts), [src/core/loot/Inventory.ts](../../src/core/loot/Inventory.ts), [src/core/loot/LootGenerator.ts](../../src/core/loot/LootGenerator.ts), [src/core/progression/ProfileManager.ts](../../src/core/progression/ProfileManager.ts), [src/data/items.json](../../src/data/items.json), [src/data/affixes.json](../../src/data/affixes.json). **Regra:** respostas curtas; **PROIBIDO** editar `src/view/` ou executar `git`.

**Decisão do dono (Decisão #15):** O jogo agora possui **6 tipos de equipamentos**: **Arma (`weapon`), Armadura (`armor`), Elmo (`helm`), Bota (`boots`), Amuleto (`amulet`), Anel (`ring`)**.

**Fazer:**
1. **`src/core/index.ts`:** atualizar `export type EquipSlot = 'weapon' | 'armor' | 'helm' | 'boots' | 'amulet' | 'ring';`.
2. **`src/core/loot/Inventory.ts`, `src/core/loot/LootGenerator.ts` e `src/core/progression/ProfileManager.ts`:**
   - Atualizar todas as listas `EQUIP_SLOTS` para `['weapon', 'armor', 'helm', 'boots', 'amulet', 'ring']`.
   - Em `createRunInventory()` e `createDefaultProfile()` / `loadOrCreateProfile()`, garantir inicialização e normalização segura de `helm: null` e `boots: null` (retrocompatível com saves de 4 slots).
3. **`src/data/items.json`:**
   - Adicionar 4 itens base para `"slot": "helm"` (ex.: Elmo de Couro, Elmo de Ferro Escuro, Elmo do Destruidor, Coroa Espectral — focados em `maxHp` e `defense`) e 4 itens base para `"slot": "boots"` (ex.: Botas de Couro, Grevas de Ferro, Passos da Brasa, Grevas Espectrais — focados em `moveSpeed`, `defense` e `maxHp`).
4. **`src/data/affixes.json`:**
   - Incluir `"helm"` nos afixos onde `"armor"` é permitido, e incluir `"boots"` nos afixos defensivos/velocidade/utilidade (garantindo que `helm` e `boots` tenham amplo pool de afixos nas 3 Forças).
   - Se houver poderes lendários em `affixes.json` com `slot`, manter compatível ou permitir `helm`/`boots`.
5. **`tests/core/architecture.test.ts` e `tests/core/loot.test.ts`:**
   - Atualizar asserções de `EquipSlot` para os 6 slots e validar geração/equipamento de `helm` e `boots`.

**Permitido:** `src/core/index.ts`, `src/core/loot/`, `src/core/progression/`, `src/data/items.json`, `src/data/affixes.json`, `tests/core/architecture.test.ts`, `tests/core/loot.test.ts`.
**Proibido:** `src/view/`, e qualquer comando `git`.

**Entrega:** até 6 linhas: arquivos atualizados e validação JSON/estática (`strict: true`).
