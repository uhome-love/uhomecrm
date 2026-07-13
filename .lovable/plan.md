# Parar o disparo e resolver as falhas de envio

## Diagnóstico (o que está acontecendo agora)

Investiguei o banco e as edge functions. Os envios **não estão falhando por bug de código** — estão falhando na origem, no lado da Meta:

- **19.980 disparos com status `failed`**; os mais recentes (hoje, até 17:37) trazem o erro literal da Meta: **"Business eligibility payment issue"** (problema de cobrança/elegibilidade da conta WhatsApp Business).
- A Meta aplicou **pacing/limite 131049** por causa de **100% de falha recente** — cada novo envio agora **queima a reputação do número**.

**Por que ainda está disparando mesmo com tudo "desligado":** todas as travas globais estão OFF (`campaign_dispatch_enabled=false`, `nutricao_enabled=false`, `reengajamento_config.enabled=false`), **porém existe uma execução ativa**:

```text
run 92d33fb8  status=running  cancel_requested=false
fila: 433 pending + 2 processing (ainda vão disparar)
motivo: "Auto-pausa por qualidade: 100% de falha... 131049"
```

Essa run foi **reaberta pela função de reenvio** (`reengajamento-retry-falhas` / botão "Tentar novamente" da Fila de Reenvio). Ela chama o disparador com `iniciado_por: "manual_retry"` + `force: true`, o que **contorna o gate global e o check de `enabled`**, reabre a run e recoloca a fila para processar. Ou seja: o recurso de reenvio recém-criado é exatamente o que **reacendeu o motor** e voltou a queimar a base contra uma conta que está 100% falhando.

## O que vou fazer

### 1. Parada de emergência (imediata)
- Cancelar a run ativa `92d33fb8` (`status=cancelled`, `cancel_requested=true`, `finished_at=now`, motivo claro).
- Marcar os itens `pending`/`processing` dessa fila como cancelados para que **nenhum envio adicional saia**.
- Confirmar `reengajamento_config.paused=true` e os `system_flags` OFF.

### 2. Blindar o reenvio contra reignição (correção de código)
Ajustar `supabase/functions/reengajamento-retry-falhas/index.ts` para que **nunca mais** reacenda um disparo em massa quando a conta está com problema de qualidade/cobrança:
- **Respeitar o gate global**: se `campaign_dispatch_enabled=false`, o retry retorna bloqueado (não faz `force`, não reabre run, não limpa a pausa).
- **Bloquear por qualidade**: se as falhas recentes forem de elegibilidade/pagamento (`Business eligibility payment issue`) ou throttle 131049, recusar o reenvio com mensagem explicativa.
- Remover o `paused:false` automático e a reinvocação com `force:true` do disparador; o reenvio só deve reprocessar itens específicos **quando a conta estiver saudável e o gate ligado**.

### 3. Deixar claro na UI (`FilaReenvioCard.tsx`)
- Banner de alerta quando o motivo predominante for cobrança/elegibilidade/131049: explicar que o reenvio está **bloqueado até regularizar a conta na Meta** e desabilitar os botões "Tentar" / "Tentar todos" nesse estado.

## Ação necessária do seu lado (fora do sistema)
A causa raiz é **externa**: a conta WhatsApp Business está com **pendência de cobrança/elegibilidade** no Meta Business Manager. Enquanto isso não for regularizado (forma de pagamento/faturamento e qualidade do número), **nenhum envio vai passar** — e insistir só piora a reputação. Depois de regularizado, reativamos com base quente e volume controlado (warm-up).

## Detalhes técnicos
- Emergência via `UPDATE` em `reengajamento_dispatch_runs` e `reengajamento_dispatch_queue` (escopo apenas da run 92d33fb8).
- `reengajamento-retry-falhas`: adicionar checagem `isCampaignDispatchEnabled()` no início; classificar falhas por `error_text`; só chamar o disparador sem `force` e com gate ligado.
- `FilaReenvioCard`: estado derivado do `error_text` para banner + desabilitar ações.
- Sem migrations de schema; sem alteração nas travas globais existentes.
