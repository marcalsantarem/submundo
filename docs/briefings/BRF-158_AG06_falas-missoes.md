# BRF-158 — AG06 — T-145 Falas das missões do prólogo
**Leia:** `docs/agentes/AG06_Narrativa.md`, as decisões #13 e #24 em `docs/decisoes.md`, `docs/narrativa.md` (glossário, Lyra, Gorran, Mestre de Armas, Karnak) e `src/data/dialogues.json` (formato; as chaves `village_*` do M9). **Regra:** respostas curtas; sem commit/push/branches (checkout no branch `M10`; não troque).
**Decisão do dono (#24):** o Mestre abre o prólogo explicando que os moradores precisam de ajuda. Lyra pede ervas medicinais da Plantação de Ervas; Gorran pede que o herói recupere as ferramentas dele na Mina Iluminada. Cada um tem falas de pedido (aceitar), em andamento e entrega. No fim da Mina o **herói** vê algo estranho no fundo da mina. Depois das duas entregas, o herói conta ao Mestre o que viu e quer explorar: a missão 3 é o Fundo da Mina, onde ele encontra o Karnak e morre. Falas só antes e depois das dungeons (o Mestre não acompanha). Sem cena de destruição: após a morte, tela "Fim do Prólogo".
**Fazer:** em `src/data/dialogues.json`, chaves novas curtas (1–3 falas, pt-BR, tom do glossário):
- `quest_master_intro`; `quest_master_wait` (enquanto 1 e 2 não foram entregues);
- `quest_lyra_offer`, `quest_lyra_progress`, `quest_lyra_turnin`, `quest_lyra_done`; idem `quest_gorran_*`;
- `quest_master_depths_offer` (o herói relata o que viu e o Mestre consente, preocupado), `quest_master_depths_progress`;
- entrada/saída: `mission_herbs_enter`, `mission_herbs_complete`, `mission_mine_enter`, `mission_mine_complete`, `mission_mine_strange` (o herói vendo o "algo estranho"), `mission_depths_enter`, `mission_depths_karnak` (o Karnak surge);
- `prologue_end_title` e `prologue_end_text` (tela "Fim do Prólogo", curto e sóbrio).
Registre em `docs/narrativa.md` o arco do prólogo novo (as 3 missões, quem pede, o "algo estranho" e o fim), marcando as fases antigas (Gruta, Selo) como fora do prólogo. Não apague chaves existentes.
**Permitido:** `src/data/dialogues.json`, `docs/narrativa.md`. **Proibido:** `src/core/`, `src/view/`, `src/data/campaign.json` (o AG04 edita em paralelo), Git.
**Pronto quando:** o JSON é válido, `npm test` passa e as chaves seguem o formato existente.
**Entrega:** até 5 linhas: chaves criadas e suposições.
