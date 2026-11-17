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

---

## 5. Equipamentos, Raridades e 3 Forças (M2)

### 5.1. Slots Oficiais de Equipamento
| ID do Slot | Nome Oficial (pt-BR) | Função / Foco de Atributos |
| :--- | :--- | :--- |
| `weapon` | **Arma** | Define velocidade, alcance e formato do ataque básico do Espectro. |
| `armor` | **Armadura Espectral** | Define Vida Máxima, Defesa e Resistência contra golpes abissais. |
| `amulet` | **Amuleto / Selo** | Focado em Recarga (Cooldown) e modificadores das Skills Ativas. |
| `ring` | **Anel de Alma** | Focado em Chance Crítica, Dano Crítico, Velocidade e Sorte. |

### 5.2. Raridades Oficiais
| ID da Raridade | Nome Oficial (pt-BR) | Estrutura de Poder |
| :--- | :--- | :--- |
| `common` | **Comum** | Apenas atributo base do slot. |
| `magic` | **Mágico** | Atributo base + 1 afixo sorteado. |
| `rare` | **Raro** | Atributo base + 2 a 3 afixos sorteados. |
| `legendary` | **Lendário** | Atributo base + 3 afixos + **1 Poder Lendário** único. |

### 5.3. Mecânicas das 3 Forças (Sinergias de Build)
| ID da Força | Nome Oficial | ID da Mecânica | Mecânica Canônica |
| :--- | :--- | :--- | :--- |
| `inferno` | **Inferno** | `ember` (**Brasa**) | Acumula queimaduras no alvo que explodem em área ao atingir **5 cargas**. |
| `submundo` | **Submundo** | `bleed` (**Sangramento & Roubo de Vida**) | Aplica dano contínuo de sangramento enquanto drena vitalidade para curar o Espectro. |
| `empireo` | **Empíreo** | `judgment` (**Julgamento & Raio**) | Acertos críticos disparam raios celestiais em cadeia e atordoam os inimigos atingidos. |

### 5.4. Os 6 Poderes Lendários Canônicos (M2)
| ID do Poder | Nome Canônico (pt-BR) | Força | Descrição Canônica |
| :--- | :--- | :--- | :--- |
| `inferno_dash_trail` | **Rastro de Cinzas** | **Inferno** (`inferno`) | A Esquiva Espectral deixa um rastro de fogo infernal que aplica **Brasa** nos inimigos atravessados. |
| `inferno_ember_nova` | **Nova de Brasa** | **Inferno** (`inferno`) | Ao atingir 5 cargas de **Brasa**, a explosão causa dano incendiário ampliado e espalha **Brasa** aos alvos próximos. |
| `submundo_bleed_minion` | **Chamado do Obituário** | **Submundo** (`submundo`) | Inimigos abatidos sob **Sangramento** têm chance de erguer um servo espectral temporário para lutar ao seu lado. |
| `submundo_crimson_pact` | **Pacto Carmesim** | **Submundo** (`submundo`) | Intensifica o **Sangramento** e converte parte do dano contínuo em **Roubo de Vida** direto para o Espectro. |
| `empireo_crit_lightning` | **Veredicto Fulminante** | **Empíreo** (`empireo`) | Acertos críticos liberam um raio celestial em cadeia nos inimigos próximos, aplicando **Julgamento**. |
| `empireo_judgment_haste` | **Ímpeto do Julgamento** | **Empíreo** (`empireo`) | Aplicar **Julgamento** ou atordoar inimigos acelera os ataques e reduz a recarga das Skills do Espectro. |

---

## 6. Diretrizes de Diálogos de Loot e Extração (M2)
- Chave `loot_drop_legendary`: Alerta imediato ao cair um item **Lendário**, reforçando que a posse definitiva depende da extração.
- Chave `inventory_hint`: Dica concisa do **Ferreiro Espiritual** sobre os 4 slots (`weapon`, `armor`, `amulet`, `ring`) e sinergias das 3 Forças.
- Chave `extraction_loot_kept`: Confirmação na vitória de que Almas, Essências e equipamentos coletados foram garantidos no **Refúgio do Submundo**.
- Chave `death_loot_lost`: Aviso de derrota reforçando a regra central: equipamentos não extraídos se perdem na masmorra, mas as **Almas** permanecem.

---

## 7. Refúgio no Submundo: NPCs, Estações e Diálogos (M3)

### 7.1. Glossário do Refúgio (NPCs, Estações e Recursos)
| ID / Chave | Nome Oficial (pt-BR) | Papel no Refúgio / Loop |
| :--- | :--- | :--- |
| `celestial_emissary` | **Emissário Celestial** | Anjo que impôs o Selo ao Espectro; recepciona o herói no Refúgio e orienta a caçada aos Generais. |
| `spectral_blacksmith` | **Ferreiro Espiritual** | Espírito aliado que aprimora itens (`+1`, `+2`, `+3`) com **Almas** e forja relíquias **Lendárias** com **Essência de General**. |
| `soul_altar` | **Altar de Almas** | Marco ancestral onde **Almas** preservadas são canalizadas em fortalecimentos permanentes para o Guerreiro Espectral. |
| `rift_portal` | **Portal da Fenda** | Limiar abissal no Refúgio que inicia uma nova incursão na masmorra (4 salas + Boss). |
| `general_essence` | **Essência de General** | Recurso raro obtido ao derrotar Bosses (como o **Carcereiro Infernal**) e usado em forjas Lendárias e desbloqueios avançados. |

### 7.2. Diretrizes de Diálogos do Refúgio e Essência (M3)
- Chave `hub_welcome`: Boas-vindas do **Emissário Celestial** ao **Refúgio do Submundo**, apresentando o papel do Altar e do Ferreiro.
- Chave `altar_intro`: Orientação do **Altar de Almas** sobre a conversão de **Almas** em bônus permanentes que sobrevivem às mortes.
- Chave `blacksmith_intro`: Apresentação do **Ferreiro Espiritual** detalhando o aprimoramento `+1/+2/+3` com **Almas** e a forja Lendária via **Essência de General**.
- Chave `portal_enter`: Chamado do **Portal da Fenda** convidando o Espectro para iniciar uma nova incursão.
- Chave `boss_essence_drop`: Alerta de conquista ao obter **Essência de General** do **Carcereiro Infernal**, conectando a vitória à forja do Refúgio.
