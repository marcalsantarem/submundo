# BRF-154 — AG01 (Gameplay): Integração de Retorno da `DungeonScene` pelo Portão da Vila Natal (Parte Gameplay de T-139)

- **Task:** Parte Gameplay de `T-139` (M9 — `v0.9.0`, Decisão #23)
- **Agente:** `AG01 (Gameplay)`
- **Arquivo sob sua posse exclusiva nesta onda:**
  - `src/view/scenes/DungeonScene.ts`

## Objetivo
Garantir que, ao concluir (vitória/extração) ou morrer em uma incursão iniciada a partir da Vila Natal (`HubScene`) e retornar ao Hub (`returnToHub()`), a `DungeonScene.ts` envie o sinal `returnedFromDungeon: true` (junto com `fromRun` e `stageId`) para que a `HubScene` posicione o herói de volta no **Portão de Pedra (`"SAÍDA"`)** da Vila Natal.

## Requisitos Técnicos Obrigatórios

1. **`returnToHub()` em `src/view/scenes/DungeonScene.ts`:**
   - Atualizar `returnToHub()` para passar:
     ```ts
     if ('HubScene' in this.scene.manager.keys) {
       this.scene.start('HubScene', {
         fromRun: this.lastRunReport,
         stageId: this.campaignStageId,
         returnedFromDungeon: true,
       });
       return;
     }
     ```
2. **Verificar transições de fim de run (vitória / morte) na `DungeonScene.ts`:**
   - Conferir todos os pontos de `DungeonScene.ts` que chamam `this.scene.start('HubScene', ...)` ou `this.returnToHub()` (incluindo botões de modal de fim de run, tecla de retorno e `window.__SUBMUNDO_DEBUG__.returnToHub()`).
   - Se `returnToHub()` for chamado via debug API (`window.__SUBMUNDO_DEBUG__.returnToHub()`) sem um `lastRunReport` finalizado (por exemplo, quando um helper de teste E2E navega para a `HubScene`), `returnedFromDungeon` deve ser `Boolean(this.lastRunReport)` (ou seja: `true` quando realmente houve fim de run ou quando o jogador retornou de uma incursão, e `false` se foi apenas um redirect técnico de boot antes de qualquer run terminar!).
   - Vamos deixar explícito:
     ```ts
     public returnToHub(options?: { returnedFromDungeon?: boolean }): void {
       if ('HubScene' in this.scene.manager.keys) {
         const returned = options?.returnedFromDungeon ?? Boolean(this.lastRunReport);
         this.scene.start('HubScene', {
           fromRun: this.lastRunReport,
           stageId: this.campaignStageId,
           returnedFromDungeon: returned,
         });
         return;
       }
       this.startNewRun();
     }
     ```
   - E nos botões/fluxos de vitória e morte da incursão (onde o jogador clica para voltar ao Hub após concluir ou morrer na masmorra), chamar `this.returnToHub({ returnedFromDungeon: true })`.

## Restrições
- **Proibido executar comandos `git`.**
- Editar **apenas** `src/view/scenes/DungeonScene.ts` (não tocar em `BootScene.ts`, `HubScene.ts`, `src/view/ui/` ou `src/core/`).
