# BRF-041 — AG02 — T-051 Correção das Ressalvas do QA M3 no BlacksmithModal

**Leia:** `docs/agentes/AG02_UI.md`, `docs/qa/qa-M3.md` (seção 4 — Menores), `src/view/ui/BlacksmithModal.ts`. **Regra:** respostas curtas; zero git commands.
**Decisão do dono:** Autorização explícita da `T-051` (M4).
**Fazer:**
1. Em `src/view/ui/BlacksmithModal.ts` (desktop `800x600`, ~linhas 808–816 e `renderSnapshot` ~linhas 869–878):
   - No card `Forjar Relíquia Lendária` (e Rara), `card.costText` (`"Custo: 1 Essência + 120 Almas"`) encosta na borda esquerda de `card.btnContainer` (`Forjar`) porque compartilha a mesma altura `bottom - 22` sem quebra/espaçamento suficiente.
   - Ajuste o layout desktop dos cards de forja para garantir folga visual clara entre `costText` e o botão `Forjar` (ex.: definir `wordWrapWidth(w - btnW - 28)` e/ou posicionar `costText` com segurança sem jamais invadir a área do botão).
2. Em `src/view/ui/BlacksmithModal.ts` (~linhas 931–936):
   - `ProfileManager.upgradeItemWithBlacksmith` já grava `(+N)` no final de `item.name`. Remova a concatenação duplicada de `const suffix = level > 0 ? ...` em `row.nameText` (só anexe `(+${level})` se `level > 0 && !item.name.includes(\`(+\${level})\`)`).
**Permitido:** `src/view/ui/BlacksmithModal.ts`.
**Proibido:** alterar `src/core/`, `tests/` e executar comandos git.
**Pronto quando:** `npm run typecheck` e `npm run build` limpos.
**Entrega:** até 4 linhas descrevendo os ajustes em `BlacksmithModal.ts`.
