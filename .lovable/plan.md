# Roteamento de Leads Reengajados (resposta positiva no template Meta)

## Regra confirmada

Quando o webhook detecta resposta positiva (texto ou botão "Sim") ao template Meta de reengajamento, o destino depende da **origem do disparo**:

| Origem do disparo | Ação |
|---|---|
| **Descartado** (stage Descarte, reengajável) | Envia para **roleta** como `lead_reengajado` + histórico do disparo + notifica corretor sorteado |
| **Lista Oferta Ativa** | Envia para **roleta** como `lead_reengajado` + histórico do disparo + notifica corretor sorteado |
| **Pipeline Ativo** (lead já com corretor em estágio ativo) | **NÃO** mexe na atribuição. Apenas cria atividade na timeline + push para o corretor atual avisando do interesse no disparo |
| **Visita Amanhã** | Igual a Pipeline Ativo (lead já está com corretor) |

## Estado atual vs. desejado

Hoje em `whatsapp-webhook` e `evolution-webhook`:
- **Lead em pipeline ativo respondendo positivo** → já faz o correto: abre janela 24h, cria atividade, notifica corretor. ✅
- **Lead descartado respondendo positivo** → cai no `handleExistingLeadReply` e só notifica o corretor antigo. **Não vai para roleta.** ❌ Precisa corrigir.
- **Lead da Oferta Ativa respondendo positivo** (sem pipeline_lead) → já cria novo pipeline_lead e chama `distributeViroleta`. ✅
- **Lead da Oferta Ativa respondendo positivo (já tem pipeline_lead em Descarte)** → cai em `handleExistingLeadReply` e não vai pra roleta. ❌

## Mudanças necessárias

### 1. Detectar origem do disparo no momento da resposta
Em `whatsapp-webhook/index.ts` (handler do `button_reply` + texto positivo casado com `reengajamento_meta_disparos`) e em `evolution-webhook/index.ts` (handler positivo): após identificar o lead, consultar:

- `reengajamento_meta_disparos.audience_source` (a coluna `audience_source` será adicionada — ver §4) ou fallback pelo `run_id` → `reengajamento_dispatch_runs.audience_source`
- Tipo `descartados` / `oferta_ativa_lista` → **roleta**
- Tipo `pipeline_ativo` / `visita_amanha` → **só notificação**

### 2. Branch "vai para roleta" em lead descartado
Novo helper `reactivateAndDistribute(lead)`:
1. Move o lead do stage Descarte para o stage de entrada da roleta (mesma lógica usada hoje em `lead-reentry-roleta-logic`).
2. Limpa `corretor_id` para o redistribute funcionar.
3. Registra atividade `"🔄 Lead reengajado via [campanha] — redistribuído pela roleta"`.
4. Grava em `pipeline_atividades` o `dispatch_run_id` + nome do template clicado (histórico do disparo).
5. Chama `distributeViroleta(lead.id)` (já existe).
6. Após o distribute, busca novo `corretor_id` e envia push: `"🔥 Lead reengajado recebido — respondeu SIM ao template [X]. Próximo passo: ligar nas próximas 2h."`

### 3. Branch "só notifica" em pipeline ativo
Manter o fluxo atual de `handleExistingLeadReply` mas enriquecer a notificação com:
- Nome do template/campanha que o lead clicou
- Categoria push `lead_reengajado_ativo` (já existe `lead_reengajado`, reusar)
- Atividade na timeline com tag `[Disparo: nome_template]`

### 4. Histórico do disparo (campo `audience_source`)
Migration nova adicionando coluna em `reengajamento_meta_disparos`:
```sql
ALTER TABLE reengajamento_meta_disparos
  ADD COLUMN IF NOT EXISTS audience_source TEXT;
-- valores: 'descartados' | 'pipeline_ativo' | 'oferta_ativa_lista' | 'visita_amanha' | 'legacy'
```
E `reengajamento-descartados-enqueue` passa a gravar `audience_source` baseado no payload `audience.source`. Histórico já existente fica como `'legacy'` e cai por padrão na rota **roleta** (comportamento histórico de descartados).

### 5. Determinação "está no pipeline ativo?"
Considera "ativo" se: `stage_id NOT IN (Descarte, Inativado, Negócio Criado)` E `corretor_id IS NOT NULL`. Senão, trata como descartado/órfão → roleta.

## Fora de escopo

- Não mexer no flow de NÃO (já está OK: inativa descartado, marca `sem_interesse` em OA).
- Não mexer no `roleta-distribute` core.
- Não criar dashboard de "leads reengajados por origem" agora (fica para Fase 2 da Central).

## Migrações

1 migration apenas (adicionar `audience_source`). Respeita limite de 2/dia.

## Arquivos afetados

- `supabase/migrations/<nova>.sql` — coluna `audience_source`
- `supabase/functions/whatsapp-webhook/index.ts` — branch por origem
- `supabase/functions/evolution-webhook/index.ts` — branch por origem
- `supabase/functions/reengajamento-descartados-enqueue/index.ts` — gravar `audience_source`
