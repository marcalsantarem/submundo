# BRF-113 — AG07 (Arquiteto): Tipografia 2D Dark Fantasy (`Cinzel` + Sans-Serif) em `index.html`

## Contexto
Conforme a Decisão #14 e a `T-108`, as telas de UI (Inventário, Cards de Item, Modais e Diálogos) utilizam estilo **Arte 2D estilizada Dark Fantasy** e não Pixel Art. Para que os títulos serifados clássicos (`'Cinzel', 'Palatino Linotype', 'Book Antiqua', Georgia, serif`) e os textos de corpo (`'Segoe UI', system-ui, -apple-system, sans-serif`) renderizem com máxima fidelidade no canvas Phaser, precisamos importar a fonte `Cinzel` no `index.html` e remover `font-family: monospace` do `body`.

## Arquivos sob sua posse
- `index.html`

## Tarefas Obrigatórias
1. Em `index.html`, adicionar no `<head>` o preconnect e stylesheet do Google Fonts para `Cinzel:wght@600;700;800` (`display=swap`).
2. Substituir `font-family: monospace;` no `html, body` por `font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;`.

## Restrições
- **PROIBIDO** executar comandos `git`.
