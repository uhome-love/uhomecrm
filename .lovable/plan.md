# Narrativa do lead demora a carregar (visão CEO)

## O que encontrei

O banco não é o gargalo: as tabelas da História são pequenas (atividades 59k, tarefas 52k, histórico 37k, anotações 3,5k, eventos de visita 2,4k) e todas têm índice por `pipeline_lead_id`. O problema é o jeito como o modal busca os dados.

Hoje, ao abrir o lead, a Narrativa só aparece depois de **três ondas de requisições em sequência**:

1. Onda 1 (ao abrir): atividades, anotações, tarefas e histórico — em paralelo.
2. Onda 2 (só depois que a onda 1 volta): busca os **nomes** dos autores em `profiles`, porque os IDs saem da onda 1.
3. Onda 3 (em paralelo, mas fora do cache): eventos de visita e checagem de conversa da LIA, disparados por `useEffect` próprios.

Enquanto isso a aba não mostra estado de carregamento — ela fica vazia/incompleta e depois "pula" com os nomes preenchidos, o que dá a sensação de lentidão. Nada disso é pré-carregado: a busca só começa quando o drawer já está abrindo.

Por que é pior na visão CEO: o board do CEO carrega muito mais leads e mantém a tela pesada, então o trabalho de render concorre com a chegada dos dados; e o CEO abre leads de qualquer corretor, sempre "frios" no cache.

## Correção proposta (só frontend, sem migration)

1. **Uma onda só de dados**
   Trazer eventos de visita e a checagem da LIA para dentro do mesmo lote paralelo das outras quatro consultas, em vez de `useEffect` separados depois da montagem.

2. **Acabar com a espera pelos nomes**
   Carregar o mapa de nomes de usuários uma vez por sessão (cache compartilhado e longo, já que muda raramente), em vez de consultar `profiles` a cada lead aberto e só depois que a lista de atividades chega. Assim os autores já aparecem no primeiro render.

3. **Pré-carregar ao clicar/passar o mouse no card**
   Disparar o carregamento dos dados do lead assim que o card é clicado (e no hover, em desktop), de modo que os dados cheguem junto com a animação de abertura do drawer.

4. **Estado de carregamento honesto**
   Enquanto os dados não chegam, a Narrativa mostra um esqueleto (3–4 linhas) em vez de vazio; ao reabrir o mesmo lead, mostra o conteúdo em cache imediatamente e revalida em segundo plano.

## Validação

- Abrir 3 leads diferentes no preview como CEO e medir o tempo até a Narrativa aparecer, antes e depois.
- Conferir que os nomes dos autores aparecem já no primeiro render (sem o "pulo").
- Conferir que eventos de visita e a aba Conversa LIA continuam aparecendo quando existem.
- Conferir que registrar atividade/anotação continua atualizando a Narrativa na hora.

## Detalhes técnicos

- `src/hooks/usePipelineLeadData.ts`: incluir `visita_eventos` e `lia_estado` no `Promise.all` da query `lead-detail-data`; expor no retorno.
- `src/components/pipeline/LeadHistoricoTab.tsx`: remover os dois `useEffect` de fetch (visita_eventos e o `useQuery` de `lia_estado`) e o fetch de `profiles`; consumir os dados vindos do hook; adicionar skeleton quando `loading`.
- Novo hook de cache de nomes (`useProfileNames`) com `staleTime` alto, consultado uma vez e reaproveitado por todos os leads.
- `src/pages/PipelineKanban.tsx` / card do lead: `queryClient.prefetchQuery(["lead-detail-data", leadId, userId])` no `onMouseEnter`/`onClick`.
- Manter `staleTime` atual (20s) e a invalidação existente via `reload()`.
