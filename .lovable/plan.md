# Validação ponta a ponta: Pipeline x PDN — o que manter, o que eliminar

## Veredito

O PDN está **funcionalmente correto** (espelho real do pipeline, números batendo com Vendas Realizadas). O problema hoje não é bug: é **excesso de funcionalidade**. Ele acumulou 5 abas, 3 diálogos, um drawer próprio de 3 abas e 6 campos de anotação — e os dados mostram que o gestor usa **duas coisas**: observação e status.

## O que os dados dizem (medido agora, 117 linhas de anotação)

| Campo do overlay | Preenchido | Veredito |
|---|---|---|
| `observacoes` | 98 de 117 | **Manter** — é o coração do PDN |
| `status` (texto livre) | 102 de 117 | **Manter** |
| `proxima_acao` / `proxima_acao_data` | 2 | Eliminar — o pipeline já tem tarefa com data |
| `prioridade` | 2 | Eliminar |
| `risco_manual` / `risco_motivo` | 0 | Eliminar — o risco automático (+7d parado) já cobre |
| `corretor_avisado_em` / `_etapa` | 0 | Eliminar — avisar corretor virou notificação real |
| `visitas.linked_pdn_id` (FK) | 0 usos | Eliminar — resquício do modelo de planilha |

Anotações concentradas em julho (109) e agosto (8): o PDN é usado como **caderno do mês corrente**, não como base histórica.

## Sobreposições com o Pipeline (mesma função, duas telas)

1. **Aba Kanban do PDN x Pipeline de Leads** — mesmo board, mesmas etapas de fim de funil. No desktop é redundante; no mobile é a única forma usável de operar o PDN.
   Proposta: Kanban continua, mas só como visão **mobile** (desktop abre direto na planilha, sem o botão).
2. **Aba Arquivados x Descarte do pipeline** — lista os caídos do mês com "reativar". O pipeline já é dono disso.
   Proposta: vira **filtro** ("mostrar caídos") na própria planilha, não uma aba.
3. **Aba Conferência de Visitas x Agenda de Visitas** — auditoria de visitas do mês. É boa, mas não é PDN: é conferência de visitas.
   Proposta: mover para a Agenda de Visitas (aba "Conferência do mês") e sair do PDN.
4. **"Em risco" (+7d parado) x página Leads Estagnados** — mesma regra, dois lugares. Manter no PDN (é o KPI de ação do gestor) e deixar a página como visão global; sem mudança de código.
5. **Drawer próprio do PDN (Contexto / Ação / Etapa) x drawer do lead no pipeline** — dois detalhes de lead para manter em paralelo, contra a diretriz "Tudo no Lead".
   Proposta: manter o drawer do PDN só com **Observação + Status + Mudar etapa** e, para o resto, botão "Abrir no pipeline".
6. **Aba Meta do mês** — não sobrepõe nada e é usada pelo gestor. **Manter.**

## O que fica (núcleo do PDN)

- Planilha por grupo (Pós-Visita → Negociação → Contrato → Ganho) com VGV, corretor, empreendimento vindos do pipeline.
- Observação + status internos do gestor.
- Mudar etapa / marcar queda / regredir com motivo — escrevendo no pipeline real.
- KPIs, forecast ponderado, "em risco", resumo por corretor, exportação.
- Reconciliação PDN x Negócios (recolhida) e Meta do mês.

## Plano de execução (fases pequenas, validadas uma a uma)

**Fase 1 — Enxugar a interface (só frontend, sem banco)**
- Aba "Arquivados" vira filtro na planilha.
- Aba "Conferência de Visitas" sai do PDN (o componente é reaproveitado na Agenda de Visitas).
- Kanban só no mobile.
- Drawer do PDN reduzido a Observação + Status + Etapa + "Abrir no pipeline".
- Remover dos formulários os campos mortos (próxima ação, prioridade, risco manual, corretor avisado).

**Fase 2 — Conferência do mês na Agenda de Visitas (frontend)**
- Nova aba na Agenda reusando `useConferenciaVisitas`, com os mesmos baldes (pós-visita / avançou / regrediu / caiu).

**Fase 3 — Limpeza de banco (1 migration, fora do horário de pico)**
- `DROP COLUMN` em `pdn_entries`: `proxima_acao`, `proxima_acao_data`, `prioridade`, `risco_manual`, `risco_motivo`, `corretor_avisado_em`, `corretor_avisado_etapa`.
- Remover a FK morta `visitas.linked_pdn_id`.
- Nada em `pipeline_leads`, `negocios` ou nas regras de VGV é tocado.

**Fase 4 — Validação ao vivo**
- Conferir, mês a mês (jun/jul/ago): PDN Ganho == Vendas Realizadas; VGV idêntico antes e depois; observações de julho e agosto preservadas; mover card no PDN continua refletindo no pipeline e vice-versa.

## O que NÃO muda

Regra de VGV (`fase='ganho' + status='ativo' + data_assinatura`), `v_pdn_linhas`, `negocios`, `pipeline_leads`, metas do gerente, relatórios e Vendas Realizadas.

## Decisões que preciso de você

1. Conferência de Visitas: **mover** para a Agenda (recomendado) ou **manter** no PDN?
2. Kanban: só mobile (recomendado) ou continua nos dois?
3. Fase 3 (apagar colunas mortas): pode, ou prefere deixar as colunas paradas mais um mês?
