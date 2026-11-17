# Relatório de Validação QA — Marco 1 (`v0.1.0`): Fundação & Combate na Masmorra

- **Data:** 2026-11-17
- **Responsável:** AG03 (QA)
- **Briefing:** `BRF-011_AG03_validacao-m1.md` (T-010)
- **Veredito:** **PASSA COM RESSALVAS (menores não-bloqueantes)** — *0 bloqueantes, 0 graves, 2 menores*.

---

## 1. Estabilidade da Suíte Automatizada (3x `npm test`)

A suíte completa (Vitest unitário/integração de `src/core/` + E2E em navegador Chromium real) foi executada 3 vezes seguidas sem falhas ou flakiness:

| Execução | Arquivos de Teste | Total de Testes (`core` + E2E) | Status | Duração Total |
| :--- | :--- | :--- | :--- | :--- |
| **1ª Execução** | 5 passed (5) | 19 passed (18 `core` + 1 E2E) | ✅ Passou | `3585 ms` (`core`: `142 ms`, E2E: `3442 ms`) |
| **2ª Execução** | 5 passed (5) | 19 passed (18 `core` + 1 E2E) | ✅ Passou | `3746 ms` (`core`: `137 ms`, E2E: `3607 ms`) |
| **3ª Execução** | 5 passed (5) | 19 passed (18 `core` + 1 E2E) | ✅ Passou | `3647 ms` (`core`: `146 ms`, E2E: `3490 ms`) |

### Cobertura dos Arquivos de Teste
- `tests/core/architecture.test.ts` (4 testes): versão `0.1.0`, `resolveViewportConfig` (`800x600` PC e `360x640` Mobile) e isolamento de `src/core/index.ts`.
- `tests/core/combat.test.ts` (7 testes): movimentação com limites de arena, cálculo de dano/crítico, ataque básico automático no alvo mais próximo, `spectral_dash`, `crimson_cleave`, `infernal_eruption`, `soul_potion` e IA/morte.
- `tests/core/dungeon.test.ts` (4 testes): PRNG determinístico (`createSeededRng`), geração das 5 salas com margem segura, transição de salas 1→5 (`victory`) e bloqueio em `defeat`.
- `tests/core/m1-integration.test.ts` (3 testes): simulação integrada de incursão completa (Salas 1 a 5 até abater `infernal_warden` usando todas as skills e poção, totalizando 21 monstros mortos), regra de preservação de Almas ao morrer (`defeat`) e auditoria de zero imports de Phaser em todos os arquivos `src/core/**/*.ts`.
- `tests/e2e/m1-dungeon.spec.ts` (1 suíte E2E completa): execução em Chromium 156 headless validando `DungeonScene`, zero erros de console/página, uso das 4 skills/poção via `window.__SUBMUNDO_DEBUG__`, progressão pelas 5 salas até a vitória contra o Boss e geração das capturas PC/Mobile.

---

## 2. Build de Release (`npm run build`) e Tamanho dos Artefatos

Comando executado: `tsc --noEmit && vite build` (concluído em `65 ms`, zero erros de tipagem ou warnings).

| Arquivo em `dist/` | Tamanho | Observação |
| :--- | :--- | :--- |
| `dist/index.html` | `1.07 kB` (1.071 B) | Entrada HTML com container responsivo |
| `dist/assets/app.js` | `1251.14 kB` (~1,25 MB) | Bundle de produção (Phaser 3.80 + `core` + `view` + JSONs) |
| `dist/assets/sprites/wraith_warrior.png` | `533 B` | Spritesheet Pixel Art 32x32 (4 frames) |
| `dist/assets/sprites/abyssal_slime.png` | `317 B` | Spritesheet Pixel Art 32x32 (4 frames) |
| `dist/assets/sprites/bone_sentinel.png` | `335 B` | Spritesheet Pixel Art 32x32 (4 frames) |
| `dist/assets/sprites/infernal_warden.png` | `621 B` | Spritesheet Pixel Art 64x64 Boss (4 frames) |
| `dist/assets/sprites/dungeon_tiles.png` | `330 B` | Tileset 16x16 (chão, parede, portal) |
| `dist/assets/sprites/soul_orb.png` | `153 B` | Spritesheet 16x16 (2 frames) |
| `dist/assets/sprites/manifest.json` | `1.60 kB` | Manifesto de verificação dos assets |

