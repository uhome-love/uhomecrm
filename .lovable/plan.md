## Fase 0 — Investigação read-only da página Performance (v3)

Objetivo: rodar apenas SELECTs no banco de produção para validar 10 premissas antes de qualquer mudança. Nada de migration, edge function, deploy ou edição de código.

### Ferramentas
- `supabase--read_query` para todos os SELECTs.
- `code--view` / `rg` só para os arquivos citados nos itens 6, 9 e 10.
- Zero escrita.

### Regras globais
- **M1 — BRT em todo corte de mês fechado.** "Julho/2026", "Junho/2026" viram `>= '2026-07-01' AND < '2026-08-01'` sobre `(coluna AT TIME ZONE 'America/Sao_Paulo')::date`. Janelas relativas (`now() - interval 'N days'`) ficam como estão.
- Uso `norm_empreendimento()` e `empreendimento_aliases.alias_norm` diretamente. Sem `unaccent`.

### Itens

**1. UUIDs de stage do ranking**
- Dump de `pipeline_stages`; marca os 9 UUIDs do ranking; para os ausentes, `COUNT(*)` de leads ativos por `stage_id` (90d).
- Leitura de `useRankingsData.ts` para confirmar as constantes.

**2. Cobertura canônica (com M5)**
- Totais e últimos 90d.
- **M5** — cobertura mensal de `empreendimento_canonico_id` nos últimos 12 meses (BRT).
- Top 20 textos sem canônico.

**3. Empreendimento em `visitas` e `negocios` — taxonomia exaustiva (C3 corrigido)**
Últimos 180d. Para **cada** tabela, primeiro segmento o universo em blocos **mutuamente exclusivos** cuja soma **tem que bater com o total** — se não bater, tem caso escondido e reporto.

Para `visitas` (denominador = total 180d):
- A. `pipeline_lead_id IS NULL` — sai da base das outras caixas (dimensiona buraco de origem).
- Sobre `pipeline_lead_id NOT NULL`:
  - B. `empreendimento` NULL/vazio na visita.
  - C. `empreendimento` preenchido, **sem match** em `alias_norm`.
  - D. `empreendimento` preenchido, **com match**, mas **lead sem `empreendimento_canonico_id`** — a comparação não seria decidível (NULL <> X é UNKNOWN, sumiria da conta se eu não isolasse).
  - E. Preenchido, com match, canônico **igual** ao do lead.
  - F. Preenchido, com match, canônico **diferente** do lead.
- Consulta de verificação: `A + B + C + D + E + F` deve igualar o total 180d. Reporto a diferença se houver.

Para `negocios`: mesma partição, trocando `pipeline_lead_id` pelo caminho equivalente (`pipeline_lead_id` da própria `negocios`).

Top textos distintos sem match, por tabela.

**4. Presença na roleta**
- `janela, status` distintos.
- Julho/2026 (BRT) por corretor: aprovados totais e dias distintos aprovados.
- `feriados` de 2026.
- **Extra**: `COUNT(DISTINCT data)` de julho/2026 com ao menos 1 credenciamento aprovado (teto do denominador).

**5. Oferta ativa — overlap real (C1 corrigido + aviso de inflação por telefone)**
Confirmado no schema: `oferta_ativa_tentativas.corretor_id = auth.users.id`, `.lead_id → oferta_ativa_leads.id`; `oferta_ativa_ligacoes.corretor_id = profiles.id`, `.pipeline_lead_id → pipeline_leads.id`; `oferta_ativa_leads` **não tem** `pipeline_lead_id` — única ponte é `telefone_normalizado`.

