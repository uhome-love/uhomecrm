# Plano técnico consolidado — Fase 5 Oferta Ativa (5 blocos)

Este plano cobre a implementação real no CRM dos 5 mockups aprovados. Feito em ondas pequenas e validáveis (mockup → plano → build → validar ao vivo, uma onda por vez). Nada aqui é implementado antes da sua aprovação.

## Visão geral das ondas

```text
Onda 1  Rebranding de abas + Índice de Potencial          (Bloco 1)
Onda 2  Cooldown 7d + Motivos estruturados                (Bloco 3 - base do resto)
Onda 3  Reservados: Meus retornos + Separados por mim     (Bloco 4)
Onda 4  Modo Concentração dentro da base                  (Bloco 2)
Onda 5  Meus resultados (aba pessoal)                     (Bloco 5)
```

Ordem trocada de propósito: Bloco 3 vai antes do 2 e do 4 porque cooldown e motivos são pré-requisito lógico de "Separar pra mim", "Retornos" e do Modo Concentração.

---

## Onda 1 — Rebranding + Índice de Potencial

- `src/pages/OfertaAtiva.tsx`: renomear tabs para **Bases Ativas · Reservados · Meus resultados · Configurações** (mantém rota `/oferta-ativa`, aba default `bases`). Admin ganha ainda Radar / Importar / Campanhas / Templates dentro de "Configurações".
- Novo componente `src/components/oferta-ativa/BasesAtivasGrid.tsx` substituindo o grid atual, com cards mostrando: nome do empreendimento, total de leads, "ligados hoje pela equipe", "% aproveitamento histórico" e selo **🎯 Alto / ⚡ Bom / 📞 Padrão** + selo opcional **"Base da semana"**.
- Cálculo do Índice de Potencial: view `v_oa_lista_potencial` (empreendimento → volume disponível + taxa de aproveitamento últimos 90d). Selo é derivado no SQL, sem estado no front.
- Selo manual "Base da semana": flag booleana `is_base_semana` em `oferta_ativa_listas`, editável só por admin/gestor na aba Configurações.
- Nada de temperatura ("fria/morna/quente") em lugar nenhum da UI.

## Onda 2 — Cooldown 7d + Motivos estruturados

- Nova tabela `oferta_ativa_cooldowns` (lead_id, cooldown_ate, resultado, motivo, criado_por, mutirao_bypass boolean). RLS: leitura por todos autenticados, escrita pela edge function.
- Migração de dados: se hoje existe cooldown implícito por `data_ultimo_contato`, backfill respeitando 7d.
- Edge function `oferta-ativa-registrar-resultado` (existente): passa a gravar em `oferta_ativa_cooldowns` com regra por resultado:
  - Aproveitado → sai da fila da OA (já é assim).
  - Não atendeu → cooldown 7d.
  - Sem interesse agora → cooldown 30d + opção de virar Reservado (Onda 3).
  - Descartar definitivo → cooldown permanente (leaves list).
- `oferta_ativa_lock_next_lead` já ignora leads em cooldown; ajuste explícito para checar `cooldown_ate > now()`.
- UI: componente `PosLigacaoDialog.tsx` novo (2 passos: resultado → motivos-chip por resultado + obs opcional). Substitui o popup atual em `LeadCard.tsx` (Mutirão) e no fluxo de call fora do mutirão.
- Exceções ao cooldown:
  - Gestor libera manual: botão em `LeadCard` restrito a role gestor/admin.
  - Próprio corretor pode reentrar antes do prazo: check por `criado_por = auth.uid()`.
  - Mutirão ao vivo: flag `mutirao_bypass` respeitada pela função de próximo lead **só durante sessão ativa**.
- Painel de gestão por base: novo bloco em `OAObservabilityPanel.tsx` com % por resultado e motivo top.

## Onda 3 — Reservados

