# Relatório de Validação QA — Marco 8 (`v0.8.0`): Mapa Contínuo, Masmorra Básica 2.5D, 6 Biomas na testArena (`?biome=`), Coleta por Clique e Botão "Pegar"

- **Data:** 2026-11-23
- **Responsável:** AG03 (QA)
- **Briefing:** `BRF-146_AG03_validacao-m8.md` (`T-076`)
- **Commit validado:** `780a627` (branch `dev`)
- **Escopo (decidido pelo dono):** mapa contínuo (salas com corredores curvos e sala gigante), Masmorra Básica 2.5D, os 6 biomas de batalha na testArena via `?biome=` (T-073), carregamento dos biomas e versão `0.8.0` (T-075), coleta por clique, botão "Pegar"/tecla `E` (T-132) e animação de ataque do herói. **Fora do escopo:** Vila Natal e Refúgio (T-074) e a campanha sem teleporte (T-129), ambas adiadas.
- **Veredito:** **PASSA COM RESSALVAS** — *0 bloqueantes, 0 graves, 3 menores* (ver Seção 4). A suíte passou em 3 rodadas completas seguidas (rodadas 2, 3 e 4; a rodada 1 teve 1 falha de tolerância no teste novo, corrigida no spec), tirando a `m4` com o erro de ambiente já conhecido.

---

## 1. Testes Criados

`tests/e2e/m8-biomes.spec.ts` (**11 testes**, PC `960×540` + Mobile Paisagem `844×390`):

| # | Teste | O que verifica |
| :--- | :--- | :--- |
| 1–6 | `?biome=<id>&seed=101` para `herb_field`, `village_grotto`, `village_mine`, `mine_depths`, `ancient_seal`, `submundo_abyss` | `getBiomeId() === <id>`; seed 101; texturas em uso na cena incluem `biome_<id>_tiles` e `biome_<id>_props` (tilemap + sprites), sem `dungeon_basic_*` nem texturas de outro bioma; canvas `16:9`; FPS médio (4 s, `game.loop.actualFps`) > 25; captura PC e captura mobile (contexto `hasTouch`); zero erros de console/página/404 |
| 7 | `?biome=village` | Cai na Masmorra Básica (`dungeon_basic`, textura `dungeon_basic_tiles`, nenhuma `biome_*`) |
| 8 | `?biome=nao_existe` (id inválido) | Igual ao 7 |
| 9 | `?biome=mine_depths&map=giant&seed=707` | Bioma aplicado na sala gigante (`mode=giant`, `seed=707`, texturas `biome_mine_depths_*`) e FPS |
| 10 | `?biome=village_grotto&seed=101` jogado até o fim | Animação `*_attack` do herói toca no combate (auto-ataque); caminhada por teclado zona 0→1→2 (ondas 1→2→3) com o bioma; overlay "Teste finalizado" visível; bioma mantido |
| 11 | Botão "Pegar" / tecla `E` (`?biome=herb_field&map=rooms&seed=7`) | **Apagado** sem item por perto (`pickupStateKey='off'`, alpha `0.45`, `E` não faz nada); **aceso** com item a 48 px (`on:rare`, alpha `1`); `E` coleta de perto na hora; item a ~120 px: `E` faz o herói caminhar e coletar ao chegar (≤ 45 px); **clique real do mouse no botão** coleta o item próximo e o botão volta a apagar |

Ajuste durante a validação: na rodada 1, o teste 11 falhou porque a minha faixa de distância estava apertada demais (`136,4 px` contra o limite de `135`; o steering do helper tem tolerância de ±5 px por eixo). A faixa passou para `100–140 px` (continua acima do alcance de clique de 70 e dentro do raio de busca de 180). Não foi defeito do jogo.

---

## 2. Resultados das Rodadas (`npm test` → `npm run build` → E2E um arquivo por vez, `--workers=1`)

