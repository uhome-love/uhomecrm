# Motor de Estagnação do Pipeline (plano blindado)

## Por que (dados reais auditados hoje)
A cadência cobre só **Sem Contato (304)**. O cemitério é o meio do funil. Mas a auditoria mostrou que a regra precisa ser cirúrgica, senão quebra:

| Etapa | Total | Estagnaria dia 1 (ação humana) |
|---|---|---|
| Contato Iniciado | 591 | 390 (66%) |
| Busca | 546 | 336 (62%) |
| Aquecimento | 460 | 139 (30%) |
| **Total** | | **858** |

Com a regra "qualquer registro zera" → só **6** estagnariam (motor morto, pois 455/458 leads parados são tocados por automações). Por isso a definição de "ação" é o coração do projeto.

## Definição de "AÇÃO" (lista branca — só ação humana zera o contador)
Conta como ação (reinicia o contador):
- Mudança de etapa (`stage_changed_at`)
- Aceite do lead (`aceito_em`)
- Tarefa **concluída** (`pipeline_tarefas.concluida_em`) — NÃO a criação (gerador automático)
- Anotação (`pipeline_anotacoes`)
- Atividade de tipo humano (`pipeline_atividades.tipo` IN: ligacao, contato, visita, nota, proposta, email, reuniao, mudanca_etapa, retorno, envio_material, whatsapp)
- WhatsApp enviado pelo corretor (`whatsapp_mensagens.direction = 'sent'`)
- Visita (`visitas`)

NÃO conta (ruído automático, fica de fora): `updated_at`, `ultima_acao_at`, `lead_score_at`, reengajamento, `pipeline_atividades.tipo` IN (entrada, nurturing_sequencia, descarte, sistema, followup, temperatura_mudou, match, campanha_atrio), tarefa apenas criada, WhatsApp `received`.

## Limites por etapa (configuráveis)
Contato Iniciado **7d** · Busca **15d** · Aquecimento **30d** · Visita **desligado** (configurável).
Após o limite: **1 aviso ao corretor** + prazo de **48h**. Qualquer ação no prazo cancela e zera. Sem ação → estagna.

## Exclusões obrigatórias (nunca estagnar)
- `negocio_id` preenchido (já virou negócio)
- `modulo_atual = 'pos_vendas'`, etapa Descarte, arquivados/inativados
- **Parceria ativa** (`pipeline_parcerias.status='ativa'`): NÃO entra no motor automático — fica numa aba separada da central para o gestor decidir manualmente (não tirar lead compartilhado sem tratar o parceiro)
- Lead aceito há menos que o limite da etapa (coberto por `aceito_em`)

## Rampa anti-tsunami (resolve os 858 dia 1)
O motor **não** marca os 858 de uma vez. Backfill controlado:
- Cron processa no máximo **N leads/dia** (config, ex. 40/dia), **mais antigos primeiro**.
- Esvazia o passivo em ~3 semanas sem afogar a central nem o corretor.
- Leads novos que atingem o limite depois entram no fluxo normal.

## Destinos na Central de Decisão (gestor e CEO)
Por lead (e em lote): **Repassar para outro corretor** · **Colocar na roleta** (Fila CEO) · **Descartar** (reengajável). Tudo gravado em `pipeline_historico`.

## Fluxo
```text
Lead etapa do meio, SEM ação humana >= limite, na fila de backfill (N/dia)
   ▼ [AVISO] notifica corretor (app+push) · prazo 48h · badge no card
   │ qualquer ação humana → cancela + zera
   ▼ sem ação em 48h → [ESTAGNADO] some do pipeline do corretor
   ▼ Central de Decisão (gestor + CEO): Repassar · Roleta · Descartar
```

## Fases (cada uma validada por você antes da próxima)

### Fase 0 — Auditoria read-only (zero mudança)
- Função SQL `_pipeline_ultima_acao_humana(lead_id)` com a lista branca acima.
- Relatório: quem estagnaria, por etapa/corretor, com a data e a fonte da última ação.
- Você revisa uma amostra e confirma que ninguém com ação real seria pego. **Trava de segurança contra tirar lead errado.**

### Fase 1 — Visibilidade (sem automação, nada some)
- Colunas em `pipeline_leads`: `estagnado`, `estagnado_em`, `estagnado_aviso_em`, `estagnado_prazo_em`.
- Tabela `pipeline_estagnacao_config` (stage_id, dias_limite, ativo, limite_backfill_dia) + GRANTs + RLS.
- Badge "🕒 N dias sem ação" no `CardMinimal.tsx` ao passar do limite (só visual).
- **Central de Decisão** (somente leitura) para gestor/CEO, com abas: "Estagnados", "Em parceria" e "Em aviso (48h)". Acesso via `pageRegistry.ts` para gestor/diretor/admin.

### Fase 2 — Aviso + estagnação automática (com rampa)
- Edge function `pipeline-estagnacao` (cron 1x/dia, `requireCronAuth`, janela de silêncio 00:00–09:00 BRT).
- Respeita limite_backfill_dia (N/dia, mais antigos primeiro), exclusões e a lista branca.
- Limite atingido → 1 aviso + prazo 48h; prazo vencido sem ação → `estagnado` + histórico.
- Pipeline do corretor **esconde estagnados** (toggle "mostrar estagnados").
- Idempotência: 1 aviso por ciclo por lead (sem duplicar).

### Fase 3 — Ações da Central
- Botões Repassar / Roleta / Descartar (individual e lote) ligados às RPCs/fluxos existentes (redistribuição, Fila CEO, descarte reengajável). Cada ação limpa o estado e registra histórico.

## Conflitos resolvidos
- **`stalled-deals-notify` (função existente)**: hoje notifica gerente de "negócios parados 15+ dias" varrendo `pipeline_leads.stage_changed_at` global. Para não duplicar alerta, será **reconciliada**: ou restrita ao pipeline de negócios, ou substituída pela nova central. Decidido na Fase 1.
- **Oferta Ativa / Nutrição**: estagnar não toca essas réguas; só Descartar (que já respeita a exclusividade por telefone/email).

## Testes / validação (cada fase)
- Query de auditoria: "estagnados candidatos" × "leads com ação humana recente" = zero falso positivo.
- `tsgo` + testes existentes verdes.
- Preview: corretor não perde lead com ação; gestor e CEO veem as 3 abas; Repassar/Roleta/Descartar levam o lead ao destino certo e ele some da central.
- Cron: respeita N/dia, janela de silêncio e idempotência.

## Fora do escopo
- Não altera a cadência Sem Contato nem suas tabelas.
- Não cria cadências multi-passo para outras etapas (evita avalanche de notificação).
- Não altera disparo Meta/reengajamento além de empurrar descartados reengajáveis para a régua existente.
