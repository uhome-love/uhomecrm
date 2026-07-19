
# Relatório Semanal Uhome — 13 a 19 de julho de 2026

Somente leitura no CRM. Nada de código, migrations ou UI muda. Gero **material** em `/mnt/documents/` e entrego pra download.

## Escopo

- **Janela atual:** segunda 13/jul → domingo 19/jul (BRT, 00:00–23:59)
- **Comparativo:** semana anterior 06/jul → 12/jul
- **Equipes (todas ativas em `team_members`):**
  - Bruno Schuler (17 corretores)
  - Gabriel Vieira (8 corretores)
  - Junior Padilha (3 corretores)

## Fontes de dados (read-only, via psql)

| Métrica | Fonte |
|---|---|
| Leads recebidos + qualidade v3 (teve_contato) | `pipeline_leads` + helper `lead_teve_contato_v3` |
| Descartes e motivos | `pipeline_leads.status='descartado'` + `motivo_descarte` |
| Visitas marcadas/realizadas/no-show | `v_kpi_visitas` |
| Propostas, vendas, VGV gerado, VGV assinado | `v_kpi_negocios` (COALESCE `vgv_final`→`vgv_estimado`) |
| Ligações OA | `oferta_ativa_tentativas` |
| Tarefas concluídas | `pipeline_tarefas` |
| Mensagens WhatsApp OUT | `whatsapp_mensagens` |
| Vínculo corretor↔equipe | `team_members` (gerente_id = auth user_id) |

Todas as agregações filtram por BRT com `AT TIME ZONE 'America/Sao_Paulo'`.

## Entregáveis

1. **`/mnt/documents/relatorio-semanal-2026-07-13_19-geral.pdf`** — visão executiva Uhome inteira
2. **`/mnt/documents/relatorio-semanal-2026-07-13_19-bruno-schuler.pdf`**
3. **`/mnt/documents/relatorio-semanal-2026-07-13_19-gabriel-vieira.pdf`**
4. **`/mnt/documents/relatorio-semanal-2026-07-13_19-junior-padilha.pdf`**
5. **`/mnt/documents/pauta-reuniao-whatsapp-2026-07-20.md`** — texto pronto pra colar no grupo de gerentes+diretora

## Estrutura de cada PDF

Capa (semana, equipe, gerado em BRT) + seções:

1. **KPIs da semana** (com Δ vs semana anterior, seta ↑/↓/=)
   - Leads recebidos · taxa de contato v3 · descartes
   - Visitas marcadas · realizadas · no-show · taxa de comparecimento
   - Propostas · vendas · VGV gerado · VGV assinado
   - Ligações OA · tarefas concluídas · mensagens WhatsApp OUT
2. **O que aumentou / o que caiu** — top 3 subidas e top 3 quedas em % vs semana anterior
3. **Resultados atingidos** — vendas assinadas (cliente, empreendimento, VGV, corretor)
4. **Ranking de corretores** (só nos PDFs por equipe): leads, visitas realizadas, propostas, VGV assinado
5. **O que melhorar** — diagnóstico automático baseado em thresholds:
   - Contato v3 < 70% → gargalo de follow-up
   - No-show > 30% → confirmação de visita
   - Vendas = 0 com pipeline > X → travamento em negociação
6. **Foco da próxima semana** — 3 bullets acionáveis derivados dos gargalos
7. **Curiosidades da semana** — melhor dia, campanha com melhor conversão, corretor destaque, empreendimento com mais leads

Estilo: cores Uhome (Deep Slate + Indigo #4969FF), Plus Jakarta Sans se disponível senão DejaVu Sans, sem emojis em glyphs (uso via ReportLab XML). Tabelas com listrado suave, sem bordas pesadas.

## Pauta WhatsApp (tom híbrido)

Formato solicitado ("um pouco dos 3"): abre com **1 vitória concreta**, entrega **números-chave em bullets curtos** com Δ vs semana anterior, aponta **1 gargalo com equipe/nome quando material**, fecha com **3 focos da semana**. ~1500 caracteres, formatado pra WhatsApp (negrito com `*`, sem markdown de PDF).

Exemplo de shape (números reais entram na execução):

```
📊 *Semana 13-19/jul — Uhome*

🏆 Vitórias
• X vendas assinadas, VGV R$ Y,Ym (+Z% vs semana anterior)
• Equipe [X] liderou em visitas realizadas

📈 Números
• Leads: N (Δ%)   |   Contato v3: N% (Δpp)
• Visitas marcadas: N   |   realizadas: N (Δ%)
• Propostas: N   |   VGV gerado: R$ Y,Ym

⚠️ Gargalo
• [Diagnóstico automático baseado nos thresholds]

🎯 Foco 20-26/jul
1. ...
2. ...
3. ...
```

## Ordem de execução (após aprovação)

1. Rodar 1 script SQL consolidado que devolve todos os agregados em JSON (por Uhome e por equipe, semana atual + anterior + top listas).
2. Script Python único gera os 4 PDFs com ReportLab (DejaVu Sans registrado pra acentos), inspeciona via `pdftoppm` → view, corrige o que quebrar.
3. Gera o `.md` da pauta com os mesmos números.
4. Entrego os 5 artifacts com `<presentation-artifact>`.

**Não altero nada no CRM.** Sem migration, sem edit em `src/`, sem edge function nova.
