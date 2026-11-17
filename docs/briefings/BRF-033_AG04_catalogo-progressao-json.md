# BRF-033 — AG04 — T-031 Catálogo JSON de progressão do Altar e Ferreiro

**Leia:** `docs/agentes/AG04_Sistemas_Meta.md`, `docs/GDD_Submundo.md`, `src/data/items.json`. **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono:** Autorização explícita da `T-031` (M3 `v0.3.0`).
**Contrato (`ProgressionCatalog` em `src/data/progression.json`):**
- `altarUpgrades` (array com os 5 IDs canônicos):
  - `vitality` (Vida Máxima permanente, ex.: `+20 maxHp/nível`, `maxLevel: 5`, `baseSoulCost: 30`, `costMultiplier: 1.6`)
  - `might` (Ataque permanente, ex.: `+3 attack/nível`, `maxLevel: 5`, `baseSoulCost: 35`, `costMultiplier: 1.65`)
  - `bastion` (Defesa permanente, ex.: `+2 defense/nível`, `maxLevel: 5`, `baseSoulCost: 30`, `costMultiplier: 1.6`)
  - `swiftness` (Velocidade e Recarga, ex.: `+8 moveSpeed`, `+0.02 cooldownReduction` por nível, `maxLevel: 5`, `baseSoulCost: 40`, `costMultiplier: 1.7`)
  - `fortune` (Crítico e Sorte, ex.: `+0.02 critChance`, `+0.05 luck` por nível, `maxLevel: 5`, `baseSoulCost: 40`, `costMultiplier: 1.7`)
- `blacksmithUpgrade`: `{ "maxLevel": 5, "baseSoulCost": 40, "costPerLevel": 35, "attackBonusPerLevel": 3, "hpBonusPerLevel": 12, "defenseBonusPerLevel": 2 }`
- `blacksmithForge`: lista de 2 receitas:
  - `forge_rare`: Raro aleatório (`essenceCost: 0`, `soulCost: 80`, `rarity: "rare"`)
  - `forge_legendary`: Relíquia Lendária (`essenceCost: 1`, `soulCost: 120`, `rarity: "legendary"`)
**Fazer:** Criar `src/data/progression.json` válido conforme contrato acima.
**Permitido:** `src/data/progression.json`.
**Proibido:** `src/core/`, `src/view/`, `tests/` e comandos git.
**Pronto quando:** JSON válido e `npm test` verde.
**Entrega:** até 5 linhas: receitas/upgrades criados e verificação de validade.
