## Central de Reengajamento — Unificação em página única

Hoje a página `/central-nutricao` tem 3 abas separadas (Reengajamento Descartados, Visita Amanhã, Auditoria Webhook) com lógicas duplicadas. Vou consolidar tudo em uma única central organizada por seções, onde **"Visita Amanhã" e "Descartados" viram apenas TIPOS de campanha** dentro do mesmo fluxo de disparo customizado.

### Estrutura nova da página

```text
/central-nutricao
├── [Topo] KPIs globais (enviados hoje/7d/30d, resposta %, falhas)
│
├── SEÇÃO 1 — Novo disparo (card grande, sempre visível)
│    ├─ Canal:      ( ) Meta (template oficial)   ( ) Evolution (free text)
│    ├─ Público:    ( ) Descartados   ( ) Pipeline ativo   ( ) Lista Oferta Ativa   ( ) Visita amanhã
│    ├─ Filtros dinâmicos por público:
│    │     • Descartados → tipo (reengajável/definitivo), período
│    │     • Pipeline ativo → etapas, período de criação
│    │     • Lista OA → combobox de listas, período
│    │     • Visita amanhã → data da visita (default: amanhã), empreendimento
│    ├─ Empreendimento (opcional, para todos)
│    ├─ Dedup: [ Excluir já receberam ] [ Incluir todos ] [ Só recebidos antes de X ]
│    ├─ Limite máx
│    ├─ Template/Mensagem (campo aparece conforme canal escolhido)
│    └─ [ Calcular público → mostra TOTAL ]  [ Disparar para N leads ]
│
├── SEÇÃO 2 — Disparo em andamento + últimos disparos
│    ├─ Card "Em andamento" (se houver run ativo): progresso, % concluído, cancelar
│    └─ Tabela últimos 20 disparos: data, canal, público, enviados, respondidos, falhas
│
├── SEÇÃO 3 — Auditoria de webhooks (relatório de retorno)
│    ├─ Filtros: status, busca, período
│    ├─ Tabela unificada (Meta + Evolution + Visita Amanhã): lead, telefone, canal, status, resposta, sent_at, responded_at
│    └─ Métricas de webhook: taxa entrega, taxa leitura, taxa resposta
│
└── SEÇÃO 4 — Configurações (collapse, fechado por padrão)
     ├─ Janelas de horário, throttle, cap diário
     ├─ Templates Meta cadastrados
     └─ Pausa global (kill switch)
```

### Mudanças concretas

**Removidas:**
- Componente de Tabs no topo (`CentralNutricaoPage` atual)
- `VisitaAmanhaTab` como tela separada — vira opção de público
- `AuditoriaWebhookTab` como tab — vira Seção 3 inline

**Refatorados / criados:**
1. **`CentralNutricaoPage.tsx`** — remove `<Tabs>`, renderiza as 4 seções em ordem
2. **`DisparoCustomizadoCard.tsx`** (já criado) — expandir para incluir:
   - Seletor de **canal** (Meta / Evolution) no topo
   - Novo source `visita_amanha` com filtro de data da visita
   - Campo de mensagem/template condicional ao canal
3. **`UltimosDisparosTable.tsx`** (novo) — unifica `reengajamento_dispatch_runs` + `visita_amanha_disparos` agrupando por run, mostra coluna "Canal" e "Público"
4. **`AuditoriaUnificadaSection.tsx`** (novo) — junta `reengajamento_meta_disparos` + `visita_amanha_disparos` numa única tabela com coluna "Canal"
5. **`ConfiguracoesReengajamento.tsx`** (novo, collapse) — extrai a parte de config do `ReengajamentoTab` atual (janelas, templates, kill switch)
6. **`KpisGlobaisHeader.tsx`** (novo) — KPIs no topo

**Backend (sem migration nova nesta etapa):**
- `reengajamento-audience-preview` ganha source `visita_amanha`
- `reengajamento-descartados-enqueue` ganha branch `visita_amanha` (delega para `visita-amanha-enqueue` existente OU absorve a lógica — preferência: delegar para preservar o que já funciona) e ganha parâmetro `canal: 'meta' | 'evolution'` no payload `audience`
- Função `visita-amanha-enqueue` continua existindo, mas só é chamada via fluxo unificado

**Não-objetivos (Fase 2, fora deste plano):**
- Agendamento recorrente, A/B, favoritos
- Migration de unificação das tabelas `reengajamento_meta_disparos` + `visita_amanha_disparos` (manter separadas, unificar só na UI por enquanto)
- Mexer em `evolution-webhook` / `whatsapp-360dialog`

### Detalhes técnicos relevantes
- Respeita teto de 2 migrations/dia BRT — esta etapa é **zero migration**
- Mantém `canTouchPipelineLead` no enqueue (não polui timestamps de leads ativos)
- Mantém telemetria via `audience_source` já adicionada na rodada anterior
- Componentes ficam <300 linhas cada; `CentralNutricaoPage` fica enxuto (<150 linhas) só orquestrando seções
- Sem `as any` em código novo; tipagem de canal via union literal
- Sem fetch wrappers / sem cliente custom

### Ordem de execução
1. Estender `DisparoCustomizadoCard` (canal + source visita_amanha + campo mensagem)
2. Atualizar `reengajamento-audience-preview` e `reengajamento-descartados-enqueue` para canal + visita_amanha
3. Criar `UltimosDisparosTable`, `AuditoriaUnificadaSection`, `ConfiguracoesReengajamento`, `KpisGlobaisHeader`
4. Reescrever `CentralNutricaoPage.tsx` sem tabs
5. Deletar arquivos `VisitaAmanhaTab.tsx`, `AuditoriaWebhookTab.tsx`, `ReengajamentoTab.tsx` (config migrada)
6. Deploy das 2 functions e validação visual no preview
