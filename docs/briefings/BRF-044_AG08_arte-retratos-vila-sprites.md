# BRF-044 — AG08 — T-043 Retratos 2D Estilizados, Vila Natal e Refinamento Pixel Art

**Leia:** `docs/agentes/AG08_Arte.md`, `docs/guia_visual.md`, `scripts/art/generateSprites.mjs`, `public/assets/sprites/manifest.json`. **Regra:** manter dimensões e ordem de frames de TODOS os sprites existentes para não quebrar animações; zero git commands.
**Decisão do dono:** Autorização explícita da `T-043` (M4 `v0.4.0`) + pedido explícito do dono para elevar a qualidade gráfica e mostrar retratos, vila e sprites.
**Fazer:**
1. Estender `scripts/art/generateSprites.mjs` (sem quebrar `wraith_warrior`, `abyssal_slime`, `bone_sentinel`, `infernal_warden`, `dungeon_tiles`, `soul_orb`, `loot_icons`, `loot_drops`, `hub_tiles`, `hub_npcs`) para:
   - **Criar `public/assets/sprites/portraits.png` (`512x64`, 8 frames de `64x64` — Arte 2D estilizada com sombreamento rico, anti-aliasing suave/gradiente e bordas nítidas):**
     - Frame 0: `hero_living` (Guerreiro jovem vivo, armadura de ferro da vila, olhar firme)
     - Frame 1: `hero_wraith` (Guerreiro Espectral, elmo/capuz sombrio, olhos e runas azul-celestes)
     - Frame 2: `weapon_master` (Mestre de Armas veterano, barba grisalha, cicatriz, manto de guerra)
     - Frame 3: `village_blacksmith` (Ferreiro vivo, bigode robusto, avental de couro, reflexo de forja quente)
     - Frame 4: `emissary` (Emissário Celestial, elmo angelical dourado-marfim, auréola azul-dourada)
     - Frame 5: `spectral_blacksmith` (Ferreiro Espiritual translúcido com chama azul espiritual)
     - Frame 6: `infernal_warden` (General/Carcereiro Infernal, chifres obsidianos, olhos e fissuras de brasa)
     - Frame 7: `system` (Selo Espectral rúnico brilhante)
   - **Criar `public/assets/sprites/village_tiles.png` (`64x16`, 4 frames `16x16`):** `grass_path`, `cobble_square`, `wood_wall`, `village_lantern` (tons vivos quentes e acolhedores contrastando com o Submundo).
   - **Criar `public/assets/sprites/village_npcs.png` (`128x32`, 4 frames `32x32`):** `weapon_master`, `village_blacksmith`, `potion_stall`, `village_gate`.
   - **Criar `public/assets/sprites/cave_bat.png` (`64x32`, 2 frames `32x32`):** `flap0`, `flap1` (morcego sombrio para Gruta/Mina do Prólogo).
   - **Refinamento visual Pixel Art (16/32-bit):** melhorar contraste, sombreamento de 4 tons, dithering sutil em pisos e rim lighting em `wraith_warrior.png`, `abyssal_slime.png`, `bone_sentinel.png`, `infernal_warden.png`, `dungeon_tiles.png`, `hub_tiles.png` e `hub_npcs.png` **preservando exatamente `width`, `height`, `frameWidth`, `frameHeight` e índice de cada frame**.
2. Rodar `node scripts/art/generateSprites.mjs` e atualizar `public/assets/sprites/manifest.json` (`"version": "0.4.0"`, registrando `portraits`, `village_tiles`, `village_npcs`, `cave_bat` e todos os anteriores) e `docs/guia_visual.md`.
**Permitido:** `scripts/art/`, `public/assets/sprites/`, `docs/guia_visual.md`.
**Proibido:** tocar `src/`, `public/icons/`, `assets/`, `tests/` e executar comandos git.
**Pronto quando:** script executado gerando todos os `.png` + `manifest.json` válidos e inspecionados.
**Entrega:** até 5 linhas com sprites gerados/refinados, dimensões e versão do `manifest.json`.
