# Melhoria 4 — paginar a linha do tempo do Detalhe do Lead

Hoje a linha do tempo do lead é montada inteira em memória, mas o render corta em 30 itens fixos e não existe nenhuma forma de ver o resto. Em leads com muita atividade, o histórico antigo simplesmente não aparece. A correção é adicionar um "Carregar mais" que revela mais 30 itens por clique.

## O que muda para o corretor

- A timeline continua começando com os 30 eventos mais recentes.
- Quando houver mais que isso, aparece abaixo da lista um botão discreto "Carregar mais" com o contador "mostrando 30 de 187".
- Cada clique revela mais 30 eventos, sem recarregar nada e sem nova consulta.
- Ao abrir outro lead, a timeline volta a começar do topo com 30.

## Arquivos tocados

- `src/components/pipeline/LeadHistoricoTab.tsx` — único arquivo alterado.
- `src/components/pipeline/drawer/DrawerTimelineGroup.tsx` — **verificado, sem alteração**: o componente não impõe limite próprio, só agrupa por dia e renderiza tudo que recebe.

## Diff conceitual

```text
+ const [visibleCount, setVisibleCount] = useState(30);
+ useEffect(() => { setVisibleCount(30); }, [leadId]);

- items={timeline.slice(0, 30).map(...)}
+ items={timeline.slice(0, visibleCount).map(...)}

  </DrawerTimelineGroup>
+ {timeline.length > visibleCount && (
+   <botão "Carregar mais" (variant outline/secundário, largura total, texto xs)
+    + linha "mostrando {visibleCount} de {timeline.length}">
+   onClick={() => setVisibleCount(c => c + 30)}
+ )}
```

O botão fica dentro do mesmo bloco `px-7` da timeline, logo abaixo do `<DrawerTimelineGroup>`, no padrão visual atual do drawer.

## O que NÃO é tocado

- `buildTimeline`, as fontes (histórico, atividades, tarefas, imóvel-events, anotações, visita_eventos) e a ordenação desc por data: intactos.
- Modal "Novo histórico", exclusão de item (`deleteTarget`), agrupamento por dia, contadores do cabeçalho: intactos.
- **Sem migration, sem alteração de dados, sem query nova ao banco** — a lista já está inteira em memória; só se renderiza mais dela.

## Performance

Incremento de 30 em 30 sobre um array já montado; nenhum fetch adicional e nenhum recálculo das fontes.
