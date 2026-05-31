# Relatórios individuais 1 a 1 — Maio/2026

Objetivo: gerar **um PDF por corretor ativo** (28 corretores, todos os times), cobrindo **01–31/maio/2026**, com números de desempenho, origens/campanhas, insights, melhorias e elogios, e **comparação com a média do time e da empresa** (benchmark). Saída: arquivos para download, prontos para entregar no 1 a 1.

Como é uma geração de artefatos (não uma feature do CRM), faço por script lendo o banco direto e produzindo os PDFs — sem alterar o app.

## O que cada PDF terá

```text
┌──────────────────────────────────────────────┐
│  CAPA: Nome do corretor · Equipe · Maio 2026  │
│  Avatar/iniciais · selo de destaque do mês    │
├──────────────────────────────────────────────┤
│  RESUMO EXECUTIVO (cards):                     │
│  Presença · Roletas · Leads · Visitas         │
│  Negócios · Vendas (VGV assinado)             │
│  cada card: valor + média time + média empresa│
├──────────────────────────────────────────────┤
│  FUNIL DE CONVERSÃO                            │
│  Leads → Visitas → Negócios → Vendas          │
│  com % de conversão entre etapas              │
├──────────────────────────────────────────────┤
│  ORIGENS DOS LEADS (top, com %)               │
│  CAMPANHAS com melhor aproveitamento          │
│  (lead → visita/negócio por campanha)         │
├──────────────────────────────────────────────┤
│  CURIOSIDADES & INSIGHTS (texto)              │
│  MELHORIAS (pontos de atenção) + ELOGIOS      │
├──────────────────────────────────────────────┤
│  Rodapé: posição no ranking da empresa        │
└──────────────────────────────────────────────┘
```

## Métricas e fontes (período 01–31/05/2026, BRT)

- **Presença**: view `v_kpi_presenca` (por `auth_user_id` e `data`). *Atenção: os dados de presença de maio estão esparsos (142 registros, marcados como ausente/nulo). Vou exibir o que existir e, se continuar vazio, uso participação na roleta (dias credenciado) como proxy e sinalizo isso no relatório.*
- **Roletas**: `roleta_distribuicoes` por `enviado_em` — total recebidas, aceitas (status/`aceito_em`), e tempo de 1ª interação. Chave: `corretor_id = profiles.id`.
- **Leads**: `pipeline_leads` por `created_at`. Chave: `corretor_id = profiles.user_id`.
- **Pipeline**: distribuição de leads por estágio (`pipeline_stages`) no fim do mês.
- **Visitas**: `visitas` por `data_visita` — criadas, realizadas, no-show (`status`/`resultado_visita`). Chave: `corretor_id = profiles.user_id`.
- **Negócios**: `negocios` por `created_at` — criados, e por fase. Chave: `auth_user_id`.
- **Vendas / VGV assinado**: `negocios` com `fase='vendido'` e `data_assinatura` em maio; valor = `coalesce(vgv_final, vgv_estimado)` (regra canônica da memória).
- **Origens**: `pipeline_leads.origem` (meta_ads, Oferta Ativa, imovelweb, site_uhome, etc.).
- **Campanhas**: `pipeline_leads.campanha`/`conjunto_anuncio`/`anuncio`/`formulario` — ranking por volume e por aproveitamento (conversão para visita/negócio).
- **Benchmark**: para cada métrica calculo média do **time** (via `team_members`) e média da **empresa** (28 corretores) e mostro lado a lado.

## Insights, melhorias e elogios

Gerados por regras determinísticas a partir dos números de cada corretor comparados ao benchmark, por exemplo:
- Elogio: melhor conversão visita→venda do time; maior VGV; resposta mais rápida na roleta.
- Melhoria: muitos leads parados sem visita; baixa taxa de aceite de roleta; alto no-show.
- Curiosidade: campanha/origem que mais converteu para aquele corretor; dia/semana mais produtivo.

(Opcional, se você quiser: posso enriquecer os textos de insight com a Lovable AI. Por padrão farei por regras, sem custo de IA — me avise se quiser a versão com IA.)

## Identidade visual

Seguir o tema do CRM: Off-white / Deep Slate (#0A0E1A), destaque Indigo (#4969FF), cantos arredondados, tipografia limpa. Logo Uhome na capa/rodapé.

## Detalhes técnicos

1. Script Python (reportlab) lê o banco via consultas SQL agregadas por corretor, respeitando o mapeamento de IDs por tabela e o fuso BRT.
2. Resolve `profiles` (id + user_id + nome + equipe via `team_members`) para 28 corretores ativos.
3. Calcula métricas individuais + benchmarks (time/empresa) numa passada.
4. Gera 1 PDF por corretor em `/mnt/documents/relatorios-maio-2026/` + um `.zip` com todos.
5. **QA obrigatório**: converto páginas de uma amostra de PDFs em imagem e inspeciono (layout, textos cortados, números, gráficos) antes de entregar; corrijo e re-renderizo até ficar limpo.
6. Entrego os artefatos (zip + amostras) para download.

## Fora de escopo

- Nenhuma alteração no app/CRM nem no banco (apenas leitura).
- Sem nova página no CRM (foi escolhido PDF por corretor).

Confirmando: gero os 28 PDFs + um zip, com benchmark de time e empresa, textos de insight por regras. Quando aprovar, executo.