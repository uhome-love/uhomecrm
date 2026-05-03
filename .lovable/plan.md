## Objetivo

Refatorar completamente a página `/ranking` (`src/pages/RankingEquipe.tsx`), removendo as 5 abas atuais e substituindo por **4 novos rankings** com filtros unificados (equipe, corretor, período: dia/semana/mês/personalizado).

## Estrutura nova da página

```text
┌─ PageHeader: "Rankings" + tabs período (Dia | Semana | Mês | Personalizado)
├─ Linha de filtros: [Equipe ▾] [Navegação semana/mês ◀ ▶] [DateRangePicker se custom]
├─ Tabs rankings: [Presenças & Leads] [Pipeline Leads] [Visitas] [Pipeline Negócios]
└─ Conteúdo do ranking ativo (tabela com todos corretores + medalhas top 3)
```

Visual: cards com `bg-card`, bordas `border-border`, medalhas 🥇🥈🥉 nos top 3, linhas com avatar + nome + métricas + score destacado em accent indigo. Responsivo, mesma estética do `CeoRankings.tsx` / `RankingGestaoLeads.tsx` (já consistente com o tema do CRM).

## Os 4 rankings

### 1. Ranking Presenças & Leads
**Fonte:** `roleta_credenciamentos` (status='aprovado') + `pipeline_leads` (created_at).

Colunas por corretor:
- Presenças roleta diurna (janela = `manha` ou `tarde` ou `dia_todo`, dia útil)
- Presenças roleta noturna (janela = `noturna`)
- Presenças roleta domingo (data = domingo)
- Leads recebidos no período (count `pipeline_leads` onde `corretor_id` = user no período)

**Score:** quem tem mais **presenças totais** combinadas com leads recebidos. Fórmula:
`score = (presenças_diurna + presenças_noturna*1.2 + presenças_domingo*1.5) * 10 + leads_recebidos`
Ordenação por score desc.

### 2. Ranking Pipeline de Leads
**Fonte:** `pipeline_leads` + `pipeline_stages`.

Colunas por corretor:
- Leads ativos (não arquivados, não em stage descarte/inativo)
- Leads por etapa (Novo / Contato / Qualificado / Visita Marcada — chips compactos)
- Média de leads desatualizados no mês (sem `ultima_acao_at` em ≥48h, calculado como média de snapshots diários ou contagem atual no período)
- Descartes (count com motivo_descarte preenchido no período)
- Aproveitamento entrada→negócio (%): `count(negocios criados a partir de pipeline_leads do corretor) / count(leads recebidos)`

**Score:** premia quem converte e mantém o CRM atualizado:
`score = (aproveitamento% * 5) + (leads_ativos * 2) - (desatualizados_média * 3) - (descartes * 1)`
Ordena desc.

### 3. Ranking Visitas
**Fonte:** `visitas` no período (filtra por `data_visita`).

Colunas por corretor:
- Visitas criadas (count total)
- Visitas realizadas (status='realizada')
- No-show (status='no_show')

**Score:** `criadas * 1 + realizadas * 2`. Ordena desc.

### 4. Ranking Pipeline de Negócios
**Fonte:** `negocios` no período (`created_at` para criados; `data_assinatura` para assinados; `fase`/`status` para caídos).

Colunas por corretor:
- Negócios criados (count)
- Negócios caídos (renomear "distratos" → **"Negócios caídos"**: `status = 'distrato'` ou fase equivalente)
- Negócios assinados (`fase = 'vendido'` e `data_assinatura` no período)
- VGV total assinado (sum `vgv_final` dos assinados)

**Score / ordenação:** por **VGV assinado** desc.

## Filtros

Componente reutilizado/estilo do `ReportFilters.tsx`:
- Período: chips Dia / Semana / Mês / Personalizado (já existe na página atual)
- Equipe (gerente): dropdown carregado de `team_members` (admin vê todas; gestor vê só a sua, fixa)
- Corretor opcional: dropdown filtrado pela equipe escolhida (destaca a linha)
- Navegação ◀ ▶ semana/mês mantida

Filtros aplicados a TODAS as 4 abas via contexto local (hook `useRankingFilters`).

## Arquivos

**Refatorar:**
- `src/pages/RankingEquipe.tsx` — reescrever do zero, mantendo somente PageHeader e estrutura de período.

**Criar:**
- `src/hooks/useRankingsData.ts` — hook único com 4 funções/queries que recebem `{ dateRange, equipeId, corretorId }` e retornam dados agregados por corretor. Usa Supabase + agregação client-side. Resolve nomes via `profiles`.
- `src/components/ranking/v2/RankingPresencasLeads.tsx`
- `src/components/ranking/v2/RankingPipelineLeads.tsx`
- `src/components/ranking/v2/RankingVisitas.tsx`
- `src/components/ranking/v2/RankingNegocios.tsx`
- `src/components/ranking/v2/RankingTable.tsx` — tabela genérica com colunas configuráveis, medalhas top 3, linha "você" destacada, loading/empty states.
- `src/components/ranking/v2/RankingFilters.tsx` — barra de filtros (equipe + corretor) acima das tabs.

**Remover (não mais usados pela página):**
- Imports de `RankingOfertaAtivaTab`, `RankingVGVTab`, `RankingGestaoLeadsTab`, `RankingGeralTab`, `RankingEficienciaTab`, `RankingExplanation`, `RankingStreaksBadges` da página `RankingEquipe.tsx`. Os arquivos componentes ficam no repo (podem ser usados em outros lugares — a verificar antes de deletar; se não usados, deleto).

## Detalhes técnicos

- **Timezone BRT** ao construir intervalos (regra do projeto). Reaproveitar lógica de `dateRange` já existente.
- **Queries**: paralelizar via `Promise.all`. Limitar a corretores com `cargo='corretor'` em `profiles` (e filtrar por `team_members` quando equipe selecionada).
- **Equipe do gestor**: usar `useUserRole` — se `gestor`, força equipeId = user.id e oculta dropdown.
- **Performance**: cada aba só dispara sua query quando ativa (lazy). Cache em memória por chave de filtros.
- **Estilo**: classes do design system (`bg-card`, `text-foreground`, `border-border`, accents `text-primary`); medalhas e barras de progresso para a coluna principal de cada ranking.

## Validação

- Admin vê todos os corretores em todas as abas.
- Gestor vê apenas seu time.
- Corretor vê o ranking completo da própria equipe, com sua linha destacada.
- Trocar período recalcula tudo; navegar ◀ ▶ semana/mês funciona.