- Nova tabela `oferta_ativa_reservados` (lead_id, corretor_id, tipo `retorno|separado`, agendado_para nullable, criado_at, devolvido_at nullable). RLS: corretor só vê os seus; gestor vê da equipe.
- Regra de limite: 20 "separados" por corretor. Enforced via constraint parcial + validação na edge function `oferta-ativa-reservar`.
- Cron diário `oferta-ativa-devolucao-automatica`: devolve à base itens `separado` com >30d sem contato (aviso em 25d via notificação).
- UI: nova página/aba `src/pages/OfertaAtivaReservados.tsx` com 3 sub-abas (📌 Meus retornos · 🔖 Separados por mim · ⏰ Vencidos). Ligar/Reagendar/Devolver por linha.
- Integrações:
  - PosLigacaoDialog em "Sem interesse agora + agendar retorno" cria linha `tipo=retorno`.
  - Botão 🔖 Separar pra mim adicionado ao card do lead dentro da base.

## Onda 4 — Modo Concentração

- Toggle "⚡ Modo Concentração" no header da base (`BaseDetailScreen.tsx` novo, extraindo lógica atual da listagem interna).
- Modal tela-cheia `ConcentracaoScreen.tsx` reusando peças do Mutirão (`LeadCard`, prefetch, atalhos). Meta padrão 20 leads/sessão, editável.
- Reuso 100% da RPC `oferta_ativa_lock_next_lead` + `oferta-ativa-registrar-resultado`; nada de nova infra de fila.
- Barra de sessão persistida em `sessionStorage` por `profileId` (padrão do projeto).
- Atalhos: Espaço = ligar, 1–4 = resultado, S = pular. Componente `useFocusKeyboardShortcuts` já existe — estender.

## Onda 5 — Meus resultados

- Nova aba `Meus resultados` na `OfertaAtiva.tsx` (visível a todos os corretores).
- Página `src/pages/OfertaAtivaMeusResultados.tsx` com:
  - 4 KPIs comparados vs período anterior — filtro Hoje/7d/Mês/30d.
  - Funil pessoal (5 etapas) via view `v_oa_funil_corretor`.
  - "Onde você acerta mais": ranking por empreendimento com % aproveitamento.
  - Heatmap por hora do dia (view `v_oa_horario_corretor`).
  - Histórico últimas 30 ligações + filtro por resultado + export CSV.
- Sem ranking público aqui — o Placar/Painel ao Vivo continua sendo o palco público. Comparativo com média da equipe é opcional em Configurações (default off).

---

## Migrations previstas (agrupadas por onda, respeitando 2/dia)

- Onda 1: `oferta_ativa_listas.is_base_semana` + `v_oa_lista_potencial`.
- Onda 2: tabela `oferta_ativa_cooldowns` + policies + ajuste RPC `oferta_ativa_lock_next_lead`.
- Onda 3: tabela `oferta_ativa_reservados` + policies + cron devolução.
- Onda 4: nenhuma migration (reuso puro).
- Onda 5: views `v_oa_funil_corretor` e `v_oa_horario_corretor`.

Toda migration inclui `GRANT` para `authenticated` + `service_role` conforme regra do projeto. Nenhuma migration mistura DDL com dados críticos.

## Regras que serão respeitadas

- **Mockup → plano aprovado → build → validação ao vivo**, uma onda por vez. Nada de mexer nas 5 ondas juntas.
- Zero quebra dos fluxos vigentes: Mutirão Inteligente, Roleta, PDN, Pipeline continuam funcionando sem alteração de contrato.
- Sem `as any`, sem componentes >300 linhas, sem arquivos >500 linhas (páginas novas já quebradas em subcomponentes).
- Timezone BRT em todas as datas de cooldown, retorno e KPIs.
- ID convention: leads e corretores continuam via `auth.users.id` nas tabelas OA (mantém padrão atual do módulo).

## Validação ao vivo por onda

Cada onda só é declarada pronta após o teste ponta-a-ponta que você faz comigo no preview (lead de teste, cancelar ao final). Nunca reporto pronto só pelo build.

## O que **não** entra nesta fase

- Ranking público dentro de "Meus resultados" (só o Placar TV segue público).
- Automação de reengajamento a partir de cooldown expirado (fica pro futuro, o disparador de reengajamento continua com a lógica atual).
- Mudança na lógica do mutirão de sexta / disparador — só os nomes/listas já foram ajustados na fase anterior.

---

**Próximo passo:** você aprova esse plano consolidado e eu começo pela **Onda 1 (Rebranding + Índice de Potencial)** — que é a mais leve e visualmente confirma a nova identidade da Oferta Ativa. Ao final da Onda 1 validamos ao vivo antes de partir pra Onda 2.