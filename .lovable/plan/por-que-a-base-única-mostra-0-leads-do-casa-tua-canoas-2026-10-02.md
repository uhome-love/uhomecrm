# Por que a Base única mostra 0 leads do Casa Tua Canoas

## Causa (conferida nos dados)
- A **Base única de leads** não recebe ninguém novo desde **01/08**. Não existe nada que copie para ela os leads que chegam depois dessa data.
- O Casa Tua Canoas foi lançado depois disso. Por isso a Base única não tem nenhum lead dele (0), enquanto o **pipeline tem 1.331 leads do Canoas com telefone**.
- O filtro está funcionando. O problema é que essa lista parou de ser atualizada.

## Para enviar agora (sem mudar nada no sistema)
No passo **1. Público**, troque a fonte de "Base única" para **Pipeline** e filtre por Casa Tua Canoas. Assim os 1.331 leads do Canoas aparecem.
- Atenção: esses leads estão sendo atendidos por corretores. Se o cliente responder "Sim", ele continua com o corretor dele, e o corretor recebe o aviso.

## Correção definitiva (fase 2, só se você aprovar)
1. Colocar na Base única, uma única vez, os leads que entraram no pipeline desde 01/08, sem duplicar quem já está lá (a comparação é pelo telefone).
2. A partir daí, todo lead novo que entrar no pipeline também vai para a Base única, sem ninguém precisar fazer nada.
3. Conferir no Disparo manual que o Casa Tua Canoas passa a mostrar a quantidade certa, **sem enviar nada**.

## Detalhes técnicos
- `base_reengajamento_candidatos` filtra por `base_leads.empreendimento_canonico_id`; para Canoas (`5f28344e…`) há 0 linhas; `max(base_leads.created_at)` = 2026-08-01; `base_leads_import_runs` está vazio; o único cron é `atualizar-situacao-crm-base-leads` (só atualiza a situação, não insere).
- Fase 2: backfill com dedup por `telefone_key` + trigger/cron de upsert a partir de `pipeline_leads`, sem mexer em schema, triggers ou dados de `pipeline_leads`. Aplicar a migration fora do horário comercial, se for preciso.
