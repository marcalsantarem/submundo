# Relatório de Validação QA — Marco 2 (`v0.2.0`): Loot, Equipamentos, Sinergias & PWA

- **Data:** 2026-11-17
- **Responsável:** AG03 (QA)
- **Briefing:** `BRF-028_AG03_validacao-m2.md` (T-022)
- **Veredito:** **PASSA COM RESSALVAS (menores não-bloqueantes)** — *0 bloqueantes, 0 graves, 2 menores*.

---

## 1. Estabilidade da Suíte Automatizada (3x `npm test`)

`npm run typecheck` passou com `0` erros. A suíte completa (Vitest unitário/integração de `src/core/` + 2 suítes E2E em navegador Chromium real) foi executada 3 vezes seguidas sem falhas ou flakiness:

| Execução | Arquivos de Teste | Total de Testes (`core` + E2E) | Status | Duração Total |
| :--- | :--- | :--- | :--- | :--- |
| **1ª Execução** | 8 passed (8) | 38 passed (36 `core` + 2 E2E) | ✅ Passou | `8582 ms` (`core`: `167 ms`, M1 E2E: `3415 ms`, M2 E2E: `5000 ms`) |
| **2ª Execução** | 8 passed (8) | 38 passed (36 `core` + 2 E2E) | ✅ Passou | `8636 ms` (`core`: `176 ms`, M1 E2E: `3368 ms`, M2 E2E: `5091 ms`) |
| **3ª Execução** | 8 passed (8) | 38 passed (36 `core` + 2 E2E) | ✅ Passou | `8614 ms` (`core`: `185 ms`, M1 E2E: `3378 ms`, M2 E2E: `5047 ms`) |

### Cobertura dos Arquivos de Teste
- `tests/core/architecture.test.ts` (7 testes): versão `0.2.0`, `resolveViewportConfig` (`800x600` PC e `360x640` Mobile), zero Phaser em `src/core/index.ts`, contratos de loot/sinergias, multi-touch (`activePointers >= 4` + `touch-action: none`) e tags/registro PWA.
- `tests/core/combat.test.ts` (7 testes): movimentação, dano/crítico, ataque básico automático, skills e IA/morte.
- `tests/core/dungeon.test.ts` (4 testes): PRNG determinístico, 5 salas e transições `victory`/`defeat`.
- `tests/core/loot.test.ts` (8 testes): zero Phaser em `src/core/loot/*`, cores por raridade, chance de drop (100% Boss, 30%+sorte normal), afixos/poderes lendários, equipar/desequipar, recálculo de atributos e extração vs perda total ao morrer.
- `tests/core/m1-integration.test.ts` (3 testes): regressão integrada da incursão Salas 1→5, preservação de Almas e zero Phaser em todo `src/core/**/*.ts`.
- `tests/core/synergies.test.ts` (7 testes): 3 Forças (🔥 Inferno/Brasa+Nova/Rastro, 🩸 Submundo/Sangramento+Roubo+Lacaios, ⚡ Empíreo/Julgamento+Raio+CDR).
- `tests/e2e/m1-dungeon.spec.ts` (1 suíte E2E): regressão completa do M1 em Chromium headless (`800x600` e `360x640`).
- `tests/e2e/m2-loot.spec.ts` (1 suíte E2E): validação completa do M2 em Chromium headless (`800x600` e `360x640`).

---

## 2. Regressão do M1 e Cobertura do M2

