# BRF-148 — AG08 (Arte): NPCs da Vila Natal no Padrão 48×48 (`T-134`)

## Contexto
Onda A do **M9 (`v0.9.0`: Novo hub funcional)** conforme **Decisão #23**. Os 3 NPCs da Vila Natal (**Mestre de Armas**, **Lyra** e **Gorran**) devem ser refeitos em **Pixel Art Dark Fantasy** no mesmo padrão visual do herói (`hero_living.png`: mesma qualidade de sombreamento, contorno escuro, proporção corporal e iluminação), em frames **`48×48`**.

## Arquivos sob sua posse
- `scripts/art/buildVillageNpcs.py` (criar novo, Python stdlib pura, sem Pillow/Node)
- `public/assets/sprites/npc_weapon_master.png` (novo — 4 frames `idle`, `192×48`)
- `public/assets/sprites/npc_lyra.png` (novo — 4 frames `idle`, `192×48`)
- `public/assets/sprites/npc_gorran.png` (novo — 8 frames: `idle` 4f + `hammer` 4f, `384×48`)
- `scripts/art/biomes/out/village_hub_npcs.manifest.json` (manifesto parcial JSON dos 3 NPCs — **NÃO** editar `public/assets/sprites/manifest.json` agora para evitar conflito com `T-133` em paralelo)
- `assets/mockups/preview_m9_village_npcs.png` (prancha de aprovação 4× mostrando todos os frames dos 3 NPCs + comparação de proporção ao lado de `hero_living.png` frame 0)

## Especificações Obrigatórias
1. **Referências:** Inspecione `assets/mockups/ref_m9_village_hub.jpg` e `public/assets/sprites/hero_living.png` (ou `assets/mockups/preview_hero_living_24f.png`) via `read_file` para igualar exatamente o estilo de pixel art (proporção cabeça/tronco/pernas, outline escuro consistente, sombra elíptica de contato no chão, paleta terrosa/metálica Dark Fantasy).
2. **Os 3 NPCs (`48×48` por frame, RGBA transparente, pés alinhados na mesma linha de base):**
   - **Mestre de Armas (`npc_weapon_master.png`, 4 frames `idle`):** guerreiro veterano de barba/cabelo grisalho, armadura de placas desgastadas com ombreiras e capa escura, segurando uma lança/alabarda apoiada no chão. Animação `idle` suave (respiração, leve movimento da capa e brilho metálico).
   - **Lyra (`npc_lyra.png`, 4 frames `idle`):** curandeira/boticária da vila com vestido medieval longo em tons terrosos/oliva, avental claro gasto, pequena bolsa/frasco de poção na cintura e cabelo castanho preso. Animação `idle` suave (respiração, movimento sutil das mãos e saia).
   - **Gorran (`npc_gorran.png`, 8 frames: `0..3 idle`, `4..7 hammer`):** ferreiro robusto de barba castanha/ruiva, braços fortes expostos, avental de couro escuro e martelo de forja. Nos frames `4..7` (`hammer`), executar ciclo claro de **martelando na bigorna** (ergue o martelo → desce com força → impacto com faísca dourada/laranja → recuo).
3. **Prancha de aprovação (`assets/mockups/preview_m9_village_npcs.png`):**
   - Mostrar cada frame ampliado (4×) com rótulos (`idle0..3`, `hammer0..3`) sobre fundo xadrez/escuro e incluir uma faixa de comparação de escala ao lado do `hero_living` (frame 0) para confirmar harmonia visual.
4. **Validação:** Execute `python scripts/art/buildVillageNpcs.py` e inspecione `assets/mockups/preview_m9_village_npcs.png` com `read_file`.

## Restrições
- Não tocar em `src/`, `public/assets/sprites/manifest.json` nem nos arquivos da `T-133`.
- **PROIBIDO** executar comandos `git`.
- Relato curto ao AG00: arquivos gerados, dimensões/frames, suposições e o que não foi testado.
