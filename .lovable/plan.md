## Análise crítica — Agenda de Visitas

Fiz uma auditoria de qualidade de produto do arquivo `src/pages/AgendaVisitas.tsx` (861 linhas) e componentes em `src/components/visitas/*`. A ferramenta é sólida e cobre o fluxo (criar → confirmar → realizar/no-show → reabrir → cobrar pendentes), mas tem pontos frágeis de UX, performance, responsividade e consistência visual. Abaixo o diagnóstico e as melhorias propostas — **sem remover nenhuma funcionalidade existente**.

---

### 🐞 Bugs / fragilidades reais

1. **Período "Personalizado" usa hack frágil**: o botão "Aplicar" faz `setPeriod("hoje")` + `setTimeout(() => setPeriod("personalizado"), 0)` para forçar recomputação. Isso pisca a tela e pode falhar. O `getDateRange` já reage a `customFrom/customTo` via `useMemo` — o botão é redundante e bugado. Corrigir para aplicar direto, com validação `from <= to`.
2. **Carrega TODAS as visitas sem filtro de data**: `useVisitas()` é chamado uma segunda vez sem range (`allVisitas`) só para calcular "pendentes" e o mini-calendário. Em bases grandes isso puxa volume desnecessário (lembrando o cap de 1000 linhas do PostgREST — pode truncar e dar contagem errada de pendentes). Restringir a janela (ex.: últimos 30 dias) para o cálculo de pendentes.
3. **Mini-calendário só aparece em "Semana"/"Próxima semana"**: em "Mês" e "Personalizado" o usuário perde a navegação visual por dia.
4. **Ações rápidas (Realizada/No-show/Reabrir) só no hover** (`opacity-0 group-hover:opacity-100`): em mobile/touch ficam invisíveis e inacessíveis. Tornar sempre visíveis no toque.
5. **KPI "Taxa realização"** = `realizadas/(marcadas+realizadas)` — ignora `no_show` no denominador, inflando a taxa. Revisar fórmula (incluir no-show) ou rotular melhor o que ela mede.
6. **`taxa` e `criadas` são `<button>` que não fazem nada** (cursor de clique enganoso). Renderizar como card estático.

### 🎨 Consistência visual / design system

7. **Cores hardcoded em todo o arquivo** (`bg-[#4969FF]`, `text-[#10b981]`, `#f0f0f5`...). Viola a regra do design system (tokens semânticos) e dificulta manutenção/tema. Migrar para tokens (`--primary`, `--success`, `--warning`, `--destructive`, `--muted`) mantendo exatamente as mesmas cores atuais.
8. **Hierarquia tipográfica miúda e inconsistente** (10/11/12px misturados). Padronizar escala.

### 📱 Responsividade

9. **Header com muitos controles em `flex-wrap`**: em telas médias quebra de forma desorganizada (busca, toggle, equipe, Google Agenda, Nova Visita). Reorganizar: ações primárias sempre visíveis, secundárias em um menu "•••" no mobile.
10. **Card de visita esconde info em telas pequenas** (`hidden md:block` para empreendimento, `hidden sm:block` para corretor). Reorganizar para layout de 2 linhas no mobile sem perder dados.

### ⚡ Modernidade / experiência diária

11. **Loading é texto "Carregando..."** — trocar por skeletons.
12. **Sem visão semanal em grade (timeline por horário)** — hoje é só lista por dia. Adicionar toggle Lista/Semana mantendo a lista como padrão.
13. **Pendentes só visíveis para admin** num botão discreto. Corretor não vê suas próprias visitas vencidas sem desfecho — adicionar destaque sutil ("vencida, marcar desfecho") no próprio card.
14. **Sem indicação de "agora"** dentro do dia de hoje, nem ordenação que destaque a próxima visita.

---

### Plano de execução (faseado, incremental, sem quebrar)

**Fase 1 — Correções (baixo risco)**
- Corrigir período "Personalizado" (aplicar direto + validar datas).
- Tornar ações rápidas sempre visíveis em touch.
- Converter KPIs `taxa`/`criadas` em cards estáticos (sem cursor de clique).
- Restringir `allVisitas` a janela de 30 dias para pendentes.
- Skeletons no loading.

**Fase 2 — Design system (médio risco, só visual)**
- Migrar cores hardcoded para tokens semânticos em `index.css`/`tailwind.config.ts`, preservando as cores atuais.
- Padronizar escala tipográfica.

**Fase 3 — Responsividade**
- Reorganizar header (ações secundárias em menu no mobile).
- Card de visita em layout adaptativo de 2 linhas no mobile.
- Mini-calendário disponível também em "Mês"/"Personalizado".

**Fase 4 — Modernidade (opcional, maior escopo)**
- Toggle Lista/Semana (grade por horário), lista como padrão.
- Destaque de visitas vencidas sem desfecho no card (para todos).
- Marcador de "próxima visita / agora" no dia de hoje.

### Detalhes técnicos
- Nenhuma mudança de schema ou lógica de negócio. Tudo em frontend/apresentação (`AgendaVisitas.tsx` + componentes `visitas/`), exceto adição de tokens no CSS.
- Lógica de timezone BRT, status, RLS e fluxo de desfecho permanecem intactos.
- Refatorar `AgendaVisitas.tsx` (861 linhas) extraindo subcomponentes (Header, KpiGrid, PeriodBar) para ficar abaixo de 500 linhas, conforme regras de manutenção.