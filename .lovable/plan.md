## Objetivo
Unificar leads e negócios num único **Pipeline** (renomear "Pipeline de Leads" → "Pipeline"), gerir o status do negócio dentro do próprio pipeline, celebrar o ganho, tratar a queda (descartar/inativar), unificar a visita, remover a aba Inteligência (inútil hoje) e entregar um **PDN** para o gestor que substitui a planilha Google com vantagem. Tudo 100% funcional, validado ponta a ponta, organizado e fácil de gerir. Referência: `mockup-corretor.png` e `mockup-pdn.png`.

## Renomear "Pipeline de Leads" → "Pipeline" (Fase 0)
- Registry já usa "Pipeline". Padronizar todo texto visível restante: `GlobalSearch`, `SectionPipelineLeads`, `central-v2/sections`, toasts (`MeusNegocios`, `AproveitadosPanel`, `BuscaLeads`), `V4QuickActions`, `RankingEquipe`, `FaseTransitionModal`, `NegocioDetailModal`. Manter rotas `/pipeline` e `/pipeline-leads` (alias).

## Remover a aba "Inteligência" (Fase 0.5)
- Hoje é um view-mode em `PipelineHeader` (corretor, gestor e CEO) que renderiza dashboard de fluxo/radar no `PipelineKanban` — não é usado por ninguém.
- Remover o item `inteligencia` das listas de tabs (todos os papéis), o branch de render no `PipelineKanban` e limpar os componentes órfãos (`PipelineFlowDashboard`/`OpportunityRadar`) se não usados em outro lugar. Ajustar default de `activeTab` para `kanban`.
- **Substituto (opcional, futuro):** um "Meu Desempenho" enxuto para o corretor (leads ativos, visitas do mês, negócios em andamento/VGV, conversão) — só se aprovado; não recriar o dashboard atual que não funciona.

## Variáveis do negócio (tudo entra no acompanhamento)
Identidade: `nome_cliente`, `telefone`, `empreendimento`, `unidade`, `imovel_interesse`, `origem`, `pipeline_lead_id`. Fase/status: `fase`, `status`, `fase_changed_at`. Proposta: `proposta_imovel/valor/situacao`. Negociação: `negociacao_situacao/contra_proposta/pendencia`, `objecao_cliente`. Documentação: `documentacao_situacao`, `data_assinatura`. Valores: `vgv_estimado`, `vgv_final` (fallback final→estimado). Queda: `motivo_queda`. Pessoas: `corretor_id` (profiles.id), `gerente_id`, `auth_user_id`, `equipe_gerente_auth_id`, `requer_aprovacao_ceo`. Relacionados: `negocios_tarefas`, `negocios_atividades`.

## Fase 1 — Aba "Negócio" no drawer do lead + gestão de status
1. Aba **"Negócio"** em `PipelineLeadDetail` (hoje: info/histórico/tarefas/visitas), visível quando há negócio vinculado; reusa lógica do `NegocioDetailModal` embutida (regra "Tudo no Lead").
2. Barra de fases clicável: Novo Negócio → Proposta → Em Negociação → Contrato Gerado → Ganho/Assinado; troca abre `FaseTransitionModal`.
3. Edição inline por seção (proposta, negociação, documentação) + observações + tarefas/atividades.

## Fase 2 — Lente "Leads ⇄ ◆ Negócios" no board
- Toggle no `PipelineHeader` (estado por usuário). Lente Leads: card normal + marca discreta `◆ Negócio · VGV · fase`. Lente Negócios: só negócios ativos, card com fase, VGV, próxima ação e aging (verde ≤3d / âmbar 4–7d / vermelho +7d ou sem ação) + tira-resumo. Consolidar `NegocioCriadoColumn` com a lente.

## Fase 3 — Ganho + celebração
- Fase `vendido` como **"Ganho / Assinado"** (selo verde). Ao ganhar: grava `data_assinatura`, mantém regra VGV assinado, dispara `VendaCelebration` (via realtime), garantindo gatilho pelo drawer e pelo board.

