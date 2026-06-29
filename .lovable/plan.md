# Central de Relatórios — Análise de Dados Relevantes e Roadmap

## 1. O que existe hoje

| Seção | KPIs principais | Detalhe |
|---|---|---|
| Geral | VGV período, Visitas realizadas, Assinados, Ticket médio | Sparkline VGV |
| Pipeline Leads | Pipeline ativo, Recebidos, Conv. Lead→Visita, Atualização 48h | — |
| Oferta Ativa | Tentativas, Aproveitados, Ativos no pipeline, Negócios da OA | Top listas |
| Visitas | Criadas, Realizadas, No-show, Comparecimento | Por dia da semana, Top empreend. |
| Negócios | Ativos, Criados, Caíram, Assinados | Por fase |
| Vendas | VGV, Vendas, Ticket, Comissão | VGV/dia, Top empreend. |
| Ranking | VGV, Vendas, Visitas, Leads, OA por corretor | Pódio + tabela |

A base visual está boa. O que falta é **profundidade analítica** — o gestor vê "o quê" mas não "de onde", "quão rápido" e "vs. meta".

## 2. Lacunas de dados relevantes (o que o CRM tem e o relatório não mostra)

### A. Segmentos (alta prioridade — refator recente)
A empresa reestruturou para 4 segmentos canônicos (S1 Moradia, S2 Investimento, S3 Foco, S4 Alto Padrão) e **nenhum relatório quebra por segmento**. É a dimensão analítica mais importante hoje e está ausente.
- Leads recebidos, visitas, negócios, VGV e conversão **por segmento**.
- Permite responder: "Foco converte melhor que Moradia?", "onde está o VGV?".

### B. Origem / Campanha (alta prioridade)
`pipeline_leads` carrega origem (Meta, Site, ImovelWeb, OA, Roleta, Indicação) e campanha, mas não há nenhum relatório de **funil por canal**.
- Leads por origem → conversão lead→visita→venda por origem.
- Identifica o canal que traz volume vs. o que traz VGV (qualidade ≠ quantidade).

### C. Funil de conversão end-to-end (alta prioridade)
Já existe um componente `FunnelChart` compartilhado, mas nenhuma seção monta o funil completo:
`Lead recebido → 1º contato → Visita agendada → Visita realizada → Negócio criado → Assinado`, com a taxa de passagem entre cada etapa. Hoje só há a conversão pontual Lead→Visita.

### D. Velocidade / Tempo (média prioridade)
Dados de tempo existem (`created_at`, `fase_changed_at`) mas não viram métrica:
- Tempo médio até 1º contato (SLA de atendimento).
- Ciclo de venda (lead → assinatura), em dias.
- Aging do pipeline ativo (leads parados há +X dias por fase).

### E. Metas vs. Realizado (média prioridade)
`ceo_metas_mensais` guarda metas mas o relatório não compara. Adicionar **% de atingimento** (VGV, vendas, visitas) com gauge/barra de progresso no resumo executivo.

### F. Reengajamento / Roleta (operações grandes sem relatório)
- Reengajamento: disparos, taxa de entrega/resposta, reaproveitados → Fila CEO.
- Roleta: distribuição, taxa de aceitação, SLA, leads na Fila CEO.

## 3. Qualificação dos dados existentes (correções de qualidade)

- **Ticket médio**: confirmar exclusão de negócios com VGV nulo no cálculo (evita média distorcida).
- **Ranking OA**: a coluna mostra `oa_tentativas` mas o label sugere produtividade — padronizar para `oa_pontos`/aproveitados, mais fiel ao esforço.
- **Negócios "Caíram"**: incluir o motivo de queda (já existe campo) como mini-tabela, hoje só mostra o número.
- **Comissão estimada**: marcar claramente como estimativa vs. valor de `pipeline_comissoes` quando existir.
- **Deltas vs. período anterior**: estender para Pipeline Leads, OA e Negócios (hoje só Vendas/Visitas têm delta consistente).

## 4. Roadmap proposto (fases independentes, validar cada uma)

```text
Fase 1 — Dimensão Segmento + Origem      (maior impacto analítico)
  ├─ Quebra por segmento em Leads/Visitas/Negócios/Vendas
  └─ Funil por origem de canal

Fase 2 — Funil de conversão end-to-end   (usa FunnelChart já existente)

Fase 3 — Metas vs. Realizado             (ceo_metas_mensais no Geral)

Fase 4 — Velocidade/Tempo (SLA, ciclo, aging)

Fase 5 — Relatórios de Reengajamento e Roleta

Fase 6 — Correções de qualificação (ticket, OA pontos, motivos de queda, deltas)
```

## Detalhes técnicos

- Cada nova dimensão exige ampliar as RPCs existentes (`get_relatorio_*`) com novos blocos `extras.*` (ex.: `extras.por_segmento`, `extras.por_origem`), mantendo o padrão BRT (`AT TIME ZONE 'America/Sao_Paulo'`) já consolidado.
- Frontend reutiliza `KpiGrid`, `MiniTable`, `MiniChart`, `FunnelChart` — sem novos componentes base, só novas seções/blocos.
- Metas exigem join com `ceo_metas_mensais`; gauge pode ser barra de progresso simples.
- Migrations respeitam o limite de 2/dia (08–19h BRT) — agrupar as alterações de RPC por fase.

## Decisão necessária
Quer que eu comece pela **Fase 1 (Segmento + Origem)** — a de maior impacto — ou prefere priorizar outra fase (ex.: Metas vs. Realizado ou Funil)?
