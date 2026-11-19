# BRF-074 — AG04 (Sistemas/Meta) — T-093a Dados e Combate dos 5 Novos Monstros

**Leia:** [docs/agentes/AG04_Sistemas_Meta.md](../agentes/AG04_Sistemas_Meta.md), [src/data/monsters.json](../../src/data/monsters.json), [src/core/index.ts](../../src/core/index.ts), [src/core/combat/](../../src/core/combat/). **Regra:** respostas curtas; **PROIBIDO** editar `src/view/`, `docs/narrativa.md` ou executar `git`.

**Decisão do dono (Decisão #11):** Definir os dados dos **5 monstros comuns** do M6 (bosses ficam para depois):
1. `slime` — **Slime** (nome `"Slime"` em EN e pt-BR): melee lento, inimigo básico (`type: 'normal'`, `spriteKey: 'slime'`, `attackType: 'melee'`, ex.: `HP 45, ATK 8, DEF 2, moveSpeed 78, attackRange 34, attackCooldownMs 1200, soulReward 8`).
2. `cave_bat` — **Morcego**: melee rápido e frágil (`type: 'normal'`, `spriteKey: 'cave_bat'`, `attackType: 'melee'`, ex.: `HP 28, ATK 7, DEF 1, moveSpeed 140, attackRange 30, attackCooldownMs 900, soulReward 6`).
3. `wolf` — **Lobo**: novo inimigo das dungeons iniciais; melee um pouco mais rápido e mais resistente que o Slime (`type: 'normal'`, `spriteKey: 'wolf'`, `attackType: 'melee'`, ex.: `HP 65, ATK 11, DEF 3, moveSpeed 122, attackRange 38, attackCooldownMs 1000, soulReward 12`).
4. `skeleton` — **Esqueleto**: humanóide com espada e escudo; melee padrão, levemente resistente (`type: 'normal'`, `spriteKey: 'skeleton'`, `attackType: 'melee'`, ex.: `HP 85, ATK 12, DEF 5, moveSpeed 96, attackRange 42, attackCooldownMs 1150, soulReward 15`).
5. `skeleton_archer` — **Esqueleto Arqueiro**: ataque à distância, frágil (`type: 'normal'`, `spriteKey: 'skeleton_archer'`, `attackType: 'ranged'`, ex.: `HP 38, ATK 10, DEF 1, moveSpeed 88, attackRange 210, attackCooldownMs 1600, soulReward 14`).

**Atenção — Compatibilidade com testes existentes (`tests/core/`):**
- `combat.test.ts`, `dungeon.test.ts`, `m1-integration.test.ts`, `synergies.test.ts` e `campaign.test.ts` consultam `abyssal_slime`, `bone_sentinel`, `infernal_warden` e `abyss_herald`. **NÃO remova** esses 4 registros legados de `src/data/monsters.json` por enquanto — apenas adicione `slime`, `wolf`, `skeleton`, `skeleton_archer` e atualize `cave_bat.name` para `"Morcego"`.

**Fazer:**
1. Em `src/core/index.ts`, adicionar `attackType?: 'melee' | 'ranged';` em `MonsterDef` e `MonsterEntity` (se aplicável).
2. Atualizar `src/data/monsters.json` com os 5 monstros acima (mantendo os 4 legados para retrocompatibilidade).
3. Verificar onde monstros são instanciados/atacam em `src/core/` (ex.: `EntityFactory` / `CombatSystem`) para propagar `attackType` (default `'melee'`) e garantir que `attackRange` de `ranged` (`210`) funcione corretamente na IA/combate em `src/core/` (e se apropriado, emitir evento ou manter comportamento limpo).
4. Criar `tests/core/monsters-m6.test.ts` validando os 5 monstros (`slime`, `cave_bat`, `wolf`, `skeleton`, `skeleton_archer`), suas relações de HP/velocidade/alcance (`wolf` > `slime`, `skeleton_archer` ranged e frágil) e zero importação de Phaser.

**Permitido:** `src/core/index.ts`, `src/core/entities/`, `src/core/combat/`, `src/data/monsters.json`, `tests/core/monsters-m6.test.ts`.
**Proibido:** `src/view/`, `docs/narrativa.md`, `tests/e2e/`, e qualquer comando `git`.

**Pronto quando:** `monsters.json`, `src/core/` e `tests/core/monsters-m6.test.ts` atualizados e revisados contra `strict: true`.

**Entrega:** até 8 linhas: (1) arquivos alterados/criados, (2) stats definidos para os 5 monstros, (3) validação realizada.
