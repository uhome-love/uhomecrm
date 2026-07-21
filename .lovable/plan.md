
# Foco Corretores + Mapeador de Campanhas Meta

## Fundamentação (histórico 90 dias, dados do CRM)

**Oscilação de corretores**
- 28 de 30 corretores rodaram em 3–4 segmentos nos últimos 90d; 16 nos 4.
- Concorrência interna diária: S3 Alto Padrão 11 corretores/dia (pico 23), S1 Moradia 8,1, S2 Investimento 6,8, S4 MCMV 5,6.
- Volume/produção pulverizados. Os únicos com produção consistente (Matheus, Jéssica) oscilaram menos.

**Fragmentação de campanhas Meta**
- Casa Tua tem **18 campanhas / 54 conjuntos / 50 anúncios** distintos no CRM.
- Terrace, Shift, Átrio, Vivid, Flow, Casa Menino Deus, Connect JW, Lake Baikal, Avulso somam dezenas de variantes.
- **790 leads (21% dos 90d) caem em "Outros / não classificado"**.

**Rastreabilidade mídia → venda**
- 35 vendas em 90d; só 7 têm `lead_id` no negócio, e apenas 4 destas com campanha preenchida. Mídia (~R$ 5–7k/mês) hoje decidida sem custo por venda por campanha.

## Objetivo
1. Consolidar campanhas/conjuntos/anúncios Meta em empreendimento canônico.
2. CEO/Gestor define, por corretor, quais empreendimentos ele atende.
3. Credenciamento vira "Marcar Presença" + aprovação CEO — corretor recebe só leads dos empreendimentos alocados.
4. Visibilidade real: performance por empreendimento (acumulada por corretor) e por campanha (para decidir mídia).

## Fases

### Fase 1 — Empreendimentos canônicos + Mapeador Meta
- Tabela `empreendimentos_canonicos` (nome, segmento_id → `roleta_segmentos`, ativo, ordem).
- Tabela `empreendimento_aliases` (alias case-insensitive, empreendimento_id, tipo `campanha|conjunto|anuncio|formulario|empreendimento_texto|origem_detalhe`).
- Coluna `pipeline_leads.empreendimento_canonico_id UUID` + trigger no INSERT/UPDATE resolvendo cascata: campanha → conjunto → anúncio → formulário → empreendimento_texto → origem_detalhe.
- Backfill 180d.
- Aba **"Mapeamento Meta"** na Roleta (CEO): lista strings distintas sem alias dos últimos 30d com contagem, dropdown do canônico, botão "Vincular" (grava alias + reprocessa leads via RPC).
- Seed: canônicos iniciais + aliases das 18 variantes de Casa Tua e afins já observados nos 90d.

### Fase 2 — Alocação por corretor
- Tabela `corretor_alocacao`: `user_id` PK, `empreendimentos UUID[]`, `atualizado_por`, `atualizado_em`, `observacao`.
- RPC `set_corretor_alocacao(user_id, empreendimentos[])` restrita a admin/gestor/ceo.
- Segmento derivado dos empreendimentos.

### Fase 3 — Página `/foco-corretores` com 2 abas
**Aba "Alocação"** (default)
- 1 linha por corretor: avatar + nome + equipe · chips de empreendimentos alocados · "+ Empreendimento" (multi-select canônicos ativos) · resumo `Leads 30d · Vis. realiz. · Vendas 30d` · alerta vermelho quando sem alocação.
- Admin/CEO/diretor veem todo mundo agrupado por equipe; gestor só o seu time.

