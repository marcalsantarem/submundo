# BRF-151 — AG08 (Arte): Mockup Estático 960×540 da Vila Natal (T-135)

- **Task:** `T-135` (M9 — `v0.9.0`)
- **Agente:** `AG08 (Arte)`
- **Referência obrigatória:**
  - Composição: `assets/mockups/ref_m9_village_hub.jpg`
  - Assets reais já gerados (`T-133` e `T-134`):
    - `public/assets/sprites/village_hub_tiles.png` (`320×32`, 10 frames `32×32`)
    - `public/assets/sprites/village_hub_props.png` (`896×32`, 28 frames `32×32`)
    - `public/assets/sprites/village_hub_house.png` (`192×160`)
    - `public/assets/sprites/village_hub_gate.png` (`160×128`)
    - `public/assets/sprites/npc_weapon_master.png` (`192×48`, 4f `48×48`)
    - `public/assets/sprites/npc_lyra.png` (`192×48`, 4f `48×48`)
    - `public/assets/sprites/npc_gorran.png` (`384×48`, 8f `48×48`: `idle0..3` + `hammer0..3`)
    - `public/assets/sprites/hero_living.png` (`1920×80`, 24f `80×80` — escalar para casar com a altura dos NPCs `48×48` no mesmo zoom da cena)
    - `public/assets/sprites/portraits.png` e `public/assets/sprites/ui_icons.png` (se úteis para o HUD 2D)
  - Decisão #23 (`docs/decisoes.md`)

## Objetivo
Gerar um mockup estático **`960×540`** (`assets/mockups/mockup_m9_village_hub.png`) que simule o resultado final in-game da Vila Natal usando **exclusivamente os assets reais** de `T-133`, `T-134` e o herói humano, somados ao **HUD enxuto da Vila** em Arte 2D Dark Fantasy (mesmo estilo de `DarkFantasyUiBuilder`), para validação visual do dono antes de montar a `HubScene` (`T-138`–`T-140`).

## Requisitos Obrigatórios
1. **Ambiente & Escala (960×540, Pixel Art 2.5D com zoom ingame ~1.5x–2x, pixel nearest):**
   - Composição fiel a `assets/mockups/ref_m9_village_hub.jpg`:
     - Clareira de terra batida rodeada por bordas de grama e paliçada de madeira.
     - **Fogueira acesa** no centro da clareira, com halo quente suave (iluminação 2D sutil).
     - **Casa de palha** ao fundo-esquerda, com **braseiro aceso**, lenha/pedras e **Lyra** em frente à porta com rótulo `"Lyra"` sobre a cabeça.
     - **Mestre de Armas** à esquerda da fogueira, voltado para o herói, com rótulo `"Mestre de Armas"` e ícone **`"!"` dourado** acima da cabeça.
     - **Herói (`hero_living`)** no centro-sul próximo à fogueira, voltado para o Mestre, na mesma escala/proporção dos NPCs.
     - **Gorran** à direita (virado para a esquerda, frame `hammer2` com faíscas!) junto à **bigorna**, **forja acesa** (com halo alaranjado) e barril/carroça. Rótulo `"Gorran"` sobre a cabeça.
     - **Portão de pedra** com placa **`"SAÍDA"`** no canto superior direito, com tocha acesa próxima e caminho de terra levando até ele.
   - Vinheta sutil nas bordas e sombras de contato sob todos os personagens e props.

2. **HUD Enxuto da Vila (Arte 2D Dark Fantasy — Decisão #23):**
   - **Canto superior esquerdo:** Retrato do herói + nome/nível + barra de HP vermelha; logo abaixo, tracker de missão: `◆ Missão` / `Falar com o Mestre`.
   - **Canto inferior esquerdo:** Joystick virtual translúcido (mesmo estilo do HUD paisagem atual).
   - **Canto superior direito:** Minimapa circular mostrando a clareira da vila, pontos dos NPCs, fogueira, herói e portão; logo abaixo/ao lado, 3 botões circulares compactos: `Inventário`, `Áudio` e `Configurações`.
   - **Canto inferior direito:** Apenas o botão circular principal **`Interagir`** (no lugar do botão de Ataque, com brilho dourado suave indicando que há NPC/ponto interativo por perto).
   - **NÃO incluir:** moedas/almas no topo, Loja, Passe, barra de EXP/chat, botões de Skills, Poções ou Esquiva (Decisão #23).

3. **Pipeline Técnico:**
   - Criar `scripts/art/buildVillageHubMockup.py` em **Python stdlib pura** (sem Pillow/Node, reaproveitando helpers de `scripts/art/`).
   - Executar o script para gerar `assets/mockups/mockup_m9_village_hub.png` (`960×540` exato).
   - Inspecionar visualmente o PNG gerado com `read_file` e refinar se houver qualquer problema de escala, legibilidade, alinhamento ou sobreposição entre HUD e personagens.

## Restrições
- **Proibido executar comandos `git`.**
- Não alterar arquivos de `src/` ou `public/assets/sprites/`.
- Entregar relato curto com dimensões, confirmação de inspeção visual e qualquer ajuste feito.
