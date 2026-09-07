# Auditoria somente-leitura — Uhome Sales CRM (07/09/2026)

Base: registro de telas (`pageRegistry`), 48.044 acessos reais de 38 usuários nos últimos 45 dias (`page_views`), contagens de tabelas, agendamentos (`cron.job`) e 120 funções de backend. Nada foi alterado.

---

## 1. O que a operação realmente usa

Só 5 telas concentram ~70% de todo o uso:

| Tela | Acessos | Pessoas | Quem |
|---|---|---|---|
| Pipeline | 13.569 | 36 | todos |
| Minha Rotina (corretor) | 9.430 | 36 | todos |
| Agenda/Tarefas | 6.093 | 35 | todos |
| Visitas | 2.494 | 36 | todos |
| Aceite de leads | 2.263 | 31 | corretor/gestor |

Uso médio: Dashboard CEO (2.010, 3 pessoas), Oferta Ativa por telefone (1.298, 30 pessoas), Mutirão ao Vivo (680, 30 pessoas), Imóveis (580), LIA Hub (406, 1 pessoa), Academia (313+222), Materiais (300), Leads Estagnados (269), Vendas (265), Presença da Roleta (263), Reengajamento (252, 1 pessoa), Foco Corretores (213), HOMI (211, 24 pessoas mas só 211 acessos = curiosidade, não rotina).

**Uso residual (menos de 60 acessos em 45 dias):** Simulador (47), Base Única (49), Intermediação (52), Vitrines (34), Candidatos do gerente (38), Dashboard Diretora (42, 2 pessoas), RH (26), Onboarding (14), Analytics de Materiais (3), Templates de Comunicação (4), HOMI Gerente (4), Raio-X do Corretor (20), Central de Marketing (18).

**Zero acesso em 45 dias (telas vivas no menu):** Auditoria, Central do Gerente (checkpoint), Disparador WhatsApp, Import Brevo, Integração Jetimob, Marketplace, Performance (legado), Relatório Semanal, Relatórios 1:1.

Diagnóstico: o CRM tem ~90 telas para uma operação que vive em 5. O menu está pagando o custo de manutenção e de confusão de 30+ telas mortas ou quase.

## 2. Módulos legados confirmados pelos dados

- **Checkpoint do gerente**: `checkpoint_diario` tem 0 linhas, mas existem também `checkpoints` (332) e `checkpoint_lines` (767). Três tabelas, uma tela sem nenhum acesso. Ritual morreu, o código ficou.
- **Relatórios 1:1**: duas tabelas (`one_on_one_reports` 396, último 14/06; `relatorios_1_1` 21). Tela com zero acesso; cron `auto-one-on-one-weekly` continua rodando toda semana gerando relatório que ninguém abre.
- **Marketplace**: 60 itens, último 29/03. Morto.
- **Chamadas de voz por IA**: `ai_calls` 29 registros, último 16/03; `voice_campaigns` vazia.
- **Indicações**: `referrals` 1 registro desde março.
- **E-mail marketing**: 3 campanhas, última 07/04 — mas o cron `mailgun-batch-send` roda a cada 5 minutos.
- **Coaching/Conquistas**: `coaching_sessions` 4 (março), `corretor_conquistas` 0 — gamificação existe na tela, não nos dados.
- **Pós-venda/financeiro**: `pagadoria_solicitacoes` 0, `pipeline_comissoes` 0, `venda_comissoes` 6, `intermediacoes` 29. É um módulo de intenção, não de operação.
- **PDN**: 126 lançamentos, último acesso 15/08, 5 pessoas. Em desuso desde meados de agosto.

## 3. Duplicidades reais de fluxo

1. **Tarefas em 3 tabelas**: `pipeline_tarefas` (53.457) é a real; `lead_tasks` (352) e `negocios_tarefas` (150) são resíduos que ainda recebem escrita e podem gerar tarefa invisível para o corretor.
2. **Atividades em 2 tabelas**: `pipeline_atividades` (61.946) vs `negocios_atividades` (983) — foi exatamente a origem do bug "negócio sem atividade" já corrigido no frontend; a raiz (duas fontes) continua.
3. **Negócios × Pipeline**: `negocios` (343) coexiste com o pipeline como lente. Quem fecha venda escreve nos dois mundos; `/pipeline-negocios` está desativado mas o modelo de dados não foi unificado.
4. **Cadências em 3 mecanismos**: `nurturing_cadencias` (10), `cadencia_sem_contato_passos` (7), `pipeline_sequencias` (0) e `pipeline_playbooks` (3). Nenhum é claramente o oficial; três estão praticamente vazios.
5. **Reengajamento × Oferta Ativa × Base Única**: `base_leads` (37.137, congelada em 01/08), `oferta_ativa_leads` (28.160), `reengajamento_dispatch_queue` (63.965). Três filas frias sobre a mesma população, com regras de higiene diferentes — é o maior risco de falar duas vezes com a mesma pessoa.
6. **Performance/Relatórios**: Central de Relatórios, Raio-X do Time, Raio-X do Corretor, Relatório Semanal, Performance legado, Central de Marketing, Relatórios 1:1 — sete portas para o mesmo assunto, seis quase sem uso.
7. **Assistentes de IA**: HOMI (7 funções de backend por persona) + LIA (11 funções) + `uhome-ia-core` + `recovery-agent` + `ceo-advisor`. HOMI tem 174 conversas no total; LIA tem 3.464 e cresce diariamente. Uma IA está viva, a outra é vitrine.

