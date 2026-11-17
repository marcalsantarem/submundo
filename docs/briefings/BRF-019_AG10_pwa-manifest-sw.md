# BRF-019 — AG10 — T-027 Configuração PWA instalável (Manifest, Service Worker e Netlify)

**Leia:** `docs/agentes/AG10_Plataforma.md`, `netlify.toml`, `vite.config.ts`. **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono:** Pedido do dono para transformar o jogo em PWA instalável no iPhone.
**Contrato (alinhado com `T-026` e `T-028`):**
- Ícones em `./icons/icon-192.png` (`192x192`), `./icons/icon-512.png` (`512x512`) e `./icons/apple-touch-icon.png` (`180x180`).
- `public/manifest.webmanifest`:
  - `name`: `"SUBMUNDO — Action RPG"`
  - `short_name`: `"SUBMUNDO"`
  - `start_url`: `"./"`
  - `scope`: `"./"`
  - `display`: `"standalone"`
  - `orientation`: `"any"`
  - `background_color`: `"#09090b"`
  - `theme_color`: `"#09090b"`
  - `lang`: `"pt-BR"`
  - `icons` apontando para `./icons/icon-192.png` e `./icons/icon-512.png` (`purpose: "any maskable"` ou entradas separadas `any`).
- `public/sw.js`: Service Worker leve (network-first para `index.html` e `sw.js`, cache-first ou stale-while-revalidate para assets estáticos, sem quebrar atualizações na `dev`/`main`).
- `netlify.toml`: cabeçalhos `Cache-Control: no-cache` para `/sw.js` e `Content-Type: application/manifest+json; charset=utf-8` para `/manifest.webmanifest`.
**Fazer:**
1. Criar `public/manifest.webmanifest` e `public/sw.js`.
2. Atualizar `netlify.toml` com os cabeçalhos PWA.
3. Validar o JSON de `manifest.webmanifest`, sintaxe de `sw.js` (`node --check public/sw.js`) e `netlify.toml` (`tomllib`).
**Permitido:** `public/manifest.webmanifest`, `public/sw.js`, `netlify.toml`.
**Proibido:** `index.html`, `src/`, `public/icons/`, `package.json` e comandos git.
**Pronto quando:** arquivos criados e validados sintaticamente.
**Entrega:** até 5 linhas: arquivos criados/atualizados, validações executadas e dependência da `T-028` (`index.html`/`src/main.ts`).
