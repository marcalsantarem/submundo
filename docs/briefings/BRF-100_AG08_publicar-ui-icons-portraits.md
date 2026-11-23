# BRF-100 — AG08 (Arte) — T-078a Publicar `ui_icons.png` (64×64) e `portraits.png` (128×128) Aprovados

**Leia:** [docs/agentes/AG08_Arte.md](../agentes/AG08_Arte.md), [scripts/art/buildUiAssets.py](../../scripts/art/buildUiAssets.py), [public/assets/sprites/manifest.json](../../public/assets/sprites/manifest.json), [docs/guia_visual.md](../guia_visual.md). **Regra:** respostas curtas; **PROIBIDO** editar `src/`, `tests/` ou executar `git`.

**Decisão do dono:** Os 16 ícones 2D e 8 retratos 2D de `T-077` foram aprovados! Publicar oficialmente em `public/assets/sprites/`.

**Fazer:**
1. Copiar/gerar em `public/assets/sprites/`:
   - `public/assets/sprites/ui_icons.png` (`1024×64`, 16 frames `64×64`, a partir de `assets/sprites_src/ui/ui_icons_64.png`);
   - `public/assets/sprites/portraits.png` (`1024×128`, 8 frames `128×128`, a partir de `assets/sprites_src/ui/portraits_128.png`).
2. Atualizar `scripts/art/buildUiAssets.py` (opcionalmente com flag ou exportação direta) para manter a geração reproduzível em `public/assets/sprites/`.
3. Atualizar `public/assets/sprites/manifest.json`:
   - `sprites.portraits`: `width: 1024, height: 128, frameWidth: 128, frameHeight: 128`, mantendo os 8 nomes canônicos (`hero_living`, `hero_wraith`, `weapon_master`, `village_blacksmith`, `emissary`, `spectral_blacksmith`, `infernal_warden`, `system`).
   - `sprites.ui_icons`: `key: "ui_icons", file: "ui_icons.png", width: 1024, height: 64, frameWidth: 64, frameHeight: 64`, com os 16 nomes canônicos (`attack`, `dash`, `skill_inferno`, `skill_empireo`, `skill_submundo`, `potion`, `bag`, `settings`, `audio_on`, `audio_off`, `souls`, `essence`, `slot_weapon`, `slot_armor`, `slot_amulet`, `slot_ring`).
4. Atualizar a documentação de UI/retratos em `docs/guia_visual.md`.

**Permitido:** `scripts/art/buildUiAssets.py`, `public/assets/sprites/ui_icons.png`, `public/assets/sprites/portraits.png`, `public/assets/sprites/manifest.json`, `docs/guia_visual.md`.
**Proibido:** `src/`, `tests/`, e qualquer comando `git`.

**Entrega:** até 5 linhas: arquivos publicados, dimensões PNG/IHDR confirmadas e `manifest.json` validado.