- **Regressão M1:** `m1-dungeon.spec.ts` e todos os testes `core` do M1 seguem 100% verdes. Os 2 achados menores reportados em `qa-M1.md` foram corrigidos no M2 (`DungeonHud.ts:504` oculta `labelText` em cooldown; `DungeonScene.ts:317-320` retorna após `advanceRoomNow()`).
- **Loot & Inventário:** validado no navegador real via `spawnTestDrop('legendary')`, coleta automática ao mover o herói sobre o drop, auto-equipamento em slot livre, `equipItem` explícito pela mochila e atualização de atributos/forças/poderes em `getHero()` e `getInventory()`.
- **Modal de Inventário & Pausa:** abertura e fechamento validados via tecla `I`, clique no botão `"Bolsa"` do HUD (PC `800x600` e Mobile `360x640`) e `Escape`, confirmando congelamento de `runState.elapsedMs` e bloqueio de skills enquanto aberto.
- **Extração vs Perda Total:** confirmado em E2E que a vitória na Sala 5 transfere todos os itens equipados + mochila para `extractedItems` (`lostItemsOnDeath = 0`), e que a derrota transfere tudo para `lostItemsOnDeath` zerando `equipped` e `bag`.
- **Boss Rebalanceado:** `infernal_warden` confirmado com `maxHp = 280` (`src/data/monsters.json:32` e verificado na Sala 5/5 do E2E).
- **Multi-touch:** `activePointers: 4` (`src/main.ts:17`), `VirtualJoystick.ts:32-35`, `DungeonHud.ts:146-149` e `touch-action: none` (`index.html:24`) verificados nos testes estáticos/arquitetura.
- **PWA & iOS:** título `SUBMUNDO v0.2.0`, links no DOM e resposta HTTP `200` para `./manifest.webmanifest`, `./icons/icon-192.png`, `./icons/apple-touch-icon.png` e `./sw.js` validados no navegador real.

---

## 3. Build de Release (`npm run build`), Tamanho em `dist/` e Capturas

Comando executado: `tsc --noEmit && vite build` (concluído em `65 ms`, zero erros de tipagem). Total em `dist/`: **`3.1M`** (`3.187.206 B` em 17 arquivos; ou **`1.89 MB`** sem o PNG mestre não utilizado em runtime).

