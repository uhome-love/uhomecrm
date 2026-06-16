# Gabrielle Diretora + Reorganização de Equipes + Descarte por Produto + Remoção da Equipe Gabrielle

## Parte A — Reorganização das equipes (dados)

### A1. Redistribuição dos corretores (`team_members`: `gerente_id` + `equipe`)
```text
→ Equipe Bruno Schuler: Larissa Barbosa, Matheus Pasin, Halime Maarouf, Luiza Clós, Thalia Pereira
→ Equipe Gabriel Vieira: Flávio Dias, Leo Dorneles, Jéssica França, Thalia de Oliveira
```

### A2. Saída da Taynah Bortoletti
- 116 leads ativos → Descarte (roteados pela Parte C).
- `team_members.status='inativo'`; remover papel `corretor` em `user_roles`; `profiles` inativo.

### A3. Gabrielle vira Diretora
- Equipe dissolvida: nenhum corretor com `gerente_id`=Gabrielle; remove a linha dela como membro.
- Mantém papel `gestor`; remove papel `corretor`.
- 4 leads ativos dela → Descarte (Parte C).
- Metas antigas em `ceo_metas_mensais` (2 registros) zeradas/encerradas.

## Parte B — Visão de Diretora (vê as 2 equipes, sem duplicar corretores)
- Nova tabela `diretoria_equipes (diretor_auth_id, gerente_auth_id)` → Gabrielle → [Bruno, Gabriel] (RLS leitura autenticados, gestão admin; GRANTs).
- Função `resolve_managed_brokers(_gestor uuid)`: time direto + (se diretor) união dos times dirigidos.
- Tornar director-aware: `get_dashboard_gerente_v4_kpis/_dia`, `get_dashboard_gerente`, `is_corretor_in_my_team`, `is_lead_in_my_team`, `get_team_visitas`, `get_team_contacts`, `get_team_oa_ranking`.
- `get_pipeline_equipes_overview`: Gabrielle como nível Diretoria, sem dupla contagem.

## Parte C — Descarte vai para a lista do produto (permanente)
- `normalize_produto(text)`: remove acento/caixa/espaço, corta sufixos de data/campanha, aplica apelidos (CASA TUA→Casa Tua, ATRIO→Átrio - ABF, Alto Lindoia→Alto Lindóia, Terrace - 2026→Terrace…), vazio→`Sem empreendimento`.
- Lista canônica única por produto `"<Produto> - Leads Não Aproveitados"` (reusa/reativa se existir, cria se não). Unifica listas duplicadas do mesmo produto movendo `oferta_ativa_leads` (dedup por telefone) e arquivando as origens; recalcula `total_leads`.
- Reescrever `sweep-descartados`: agrupa por produto normalizado, resolve/cria lista canônica, dedup, insere, arquiva do pipeline, atualiza contagem.
- Lote imediato: rotear os 120 leads (Taynah + Gabrielle) às listas (Casa Tua, Open Bosque, Isla, Átrio - ABF, Orygem, Alto Lindóia, Las Casas, Terrace, Square Garden, Lake Eyre, Connect JW).

## Parte D — Remover "Equipe Gabrielle" de todo o CRM (UI + placar da TV)

O ranking principal já é dinâmico (vem de `team_members`), então some sozinho. Mas há **3 equipes fixas no código** que precisam virar **só Bruno e Gabriel**:

- `src/pages/PlacarDoDia.tsx` (placar da TV): remover a equipe `gabrielle` dos arrays `EQUIPES`/`GERENTES`, do estado `dados`, dos totais e da cor da bolinha — manter Bruno e Gabriel.
- `src/components/ceo/TabEmpresa.tsx`: remover Gabrielle de `GERENTES`.
- `src/components/pipeline/header/PipelineGestorSelect.tsx`: remover Gabrielle de `GERENTES_REAIS` (filtro por gestor do CEO).
- `src/components/pipeline/equipes/gestorTheme.ts`: remover o tema da Gabrielle (gestor) e comentário.
- Texto "3 gerentes (Gabrielle, Bruno, Gabriel)" em `src/pages/HomiAna.tsx` e `supabase/functions/homi-ana/index.ts` → "2 gerentes (Bruno, Gabriel) + Diretora Comercial Gabrielle".

### Preservado de propósito (NÃO é equipe — não mexer)
- `IntermediacaoPage.tsx` / `gerar-intermediacao`: Gabrielle como **credora/sócia** nos contratos de comissão (CPF/percentual) permanece.
- `metaFormIdMap` / `receive-meta-lead`: nomes de formulários de anúncio ("… Vídeo Gabrielle") permanecem.
- Migration `credores_fixos`: percentuais de sócios permanecem.

## Detalhes técnicos
- Etapa Descarte: `stage_id=1dd66c25-3848-4053-9f66-82e902989b4d`.
- DDL (tabela diretoria, funções, patch RPCs) em migrations; operações de dados (reassign, Taynah, metas, unificação/roteamento de listas) via insert tool; respeitar 2 migrations/dia 08–19h BRT. Unificação de listas grandes roda como operação de dados em lotes.
- Sem linhas-espelho em `team_members`.

## Validação
- 9 corretores sob o gerente certo; equipe da Gabrielle vazia em todo lugar (placar da TV mostra só Bruno e Gabriel).
- 120 leads em Descarte roteados às listas de produto corretas.
- Taynah sem papel/perfil inativo; metas zeradas.
- RPC simulada como Gabrielle: dashboard/pipeline somam as duas equipes.
- `sweep-descartados` validado agrupando por produto.

## Ponto de atenção
A unificação física das listas grandes existentes (ex.: Casa Tua ~2.877+263) é volumosa e pouco reversível — recomendo unificar primeiro os produtos do lote e validar, depois estender.
