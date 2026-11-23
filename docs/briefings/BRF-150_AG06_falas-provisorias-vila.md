# BRF-150 — AG06 (Narrativa): Falas Provisórias da Vila Natal e Nomes Canônicos (`T-137`)

## Contexto
Onda A do **M9 (`v0.9.0`: Novo hub funcional)** conforme **Decisão #23**. Precisamos das falas provisórias curtas dos 3 NPCs da Vila Natal em `src/data/dialogues.json` e do registro oficial dos nomes canônicos em `docs/narrativa.md` (as falas definitivas da campanha ficam para o M10).

## Arquivos sob sua posse
- `src/data/dialogues.json`
- `docs/narrativa.md`

## Especificações Obrigatórias
1. **Nomes Canônicos (Decisão #23):**
   - **Mestre de Armas** (`portraitId: "weapon_master"`)
   - **Lyra** — curandeira / vendedora de poções (`portraitId: "system"` temporariamente, pois `PortraitId` ainda não tem retrato próprio de Lyra)
   - **Gorran** — ferreiro da vila (`portraitId: "village_blacksmith"`)
2. **Novas entradas em `src/data/dialogues.json` (preservando 100% das entradas existentes e mantendo JSON válido em pt-BR):**
   - `village_master_prologue_grotto`: Mestre de Armas aponta a primeira missão (Gruta da Cachoeira) e avisa que o portão de saída está liberado.
   - `village_master_prologue_mine`: Mestre de Armas aponta a segunda missão (Mina Abandonada) após a Gruta e libera o caminho pelo portão.
   - `village_master_prologue_seal`: Mestre de Armas aponta a terceira missão (O Selo Antigo no fundo da mina) com tom de urgência.
   - `village_master_idle`: fala curta do Mestre quando o portão já está liberado ou o jogador fala com ele novamente.
   - `village_lyra_talk`: fala curta e acolhedora de **Lyra** na porta da casa de palha (cuida dos feridos e prepara ervas/poções da vila; ainda sem loja funcional no M9).
   - `village_gorran_talk`: fala curta de **Gorran** junto à bigorna/forja (afiar lâminas e reparar armaduras da vila; ainda sem forja funcional no M9).
   - `village_gate_locked`: mensagem curta (`speaker: "Sistema"`, `portraitId: "system"`) quando o jogador tenta sair pelo portão antes de falar com o Mestre de Armas.
   - Cada entrada segue exatamente o schema existente: `{ id, speaker, portraitId, title, text, shortText }`, com textos curtos, diretos e coerentes com o tom Dark Fantasy do SUBMUNDO.
3. **Atualização em `docs/narrativa.md`:**
   - Registrar/atualizar os nomes canônicos **Mestre de Armas**, **Lyra** e **Gorran** na seção da Vila Natal / Prólogo, marcando que as falas da Vila no M9 são provisórias (definitivas no M10).
4. **Validação:** Validar JSON de `src/data/dialogues.json` via Python (`json.loads`) garantindo todas as 7 novas chaves com os 6 campos obrigatórios e `portraitId` válido.

## Restrições
- Não remover nem renomear chaves existentes de `src/data/dialogues.json`.
- **PROIBIDO** executar comandos `git`.
- Relato curto ao AG00: arquivos alterados, chaves adicionadas e validação realizada.