| Arquivo em `dist/` | Tamanho | Observação |
| :--- | :--- | :--- |
| `dist/assets/app.js` | `1.34 MB` (`1.377.111 B`) | Bundle JS (Phaser 3.80 + `core` + `view` + JSONs) |
| `dist/assets/icons/submundo_icon_master.png` | `1.30 MB` (`1.298.128 B`) | Asset mestre copiado de `public/` sem uso em runtime (ver Menor #2) |
| `dist/icons/icon-512.png` | `379.95 kB` (`379.951 B`) | Ícone PWA 512x512 |
| `dist/icons/icon-192.png` | `64.58 kB` (`64.581 B`) | Ícone PWA 192x192 |
| `dist/icons/apple-touch-icon.png` | `57.46 kB` (`57.460 B`) | Ícone iOS Home Screen 180x180 |
| `dist/sw.js` | `2.31 kB` (`2.314 B`) | Service Worker offline-first |
| `dist/assets/sprites/manifest.json` | `2.13 kB` (`2.126 B`) | Manifesto dos sprites |
| `dist/index.html` | `1.79 kB` (`1.790 B`) | Entrada HTML + meta tags PWA/iOS |
| `dist/manifest.webmanifest` | `506 B` | Manifesto Web App |
| `dist/assets/sprites/*.png` (8 spritesheets) | `3.45 kB` (`3.449 B` total) | Incluindo `loot_drops.png` (`541 B`) e `loot_icons.png` (`409 B`) |

- **Console / Page Errors:** `0` erros de console (`console.error`) e `0` exceções não tratadas (`pageerror`).
- **Capturas geradas e inspecionadas:**
  - PC Desktop Paisagem (`800x600`): `docs/qa/screenshots/m2-pc-800x600.png` (`86.5 kB`) — `InventoryModal` aberto com itens equipados, forças ativas, barra de atributos e mochila.
  - Mobile Retrato (`360x640`): `docs/qa/screenshots/m2-mobile-360x640.png` (`39.2 kB`) — arena mobile 9:16 com drops lendário/raro no chão, HUD, botão `Bolsa (0)`, joystick `MOVER` e botões em arco.

---

## 4. Classificação de Achados

### Bloqueantes (0)
- Nenhum.

### Graves (0)
- Nenhum.

### Menores (2)
1. **Sobreposição de texto na Mochila do `InventoryModal` quando o nome do item quebra em 2 linhas**
   - **Local:** `src/view/ui/InventoryModal.ts:779-788`.
   - **Descrição:** Na lista da Mochila, `row.nameText` (em `y = top`, `wordWrapWidth = w - 105`) ocupa 2 linhas quando o item possui nome/sufixo ou poder lendário longo (ex.: `[Arma] Montante das Cinzas - Supernova Abissal`), enquanto `row.statsText` permanece fixo em `y = top + 20`, causando sobreposição da 2ª linha do título com a linha de atributos.
   - **Passo a passo:** Coletar ao menos 1 item raro/lendário de nome longo na mochila, abrir o inventário (`I` ou botão `"Bolsa"`) em `800x600` e observar o card na coluna `MOCHILA` (visível em `docs/qa/screenshots/m2-pc-800x600.png`).
   - **Recomendação:** Reduzir `fontSize` para `10px`, aumentar `rowH` ou truncar/ajustar `statsText` para `top + 28` quando `nameText.height > 16`.

2. **Asset mestre `submundo_icon_master.png` (`~1,30 MB`) incluído desnecessariamente no build `dist/`**
   - **Local:** `public/assets/icons/submundo_icon_master.png` (referenciado apenas por `scripts/art/generateIcons.py:10` a partir de `assets/icons/`).
   - **Descrição:** Como tudo dentro de `public/` é copiado intacto pelo Vite para `dist/`, a cópia do PNG mestre de 1,30 MB infla o pacote de distribuição em ~69% sem ser carregada pelo jogo ou pelo `manifest.webmanifest`.
   - **Passo a passo:** Rodar `npm run build` e listar `dist/assets/icons/`.
   - **Recomendação:** Remover `public/assets/icons/submundo_icon_master.png` (mantendo apenas o original em `assets/icons/submundo_icon_master.png`).

*(Nota técnica de QA: o shim local de `@playwright/test` em `node_modules/@playwright/test/index.js:435-436` despacha `KeyboardEvent` simultaneamente em `window` e `document` com `bubbles: true`, duplicando teclas de toggle no `Phaser`; no navegador real o evento ocorre uma única vez e `m2-loot.spec.ts` usa `window.dispatchEvent` unitário para simular fielmente a tecla `I`/`Escape`.)*

---

## 5. O que Não Pôde Ser Verificado Automaticamente & Roteiro para o Dono

### O que requer validação humana no aparelho real
- Resposta física **multi-touch** simultânea (segurar/arrastar o joystick com o polegar esquerdo enquanto pressiona Dash/Skills/Poção com o polegar direito em tela capacitiva).
- Fluxo real de instalação **PWA "Adicionar à Tela de Início"** no Safari (iOS/iPhone) e Chrome (Android), abertura em modo `standalone` sem barra do navegador e reabertura offline via `sw.js`.

### Roteiro Curto de Teste para o Dono (4 minutos)
1. **Celular / iPhone (PWA + Multi-touch + Loot):**
   - Abra a URL da `dev` no Safari (iPhone) ou Chrome (Android).
   - No Safari: toque em **Compartilhar → Adicionar à Tela de Início**, confirme o ícone do **SUBMUNDO** e abra o app pela tela inicial (deve abrir sem barra de endereço).
   - Em combate, **mova com o polegar esquerdo** no joystick `MOVER` e **ao mesmo tempo** toque em **Dash**, **Carmesim** ou **Erupção** com o polegar direito para validar o multi-touch.
   - Derrote os inimigos até cair um orbe colorido de loot no chão, passe por cima para coletar, toque em **`Bolsa (N)`** para abrir o inventário (o combate deve pausar), equipe/compare itens e feche.
2. **PC Desktop (`800x600`):**
   - Abra no navegador, pressione `I` (ou clique em **`Bolsa (N)`**) para validar a pausa e os bônus das 3 Forças (`Inferno`, `Submundo`, `Empíreo`), pressione `Esc` ou `I` para retomar e conclua até o **Carcereiro Infernal** na Sala 5/5 para confirmar a extração dos itens na vitória (e perda ao morrer).
