# BRF-032 — AG06 — T-030 Glossário e diálogos do Refúgio no Submundo

**Leia:** `docs/agentes/AG06_Narrativa.md`, `docs/GDD_Submundo.md`, `docs/narrativa.md`, `src/data/dialogues.json`. **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono:** Autorização explícita da `T-030` (M3 `v0.3.0`).
**Fazer:**
1. Preservar **todas** as chaves existentes em `src/data/dialogues.json` (`entries` + campos de topo) e adicionar as 5 chaves do Refúgio (em `entries` e no topo):
   - `hub_welcome` (Emissário Celestial recebendo o Espectro no Refúgio do Submundo)
   - `altar_intro` (Altar de Almas explicando fortalecimento permanente com Almas)
   - `blacksmith_intro` (Ferreiro Espiritual explicando aprimoramento `+1/+2/+3` com Almas e forja com **Essência de General**)
   - `portal_enter` (Portal da Fenda convidando para nova incursão)
   - `boss_essence_drop` (Alerta ao obter **Essência de General** do Carcereiro Infernal)
2. Documentar a Seção 7 em `docs/narrativa.md` com os NPCs/estações do Refúgio e as chaves novas.
**Permitido:** `docs/narrativa.md`, `src/data/dialogues.json`.
**Proibido:** `src/core/`, `src/view/`, `tests/` e comandos git.
**Pronto quando:** `dialogues.json` for JSON válido preservando todas as chaves antigas + as 5 novas e `npm test` passar.
**Entrega:** até 5 linhas: chaves adicionadas, seções atualizadas e resultado do `npm test`.
