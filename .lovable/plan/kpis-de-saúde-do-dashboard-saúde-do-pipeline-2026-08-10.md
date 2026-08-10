# KPIs de saúde do Dashboard = saúde do Pipeline

## O que está acontecendo (confirmado nos dados da Adriana)

Os dois lugares usam regras diferentes para o mesmo lead:

- O **Pipeline** (frontend) reconhece 4 estados: em dia, atenção, desatualizado e **estagnado** (lead parado há muito tempo: Sem Contato > 15 dias, Qualificação/Aquecimento > 21 dias).
- O **Dashboard** usa a função do banco, que só conhece 3 estados — ela **não tem a regra de estagnado**, então classifica esses leads como "desatualizado".

Na carteira da Adriana hoje: 72 em dia, 10 atenção e **1 lead em Qualificação parado há 23 dias**. O Pipeline chama esse lead de "estagnado" (por isso desatualizado = 0 lá) e o Dashboard chama de "desatualizado" (por isso o 1). Mesmo lead, dois nomes.

## Correção proposta

Fazer o banco ser a fonte única e igual ao Pipeline:

1. Adicionar a regra de **estagnado** na função de saúde do banco, com exatamente os mesmos prazos do frontend (Sem Contato 15 dias, Qualificação 21, Aquecimento 21).
2. Com isso a leitura do Dashboard passa a devolver: em dia 72, atenção 10, desatualizado 0, estagnado 1 — igual ao Pipeline.
3. No card "Saúde da carteira" do Dashboard, exibir também o estado **Estagnado** (roxo) quando houver leads nesse estado, clicando para o Pipeline já filtrado por estagnado — hoje esses leads simplesmente somem da visão do Dashboard.

Sem mudança de regra de negócio: só alinhamento entre as duas telas.

## Detalhes técnicos

- Migration única: `CREATE OR REPLACE FUNCTION public.lead_saude_status(...)` adicionando o branch `estagnado` antes da comparação verde/âmbar/vermelho, espelhando `ESTAGNA_POR_ETAPA` de `src/lib/leadSaude.ts`. `rpc_carteira_saude` já filtra por `saude='estagnado'` e já exclui estagnado da base do `pct_em_dia` — nada a alterar nela.
- Frontend: `src/components/corretor/CarteiraKpis.tsx` — grid passa a renderizar um 4º StatCard "Estagnado" (tom violeta, condicional a `estagnado > 0`), navegando para `/pipeline-leads?filtro=estagnado` (chave já suportada em `PipelineFiltroBadges`).
- Nenhuma alteração em `leadSaude.ts` nem nas contagens do Pipeline.
- Validação: rodar a contagem por saúde da Adriana no banco antes/depois e conferir ao vivo que Dashboard e Pipeline mostram os mesmos números.
