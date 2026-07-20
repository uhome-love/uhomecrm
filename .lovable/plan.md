
# Fase B — Presets de Tarefa Manual

Objetivo: acabar com "digitar descrição da próxima tarefa no braço". O corretor escolhe um **preset** (chip) e o sistema preenche descrição, tipo, prazo default e — quando fizer sentido — atualiza o `flag_status` do lead automaticamente. Isso elimina o campo "Status do atendimento" redundante em Qualificação e Negociação.

## 1) Catálogo canônico (fonte única)

Novo arquivo `src/lib/taskPresets.ts` — 10 presets, agrupados por etapa:

```text
Qualificação
  • Alinhar perfil          → tipo=ligacao,  +1 dia útil, syncStatus=alinhamento_perfil
  • Buscar imóveis          → tipo=tarefa,   +2 dias,     syncStatus=busca
  • Enviar imóveis          → tipo=whatsapp, +1 dia,      syncStatus=envio_opcoes
  • Follow-up               → tipo=whatsapp, +2 dias,     syncStatus=follow_up
  • Alinhar visita          → tipo=ligacao,  +1 dia,      syncStatus=alinhando_visita

Aquecimento
  • Retomar contato         → tipo=whatsapp, prazo=prazo_aquecimento (30/60/90), syncStatus=null

Negociação
  • Enviar proposta         → tipo=tarefa,   +1 dia,      syncStatus=proposta_enviada
  • Cobrar retorno proposta → tipo=whatsapp, +2 dias,     syncStatus=null
  • Acompanhar aprovação    → tipo=tarefa,   +3 dias,     syncStatus=aprovacao_bancaria

Geral (todas as etapas exceto Visita/Contrato)
  • Outro (livre)           → abre input de texto tradicional
```

Cada preset é `{ id, label, icon, tipo, prazoDias, syncFlagKey, syncFlagValue, etapas[] }`. Uma única fonte, importada pelo popup de conclusão e por qualquer botão "+ Nova tarefa" manual.

## 2) UI — Popup de conclusão (CompletionForm)

Na seção "Agendar próxima tarefa":
- Substituir o `Select` de tipo + textarea livre por uma **grade de chips** com os presets da etapa atual do lead.
- Ao clicar em um chip: preenche `descricao`, `tipo` e `data_prevista` (com hora default 09:00 BRT). Continua editável.
- Chip "Outro" volta ao modo atual (texto livre).
- Se o preset tiver `syncFlagValue`, ao concluir a tarefa o `flag_status[syncFlagKey]` do lead é atualizado no mesmo update.

## 3) Remoção do "Status do atendimento" redundante

- Em Qualificação e Negociação, o bloco "Status da etapa (obrigatório)" do popup de conclusão **sai**. O status passa a vir do preset escolhido.
- Se o corretor escolher "Outro", pedimos o status por pill como hoje (fallback, sem quebra).
- No `QualificacaoEtapaCard` do drawer: o pill de status atual continua **visível como leitura** (mostra o que a última tarefa/preset gravou). Editar continua possível pelo Checklist.

## 4) Fase B.1 — Checklist bug (item 3 do usuário)

Investigar e corrigir por que o checklist "não está funcionando direito" em Qualificação no drawer. Provável causa: com a Fase A hidratamos só ao abrir, mas o toggle dos chips de bairros/tipo pode não estar disparando `onChange` no formato esperado. Fazer sweep no `QualificacaoChecklistCard` — garantir que cada campo (faixa_valor, prazo_decisao, forma_pagamento, regioes, tipos) marca `dirty` e persiste no `handleSave`.

## Escopo fora desta fase
- Não mexer no fluxo de Visita (fixo, automático).
- Não mexer em Sem Contato (sem tarefa manual).
- Não criar edge function nova.
- Sem migração de banco — `flag_status` já é JSONB flexível.

## Ordem de entrega
1. `taskPresets.ts` + tipos.
2. Refactor da seção "Próxima tarefa" no `CompletionForm.tsx`.
3. Remover bloco "Status da etapa" redundante e cabear syncStatus no save.
4. Bugfix do `QualificacaoChecklistCard`.
5. Validar ao vivo com lead de teste em Qualificação, Aquecimento e Negociação (sempre cancelando ao fim).

Confirma que posso seguir?
