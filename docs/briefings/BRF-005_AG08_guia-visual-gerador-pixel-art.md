# BRF-005 — AG08 — T-005 Guia visual e gerador via código de spritesheets/tilesets Pixel Art

**Leia:** `docs/agentes/AG08_Arte.md`, `docs/GDD_Submundo.md` (seção 7). **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono:** Decisão #5 (M1 `v0.1.0`).
**Contrato:**
- Chaves e arquivos PNG gerados em `public/assets/sprites/`:
  - `wraith_warrior.png`: `128x32` px (4 frames `32x32`: idle0, idle1, attack, dash) — Espectro com capa sombria, olhos/lâmina em chama azul espiritual (`#38bdf8`).
  - `abyssal_slime.png`: `64x32` px (2 frames `32x32`: idle0, idle1) — Limo rubro/abissal (`#ef4444` / `#991b1b`).
  - `bone_sentinel.png`: `64x32` px (2 frames `32x32`: idle0, attack) — Esqueleto guerreiro (`#e4e4e7` / olhos `#f97316`).
  - `infernal_warden.png`: `128x64` px (2 frames `64x64`: idle, slam) — Boss demônio encouraçado com chifres e brasa (`#dc2626` / `#f97316`).
  - `dungeon_tiles.png`: `64x16` px (4 tiles `16x16`: piso de pedra escura, piso rachado com musgo/cinza, parede de tijolo abissal, portal azul espiritual).
  - `soul_orb.png`: `16x16` px (1 frame `16x16`: orbe de alma azul brilhante).
  - `manifest.json`: metadados de cada sprite (`key`, `file`, `frameWidth`, `frameHeight`, `frames`).
**Fazer:**
1. Criar `docs/guia_visual.md` documentando paleta Dark Fantasy, contraste de leitura, dimensões de sprites/tiles e convenção de frames.
2. Criar `scripts/art/generateSprites.mjs` em Node.js puro (usando apenas módulos nativos `fs`, `path`, `zlib` para codificar PNG RGBA real sem depender de pacotes npm) e executá-lo (`node scripts/art/generateSprites.mjs`) para gerar todos os `.png` e `manifest.json` em `public/assets/sprites/`.
**Permitido:** `docs/guia_visual.md`, `scripts/art/generateSprites.mjs`, `public/assets/sprites/`.
**Proibido:** `package.json`, `src/`, `tests/` e comandos git (`commit`, `push`, `branch`, `checkout`, `reset`, `stash`).
**Pronto quando:** todos os 6 arquivos `.png` (com assinatura PNG válida `\x89PNG`) e `manifest.json` existirem em `public/assets/sprites/` junto ao `docs/guia_visual.md`.
**Entrega:** até 6 linhas: arquivos gerados, dimensões conferidas, validação de cabeçalho PNG e o que não foi testado.
