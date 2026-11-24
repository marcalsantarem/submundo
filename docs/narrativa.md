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

---

## 8. Ato 0 — Prólogo: Vila Natal, Queda e Pacto Celestial (M4)

### 8.1. Arco do Prólogo (Mundo dos Vivos)
1. **A Vila Natal Viva:** O herói inicia como um **Jovem Guerreiro** mortal (`hero_living`) sob tutela do **Mestre de Armas** e com apoio do **Ferreiro da Vila** (forja comum de ferro).
2. **As 3 Masmorras Iniciais:**
   - **1. A Gruta da Cachoeira (`stage_grotto`):** Primeiro teste em combate real contra limos e **Morcegos da Gruta**; o enxofre na água anuncia algo errado.
   - **2. A Mina Abandonada (`stage_mine`):** Expurgo noturno de esqueletos reanimados e descoberta de runas profanas nas galerias inferiores.
   - **3. O Selo Antigo (`stage_seal`):** A porta ancestral no fundo da mina é rompida, liberando a vanguarda demoníaca.
3. **A Queda e o Pacto Celestial:** A horda comandada pelo **Arauto do Abismo** incendeia a **Vila Natal**. Ao tombar defendendo o vilarejo, o guerreiro tem a alma marcada pelo **Emissário Celestial** com o **Selo Celestial**, despertando como **Guerreiro Espectral** (`hero_wraith`) no **Refúgio no Submundo** para iniciar o **Ato 1** (`act1_briefing`).

