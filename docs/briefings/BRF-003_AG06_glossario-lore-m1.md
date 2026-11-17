# BRF-003 — AG06 — T-003 Glossário oficial, lore base e diálogos de sistema do M1

**Leia:** `docs/agentes/AG06_Narrativa.md`, `docs/GDD_Submundo.md` (seções 1 a 4). **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono:** Decisão #3 (começar pelo loop de masmorra/Refúgio do Submundo, deixando o Prólogo para o M4) e Decisão #5 (M1 `v0.1.0`).
**Contrato:**
- IDs e nomes oficiais em pt-BR (compartilhados com AG04 e AG08):
  - Herói: `wraith_warrior` -> `"Guerreiro Espectral"`
  - Monstros do M1:
    - `abyssal_slime` -> `"Limo Abissal"`
    - `bone_sentinel` -> `"Sentinela Ósseo"`
    - `infernal_warden` -> `"Carcereiro Infernal"` (Boss da Sala 5)
  - Ações/Skills do M1:
    - `spectral_dash` -> `"Esquiva Espectral"`
    - `crimson_cleave` -> `"Golpe Carmesim"` (Força: Submundo)
    - `infernal_eruption` -> `"Erupção Infernal"` (Força: Inferno)
    - `soul_potion` -> `"Poção de Alma"`
**Fazer:**
1. Criar `docs/narrativa.md` com a Bíblia Narrativa enxuta e a tabela do Glossário Oficial (facções: Inferno, Submundo, Empíreo; moedas: Almas, Essência de General; locais: Vila Natal, Refúgio do Submundo; e todos os IDs e nomes oficiais acima).
2. Criar `src/data/dialogues.json` com JSON válido contendo textos curtos de ambientação e feedback da masmorra (`dungeon_enter`, `room_clear`, `boss_intro`, `run_victory`, `run_death`) no tom Dark Fantasy do Submundo.
**Permitido:** `docs/narrativa.md`, `src/data/dialogues.json`.
**Proibido:** `src/data/monsters.json`, `src/data/skills.json`, `src/core/`, `src/view/` e comandos git (`commit`, `push`, `branch`, `checkout`, `reset`, `stash`).
**Pronto quando:** `docs/narrativa.md` criado e `src/data/dialogues.json` validado com `node -e "JSON.parse(require('fs').readFileSync('src/data/dialogues.json','utf8'))"`.
**Entrega:** até 5 linhas: arquivos criados, validação do JSON, suposições e o que não foi verificado.
