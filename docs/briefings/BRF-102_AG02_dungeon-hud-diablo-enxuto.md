# BRF-102 — AG02 (UI) — T-078c Refatoração Diablo Dark Fantasy Enxuta de `DungeonHud.ts` e `VirtualJoystick.ts`

**Leia:** [docs/agentes/AG02_UI.md](../agentes/AG02_UI.md), [src/view/ui/DungeonHud.ts](../../src/view/ui/DungeonHud.ts), [src/view/ui/VirtualJoystick.ts](../../src/view/ui/VirtualJoystick.ts), [src/view/ui/DialogueBox.ts](../../src/view/ui/DialogueBox.ts), [assets/mockups/mockup_interface_layout.jpeg](../../assets/mockups/mockup_interface_layout.jpeg), [assets/mockups/mockup_2d_stylized.jpg](../../assets/mockups/mockup_2d_stylized.jpg). **Regra:** respostas curtas; **PROIBIDO** editar `src/core/`, `DungeonScene.ts`, `BootScene.ts`, `tests/` ou executar `git`.

**Decisão do dono (Decisão #14):** Refatorar o HUD de combate e o Joystick para um **meio-termo entre `mockup_interface_layout.jpeg` (estética Diablo mobile dark fantasy metálica) e `mockup_2d_stylized.jpg` (visual limpo e enxuto)**, usando os novos spritesheets 2D aprovados:
- `ui_icons` (`64×64`, 16 frames): `0: attack`, `1: dash`, `2: skill_inferno`, `3: skill_empireo`, `4: skill_submundo`, `5: potion`, `6: bag`, `7: settings`, `8: audio_on`, `9: audio_off`, `10: souls`, `11: essence`, `12..15: slots`.
- `portraits` (`128×128`, 8 frames): `0: hero_living`, `1: hero_wraith`, `2..7: NPCs/boss`.

**Contrato (compartilhado com AG01 na T-078d):**
- Estender `HudSnapshot` em `src/view/ui/DungeonHud.ts` com campos opcionais (100% retrocompatível):
  ```ts
  heroPortraitFrame?: number;
  heroName?: string;
  heroLevel?: number;
  essences?: number;
  autoAttackEnabled?: boolean;
  isTestArena?: boolean;
  missionObjective?: string;
  minimap?: {
    heroX: number;
    heroY: number;
    arenaWidth: number;
    arenaHeight: number;
    enemies: Array<{ x: number; y: number; isBoss: boolean }>;
  };
  ```
- Estender `callbacks` do construtor de `DungeonHud` com opcionais:
  ```ts
  onBasicAttack?: () => void;
  onToggleAutoAttack?: () => void;
  ```
- **Depth de UI:** TODOS os elementos criados por `DungeonHud` e `VirtualJoystick` DEVEM manter `depth >= 50` (ex.: `1000..1025`) e `scrollFactor(0)` para permanecerem exclusivos na `uiCamera` fixa (`SceneCameraRig`, `zoom = 1`)!

**Fazer:**
1. **`src/view/ui/VirtualJoystick.ts`:**
   - Refatorar `render()` para estilo **D-Pad / Joystick circular translúcido dark fantasy** (anel metálico discreto com 4 setas triangulares N/S/L/O sutis, anel interno e polegar translúcido com brilho metálico/ciano quando ativo, removendo o texto `MOVER` se poluir ou mantendo bem discreto). Preservar integralmente multi-touch (`activePointers: 4`), `deadZone`, `maxRadius`, `isEligibleTouchZone` (garantindo que não conflite com o novo cluster da direita!).
2. **`src/view/ui/DungeonHud.ts`:**
   - **Topo Esquerdo (Hero Frame Diablo):**
     - **Retrato circular** (`portraits` frame `heroPortraitFrame ?? 0`, `setDisplaySize` com círculo metálico bronze/aço e máscara geométrica circular ou moldura circular limpa sobre fundo escuro) + badge `Nv. X` na parte inferior do círculo;
     - Ao lado: nome do herói (`GUERREIRO` / `ESPECTRO`) em dourado/osso, **barra de HP metálica chanfrada** (borda aço escuro + preenchimento vermelho gradiente/brilho + texto `HP/MaxHP`) e barra secundária fina âmbar/ciano abaixo;
     - Logo abaixo do bloco: **tracker enxuto de objetivo** (losango dourado + 1 linha curta `missionObjective` / sala atual).
   - **Topo Direito (Recursos + Minimapa + Atalhos):**
     - **Minimapa circular** dark fantasy (raio `36` PC / `30` Mobile, anel metálico com fundo `#0a0c12` translúcido, cruz/grade sutil, ponto ciano/branco para o Herói, pontos vermelhos para inimigos normais e pontos laranja maiores para Bosses, atualizado via `snapshot.minimap`);
     - À esquerda do minimapa: contador de **Almas** com ícone `ui_icons` frame `10` (e **Essências** frame `11` quando `> 0`);
     - Abaixo do minimapa: linha compacta com 3 botões circulares dark fantasy (`radius: 15–17`):
       - **`AUTO`** (anel dourado aceso quando `autoAttackEnabled !== false`, chama `onToggleAutoAttack?.()`);
       - **Mochila** (`ui_icons` frame `6` + badge numérico se `bagCount > 0`, chama `onToggleInventory?.()`);
       - **Áudio** (`ui_icons` frame `8` ou `9` conforme `soundManager.isMuted()`, alterna mute).
   - **Topo Central (Barra de Boss):**
     - Quando `bossHp !== undefined && bossMaxHp`, barra imponente com moldura metálica sombria, nome do Boss em carmesim/ouro e preenchimento vermelho vivo.
   - **Base Direita (Cluster ergonômico em arco estilo Diablo mobile):**
     - **Botão Principal de Ataque** (maior: `radius: 34` PC / `31` Mobile, anel duplo metálico + brilho brasa, ícone `ui_icons` frame `0` Espada, chama `onBasicAttack?.()` com leve feedback de pulso);
     - **Em arco ao redor do Ataque** (`radius: 23–25`, sem sobrepor entre si nem sair da tela em `360×640` ou `800×600`!):
       - **Skill 1 (`active_1`)**: ícone `ui_icons` (`2` inferno / `4` submundo / `3` empíreo);
       - **Skill 2 (`active_2`)**: ícone `ui_icons` correspondente à força;
       - **Esquiva (`dash`)**: ícone `ui_icons` frame `1` (Bota com rastro ciano);
       - **Poção (`potion`)**: ícone `ui_icons` frame `5` (Frasco vermelho) + badge de cargas (`3`);
     - **Cooldown radial** (arco de progresso em `Graphics.slice` / setor circular escuro sobre o ícone) + número de segundos restante no centro (ocultando rótulo durante cooldown como já exigido na `T-011`) + hotkeys discretas no PC (`Espaço`, `1`, `2`, `Q`, `I`).
   - Preservar modal de fim de run (`victory`/`defeat`), banner temporário, `getMoveVector()`, `resize()`, `destroy()` e fallback seguro caso `ui_icons`/`portraits` ainda não existam.
3. **`src/view/ui/DialogueBox.ts`:**
   - Atualizar apenas o dimensionamento do `portraitSprite` para usar `.setDisplaySize(portraitSize - 8, portraitSize - 8)` em vez de `.setScale(isMobile ? 0.94 : 1.18)` para suportar os novos retratos `128×128` sem estourar o quadro!

**Permitido:** `src/view/ui/DungeonHud.ts`, `src/view/ui/VirtualJoystick.ts`, `src/view/ui/DialogueBox.ts`.
**Proibido:** `src/core/`, `DungeonScene.ts`, `BootScene.ts`, `HubScene.ts`, `tests/`, e qualquer comando `git`.

**Pronto quando:** layout responsivo impecável tanto em `800×600` (PC) quanto em `360×640` (Mobile), zero sobreposição de botões, `depth >= 50` em todos elementos de HUD e revisão estática `strict: true` limpa.

**Entrega:** até 10 linhas: (1) alterações em `DungeonHud.ts`, `VirtualJoystick.ts` e `DialogueBox.ts`, (2) confirmação das coordenadas/responsividade `800×600` e `360×640`, (3) revisão estática (`strict: true`).
