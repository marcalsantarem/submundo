# BRF-030 — AG08 — T-040 Auditar e documentar limpeza de submundo_icon_master.png do dist/

**Leia:** `docs/agentes/AG08_Arte.md`, `docs/guia_visual.md`, `docs/qa/qa-M2.md`. **Regra:** respostas curtas; sem commit/push/branches; **NÃO apagar `assets/icons/submundo_icon_master.png`** (arte-mestre fonte).
**Decisão do dono:** Autorização explícita da `T-040` (ressalva menor #2 do QA M2).
**Contexto:** `public/assets/icons/` não existe no repositório; o PNG mestre vive apenas em `assets/icons/submundo_icon_master.png` e entrava em `dist/` somente por uma cópia extra do shim local `node_modules/.bin/vite` (já corrigido pelo AG00).
**Fazer:**
1. Conferir que não existe cópia de `submundo_icon_master.png` dentro de `public/`, mantendo intactos `assets/icons/submundo_icon_master.png` e `public/icons/{icon-192,icon-512,apple-touch-icon}.png`.
2. Atualizar `docs/guia_visual.md` (seção 5) deixando explícito que `assets/icons/` é diretório-fonte não distribuído em runtime (`dist/` recebe apenas `public/icons/`).
3. Rodar `npm run build` e confirmar que `dist/assets/icons/` não é gerado e que `dist/` fica em ~1,89 MB.
**Permitido:** `docs/guia_visual.md` (e eventual remoção se houvesse sobra em `public/assets/icons/`).
**Proibido:** apagar `assets/icons/submundo_icon_master.png` ou editar `public/icons/`, `src/`, `tests/` e comandos git.
**Pronto quando:** `npm run build` gerar `dist/` sem `submundo_icon_master.png` e `docs/guia_visual.md` atualizado.
**Entrega:** até 5 linhas: confirmação dos arquivos, tamanho final de `dist/` e resultado do build.
