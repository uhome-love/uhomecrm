
# Nova Tarefa — só leads em etapas com preset

## Contexto

Hoje o popup "Nova Tarefa" (`/minhas-tarefas`) deixa você escolher **qualquer** lead do corretor pelo nome. Isso permite criar tarefa manual em leads onde não faz sentido operacional:

- **Sem Contato** — tem cadência automática (T1→T5, ligação/WhatsApp/áudio/novidade). Tarefa manual concorre com o motor.
- **Visita** — tem fluxo automático (confirmar D-1, remarcar +7d no no-show, feedback +48h). Criação manual já é bloqueada em outros pontos.
- **Contrato** — fluxo de fechamento, sem tarefa manual.
- **Descarte / Ganho / Arquivado** — fora do pipeline ativo.

Etapas onde tarefa manual **faz sentido** e já têm chips de preset:

- **Qualificação**
- **Aquecimento**
- **Em Negociação**

Regra fica simétrica: **só aparecem na busca as etapas que têm preset**. Se a etapa tem motor automático, ela não recebe tarefa manual pelo Central de Tarefas.

## Mudanças

### 1. Filtro na busca de leads (`MinhasTarefas.tsx`, query `lead-search-tarefas`)

Ampliar o `select` para trazer `stage_id` + `pipeline_stages.tipo` e filtrar:

- `arquivado = false`
- `aceite_status IN ('aceito','pendente','aguardando_aceite')`
- `pipeline_stages.tipo IN ('qualificacao','aquecimento','negociacao')`

Implementação: buscar 1x os `stage_ids` cujo `tipo` está na lista elegível (cacheado no React Query) e usar `.in('stage_id', elegiveis)` na busca.

### 2. Badge da etapa no popup

Na linha do lead selecionado (junto do "Trocar"), mostrar um chip pequeno com o nome da etapa (ex.: `Qualificação`). Reforça visualmente por que os presets aparecem.

### 3. Empty state explicativo

Quando `leadSearch.length >= 2` e a busca retorna vazio, mostrar linha discreta:

*"Nenhum lead disponível. Tarefa manual só existe em Qualificação, Aquecimento e Em Negociação — as demais etapas rodam por automação."*

## Fora de escopo

- Não mexer no drawer do lead (as regras por etapa já valem lá dentro).
- Não mexer em presets nem no formulário — só na seleção do lead.
- Sem migration; puramente frontend.

## Validação ao vivo

1. Buscar "Lucas Fontoura" (Descarte) → **não aparece**.
2. Buscar "Rodrigo Marcon" (Sem Contato) → **não aparece**.
3. Buscar um lead em **Visita** → **não aparece**.
4. Buscar um lead em **Qualificação** → aparece; chips de preset renderizam; badge "Qualificação".
5. Buscar um lead em **Aquecimento** → aparece; chips corretos; badge "Aquecimento".
6. Buscar um lead em **Em Negociação** → aparece; chips corretos; badge "Em Negociação".
7. Buscar um arquivado → **não aparece**.

## Arquivos afetados

- `src/pages/MinhasTarefas.tsx` (só a query `lead-search-tarefas` + UI do popup Nova Tarefa).
