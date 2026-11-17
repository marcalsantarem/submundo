# BRF-043 — AG06 — T-042 Narrativa e Diálogos do Prólogo + Ato 1 e Glossário de Afixos

**Leia:** `docs/agentes/AG06_Narrativa.md`, `docs/GDD_Submundo.md` (seção 2), `docs/narrativa.md`, `src/data/dialogues.json`. **Regra:** pt-BR sombrio/épico; respostas curtas; zero git commands.
**Decisão do dono:** Autorização explícita da `T-042` (M4 `v0.4.0`).
**Fazer:**
1. Atualizar `src/data/dialogues.json` (mantendo TODAS as 14 chaves já existentes em `entries` e no nível raiz para retrocompatibilidade, e adicionando `portraitId` em cada objeto de `entries` dentre `'hero_living' | 'hero_wraith' | 'weapon_master' | 'village_blacksmith' | 'emissary' | 'spectral_blacksmith' | 'infernal_warden' | 'system'`):
   - Adicionar novas entradas canônicas do Prólogo e Ato 1:
     - `prologue_welcome` (`weapon_master`): chegada à Vila Natal viva, treinamento antes da tragédia.
     - `prologue_blacksmith` (`village_blacksmith`): o Ferreiro da vila antes da queda, temperando aço comum.
     - `stage_grotto_intro` (`weapon_master`): *A Gruta da Cachoeira* (teste contra limos e morcegos).
     - `stage_grotto_victory` (`hero_living`): retorno vitorioso da gruta.
     - `stage_mine_intro` (`weapon_master`): *A Mina Abandonada* (esqueletos surgidos à noite).
     - `stage_mine_victory` (`weapon_master`): presságio sombrio após limpar a mina.
     - `stage_seal_intro` (`weapon_master`): *O Selo Antigo* (porta ancestral rompida no fundo da mina).
     - `village_fall_boss` (`infernal_warden`): *Arauto do Abismo* / horda infernal incendiando a vila.
     - `village_fall_pact` (`emissary`): queda do guerreiro e pacto do Emissário Celestial (crava o Selo Celestial, transforma-o em Guerreiro Espectral e o envia ao Refúgio no Submundo).
     - `act1_briefing` (`emissary`): abertura do Ato 1 no Refúgio no Submundo, caçada aos Generais.
   - Atualizar `"version": "0.4.0"` em `src/data/dialogues.json`.
2. Atualizar `docs/narrativa.md` adicionando seção do **Prólogo (Vila Natal, 3 Masmorras, Queda e Pacto Celestial)** e glossário rápido dos novos termos/personagens (Mestre de Armas, Ferreiro da Vila, Arauto do Abismo, Morcego da Gruta, Selo Antigo).
**Permitido:** `docs/narrativa.md`, `src/data/dialogues.json`.
**Proibido:** arquivos `.ts`, `.png`, outros JSONs e comandos git.
**Pronto quando:** JSON válido com todas as chaves existentes preservadas + novas entradas com `portraitId`.
**Entrega:** até 5 linhas resumindo as entradas adicionadas e personagens documentados.
