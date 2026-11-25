# BRF-170 — AG07 — T-158 Contratos do menu-hub
**Leia:** `docs/agentes/AG07_Arquiteto.md`, as decisões #28 e #29 em `docs/decisoes.md`, `src/core/index.ts` (`SaveProfile` ~186 e tipos de progressão), `src/core/progression/ProfileManager.ts` (criação e migração do perfil/save) e `tests/core/architecture.test.ts`. **Regra:** respostas curtas; sem commit/push/branches (checkout na `dev`; não troque).
**Contexto:** o hub deixa de ser uma cena andável e vira um **menu** (Decisão #29). Botões, na ordem: Masmorras, Inventário, Forja, Personagem, Habilidades, Configurações. Só Masmorras e Inventário começam habilitados; os outros ficam bloqueados (cadeado, "Em breve") e serão liberados por missões em masmorras no futuro. O jogo abre direto no menu; o fim de qualquer dungeon volta ao menu.
**Fazer:**
(1) Em `src/core/index.ts`: tipo `MenuHubItemId` (`'masmorras'|'inventario'|'forja'|'personagem'|'habilidades'|'configuracoes'`), constante ordenada `MENU_HUB_ITEMS` com id, rótulo pt-BR e `unlockedByDefault`, e campo `menuUnlocks: MenuHubItemId[]` no `SaveProfile` (padrão: `['masmorras','inventario']`).
(2) No `ProfileManager`: perfil novo e **migração de saves antigos** garantem `menuUnlocks` com pelo menos os dois padrões; funções puras `isMenuItemUnlocked(profile, id)` e `unlockMenuItem(profile, id)` (sem duplicar).
(3) Documente em comentário curto o fluxo de cenas alvo: `BootScene` → `MenuHubScene` (a criar pelo AG02, chave `MenuHub`); fim de dungeon → `MenuHub`. **Não crie a cena nem edite `src/view/`.** Só deixe a chave/constante da cena em `src/core/index.ts` se for o padrão do projeto.
(4) Testes Vitest: padrão do perfil novo, migração de save antigo sem o campo, desbloqueio sem duplicar, ordem de `MENU_HUB_ITEMS`. Ajuste `architecture.test.ts` só se necessário.
**Permitido:** `src/core/index.ts`, `src/core/progression/`, `tests/core/`. **Proibido:** `src/view/`, `src/data/`, assets, Git.
**Pronto quando:** `npm test` e `npm run build` passam.
**Entrega:** até 5 linhas (nomes e assinaturas exportados que o AG02 vai usar).
