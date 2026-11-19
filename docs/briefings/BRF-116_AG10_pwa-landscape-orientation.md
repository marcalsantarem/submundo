# BRF-116 — AG10 (Plataforma): Orientação Paisagem Exclusiva no PWA (`manifest.webmanifest` e `sw.js`)

## Contexto
Conforme a Decisão #16, o SUBMUNDO agora opera **exclusivamente em modo paisagem (`landscape`)** tanto no Desktop quanto no Mobile (jogado com 2 mãos).

## Arquivos sob sua posse
- `public/manifest.webmanifest`
- `public/sw.js`

## Tarefas Obrigatórias
1. Em `public/manifest.webmanifest`, alterar `"orientation": "any"` para `"orientation": "landscape"`.
2. Em `public/sw.js`, incrementar o identificador `CACHE_NAME` (ex.: `submundo-cache-v0.7.0-landscape`) para garantir invalidação imediata do cache antigo nos dispositivos móveis ao receber o novo layout paisagem e os 18 ícones 2D de UI.
3. Validar que `public/manifest.webmanifest` continua JSON válido.

## Restrições
- **PROIBIDO** executar comandos `git`.
