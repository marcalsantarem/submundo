# BRF-111 — AG08 (Arte): Ícones 2D de Elmo (`slot_helm`) e Bota (`slot_boots`) em `ui_icons.png` (18 frames) e Mockup 2D HD

## Contexto
A Decisão #15 expandiu o sistema de equipamentos de 4 para **6 slots** (`weapon`, `armor`, `helm`, `boots`, `amulet`, `ring`) e determinou que as telas de UI (Inventário e Cards de Item) sigam **Arte 2D estilizada Dark Fantasy** (não-pixelart). Precisamos adicionar os ícones 2D `64×64` de **Elmo (frame 16)** e **Bota (frame 17)** à folha `ui_icons.png` (totalizando 18 frames: `1152×64`).

## Arquivos sob sua posse
- `assets/sprites_src/ui/ui_helm_boots_raw.jpg`
- `assets/sprites_src/ui/ui_icons_64.png`
- `public/assets/sprites/ui_icons.png`
- `public/assets/sprites/manifest.json`
- `scripts/art/buildUiAssets.py`
- `assets/mockups/preview_m7_diablo_inventory_and_tooltip.png`

## Tarefas Obrigatórias
1. Copiar `C:\Users\msm\.gemini\antigravity\brain\2c74400d-dddc-4bac-997a-f6d59d6cd706\ui_helm_boots_icons_2x1_clean_1795101701880.jpg` para `assets/sprites_src/ui/ui_helm_boots_raw.jpg`.
2. Atualizar `scripts/art/buildUiAssets.py` para:
   - Manter a extração dos frames `0..15` de `assets/sprites_src/ui/ui_icons_raw.jpg`.
   - Extrair os 2 novos frames (`16: slot_helm` à esquerda e `17: slot_boots` à direita) de `assets/sprites_src/ui/ui_helm_boots_raw.jpg`, removendo o fundo escuro para transparência RGBA com borda anti-aliased suave e redimensionando com `Image.Resampling.LANCZOS` para células `64×64`.
   - Gerar `assets/sprites_src/ui/ui_icons_64.png` e `public/assets/sprites/ui_icons.png` com **18 frames (`1152×64`, `64×64` por frame)**.
   - Atualizar `public/assets/sprites/manifest.json` para que `ui_icons` registre `width: 1152`, `height: 64`, `frameWidth: 64`, `frameHeight: 64`, `frames: 18`.
3. Converter/salvar `C:\Users\msm\.gemini\antigravity\brain\2c74400d-dddc-4bac-997a-f6d59d6cd706\ui_dark_fantasy_mockup_1795101669141.jpg` em `assets/mockups/preview_m7_diablo_inventory_and_tooltip.png` para documentar o visual 2D Dark Fantasy aprovado de 6 slots + cards estilo Diablo.
4. Executar `python scripts/art/buildUiAssets.py` e validar que `public/assets/sprites/ui_icons.png` possui `1152×64` RGBA sem pixels vazios nos 18 frames.

## Restrições
- **PROIBIDO** executar comandos `git`.
