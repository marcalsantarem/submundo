# BRF-071 — AG10 (Plataforma) — T-091 Atualização de Cache do Service Worker (`public/sw.js`)

**Leia:** [docs/agentes/AG10_Plataforma.md](../agentes/AG10_Plataforma.md), [public/sw.js](../../public/sw.js). **Regra:** respostas curtas; **PROIBIDO** editar `src/`, `tests/`, `assets/` ou executar `git commit`, `push`, `branch`, `checkout`, `reset` ou `stash`.

**Contexto:** O PWA usa `CACHE_NAME = 'submundo-static-v1'` e `staleWhileRevalidate` para todos os assets estáticos em `public/sw.js`. No mobile, isso faz o navegador/PWA servir spritesheets antigos (`hero_living.png` / `hero_wraith.png` 16f) e bundles antigos em cache em vez da versão nova da rede.

**Fazer (apenas em `public/sw.js`):**
1. Atualizar `CACHE_NAME` para `'submundo-static-v0.5.0-r2'` para que o `activate` apague imediatamente qualquer cache anterior (`submundo-static-v1`, etc.).
2. No listener `fetch`, para rotas de assets sem hash (ou `/assets/` em geral, incluindo `/assets/sprites/*.png`, `/assets/sprites/manifest.json` e `/assets/app.js`), usar `networkFirst(request, true, { cache: 'no-cache' })` (ou `networkFirst(request, true)`), garantindo que clientes online recebam sempre os sprites e código mais recentes e mantendo o fallback offline via cache quando a rede falhar.
3. Manter `networkFirst` para `navigate`/`index.html` e `sw.js` (`no-cache`), além de `staleWhileRevalidate` para ícones/manifesto ou demais estáticos.

**Permitido:** `public/sw.js`.
**Proibido:** `src/`, `tests/`, `assets/`, `package.json`, `netlify.toml`, e qualquer comando `git`.

**Pronto quando:** `public/sw.js` válido em JS, sem erros de sintaxe, com `CACHE_NAME` atualizado e `networkFirst` aplicado a `/assets/`.

**Entrega:** até 6 linhas: (1) alterações feitas em `public/sw.js`, (2) validação realizada.
