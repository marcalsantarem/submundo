# Bíblia Narrativa e Glossário Oficial — SUBMUNDO

## 1. Premissa e Tom Narrativo
- **Tom:** Dark Fantasy visceral, melancólico e implacável. Frases curtas, diretas e carregadas de atmosfera sombria, adequadas para leitura rápida em sessões de 3 a 5 minutos (PC e Mobile).
- **Arco Central:** Um guerreiro cai defendendo sua **Vila Natal** de uma invasão demoníaca. Antes que sua alma se apague, um **Emissário Celestial** crava um Selo em seu espírito, reerguendo-o como **Guerreiro Espectral** no **Submundo** com a missão de exterminar os Generais do **Inferno**. Mais tarde, revela-se a traição do **Empíreo**, que orquestrou o massacre para alimentar suas fornalhas de almas.
- **Foco do M1 (`v0.1.0` — Decisões #3 e #5):** Validação direta do loop de incursão na masmorra (4 salas + 1 Boss) e retorno ao **Refúgio do Submundo**, reservando o Prólogo jogável na Vila Natal para o M4.

---

## 2. Estrutura de Atos (Resumo)
1. **Ato 0 — Prólogo (M4):** Vida e queda na **Vila Natal** (Mundo dos Vivos) após o rompimento do Selo Antigo.
2. **Ato 1 — Despertar Espectral (M1–M2):** Pacto com o Emissário Celestial no **Refúgio do Submundo** e caçada ao primeiro carcereiro abissal (**Carcereiro Infernal**).
3. **Atos 2 e 3 — Caçada aos Generais:** Expansão das Formas de Espectro e descoberta dos vestígios da conspiração celestial.
4. **Ato 4+ — Ruptura do Selo:** Rebelião aberta contra as legiões do **Inferno** e os inquisidores do **Empíreo**.

---

## 3. Glossário Oficial de Termos e IDs

### 3.1. Facções e Forças Elementais
| ID / Chave | Nome Oficial (pt-BR) | Domínio / Mecânica | Descrição Curta |
| :--- | :--- | :--- | :--- |
| `inferno` | **Inferno** | Cinzas, Fogo Abissal (*Brasa*) | Legiões demoníacas que buscam consumir o mundo dos vivos em chamas. |
| `underworld` | **Submundo** | Sangue, Sombra (*Sangramento & Roubo de Vida*) | Plano umbral entre a vida e a morte onde repousam ruínas e espectros. |
| `empyrean` | **Empíreo** | Luz Celestial Corrompida (*Julgamento & Raio*) | Ordem angelical implacável que manipula almas sob o pretexto da salvação. |

### 3.2. Moedas e Recursos de Progressão
| ID / Chave | Nome Oficial (pt-BR) | Função no Loop |
| :--- | :--- | :--- |
| `souls` | **Almas** | Moeda comum coletada de monstros; mantida mesmo ao morrer na masmorra. Usada no Altar de Almas e no Ferreiro. |
| `general_essence` | **Essência de General** | Moeda rara dropada por Bosses (extraída na vitória); desbloqueia Skills e forjas Lendárias. |

### 3.3. Locais e Estruturas
| ID / Chave | Nome Oficial (pt-BR) | Papel no Mundo |
| :--- | :--- | :--- |
| `home_village` | **Vila Natal** | Lar humano do herói no Mundo dos Vivos, destruído na invasão do Prólogo (M4). |
| `underworld_refuge` | **Refúgio do Submundo** | Hub principal: ruínas espelhadas da Vila Natal iluminadas por chamas espirituais azuis. |
| `soul_altar` | **Altar de Almas** | Marco ancestral no Refúgio onde o Espectro canaliza Almas para elevar atributos permanentes. |
| `spectral_blacksmith` | **Ferreiro Espiritual** | Espírito aliado que forja e aprimora equipamentos no Refúgio do Submundo. |

### 3.4. Entidades do M1 (Herói e Monstros)
| ID Oficial | Nome Oficial (pt-BR) | Categoria | Lore / Comportamento |
| :--- | :--- | :--- | :--- |
| `wraith_warrior` | **Guerreiro Espectral** | Herói Jogável | Guerreiro caído reerguido pelo Selo Celestial; combate corpo a corpo visceral. |
| `abyssal_slime` | **Limo Abissal** | Monstro Comum | Massa faminta de cinzas e icor que escorre pelas fendas do Submundo. |
| `bone_sentinel` | **Sentinela Ósseo** | Monstro Comum | Ossadas de antigos guerreiros reanimadas pela vontade tirânica do Inferno. |
| `infernal_warden` | **Carcereiro Infernal** | Boss (Sala 5) | Carrasco colossal que guarda os portões da primeira masmorra e aprisiona almas recém-caídas. |

### 3.5. Ações e Habilidades do M1 (Skills e Consumíveis)
| ID Oficial | Nome Oficial (pt-BR) | Tipo / Força | Descrição Narrativa |
| :--- | :--- | :--- | :--- |
| `spectral_dash` | **Esquiva Espectral** | Mobilidade (Dash) | Dissolve o corpo em névoa umbral por um instante, atravessando golpes e inimigos. |
| `crimson_cleave` | **Golpe Carmesim** | Skill Ativa 1 (**Submundo**) | Corte amplo embebido em sangue espectral que dilacera inimigos próximos. |
| `infernal_eruption` | **Erupção Infernal** | Skill Ativa 2 (**Inferno**) | Rompe o solo com chamas abissais, incinerando as hordas ao redor do Espectro. |
| `soul_potion` | **Poção de Alma** | Consumível de Cura | Frasco de essência condensada que restaura instantaneamente a integridade espiritual. |

---

## 4. Diretrizes de Diálogos de Sistema (M1)
- Chave `dungeon_enter`: Aviso sombrio ao adentrar os corredores da masmorra.
- Chave `room_clear`: Confirmação breve de expurgo da sala e abertura do caminho adiante.
- Chave `boss_intro`: Confronto direto com o **Carcereiro Infernal** (`infernal_warden`) na Sala 5.
- Chave `run_victory`: Extração triunfante com Almas, equipamentos e Essência de General rumo ao **Refúgio do Submundo**.
- Chave `run_death`: Colapso da forma física na masmorra; retorno ao **Refúgio do Submundo** preservando as **Almas** coletadas.
