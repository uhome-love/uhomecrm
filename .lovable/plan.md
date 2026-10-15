# Tarefas — nome do cliente em destaque e cartão mais organizado

## Novo desenho de cada tarefa

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ 09:00     Nilton Goulart                         [Qualificação]   💬 📞 ↗  ✓ │
│ ATRASADA  Próximo contato · Casa Tua Canoas · última ação ontem              │
│          ┌──────────────────────────────────────────────────────────────┐    │
│          │ 23/09 · Visita   "Imóvel: Lake Baikal"                        │    │
│          │ ▸ Ver mais 2 registros                                        │    │
│          └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Nome do cliente vira a primeira linha**, maior e em negrito. O que fazer (ex.: "Próximo contato", "WhatsApp", "Decidir descarte") passa para a segunda linha, com o empreendimento e a última ação.
- O título deixa de repetir o nome ("Próximo contato: Nilton Goulart" vira só "Próximo contato").
- **Etiqueta da etapa** fica alinhada à direita do nome, com o substatus quando houver.
- **Último registro numa caixinha cinza clara**, separada do resto: data e tipo à esquerda, texto em seguida. "Ver mais X registros" fica dentro da caixinha.
- **Botões mais compactos:** WhatsApp, Ligar e Abrir lead viram ícones do mesmo tamanho; "Concluir" continua com texto. As linhas ficam mais baixas.
- **Borda vermelha só na lateral esquerda** para atrasadas, em vez do contorno inteiro, deixando a lista menos pesada.
- Tarefas sem cliente (anotação pessoal) mantêm o título como primeira linha.

Nada muda em regras, abas, ordem ou no Concluir.

## Validação
Abrir Tarefas no preview pela conta da Rafaela, só olhando, e conferir que o nome aparece em destaque, que o registro aparece na caixinha e que nada quebra no celular.

## Detalhes técnicos
- Só `TarefaRow.tsx` e `MiniHistorico.tsx`. Remover do título o trecho ": {nome}" quando bater com o nome do lead.
- Cores apenas com tokens do tema (`bg-muted/50`, `border-l-destructive`, `text-foreground`).
- Botões de ícone com `aria-label` e tooltip "Abrir lead".
