## Objetivo

Deixar a página `/leads-estagnados` clara para os gerentes: renomear e reordenar as abas e adicionar uma explicação simples em cada uma. Mudança apenas de UI/texto em `src/pages/LeadsEstagnados.tsx`.

## Nova ordem e nomes das abas

A ordem e os rótulos passam a ser (o valor interno/categoria não muda, só o label e a posição):

1. **Estagnados** (`estagnado`) — já estagnaram de fato.
2. **Em aviso (48h)** (`em_aviso`) — em aviso, prestes a estagnar.
3. **Em alerta** (`candidato`) — já passou do prazo da etapa e vai receber o aviso de 48h.
4. **Em parceria** (`em_parceria`) — inalterado.

Ou seja: o array `TABS` (linhas 55-58) será reordenado e renomeado:
```
{ value: "estagnado",   label: "Estagnados" }
{ value: "em_aviso",    label: "Em aviso (48h)" }
{ value: "candidato",   label: "Em alerta" }
{ value: "em_parceria", label: "Em parceria" }
```

## Banner explicativo por aba

Hoje só a aba "Em parceria" tem banner (linhas 222-229). Substituir por um mapa `TAB_INFO` com `{ icon, texto }` por categoria, renderizando o banner da aba ativa:

- **Estagnados** (`estagnado`) — ícone `AlarmClock`:
  "Já estagnaram. Passaram do prazo da etapa e ficaram mais 48h sem nenhuma ação do corretor. Saíram do pipeline (arquivados) e aguardam sua decisão: Devolver, Repassar, Roleta ou Descartar."

- **Em aviso (48h)** (`em_aviso`) — ícone `AlertTriangle`:
  "Prestes a estagnar. Estão na contagem final de 48h e o corretor já foi avisado. Se ele não agir até o prazo (mostrado em cada lead), o lead estagna automaticamente e vai para a aba 'Estagnados'."

- **Em alerta** (`candidato`) — ícone `Clock`:
  "Já passaram do limite de dias da etapa, mas ainda não estagnaram. Continuam no pipeline do corretor. Em breve recebem o aviso de 48h. Se o corretor agir (ligar, WhatsApp, criar/concluir tarefa) o prazo zera."

- **Em parceria** (`em_parceria`) — ícone `Users` (texto atual mantido).

## Detalhes de implementação

- Reordenar/renomear o array `TABS`.
- Trocar o bloco condicional do banner (só `em_parceria`) por renderização baseada em `TAB_INFO[tab]`.
- Conferir imports de `lucide-react` e adicionar `AlertTriangle`/`Clock` se faltarem.
- Encurtar o `subtitle` do `PageHeader` para algo genérico (ex.: "Gestão dos leads parados no pipeline, por etapa de risco."), já que a explicação detalhada fica no banner.

Nenhuma alteração em RPCs, lógica de estagnação ou banco — apenas ordem, rótulos e textos na interface.
