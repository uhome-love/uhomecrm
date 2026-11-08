# Plano ponta a ponta: "Arena de Ligações" — Oferta Ativa no painel do corretor (Natal)

## Objetivo
Quem ficou fora da Roleta (menos de 2 visitas realizadas) precisa enxergar, assim que entra no CRM, **um caminho claro e animador para voltar**: ligar para leads de listas, estagnados e descartados, com tudo pronto na tela, e ver seus pontos, metas e ranking subirem. Sem atrapalhar o que já existe no painel.

## Retrato de hoje (dados reais)
- 7.848 clientes disponíveis para ligar nas listas da Oferta Ativa (31.666 no total). 7 listas liberadas, nenhuma marcada como "ativa".
- Últimos 7 dias: 1.200 tentativas feitas por apenas 17 corretores. Ou seja, a maioria não liga.
- Já existem: discador, roteiro, ajuda com objeções (HOMI), Bolsão (estagnados e descartados), reservados, ranking, painel Ao Vivo e pontuação do Mutirão (tentativa 0 / aproveitado 5 / visita 30).
- O problema não é falta de ferramenta: é tudo espalhado, sem um "próximo passo" óbvio e sem estímulo visível.

## A experiência nova

### 1. No painel do corretor: cartão "Volte pra Roleta" (topo, sem empurrar o resto)
- Quem está fora: "Você está fora da Roleta esta semana. Faltam X visitas." + caminho em 3 passos **Ligar → Marcar visita → Realizar visita**, cada um com seu progresso.
- Quantos clientes estão esperando por ele agora, separados: **Listas · Estagnados · Descartados**.
- Botão grande **"Começar a ligar"** (abre o próximo cliente direto).
- Mini placar do dia e posição no ranking.
- Quem já está na Roleta vê uma versão compacta ("Meta extra de hoje"). Os cartões atuais (Roleta, Missão Natal, Foco, Próxima visita, Evolução) ficam onde estão.

### 2. Arena de Ligações (tela única, um cliente por vez)
Visual moderno, escuro-azul com detalhes de Natal, pensado para "modo jogo":
- **Topo:** placar do dia (ligações, atendidas, aproveitados, visitas, pontos), barra de metas e sequência de dias ligando.
- **Centro, cartão do cliente:** nome, telefone com botões **Ligar** e **WhatsApp**, empreendimento de interesse, de onde vem (lista, estagnado, descartado e motivo), última conversa resumida e há quanto tempo.
- **Lado (ou abaixo no celular): roteiro da ligação** escolhido por origem e empreendimento (descartado tem abertura diferente de estagnado), com respostas para as objeções mais comuns e o botão de ajuda do HOMI.
- **Resultado em 1 toque:** Não atendeu · Número errado · Sem interesse · Interessado · **Visita marcada** (abre o agendamento no mesmo fluxo). Observação curta quando exigido.
- **Próximo cliente automático**, já na ordem de maior chance (interesse recente, produtos do Natal, quem nunca foi ligado).
- Filtro rápido no topo: Tudo · Listas · Estagnados · Descartados · por empreendimento.
- Comemoração ao bater meta, aproveitar ou marcar visita; aviso de "faltam 2 visitas para voltar à Roleta" sempre visível.

### 3. Ranking "Mutirão de Natal"
- Ranking do dia e da semana (mesma pontuação do Mutirão), com pódio, quem subiu de posição e destaque para quem voltou para a Roleta pela Oferta.
- Aparece na Arena, no painel do corretor (resumido) e no Ao Vivo.

### 4. Gestores
- Nas abas que já existem (sem redesenho dos painéis): quem está fora da Roleta, quanto cada um ligou hoje/semana, aproveitados e visitas vindas da Oferta. Ajuda o gerente a cobrar no 1:1.

### 5. Relatórios
- Todas as ligações continuam gravadas no mesmo lugar de hoje, então relatórios, Ao Vivo, Performance, checkpoint e 1:1 seguem iguais e passam a mostrar o volume maior automaticamente.
- Vou mapear e listar cada relatório que lê a Oferta Ativa para garantir que nenhum número mude de regra (só de volume).

## O que NÃO muda
- Regras da Roleta (2 visitas realizadas), distribuição, Fila CEO, Bolsão (prazo e reserva de 1 por vez) e pontuação.
- Saída global (opt-out) e higiene continuam bloqueando quem pediu para não ser contatado.
- Lead ativo no Pipeline continua fora da Oferta Ativa.
- Painel CEO e telas antigas da Oferta Ativa continuam funcionando (a Arena vira a porta principal, sem apagar nada).

## Fases (uma por vez, cada uma validada por você)
0. **Mockups** (desktop e celular): cartão do painel, Arena, ranking, visão do gerente. Nada de código até você aprovar.
1. Mapa completo do código e relatórios da Oferta Ativa (só leitura) + organização dos clientes disponíveis por origem e empreendimento.
2. Cartão "Volte pra Roleta" no painel do corretor.
3. Arena: cartão do cliente, roteiro, resultado em 1 toque e próximo automático.
4. Placar, metas, sequência e comemorações.
5. Ranking Mutirão de Natal + visão do gerente.
6. Teste ponta a ponta no preview com lead de teste (sempre cancelando), desktop e celular, conferindo que relatórios mostram as ligações.

## Para decidir no mockup
- Metas do dia (sugestão: 30 ligações, 3 aproveitados, 1 visita).
- Prêmio para o ranking da semana? (hoje o prêmio de Natal é só por visitas realizadas).
- Roteiros: usar os já cadastrados ou você revisa os textos por empreendimento.
- Quais das 7 listas liberadas entram na Arena.

## Detalhes técnicos
- Fora/dentro da Roleta e visitas faltantes: fonte única existente (`roleta_apto_janela`, `roleta_visitas_realizadas_periodo`, `useRoletaPerformanceStatus`).
- Fila unificada no cliente lendo as fontes atuais (listas/`oferta_ativa_fila`, Bolsão via `bolsao_puxar`/`bolsao_registrar`, reservados), mantendo locks e reserva atômica existentes; tentativas pelo fluxo atual (`oferta_ativa_tentativas`/`oa_events`) para não alterar relatórios.
- Contagens por origem num RPC só de leitura com escopo do próprio corretor (se necessário; 1 migration, fora do limite 2/dia).
- Bloqueios de contato via `contatoPermitido`/`check_send_allowed` antes de exibir o número.
- Roteiro: ScriptPanel/`oferta_ativa_templates` + HomiObjectionHelper. Ranking: RankingOfertaAtiva/PerformanceLivePanel.
- Componentes pequenos (<300 linhas) em pasta própria, tokens DS v4, tema Natal, animações com tokens de movimento e respeito a "reduzir movimento".