| Rodada | Vitest | Build | m1 | m2 | m3 | m4 | m5 | m6 | m7 | m8-biomes | m8-dungeon-basic | m8-ground-pickup |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | 85/85 | OK | 1/1 | 1/1 | 1/1 | ⚠️ ambiente | 1/1 | 1/1 | 3/3 | 10/11 (faixa do teste, corrigida) | 3/3 | 1/1 |
| 2 | 85/85 | OK | 1/1 | 1/1 | 1/1 | ⚠️ ambiente | 1/1 | 1/1 | 3/3 | 11/11 | 3/3 | 1/1 |
| 3 | 85/85 | OK | 1/1 | 1/1 | 1/1 | ⚠️ ambiente | 1/1 | 1/1 | 3/3 | 11/11 | 3/3 | 1/1 |
| 4 | 85/85 | OK | 1/1 | 1/1 | 1/1 | ⚠️ ambiente | 1/1 | 1/1 | 3/3 | 11/11 | 3/3 | 1/1 |

- **m4 (conhecido, não corrigido):** `TypeError: Module "file:///C:/Repos/submundo/src/data/campaign.json" needs an import attribute of "type: json"` ao carregar o spec no Node do Playwright → "No tests found". Erro de ambiente do carregamento do spec, não do jogo.
- **Build de release:** `tsc --noEmit` + `vite build` OK; `dist/` com **3,3 MB**; `dist/assets/index-*.js` com **1.833 kB** (gzip **440 kB**). O Vite avisa sobre chunk > 500 kB (só aviso).
- **Versão:** `package.json` e `src/version.ts` em `0.8.0`.

---

## 3. FPS Médio por Bioma (Chromium headless, `960×540`, 4 s com a onda 1 viva)

| Bioma | Rodada 1 | Rodada 2 | Rodada 3 | Rodada 4 |
| :--- | :--- | :--- | :--- | :--- |
| `herb_field` (Plantação de Ervas) | 43,4 | 43,4 | 43,4 | 43,2 |
| `village_grotto` (Gruta da Cachoeira) | 39,5 | 39,7 | 39,7 | 41,9 |
| `village_mine` (Mina Iluminada) | 42,4 | 39,7 | 39,7 | 39,7 |
| `mine_depths` (Fundo da Mina) | 39,2 | 39,7 | 39,5 | 39,4 |
| `ancient_seal` (Selo Antigo) | 42,1 | 39,7 | 42,1 | 42,1 |
| `submundo_abyss` (Submundo) | 40,0 | 40,3 | 40,0 | 39,4 |
| `mine_depths` na sala gigante (`map=giant&seed=707`) | 41,4 | 41,1 | 41,9 | 41,1 |

*Leitura:* o Chromium headless deste Windows roda sem GPU e fica em ~40 FPS em **todos** os biomas, inclusive na Masmorra Básica. Os números servem para comparar biomas (nenhum se destaca para pior; a sala gigante não pesa mais que o mapa de salas), não como FPS real. O FPS real no aparelho fica para o roteiro manual.

---

## 4. Classificação de Achados

- **Bloqueantes:** 0
- **Graves:** 0
- **Menores:**
  1. **Título do tracker fixo** (ressalva conhecida da T-073): a HUD mostra "A Gruta da Cachoeira" no objetivo em **todos** os biomas e também na Masmorra Básica (visto nas capturas `m8_biome_*_pc.png`). Só texto; não afeta o jogo.
  2. **Vazio fora do mapa preto na Plantação de Ervas** (ressalva conhecida da T-073, backlog): o fundo além das sebes é preto num bioma de dia. Estético.
  3. **E2E `m4-campaign`** não carrega no Playwright local (erro do import de `campaign.json`, Seção 2). Fora do código do jogo; continua pendente.
- **Efeito colateral das rodadas (só arquivos de QA):** os specs existentes regravam as próprias capturas: `m8_map_*.png` (versionadas, regravadas pela `m8-dungeon-basic`) e novas `m1/m2/m3-*-960x540|844x390.png` e `m7-*-landscape.png` (não versionadas). Nenhuma captura versionada foi apagada.

