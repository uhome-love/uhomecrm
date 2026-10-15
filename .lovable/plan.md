# Tarefas — etapa do lead + mini histórico em cada tarefa

## O que o corretor vai ver
Em todas as abas de Tarefas (Vencidas, Hoje, Próximas, Novas), cada tarefa ganha:

```text
09:00   Próximo contato: Nilton Goulart   [🔎 Qualificação · busca]     💬 📞 Abrir lead  ✓ Concluir
ATRAS.  Nilton Goulart · Casa Tua Canoas · última ação há 3 dias
        Último: 12/10 · WhatsApp · atendeu — "Pediu planta do 2 dorms, vai ver com a esposa"
        ▸ Ver últimos registros (3)
           09/10 · Ligação · não atendeu
           08/10 · Nota — "Renda R$ 6 mil, quer até R$ 300 mil"
```

- **Etiqueta da etapa** do Pipeline, com o ícone e o substatus (ex.: "Visita · no-show"), igual ao Pipeline.
- **Última ação há X dias** (fica vermelho acima de 7 dias ou sem nenhuma ação).
- **Último registro em 1 linha**, sempre visível: data, tipo de contato, resultado e o texto.
- **"Ver últimos registros"** abre na própria linha os 3 mais recentes (contatos e anotações), sem sair da tela.
- Os botões WhatsApp, Ligar, Abrir lead e Concluir continuam iguais. Concluir continua pedindo tipo de contato + observação.

Nada muda em quais tarefas aparecem, na ordem nem nas regras. Tarefas de anotação pessoal (sem cliente) ficam como estão.

## Validação
Abrir /tarefas no preview com uma conta de corretor, conferir em 2 ou 3 tarefas se a etapa e o último registro batem com o que aparece dentro do lead. Sem concluir nem alterar nada.

## Detalhes técnicos
- `useMinhasTarefas`: incluir no select do lead `stage_id, flag_status, ultima_acao_at`; mapear o nome e o ícone da etapa com `pipeline_stages` + helpers de `leadHelpers.ts` (mesmo do "Sem próximo passo").
- Novo hook `useMiniHistorico(leadIds)`: uma consulta em lote em `pipeline_atividades` (concluídas: tipo_contato, resultado, descricao, created_at) e `pipeline_anotacoes` (conteudo, created_at) para os leads das tarefas visíveis; junta, ordena e guarda os 3 mais recentes por lead. Usa os índices `(pipeline_lead_id, created_at desc)` existentes; pagina em blocos de 1000.
- `TarefaRow.tsx`: chip da etapa, linha "última ação", linha "Último:" e expansão local (estado por linha). Componente novo `MiniHistorico.tsx` para manter o arquivo pequeno.
- Datas em BRT. Sem migração, sem função no servidor, sem mudança de RLS.
