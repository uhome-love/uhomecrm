# Simplificação: remover automação de tarefa em Qualificação e Aquecimento

## Inventário confirmado da automação atual

**Qualificação** — `src/lib/qualificacaoTaskEngine.ts` (motor `advanceQualificacaoStatus`) chamado em:
- `src/components/pipeline/QualificacaoChecklistCard.tsx` (pill click, com Popover + `VisitaDatePicker` para `alinhando_visita`).
- `src/components/pipeline/task-completion/TaskCompletionDialog.tsx` (branch `isQualFlow` no `handleConfirm`, inclui `QualificacaoPillsBlock` e `VisitaDatePicker` variante `confirmar-visita`).

**Aquecimento** — NÃO tem engine dedicada. A criação automática vive **inline** em `src/components/pipeline/PipelineBoard.tsx`, função `handleTransitionConfirm`, **linhas 741–768**: quando `extra.prazoRetomar ∈ {30,60,90}` chega do `PipelineStageTransitionPopup`, insere uma tarefa `origem: "aquecimento_retomar"` ("Retomar contato: … · dd/mm") com `vence_em = hoje + N dias`. Status Aquecimento em si é gravado em `flag_status.prazo` logo acima (linhas 730–739). Não existe card equivalente ao `QualificacaoEtapaCard` no drawer para Aquecimento — status Aquecimento só muda pelo popup de transição.

## Mudanças

### 1) `QualificacaoEtapaCard` (drawer)
Reescrever o `onClick` da pill para fazer só:
```ts
await supabase.from("pipeline_leads")
  .update({ flag_status: { ...(lead.flag_status||{}), status_atendimento: statusKey } })
  .eq("id", lead.id);
onSaved?.();
window.dispatchEvent(new CustomEvent("pipeline-reload"));
toast.success("Status atualizado");
```
Remover: import de `advanceQualificacaoStatus`, `willClampVisitaDate`, `DataOverride`, `VisitaDatePicker`, Popover em torno de `alinhando_visita`. Pill `alinhando_visita` passa a ser botão simples igual às outras. `PerfilLeadCard` e o `VisitaDatePicker` exportado continuam existindo (o segundo pode ficar exportado sem uso — removido só se ninguém mais importar).

### 2) Aquecimento — `PipelineBoard.tsx`
Deletar o bloco 741–768 (criação da tarefa `aquecimento_retomar`). Manter 730–739 (grava `flag_status.prazo`). Nada mais.

### 3) `TaskCompletionDialog.tsx` + `CompletionForm.tsx`

**Props do Dialog:** adicionar `tarefaTipo?: string`. Mapa interno:
```
ligacao→ligacao, whatsapp→whatsapp, email→email, visita→visita,
follow_up→whatsapp, proposta→whatsapp, default→whatsapp
```
Setar `tipoContato` inicial a partir desse mapa; nunca renderizar UI de "Canal".

**Remover do Dialog/Form:**
- Toda a lógica `isQualFlow`, `qualInfo`, `qualPillStatus`, `qualDataOverride`, `qualHoraOverride`.
- Import e chamada de `advanceQualificacaoStatus`.
- Componente `QualificacaoPillsBlock` e uso do `VisitaDatePicker` variante `confirmar-visita`.
- Link "A conversa mudou de rumo? Trocar etapa".
- Qualquer campo/UI de "Canal" no `CompletionForm`.

**Adicionar seção "Status da etapa" (obrigatória) no `CompletionForm`** quando o stage é `qualificacao` ou `aquecimento` (e não é Sem Contato):
- Qualificação: pills de `QUALIFICACAO_STATUS_ATEND` (6 pills, incluindo `alinhando_visita` como pill simples).
- Aquecimento: pills `[{value:"30",label:"30 dias"},{value:"60",label:"60 dias"},{value:"90",label:"90 dias"}]`.
- Pré-selecionar o valor atual do lead (`flag_status.status_atendimento` ou `flag_status.prazo`).
- Botão "Concluir" desabilitado até ter uma pill selecionada.
- Bloco `AgendarCard` (Tipo/Quando/Mover etapa/Detalhes) + link "Só concluir, sem agendar próxima" ficam **intactos**, logo abaixo da seção Status.

**Sem Contato:** intocado — o branch `isCadenciaTask` (banner "Tentativa X registrada", sem card Agendar) permanece.

### 4) `CompletionPayload` + persistência

Em `src/components/pipeline/task-completion/types.ts`, adicionar:
```ts
status_etapa?: { key: "status_atendimento" | "prazo"; value: string };
```

Em `src/lib/completeLeadTask.ts` e no `handleCompletionConfirm` de `src/pages/MinhasTarefas.tsx` (ramo `lead`): se `payload.status_etapa` vier, ler `flag_status` atual do lead, aplicar `{...flag_status, [key]: value}` e `UPDATE pipeline_leads`. Criação da `nova_tarefa` manual continua exatamente como está.

### 5) Limpeza
- `qualificacaoTaskEngine.ts`: manter o arquivo (para o tipo `DataOverride` caso ainda importado). Se `rg` mostrar zero imports de `advanceQualificacaoStatus`/`willClampVisitaDate`/`buildQualificacaoTaskTitle` após as mudanças, remover apenas as importações mortas para `tsgo` passar limpo. Não deletar o arquivo agora (baixo risco/benefício).
- `QualificacaoPillsBlock` (arquivo dentro de `task-completion/`): remover o arquivo se não for mais importado.

## Validação
1. `tsgo --noEmit` limpo.
2. Query: escolher um lead em stage `qualificacao` com 1 tarefa pendente, simular no cliente completar via `completeLeadTask` com `status_etapa={key:"status_atendimento",value:"alinhando_visita"}` + `nova_tarefa` manual → conferir via `supabase--read_query` que:
   - `pipeline_leads.flag_status->>'status_atendimento' = 'alinhando_visita'`
   - Existe exatamente **1** tarefa `pendente` para o lead (a manual recém-criada), a antiga como `concluida`.
3. Grep final: `rg "Canal|advanceQualificacaoStatus|QualificacaoPillsBlock|aquecimento_retomar"` nos arquivos tocados retorna vazio (fora comentários).

## Arquivos alterados
- `src/components/pipeline/QualificacaoChecklistCard.tsx`
- `src/components/pipeline/PipelineBoard.tsx` (deletar bloco 741–768)
- `src/components/pipeline/task-completion/TaskCompletionDialog.tsx`
- `src/components/pipeline/task-completion/CompletionForm.tsx`
- `src/components/pipeline/task-completion/types.ts`
- `src/lib/completeLeadTask.ts`
- `src/pages/MinhasTarefas.tsx`
- (possível) remover `src/components/pipeline/task-completion/QualificacaoPillsBlock.tsx` se ficar órfão
