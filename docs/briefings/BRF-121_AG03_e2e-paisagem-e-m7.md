# BRF-121 — AG03 (QA): Atualização da Suíte E2E para Modo Paisagem Exclusivo (`960×540` / `844×390`) e `m7-ui-landscape.spec.ts`

## Contexto
Conforme a Decisão #16, o SUBMUNDO passou a operar **exclusivamente em Modo Paisagem (`960×540`, `16:9`)** tanto no Desktop quanto no Mobile (2 mãos). Todos os testes E2E anteriores que testavam `360×640` retrato precisam ser atualizados para validar **PC Paisagem (`960×540`)** e **Mobile Paisagem (`844×390`)**, além de criar a cobertura específica do M7 (`tests/e2e/m7-ui-landscape.spec.ts`).

## Arquivos sob sua posse
- `playwright.config.ts`
- `tests/e2e/m1-dungeon.spec.ts`
- `tests/e2e/m2-loot.spec.ts`
- `tests/e2e/m3-hub.spec.ts`
- `tests/e2e/m4-campaign.spec.ts`
- `tests/e2e/m5-hero.spec.ts`
- `tests/e2e/m6-monsters.spec.ts`
- `tests/e2e/m7-ui-landscape.spec.ts` (criar novo)

## Tarefas Obrigatórias
1. **`playwright.config.ts`:** atualizar `viewport` padrão para `{ width: 960, height: 540 }`.
2. **Atualizar `tests/e2e/m1..m6`:**
   - Trocar viewports de teste desktop `800×600` → `960×540` e mobile retrato `360×640` → **mobile paisagem `844×390`** (`hasTouch: true`), atualizando as asserções de largura/altura do canvas (`960×540` / proporção `16:9` com `Phaser.Scale.FIT`) e garantindo zero erros de console/página.
3. **Criar `tests/e2e/m7-ui-landscape.spec.ts`:**
   - Validar assets 2D de UI: `public/assets/sprites/ui_icons.png` (`1152×64`, 18 frames `64×64` incluindo `slot_helm` e `slot_boots`), `public/assets/sprites/portraits.png` (`1024×128`, 8 frames `128×128`) e `manifest.json`.
   - Validar que `public/manifest.webmanifest` define `"orientation": "landscape"` e `index.html` contém `#rotate-overlay` e a fonte `Cinzel`.
   - Validar que `src/view/ui/DarkFantasyUiBuilder.ts`, `ItemTooltipCard.ts`, `InventoryModal.ts`, `DungeonHud.ts`, `HubHud.ts`, `BlacksmithModal.ts`, `AltarModal.ts` e `DialogueBox.ts` não possuem `'monospace'` nem `'mobile_portrait'`.
   - Em navegador real (PC `960×540` e Mobile Paisagem `844×390` touch): abrir a cena inicial, confirmar canvas paisagem sem erros, abrir o inventário (tecla `I` ou botão Mochila), confirmar presença de renderização limpa sem exceptions e salvar capturas `docs/qa/screenshots/m7-desktop-landscape.png` e `docs/qa/screenshots/m7-mobile-landscape.png`.

## Restrições
- **PROIBIDO** alterar código de produção (`src/`).
- **PROIBIDO** executar comandos `git`.
