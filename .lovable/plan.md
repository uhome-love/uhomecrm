# Auditoria do cartão "Novos agendamentos" (Agenda de Visitas)

## O que a auditoria encontrou (hoje, 14/11)
O número 15 está certo pela regra atual: conta toda visita **cadastrada hoje** no CRM, seja qual for a data dela.

Das 15:
- **6 ainda vão acontecer:** 1 hoje às 16h e 5 em outros dias (15/11, 17/11, 20/11, 21/11, além de 1 hoje às 15h que ainda não teve resultado).
- **9 foram marcadas e feitas no mesmo dia.** O corretor cadastrou e o cliente visitou poucas horas depois.
- **2 delas foram cadastradas depois de já terem acontecido.** Uma foi lançada às 11h05 para uma visita das 9h, e a outra às 17h53 para uma visita das 14h01. São só um registro do que já tinha acontecido, não um agendamento.
- **1 no show.**

Ou seja, o cartão mistura agendamento de verdade com registro de visita do mesmo dia. Por isso parece que "a maioria já foi realizada".

## Proposta (só a forma de mostrar, sem mudar as regras de visitas)
O cartão continua mostrando o total de cadastros do período, com uma linha de detalhe embaixo:
- **Para os próximos dias:** visitas cadastradas no período para depois do dia em que foram cadastradas.
- **Para o mesmo dia:** visitas marcadas e feitas no mesmo dia.
- **Lançadas depois:** visitas cadastradas depois do horário em que aconteceram.

Ao tocar no cartão, a lista que já existe mostra um selo com o tipo em cada visita.
O cartão vale igual no computador e no celular.

## Outro ponto que apareceu (sem mudar nada)
Hoje há **26 no shows** entre as 51 visitas do dia, um número bem alto. Vale conferir em outra etapa se são reais ou se foram marcadas assim automaticamente.

## Detalhes técnicos
- A RPC `get_visitas_kpis` ganha 3 campos novos (`agendadas_futuro`, `agendadas_mesmo_dia`, `agendadas_retroativas`), comparando `created_at` (BRT) com `data_visita` + `hora_visita`. Os campos de hoje continuam iguais. A mudança vai numa migration só, fora do horário de pico.
- `MobileVisitas` e `DesktopVisitas` mostram a linha de detalhe. `VisitasPorEquipeList` mostra o selo.
- Um teste SQL confere as 3 classificações.
- Antes de construir, apresento um desenho da tela para aprovação.
