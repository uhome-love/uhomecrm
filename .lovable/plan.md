# Tarefa futura protege da estagnação + teto de 30 dias

## Entendimento confirmado
- Tarefa pendente com data futura = ação planejada → o lead **não estagna** enquanto ela existir e não vencer.
- Quando a tarefa é concluída (ou vence sem conclusão), o relógio de inatividade passa a contar a partir desse momento. Sem nova tarefa/ação dentro do limite de dias, o lead estagna.
- Corretor poderá agendar tarefa no máximo **30 dias** à frente (impede "burlar" a estagnação jogando tarefa para meses depois).

## Problema atual (auditado)
- `_pipeline_ultima_acao_humana` só conta tarefas **concluídas**; ignora tarefas **pendentes futuras**. Resultado: lead com tarefa agendada estagna do mesmo jeito.
- 1 estagnado e vários "em aviso" possuem tarefa futura pendente; há 65 tarefas marcadas para >30 dias (máx. 261 dias).

## Mudanças

### 1. Estagnação passa a respeitar tarefa pendente futura (migration)
Criar helper `public._pipeline_tem_tarefa_pendente_futura(lead_id)`:
- retorna `true` se existe tarefa em `pipeline_tarefas` com `concluida_em IS NULL`, `status <> 'concluida'` e `vence_em >= CURRENT_DATE`.

Aplicar esse guard em:
- **`processar_estagnacao_pipeline`**:
  - Não marcar aviso para candidatos que tenham tarefa pendente futura.
  - Resetar (`estagnado_aviso_em=NULL`, `estagnado_prazo_em=NULL`) leads em aviso que tenham tarefa pendente futura.
  - Resetar (`estagnado=false`, limpa campos) leads já estagnados que tenham tarefa pendente futura.
- **`get_pipeline_estagnacao`**: excluir da lista da Central os leads com tarefa pendente futura (consistência com o motor).

> Observação: tarefa **vencida e não concluída** (data no passado) NÃO protege — atraso na própria tarefa é sinal de inação.

### 2. Teto de 30 dias para agendamento de tarefas

**a) Defesa central — trigger no banco (migration):**
Trigger `BEFORE INSERT OR UPDATE` em `pipeline_tarefas` que rejeita `vence_em > CURRENT_DATE + 30` (apenas para tarefas não concluídas), com mensagem clara: "Tarefas podem ser agendadas para no máximo 30 dias à frente." Garante a regra independentemente de qual tela criou a tarefa.

**b) Frontend — limitar os seletores de data** (max = hoje + 30 dias) nos pontos onde o corretor escolhe a data da tarefa:
- `src/components/pipeline/LeadTarefasTab.tsx`
- `src/components/pipeline/NextActionModal.tsx`
- `src/components/pipeline/CardQuickTaskPopover.tsx`
- `src/pages/MinhasTarefas.tsx`
- `src/hooks/usePipelineLeadData.ts` (validação no submit)

Inputs `type="date"` ganham atributo `max`; onde houver agendamento por "X dias depois", limitar a 30.

### 3. Correção dos dados existentes (auditoria + fix)
Numa migration/insert de saneamento:
- **Tirar da estagnação** os leads (estagnado ou em aviso) que possuem tarefa pendente futura — limpar `estagnado`, `estagnado_em`, `estagnado_aviso_em`, `estagnado_prazo_em`. (Ex.: Júlia Veiga, Ana Tormen e demais listados.)
- **Reescalonar para 30 dias** as 65 tarefas pendentes com `vence_em > hoje+30` → setar `vence_em = CURRENT_DATE + 30` (não apagar, apenas ajustar para dentro da nova regra).

## Validação após aplicar
- Reexecutar a auditoria: `estagnados_com_tarefa_futura` deve ser 0.
- Conferir que nenhuma tarefa pendente fica com `vence_em > hoje+30`.
- Testar criar tarefa para 60 dias na UI → bloqueado pelo seletor e, se contornado, pelo trigger.
- Rodar `processar_estagnacao_pipeline` e confirmar que leads com tarefa futura não voltam a estagnar.

## Fora de escopo
- Não muda dias-limite por etapa nem o fluxo de arquivamento já existente.
- Não altera RLS, buckets ou edge functions.
