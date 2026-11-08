# Plano: "Volta pra Roleta" — Oferta Ativa na cara do corretor (Campanha Natal)

## Objetivo
O corretor que ficou fora da Roleta precisa ver no painel, logo ao entrar, **o caminho para voltar**: ligar para leads estagnados, descartados e das listas, com a ligação já pronta na tela, e ver seu resultado e o ranking subirem.

## O que já existe (vamos reaproveitar, sem duplicar)
- Oferta Ativa com discador, roteiro de ligação (ScriptPanel), ajuda com objeções (HOMI), Bolsão, listas e pontuação do Mutirão (tentativa 0 / aproveitado 5 / visita 30).
- Painel "Ao Vivo", ranking e "Meus resultados".
- Cartão da Roleta e Missão Natal no painel do corretor.

O plano junta tudo isso num caminho simples, sem mudar nenhuma regra da Roleta ou da distribuição.

## O que o corretor vai ver

### 1. Cartão "Volte pra Roleta" no topo do painel (só para quem está fora)
- Mensagem direta: "Você está fora da Roleta esta semana. Faltam X visitas realizadas."
- Caminho em 3 passos: **Ligar → Agendar visita → Realizar visita**, com o progresso de cada passo.
- Botão grande: **"Começar a ligar agora"**, que abre direto o próximo cliente.
- Quem já está na Roleta vê a versão leve: "Bata sua meta extra de ligações hoje".

### 2. Modo Ligação "um cliente por vez"
Tela única e limpa, com:
- Nome do cliente, **telefone com botão Ligar e WhatsApp**, empreendimento de interesse, origem (estagnado, descartado, lista) e há quanto tempo foi o último contato.
- **Roteiro de ligação na tela**, escolhido pelo empreendimento e pela origem (ex.: descartado volta com abordagem diferente de estagnado), com respostas prontas para objeções.
- Ao terminar, 4 botões grandes: **Não atendeu / Sem interesse / Interessado / Visita marcada**. Visita marcada abre o agendamento dentro do mesmo fluxo.
- Passa sozinho para o próximo cliente. Sem procurar lista.
- Ordem sugerida pelo sistema: primeiro quem tem mais chance (interesse recente, produto do Natal).

### 3. Contador e estímulo
- Placar do dia no topo da tela de ligação: ligações, atendidas, aproveitados, visitas marcadas, pontos.
- Metas do dia em barra de progresso (ex.: 30 ligações, 3 aproveitados, 1 visita).
- Pequena comemoração ao bater cada marco e ao marcar visita.
- Sequência de dias ligando ("3 dias seguidos").

### 4. Ranking "Mutirão de Natal"
- Ranking do dia e da semana: quem mais ligou, aproveitou e marcou visita (mesma pontuação já usada no Mutirão).
- Visível no painel do corretor e no "Ao Vivo"; destaque para quem subiu de posição.
- Gerentes veem o ranking da sua equipe no painel deles (aba existente, sem redesenho).

### 5. Mobile
- Mesmo fluxo pensado para celular: botão Ligar grande, roteiro rolável, resultado com um toque.

## O que NÃO muda
- Regras de credenciamento (2 visitas realizadas), distribuição, Fila CEO e Bolsão continuam iguais.
- Opt-out global e higiene da Oferta Ativa continuam bloqueando contatos proibidos.
- Pontuação do Mutirão continua a mesma.

## Fases (uma por vez, validando cada uma com você)
0. **Mockup** do cartão "Volte pra Roleta", do Modo Ligação e do ranking (desktop e celular) para sua aprovação. Nada de código.
1. Cartão "Volte pra Roleta" no painel do corretor.
2. Modo Ligação um cliente por vez, com roteiro e resultado em botões.
3. Placar, metas do dia e comemorações.
4. Ranking Mutirão de Natal no painel e no Ao Vivo.
5. Teste completo no preview com lead de teste (sempre cancelando), desktop e celular.

## Pontos para você decidir no mockup
- Metas do dia (sugestão: 30 ligações, 3 aproveitados, 1 visita).
- Se haverá prêmio para o ranking da semana (hoje o prêmio de Natal é só por visitas realizadas).
- Textos dos roteiros por empreendimento: usamos os já cadastrados em Materiais ou você quer revisar.

## Detalhes técnicos
- Status de fora/dentro e visitas faltantes vêm da fonte única já existente (`roleta_apto_janela` / `useRoletaPerformanceStatus` e `roleta_visitas_realizadas_periodo`); nenhuma regra nova no servidor.
- Fila de clientes reaproveita as fontes atuais da Oferta Ativa (estagnados via Bolsão `bolsao_puxar`, descartados, listas) com reserva atômica existente; registro de tentativa pelo fluxo atual (AttemptModal/pontuação).
- Roteiro reaproveita ScriptPanel/templates e HomiObjectionHelper.
- Ranking reaproveita RankingOfertaAtiva/PerformanceLivePanel; se precisar de agregado novo, será um RPC só de leitura.
- Componentes novos pequenos (<300 linhas), tokens do DS v4, tema Natal mantido. Sem migration prevista; se surgir, respeitar limite de 2/dia.
