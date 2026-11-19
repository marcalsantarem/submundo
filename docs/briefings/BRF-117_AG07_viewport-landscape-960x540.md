# BRF-117 — AG07 (Arquiteto): Arquitetura de Modo Paisagem Exclusivo (`960×540`, `16:9`)

## Contexto
Conforme a Decisão #16, o SUBMUNDO deixa de suportar modo retrato (`9:16`) e passa a operar **exclusivamente em modo paisagem (`960×540`, `16:9`)** tanto no PC quanto no Mobile (jogado com as duas mãos).

## Arquivos sob sua posse
- `src/core/index.ts`
- `src/main.ts`
- `index.html`
- `tests/core/architecture.test.ts`

## Tarefas Obrigatórias
1. **`src/core/index.ts`:**
   - Alterar `ViewportMode` para `'landscape'`.
   - Atualizar `ViewportConfig`:
     ```ts
     export interface ViewportConfig {
       mode: ViewportMode;
       width: number;
       height: number;
       aspectRatio: string;
       isPortraitWindow?: boolean;
     }
     ```
   - Atualizar `resolveViewportConfig(windowWidth: number, windowHeight: number)` para retornar **sempre**:
     ```ts
     {
       mode: 'landscape',
       width: 960,
       height: 540,
       aspectRatio: '16:9',
       isPortraitWindow: windowWidth < windowHeight,
     }
     ```
   - Zero import de Phaser em `src/core/index.ts`.
2. **`src/main.ts`:**
   - Garantir que `createGameConfig(viewport)` configure `960×540`, `Phaser.Scale.FIT`, `Phaser.Scale.CENTER_BOTH`, `activePointers: 4`, `antialias: true`, `pixelArt: false`.
   - Em `bootstrapGame()`, manter o tamanho lógico em `960×540` no resize/orientationchange chamando `game.scale.refresh()`.
   - Adicionar tentativa segura (`try/catch`, sem erro se bloqueado pelo browser) de travar orientação em paisagem (`screen.orientation?.lock?.('landscape')`) no primeiro toque/interação em dispositivos touch.
   - Conectar o botão opcional `#rotate-dismiss-btn` do overlay de rotação (se existir no DOM) para ocultar manualmente o aviso caso o usuário queira continuar sem girar.
3. **`index.html`:**
   - Manter links do Google Fonts (`Cinzel:wght@600;700;800`), meta tags PWA/iOS e `touch-action: none` / `user-select: none`.
   - Fazer `#game-container` ocupar até `100vw` / `100dvh` mantendo a moldura elegante no desktop e aproveitando a tela inteira no mobile paisagem (`@media (max-width: 960px)` sem borda externa grossa).
   - Adicionar overlay Dark Fantasy `#rotate-overlay` (com ícone SVG limpo de celular girando + título `GIRE O DISPOSITIVO` em `Cinzel` + texto `SUBMUNDO é jogado em modo paisagem (horizontal) com as duas mãos.` + botão discreto `#rotate-dismiss-btn` `"Continuar mesmo assim"`), visível **apenas** em `@media (orientation: portrait) and (pointer: coarse)` (assim nunca bloqueia testes headless nem janelas desktop estreitas).
4. **`tests/core/architecture.test.ts`:**
   - Atualizar os testes de `resolveViewportConfig` para validar que tanto janelas paisagem (`1920×1080`, `960×540`, `844×390`) quanto retrato (`360×640`, `390×844`) resolvem para `mode: 'landscape'`, `width: 960`, `height: 540`, `aspectRatio: '16:9'` com `isPortraitWindow` correto (`false` em paisagem, `true` em retrato).
   - Adicionar verificação de que `index.html` contém `#rotate-overlay` e `public/manifest.webmanifest` contém `"orientation": "landscape"`.

## Restrições
- Manter `GAME_VERSION` em `0.6.0` nesta onda (`T-080` subirá para `0.7.0` na Onda 3).
- **PROIBIDO** executar comandos `git`.
