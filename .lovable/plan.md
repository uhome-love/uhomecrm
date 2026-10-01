# Lead reengajado começa com a história limpa para o corretor

## O que muda
- Quando um lead volta pelo reengajamento ("Sim" no disparo), o **corretor** passa a ver na História só o que aconteceu a partir dali: a mensagem do disparo, a resposta "Sim" e tudo que vier depois.
- Anotações, tarefas, descartes, mudanças de etapa e corretores antigos **ficam escondidos para o corretor**, mas não são apagados.
- **Gestor, diretoria e CEO** continuam vendo tudo, com um botão "Mostrar histórico anterior ao reengajamento".
- Vale para todos os novos "Sim" e também para os cerca de 40 leads que responderam "Sim" hoje.
- Nada muda em corretor, etapa, Fila do CEO, roleta ou relatórios.

## Validação
- Abrir um lead de hoje (ex.: Rafaela) no preview como corretor: aparece só a mensagem do disparo, o "Sim" e o que veio depois.
- Abrir o mesmo lead como gestor: o botão mostra o histórico antigo.
- Conferir que outras telas do lead e os relatórios continuam iguais.

## Detalhes técnicos
- Marco de corte: `pipeline_leads.reativado_em` (já existe). O webhook (`whatsapp-webhook` / `_shared/reactivateLead.ts`) passa a gravar `reativado_em = momento da resposta` em todo "Sim", inclusive lead que segue com o corretor atual. Antes da implementação, conferir se o campo já é preenchido hoje nesses dois caminhos.
- Backfill via run_sql: `reativado_em` = hora do "Sim" para os leads de hoje (a partir de `reengajamento_meta_disparos`), só onde estiver vazio ou mais antigo.
- Filtro só na exibição (sem apagar dados, sem migration): nas leituras da História do lead para perfil corretor — `usePipelineLeadData.ts`, `focus/useTimelineEvents.ts` (atividades, tarefas concluídas, histórico de etapa, "lead criado") e o card de hover — esconder itens com `created_at < reativado_em`. Tarefas pendentes antigas continuam visíveis para não perder pendências (confirmar no build se o Lucas quer escondê-las).
- Gestor/diretor/admin: toggle local na História para exibir os itens anteriores.
- Relatórios, HOMI e métricas não usam o filtro.
