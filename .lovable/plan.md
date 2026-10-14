# Bloqueio de tela: visita vencida sem registro

## O que o corretor vai ver
Quando uma visita dele passou do horário e continua como "Marcada", ao entrar ou usar o CRM aparece uma janela que cobre a tela inteira:

```text
+------------------------------------------------+
|  Visita sem resultado registrado               |
|                                                |
|  helton  -  Monjadim  -  hoje 15:00            |
|  Registre o feedback para continuar usando     |
|  o CRM.                                         |
|                                                |
|  [ Registrar resultado ]   [ Não compareceu ]  |
+------------------------------------------------+
```

- Não tem X e não fecha clicando fora. Só sai registrando o resultado (mesma janela de hoje: Quer proposta, Vai pensar, Reagendar...) ou marcando "Não compareceu".
- Se tiver mais de uma pendente, mostra uma por vez ("1 de 3").
- Sem resultado registrado, a tela fica travada; ele não trabalha os leads novos até registrar.

## Quando conta como vencida
- Visita do próprio corretor, status "Marcada", e já passou **2 horas** do horário marcado (horário de Brasília).
- Só visitas dos últimos 7 dias (evita travar por sujeira antiga).
- Vale só para corretores. CEO, gerentes e gestores não são bloqueados.

## Push no celular
- 2h depois do horário, se ainda estiver "Marcada", o corretor recebe 1 push: "Registre o resultado da visita com helton (15:00)". Toque abre a Agenda de Visitas.
- 1 aviso por visita, sem repetir. Também vai para o sininho.

## O que não muda
Roleta, distribuição, etapas e regras de resultado continuam iguais. O registro usa o mesmo caminho de hoje, então o lead anda de etapa como já anda.

## Como vou validar
Com visita de teste de corretor de teste, horário vencido: conferir o bloqueio aparecendo, registrar e ver liberar, e conferir o push/sino. Depois apagar o teste.

## Detalhes técnicos
- Novo `src/components/visitas/VisitaPendenteBloqueio.tsx` montado em `AppLayout.tsx` só para role corretor; consulta `visitas` (corretor_id = auth uid, status `marcada`, data/hora + 2h < agora BRT, últimos 7 dias), revalida a cada 5 min e ao focar a aba. Reusa `VisitaResultadoDialog` + mesma função de salvar usada em `AgendaVisitas.tsx` (extrair para hook se necessário).
- Nova edge `visita-pendente-lembrete` (cron a cada 30 min, auth por segredo de cron): insere `notifications` tipo `visita_pendente_registro` + chama `send-push`; dedup por visita (`agrupamento_key`). Sem migration de tabela; cron via SQL.
- Registrar regra em `AGENTS.md`.

## Pontos para você confirmar
1. Prazo de 2h depois do horário está bom (ou prefere 1h / fim do dia)?
2. Bloquear totalmente mesmo, ou deixar um "lembrar em 15 min" uma única vez?
