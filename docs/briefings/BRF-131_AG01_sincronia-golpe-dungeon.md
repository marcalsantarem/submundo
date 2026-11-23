# BRF-131 — AG01 — T-121 Sincronizar o golpe do herói na DungeonScene
**Leia:** `docs/agentes/AG01_Gameplay.md`, decisão #8 em `docs/decisoes.md` e, em `src/view/scenes/DungeonScene.ts`, os trechos de `hero_basic_attack`, das skills que chamam `playAttackSwing`, do ataque manual (~linha 690) e de `playHeroActionAnim`. **Regra:** respostas curtas; sem commit/push/branches.
**Pedido do dono:** a interação do herói com a arma ao bater está estranha; refinar as animações de combate.
**Contrato (AG08 trabalha em paralelo no `HeroWeaponRig.ts` e no sheet do herói):** `HeroWeaponRig.ts` vai exportar `HERO_ATTACK_DURATION_MS`, `HERO_ATTACK_IMPACT_MS`, `HERO_SKILL_ATTACK_DURATION_MS` e `HERO_SKILL_ATTACK_IMPACT_MS`. A assinatura `playAttackSwing(facingLeft, isSkill)` continua igual. Enquanto o AG08 não exportar, use valores provisórios locais (330/150 e 420/190) e troque pelo import quando existir. Confira antes de terminar.
**Diagnóstico do líder:** o arco de corte (`vfx.showSlashEffect`) e o número de dano aparecem no instante 0, quando o corpo ainda está na preparação. Não existe "momento de impacto". A virada do herói (`setFlipX`) pode acontecer no meio de um golpe já em andamento.
**Fazer:**
(1) Atrase só o **visual** do golpe para o impacto. O arco de corte, o flash de acerto no monstro e o número de dano ou crítico devem aparecer em `HERO_ATTACK_IMPACT_MS` (ou na versão skill). O dano no core continua imediato: não mexa em `src/core/`. Use `this.time.delayedCall`, cancelado se a cena reiniciar, o herói morrer ou o alvo sumir; nesse caso, mostre no último ponto conhecido.
(2) Trave a direção do herói durante o swing (do início até `HERO_ATTACK_DURATION_MS`). Só vire de novo quando um ataque novo começar.
(3) Não reinicie o `attack` do corpo se um golpe ainda estiver em andamento (não cortar o swing pela metade). Quando o herói andando parar no meio do golpe, mantenha a linha do tempo do rig.
(4) Aplique o mesmo nas skills e no ataque manual.
**Permitido:** `src/view/scenes/DungeonScene.ts`. **Proibido:** `HeroWeaponRig.ts`, `CombatVfx.ts`, assets, `src/core/`, `tests/`, Git.
**Pronto quando:** `npm test`, `npm run build` e `npx playwright test tests/e2e/m6-monsters.spec.ts tests/e2e/m8-dungeon-basic.spec.ts` passam. Use a porta 5197 se subir um servidor seu e encerre-o ao final.
**Entrega:** até 8 linhas: o que mudou, como o atraso é cancelado e o que não foi verificado.
