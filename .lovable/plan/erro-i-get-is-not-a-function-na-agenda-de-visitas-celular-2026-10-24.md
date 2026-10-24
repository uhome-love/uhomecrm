# Erro "i.get is not a function" na Agenda de Visitas (celular)

## O que está acontecendo
- O selo de "Parceria" (criado ontem) busca a lista de parcerias e guarda num formato especial de lista (Map).
- O CRM guarda os dados no aparelho para abrir mais rápido. Esse formato especial não sobrevive a esse armazenamento: quando o corretor reabre o app, a lista volta "vazia por dentro" e a Agenda quebra com "Erro inesperado".
- Por isso acontece mais no celular (app fica aberto/reaberto com dados guardados). A mesma falha pode atingir os outros lugares que mostram o selo (cartão do cliente, cartão do negócio, histórico de visitas).

## Correção
1. Guardar as parcerias num formato simples, que sobrevive ao armazenamento do aparelho, e trocar o nome do registro guardado para descartar o dado estragado que já está nos celulares.
2. Ajustar os 4 lugares que leem essa lista para usar o formato novo.
3. Nenhuma mudança no banco, nas regras de parceria ou na contagem da Roleta.

## Validação
- Abrir a Agenda no tamanho de celular como corretor, recarregar a página (simulando reabrir o app) e conferir que abre sem erro e mostra o selo.
- Conferir cartão do cliente, cartão do negócio e histórico de visitas.
- Depois é preciso publicar; o corretor só precisa reabrir o app.

## Detalhes técnicos
- `useParceriasAtivas` retorna `Map`; o PersistQueryClient (IDB) serializa para `{}` → `.get` indefinido após hidratação.
- Retornar `Record<string, ParceriaAtiva[]>`, queryKey `parcerias-ativas-mapa-v2`; consumidores (`AgendaVisitas.tsx`, `NegociosBoardInline.tsx`, `DrawerVisitsTab.tsx`, cartão do pipeline) passam a usar `mapa?.[id]`.
