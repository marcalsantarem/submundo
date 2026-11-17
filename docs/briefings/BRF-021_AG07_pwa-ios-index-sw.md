# BRF-021 — AG07 — T-028 Meta tags iOS/PWA em index.html e registro do Service Worker em src/main.ts

**Leia:** `docs/agentes/AG07_Arquiteto.md`, `index.html`, `src/main.ts`, `public/manifest.webmanifest`, `public/sw.js`, `tests/core/architecture.test.ts`. **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono:** Autorização explícita da `T-028` para tornar o jogo instalável como PWA no iPhone e Android.
**Contrato (alinhado com `T-026` e `T-027`):**
- Arquivos existentes em `public/`: `./manifest.webmanifest`, `./sw.js`, `./icons/apple-touch-icon.png` (`180x180`), `./icons/icon-192.png` (`192x192`), `./icons/icon-512.png` (`512x512`).
**Fazer:**
1. Atualizar `index.html`:
   - Atualizar `viewport` incluindo `viewport-fit=cover`.
   - Adicionar `<meta name="theme-color" content="#09090b" />`, `<meta name="apple-mobile-web-app-capable" content="yes" />`, `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />` e `<meta name="apple-mobile-web-app-title" content="SUBMUNDO" />`.
   - Adicionar `<link rel="manifest" href="./manifest.webmanifest" />`, `<link rel="apple-touch-icon" sizes="180x180" href="./icons/apple-touch-icon.png" />` e `<link rel="icon" type="image/png" sizes="192x192" href="./icons/icon-192.png" />`.
2. Atualizar `src/main.ts` para registrar `./sw.js` no evento `load` quando `'serviceWorker' in navigator` (com `try/catch` / `.catch(() => {})` seguro para dev/testes).
3. Atualizar `tests/core/architecture.test.ts` com teste verificando as meta tags/links PWA em `index.html` e registro de `sw.js` em `src/main.ts`.
4. Rodar `npm run typecheck`, `npm test` e `npm run build`, confirmando que `dist/manifest.webmanifest`, `dist/sw.js` e `dist/icons/` foram copiados para `dist/`.
**Permitido:** `index.html`, `src/main.ts`, `tests/core/architecture.test.ts`.
**Proibido:** `public/`, `netlify.toml`, `src/core/`, `src/view/`, `docs/` e comandos git (`commit`, `push`, `branch`, `checkout`, `reset`, `stash`).
**Pronto quando:** `npm run typecheck`, `npm test` e `npm run build` passarem 100% verdes e os arquivos PWA constarem em `dist/`.
**Entrega:** até 6 linhas: alterações feitas, contagem de testes, verificação de `dist/` e o que depende de teste no iPhone real.