**Aba "Dados" (nova, esta requisição)**
- **Matriz Corretor × Empreendimento** — uma linha por corretor, uma coluna por empreendimento canônico ativo, mais colunas de total.
- Cada célula: `Leads · Vis. Agendadas · Vis. Realizadas · No-show · Vendas` (formato compacto com tooltip detalhado).
- Filtros no topo: período (7d / 30d / 90d / mês atual / customizado — default 30d), equipe (CEO/diretor), empreendimento específico.
- Linha "Total" ao final consolidando por empreendimento; coluna "Total" no fim de cada corretor.
- Heatmap opcional na coluna de conversão (Lead→Visita e Visita→Realizada) pra saltar aos olhos quem converte no produto.
- Export CSV do que estiver filtrado.
- Fonte: `pipeline_leads` (leads recebidos) + `visitas` (agendada/realizada/no-show) + `negocios` (vendas), agrupados por `empreendimento_canonico_id` e `corretor_id`. **Números acumulam sozinhos** assim que o alias novo for mapeado, sem tabela intermediária.

### Fase 4 — Credenciamento simplificado + roleta filtrada
- `RoletaCorretorView.tsx`: substitui selects de segmento por botão único **"Marcar Presença"**, com read-only dos empreendimentos que vai receber.
- Fluxo: presença → `pendente` → CEO aprova → `aprovado`.
- Sem alocação = botão desabilitado com "Peça ao seu gestor pra definir seus produtos".
- Função de distribuição filtra `alocacao.empreendimentos @> ARRAY[lead.empreendimento_canonico_id]` + turno.
- Lead sem canônico ou sem corretor ativo naquele produto → `pendente_distribuicao` (Fila do CEO) com motivo `sem_match_empreendimento`.

### Fase 5 — Fila do CEO: sem match + repasse manual
- Sub-seção "Sem match de empreendimento" na Fila do CEO, com botão "Repassar" (popover de corretores ativos hoje).
- RPC `repassar_lead_manual(lead_id, corretor_id)` registra em `distribuicao_historico` com origem `repasse_manual_ceo`.

### Fase 6 — Painel financeiro (dashboard CEO)
- Card **Performance por Empreendimento × Campanha × Conjunto × Anúncio** em `/ceo`.
- Colunas: Leads · Visitas · Vendas · VGV · Conv. Lead→Visita · Conv. Lead→Venda; drilldown por conjunto/anúncio; filtro de período.

## Escopo NÃO incluído
- Não puxa spend automático da Graph API do Meta (etapa futura).
- Não muda regras de presença/roleta noturna nem regime seg-sex/sáb/dom.
- Não cria alocação inicial automática — CEO/gestor define.

## Detalhes técnicos
- Migrations (≤2/dia, 08–19h BRT), na ordem: (a) `empreendimentos_canonicos` + `empreendimento_aliases` + GRANTs + RLS + seed; (b) coluna + trigger + backfill 180d em `pipeline_leads`; (c) `corretor_alocacao` + RPC `set_corretor_alocacao` + `repassar_lead_manual`; (d) função de distribuição.
- View `v_corretor_empreendimento_performance` (agregada por `corretor_id`, `empreendimento_canonico_id`, faixa temporal) pra alimentar a aba Dados sem repetir SQL no frontend.
- Sem `_v2`/`_novo`. Arquivos ≤500 linhas: `MapeamentoMetaTab.tsx`, `AliasVincularDialog.tsx`, `FocoCorretoresPage.tsx`, `FocoAlocacaoTab.tsx`, `FocoDadosTab.tsx`, `CorretorFocoRow.tsx`, `EmpreendimentoMultiSelect.tsx`, `FilaCeoSemMatchList.tsx`, `PerformanceEmpreendimentoCampanhaCard.tsx`.
- BRT em toda janela temporal.

## Ordem de execução (validando no preview a cada fase)
1. Fase 1 — canônicos + mapeador Meta + backfill.
2. Fase 2 + 3 (Alocação) — CEO/gestor define foco.
3. Fase 3 (Dados) — matriz por corretor × empreendimento.
4. Fase 4 — roleta filtrada.
5. Fase 5 — repasse manual.
6. Fase 6 — painel Empreendimento × Campanha.

## Após aprovação
Mando texto objetivo e curto (WhatsApp) explicando o novo fluxo pro time de corretores validarem antes do rollout.
