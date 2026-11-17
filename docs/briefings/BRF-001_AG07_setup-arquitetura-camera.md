# BRF-001 — AG07 — T-001 Setup TS + Vite + Phaser 3 + Vitest, câmera adaptativa e contratos Core/View

**Leia:** `docs/agentes/AG07_Arquiteto.md`, `GEMINI.md` (seção 2). **Regra:** respostas curtas; sem commit/push/branches.
**Decisão do dono:** Decisão #4 (Vitest + Playwright) e Decisão #5 (M1 `v0.1.0`).
**Contrato:**
- `src/version.ts`: exportar `export const GAME_VERSION = '0.1.0';`.
- `src/core/index.ts`: exportar tipos base puros (ZERO Phaser):
  - `Vector2D { x: number; y: number }`
  - `ForceType = 'inferno' | 'submundo' | 'empireo' | 'none'`
  - `MonsterType = 'normal' | 'boss'`
  - `MonsterDef { id: string; name: string; type: MonsterType; maxHp: number; attack: number; defense: number; moveSpeed: number; attackRange: number; attackCooldownMs: number; soulReward: number; spriteKey: string; }`
  - `SkillSlot = 'dash' | 'active_1' | 'active_2' | 'potion'`
  - `SkillDef { id: string; name: string; slot: SkillSlot; force: ForceType; cooldownMs: number; damageMultiplier?: number; radius?: number; healPercent?: number; maxCharges?: number; invulnerabilityMs?: number; dashDistance?: number; description: string; }`
  - `HeroStats { maxHp: number; hp: number; attack: number; defense: number; moveSpeed: number; attackRange: number; attackCooldownMs: number; critChance: number; critMultiplier: number; }`
  - `ViewportMode = 'desktop_landscape' | 'mobile_portrait'`
  - `ViewportConfig { mode: ViewportMode; width: number; height: number; aspectRatio: string }`
  - `resolveViewportConfig(windowWidth: number, windowHeight: number): ViewportConfig` retornando `{ mode: 'desktop_landscape', width: 800, height: 600, aspectRatio: '4:3' }` quando `windowWidth >= windowHeight` e `{ mode: 'mobile_portrait', width: 360, height: 640, aspectRatio: '9:16' }` quando `windowWidth < windowHeight`.
**Fazer:**
1. Criar `package.json` (com scripts `dev`, `build`, `preview`, `test`, `typecheck` e dependências `phaser`, `typescript`, `vite`, `vitest`, `@playwright/test`) e instalar via `npm install`.
2. Criar `tsconfig.json` (com `resolveJsonModule: true`, `strict: true`), `vite.config.ts`, `vitest.config.ts` e `index.html` (fundo sombrio `#09090b`, moldura centralizada).
3. Implementar `src/version.ts`, `src/core/index.ts`, `src/view/scenes/BootScene.ts` (carrega sprites de `/assets/sprites/` ou gera texturas de fallback caso ainda não carregados, exibe título/versão ou transiciona para `DungeonScene` se registrada) e `src/main.ts` (Phaser.Game com `pixelArt: true`, `roundPixels: true` e redimensionamento adaptativo via `resolveViewportConfig`).
4. Criar `tests/core/architecture.test.ts` validando `GAME_VERSION`, `resolveViewportConfig` (PC `800x600` e Mobile `360x640`) e garantindo que `src/core/index.ts` não importa `phaser`.
**Permitido:** `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `src/main.ts`, `src/version.ts`, `src/core/index.ts`, `src/view/scenes/BootScene.ts`, `tests/core/architecture.test.ts`.
**Proibido:** `src/data/`, `public/`, `netlify.toml`, `.github/`, `docs/` e comandos git (`commit`, `push`, `branch`, `checkout`, `reset`, `stash`).
**Pronto quando:** `npm run typecheck`, `npm test` e `npm run build` passarem sem erros.
**Entrega:** até 6 linhas: arquivos criados, resultado de `typecheck`/`test`/`build`, suposições e o que não foi verificado.
