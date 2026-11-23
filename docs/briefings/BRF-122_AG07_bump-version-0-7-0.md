# BRF-122 — AG07 (Arquiteto): Subir Versão do Projeto para `0.7.0` (`T-080`)

## Contexto
Com a conclusão da UI 2D Dark Fantasy, painel de 6 slots, gerador de UI/cards e conversão integral para Modo Paisagem Exclusivo (`960×540`), vamos preparar o fechamento do **Marco M7 (`v0.7.0`)**.

## Arquivos sob sua posse
- `package.json`
- `src/version.ts`
- `tests/core/architecture.test.ts`

## Tarefas Obrigatórias
1. Atualizar `"version"` em `package.json` de `"0.6.0"` para `"0.7.0"`.
2. Atualizar `GAME_VERSION` em `src/version.ts` de `'0.6.0'` para `'0.7.0'`.
3. Atualizar o teste de versão em `tests/core/architecture.test.ts` de `'0.6.0'` para `'0.7.0'`.
4. Validar sintaxe de `package.json` e consistência entre os 3 arquivos.

## Restrições
- **PROIBIDO** executar comandos `git`.
