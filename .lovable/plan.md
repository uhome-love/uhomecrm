## Motivo (o que mudou no plano)
Você não quer só volume de leads/visitas por corretor — quer descobrir **em quais empreendimentos e campanhas cada corretor tem melhor performance**, para poder **segmentar a empresa por especialidade** (Corretor X domina Terrace/Vivid, Corretor Y é bom em avulso, Corretor Z converte melhor no MCMV, etc.).

Reescrevi o plano com foco em **taxa de conversão** e **especialização**, não em contagem crua.

## Fonte dos dados (julho/2026, BRT)
- **Leads da roleta**: `roleta_distribuicoes` com `status='aceito'` em julho → julho tem 844 leads aceitos.
- **Empreendimento/campanha**: `pipeline_leads.empreendimento` e `pipeline_leads.campanha`.
- **Visitas**: `visitas` por `pipeline_lead_id`, com 3 status já em julho (20 marcadas · 123 realizadas · 91 no-show).
- **Negócios/vendas**: `negocios` por `pipeline_lead_id` (julho tem 39 propostas + 22 vendidos + outros).
- **Equipe**: `team_members` → gerente/equipe do corretor.

## Métricas do PDF
Para cada linha (corretor × empreendimento e corretor × campanha):

| Métrica | Definição |
|---|---|
| Leads | Distribuições aceitas em julho |
| Visitas marcadas | Visitas criadas do lead (qualquer status) |
| Visitas realizadas | `visitas.status = 'realizada'` |
| No-show | `visitas.status = 'no_show'` |
| Negócios | Linhas em `negocios` do lead |
| Vendas | `negocios.fase = 'vendido'` |
| **Conv. Visita %** | Visitas realizadas ÷ Leads |
| **Conv. Venda %** | Vendas ÷ Leads |
| **Show rate %** | Realizadas ÷ (Realizadas + No-show) |

## O que o PDF vai mostrar (foco em especialidade)

**1. Capa executiva — Top especialistas**
   - "Especialistas por empreendimento": top 3 corretores em conv. venda por empreendimento (com volume mínimo de 5 leads para não distorcer).
   - "Especialistas por campanha": mesmo, por campanha.
   - **Ranking de conv. Venda geral** dos corretores em julho.

**2. Uma seção por equipe**
   Cabeçalho: Gerente · totais · conv. visita · conv. venda.
   Depois duas tabelas:
   - **Corretor × Empreendimento** — leads / visitas realiz. / vendas / conv. venda %
     Célula em verde quando corretor está no top 3 daquele empreendimento; vermelho quando conv. bem abaixo da média com volume ≥ 5.
   - **Corretor × Campanha** — mesmo layout.

**3. Análises extras que estou incluindo (você pediu)**
   - **Show rate por corretor**: quem consegue efetivamente colocar o lead dentro do stand (indicador de qualidade de agendamento).
   - **"Avulso" vs "com empreendimento"**: separo leads sem empreendimento marcado (`empreendimento IS NULL/''`) como categoria própria — atende o "corretor Y é bom em avulso".
   - **Matriz de calor de especialização**: uma tabela final Empreendimento (linhas) × Top 5 corretores (colunas) com conv. venda %, deixando visível quem domina o quê.
   - **Alertas de mismatch**: corretor com muito lead de um empreendimento mas conv. baixa → sugestão de realocar leads.
   - **Volume por campanha**: quais campanhas do Meta/RD estão trazendo mais leads e qual empreendimento carrega cada campanha (para o marketing na reunião).

**4. Consolidado da empresa**
   Totais gerais, conv. média da empresa, ticket médio (VGV vendido), e ranking de campanhas por conv. venda.

## Regras de leitura
- **Volume mínimo** de 5 leads por combinação para uma linha "contar" no ranking (evita corretor com 1 lead virando "melhor conv."). Linhas abaixo aparecem em cinza claro como "amostra pequena".
- Empreendimento/campanha vazios viram "— Avulso —" e "— Sem campanha —".
- Julho = 01/07 a 31/07 BRT.

## Entrega
- Arquivo `/mnt/documents/especialistas-roleta-julho-2026.pdf`, paisagem A4, tabelas com autotable/reportlab (já usados no projeto).
- Também exporto `/mnt/documents/especialistas-roleta-julho-2026.xlsx` com abas por equipe caso queira filtrar ao vivo na reunião.

Confirma que posso executar assim? Se quiser algum recorte extra (ex: separar por segmento MCMV/Alto Padrão, ou por gerente específico), diz agora que já incluo antes de gerar.
