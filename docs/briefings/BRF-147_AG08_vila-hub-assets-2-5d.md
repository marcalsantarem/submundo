# BRF-147 — AG08 (Arte): Assets Pixel Art 2.5D da Vila Natal (`T-133`)

## Contexto
Início da Onda A do **M9 (`v0.9.0`: Novo hub funcional)** conforme **Decisão #23**. A Vila Natal é o hub do prólogo, seguindo `assets/mockups/ref_m9_village_hub.jpg` como referência de composição e clima (clareira cercada por paliçada, fogueira central, casa de palha ao fundo-esquerda, forja/bigorna à direita, portão de pedra com placa `"SAÍDA"` no canto superior direito), mas executada em **Pixel Art 2.5D Dark Fantasy** no mesmo padrão de qualidade e paleta dos biomas do M8 (`scripts/art/biomes/surf_village.py` e `public/assets/sprites/biome_village_*`).

## Arquivos sob sua posse
- `scripts/art/buildVillageHubAssets.py` (criar novo, Python stdlib pura, sem Pillow/Node)
- `public/assets/sprites/village_hub_tiles.png` (novo)
- `public/assets/sprites/village_hub_props.png` (novo)
- `public/assets/sprites/village_hub_house.png` (novo — casa de palha inteira 2.5D)
- `public/assets/sprites/village_hub_gate.png` (novo — portão de pedra com vigas de madeira e placa "SAÍDA")
- `scripts/art/biomes/out/village_hub_assets.manifest.json` (manifesto parcial JSON dos novos sprites — **NÃO** editar `public/assets/sprites/manifest.json` agora para evitar conflito com `T-134` em paralelo)
- `assets/mockups/preview_m9_village_assets.png` (prancha de aprovação ampliada com todos os assets rotulados)

## Especificações Obrigatórias
1. **Inspecione `assets/mockups/ref_m9_village_hub.jpg` e `scripts/art/biomes/surf_village.py`** via `read_file` para alinhar paleta de terra batida, grama sombria, madeira envelhecida, pedra acinzentada e luz quente de fogo/brasa.
2. **`village_hub_tiles.png` (frames `32×32`):**
   - Mínimo 8 variações orgânicas: terra batida central (3 variações), pedrinhas/trilha desgastada, grama da borda (2 variações), transição terra-grama, mancha de cinzas/pedras da clareira central. Pixel art nítido, sem costuras visíveis.
3. **`village_hub_props.png` (frames `32×32`, fundo RGBA transparente com sombra de contato):**
   - **Paliçada de madeira:** trecho horizontal, trecho vertical esquerdo/direito, canto superior/inferior, estaca terminal (ponta).
   - **Fogueira central animada (4 frames):** pedras em círculo + lenha + chamas quentes vivas com variação real de silhueta e faíscas entre os 4 frames.
   - **Braseiro de ferro animado (4 frames):** suporte de ferro + brasas/chama (usado ao lado da porta da curandeira).
   - **Tocha de poste animada (4 frames):** poste de madeira + chama tremulante.
   - **Bigorna de ferro** (3/4 top-down sobre toco de madeira) e **Forja de pedra animada (4 frames)** com brasa acesa/fumaça/faíscas.
   - Props de ambientação da referência: **placa "SAÍDA"** em madeira (ou integrada ao portão + versão prop), pilha de lenha, barril, carroça/roda de madeira.
4. **Estruturas 2.5D dedicadas (fundo RGBA transparente, sombra de contato no chão):**
   - **`village_hub_house.png` (~`192×160` px):** Casa de palha rústica 2.5D com telhado de sapê inclinado texturizado, vigas de madeira escura, parede de pedra/barro e **porta de madeira frontal** bem definida para posicionar Lyra na entrada.
   - **`village_hub_gate.png` (~`160×128` px):** Portão de pedra robusto com dois pilares de alvenaria, viga superior de madeira escura reforçada com ferro, passagem aberta para a estrada de terra e placa legível **"SAÍDA"** em madeira à direita do pilar.
5. **Validação:** Execute `python scripts/art/buildVillageHubAssets.py`, abra `assets/mockups/preview_m9_village_assets.png` com `read_file` e verifique nitidez, contraste, ausência de halos e coerência de escala com os tiles `32×32`.

## Restrições
- Não tocar em `src/`, `public/assets/sprites/manifest.json` nem nos sprites de NPCs (`T-134`).
- **PROIBIDO** executar comandos `git`.
- Relato curto ao AG00: arquivos gerados, dimensões/frames, suposições e o que não foi testado.
