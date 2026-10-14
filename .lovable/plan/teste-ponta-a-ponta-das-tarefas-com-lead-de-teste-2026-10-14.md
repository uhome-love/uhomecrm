# Teste ponta a ponta das Tarefas com lead de teste

Objetivo: usar o fluxo de tarefas do começo ao fim com um cliente fictício e, no final, apagar tudo o que o teste criou. Nenhum lead real é tocado.

## Passos
1. **Criar lead de teste** "TESTE TAREFAS - apagar" (telefone fictício 5551900000000), na sua conta, etapa Qualificação. Ele não passa pela roleta e não manda aviso para ninguém.
2. **Criar tarefa pelo card do Pipeline** (menu ⋯ "Criar tarefa"): conferir o nome "Nova tarefa / Tarefa criada".
3. **Página Tarefas**: a tarefa aparece em "Hoje" ou "Próximas"; a busca encontra o cliente; "Abrir lead" abre a ficha por cima, sem sair da página.
4. **Ficha do lead**: aba "Tarefas" e "Próxima ação" mostram a tarefa com o nome novo.
5. **Concluir na página Tarefas**: tentar salvar sem observação (precisa bloquear); depois salvar com resultado + observação de 10 letras ou mais e agendar a próxima tarefa.
6. **Conferir o resultado**: atividade no histórico do lead com a observação, "última ação" atualizada, tarefa em "Concluídas" e a próxima tarefa criada.
7. **Concluir pelo card (⚡)** a segunda tarefa, sem criar próxima: conferir que também pede observação.
8. **Criar anotação pessoal** (sem cliente) pela "+ Nova tarefa" e concluir.
9. **Limpeza**: apagar tarefas, atividades, histórico, avisos e o lead de teste; confirmar que não sobrou nada.

Cada passo com print. No final, te mando o que funcionou e o que falhou (se algo falhar, eu te mostro antes de corrigir).

## Detalhes técnicos
- Teste via Playwright com sessão da sua conta; lead criado com `corretor_id` = você, sem passar por `distribuir_lead_*`.
- Limpeza por `pipeline_lead_id` em `pipeline_tarefas`, `pipeline_atividades`, `pipeline_historico`, `pipeline_anotacoes`, `notifications`, e por fim `pipeline_leads`; a anotação pessoal pelo id. Sem migration.
- Verificação final com consulta confirmando 0 registros do lead de teste.