## Fase 4 — Queda (descartar ou inativar)
- Ação "Negócio caiu" → modal pede `motivo_queda` + destino via `buildMotivoDescarte`: Descartar (reengajável), Inativar (definitivo), Voltar ao Pipeline. Caídos na aba "Negócios caídos" com motivo e data.

## Fase 5 — Visita unificada
- Em `AgendaVisitas`: remover `VisitaTypeSelector` e `ReuniaoNegocioForm`; agendar abre direto o formulário único de Visita. `tipo_visita` opcional/derivado. Registros antigos preservados.

## Fase 6 — PDN do gestor (planilha Google, só que melhor)
Gestores usam planilha manual por mês (nome, data, empreendimento, **construtora**, VGV, status, observação), separando Negócios / Gerados / Assinados. O CRM atual foi considerado difícil de enxergar. O PDN deve ser tão simples quanto a planilha, mas visual e integrado.
1. **Vista por mês:** seletor de mês (usa `pdn_entries.mes`); tabela densa editável inline, familiar como Excel.
2. **Colunas enxutas (iguais à planilha):** Nome · Data · Empreendimento · Construtora · VGV · Status · Observação. Extras (corretor, equipe, próxima ação, dias parado) colapsáveis. Migração pontual: coluna `construtora` em `pdn_entries` (+ GRANT).
3. **Agrupamento por status:** Negócios (andamento) · Gerados (contrato) · Assinados, cada grupo com subtotal de VGV e contagem, total do mês no topo.
4. **Edição inline:** status (dropdown), VGV (máscara), data (picker), observação (texto); adicionar/ordenar linhas manuais; salvamento otimista.
5. **Integração automática:** negócios do pipeline populam o PDN (nome, empreendimento, VGV, status derivado da fase, corretor, data), sem digitação dupla, ainda editável manualmente.
6. **Camada visual:** cartões de resumo (VGV total, assinados, gerados, andamento, forecast ponderado = VGV × prob. por fase, meta + gap), linhas em risco destacadas, filtros rápidos (equipe, corretor, em risco, fecha este mês). Escopo por `resolve_managed_brokers`; admin vê tudo.
7. **Exportar** o mês em PDF/planilha; comparativo mês atual × anterior.

## Ideias extras
- Alerta HOMI de negócio parado (X dias sem próxima ação) via `homi_alerts`.
- Modo Foco inclui negócios parados (hoje ignora `negocio_id`).
- Badge de contagem (negócios ativos / em risco) no header.
- Registro automático de atividade em `negocios_atividades` a cada mudança de fase.

## Validação ponta a ponta (antes de declarar 100%)
- Build + typecheck limpos e `vitest run` (inclui regressão id-mapping).
- Playwright headless em `localhost:8080` como corretor: Pipeline (sem aba Inteligência) → alternar lente → abrir lead com negócio → mudar fase (proposta→negociação→ganho) → ver celebração → derrubar negócio → agendar visita única. Como gestor: PDN → trocar mês → editar linha inline → conferir subtotais e integração. Screenshots por passo.
- Conferir no banco após cada ação; console/network sem erros; realtime atualizando o board.

## Detalhes técnicos / qualidade
- Única migração: `construtora` em `pdn_entries` (+ GRANT). Usa `negocios`, `negocios_tarefas`, `negocios_atividades`, `pdn_entries`.
- IDs: `negocios.corretor_id = profiles.id`; joins de usuário via `auth_user_id`.
- Design tokens (Indigo #4969FF, roxo p/ negócio, radius 12px); sem cores hardcoded.
- Decompor arquivos grandes ao mexer (`MeusNegocios.tsx`, `NegocioDetailModal.tsx`, `PipelineLeadDetail.tsx`, `PipelineHeader.tsx`).

## Sequência
Fase 0 (rename) → 0.5 (remover Inteligência) → 1 (aba Negócio) → 2 (lente) → 3 (ganho) → 4 (queda) → 5 (visita única) → 6 (PDN). Validação ponta a ponta ao fim de cada fase.