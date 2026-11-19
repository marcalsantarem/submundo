# BRF-099 — AG08 (Arte) — T-077 Recorte, Transparência e Prancha de Aprovação dos Ícones 2D (`64×64`) e Retratos 2D (`128×128`)

**Leia:** [docs/agentes/AG08_Arte.md](../agentes/AG08_Arte.md), `assets/sprites_src/ui/ui_icons_raw.jpg`, `assets/sprites_src/ui/portraits_raw.jpg`. **Regra:** respostas curtas; **PROIBIDO** editar `src/`, `tests/`, `public/assets/sprites/` (ainda não substituir os assets finais antes da aprovação do dono!) ou executar `git`.

**Decisão do dono (Decisão #14):** O dono quer **aprovar todos os novos ícones 2D e retratos 2D** antes de aplicarmos no jogo (`T-078` / `T-079`). As artes-fonte de alta qualidade já estão em:
- `assets/sprites_src/ui/ui_icons_raw.jpg` (grade uniforme 4×4 = 16 ícones 2D dark fantasy sobre fundo `#11131f`):
  `0: attack`, `1: dash`, `2: skill_inferno`, `3: skill_empireo`, `4: skill_submundo`, `5: potion`, `6: bag`, `7: settings`, `8: audio_on`, `9: audio_off`, `10: souls`, `11: essence`, `12: slot_weapon`, `13: slot_armor`, `14: slot_amulet`, `15: slot_ring`.
- `assets/sprites_src/ui/portraits_raw.jpg` (grade uniforme 4×2 = 8 retratos 2D dark fantasy na ordem canônica de `PORTRAIT_FRAME_MAP` sobre fundo `#11131f`):
  `0: hero_living`, `1: hero_wraith`, `2: weapon_master`, `3: village_blacksmith`, `4: emissary`, `5: spectral_blacksmith`, `6: infernal_warden` (Karnak), `7: system` (Selo Rúnico).

**Fazer:**
1. Criar `scripts/art/buildUiAssets.py` (Python stdlib + conversão inicial de `.jpg` para `.png` via PowerShell `System.Drawing` se necessário, mantendo o script reproduzível):
   - **Recorte inteligente:** dividir `ui_icons_raw.jpg` em 4×4 e `portraits_raw.jpg` em 4×2.
   - **Remoção de fundo com preservação de glows/brilhos (muito importante!):** diferente de pixel art pura, esses ícones e retratos têm brilhos suaves (chama azul de alma, raio, foice espectral, aura dourada do Emissário, névoa ciano do Espectro). Use BFS flood-fill a partir das bordas de cada célula com **alpha suave (feathering baseado na distância RGB ao fundo `#11131f`)** nos pixels de brilho/borda semitransparente, mantendo 100% opacos o corpo/contornos internos e 100% transparente o fundo escuro — zero "quadrado escuro" visível e zero perda dos brilhos!
   - **Downscale suavizado (área/bilinear, NÃO nearest-neighbor!)** pois são Arte 2D estilizada:
     - `assets/sprites_src/ui/ui_icons_64.png`: **`1024×64`** (16 frames `64×64`, cada ícone centralizado ocupando ~54–58 px de margem limpa);
     - `assets/sprites_src/ui/portraits_128.png`: **`1024×128`** (8 frames `128×128`, cada retrato bem enquadrado e centralizado com margem confortável para moldura circular no HUD e quadrada nos diálogos).
2. Gerar a prancha de aprovação **`assets/mockups/preview_m7_ui_assets.png`** mostrando de forma bonita e legível:
   - Os **16 ícones `64×64`** em 2× (com rótulos dos nomes, metade em fundo xadrez de transparência e uma faixa de exemplo simulando botões circulares metálicos dark fantasy);
   - Os **8 retratos `128×128`** com rótulos dos nomes (mostrando o enquadramento limpo sobre fundo xadrez + exemplo de moldura circular de HUD).
3. **Inspecionar `assets/mockups/preview_m7_ui_assets.png` com `read_file`** e iterar o recorte/alpha se houver qualquer borda cortada, halo escuro feio ou retrato mal centralizado.

**Permitido:** `scripts/art/buildUiAssets.py`, `assets/sprites_src/ui/`, `assets/mockups/preview_m7_ui_assets.png`.
**Proibido:** `src/`, `tests/`, `public/assets/sprites/`, `docs/`, e qualquer comando `git`.

**Entrega:** até 8 linhas: (1) arquivos gerados, (2) dimensões confirmadas (`1024×64` e `1024×128`), (3) resultado da inspeção visual de transparência/glows, (4) pronto para aprovação do dono.
