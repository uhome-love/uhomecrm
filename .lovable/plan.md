# Douglas na roleta — diagnóstico e correção

## O que os dados mostram

**1. Os registros de atividade DO Douglas funcionaram.** Consultei as atividades dele nos últimos 3 dias: hoje (18/08) há ~40 registros (WhatsApp, Liguei, Visita agendada/realizada) e em todos eles o `ultimo_toque_at` do lead foi carimbado com o mesmo horário do registro. Só 1 registro entrou como "Nota" (Tatiele Mattos, 13:50) — nota não conta como toque, mesmo comportamento que já corrigimos no caso da Andreza.

Resultado hoje: **0 leads vermelhos** e 10 leads sem tarefa pendente. Ou seja, ele arrumou a carteira.

**2. O bloqueio dele NÃO é por leads desatualizados — é pelo teto de descartes do mês.**
- `corretor_pode_entrar_roleta` = false
- `contar_leads_vermelhos` = 0 (e o limite de vermelhos só vale para a roleta noturna)
- descartes no mês de agosto = **100**, e o limite (`limite_descartes_mes`) é **100** → a regra bloqueia em `>= limite`

Por isso, mesmo depois dele atualizar tudo, a roleta continuou fechada: ele bateu exatamente o teto de descartes.

**3. Outros casos.** Ninguém mais está bloqueado hoje. Próximos do teto em agosto: Andressa Madril 76, Thalia de Oliveira 73, Marcos Aurelio Farias 70, Adriana Kaiser 63. Não há nenhum desbloqueio manual registrado neste mês.

## O que proponho fazer

### Fase 1 — Destravar o Douglas (decisão sua)
Opção A: registrar um desbloqueio manual de agosto para ele (a tela Gestão da Roleta > Corretores Bloqueados já faz isso; posso fazer pelo banco se preferir).
Opção B: não destravar e manter o teto valendo.

Preciso da sua decisão antes de executar.

### Fase 2 — Deixar o motivo do bloqueio explícito para o corretor
Hoje o corretor vê a tela de elegibilidade, mas o time entendeu o bloqueio como "leads desatualizados". Ajuste em `StatusElegibilidadeRoleta.tsx`:
- Quando o bloqueio for por descarte, mostrar em destaque no topo: "Roleta bloqueada: você atingiu o teto de X descartes em agosto. Fale com seu gestor para desbloqueio." — separado e acima do bloco de leads desatualizados.
- Quando não houver bloqueio nenhum, deixar claro "Você está apto".

### Fase 3 — Aviso para quem está chegando perto
No painel do gestor (`CorretoresBloqueadosPanel.tsx`), listar também quem está em zona de risco (>= 70% do teto) com badge âmbar, para o gestor agir antes do bloqueio.

## Notas técnicas
- Regra atual: `corretor_pode_entrar_roleta` bloqueia com `v_descartes_mes >= v_limite_descartes` (100), contando `pipeline_leads` em stage tipo `descarte` com `stage_changed_at` no mês corrente.
- Limite de vermelhos (10) só é avaliado quando a janela é `noturna` (`limite_vermelhos_apenas_noturna = true`).
- Nenhuma migration é necessária nas fases 2 e 3 — são só ajustes de UI.
