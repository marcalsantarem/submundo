# BRF-107 — AG02 (UI) — T-079b Refatoração Dark Fantasy de `HubHud.ts`, `AltarModal.ts` e `BlacksmithModal.ts`

**Leia:** [docs/agentes/AG02_UI.md](../agentes/AG02_UI.md), [src/view/ui/HubHud.ts](../../src/view/ui/HubHud.ts), [src/view/ui/AltarModal.ts](../../src/view/ui/AltarModal.ts), [src/view/ui/BlacksmithModal.ts](../../src/view/ui/BlacksmithModal.ts), [src/view/ui/DungeonHud.ts](../../src/view/ui/DungeonHud.ts) (referência de paleta). **Regra:** respostas curtas; **PROIBIDO** editar `DungeonHud.ts`, `InventoryModal.ts`, `DialogueBox.ts`, `src/core/`, `tests/` ou executar `git`.

**Fazer:**
1. **`src/view/ui/HubHud.ts`:**
   - Refatorar o painel superior, botões de atalho e botões de ação para o estilo Diablo Dark Fantasy metálico (`#0d0f16` / `#161924`, bordas bronze `#8a7048` e aço `#525a6e`, cantos chanfrados).
   - Usar ícones 2D de `ui_icons` (`10: souls`, `11: essence`, `8/9: audio_on/off`, `6: bag`, `0: attack` para Entrar na Fenda) com fallback seguro (`hasTextureFrame`), preservando o botão `Resetar` (confirmação em 2 cliques), `getMoveVector()`, `update()`, `resize()`, `destroy()` e `depth >= 1010`.
2. **`src/view/ui/AltarModal.ts` e `src/view/ui/BlacksmithModal.ts`:**
   - Refatorar ambos os modais para a mesma estética dark fantasy metálica chanfrada (usando `ui_icons` `10: souls`, `11: essence` e `12..15: slots` onde couber, com fallback seguro), preservando integralmente todas as assinaturas públicas, callbacks, textos em pt-BR, `depth >= 1080` e layout sem sobreposição em `800×600` e `360×640`.

**Permitido:** `src/view/ui/HubHud.ts`, `src/view/ui/AltarModal.ts`, `src/view/ui/BlacksmithModal.ts`.
**Proibido:** qualquer outro arquivo e comandos `git`.

**Entrega:** até 6 linhas: alterações nos 3 arquivos, checagem de responsividade `800×600`/`360×640` e revisão estática (`strict: true`).
