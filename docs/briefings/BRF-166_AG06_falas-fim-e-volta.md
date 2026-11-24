# BRF-166 — AG06 — T-153 (parte) Falas de volta à Vila, fim do prólogo e chegada ao Ato 1
**Leia:** `docs/agentes/AG06_Narrativa.md`, as decisões #24 e **#26** em `docs/decisoes.md`, `docs/narrativa.md` (seção do prólogo novo e do Ato 1: Emissário Celestial, Refúgio, Selo Celestial) e `src/data/dialogues.json` (`prologue_end_*`, `village_fall_*`, `act1_briefing`, `hub_welcome`). **Regra:** respostas curtas; sem commit/push/branches (checkout na `dev`; não troque).
**Feedback do dono:** o fim do prólogo e o Ato 1 ainda mostram falas antigas (o Arauto, "O Selo caiu…", a vila em chamas). No prólogo novo não há destruição da vila nem Arauto: o herói morre para o **Karnak** no Fundo da Mina e desperta no Submundo.
**Fazer:** em `src/data/dialogues.json`, chaves novas (curtas, pt-BR, tom do glossário), sem apagar as antigas:
- `mission_return_victory` (ex.: "Missão cumprida: {mission}. Fale com {npc}.") e `mission_return_defeat`;
- revise `prologue_end_title`/`prologue_end_text` se ainda citarem a vila em chamas ou o Arauto;
- `act1_arrival_1` a `act1_arrival_3`: o despertar no Submundo após a morte para o Karnak e o Emissário Celestial explicando o Selo Celestial e a missão (sem citar Arauto nem a vila destruída).
Atualize `docs/narrativa.md` marcando `village_fall_boss`, `village_fall_pact` e `act1_briefing` como **fora de uso** no fluxo novo.
**Permitido:** `src/data/dialogues.json`, `docs/narrativa.md`. **Proibido:** `src/core/`, `src/view/`, `src/data/campaign.json` (AG04), Git.
**Pronto quando:** JSON válido e `npm test` passa.
**Entrega:** até 4 linhas.
