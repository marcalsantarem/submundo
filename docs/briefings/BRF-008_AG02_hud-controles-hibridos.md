# BRF-008 — AG02 — T-008 HUD responsivo, joystick virtual flutuante e controles híbridos

**Leia:** `docs/agentes/AG02_UI.md`, `src/core/index.ts`, `src/data/skills.json`, `src/data/dialogues.json`. **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono:** Decisão #3 e Decisão #5 (M1 `v0.1.0`).
**Contrato:**
- `src/view/ui/VirtualJoystick.ts`:
  - Classe `VirtualJoystick` para Phaser 3: aparece ao tocar/arrastar na metade inferior/esquerda da tela (ou em qualquer área livre no modo `mobile_portrait`), expondo `getDirection(): Vector2D` normalizado (`{ x, y }`) e `destroy(): void`.
- `src/view/ui/DungeonHud.ts`:
  - Interface `HudSnapshot`:
    ```ts
    export interface HudSnapshot {
      hp: number;
      maxHp: number;
      souls: number;
      roomNumber: number;
      totalRooms: number;
      isBossRoom: boolean;
      roomTitle: string;
      bossHp?: number;
      bossMaxHp?: number;
      bossName?: string;
      potionCharges: number;
      maxPotionCharges: number;
      skillCooldownsMs: Record<string, number>; // tempo restante em ms por skill.id
      runStatus: 'in_progress' | 'room_cleared' | 'victory' | 'defeat';
      bannerText?: string;
    }
    ```
  - Classe `DungeonHud`:
    - `constructor(scene: Phaser.Scene, skills: SkillDef[], callbacks: { onUseSkill: (skillId: string) => void; onRestartRun: () => void })`
    - `getMoveVector(): Vector2D` (combina `WASD`/Setas do teclado + `VirtualJoystick`).
    - `update(snapshot: HudSnapshot): void` (atualiza barra de HP do herói, contador de Almas, indicador `Sala X/5`, barra de HP do Boss quando na Sala 5, botões de Dash / Skill 1 / Skill 2 / Poção com cooldown e atalhos `Espaço`/`Shift` para Dash, `1`/`J` para Skill 1, `2`/`K` para Skill 2, `3`/`Q`/`L` para Poção, e modal de Vitória/Derrota com botão `"Nova Incursão"`).
    - `resize(viewport: ViewportConfig): void` (reposiciona elementos ergonomicamente tanto em `desktop_landscape` `800x600` quanto em `mobile_portrait` `360x640` para alcance de 1 polegar).
**Fazer:**
1. Implementar `src/view/ui/VirtualJoystick.ts` e `src/view/ui/DungeonHud.ts` em Phaser 3 com textos em pt-BR.
**Permitido:** `src/view/ui/VirtualJoystick.ts`, `src/view/ui/DungeonHud.ts`.
**Proibido:** `src/core/`, `src/view/scenes/`, `src/view/sprites/` e comandos git (`commit`, `push`, `branch`, `checkout`, `reset`, `stash`).
**Pronto quando:** `npm run typecheck` passar sem erros nos arquivos de `src/view/ui/`.
**Entrega:** até 6 linhas: arquivos criados, controles/layouts suportados, validação `typecheck` e o que não foi testado.
