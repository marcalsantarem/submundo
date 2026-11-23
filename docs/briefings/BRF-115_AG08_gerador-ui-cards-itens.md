# BRF-115 — AG08 (Arte): Gerador Dedicado de UI e Cards de Itens 2D Dark Fantasy (`scripts/art/uiCardGenerator.py`)

## Contexto
O dono aprovou o estilo visual 2D Dark Fantasy do painel `EQUIPAMENTO` (6 slots) e dos cards de item estilo Diablo, e solicitou criar um **gerador pronto de UI naquele estilo, principalmente para os itens** (Decisão #16), para reutilização contínua conforme novos itens forem adicionados ao jogo.

## Arquivos sob sua posse
- `scripts/art/uiCardGenerator.py` (criar novo gerador CLI reutilizável)
- `assets/mockups/preview_m7_ui_generator_cards.png` (prancha gerada pelo script como prova de funcionamento)

## Especificações Obrigatórias
1. **Gerador 100% reproduzível no ambiente Windows atual (Python stdlib + PowerShell/.NET `System.Drawing` com `SmoothingMode.AntiAlias` e `TextRenderingHint.AntiAliasGridFit`, sem depender de Pillow/Node):**
   - Ler diretamente `src/data/items.json`, `src/data/affixes.json` e `public/assets/sprites/ui_icons.png` (18 frames `64×64`, slots `weapon: 12, armor: 13, amulet: 14, ring: 15, helm: 16, boots: 17`).
   - Suportar CLI flexível via `argparse`:
     - `--item-id <id>`: gera um card individual de um item específico de `items.json`
     - `--rarity <common|magic|rare|legendary>`: força raridade do card
     - `--slot <weapon|armor|helm|boots|amulet|ring>`: filtra por slot
     - `--showcase`: gera a prancha completa (`assets/mockups/preview_m7_ui_generator_cards.png`) com 4 cards lado a lado cobrindo as **4 raridades** (`Lendário`, `Raro`, `Mágico`, `Comum`) e diferentes slots incluindo **Elmo** e **Bota**, mais o **painel `EQUIPAMENTO` (6 slots 2×3)** no mesmo estilo 2D Dark Fantasy!
     - `--out <caminho.png>`: caminho de saída customizável.
2. **Qualidade Visual 2D Dark Fantasy (NÃO Pixel Art):**
   - Tipografia serifada clássica anti-aliased (`Georgia` / `Palatino Linotype` / `Cambria`, sem `Consolas`/`monospace`) para títulos, cabeçalhos e Poder do Item, e `Segoe UI` suave para atributos e descrições.
   - Moldura dupla chanfrada metálica com gradiente vertical suave na cor da raridade (Laranja `#f97316` Lendário, Dourado `#facc15` Raro, Azul `#60a5fa` Mágico, Prata `#94a3b8` Comum).
   - Emblema superior (estrela dourada em Lendário, crânio ornamentado em Raro/Mágico) e crânio no rodapé.
   - Caixa de ícone 2D com o sprite real recortado de `public/assets/sprites/ui_icons.png` (interpolação `HighQualityBicubic`), engaste de gema no canto inferior direito, `Poder do Item`, divisor ornamental com losango central, atributo primário (`Dano por Segundo`, `Armadura`, `Vida Máxima`, `Chance Crítica`), afixos com marcador `◆`, aspecto lendário com `★` e `Nível Requerido`.
3. **Validação Obrigatória:**
   - Executar `python scripts/art/uiCardGenerator.py --showcase` e inspecionar visualmente `assets/mockups/preview_m7_ui_generator_cards.png` via `read_file` garantindo legibilidade, ausência de sobreposição de texto e fidelidade ao estilo aprovado.

## Restrições
- **PROIBIDO** executar comandos `git`.
