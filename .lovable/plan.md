# PDN unificado — plano de evolução

Objetivo: transformar o PDN em UMA página com dois modos de leitura (Planilha e Kanban) alimentados pela **mesma fonte, o mesmo drawer e as mesmas ações**. Hoje só o Kanban tem drawer com "Publicar no lead" — a Planilha edita inline e nunca abre o drawer. Vamos fechar essa lacuna e usar o momento pra elevar o PDN ao nível de "central de gestão de negócios do gestor".

---

## Estudo: Planilha vs Kanban (qual é melhor?)

Ambos têm razão de existir. A diferença não é "qual é melhor", é "melhor pra quê":

| Uso real do gestor | Vence | Por quê |
|---|---|---|
| Reunião 1:1 com corretor, ler linha por linha | **Planilha** | densidade, colunas alinhadas, comparar VGV/data lado a lado |
| Bater olho "onde cada negócio está" | **Kanban** | agrupamento visual por etapa é imediato |
| Editar em lote (mesma prioridade em 5 negócios) | **Planilha** | seleção múltipla natural em linhas |
| Mover negócio de etapa | **Kanban** | drag entre colunas é o gesto certo |
| Ver 100+ negócios ao mesmo tempo | **Planilha** | scroll vertical vence scroll horizontal |
| Foco em um negócio específico | **empate** | ambos abrem o mesmo drawer |
| Mobile 440px | **Kanban** | 1 coluna por vez cabe; tabela larga não cabe |
| Ordenar por VGV / data / risco | **Planilha** | headers clicáveis |

**Recomendação**: manter os dois, com padrão por dispositivo (planilha no desktop, kanban no mobile) e **paridade total de funcionalidade**. Toggle na toolbar. Preferência persistida por device (já implementado).

O ganho não é escolher um — é fazer os dois falarem a mesma língua.

---

## O gap real hoje

- **Planilha edita inline** (célula a célula) e **não abre drawer**. Publicar no lead, timeline, avisar corretor, mudar etapa, marcar queda → tudo indisponível.
- **Kanban abre drawer**, mas não tem edição rápida sem abrir o drawer (todo campo exige 2 cliques).
- **Ações destrutivas** (queda, reativar, remover) só existem no drawer do kanban.
- **Botão "Publicar no lead"** só aparece no drawer → planilha nunca publica.
- **Colunas fixas** na planilha; gestor não escolhe o que vê.
- **Sem seleção múltipla** em nenhum modo → não dá pra fazer "marcar prioridade alta em 8 negócios" numa 1:1.
- **Sem busca/atalho** de negócio dentro do PDN (só filtros de topo).
- **Drawer é o `PdnCardDrawer`** — só edita PDN, não mostra o contexto do lead (timeline, última nota do corretor, próxima tarefa dele).

---

## Fases

### Fase 1 — Drawer único e universal (a mudança que destrava tudo)

Consolidar o drawer como **o ponto único de ação**, chamado tanto do Kanban quanto da Planilha.

- Criar `PdnLeadDrawer` (substitui `PdnCardDrawer`) com 3 abas:
  1. **Contexto do lead** — cabeçalho rico (nome, empreendimento, VGV, badges de risco/prioridade/dias parado). Timeline via `v_lead_timeline` (últimos 10 eventos). Última observação do corretor. Próxima tarefa dele. Atalhos: abrir lead no pipeline, WhatsApp, agenda.
  2. **Ação do gestor** — status PDN, prioridade, observação, próxima ação (com data opcional), risco manual + motivo, empreendimento, VGV. **Cada bloco editável tem o botão "Publicar no lead"** (idempotente por hash — já funciona).
  3. **Etapa** — mover entre grupos do PDN (Visita → Negociação → Contrato → Ganho), marcar queda, reativar. Nunca mexe no pipeline do corretor.
- Planilha e Kanban chamam o **mesmo drawer**. Um clique na linha (planilha) ou no card (kanban) abre.
- Drawer preserva o estado ao salvar (não fecha sozinho).

Resultado: paridade instantânea. Tudo que hoje só existe no kanban passa a existir também na planilha.

### Fase 2 — Planilha nível SaaS

- **Linha inteira clicável** abre o drawer. Célula continua editável inline com duplo clique (mantém o fluxo de digitação rápida que o gestor já usa).
- **Ícone de ação por linha**: 3 ícones fixos ao passar o mouse — abrir drawer, publicar no lead (atalho direto do texto de observação da linha), marcar queda.
- **Colunas configuráveis** — menu "Colunas" na toolbar deixa o gestor escolher o que ver (empreendimento, VGV, status, prioridade, próxima ação, dias parado, corretor, última publicação). Preferência persistida por device.
- **Seleção múltipla** (checkbox na primeira coluna) + barra de ação em lote no topo: "Definir prioridade", "Marcar como avisado", "Publicar observação no lead" (em massa), "Mover para Queda".
- **Ordenação por qualquer coluna** com indicador visual.
- **Densidade compacta/confortável** — toggle na toolbar (o Excel-like do gestor experiente).
- **Zebra sutil + linha ativa destacada** (sem tabelão do Windows 98).

### Fase 3 — Kanban nível SaaS

