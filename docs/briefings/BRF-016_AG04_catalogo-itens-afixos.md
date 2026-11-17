# BRF-016 — AG04 — T-015 Catálogo JSON de Equipamentos Base, Afixos e Poderes Lendários

**Leia:** `docs/agentes/AG04_Sistemas_Meta.md`, `docs/GDD_Submundo.md` (seções 4 e 5). **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono:** Decisão #5 (M2 `v0.2.0`).
**Contrato (compatível com `src/core/index.ts` do BRF-014):**
- `src/data/items.json`: array de `ItemDef` com pelo menos 12 itens base cobrindo os 4 slots (`weapon`, `armor`, `amulet`, `ring`) e as forças (`inferno`, `submundo`, `empireo`, `none`):
  - Cada item: `{ id, name, slot, force, baseBonuses, iconKey, description }`.
  - `iconKey`: `'icon_weapon' | 'icon_armor' | 'icon_amulet' | 'icon_ring'`.
  - `baseBonuses`: subconjunto de `{ maxHp, attack, defense, moveSpeed, attackRange, cooldownReduction, critChance, critMultiplier, lifeSteal, luck }` (usando porcentagens decimais como `0.08` para `+8%` e valores absolutos para `maxHp`, `attack`, `defense`, `moveSpeed`, `attackRange`).
- `src/data/affixes.json`: objeto `{ affixes: AffixDef[], legendaryPowers: LegendaryPowerDef[] }`:
  - Pelo menos 16 afixos variados distribuídos entre `inferno`, `submundo`, `empireo` e `none`, compatíveis com `{ id, name, force, allowedSlots, minRarity, bonuses, description }`.
  - 6 poderes lendários usando exatamente os IDs: `inferno_dash_trail`, `submundo_bleed_minion`, `empireo_crit_lightning`, `inferno_ember_nova`, `submundo_crimson_pact`, `empireo_judgment_haste` (`{ id, name, force, description }`).
**Fazer:**
1. Criar `src/data/items.json` e `src/data/affixes.json` em pt-BR, balanceados para complementar o herói base (`120 HP`, `18 ATK`, `4 DEF`).
2. Validar ambos os arquivos com `JSON.parse` via Node.
**Permitido:** `src/data/items.json`, `src/data/affixes.json`.
**Proibido:** `src/data/monsters.json`, `src/data/skills.json`, `src/data/dialogues.json`, `src/core/`, `src/view/` e comandos git.
**Pronto quando:** ambos os JSONs existirem, respeitarem o contrato e passarem no `JSON.parse`.
**Entrega:** até 5 linhas: contagens de itens/afixos/poderes criados, faixas de bônus e validação JSON.
