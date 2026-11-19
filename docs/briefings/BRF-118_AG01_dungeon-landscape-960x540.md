# BRF-118 — AG01 (Gameplay): DungeonGenerator e DungeonScene em Modo Paisagem Exclusivo (`960×540`)

## Contexto
Conforme a Decisão #16, o SUBMUNDO agora roda exclusivamente em **Modo Paisagem (`960×540`, `16:9`)**. `ViewportMode` agora é exclusivamente `'landscape'`.

## Arquivos sob sua posse
- `src/core/dungeon/DungeonGenerator.ts`
- `src/view/scenes/DungeonScene.ts`

## Tarefas Obrigatórias
1. **`src/core/dungeon/DungeonGenerator.ts`:**
   - Atualizar `DEFAULT_ARENA_WIDTH = 960` e `DEFAULT_ARENA_HEIGHT = 540`.
   - Preservar integralmente a assinatura `createDungeonRun(arenaWidth?, arenaHeight?, seed?, stage?)` e o comportamento determinístico para que todos os testes unitários existentes continuem passando.
   - Zero import de Phaser em `src/core/`.
2. **`src/view/scenes/DungeonScene.ts`:**
   - Remover todas as comparações `=== 'mobile_portrait'` e substituir dimensões fallback `800` / `600` por `960` / `540`.
   - Unificar `getWorldZoom()` para retornar `1.45` (zoom equilibrado para a arena `960×540` tanto em PC quanto em Mobile paisagem).
   - Garantir que `testArena: true`, as 2 ondas de monstros/bosses, os 6 slots de equipamento (`['weapon', 'armor', 'helm', 'boots', 'amulet', 'ring']`), o minimapa e o `InventoryModal` funcionem sem nenhuma regressão.

## Restrições
- Compatibilidade total com TypeScript `strict: true` (lembre-se que `ViewportMode` é apenas `'landscape'`).
- **PROIBIDO** executar comandos `git`.
