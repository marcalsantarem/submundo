# BRF-002 — AG10 — T-002 Configuração de deploy no Netlify e CI no GitHub Actions

**Leia:** `docs/agentes/AG10_Plataforma.md`, `docs/metodo/Deploy.md`, `docs/metodo/URL.txt`. **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono:** Decisão #4 (Vitest) e Decisão #5 (M1 `v0.1.0`).
**Contrato:**
- O `package.json` (criado em paralelo pelo AG07) expõe `npm run typecheck`, `npm test` e `npm run build`, gerando o bundle estático na pasta `dist/`.
**Fazer:**
1. Criar `netlify.toml` configurando `command = "npm run build"`, `publish = "dist"`, `NODE_VERSION = "24"`, contextos `production` (`main`), `branch-deploy` (`dev`) e `deploy-preview`, além de cabeçalhos de segurança/cache básicos.
2. Criar `.github/workflows/ci.yml` executando em `push` (`main`, `dev` e tags `v*`) e `pull_request` (`main`, `dev`) em Ubuntu com Node 24: `npm ci`, `npm run typecheck`, `npm test` e `npm run build`.
**Permitido:** `netlify.toml`, `.github/workflows/ci.yml`.
**Proibido:** `package.json`, `src/`, `tests/`, `docs/` e comandos git (`commit`, `push`, `branch`, `checkout`, `reset`, `stash`).
**Pronto quando:** `netlify.toml` e `.github/workflows/ci.yml` estiverem criados e validados sintaticamente.
**Entrega:** até 5 linhas: arquivos criados, validações feitas, o que depende de execução remota (GitHub/Netlify) e próximo passo.
