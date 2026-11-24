# Roadmap de Marcos — SUBMUNDO

| Marco | Versão | Nome | Objetivo |
| :--- | :--- | :--- | :--- |
| M1 | v0.1.0 | Fundação e Combate na Masmorra | Setup TS/Vite/Phaser/CI, câmera adaptativa, Pixel Art via código, Guerreiro (ataque auto, Dash, 2 Skills, Poção) e run de 4 salas + 1 Boss |
| M2 | v0.2.0 | Loot, Equipamentos e Sinergias | Drops, inventário de 4 slots, 4 raridades via JSON, afixos e as 3 Forças (Inferno, Submundo, Empíreo) no combate |
| M3 | v0.3.0 | Loop do Hub (Refúgio) e Progressão | HubScene, Almas e Essências, extração vs. morte punitiva, Altar de Almas, Ferreiro e save LocalStorage |
| M4 | v0.4.0 | Narrativa (Prólogo + Ato 1), Arte 2D e Áudio | Diálogos com retratos 2D estilizados, Vila Natal (3 masmorras e transição para o Submundo), 30+ afixos e SFX procedural Web Audio API |
| M5 | v0.5.0 | Personagem | Spritesheets 48x48 em Pixel Art detalhada (`hero_living` no Prólogo e `hero_wraith` no Ato 1), animações fluidas (`idle`, `walk`, `attack`, `dash`, `hit`), flip direcional e arco de corte rúnico |
| M6 | v0.6.0 | Inimigos | Dungeon escura de teste + 5 monstros detalhados padrão Herói (Slime, Morcego, Lobo, Esqueleto, Esqueleto Arqueiro) com animações (`idle`, `walk`, `attack`, `death`) e bosses na sequência |
| M7 | v0.7.0 | UI | Refatoração visual de HUD, modais, barras de vida, ícones 2D de alta qualidade e retratos 2D estilizados alinhados aos mockups de referência |
| M8 | v0.8.0 | Mapas | Cenários 2.5D top-down com paredes/arcos rúnicos, pisos variados, props (tochas animadas, destroços, pilares, baús) e iluminação dinâmica para Vila, Gruta, Mina, Selo e Submundo |
| M9 | v0.9.0 | Novo hub funcional | Hub do prólogo jogável e funcional (escopo a definir na rodada de definições do marco) |
| M10 | — (sem tag) | Missões do prólogo | Criação das missões do prólogo |
| M11 | v0.10.0 | Nova interface (menus) | Reestruturar o jogo sem hubs jogáveis: o hub vira um menu (Masmorras, Inventário, Forja, Personagem, Habilidades, Configurações). Só Masmorras e Inventário habilitados |
| M12 | v0.10.0 | Prólogo reestruturado | Prólogo curto, só de dungeon (pode iniciar direto, fora do menu); o menu-hub já é a visão do Submundo |
| M13 | v0.11.0 | Janela de dungeons | UI e funcionamento da janela de escolha de dungeons |
| M14 | v0.11.0 | Primeira dungeon repetível | Primeira dungeon repetível funcional, com recompensa |
| M15 | v0.12.0 | Sistema de nível | Nível do personagem e ganho de experiência |
| M16 | v0.13.0 | Energia | Energia gasta por masmorra e recuperada por tempo |
| M17 | v0.14.0 | Sistema de dificuldade | Criação do sistema de dificuldade do jogo |
| M18 | v0.14.0 | Recompensas por dificuldade | Recompensas variando por dificuldade |
| M19 | v0.14.0 | Balanceamento | Monstros × nível do personagem × itens |
| M20 | v0.15.0 | Novos sprites dos monstros | Novos sprites para os monstros existentes e novos monstros; animações |
| M21 | v0.15.0 | Novo sprite do personagem | Novo sprite e animações do personagem |
| M22 | v0.16.0 | Dungeon diária | Dungeon diária |
| M23 | v0.17.0 | Mini missões do Ato 1 | Mini missões baseadas em marcos como plano de fundo do Ato 1 |
| M24 | v0.17.0 | Missão da Forja | Missão que libera o ferreiro e a Forja |
| M25 | v0.17.0 | Tela da Forja | Tela da Forja |
| M26 | v0.17.0 | Funcionalidades da Forja | Evoluir, criar novos itens e "extrair a alma" (vender) |
| M27 | v0.18.0 | Janela de personagem | Criar a janela de personagem |
| M28 | v0.18.0 | Status, classe e nome | Exibição de status e classe; possibilidade de alterar o nome |
| M29 | v0.18.0 | Nome do herói | Pedir o nome do herói ao iniciar o jogo |
| M30 | v0.19.0 | Novos mapas | Novos mapas para dungeons; verificar reaproveitamento dos antigos descontinuados |
| M31 | v0.20.0 (a confirmar) | Configurações | Janela de configurações |

**TO-DO (sem marco):** habilidades; classes (definições, gameplay e sprites por classe); dungeon infinita.

> **Regra (Decisão #28):** todo marco gera um PR para merge, mas **nem todo PR gera tag**. A tag (versão) agrupa marcos semelhantes e tem título próprio, definido pelo dono. Títulos: v0.10.0 Reestruturação e prólogo · v0.11.0 Dungeons · v0.12.0 Sistema de nível · v0.13.0 Energia · v0.14.0 Dificuldade · v0.15.0 Atualização gráfica + novos monstros · v0.16.0 Dungeon diária · v0.17.0 Forja · v0.18.0 Janela de personagem · v0.19.0 Novos mapas · Configurações (versão a confirmar, o dono escreveu v0.19.0 duas vezes).
>
> **Regra (Decisão #22):** todo marco começa com uma rodada de conversas e perguntas com o dono sobre as definições dele. As definições acertadas em cada marco prevalecem sobre decisões anteriores que conflitem. Os objetivos acima são só o título do marco; o escopo sai dessa rodada.
