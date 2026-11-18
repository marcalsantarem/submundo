# BRF-059 — AG02 (UI): Botão de Resetar Save no Hub (T-082)

## Objetivo
Adicionar um botão **Resetar** no `HubHud.ts` (com confirmação em 2 cliques para evitar perda acidental) e conectá-lo na `HubScene.ts` para limpar o `localStorage` e reiniciar a cena do zero no Prólogo (Vila Natal), permitindo ao dono retestar facilmente a parte da vila.

## Arquivos sob sua posse
- `src/view/ui/HubHud.ts`
- `src/view/scenes/HubScene.ts`

## Requisitos Técnicos
1. **`HubHud.ts`:**
   - Adicionar `onResetSave?: () => void;` em `HubHudCallbacks`.
   - Criar `private resetBtn: ActionButton` com texto inicial `'Resetar'`, cor discreta de alerta (`0x1f1215`, borda `0x7f1d1d`, texto `#fca5a5`), sem poluir o HUD.
   - Posicionar `resetBtn` na barra superior tanto em `desktop_landscape` (`800×600`) quanto em `mobile_portrait` (`360×640`), à esquerda do botão `Som` (com folga suficiente para nunca sobrepor `Equip/Baú` nem `Som`).
   - **Confirmação em 2 cliques (sem `window.confirm`):**
     - No 1º clique: `resetArmed = true`, altera texto para `'Confirmar?'` (fundo `0x7f1d1d`, borda `0xef4444`, texto `#ffffff`) e inicia timer de `3500 ms` que desarma de volta para `'Resetar'`.
     - No 2º clique (enquanto armado): limpa o timer, desarma e chama `this.callbacks.onResetSave?.()`.
     - Limpar o timer no `destroy()`.
2. **`HubScene.ts`:**
   - Importar `clearProfileStorage` de `../../core/progression/StorageAdapter`.
   - Passar `onResetSave: () => this.resetSaveAndRestart()` para `HubHud`.
   - Implementar `resetSaveAndRestart()`:
     - Fechar eventuais modais abertos (`altarModal`, `blacksmithModal`, `stashModal`, `dialogueBox`).
     - Chamar `clearProfileStorage()` (e opcionalmente `soundManager.play('ui_click')`).
     - Reiniciar a `HubScene` limpa via `this.scene.restart({})` (sem `transition`, para carregar o perfil novo do Prólogo na Vila Natal com o diálogo inicial).

## Restrições
- Não tocar em `src/core/`, `DungeonScene.ts`, `BootScene.ts` ou `git`.
- Validar com `npm run typecheck` antes de responder.
