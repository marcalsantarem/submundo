# BRF-046 — AG04 — T-045 Expansão de 30+ Afixos, Monstros do Prólogo e Catálogo da Campanha

**Leia:** `docs/agentes/AG04_Sistemas.md`, `docs/GDD_Submundo.md` (seções 2 e 5), `src/data/affixes.json`, `src/data/monsters.json`. **Regra:** manter compatibilidade retroativa com os IDs atuais; zero git commands.
**Decisão do dono:** Autorização explícita da `T-045` (M4 `v0.4.0`).
**Fazer:**
1. **`src/data/affixes.json`:**
   - Manter **todos** os 24 afixos existentes e os 6 `legendaryPowers` exatamente com seus IDs.
   - Adicionar **at least 10 novos afixos** (atingindo **34+ afixos** no total), equilibrados entre `'none'`, `'inferno'`, `'submundo'` e `'empireo'`, slots (`weapon`, `armor`, `amulet`, `ring`) e raridades (`magic`, `rare`), usando apenas campos válidos de `StatBonus` (`maxHp`, `attack`, `defense`, `moveSpeed`, `attackRange`, `cooldownReduction`, `critChance`, `critMultiplier`, `lifeSteal`, `luck`).
2. **`src/data/monsters.json`:**
   - Manter `abyssal_slime`, `bone_sentinel` e `infernal_warden` exatamente com seus IDs e atributos atuais (para não quebrar testes existentes).
   - Adicionar:
     - `cave_bat` (*Morcego da Gruta*, `type: "normal"`, `spriteKey: "cave_bat"`, rápido e frágil, `soulReward: 6`)
     - `abyss_herald` (*Arauto do Abismo*, `type: "boss"`, `spriteKey: "infernal_warden"`, Boss que rompe *O Selo Antigo* no fim do Prólogo, `maxHp: 210`, `attack: 15`, `soulReward: 70`)
3. **`src/data/campaign.json`:**
   - Criar catálogo seguindo o contrato `CampaignCatalog`:
     - `prologue_grotto` (`phase: "prologue"`, `order: 1`, `"A Gruta da Cachoeira"`, `biome: "village_grotto"`, `totalRooms: 3`, `difficultyScale: 0.7`, `monsterPool: ["abyssal_slime", "cave_bat"]`, `bossId: "bone_sentinel"`, `introDialogueIds: ["prologue_welcome", "stage_grotto_intro"]`, `victoryDialogueIds: ["stage_grotto_victory"]`, `unlocksStageId: "prologue_mine"`)
     - `prologue_mine` (`phase: "prologue"`, `order: 2`, `"A Mina Abandonada"`, `biome: "village_mine"`, `totalRooms: 3`, `difficultyScale: 0.85`, `monsterPool: ["cave_bat", "bone_sentinel"]`, `bossId: "bone_sentinel"`, `introDialogueIds: ["stage_mine_intro"]`, `victoryDialogueIds: ["stage_mine_victory"]`, `unlocksStageId: "prologue_seal"`)
     - `prologue_seal` (`phase: "prologue"`, `order: 3`, `"O Selo Antigo"`, `biome: "ancient_seal"`, `totalRooms: 4`, `difficultyScale: 1.0`, `monsterPool: ["abyssal_slime", "cave_bat", "bone_sentinel"]`, `bossId: "abyss_herald"`, `introDialogueIds: ["stage_seal_intro"]`, `victoryDialogueIds: ["village_fall_pact", "act1_briefing"]`, `unlocksStageId: "act1_submundo"`, `triggersFallOfVillage: true`)
     - `act1_submundo` (`phase: "act1"`, `order: 4`, `"Fenda do Submundo — Ato 1"`, `biome: "submundo_abyss"`, `totalRooms: 5`, `difficultyScale: 1.0`, `monsterPool: ["abyssal_slime", "bone_sentinel"]`, `bossId: "infernal_warden"`, `introDialogueIds: ["hub_welcome", "dungeon_enter"]`, `victoryDialogueIds: ["run_victory"]`)
**Permitido:** `src/data/affixes.json`, `src/data/monsters.json`, `src/data/campaign.json`.
**Proibido:** arquivos `.ts`, `dialogues.json`, `tests/` e comandos git.
**Pronto quando:** JSONs válidos com >= 34 afixos, `cave_bat` + `abyss_herald` e 4 estágios em `campaign.json`.
**Entrega:** até 5 linhas com a contagem final de afixos, monstros e estágios.
