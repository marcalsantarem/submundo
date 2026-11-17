# BRF-017 — AG04 — T-025 Rebalanceamento do Boss e monstros após teste real no celular

**Leia:** `docs/agentes/AG04_Sistemas_Meta.md`, `src/data/monsters.json`, `src/data/skills.json`. **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono:** Feedback do teste real do dono ("achei um pouco difícil, não consegui matar o boss").
**Contexto de combate:**
- Herói base sem equipamentos tem `120 HP`, `18 ATK`, `4 DEF`, `attackCooldownMs: 650`, `3` cargas de Poção (`40%` cura = `+48 HP`).
- Na Sala 5 (`DungeonGenerator.ts`), o `infernal_warden` aparece acompanhado de 1 `bone_sentinel` e 1 `abyssal_slime`. Antes, o Boss tinha `420 HP`, `24 ATK` (`20` dano/hit) e `1200ms` cooldown — punitivo demais antes de coletar equipamentos.
**Fazer:**
1. Ajustar `src/data/monsters.json` preservando todos os IDs, nomes, tipos e campos obrigatórios (`id`, `name`, `type`, `maxHp`, `attack`, `defense`, `moveSpeed`, `attackRange`, `attackCooldownMs`, `soulReward`, `spriteKey`) para tornar a Sala 5 desafiadora porém vencível por um jogador hábil usando Dash + Skills + Poções mesmo antes de equipar itens raros/lendários (ex.: Boss `infernal_warden` em torno de `260-300 HP`, `16-18 ATK`, `4-5 DEF`, `attackCooldownMs: 1350-1450`, e leve ajuste no `bone_sentinel` se necessário para evitar burst injusto na escolta).
2. Validar `src/data/monsters.json` com `JSON.parse` e rodar `npm test` para confirmar que nenhum teste existente quebra com os novos valores.
**Permitido:** `src/data/monsters.json`.
**Proibido:** `src/data/items.json`, `src/data/affixes.json`, `src/data/skills.json`, `src/core/`, `tests/` e comandos git.
**Pronto quando:** `JSON.parse` e `npm test` passarem 100% verdes.
**Entrega:** até 5 linhas: valores antigos vs novos em `monsters.json` e resultado de `npm test`.
