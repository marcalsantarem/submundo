# BRF-020 — AG08 — T-026 Ícone oficial do app SUBMUNDO (substitui BRF-018)

**Leia:** `docs/agentes/AG08_Arte.md`, `docs/guia_visual.md`. **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono:** Pedido explícito do dono para criar um ícone bonito para o jogo (execução da `T-026`, substituindo a abordagem pixel-art de `BRF-018` por arte 2D estilizada Dark Fantasy conforme seção 7 do GDD).
**Contrato:**
- Arte-mestre aprovada pelo AG00 salva em `assets/icons/submundo_icon_master.png` (`1024x1024` px RGB).
- Saídas obrigatórias em `public/icons/`:
  - `public/icons/icon-512.png` (`512x512` px, PNG RGB válido)
  - `public/icons/icon-192.png` (`192x192` px, PNG RGB válido)
  - `public/icons/apple-touch-icon.png` (`180x180` px, PNG RGB opaco full-bleed)
**Fazer:**
1. Salvar a arte-mestre convertida em PNG (`1024x1024`) em `assets/icons/submundo_icon_master.png`.
2. Criar `scripts/art/generateIcons.py` (Python 3 + Pillow/PIL com `Resampling.LANCZOS`) que lê `assets/icons/submundo_icon_master.png` e gera `icon-512.png`, `icon-192.png` e `apple-touch-icon.png` em `public/icons/`.
3. Executar `python3 scripts/art/generateIcons.py` e validar cabeçalho PNG e dimensões exatas dos 3 arquivos.
4. Atualizar `docs/guia_visual.md` com uma seção documentando o ícone oficial, o arquivo-mestre e o comando de regeneração.
**Permitido:** `assets/icons/`, `public/icons/`, `scripts/art/generateIcons.py`, `docs/guia_visual.md`.
**Proibido:** `package.json`, `index.html`, `src/`, `tests/`, `netlify.toml`, `public/manifest.webmanifest` e comandos git (`commit`, `push`, `branch`, `checkout`, `reset`, `stash`).
**Pronto quando:** `assets/icons/submundo_icon_master.png`, `scripts/art/generateIcons.py` e os 3 PNGs em `public/icons/` existirem com dimensões exatas e assinatura `\x89PNG` válida.
**Entrega:** até 6 linhas: arquivos gerados, dimensões/tamanhos conferidos, comando validado e o que não foi testado.
