# Corrigir o nome da campanha na tela do corretor

## O que está acontecendo

O card "Campanha do dia" mostra **Base Única** porque hoje ele exibe o campo *empreendimento* da lista, e não o nome da campanha.

Estado real das 4 campanhas liberadas:

| Nome da campanha (correto) | Empreendimento gravado (o que aparece hoje) |
|---|---|
| Campanha de Investimento - Agosto 2026 | Base Única |
| Golden Lake - Time Lake | Base Única |
| Alto Lindóia · Lista de Leads | Alto Lindóia |
| Casa Tua Porto Alegre · Campanha Terraço | Casa Tua Porto Alegre |

"Base Única" é o rótulo que as campanhas criadas a partir da Base Única de Leads recebem como "empreendimento" — não é o nome da campanha. Por isso duas campanhas diferentes aparecem com o mesmo título para o corretor.

## O que vai mudar

Na entrada do corretor (Oferta Ativa), o título passa a ser o **nome da campanha**, e o empreendimento vira uma linha de apoio só quando for um produto de verdade:

```text
🚀 CAMPANHA DO DIA
Campanha de Investimento - Agosto 2026     [ Ligar agora ]
🎯 Reativação de investimento
👥 3902 leads na fila · 3 aproveitados · expira em 35d
```

Para campanhas ligadas a um empreendimento real, o produto continua visível:

```text
🚀 CAMPANHA DO DIA
Casa Tua Porto Alegre · Campanha Terraço
Casa Tua Porto Alegre
```

O mesmo ajuste vale para a lista "Outras campanhas liberadas", que hoje também prioriza o empreendimento.

## Detalhes técnicos

- Arquivo único: `src/components/oferta-ativa/CorretorEntrada.tsx`.
- Título do destaque (linha 134) e das outras campanhas (linha 196): trocar a ordem de `empreendimento || nome` para `nome || empreendimento`.
- Adicionar subtítulo com o empreendimento apenas quando ele existir e for diferente do rótulo genérico "Base Única".
- **Não mexer** no `ScriptPanel`: ele continua recebendo `destaque.empreendimento`, porque o script da ligação é buscado pelo produto. Quando o empreendimento é "Base Única" o comportamento do script fica exatamente como está hoje.
- Nenhuma mudança de banco, RLS, hook ou query — é só apresentação.

## Fora do escopo

Renomear o campo "Base Única" no banco ou na criação de campanhas. Se quiser, dá para tratar num passo seguinte (ex.: campanhas da Base Única gravarem o produto real quando houver um).