## 4. Fricções visuais/UX por papel

- **Corretor**: o dia inteiro é Pipeline + Agenda + Aceite + Visitas, mas o menu entrega dezenas de itens irrelevantes (Marketplace, Simulador, Vitrines, Onboarding, Intermediação). O modal do lead concentra ações mas é servido por arquivos de 1.200–1.400 linhas (`PipelineStageTransitionPopup` 1.397, `CompletionForm` 1.311, `PipelineLeadDetail` 1.189), o que se traduz em lentidão percebida ao abrir e em regras de etapa difíceis de prever.
- **Gerente**: tem Cockpit (309 acessos), Central do Gerente (0), PDN (parado), Relatórios 1:1 (0), Raio-X do Time (1 acesso). Na prática o gerente usa Cockpit + Leads Estagnados + Presença. O resto é ruído que sugere um ritual de gestão que não acontece.
- **Diretora**: 42 acessos em 45 dias em dashboard próprio. Ou o painel não responde às perguntas dela, ou ela usa o do CEO.
- **CEO**: 2.010 acessos concentrados em uma tela de 1.152 linhas que mistura funil, visitas, VGV e filas. É a tela mais carregada de conceito do sistema e a que mais gerou correções de semântica nos últimos meses (visitas criadas × realizadas, VGV, produto canônico).

## 5. Riscos de consistência e desperdício ativo

**Crítico — 3 agendamentos chamando funções que não existem mais:**
- `typesense-sync-cron` (a cada 5 min) → `typesense-sync` (função removida)
- `typesense-batch-reindex` (a cada 10 min) → `typesense-admin` (removida)
- `execute-automations-every-5min` → `execute-automations` (removida; a tabela `automations` também não existe mais)

São cerca de 1.000 chamadas HTTP por dia falhando em silêncio, poluindo log e consumindo cota. Os dois primeiros são o rastro da aposentadoria do Typesense.

**Outros pontos:**
- `meta-leads-backfill-1h` roda a cada 15 min (nome não bate com a frequência) e ainda responde pela maior parte dos leads do Meta — o webhook direto continua sendo o caminho não confiável.
- `mailgun-batch-send` e `auto-one-on-one-weekly` sustentam módulos sem uso.
- 6 agendamentos desativados permanecem cadastrados (nutrição, visita-amanhã, reativação de frios) — decisão nunca formalizada.
- `base_leads` congelada em 01/08 enquanto continua sendo a "fonte-mãe" declarada do reengajamento: a fonte oficial está desatualizada há 5 semanas.
- `lead_messages` vazia e `comunicacao_historico` com 9 linhas, apesar de existirem telas de comunicação — histórico de conversa não é confiável fora da LIA.

## 6. Recomendação priorizada

**Fazer agora (baixo risco, ganho imediato)**
1. Desativar os 3 agendamentos órfãos (Typesense ×2, automations). Nada depende deles.
2. Esconder do menu as 9 telas com zero acesso, sem apagar código: Auditoria, Central do Gerente, Disparador WhatsApp, Import Brevo, Integração, Marketplace, Performance legado, Relatório Semanal, Relatórios 1:1.
3. Desligar `auto-one-on-one-weekly` e `mailgun-batch-send` enquanto os módulos estiverem parados.

**Fazer em seguida (precisa de decisão sua)**
4. Escolher uma única porta de Performance e redirecionar as outras seis.
5. Decidir o destino de PDN, Checkpoint e 1:1: ou o ritual volta com dono, ou saem do produto.
6. Unificar atividades e tarefas em uma fonte só (`pipeline_atividades` + `pipeline_tarefas`), com leitura de compatibilidade para as tabelas antigas.

**Fazer com projeto próprio**
7. Uma única fila fria (Base Única como fonte, Oferta Ativa e Reengajamento como consumidores) com higiene compartilhada, e reativar a atualização da base.
8. Quebrar Dashboard CEO e o modal do lead em blocos menores, com definições de métrica visíveis na própria tela.
9. Decidir entre HOMI e LIA como assistente único, ou dar ao HOMI um papel que justifique 22 funções.

**Manter intocado**: Pipeline, Agenda, Aceite, Visitas, Oferta Ativa/Mutirão, Roleta e LIA — é aí que a operação vive.

---

### Nota técnica
Números de uso vêm de `page_views` (45 dias, 62 rotas distintas com acesso contra ~90 registradas). Contagens de tabela e agendamentos foram lidos direto do banco. Nenhuma alteração foi feita; este documento é diagnóstico, não execução. Aprovar este plano significa aprovar apenas o bloco "Fazer agora" — os demais voltam como planos separados.
