# Não notificar o corretor antigo quando o lead sai dele

## Problema confirmado

O gatilho de banco `notify_lead_distribuido` dispara duas notificações quando o lead troca de corretor:

1. Para o corretor NOVO: "Novo lead recebido!" (correto)
2. Para o corretor ANTIGO: "Lead redistribuído — foi redistribuído por falta de atendimento" (indesejado)

Confirmado nos dados: hoje (31/07) foram criadas 6 notificações desse tipo, incluindo "Lead Natália Lima foi redistribuído por falta de atendimento" às 13:51 para o William. Ou seja, quando alguém aproveita no Mutirão de Oferta Ativa um lead que o corretor antigo havia descartado, o antigo é avisado — o que gera atrito.

## Correção

1. Remover do gatilho o bloco que notifica `OLD.corretor_id`. O corretor antigo deixa de receber qualquer aviso de redistribuição/aproveitamento — vale para todos os caminhos (mutirão, fila do CEO, estagnação, timeout).
2. Manter intacta a notificação para o corretor NOVO (com dedup de 5 min) e o restante do gatilho (venda assinada).
3. Limpar as notificações "Lead redistribuído" já criadas hoje, para o William e os demais corretores não verem o aviso antigo.

## Detalhe técnico

- Migration única: `CREATE OR REPLACE FUNCTION public.notify_lead_distribuido()` sem o `criar_notificacao(OLD.corretor_id, ..., 'lead_redistribuido', ...)`; o resto do corpo permanece igual (apenas DDL).
- Limpeza: `DELETE FROM notifications WHERE categoria = 'lead_redistribuido'` (registros de hoje/pendentes).
- Sem mudanças de frontend nesse ponto; a categoria `lead_redistribuido` deixa de existir na prática.

## Correção adicional (erro em tela)

O Dashboard CEO está quebrando com `ReferenceError: agendaVisitas is not defined` — a variável é retornada pelo hook `useCeoDashboard`, mas a página está lendo antes de o hook resolver o objeto no escopo do componente. Ajustar o `CeoDashboard.tsx` para consumir `agendaVisitas` a partir do mesmo destructuring do hook, restaurando o card "Agenda de Visitas".

## Validação

- Simular troca de corretor num lead de teste e confirmar: apenas o corretor novo recebe notificação.
- Conferir na Central de Notificações do William que o aviso da Natália Lima sumiu.
- Abrir o Dashboard CEO no preview sem erro de runtime.
