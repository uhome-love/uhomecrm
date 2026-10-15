# Minha rotina: tirar "Sua fila de hoje" e deixar só os atalhos na lateral

## O que muda
- Sai o quadro "Sua fila de hoje" da coluna da direita.
- Na direita ficam só os **Atalhos**: Oferta Ativa em destaque, Meus clientes, Tarefas e Agenda.
- O resto da tela continua igual.

## Ideia extra (só entra se você aprovar)
- Colocar no topo dos atalhos um mini quadro **"Próxima visita"**, com horário, nome do cliente e empreendimento, e um botão que abre o cliente. A visita é o que mais pesa na regra das 2 visitas. Se não houver visita hoje, aparece "Sem visita hoje · Marcar visita", que leva ao Pipeline.
- Assim a lateral fica com 2 blocos curtos (Próxima visita + Atalhos), sem repetir tarefas nem clientes.

## Validação
- Ver a tela no preview em computador e celular, sem alterar dados.

## Detalhes técnicos
- `CorretorDashboard`: remover `<AgendaResumoWidget />` da lateral, mantendo `<AtalhosRotina />`.
- Ideia extra: novo `ProximaVisitaCard` (abaixo de 120 linhas), que lê as visitas de hoje do corretor com status marcada (BRT) e só lê, sem gravar nada.
