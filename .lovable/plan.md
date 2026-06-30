# Aviso de cadência no modal + alerta de pré-estagnação para o corretor

Duas melhorias para o corretor: (1) um card de orientação dentro do modal do lead na etapa **Sem Contato** mostrando "tentativa atual + o que fazer agora", e (2) um aviso no dashboard do corretor com os leads prestes a estagnar, mais um filtro rápido no pipeline.

## Parte 1 — Card "Cadência Sem Contato" no modal do lead

Hoje a etapa Sem Contato só mostra um badge automático (📲) no card do pipeline. Dentro do modal não há orientação. Os 7 passos já existem na tabela `cadencia_sem_contato_passos` (com `texto_app`, `acao`, `canal`, `espera_minutos`) e o estado por lead está em `lead_cadencia_sem_contato` (`tentativa_atual`, `proxima_em`, `status`).

**Novo componente `src/components/pipeline/CadenciaSemContatoCard.tsx`** (read-only):
- Renderiza **apenas quando `stageTipo === "sem_contato"`**.
- Busca a linha de `lead_cadencia_sem_contato` do lead + os passos de `cadencia_sem_contato_passos` (RLS já permite corretor dono / gestor / admin).
- Mostra:
  - **Tentativa atual: N / 7** com barra de progresso.
  - **Ação de agora**: título da `acao` do passo atual + texto orientativo (`texto_app`), com ícone do canal (ligação / WhatsApp / ambos). Ex.: "Tentativa 3 — Insistir no contato: tente de novo por ligação ou WhatsApp."
  - **Próximo passo**: quando vence (`proxima_em`) em linguagem relativa BRT ("vence em 4h", "atrasado há 2h") usando os helpers de `@/lib/brtTime`.
  - **Aviso de risco** quando `tentativa_atual >= 6`: "⚠️ Última etapa — sem retorno o lead será estagnado."
  - Estado concluído: se `status = 'concluida'`, mostra aviso "Cadência esgotada — lead foi para a Central de Leads Estagnados."
- Estilo seguindo tokens semânticos (sem cores hardcoded), no padrão dos demais cards do modal.

**Integração em `src/components/pipeline/PipelineLeadDetail.tsx`**:
- Incluir `<CadenciaSemContatoCard leadId={lead.id} stageTipo={currentStage?.tipo} />` no topo do `bodyNode` (linha ~427). Como o `bodyNode` é reaproveitado na aba "Info" mobile, aparece automaticamente em desktop e mobile.

Sem mudança de schema nesta parte.

## Parte 2 — Aviso de pré-estagnação no dashboard + filtro no pipeline

O corretor não tem visibilidade dos leads que estão prestes a estagnar (só o gestor/CEO veem a Central). Vamos dar a ele um alerta preventivo da própria carteira.

### 2a. RPC nova `get_corretor_pre_estagnacao()` (1 migração)
- `SECURITY DEFINER`, escopo no `auth.uid()` (corretor só vê os próprios leads).
- Reusa `pipeline_estagnacao_config`, `_pipeline_ultima_acao_humana` e `_pipeline_tem_tarefa_pendente_futura` (mesma lógica do motor, sem duplicar regra).
- Retorna leads do corretor que estão **em risco**, classificados:
  - `em_aviso` — já receberam o aviso de 48h (`estagnado_aviso_em` preenchido, ainda não estagnado).
  - `proximo` — sem ação há ≥ (dias_limite − 2) dias, sem tarefa futura, sem parceria, ainda não em aviso.
- Exclui: já estagnados/arquivados, com negócio, pós-vendas e com tarefa pendente futura (não estão em risco real).
- Campos: `lead_id, nome, empreendimento, etapa, stage_id, dias_sem_acao, prazo_em, categoria`.

### 2b. Widget `src/components/corretor/PreEstagnacaoCard.tsx`
- Card no `CorretorDashboard.tsx`, inserido na coluna principal acima de `CarteiraKpis` (só aparece se houver leads em risco — sem ruído quando lista vazia).
- Cabeçalho: "⏳ Leads prestes a estagnar (N)" com semáforo (âmbar = próximos, vermelho = em aviso/48h).
- Lista compacta (até ~5) com nome, etapa, "parado há X dias" e badge da categoria; botão "Ver todos" abre o pipeline filtrado.
- Clique em um item abre o modal do lead (mesma navegação já usada para abrir lead no pipeline).

### 2c. Filtro rápido no pipeline
- No pipeline (`PipelineKanban` / filtros existentes), adicionar uma opção de filtro **"Em risco de estagnação"** que marca os leads retornados pela RPC.
- O card do dashboard navega para o pipeline já com esse filtro ativo (via query param, ex. `?risco=estagnacao`), reaproveitando o mecanismo de filtros atual. Confirmo o ponto exato de integração ao implementar, mantendo o padrão dos filtros já existentes.

## Detalhes técnicos
- Sem alterar tabelas, RLS, buckets ou edge functions. Apenas **1 migração** (a RPC `get_corretor_pre_estagnacao`) — dentro do limite diário.
- A RPC não duplica regras: chama as mesmas funções auxiliares do motor de estagnação, então o que o corretor vê como "risco" é exatamente o que viraria estagnação.
- Timezone BRT via `@/lib/brtTime` em todas as datas/contadores.
- Componentes novos pequenos e focados; nada de cores hardcoded.

## Validação
- Modal: abrir um lead na etapa Sem Contato e conferir tentativa atual, texto do passo, próximo vencimento e aviso de risco em T6/T7; conferir em mobile (aba Info).
- Dashboard: corretor com lead em aviso/próximo vê o card; lista some quando não há risco.
- Filtro: clicar "Ver todos" abre o pipeline filtrado corretamente; conferir que só aparecem leads do próprio corretor.