### 8.2. Glossário do Prólogo e Novos Termos
| ID / Chave | Nome Oficial (pt-BR) | Categoria / Papel |
| :--- | :--- | :--- |
| `hero_living` | **Jovem Guerreiro** | Forma mortal do protagonista durante o treinamento e as incursões na Vila Natal. |
| `weapon_master` | **Mestre de Armas** | Mentor marcial da Vila Natal que guia o guerreiro pela Gruta, Mina e ruptura do Selo. |
| `village_blacksmith` | **Gorran** (Ferreiro da Vila) | Artesão mortal da Vila Natal que tempera aço comum; nome canônico definido no M9 (Decisão #23). |
| `village_healer` | **Lyra** (Curandeira da Vila) | Curandeira e vendedora de poções da Vila Natal; nome canônico definido no M9 (Decisão #23). |
| `cave_bat` | **Morcego da Gruta** | Criatura veloz das cavernas que infesta *A Gruta da Cachoeira* ao lado dos limos. |
| `ancient_seal` | **Selo Antigo** | Porta ancestral sob a Mina Abandonada cuja ruptura desencadeia a invasão demoníaca. |
| `abyss_herald` | **Arauto do Abismo** | Comandante infernal que emerge do Selo Antigo, incendeia a Vila Natal e abate o guerreiro vivo. |

### 8.3. Diretrizes de Diálogos do Prólogo e Abertura do Ato 1 (M4)
- `prologue_welcome` / `prologue_blacksmith`: Clima de vila viva e preparação simples antes da tragédia.
- `stage_grotto_intro` / `stage_grotto_victory`: Batismo de fogo na Cachoeira e primeiro indício de enxofre.
- `stage_mine_intro` / `stage_mine_victory`: Escalada de tensão com mortos-vivos e runas sob a terra.
- `stage_seal_intro` / `village_fall_boss`: Rompimento do **Selo Antigo** e ataque implacável do **Arauto do Abismo**.
- `village_fall_pact` / `act1_briefing`: Morte heroica, imposição do **Selo Celestial** e transição direta ao **Refúgio no Submundo** para caçar os Generais do Inferno.

---

## 9. Monstros Iniciais (M6)

| ID Oficial | Nome Canônico (pt-BR) | Aparência | Estilo de Combate | Lore Curta |
| :--- | :--- | :--- | :--- | :--- |
| `slime` | **Slime** | Gosma verde gelatinosa e translúcida. | Corpo-a-corpo lento; inimigo básico. | Massa ácida que escorre pelas fendas úmidas das grutas, devorando restos orgânicos. |
| `cave_bat` | **Morcego** | Morcego de pelagem roxa/azulada e asas membranosas. | Corpo-a-corpo rápido e frágil. | Predador noturno das cavernas que ataca em rasantes rápidos quem perturba a escuridão. |
| `wolf` | **Lobo** | Lobo cinzento de olhos atentos e presas afiadas. | Corpo-a-corpo ágil; mais rápido e resistente que o Slime. | Fera selvagem das matas e túneis do mundo real, levada à fúria pela corrupção crescente. |
| `skeleton` | **Esqueleto** | Humanoide esquelético armado com espada e escudo. | Corpo-a-corpo padrão; levemente resistente. | Restos de antigos vigias reanimados por runas profanas para guardar galerias esquecidas. |
| `skeleton_archer` | **Esqueleto Arqueiro** | Humanoide esquelético portando arco de madeira. | Ataque à distância; frágil em combate próximo. | Atirador descarnado que mantém distância e dispara flechas silenciosas da penumbra. |
| `wolf_alpha` | **Chefe da Matilha** (`boss`) | Lobo alfa de grande porte, pelagem marrom/vermelha. | Mini-boss agressivo corpo-a-corpo; lidera a matilha na mina. | Fera dominante que tomou as galerias da mina da cidade (Missão 2), guiada pelo cheiro de sangue e enxofre. |
| `karnak` | **Karnak** (`boss`) | Demônio escuro e vermelho empunhando um machado duplo. | Boss invencível (Missão 3); golpes pesados e implacáveis. | Vanguarda infernal que emerge no fundo da mina (Missão 3) e retorna como miniboss/boss no Ato 1. |
| `skeleton_chief` | **Esqueleto Chefe** (`boss`) | Guerreiro esquelético veterano de elmo de ferro, escudo e espada dentada. | Boss melee resistente e agressivo; comanda os mortos-vivos. | Antigo capitão da guarda reanimado pelas runas profanas, liderando os esqueletos nas galerias. |

---

## 10. Vila Natal como Hub do Prólogo (M9 — Decisão #23)

### 10.1. NPCs da Vila
| ID Oficial | Nome Canônico (pt-BR) | Papel na Vila |
| :--- | :--- | :--- |
| `weapon_master` | **Mestre de Armas** | Aponta a próxima missão (marcador "!") e libera o portão depois da conversa. |
| `village_healer` | **Lyra** | Curandeira e vendedora de poções na casa de palha ao fundo; no M9 só tem falas (sem loja). |
| `village_blacksmith` | **Gorran** | Ferreiro da bigorna à direita; no M9 só tem falas (sem forja funcional). |

### 10.2. Diretrizes de Diálogos da Vila (provisórias — definitivas no M10)
- `village_master_mission_grotto` / `village_master_mission_mine` / `village_master_mission_seal`: o Mestre aponta a missão atual e manda sair pelo portão.
- `village_master_idle`: fala do Mestre depois que a missão já foi dada.
- `village_lyra_idle` / `village_lyra_idle_2`: duas variações de fala de Lyra.
- `village_gorran_idle` / `village_gorran_idle_2`: duas variações de fala de Gorran.
- `village_gate_locked`: aviso do portão trancado ("fale com o Mestre antes de sair").

---

## 11. Novo Prólogo — As 3 Missões da Vila Natal (M10 — Decisões #13 e #24)

> Substitui o arco das masmorras iniciais da seção 8.1. **Fora do prólogo:** A Gruta da Cachoeira (`stage_grotto`), O Selo Antigo (`stage_seal`), a queda da vila em chamas e o Arauto do Abismo (`village_fall_boss`). Os biomas ficam para as dungeons repetíveis (M12); as chaves antigas permanecem em `dialogues.json`, sem uso no prólogo.

### 11.1. Arco
1. **Os Pedidos da Vila:** o Mestre de Armas abre o prólogo dizendo que os moradores precisam de ajuda (`quest_master_intro`); enquanto os dois pedidos não forem entregues, repete `quest_master_wait`.
2. **Missão 1 — A Plantação de Ervas (Lyra):** colher ervas medicinais para os frascos de Lyra; Slimes nos canteiros, sem boss.
3. **Missão 2 — A Mina Iluminada (Gorran):** recuperar martelo, tenaz e cinzel de Gorran; lobos e o **Chefe da Matilha**. No fim, o herói vê **o algo estranho**: um **brilho vermelho pulsando entre as rochas** do fundo da mina, com a pedra **quente como brasa** (presença do Karnak, sem revelá-lo).
4. **Missão 3 — O Fundo da Mina (Mestre):** após as duas entregas, o herói conta o que viu e quer explorar; o Mestre consente, preocupado. No fundo, o **Karnak** surge e o herói morre (luta invencível).
5. **Fim do Prólogo:** sem cena de destruição; tela sóbria "Fim do Prólogo" e transição para o Ato 1 atual.

As falas acontecem só antes e depois das dungeons (o Mestre não acompanha). As missões 1 e 2 podem ser feitas em qualquer ordem.

### 11.2. Chaves de Diálogo (`src/data/dialogues.json`)
- **Mestre:** `quest_master_intro`, `quest_master_wait`, `quest_master_depths_offer`, `quest_master_depths_progress`.
- **Lyra / Gorran:** `quest_<npc>_offer` (pedido/aceitar), `quest_<npc>_progress` (em andamento), `quest_<npc>_turnin` (entrega), `quest_<npc>_done` (depois de entregue).
- **Dungeons (falas do herói):** `mission_herbs_enter`, `mission_herbs_complete`, `mission_mine_enter`, `mission_mine_complete`, `mission_mine_strange`, `mission_depths_enter`.
- **Karnak:** `mission_depths_karnak` (o Karnak surge na sala 5; `portraitId` `karnak`).
- **Fim:** `prologue_end_title` e `prologue_end_text` (`speaker` Sistema).

### 11.3. Termos Novos
| Termo | Uso |
| :--- | :--- |
| **Plantação de Ervas** | Local da Missão 1 (pedido de Lyra). |
| **Mina Iluminada** | Local da Missão 2 (pedido de Gorran); substitui a "Mina Abandonada" no prólogo. |
| **Fundo da Mina** | Local da Missão 3 (Mestre); onde o Karnak surge. |
| **Fim do Prólogo** | Tela de encerramento após a morte para o Karnak. |
