## Decisões consolidadas
- **Publicar no lead**: cada observação/próxima ação tem um botão explícito "Publicar no lead" que grava uma nota em `pipeline_anotacoes` (histórico do lead).
- **Permissões**: Diretoria e CEO podem editar o overlay do PDN (além do gestor da equipe).
- **Padrão desktop = Planilha; padrão mobile = Kanban** (justificativa abaixo).
- Estruturo **os dois modos**, cada um com sua vocação, e o toggle na toolbar permite alternar.

---

## Kanban vs Planilha — recomendação

Analisando o uso real: o PDN tem **5 grupos com fluxo direcionado** (Visita → Negociação → Contrato → Ganho | Caídos) e **entre 30 e 200 linhas/mês**.

| Critério | Planilha | Kanban |
|---|---|---|
| Ver 100+ negócios de uma vez | Ganha (densa, ordenável, filtrável) | Perde (scroll horizontal cansa) |
| Comparar VGV/status entre negócios | Ganha (colunas alinhadas) | Perde |
| Reordenar etapa (drag) | Perde | Ganha (natural) |
| Foco em "onde cada negócio está" | Empata | Ganha visualmente |
| Editar em lote (mesmo status para 3) | Ganha | Perde |
| Mobile 440px | Perde (tabela não cabe) | Ganha (1 coluna por vez) |
| Reunião 1:1 gestor↔corretor | Ganha (lê linha) | Empata |

**Recomendação final**: **Planilha como padrão no desktop** (gerente/diretor/CEO fazem gestão sentados, precisam ver muito de uma vez, editar rápido, comparar). **Kanban como padrão no mobile** (gestor no celular durante o dia quer arrastar e ver progresso). Toggle mantido para trocar. Preferência persistida por dispositivo (`pdn:view:desktop` / `pdn:view:mobile`).

Ambos os modos consomem os **mesmos hooks e drawer**, então nenhum código duplica.

---

## Plano final

### Mockup primeiro
Antes de qualquer código, apresento **1 mockup HTML/imagem** com:
- Desktop 1280px em modo planilha.
- Mobile 440px em modo kanban.
- Drawer novo (`PdnLeadPanel`) com timeline + botão "Publicar no lead".

Você aprova o mockup → sigo para a Fase 1.

### Fase 1 — Redesign visual + quebra de arquivo (sem mudança de comportamento)
- Quebrar `PdnGestor.tsx` (968 linhas) em: `PdnHeader`, `PdnKpiStrip`, `PdnFilters`, `PdnPlanilhaView`, `PdnDuplicadosCard`, `PdnResumoEquipes`. Página raiz fica <200 linhas.
- Tokens semânticos no lugar das cores hard-coded (`#10B981` etc.).
- Header sticky com blur, KPI strip com scroll horizontal em mobile.
- Filtros como chips arredondados.
- Kanban como default no mobile, planilha no desktop (persistido por device).
- Cores de risco/frescor consistentes com o resto do CRM.
- Empty states ilustrados.

### Fase 2 — Contexto do corretor dentro do PDN
- Novo `PdnLeadPanel` (substitui `PdnCardDrawer`):
  - Header rico: nome, empreendimento, VGV, badges (risco, prioridade, dias parado, avisado há X).
  - Tabs internas: **Contexto** (timeline via `v_lead_timeline`, última observação do corretor, próxima tarefa dele) | **Ação do gestor** (status, prioridade, observação, próxima ação, risco) | **Etapa** (mudar grupo do PDN + queda).
  - Atalhos no header: "Abrir lead no pipeline" (nova aba), WhatsApp, visitas.

### Fase 3 — Publicação bidirecional (a mudança de comportamento)
Cada bloco editável do drawer ganha um **botão "Publicar no lead"** com dois efeitos:
1. Salva no overlay (`pdn_entries`) como hoje.
2. **Cria uma anotação em `pipeline_anotacoes`** com:
   - `tipo='gestor_pdn'`
   - Texto: `"[Gestor · <nome>] <conteúdo>"` (observação, próxima ação, ou aviso).
   - `origem_ref='pdn:<override_id>:<campo>:<hash>'` para idempotência (evita duplicar se clicar 2×).
3. Se o campo publicado for "próxima ação" **com data**, oferece toggle adicional "criar tarefa para o corretor" → `pipeline_tarefas` com `origem='pdn'` e mesma `origem_ref`.

Regras:
- Botão só aparece quando o campo tem conteúdo E há `pipeline_lead_id` (linha do pipeline).
- Botão vira "Publicado ✓ há Xh" após o clique; muda para "Republicar" se o texto for editado depois.
- "Avisar corretor" continua enviando notificação **e** publica no lead (nota + notificação juntas).
- Notas publicadas aparecem no histórico do lead marcadas com badge "Gestor" para o corretor.

### Fase 4 — Permissões e RLS
- Auditar policies de `pdn_entries`, `pipeline_anotacoes`, `pipeline_tarefas`.
- Garantir INSERT/UPDATE em `pdn_entries` para roles `gestor`, `diretor`, `admin` (CEO cai em `admin` ou `diretor` no projeto — confirmo antes).
- Se faltar cobertura para `diretor`, adiciono policy via migration:
  ```
  CREATE POLICY "diretoria manages pdn_entries" ON public.pdn_entries
    FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'diretor') OR public.has_role(auth.uid(), 'admin'));
  ```
- `pipeline_anotacoes`: garantir INSERT permitido para gestor/diretor/admin do lead.
- Nenhuma mudança de schema além de policies faltantes (não crio colunas novas).

### Fase 5 — Foco do dia + comparativo (evolução)
- Banda "Foco do dia" (contratos travados >3d, negociação sem toque >7d, ganhos assinados hoje, caídos da semana).
- Mini-gráfico VGV assinado vs mês anterior vs meta.
- "Copiar resumo para WhatsApp" (texto pronto pro CEO/diretor mandar).

---

## Ordem de entrega

1. Mockup (desktop planilha + mobile kanban + drawer com "Publicar no lead") → aprovação.
2. **Fase 1** (redesign + quebra do arquivo) → validação ao vivo no preview.
3. **Fase 2** (drawer novo com contexto) → validação.
4. **Fase 4** (policies de diretor/CEO) — migration entra aqui, antes de habilitar a publicação em massa.
5. **Fase 3** (botão "Publicar no lead" + nota no histórico) → validação com lead de teste (nunca real).
6. **Fase 5** (foco do dia + comparativo).

Cada fase validada ao vivo antes da próxima. Nenhuma migration destrutiva. Testes adicionados para o fluxo "Publicar no lead cria anotação idempotente".

---

## Detalhes técnicos

- Sem mudança de schema além de policies em Fase 4.
- Publicação usa cliente autenticado — RLS cuida da permissão real; UI esconde o botão se o role não puder publicar.
- Idempotência por `origem_ref='pdn:<override_id>:<campo>:<md5(texto)>'` — republicar com texto igual não duplica; com texto diferente cria nova nota.
- Timezone BRT em toda formatação de datas (`formatBRT`).
- Todos os arquivos novos ≤300 linhas; `PdnGestor.tsx` fica ≤200.
- Testes: `pdn/pdnPublish.test.tsx` cobrindo publicação, republicação, idempotência.

Se aprovar este plano, começo pelo **mockup visual** (Fase 0 do padrão de trabalho).
