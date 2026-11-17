# BRF-004 — AG04 — T-004 Dados iniciais de balanceamento de monstros e skills do M1

**Leia:** `docs/agentes/AG04_Sistemas_Meta.md`, `docs/GDD_Submundo.md` (seções 3 e 4). **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono:** Decisão #5 (M1 `v0.1.0`).
**Contrato:**
- Formato exato de `src/data/monsters.json` (compatível com `MonsterDef[]` de `src/core/index.ts`):
  - 3 entradas com IDs e nomes exatos:
    1. `id: "abyssal_slime"`, `name: "Limo Abissal"`, `type: "normal"`, `spriteKey: "abyssal_slime"`
    2. `id: "bone_sentinel"`, `name: "Sentinela Ósseo"`, `type: "normal"`, `spriteKey: "bone_sentinel"`
    3. `id: "infernal_warden"`, `name: "Carcereiro Infernal"`, `type: "boss"`, `spriteKey: "infernal_warden"`
  - Campos obrigatórios em cada monstro: `id`, `name`, `type`, `maxHp`, `attack`, `defense`, `moveSpeed`, `attackRange`, `attackCooldownMs`, `soulReward`, `spriteKey`.
- Formato exato de `src/data/skills.json` (compatível com `SkillDef[]` de `src/core/index.ts`):
  - 4 entradas com IDs, slots e nomes exatos:
    1. `id: "spectral_dash"`, `name: "Esquiva Espectral"`, `slot: "dash"`, `force: "none"`, `cooldownMs: 3000`, `invulnerabilityMs: 350`, `dashDistance: 120`
    2. `id: "crimson_cleave"`, `name: "Golpe Carmesim"`, `slot: "active_1"`, `force: "submundo"`, `cooldownMs: 6000`, `damageMultiplier: 2.2`, `radius: 80`
    3. `id: "infernal_eruption"`, `name: "Erupção Infernal"`, `slot: "active_2"`, `force: "inferno"`, `cooldownMs: 14000`, `damageMultiplier: 3.8`, `radius: 130`
    4. `id: "soul_potion"`, `name: "Poção de Alma"`, `slot: "potion"`, `force: "none"`, `cooldownMs: 2000`, `healPercent: 0.4`, `maxCharges: 3`
  - Referência de atributos base do Guerreiro Espectral no M1: `maxHp: 120`, `attack: 18`, `defense: 4`, `moveSpeed: 140`, `attackRange: 52`, `attackCooldownMs: 650`.
**Fazer:**
1. Criar `src/data/monsters.json` balanceado para uma incursão de 4 salas normais + 1 Boss durando cerca de 3 minutos.
2. Criar `src/data/skills.json` com os 4 objetos acima e descrições curtas em pt-BR.
**Permitido:** `src/data/monsters.json`, `src/data/skills.json`.
**Proibido:** `src/data/dialogues.json`, `src/core/`, `src/view/` e comandos git (`commit`, `push`, `branch`, `checkout`, `reset`, `stash`).
**Pronto quando:** ambos os arquivos JSON existirem, respeitarem todos os campos do contrato e passarem em `JSON.parse` via Node.
**Entrega:** até 5 linhas: arquivos criados, valores principais de balanceamento, validação JSON e o que não foi testado.
