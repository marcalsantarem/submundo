# BRF-012 — AG02 — T-011 + T-024 Ressalva de cooldown no HUD e Multi-touch no Joystick/Botões

**Leia:** `docs/agentes/AG02_UI.md`, `src/view/ui/DungeonHud.ts`, `src/view/ui/VirtualJoystick.ts`. **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono:** Correções do QA M1 (`T-011`) e feedback do teste real no celular (`T-024`).
**Fazer:**
1. (`T-011`) Em `src/view/ui/DungeonHud.ts` (linhas 417-422), ocultar `btn.labelText.setVisible(!isOnCooldown)` enquanto `isOnCooldown` for `true` (e manter `chargesText` da Poção visível ou legível sem sobrepor o contador de recarga).
2. (`T-024`) Garantir suporte real a multi-touch entre o joystick (polegar esquerdo) e os botões de ação (polegar direito):
   - Em `src/view/ui/DungeonHud.ts`: no `hitZone.on('pointerdown', (pointer, _lx, _ly, event) => ...)`, chamar `event?.stopPropagation?.()` para evitar vazamento do toque; garantir que cada botão responda independentemente ao `pointer.id` mesmo quando outro dedo já está pressionando o joystick.
   - Em `src/view/ui/VirtualJoystick.ts`: ouvir também `pointercancel` além de `pointerup`/`pointerupoutside`; usar `scene.input.manager.pointers` ou filtrar corretamente `pointer.id` para nunca capturar o dedo que tocou nos botões de ação nem travar o joystick ao soltar um segundo dedo; remover a restrição rígida de `activePointerId` impedir outros toques fora do joystick.
**Permitido:** `src/view/ui/DungeonHud.ts`, `src/view/ui/VirtualJoystick.ts`.
**Proibido:** `src/main.ts`, `index.html`, `src/core/`, `src/view/scenes/`, `tests/` e comandos git.
**Pronto quando:** `npm run typecheck` e `npm run build` passarem com zero erros.
**Entrega:** até 5 linhas: alterações feitas nos dois arquivos, resultado de `typecheck`/`build` e o que depende de teste em aparelho real.
