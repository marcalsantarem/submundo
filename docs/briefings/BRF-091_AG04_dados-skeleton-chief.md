# BRF-091 — AG04 (Sistemas/Meta) — T-102a Dados do `skeleton_chief` (Esqueleto Chefe)

**Leia:** [docs/agentes/AG04_Sistemas_Meta.md](../agentes/AG04_Sistemas_Meta.md), [src/data/monsters.json](../../src/data/monsters.json), [tests/core/monsters-m6.test.ts](../../tests/core/monsters-m6.test.ts). **Regra:** respostas curtas; **PROIBIDO** editar `src/view/`, `docs/narrativa.md` ou executar `git`.

**Fazer:**
1. Adicionar `skeleton_chief` em `src/data/monsters.json`:
   `"id": "skeleton_chief"`, `"name": "Esqueleto Chefe"`, `"type": "boss"`, `"attackType": "melee"`, `"maxHp": 175`, `"attack": 14`, `"defense": 5`, `"moveSpeed": 105`, `"attackRange": 46`, `"attackCooldownMs": 1100`, `"soulReward": 55`, `"spriteKey": "skeleton_chief"`.
2. Atualizar `tests/core/monsters-m6.test.ts` cobrindo `skeleton_chief` (`type: 'boss'`, `attackType: 'melee'`, `spriteKey: 'skeleton_chief'`).

**Permitido:** `src/data/monsters.json`, `tests/core/monsters-m6.test.ts`.
**Proibido:** `src/view/`, `docs/narrativa.md`, e qualquer comando `git`.

**Entrega:** até 4 linhas: arquivos alterados e validação JSON.
