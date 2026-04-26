## Objetivo

Gerar **3 PDFs separados** (um por equipe) com o relatório semanal completo das últimas 7 dias rolando (BRT). Entregar como `presentation-artifact` aqui no chat — você baixa e envia por WhatsApp. **Zero mudança no CRM**: nada de Edge Function, nada de botão, nada de rota nova.

## Equipes confirmadas

| Equipe | Gerente | Corretores ativos | Cor da faixa |
|---|---|---|---|
| Gabrielle | Gabrielle Rodrigues | 9 | Verde |
| Bruno | Bruno Schuler | 11 | Azul |
| Gabriel | Gabriel Vieira | 7 | Roxo |

## Janela de análise

- **Atual**: `now() - interval '7 days'` até `now()` em BRT (America/Sao_Paulo)
- **Comparativo**: 7 dias anteriores (D-14 a D-7) para setas ↑↓

## Mapeamentos validados (queries já testadas)

| Tabela | Coluna do corretor | Tipo de ID |
|---|---|---|
| `pipeline_leads` | `corretor_id` | `auth.users.id` |
| `visitas` | `corretor_id` | `auth.users.id` |
| `negocios` | `auth_user_id` | `auth.users.id` ✅ (NÃO usar `corretor_id`, que é `profiles.id`) |
| `pipeline_atividades` | `responsavel_id` | `auth.users.id` |
| `pipeline_tarefas` | `responsavel_id` | `auth.users.id` |
| `pipeline_parcerias` | `corretor_principal_id` / `corretor_parceiro_id` | `auth.users.id` |

Time membership via `team_members.gerente_id` + `status='ativo'`.

Stages relevantes (pipeline_leads):
- `Visita` `a857139f-c419-4e37-ae17-5f5e70b21172`
- `Pós-Visita` `d932fb49-419c-4fda-bae1-9ef06ee2d033`
- `Negócio Criado` `a8a1a867-5b0c-414e-9532-8873c4ca5a0f`
- `Descarte` `1dd66c25-3848-4053-9f66-82e902989b4d`
- `Sem Contato` `2fcba9be-1188-4a54-9452-394beefdc330`

Stages negócios:
- `Proposta` `de6cee2f-8dda-4e60-a4e2-6b7f21aeae96` (negocios.fase)
- Assinado: usar `negocios.data_assinatura IS NOT NULL` ou `fase = 'Contrato Gerado'`

## Estrutura do PDF (por equipe — 8 seções)

1. **Hero** colorido (verde/azul/roxo) com nome do time + 6 KPIs grandes + comparativo vs semana anterior (↑↓ %)
2. **Origem dos leads** — tabela por `pipeline_leads.origem` (volume, % do total, viraram visita, conversão), top 3 destaques
3. **Performance por corretor** — tabela completa com Leads recebidos / trabalhados / Visitas agendadas / realizadas / Conv lead→visita / Negócios proposta / Negócios assinados / VGV assinado, ordenada por VGV desc, com linhas TOTAL e MÉDIA
4. **Gestão do pipeline por corretor** — mini-cards: leads parados >3 dias, leads em "Sem Contato" >24h, tarefas atrasadas, tempo médio 1º contato (h)
5. **Funil da equipe** — Leads → Qualif → Visita Agendada → Visita Realizada → Proposta → Assinado, com % entre etapas e linha de referência das últimas 4 semanas
6. **Destaques da semana** — 🏆 Visitas / 🎯 Gestão / 💰 Conversão (3 cards lado a lado)
7. **Análise & Diagnóstico** — texto 300-400 palavras gerado por Lovable AI (`google/gemini-2.5-flash`)
8. **Plano da próxima semana** — 5-7 ações concretas com responsável, mesma chamada IA

## Stack de execução (sandbox, não CRM)

- **Dados**: queries SQL via `supabase--read_query` (uma rodada de queries por equipe)
- **IA seções 7-8**: script `lovable_ai.py` (skill já disponível, usa `LOVABLE_API_KEY` do sandbox, modelo `google/gemini-2.5-flash`)
- **PDF**: Python + `reportlab` seguindo identidade Uhome (Montserrat, fundo `#F5F5F2`, faixa hero colorida por time, tabelas zebradas, cards com border-radius)
- **QA obrigatório**: converter cada PDF para JPG via `pdftoppm` e inspecionar antes de entregar
- **Saída**: `/mnt/documents/relatorio_semanal_equipe_{nome}.pdf`

## Entregáveis

3 arquivos como `<lov-artifact>` no chat:
- `relatorio_semanal_equipe_gabrielle.pdf`
- `relatorio_semanal_equipe_bruno.pdf`
- `relatorio_semanal_equipe_gabriel.pdf`

## Guardrails

- ❌ Nada de Edge Function nova
- ❌ Nada de botão no `/gerente/dashboard`
- ❌ Nada de migration / mudança em tabela
- ❌ Nada de mudança em hook ou RPC existente
- ✅ Apenas leitura SQL + scripts no sandbox + 3 PDFs no /mnt/documents
