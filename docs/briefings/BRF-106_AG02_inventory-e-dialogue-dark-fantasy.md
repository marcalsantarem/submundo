# BRF-106 — AG02 (UI) — T-079a Refatoração Dark Fantasy de `InventoryModal.ts` e `DialogueBox.ts`

**Leia:** [docs/agentes/AG02_UI.md](../agentes/AG02_UI.md), [src/view/ui/InventoryModal.ts](../../src/view/ui/InventoryModal.ts), [src/view/ui/DialogueBox.ts](../../src/view/ui/DialogueBox.ts), [src/view/ui/DungeonHud.ts](../../src/view/ui/DungeonHud.ts) (referência da paleta metálica Diablo Dark Fantasy). **Regra:** respostas curtas; **PROIBIDO** editar `DungeonHud.ts`, `HubHud.ts`, `AltarModal.ts`, `BlacksmithModal.ts`, `src/core/`, `tests/` ou executar `git`.

**Fazer:**
1. **`src/view/ui/InventoryModal.ts`:**
   - Refatorar o painel para a paleta dark fantasy metálica (`#0d0f16` / `#161924`, bordas bronze/aço `#8a7048` / `#525a6e`, cantos chanfrados e divisórias douradas sutis).
   - Nos 4 slots equipados (`weapon`, `armor`, `amulet`, `ring`) e no cabeçalho (`bag`), exibir os ícones 2D de `ui_icons` (`12: weapon`, `13: armor`, `14: amulet`, `15: ring`, `6: bag`) com verificação segura de textura/frame (`hasTextureFrame`) para não quebrar em fallbacks.
   - Preservar 100% da API pública (`open`, `close`, `isOpen`, `update`, `resize`, `destroy`), comparação de atributos, botão fechar, `depth >= 1080` e layout limpo sem sobreposição em `800×600` e `360×640`.
2. **`src/view/ui/DialogueBox.ts`:**
   - Refatorar a caixa de diálogo para moldura metálica dark fantasy chanfrada com detalhe bronze/aço e moldura dupla refinada ao redor do retrato `128×128` (`portraits`), preservando `PORTRAIT_FRAME_MAP`, `PORTRAIT_THEME`, `isOpen`, `open`, `advance`, `close`, `handleResize`, `destroy` e `depth >= 1090`.

**Permitido:** `src/view/ui/InventoryModal.ts`, `src/view/ui/DialogueBox.ts`.
**Proibido:** qualquer outro arquivo e comandos `git`.

**Entrega:** até 6 linhas: alterações nos 2 arquivos, checagem de responsividade `800×600`/`360×640` e revisão estática (`strict: true`).