---

## 3. Validação no Navegador Real e Capturas de Tela

- **Console / Page Errors:** `0` erros de console (`console.error`) e `0` exceções não tratadas (`pageerror`).
- **Capturas geradas:**
  - PC Desktop Paisagem (`800x600`, `4:3`): `docs/qa/screenshots/m1-pc-800x600.png` (`25.8 kB`)
  - Mobile Retrato (`360x640`, `9:16`): `docs/qa/screenshots/m1-mobile-360x640.png` (`19.9 kB`)

---

## 4. Classificação de Achados

### Bloqueantes (0)
- Nenhum.

### Graves (0)
- Nenhum.

### Menores (2)
1. **Sobreposição visual entre rótulo da skill e contador numérico de recarga nos botões do HUD**
   - **Local:** `src/view/ui/DungeonHud.ts:417-422` (e criação em `src/view/ui/DungeonHud.ts:550-574`).
   - **Descrição:** O texto do nome da habilidade (`btn.labelText`, posicionado em `y = -4`) permanece visível quando `btn.cooldownText` (`y = 0`) é exibido durante o cooldown, causando leve sobreposição entre o rótulo (`Carmesim` / `Erupção`) e o contador em segundos (`5.9s` / `13.9s`).
   - **Passo a passo:** Iniciar a incursão, acionar `Golpe Carmesim` (`1`/`J`) ou `Erupção Infernal` (`2`/`K`) e observar o botão circular enquanto o cooldown está ativo.
   - **Recomendação (Backlog/M2):** Ocultar `btn.labelText.setVisible(!isOnCooldown)` durante a recarga ou deslocar `cooldownText` para `y = 10`.

2. **`forceClearRoom()` na API de debug avança e limpa a sala seguinte se chamado durante `room_cleared`**
   - **Local:** `src/view/scenes/DungeonScene.ts:239-241`.
   - **Descrição:** Se `window.__SUBMUNDO_DEBUG__.forceClearRoom()` for chamado quando a sala atual já está em estado `room_cleared`, ele executa `this.advanceRoomNow()` sem `return;` e em seguida abate imediatamente os monstros da nova sala carregada. Não afeta o gameplay normal do jogador.
   - **Passo a passo:** Limpar uma sala e, antes do auto-avanço de `1200 ms`, chamar `window.__SUBMUNDO_DEBUG__.forceClearRoom()` no console.

---

## 5. O que Não Pôde Ser Verificado Automaticamente & Roteiro para o Dono

### O que requer validação humana no aparelho real
- Sensação tátil e fluidez do joystick virtual flutuante com 1 polegar em tela touch real.
- Conforto ergonômico do arco de botões de ação no canto inferior direito em smartphones físicos.

### Roteiro Curto de Teste para o Dono (3 minutos)
1. **PC Desktop (`800x600`):**
   - Abra a URL de preview (`dev` no Netlify ou `npm run dev`).
   - Movimente o Guerreiro Espectral com `WASD` ou Setas até os Limos Abissais na **Sala 1/5** e observe o **ataque básico automático** ao entrar no alcance.
   - Pressione `Espaço` ou `Shift` para testar a **Esquiva Espectral (Dash)**, `1`/`J` para **Golpe Carmesim**, `2`/`K` para **Erupção Infernal** e `3`/`Q` para **Poção de Alma**.
   - Elimine os monstros das Salas 1 a 4 (entrando no **Portal Espectral** ou aguardando o avanço automático de 1,2s) até alcançar a **Sala 5/5 (Carcereiro Infernal)**.
   - Derrote o Boss e verifique o modal de **Vitória** com o total de Almas preservadas e o botão **Nova Incursão**.
2. **Celular / Modo Retrato (`9:16`):**
   - Abra no celular (ou redimensione o navegador para formato vertical) e valide o controle com 1 polegar: toque e arraste na metade inferior esquerda para usar o **joystick virtual flutuante** e toque nos 4 botões em arco à direita para acionar Dash, Skills e Poção.
