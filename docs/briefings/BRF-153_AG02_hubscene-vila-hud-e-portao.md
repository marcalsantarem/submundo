# BRF-153 — AG02 (UI): Cena da Vila Natal na `HubScene`, `HubHud` Enxuto e `VillageGateModal` (T-138 + UI de T-139)

- **Task:** `T-138` e parte UI de `T-139` (M9 — `v0.9.0`, Decisão #23)
- **Agente:** `AG02 (UI)`
- **Arquivos sob sua posse exclusiva nesta onda:**
  - `src/view/scenes/HubScene.ts`
  - `src/view/ui/HubHud.ts`
  - `src/view/ui/VillageGateModal.ts` (novo arquivo)

## Referências Obrigatórias (leia antes de codar)
1. `assets/mockups/mockup_m9_village_hub.png` (abra com `read_file`) e `scripts/art/buildVillageHubMockup.py` (veja a composição aprovada pelo dono!).
2. `src/core/progression/VillageHubManager.ts` (`resolveVillageHubState`, `markSpokenToMaster`, `getPrologueDungeonList`, `hasSpokenToMasterForCurrentMission`, `VillageDungeonEntry`, `VillageHubState`).
3. `src/data/dialogues.json` (chaves `village_master_prologue_grotto`, `village_master_prologue_mine`, `village_master_prologue_seal`, `village_master_idle`, `village_lyra_talk`, `village_gorran_talk`, `village_gate_locked`).
4. `docs/decisoes.md` (Decisão #23).

## Objetivo
Transformar a `HubScene.ts` (no modo Prólogo / Vila Natal) e o `HubHud.ts` na **Vila Natal 2.5D funcional** idêntica ao mockup aprovado `assets/mockups/mockup_m9_village_hub.png`, com mapa de ~1,5 tela (`1280×720`), câmera seguindo o herói (`zoom = 1.45`), colisão com estruturas/obstáculos, os 3 NPCs `80×80` com nomes e `"!"` dourado no Mestre, props animados (fogueira, forja, braseiro, tochas), HUD enxuto da vila com minimapa e botão `Interagir`, e o modal do Portão (`VillageGateModal.ts`) com a lista das 3 dungeons do prólogo.

## Requisitos Técnicos Obrigatórios

### 1. `src/view/ui/VillageGateModal.ts` (Novo Modal da Lista de Dungeons do Portão)
- Construir com `DarkFantasyUiBuilder.ts` (`drawOrnatePanel`, `drawOrnateButton`, `DF_FONTS`, `DF_PALETTE`), `scrollFactor(0)`, `depth(2300)`, centralizado em `960×540`.
- Recebe `entries: VillageDungeonEntry[]` (de `getPrologueDungeonList(profile)`) e callbacks `{ onSelectStage: (stageId: CampaignStageId) => void; onClose: () => void }`.
- Título: `"PORTÃO DE SAÍDA"` e subtítulo `"Escolha a missão nos arredores da Vila Natal"`.
- Exibe os 3 cards das dungeons do prólogo (*Gruta da Cachoeira* `prologue_grotto`, *Mina Abandonada* `prologue_mine`, *O Selo Antigo* `prologue_seal`):
  - Cada card mostra: nome da dungeon, descrição/objetivo curto (`entry.stage.subtitle` ou `description`), badge de status e botão de ação:
    - `status === 'available'`: badge dourado `"LIBERADA"` (ou `"MISSÃO ATUAL"` quando `entry.isNextMission`), botão **`Entrar`** ativo (`variant: 'gold'`, chama `onSelectStage(entry.stage.id)`).
    - `status === 'completed'`: badge verde `"✓ CONCLUÍDA"`, botão **`Explorar`** ativo (`variant: 'primary'`, chama `onSelectStage(entry.stage.id)`).
    - `status === 'locked'`: card mais escuro com badge **`"🔒 TRAVADA"`** e botão **`Travada`** desabilitado (`!entry.canEnter`).
- Botão de fechar `[X]` no topo direito (e tecla `Escape`).
- Expor métodos públicos para inspeção e E2E: `open(entries: VillageDungeonEntry[])`, `close()`, `isOpen(): boolean`, `getEntries(): VillageDungeonEntry[]`, `selectStage(stageId: CampaignStageId): boolean`, `resize(viewport: ViewportConfig)`.

### 2. `src/view/ui/HubHud.ts` (HUD Enxuto da Vila no Prólogo — Decisão #23)
- Estender `HubHudSnapshot` com campos opcionais para a Vila:
  - `heroHp?: number; heroMaxHp?: number; heroLevel?: number; heroName?: string;`
  - `trackerTitle?: string; trackerText?: string;`
  - `heroNormalizedPos?: Vector2D;` (0..1 dentro do mapa para o minimapa)
  - `masterExclamation?: boolean;`
  - `gateUnlocked?: boolean;`
- Quando `snapshot.isPrologue === true` (Vila Natal), renderizar **exatamente o layout aprovado em `assets/mockups/mockup_m9_village_hub.png`**:
  1. **Canto Superior Esquerdo:**
     - Retrato circular do herói (`portraits` frame 0, centro `(46, 44)`, raio `32`, aro metálico duplo bronze/ouro e badge `"Nv. 1"` na base do retrato).
     - Nome `"JOVEM GUERREIRO"` em `DF_FONTS.TITLE` (`x = 88, y = 17`), barra de HP vermelha chanfrada (`x = 86, y = 30, w = 188, h = 18`) com texto `"100/100"` e barra secundária fina abaixo.
     - **Tracker da Missão (`x = 16, y = 94`):** losango dourado + título `"VILA NATAL"` (`DF_FONTS.TITLE`, dourado) + objetivo dinâmico (`snapshot.trackerText ?? 'Falar com o Mestre'`, em `DF_FONTS.BODY`, cor pergaminho) + linha divisória fina ouro/bronze.
  2. **Canto Inferior Esquerdo:**
     - `VirtualJoystick` translúcido (`(104, height - 104)`).
  3. **Canto Superior Direito:**
     - **Minimapa Circular (`cx = width - 60, cy = 60, r = 46`):** fundo escuro circular com aro duplo bronze/ouro e `"N"` no topo; desenha o contorno estilizado da clareira da vila com a saída norte do portão, pontos fixos dos 3 NPCs (dourado para Mestre à esquerda, verde para Lyra ao fundo-esquerda, laranja para Gorran à direita), ponto da fogueira no centro e o **triângulo ciano do herói** movendo-se conforme `snapshot.heroNormalizedPos`!
     - **3 Botões Circulares Compactos abaixo do minimapa (`y = 128`, raio `18`, espaçamento `50`):**
       - `Inventário` (`x = width - 134`, ícone `DF_UI_ICON_FRAMES.bag`, chama `onOpenStash()`)
       - `Áudio` (`x = width - 84`, ícone `audio_on`/`audio_off`, chama `onToggleMute()`)
       - `Config.` (`x = width - 34`, ícone de engrenagem desenhado em Graphics 2D limpo, chama `onResetSave()` com confirmação em 2 cliques igual ao botão Resetar).
  4. **Canto Inferior Direito:**
     - **Botão Circular Principal `Interagir` (`cx = width - 92, cy = height - 104, r = 42`):**
       - Medallão circular carmesim/dourado ornamentado (mesmo estilo do mockup aprovado), ícone 2D de diálogo/interação no centro e título **`"INTERAGIR"`** em `DF_FONTS.TITLE` (`Cinzel`).
       - Quando `snapshot.nearbyStationLabel` está definido (herói próximo de um NPC ou do Portão), o botão acende com halo dourado pulsante e mostra um subtítulo/prompt acima ou abaixo com o alvo (ex.: `"Mestre de Armas"`). Ao clicar/tocar (ou apertar `E` / `Space`), chama `callbacks.onInteract?.()`.
  5. **O que ocultar quando `snapshot.isPrologue === true`:**
     - Ocultar a barra superior antiga de Almas/Essências/Equipados e ocultar os botões antigos de `Altar`, `Ferreiro`, `Fase` e `Incursão` (mantendo-os visíveis apenas quando `snapshot.isPrologue === false`, no Ato 1 / Refúgio do Submundo!).

### 3. `src/view/scenes/HubScene.ts` (Cena 2.5D da Vila Natal — `T-138` e `T-139`)
- **Dimensões do Mapa da Vila (~1,5 tela com câmera seguindo o herói — Decisão #23):**
  - Quando `isPrologue === true`, usar **`VILLAGE_WORLD_WIDTH = 1280`** e **`VILLAGE_WORLD_HEIGHT = 720`** (com `HUB_WORLD_ZOOM = 1.45` no `SceneCameraRig`, `boundsWidth = 1280`, `boundsHeight = 720`, câmera seguindo `this.heroSprite` e `uiCamera` fixa em `zoom = 1`).
- **Cenário 2.5D da Vila Natal (fiel a `assets/mockups/mockup_m9_village_hub.png`):**
  - Construir o mapa da Vila em `buildArenaTilesAndLighting` (quando `isPrologue`):
    - **Piso em tiles `32×32` (`village_hub_tiles`, `biome_herb_field_tiles`, `biome_village_tiles`):**
      - Bordas externas com grama (`village_hub_tiles` frames `4, 5` / `biome_herb_field_tiles` frames `0..2`);
      - Clareira central ampla de terra batida (`village_hub_tiles` frames `0, 1, 2, 3`) com transições (`frames 6, 7`);
      - Pátio de paralelepípedos (`village_hub_tiles` frame `9` / `biome_village_tiles` frames `0..2`) diante da Casa de Palha (noroeste) e na estrada que sobe do centro até o Portão de Pedra (nordeste);
      - Área de cinzas e pedra (`village_hub_tiles` frames `8, 9`) ao redor da fogueira central e da Forja do Gorran (leste).
    - **Perímetro 2.5D:**
      - Copas de floresta/sebes (`biome_herb_field_tiles`) e árvores (`biome_village_props_tall` frame `1` `tree_oak`) ao redor da borda externa;
      - **Paliçada alta 2.5D de toras apontadas** (`village_hub_props_large` frame `10` `palisade_tall_h` e frame `11` `palisade_tall_v`) cercando o norte, oeste, leste e sul (com abertura central na paliçada sul).
    - **Estruturas 2.5D e Props Animados (com Y-depth sorting para o herói passar na frente/atrás):**
      - **Casa de Palha (`village_hub_house`, `224×192`):** posicionada no quadrante superior-esquerdo (ex.: centro em `(330, 195)`), com barril/lenha (`village_hub_props` frames `24, 25`) à esquerda e **Braseiro animado** (`village_hub_props` com anim `village_brazier_idle`, ou frame `10`) à direita da porta `(418, 286)`.
      - **Portão de Pedra com `"SAÍDA"` (`village_hub_gate`, `192×160`):** posicionado no quadrante superior-direito sobre a estrada norte (ex.: centro em `(860, 175)`), com **Carroça grande (`village_hub_props_large` frame `9` `wooden_cart_large`)** estacionada à esquerda do pilar `(735, 240)` e **Tocha animada** (`village_hub_props` `village_torch_idle`, frame `14`) em `(690, 215)`.
      - **Fogueira Central Grande (`village_hub_props_large` com anim `village_campfire_large_idle`, frame `0`):** no centro da clareira `(640, 390)`, com halo quente pulsante em `lightingGraphics`.
      - **Forja e Bigorna à direita:** **Bigorna grande (`village_hub_props_large` frame `8` `anvil_large`)** em `(885, 395)`, **Forja grande animada (`village_hub_props_large` com anim `village_forge_large_idle`, frame `4`)** em `(985, 385)`, mais barril/roda de carroça (`village_hub_props` frames `25, 26`) e tocha sul em `(480, 540)`.
- **Colisão Sólida na Vila (`T-138`):**
  - Definir retângulos de colisão (`VillageObstacleRect[]`) para:
    1. Casa de Palha (tronco/base da casa: ex. `x: 225..435, y: 120..278`);
    2. Pilar esquerdo do Portão (`x: 765..825, y: 110..248`) e Pilar direito do Portão (`x: 895..955, y: 110..248`), deixando o vão central (`x: 826..894`) livre até a linha do portão (`y = 215`);
    3. Carroça grande (`x: 705..765, y: 215..262`);
    4. Fogueira central (`x: 616..664, y: 372..412`);
    5. Bigorna e Forja (`x: 860..1020, y: 360..418`);
    6. Limites internos da paliçada (`minX: 160, maxX: 1120, minY: 190, maxY: 575`).
  - Ao mover o herói em `update()` no modo prólogo, aplicar resolução de colisão por eixo (testar novo `x` contra os retângulos; se colidir, reverter `x`; testar novo `y` contra os retângulos; se colidir, reverter `y`) para que o herói colida e deslize suavemente sem atravessar casa, paliçada, forja, carroça ou fogueira!
- **Os 3 NPCs `80×80` + Portão Interativo (substituindo os 4 pontos antigos no prólogo):**
  - No prólogo (`isPrologue === true`), criar os 4 pontos interativos:
    1. **`emissary` → Mestre de Armas (`npc_weapon_master`, `80×80`, `scale = 0.88`, anim `npc_weapon_master_idle`):** posição `(310, 410)`, rótulo `"Mestre de Armas"` sobre a cabeça (`y = -40`) e um **`"!"` dourado grande pulsante (`fontSize: '24px'`, `#facc15`)** em `y = -62` visível enquanto `villageState.showMasterExclamation === true`!
    2. **`soul_altar` (ou ID dedicado `lyra`) → Lyra (`npc_lyra`, `80×80`, `scale = 0.88`, anim `npc_lyra_idle`):** posição `(372, 296)` em frente à porta da Casa de Palha, rótulo `"Lyra"` sobre a cabeça (`y = -38`).
    3. **`blacksmith` → Gorran (`npc_gorran`, `80×80`, `scale = 0.88`, `setFlipX(true)`, anim `npc_gorran_hammer`):** posição `(922, 392)` logo à direita da bigorna (`(885, 395)`), martelando na bigorna com rótulo `"Gorran"` sobre a cabeça (`y = -40`).
    4. **`rift_portal` → Portão de Saída (`exit_gate`):** posição `(860, 235)` no vão do Portão de Pedra (`village_hub_gate`), com aura sutil no chão e rótulo `"Portão de Saída"`.
- **Regras de Fluxo e Interação na Vila Natal (`VillageHubManager.ts` — Decisão #23):**
  - Usar `resolveVillageHubState(this.profile, { returnedFromDungeon: this.returnedFromDungeon })` de `src/core/progression/VillageHubManager.ts`:
    - **Sem diálogo automático bloqueante no clean boot da Vila:** Ao iniciar um novo jogo no prólogo (`!fromRun`), **NÃO** abrir `DialogueBox` automaticamente — a Vila abre limpa com o tracker `"Falar com o Mestre"` e o `"!"` dourado piscando sobre o Mestre de Armas! (Manter diálogos automáticos apenas quando `fromRun?.triggeredVillageFall` ou `fromRun?.victory` retornar de uma dungeon).
    - **Falar com o Mestre de Armas:**
      - Chama `const res = markSpokenToMaster(this.profile); persistProfile(this.profile);`
      - Atualiza imediatamente o `"!"` do Mestre (que desaparece pois `showMasterExclamation` passa a `false`) e o tracker do HUD (`"Ir ao Portão — Gruta da Cachoeira"`, etc.).
      - Abre `this.openDialogue([res.dialogueId])`.
    - **Falar com Lyra:**
      - Abre `this.openDialogue(['village_lyra_talk'])`.
    - **Falar com Gorran (na Vila):**
      - Quando o jogador interage com Gorran caminhando até ele ou clicando nele na Vila (`activateStation('blacksmith')` no prólogo), abre `this.openDialogue(['village_gorran_talk'])` (Decisão #23: *"Gorran (ferreiro, só com falas, sem forja funcional)"*).
      - **IMPORTANTE para compatibilidade com testes legados:** O método público `this.openBlacksmith()` e `this.openAltar()` chamados diretamente via `window.__SUBMUNDO_HUB_DEBUG__.openBlacksmith()` / `openAltar()` continuam abrindo `this.blacksmithModal` e `this.altarModal` normalmente!
    - **Interagir com o Portão de Saída (`activateStation('rift_portal')` no prólogo):**
      - Consulta `const state = resolveVillageHubState(this.profile, { returnedFromDungeon: this.returnedFromDungeon });`
      - Se `!state.gateUnlocked`: abre `this.openDialogue(['village_gate_locked'])` (*"Ainda não. Fale com o Mestre de Armas antes de cruzar o portão."*).
      - Se `state.gateUnlocked`: abre `this.gateModal.open(state.dungeons)`. Ao escolher uma dungeon liberada/concluída no `VillageGateModal`, chama `this.enterDungeon(stageId)`.
    - **Spawn inicial vs. Retorno da Dungeon pelo Portão:**
      - Em `create(data?: HubTransitionData)`: `this.returnedFromDungeon = Boolean(data?.fromRun || data?.returnedFromDungeon);`
      - No prólogo: se `this.returnedFromDungeon === true`, o herói nasce **no Portão de Pedra** (`(860, 255)`, virado para a esquerda/centro); caso contrário, nasce no centro-esquerda da clareira (`(505, 425)`, virado para o Mestre/fogueira).
- **Extensão de `window.__SUBMUNDO_HUB_DEBUG__` para o QA/E2E do M9:**
  - Manter todos os métodos atuais de `SubmundoHubDebugApi` e acrescentar:
    - `getVillageState: () => resolveVillageHubState(this.profile, { returnedFromDungeon: this.returnedFromDungeon })`
    - `getHeroPosition: () => ({ ...this.hero.position })`
    - `setHeroPosition: (x: number, y: number) => { ... }`
    - `getVillageObstacles: () => [...this.villageObstacles]`
    - `interactWithStation: (id: HubStationId) => this.activateStation(id)`
    - `getGateModal: () => this.gateModal`

## Restrições
- **Proibido executar comandos `git`.**
- Não editar `BootScene.ts`, `DungeonScene.ts`, `package.json`, `src/version.ts` ou `src/core/`.