- Card do kanban ganha **botões rápidos no hover**: publicar no lead (usa a observação atual como corpo), avisar corretor, marcar queda. Sem precisar abrir drawer pra tarefas repetitivas.
- Badge de **"publicado há Xh"** no card quando a última observação já virou nota no lead.
- **Drag horizontal com preview** do impacto (VGV que sai da coluna origem, entra na destino).
- **Colunas colapsáveis** (Ganho/Caídos ocupam muito espaço em meses grandes).
- **Contador de risco/novos** no topo de cada coluna já existe; adicionar contador de "pendentes de publicar" (linhas com observação nova ainda não publicada no lead).

### Fase 4 — Integração com o pipeline (bidirecional de verdade)

- **Publicar no lead** continua idempotente por hash + `origem_ref='pdn:<override_id>:<campo>:<hash>'`.
- Nota gerada aparece no histórico do lead com badge visual **"Gestor · PDN"** (já combinado; falta confirmar o styling do badge no `LeadHistoricoTab`).
- **Se a próxima ação tiver data**, oferecer toggle "Também criar tarefa pro corretor" → `pipeline_tarefas` com `origem='pdn'` e mesmo `origem_ref`. Sem duplicar se republicar. Bloqueado se lead está em Visita (respeita regras já existentes).
- **Botão "Avisar corretor"** unifica: manda notificação **e** publica a mensagem no histórico do lead (uma ação só, dois efeitos).
- **Voltar do lead pro PDN**: no drawer do lead no pipeline, adicionar link "Ver no PDN do mês" quando o lead tem entrada em `pdn_entries`.

### Fase 5 — Toolbar unificada e busca

- **Barra de busca** dentro do PDN (`⌘K` estilo) que encontra negócio por nome do lead, empreendimento ou corretor e abre o drawer direto.
- **Filtros como chips arredondados** (equipe, corretor, empreendimento, status, prioridade, risco) — mesmos filtros valem pros dois modos.
- **Toggle "Meus negócios / Time / Todos"** persistente por role (gestor vê time por default, CEO vê todos).
- **Botão "Copiar resumo pro WhatsApp"** — gera texto pronto com VGV assinado no mês, negócios em risco e caídos da semana.
- Header sticky com blur (já implementado).

### Fase 6 — Quebra do arquivo + performance

- `PdnGestor.tsx` (978 linhas) vira `<200`: extrair `PdnHeader`, `PdnKpiStrip`, `PdnFilters`, `PdnPlanilhaView`, `PdnDuplicadosCard`, `PdnResumoEquipes`, `PdnBulkActionsBar`.
- `PdnLeadDrawer` também `<300` linhas (dividir em `PdnLeadContextTab`, `PdnLeadActionTab`, `PdnLeadStageTab`).
- Virtualização da planilha a partir de 100 linhas (já sofre em meses grandes).
- Memoização das linhas do kanban (re-render evitado no drag).

### Fase 7 — Permissões e RLS

- Confirmar policies em `pdn_entries` e `pipeline_anotacoes` pra gestor/diretor/admin (CEO cai em admin no projeto — já validado).
- UI esconde botões que o role não pode acionar (nunca só desabilita — some).
- Se faltar cobertura pra `diretor`, migration aditiva com `has_role(auth.uid(), 'diretor')`.

---

## Ordem de entrega (com validação ao vivo entre cada fase)

1. **Mockup HTML** (desktop planilha + mobile kanban + drawer unificado com abas Contexto/Ação/Etapa) → você aprova.
2. **Fase 1** — drawer único chamado dos dois modos. Sozinho já resolve 80% do problema (planilha ganha publicar, avisar, queda). → validar clicando em lead de teste.
3. **Fase 2** — planilha nível SaaS (colunas configuráveis, seleção múltipla, ações em lote).
4. **Fase 3** — kanban nível SaaS (ações rápidas no card).
5. **Fase 4** — integrações bidirecionais (tarefa pro corretor + link de volta).
6. **Fase 5** — busca + copiar resumo.
7. **Fase 6** — quebra de arquivo + virtualização.
8. **Fase 7** — auditoria de RLS.

Cada fase é validada ao vivo no preview com lead de teste (sempre Cancelar em leads reais). Nenhuma migration destrutiva. Nada que já funciona no kanban regride.

---

## Detalhes técnicos

- Nenhuma mudança de schema até Fase 7 (só se faltar policy).
- Idempotência mantida: `origem_ref='pdn:<override_id>:<campo>:<md5(texto)>'`.
- Publicação em lote (Fase 2) faz N inserts com `origem_ref` distinto por linha; se hash já existe, pula.
- Preferências (view mode, colunas visíveis, densidade) em `localStorage` chaveadas por device: `pdn:view:{desktop|mobile}`, `pdn:cols:{desktop|mobile}`, `pdn:density`.
- Timezone BRT em todo formato de data (`formatBRT`).
- Tokens semânticos do design system — nada de cor hard-coded.
- Testes: `pdn/pdnDrawerParity.test.tsx` (drawer abre igual dos dois modos), `pdn/pdnBulkPublish.test.tsx` (publicação em lote idempotente).

Se aprovar o rumo, começo pelo **mockup visual da Fase 1** (drawer unificado com as 3 abas + como fica o clique da linha da planilha abrindo esse drawer).
