# Fluxo de visita: "Confirmar visita" virando "Realizada" antes da hora

## O que está acontecendo (confirmado no código e no banco)

1. **O modal ignora qual card foi clicado.** Em `TaskCompletionDialog.tsx`, quando o lead está na etapa Visita, o modal busca "a tarefa `visita_auto` pendente mais recente" (`order created_at desc, limit 1`) em vez de usar a tarefa que o corretor clicou. Como o card "Registrar resultado" é criado depois do "Confirmar visita", ele é sempre o mais recente — então qualquer clique abre a tela **"Registrar resultado da visita — Aconteceu / Faltou"**, exatamente como no print.
2. **"Confirmar visita" não confirma nada.** `VisitaCompletionFlow.handleConfirmarVisita` só conclui a tarefa; nunca grava `visitas.status = 'confirmada'` nem `confirmed_at`. A visita segue "marcada".
3. **Não existe trava de data.** O botão "Aconteceu / Faltou" fica disponível mesmo com a visita marcada para o dia seguinte, e nada no banco impede `realizada`/`no_show` numa visita futura.

Resultado: no follow-up de D-1 o corretor acha que está confirmando e acaba marcando a visita como realizada/no-show — e o lead pula para Pós-Visita.

### Visitas afetadas hoje (data futura já com resultado)

| Cliente | Data | Status errado | Etapa do lead |
|---|---|---|---|
| Thiaguinho | 01/08 | realizada | Pós-Visita |
| Carla Curzio | 01/08 | no_show | Visita |
| Gabriela Borges \| Psicóloga | 01/08 | no_show | Visita |
| Iara Suzana Ribeiro da Silva | 02/08 | realizada | Visita |
| Marcelo Amazonas | 01/08 | no_show | Visita |

Nenhuma delas gerou negócio. Não encontrei visita de "Rafaela" nem por nome do cliente nem por nome do lead — provavelmente é uma das acima com outro nome no cadastro; confirmo com o corretor na validação.

## Correções

### 1. Modal abre o card certo (frontend)
- `TaskCompletionDialog` passa a receber o `tarefaId`/`subtipo` da tarefa clicada e usa esse subtipo. A busca "pendente mais recente" fica só como fallback quando a abertura não vem de um card específico.

### 2. "Confirmar visita" confirma de verdade (frontend + banco)
- Botão "Cliente confirmou" grava `visitas.status = 'confirmada'` + `confirmed_at`, conclui a tarefa e cria o card "Registrar resultado" **com vencimento no dia da visita**.
- Botão secundário "Não conseguiu contato" apenas conclui a tarefa e reagenda o toque, sem mexer no status da visita.

### 3. Trava de data para registrar resultado
- **UI**: se a visita ainda não chegou (data futura), a tela de "Registrar resultado" mostra os botões desabilitados com o aviso "A visita é dia DD/MM — o resultado só pode ser registrado a partir dessa data" e oferece "Reagendar" / "Cancelar visita".
- **Banco**: trigger `BEFORE UPDATE` em `visitas` bloqueia `realizada`/`no_show` quando `data_visita > hoje (BRT)`, com mensagem clara. Isso protege qualquer outro caminho (agenda, mobile, API).
- Card "Registrar resultado" deixa de aparecer nas listas de "hoje" enquanto `vence_em` for futuro.

### 4. Limpeza dos dados errados
Migração de dados (só as 5 visitas da tabela acima):
- `no_show`/`realizada` → volta para `confirmada` (a visita segue de pé para 01–02/08);
- cancela as tarefas geradas por engano (`pegar_feedback`, `reagendar_visita`) e recria o card "Registrar resultado" com vencimento na data da visita;
- devolve Thiaguinho de Pós-Visita para Visita;
- registra a correção na timeline do lead.

## Detalhes técnicos
- Arquivos: `src/components/pipeline/task-completion/TaskCompletionDialog.tsx`, `VisitaCompletionFlow.tsx`, e o(s) ponto(s) que abrem o modal a partir do card (`LeadTarefasTab.tsx`, `CardMinimal`/hover).
- Banco: novo trigger de guarda em `visitas`; ajuste em `trg_visita_status_pipeline`/gerador de tarefas para o ramo `confirmada` usar `vence_em = data_visita`; migração de dados separada (DML) para as 5 visitas.
- Regra de contagem de visitas (1 por cliente/dia, `visitas_unicas`) permanece intacta; a correção reduz falsos "realizada".

## Validação
1. Lead de teste: agendar visita para amanhã → concluir "Confirmar visita" → conferir status `confirmada` e que o card seguinte vence só amanhã.
2. Abrir o card "Registrar resultado" hoje → botões travados com o aviso.
3. No dia da visita → registrar "Aconteceu" e conferir Pós-Visita + feedback.
4. Conferir no banco que as 5 visitas voltaram a `confirmada` e que Thiaguinho está na etapa Visita.
