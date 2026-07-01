## Diagnóstico encontrado

A regra hoje ainda não está 100% alinhada com o que você quer.

O banco mostra **223 leads ativos em Sem Contato** com cadência. Na conferência preliminar:

- **126 leads** têm tentativa exibida diferente da contagem real de tarefas concluídas desde o início da cadência.
- **125 leads** têm tentativa diferente do histórico de “Tentativa concluída”.
- O avanço da tentativa hoje acontece pelo gatilho em `pipeline_atividades`, ou seja: quando uma atividade é registrada. Isso inclui a atividade criada ao concluir tarefa, mas também pode incluir registros que não deveriam contar como tentativa independente.
- O gatilho antigo de “avançar ao criar tarefa” **não está ativo hoje**, então a causa atual é principalmente: tentativa avançando por atividade, sem validar que existe uma tarefa concluída correspondente.

## Padrão definitivo que será aplicado

A regra passa a ser:

```text
Tentativa N = N tarefas criadas e concluídas na etapa Sem Contato.

Criar tarefa sozinha não conta.
Registrar atividade solta não conta.
Concluir tarefa conta 1 tentativa.
Ao concluir a tentativa, o histórico mostra:
“Cadência Sem Contato — Tentativa N concluída: ...”
```

## Plano de execução

### 1. Auditoria completa lead por lead

Vou gerar uma auditoria de todos os leads com cadência Sem Contato, incluindo:

- lead;
- corretor;
- tentativa atual no `lead_cadencia_sem_contato`;
- quantidade real de tarefas concluídas;
- tarefas pendentes;
- histórico de tentativas concluídas;
- status correto esperado;
- divergência encontrada.

Critério canônico:

```text
real_tentativa = min(7, quantidade de tarefas concluídas do lead desde o início da cadência Sem Contato)
```

### 2. Corrigir a regra daqui para frente

Vou aplicar uma migration para trocar a origem do avanço:

- parar de avançar tentativa por simples atividade em `pipeline_atividades`;
- criar/ajustar gatilho em `pipeline_tarefas` para recalcular a tentativa quando uma tarefa muda para `concluida`;
- garantir idempotência: a mesma tarefa não pode inflar tentativa duas vezes;
- se uma tarefa for revertida/deletada, a tentativa volta a refletir a contagem real;
- manter a limpeza de aviso de estagnação quando houver ação humana, mas sem inflar tentativa.

### 3. Corrigir os dados atuais

Vou rodar uma correção de dados para todos os leads afetados:

- atualizar `tentativa_atual` para bater com as tarefas concluídas reais;
- ajustar `status` da cadência conforme a tentativa real:
  - 0 a 6: `ativa`;
  - 7: `aguardando_descarte`, se ainda não estagnou;
  - leads já arquivados/estagnados permanecem concluídos conforme regra atual;
- ajustar `proxima_em` para não mostrar prazo falso quando não houver tarefa pendente válida;
- remover/neutralizar histórico automático inflado que não corresponde a tarefa concluída real;
- criar histórico faltante para tentativas que têm tarefa concluída real, mas não têm registro correto.

Não vou apagar tarefas nem atividades humanas. A limpeza será apenas nos registros automáticos de cadência que estão errados.

### 4. Ajustar a tela para reforçar a regra

Vou ajustar o fluxo de conclusão de tarefa na etapa Sem Contato para evitar novo erro operacional:

- ao concluir tarefa em Sem Contato, deixar claro que aquilo está concluindo uma tentativa;
- manter a exigência de registrar “o que aconteceu”; 
- orientar/agendar a próxima tarefa quando o lead permanecer em Sem Contato;
- o card de cadência e o board passam a exibir a tentativa recalculada corretamente.

### 5. Validação final ponta a ponta

Depois da correção, vou validar:

- todos os leads em Sem Contato com tentativa exibida = tarefas concluídas reais;
- histórico de cada lead consistente com as tentativas reais;
- nenhum lead com tentativa acima do real;
- nenhum lead ativo sem tarefa pendente quando ainda precisa de próxima tentativa;
- conclusão de tarefa nova avança exatamente 1 tentativa;
- atividade manual solta não avança tentativa;
- widget/card/board refletem o valor corrigido.

### 6. Entrega do feedback

No final vou te passar um resumo simples para o time, com:

- quantos leads foram auditados;
- quantos estavam divergentes;
- o que foi corrigido;
- qual é a regra oficial para os corretores seguirem daqui para frente.