# BRF-015 — AG06 — T-014 Glossário e textos canônicos de equipamentos, afixos e 3 Forças (M2)

**Leia:** `docs/agentes/AG06_Narrativa.md`, `docs/narrativa.md`, `src/data/dialogues.json`. **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono:** Decisão #5 (M2 `v0.2.0`).
**Contrato (alinhado com T-013 e T-015):**
- Slots oficiais: `weapon` (Arma), `armor` (Armadura Espectral), `amulet` (Amuleto / Selo), `ring` (Anel de Alma).
- Raridades oficiais: `common` (Comum), `magic` (Mágico), `rare` (Raro), `legendary` (Lendário).
- Mecânicas das 3 Forças:
  - `inferno` (**Inferno**): `ember` (**Brasa** — acumula queimaduras que explodem em área ao atingir 5 cargas).
  - `submundo` (**Submundo**): `bleed` (**Sangramento** & **Roubo de Vida**).
  - `empireo` (**Empíreo**): `judgment` (**Julgamento & Raio** — críticos disparam raios em cadeia e atordoam).
- IDs de Poderes Lendários: `inferno_dash_trail`, `submundo_bleed_minion`, `empireo_crit_lightning`, `inferno_ember_nova`, `submundo_crimson_pact`, `empireo_judgment_haste`.
**Fazer:**
1. Expandir `docs/narrativa.md` com a seção oficial de Equipamentos, Raridades, Mecânicas das 3 Forças e os nomes/descrições canônicas dos 6 Poderes Lendários acima.
2. Atualizar `src/data/dialogues.json` adicionando chaves curtas para eventos de loot no M2 (`loot_drop_legendary`, `inventory_hint`, `extraction_loot_kept`, `death_loot_lost`) mantendo intactas todas as chaves do M1.
**Permitido:** `docs/narrativa.md`, `src/data/dialogues.json`.
**Proibido:** `src/data/items.json`, `src/data/affixes.json`, `src/data/monsters.json`, `src/core/`, `src/view/` e comandos git.
**Pronto quando:** `docs/narrativa.md` atualizado e `src/data/dialogues.json` validado com `JSON.parse`.
**Entrega:** até 5 linhas: atualizações feitas, novas chaves em `dialogues.json` e validação JSON.
