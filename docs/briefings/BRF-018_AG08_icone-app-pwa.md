# BRF-018 — AG08 — T-026 Ícone oficial do app SUBMUNDO (iOS e PWA)

**Leia:** `docs/agentes/AG08_Arte.md`, `docs/guia_visual.md`. **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono:** Pedido do dono para ícone e PWA instalável no iPhone.
**Contrato:**
- Arquivos gerados em `public/icons/`:
  - `apple-touch-icon.png`: `180x180` px (iOS Home Screen — sem fundo transparente, fundo sólido Dark Fantasy `#09090b` com borda sutil e emblema nítido).
  - `icon-192.png`: `192x192` px (Android/PWA).
  - `icon-512.png`: `512x512` px (Android/PWA splash).
- Arte do ícone: elmo/capuz sombrio do **Guerreiro Espectral** com olhos e lâmina em chama azul espiritual (`#38bdf8` / `#e0fbfc`), brasa infernal sutil (`#f97316` / `#ef4444`) e moldura rúnica sobre fundo `#09090b`, mantendo nitidez pixel-art escalada (nearest-neighbor).
**Fazer:**
1. Criar `scripts/art/generateAppIcons.mjs` em Node.js puro (`fs`, `path`, `zlib` para PNG RGBA real) e executá-lo para gerar `apple-touch-icon.png` (`180x180`), `icon-192.png` (`192x192`) e `icon-512.png` (`512x512`) em `public/icons/`.
2. Validar que os 3 PNGs possuem assinatura `\x89PNG` e dimensões `IHDR` exatas (`180x180`, `192x192`, `512x512`).
**Permitido:** `scripts/art/generateAppIcons.mjs`, `public/icons/`.
**Proibido:** `public/assets/`, `public/manifest.webmanifest`, `public/sw.js`, `index.html`, `src/` e comandos git.
**Pronto quando:** os 3 arquivos PNG existirem em `public/icons/` com dimensões validadas.
**Entrega:** até 5 linhas: arquivos criados, dimensões/tamanhos conferidos e validação do cabeçalho PNG.
