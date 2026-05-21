
## Diagnóstico

O Lote 2 do disparo Átrio criou **998 `pipeline_leads`** hoje (todos `arquivado=true`, `origem=oferta_ativa`, `motivo_descarte=oferta_ativa_atrio_lote2`). Eles entram no filtro `isOfertaAtiva(origem)` do `useCeoDashboard.ts` e por isso o card **Reaproveitados (OA)** mostra **1014** (16 reais + 998 do disparo).

O comportamento correto que você definiu:
- Fonte do disparo = `oferta_ativa_leads` (telefone + nome) — **não toca em `pipeline_leads`**
- Lead só vira `pipeline_lead` (e vai para roleta como reengajamento) **quando responde** ao template
- Lote 1 (já enviado) permanece intacto

## Mudanças

### 1. Migration (DDL + cleanup)
- `ALTER TABLE campanha_atrio_audiencia ALTER COLUMN lead_id DROP NOT NULL`
- `ALTER TABLE campanha_atrio_eventos ALTER COLUMN lead_id DROP NOT NULL`
- Apagar audiência do lote 2 (`DELETE FROM campanha_atrio_audiencia WHERE lote=2`) — nenhuma onda do lote 2 começou
- Apagar os 998 `pipeline_leads` do lote 2 (e dependências FK: `pipeline_atividades`, `campanha_atrio_eventos`, `campanha_atrio_respostas`, `campaign_clicks` se existirem) via `WHERE motivo_descarte='oferta_ativa_atrio_lote2'`
- Resetar `total_alvo=0` nas ondas 4/5/6

### 2. `campanha-atrio-preparar-lote2`
- Remover toda a criação de `pipeline_leads`
- Manter: dedup por telefone, exclusão de telefones em **stage ativo** do pipeline, exclusão de quem já está em qualquer audiência Átrio (lote 1 ou 2)
- Inserir audiência só com `telefone_normalizado`, `nome`, `empreendimento_origem`, `onda`, `lote`, `ordem`, `status='pending'`, `lead_id=NULL`

### 3. `campanha-atrio-iniciar-onda`
- Identificar linhas da audiência por `(onda, telefone_normalizado)` (lead_id pode ser NULL)
- Inserir evento mesmo sem `lead_id`
- **Pular** os updates em `pipeline_leads` (reengajamento_status) e o insert em `pipeline_atividades` quando `lead_id` for NULL
- Lote 1 (com `lead_id` preenchido) continua marcando o lead

### 4. `campanha-atrio-processar-resposta`
Quando o evento for de lote 2 (sem `lead_id`):
- **Criar `pipeline_lead`** no momento da resposta: `origem='campanha_atrio'`, `empreendimento='Átrio - ABF'`, `stage_id=Sem Contato`, `arquivado=false`, `aceite_status='pendente'`, `reativado_por_nutricao=true`, `reativado_em=now()`, com `telefone`/`nome` vindos do evento
- Vincular `campanha_atrio_eventos.lead_id` e `campanha_atrio_respostas.lead_id` ao recém-criado
- Seguir o fluxo atual: distribuir via roleta (S5 Produto Foco), `campaign_clicks`, `pipeline_atividades`

Quando lote 1 (com `lead_id`): fluxo atual sem mudanças.

### 5. Frontend
Nenhuma alteração necessária. Com os 998 leads apagados, o card **Reaproveitados (OA)** volta a refletir só OA real, e o card **Reengajamento** passará a refletir apenas leads que efetivamente responderam ao disparo.

## Resultado
- Dashboard limpo (998 inflados removidos hoje)
- Disparo Átrio (lote 2 em diante) usa OA como fonte sem poluir o pipeline
- Pipeline só ganha um lead novo quando há reengajamento real → entra na roleta com origem `campanha_atrio`
- Lote 1 não é afetado