---

## 5. Capturas Geradas (`docs/qa/screenshots/`)

PC `960×540` e Mobile Paisagem `844×390` de cada bioma (onda 1, HUD completa):
`m8_biome_herb_field_{pc,mobile}.png`, `m8_biome_village_grotto_{pc,mobile}.png`, `m8_biome_village_mine_{pc,mobile}.png`, `m8_biome_mine_depths_{pc,mobile}.png`, `m8_biome_ancient_seal_{pc,mobile}.png`, `m8_biome_submundo_abyss_{pc,mobile}.png`.

---

## 6. O que Não Foi Verificado Automaticamente

- FPS em GPU real (PC e celular): o headless não tem aceleração.
- Qualidade visual da iluminação (escuridão, halos de tochas/cristais/braseiros, luz em volta do herói): as texturas foram conferidas em uso, mas o resultado visual depende de olhar as capturas e jogar.
- Toque real no botão "Pegar" no celular (o E2E usa clique de mouse no PC; o mobile só é coberto por captura).
- Vila Natal, Refúgio e campanha (fora do escopo, T-074/T-129 adiadas).

---

## 7. Roteiro de Teste Manual para o Dono (`https://dev--submundo-game.netlify.app`)

### 7.1. URLs prontas dos biomas
| Bioma | URL |
| :--- | :--- |
| Masmorra Básica (padrão) | `https://dev--submundo-game.netlify.app/?seed=101` |
| Plantação de Ervas | `https://dev--submundo-game.netlify.app/?biome=herb_field&seed=101` |
| Gruta da Cachoeira | `https://dev--submundo-game.netlify.app/?biome=village_grotto&seed=101` |
| Mina Iluminada | `https://dev--submundo-game.netlify.app/?biome=village_mine&seed=101` |
| Fundo da Mina | `https://dev--submundo-game.netlify.app/?biome=mine_depths&seed=101` |
| Selo Antigo | `https://dev--submundo-game.netlify.app/?biome=ancient_seal&seed=101` |
| Submundo | `https://dev--submundo-game.netlify.app/?biome=submundo_abyss&seed=101` |
| Sala gigante (Fundo da Mina) | `https://dev--submundo-game.netlify.app/?biome=mine_depths&map=giant&seed=707` |
| Fallback (deve cair na Masmorra Básica) | `https://dev--submundo-game.netlify.app/?biome=village&seed=101` |

### 7.2. No PC (`F12` aberto no Console)
1. Abra cada URL: confira o título `SUBMUNDO v0.8.0`, o piso/paredes/props do bioma, tochas animadas e a iluminação (Ervas clara; Fundo da Mina e Submundo bem escuros, com luz em volta do herói). Console sem erros.
2. Lute a onda 1 e veja a **animação de ataque** do herói (golpe com arco e impacto).
3. Limpe a sala, caminhe pelo **corredor curvo** até a próxima (porta abre, a onda nasce ao entrar) e vença o Esqueleto Chefe até **"Teste finalizado"**.
4. **Botão "Pegar":** fica apagado sem item por perto e acende (anel na cor da raridade) quando há item próximo. Aperte `E` perto de um item (coleta na hora) e a ~3–4 passos de distância (o herói caminha e coleta). Clicar no item no chão continua funcionando.
5. Na sala gigante, ande pelo mapa aberto e veja se o FPS fica estável.

### 7.3. No celular (paisagem)
1. Abra 2 ou 3 biomas (um claro, como Ervas, e um escuro, como Submundo): sem cortes, HUD legível e FPS estável ao andar.
2. Toque no botão **"Pegar"** (acima do Ataque) com um item por perto e veja que ele não dispara ataque nem mexe o joystick.
3. Sabido: o título do objetivo mostra "A Gruta da Cachoeira" em todos os biomas (ressalva 1).