Consultas:
- Volume mensal (6 meses BRT) em cada tabela.
- `resultado, COUNT(*)` em cada tabela.
- **Cobertura da ponte**: quantos `oferta_ativa_leads` com tentativa nos últimos 90d têm algum `pipeline_leads` por telefone, e quantos não.
- **Diagnóstico de inflação por telefone (novo)**: distribuição de `COUNT(*)` de `pipeline_leads` por `telefone_normalizado` (buckets 1 / 2 / 3+), com quebra ativos vs descartados. Confirma que o índice único ignora descartados de propósito e que o join naive multiplicaria linhas.
- **Overlap sem inflar (nova regra)**: antes de cruzar, escolho **um** `pipeline_leads` por `telefone_normalizado` via CTE — preferência (i) não-descartado; (ii) desempate por `created_at DESC`; (iii) `id DESC`. Sobre essa CTE:
  - join `oferta_ativa_tentativas t → oferta_ativa_leads oal (t.lead_id) → cte_pl (telefone)`;
  - `oferta_ativa_ligacoes lg ON lg.pipeline_lead_id = cte_pl.id`;
  - mapear corretor: `t.corretor_id (auth) → profiles.user_id → profiles.id = lg.corretor_id`;
  - agrupar por `(cte_pl.id, profile_id, date(t.created_at AT TIME ZONE BRT))`; usar `COUNT(DISTINCT t.id)` e `COUNT(DISTINCT lg.id)` para blindar contra qualquer multiplicidade residual.
- Reporto também "leads de oferta ativa com múltiplos pipeline_leads ativos por telefone" — se aparecer, é achado de outra ordem.

**6. View vs UI — arquivo correto (C2 corrigido + aviso team_members)**
- Agregado julho/2026 (BRT) de `v_corretor_empreendimento_performance`: leads, visitas realizadas, no-shows, vendas, VGV. Confirmo antes que a view existe.
- **C2** — leio `RankingEquipe.tsx` → `RankingVisaoGeral.tsx` → `useRankingsData.ts` (`fetchAllRankings`) para descobrir a fonte real da aba Visão Geral e reproduzo o cálculo em SQL para o mesmo período.
- **Aviso registrado no relatório antes de rodar**: `fetchAllRankings` restringe a corretores com vínculo ativo em `team_members`; a view não filtra. **Divergência de população nesse eixo é causa conhecida — não é achado.** Só reporto como achado divergência **de métrica** entre a mesma população (interseção com `team_members` ativo).

**7. Qual id cada tabela usa — contar, não amostrar (M3)**
Para cada `(tabela, coluna)` abaixo, `COUNT(*)` total, casa com `profiles.id`, casa com `profiles.user_id`:
- `visitas.corretor_id`
- `oferta_ativa_ligacoes.corretor_id`
- `roleta_credenciamentos.auth_user_id`
- `oferta_ativa_tentativas.corretor_id` (confirma premissa que fecha o C1).

**8. Coorte junho/2026 (M4)**
- `pipeline_historico`: data mínima e volume mensal (12m BRT); **removida** a checagem inócua de `stage_novo_id`.
- Coorte de leads criados em junho/2026 (BRT): quantos têm ≥1 registro em `pipeline_historico`, `visitas`, `negocios`.
- **M4 — janela de maturação**: mediana de dias entre `pipeline_leads.created_at` e a 1ª `visitas.created_at`; e entre `pipeline_leads.created_at` e o `data_assinatura` da 1ª venda (`fase='vendido'`).

**9. Primeiro contato / SLA 48h (M2)**
- Colunas de `pipeline_leads` que casem com "contato"/"first"/"primeira" via `information_schema`.
- Lista distinta de `pipeline_atividades.tipo` (90d) para separar humano vs automático.
- **M2 — duas medianas** para leads criados em junho/2026 (BRT): (a) com todos os tipos; (b) só humanos (excluindo `nurturing_sequencia` e demais automáticos, com a classificação explicitada antes de rodar). Reporto ambas + % com alguma atividade em cada corte.

**10. Motivo de no-show**
- Contagens de `cancel_reason` preenchido (180d).
- `information_schema` + `pg_constraint` sobre `cancel_reason`.
- Leitura de `VisitaResultadoDialog.tsx` + `visitaResultadoRouting.ts`.
- Distribuição de `resultado_visita` em `status='no_show'` (180d) para ver se o motivo escapou para outro campo.

### Entregável
Uma seção por item (1–10) com tabelas cruas e, quando algo divergir do esperado, uma frase apontando o quê. Nos itens 3 e 5, incluo explicitamente a linha de conferência (soma das caixas = total, ou "sem inflação por telefone"). Sem correção proposta — Fase 1 vem depois.

### Fora de escopo
Qualquer alteração de schema, código, edge function, RLS, view ou deploy. Se algum SELECT falhar por permissão/ausência de objeto, reporto no item e sigo com equivalente SQL puro, sem criar nada.
