# BRF-130 — AG08 — T-121 Refinar a animação de ataque do herói e a sincronia da arma
**Leia:** `docs/agentes/AG08_Arte.md`, decisão #8 em `docs/decisoes.md`, `src/view/sprites/HeroWeaponRig.ts`, as specs `hero_*_attack` em `src/view/sprites/CombatVfx.ts`, a parte do ataque em `scripts/art/buildHeroAndWeapons.py` e `assets/mockups/preview_hero_living_24f.png` (abra). **Regra:** respostas curtas; sem commit/push/branches.

**Pedido do dono:** a interação do herói com a arma ao bater está estranha. Refine as animações de combate.

**Diagnóstico do líder (simulação quadro a quadro, 16 ms por passo, herói parado):**
1. **Dessincronia:** o corpo toca `attack` (6 frames a 18 fps = 333 ms), mas a rotação da arma vem de um tween próprio de 85 ms com `yoyo`. A lâmina desce e **volta** enquanto o corpo ainda está na preparação, e só depois o corpo "golpeia". O golpe parece invertido ou duplicado.
2. **Tremida no início:** nos 3 primeiros passos a lâmina salta de cima → horizontal → cima (o tween e o `sync` brigam pela rotação).
3. **Corpo fraco:** os frames 10–15 quase não mostram golpe (punho levantado, depois braço estendido). Não há antecipação clara, arco amplo, follow-through nem recuperação. O braço do frame não corresponde à arma.
4. **Pós-golpe:** a arma fica apontada para a frente na horizontal por vários quadros e depois "estala" para a pose idle (troca de âncora sem interpolação).
5. **Andando:** o corpo não toca `attack` (decisão #8, os passos não travam), então só a arma gira, com o mesmo tween solto.

**Contrato (AG01 trabalha em paralelo na `DungeonScene.ts`):**
- Exporte em `HeroWeaponRig.ts`: `HERO_ATTACK_DURATION_MS` (duração total do ataque básico) e `HERO_ATTACK_IMPACT_MS` (instante do golpe, contado do início). Para skill, faça o mesmo com `HERO_SKILL_ATTACK_DURATION_MS` e `HERO_SKILL_ATTACK_IMPACT_MS`. A animação `hero_*_attack` em `CombatVfx.ts` precisa bater com essas constantes. Mire em ~300–380 ms no total, com o impacto em ~40–50%. O cooldown do ataque é 650 ms.
- Mantenha a assinatura `playAttackSwing(facingLeft: boolean, isSkill = false): void`.

**Fazer:**
(1) Redesenhe os frames `attack` 10–15 de `hero_living` **e** `hero_wraith` em `buildHeroAndWeapons.py`, mantendo o formato `80×80` e 24 frames: antecipação (braço da arma recuado acima ou atrás, tronco girando), golpe (braço cruzando à frente e para baixo), impacto (extensão máxima, peso no pé da frente), follow-through e 2 frames de recuperação de volta à guarda. Regere os PNGs e a prancha de preview. Não mexa em idle, walk, dash nem hit.
(2) Reescreva o swing do `HeroWeaponRig`: a posição **e** a rotação da arma vêm de keyframes por frame (âncoras novas casando com a mão desenhada), **interpoladas** pelo progresso do frame atual (sem `yoyo` e sem tween independente brigando com o `sync`). Quando o corpo não está tocando `attack` (herói andando), o rig roda sozinho a mesma linha do tempo de keyframes sobre a pose de walk, sem travar os passos. A volta da pose de ataque para idle ou walk é suavizada (~80 ms), sem estalo.
(3) Se couber: um rastro (smear) curto da lâmina no frame do impacto, via código no rig.
(4) Atualize `docs/guia_visual.md` se a convenção de frames ou âncoras mudar.

**Permitido:** `scripts/art/buildHeroAndWeapons.py`, `public/assets/sprites/hero_living.png`, `public/assets/sprites/hero_wraith.png`, `assets/mockups/preview_hero_*`, `src/view/sprites/HeroWeaponRig.ts`, `src/view/sprites/CombatVfx.ts` (só as specs do herói), `docs/guia_visual.md`. **Proibido:** `DungeonScene.ts`, `HubScene.ts`, `BootScene.ts`, outros sheets, `tests/`, Git.

**Como conferir (obrigatório):** rode `npx vite --port 5198 --strictPort` e simule como o líder fez. Use Playwright (`chromium` já instalado; importe de `file:///C:/Repos/submundo/node_modules/@playwright/test/index.mjs` se o script estiver fora do repo). Espere `window.__SUBMUNDO_DEBUG__.scene.heroSprite`, mate os monstros (`isAlive = false`), faça `scene.game.loop.sleep()`, chame `scene.playHeroActionAnim('attack')` + `scene.weaponRig.playAttackSwing(left, false)` e avance com `scene.game.step(t += 16.67, 16.67)`. Capture um recorte de 180×150 em volta do herói com `deviceScaleFactor: 3`, para a direita e para a esquerda, e também com `scene.heroIsMoving = true` sem `playHeroActionAnim`. Monte uma prancha e **olhe** antes de entregar. Salve as pranchas finais em `assets/mockups/preview_hero_attack_sim_R.png` e `preview_hero_attack_sim_L.png`. Encerre o servidor ao final.

**Pronto quando:** `npm test` e `npm run build` passam e as pranchas mostram um golpe único, legível, com a arma presa à mão do começo ao fim, para os dois lados e andando.

**Entrega:** até 10 linhas: o que mudou, os valores das constantes, caminhos das pranchas e o que não foi verificado.
