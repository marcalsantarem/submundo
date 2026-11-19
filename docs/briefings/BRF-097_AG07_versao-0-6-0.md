# BRF-097 — AG07 (Arquiteto) — T-071a Subir Versão para `0.6.0`

**Leia:** [docs/agentes/AG07_Arquiteto.md](../agentes/AG07_Arquiteto.md). **Regra:** respostas curtas; **PROIBIDO** editar `src/view/`, `src/core/`, `docs/qa/` ou executar `git`.

**Fazer:**
1. Subir a versão de `0.5.0` para **`0.6.0`** em:
   - `package.json` (`"version": "0.6.0"`)
   - `src/version.ts` (`GAME_VERSION = '0.6.0'`)
   - `tests/core/architecture.test.ts` (`expect(GAME_VERSION).toBe('0.6.0')`)

**Permitido:** `package.json`, `src/version.ts`, `tests/core/architecture.test.ts`.
**Proibido:** qualquer outro arquivo e comandos `git`.

**Entrega:** até 4 linhas: arquivos atualizados e confirmação de revisão estática.
