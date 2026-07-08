# Corrigir prévia por segmento na Fila CEO

## Problema
Na Fila CEO, o cartão "S1 - Moradia" mostra "1 leads" mas nenhum nome de imóvel/origem, enquanto "S2 - Investimento" mostra "Connect JW". Isso acontece porque leads de S1 vindos de ImóvelWeb/site (ou sem empreendimento cadastrado) têm `empreendimento` vazio, e a prévia só concatena esse campo — resultando em texto em branco.

## Solução
No arquivo `src/components/pipeline/FilaCeoDispatchModal.tsx`, no cálculo da prévia (`useMemo` que monta `groups`), gerar um rótulo legível para cada lead em vez de usar apenas `lead.empreendimento`:

- Se `lead.empreendimento` estiver preenchido → usar o nome do empreendimento (comportamento atual).
- Se estiver vazio, derivar o rótulo a partir de `lead.origem`:
  - origem contém `imovelweb` → "ImóvelWeb"
  - origem contém `site` → "Site"
  - caso contrário → "Avulso"

Assim cada segmento na prévia sempre mostra de onde vieram os leads (ex.: "S1 - Moradia · ImóvelWeb, Site" em vez de vazio).

Adicionalmente, quando um segmento agrupar vários rótulos, exibir contagem por rótulo (ex.: "ImóvelWeb (1), Casa Tua (2)") para o CEO saber exatamente o que está disparando.

## Detalhes técnicos
- Alterar a estrutura de agregação para contar por rótulo dentro de cada segmento (usar um `Map<string, number>` por grupo em vez de um array de nomes únicos).
- Atualizar a renderização da linha `p.empreendimentos.join(", ")` para exibir os rótulos com suas contagens.
- Nenhuma mudança de banco de dados ou de lógica de distribuição — apenas apresentação da prévia.
