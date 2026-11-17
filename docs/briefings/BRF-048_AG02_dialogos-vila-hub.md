# BRF-048 — AG02 — T-047 DialogueBox com Retratos 2D, Vila Natal vs. Refúgio e Seletor de Fases

**Leia:** `docs/agentes/AG02_UI.md`, `src/core/index.ts`, `src/core/progression/CampaignManager.ts`, `src/view/audio/SoundManager.ts`, `src/view/scenes/HubScene.ts`, `src/view/ui/HubHud.ts`, `src/data/dialogues.json`. **Regra:** respostas curtas; responsividade PC (`800x600`) e Mobile (`360x640`); manter compatibilidade de todos os métodos existentes em `__SUBMUNDO_HUB_DEBUG__`; zero git commands.
**Decisão do dono:** Autorização explícita da `T-047` (M4 `v0.4.0`).
**Fazer:**
1. Criar `src/view/ui/DialogueBox.ts`:
   - Modal/caixa de diálogo responsiva (depth ~1350) exibindo retrato 2D (`portraits` spritesheet, `64x64`, mapeando `PortraitId`: `hero_living: 0`, `hero_wraith: 1`, `weapon_master: 2`, `village_blacksmith: 3`, `emissary: 4`, `spectral_blacksmith: 5`, `infernal_warden: 6`, `system: 7` — com fallback seguro se a textura ainda não existir), moldura estilizada, nome do orador, título, texto com wrap limpo, indicador de página (`1/N`) e botão `"Continuar"`/`"Fechar"` (plus atalho `Enter`/`Espaço`/`Escape`).
   - API pública: `openLines(lines: DialogueLine[], onComplete?: () => void)`, `advanceOrClose()`, `close()`, `isOpen()`, `handleResize()`, `destroy()`.
   - Tocar `soundManager.play('dialogue_blip')` ao abrir/avançar e `soundManager.play('ui_click')` ao fechar.
2. Atualizar `src/view/ui/HubHud.ts`:
   - Suportar no `HubHudSnapshot`: `locationTitle?: string`, `stageLabel?: string`, `canCycleStage?: boolean`, `isPrologue?: boolean`, `isMuted?: boolean`.
   - Adicionar botão compacto de Áudio (`Som` / `Mudo`) e seletor/ciclo de estágio desbloqueado (`onCycleStage?: () => void`) + permitir esconder/adaptar botão do Altar quando `isPrologue === true` (ou rotulá-lo como `Santuário` no Prólogo sem quebrar `openAltar()` via debug).
3. Atualizar `src/view/scenes/HubScene.ts`:
   - Usar `DialogueBox` no lugar do antigo `EmissaryDialogueModalView` inline, abrindo diálogos com retratos 2D!
   - Alternar cenário visual conforme `ensureCampaignProgress(this.profile).phase`:
     - **`'prologue'` (Vila Natal Viva):** fundo quente (`#121a14`), tiles de `village_tiles`, luzes quentes de lanterna, estações usando `village_npcs` (`Mestre de Armas`, `Ferreiro da Vila`, `Santuário da Vila`, `Saída da Missão`).
     - **`'act1'` (Refúgio no Submundo):** cenário espectral atual (`#090b12`, `hub_tiles`, `hub_npcs`, `Emissário Celestial`, `Ferreiro Espiritual`, `Altar de Almas`, `Portal da Fenda`).
   - Diálogos automáticos na entrada: se novo perfil (`!seenDialogues.includes('prologue_welcome')`), exibir `prologue_welcome` + `stage_grotto_intro`; se retorno com `fromRun?.triggeredVillageFall`, exibir `village_fall_boss` → `village_fall_pact` → `act1_briefing`; se vitória em estágio com `victoryDialogueIds` não vistos, exibi-los no `DialogueBox`.
   - Seletor de fase (`selectedStageId` entre `getAvailableStages(this.profile)`), passando `{ profileSnapshot: this.profile, stageId }` ao iniciar `DungeonScene`.
   - Manter toda a API `window.__SUBMUNDO_HUB_DEBUG__` e estender `enterDungeon(stageId?: CampaignStageId)`, `setCampaignPhase(phase: CampaignPhase, stageId?: CampaignStageId)`, `openDialogue(ids: string[])`, `getDialogueBox()`.
   - Integrar `soundManager.unlock()` / `'ui_click'` / `'forge'` / `'altar'` nas ações do Hub.
**Permitido:** `src/view/ui/DialogueBox.ts`, `src/view/ui/HubHud.ts`, `src/view/scenes/HubScene.ts`.
**Proibido:** alterar `src/core/`, `src/data/`, `DungeonScene.ts`, `BootScene.ts` ou executar comandos git.
**Pronto quando:** `npm run typecheck` e `npm run build` limpos (0 erros).
**Entrega:** até 5 linhas resumindo `DialogueBox.ts`, alternância Vila/Refúgio e extensões de `HubScene`/`HubHud`.
