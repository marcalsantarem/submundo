# BRF-150 — AG06 — T-137 Falas provisórias da Vila
**Leia:** `docs/agentes/AG06_Narrativa.md`, a decisão #23 em `docs/decisoes.md`, `docs/narrativa.md` (glossário e personagens do prólogo) e `src/data/dialogues.json` (formato das chaves). **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono (#23):** 3 NPCs na Vila Natal: o **Mestre de Armas** (aponta a próxima missão), **Lyra** (curandeira/vendedora de poções, só falas) e **Gorran** (ferreiro, só falas). As falas são **provisórias**; as definitivas e a ordem das missões ficam para o M10.
**Fazer:**
(1) Em `src/data/dialogues.json`, chaves novas e curtas (1–3 falas cada, tom do glossário, pt-BR):
- `village_master_mission_grotto`, `village_master_mission_mine`, `village_master_mission_seal` (aponta a missão e manda sair pelo portão) e `village_master_idle` (depois de já ter falado);
- `village_lyra_idle` (2 variações) e `village_gorran_idle` (2 variações);
- `village_gate_locked` ("fale com o Mestre antes de sair").
(2) Em `docs/narrativa.md`, registre **Lyra** e **Gorran** como nomes canônicos (ids `village_healer` e `village_blacksmith`) e o papel de cada um na Vila.
**Permitido:** `src/data/dialogues.json`, `docs/narrativa.md`. **Proibido:** `src/core/`, `src/view/`, chaves já existentes, Git.
**Pronto quando:** o JSON é válido, `npm test` passa e as chaves seguem o formato existente.
**Entrega:** até 5 linhas: chaves criadas e o que ficou para o M10.
