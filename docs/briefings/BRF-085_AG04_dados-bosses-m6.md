# BRF-085 — AG04 (Sistemas/Meta) — T-098a Dados dos 2 Bosses (`wolf_alpha` e `karnak`)

**Leia:** [docs/agentes/AG04_Sistemas_Meta.md](../agentes/AG04_Sistemas_Meta.md), [src/data/monsters.json](../../src/data/monsters.json), [tests/core/monsters-m6.test.ts](../../tests/core/monsters-m6.test.ts). **Regra:** respostas curtas; **PROIBIDO** editar `src/view/`, `docs/narrativa.md` ou executar `git`.

**Fazer:**
1. Adicionar os 2 bosses em `src/data/monsters.json` (preservando os demais registros):
   - `wolf_alpha`: `"name": "Chefe da Matilha"`, `"type": "boss"`, `"attackType": "melee"`, `"maxHp": 190`, `"attack": 15`, `"defense": 4`, `"moveSpeed": 126`, `"attackRange": 46`, `"attackCooldownMs": 1050`, `"soulReward": 60`, `"spriteKey": "wolf_alpha"`.
   - `karnak`: `"name": "Karnak"`, `"type": "boss"`, `"attackType": "melee"`, `"maxHp": 9999`, `"attack": 18`, `"defense": 999`, `"moveSpeed": 98`, `"attackRange": 62`, `"attackCooldownMs": 1350`, `"soulReward": 0`, `"spriteKey": "karnak"`.
2. Atualizar `tests/core/monsters-m6.test.ts` para validar também `wolf_alpha` e `karnak` (ambos `type: 'boss'`, `wolf_alpha` mais resistente/forte que `wolf`, `karnak` com defesa/HP invulneráveis para o Prólogo).

**Permitido:** `src/data/monsters.json`, `tests/core/monsters-m6.test.ts`.
**Proibido:** `src/view/`, `docs/narrativa.md`, e qualquer comando `git`.

**Entrega:** até 5 linhas: arquivos alterados e validação JSON.
