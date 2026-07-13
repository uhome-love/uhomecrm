## Objetivo

Na seção **"Envios sendo processados"** (aba Ao vivo, `AuditoriaWebhookTab.tsx`):
1. Adicionar a pílula **Lido** com a contagem de mensagens já lidas.
2. Tornar as pílulas (**Enviando**, **Enviados**, **Falhas**, **Ignorados**, **Lido**) clicáveis para **filtrar a tabela** abaixo. Clicar de novo na pílula ativa limpa o filtro.

## Como funciona hoje

A tabela lê `reengajamento_dispatch_queue` (status: pending/processing/sent/failed/skipped/suppressed/cancelled). Esses status **não incluem "lido"** — o "lido" vive em `reengajamento_meta_disparos.read_at` (correlacionado por `wamid` e `run_id`).

## Mudanças (somente `src/components/central-nutricao/AuditoriaWebhookTab.tsx`)

1. **Enriquecer os dados da fila com "lido":**
   - Adicionar um `useQuery` (ou estender o existente) que busca de `reengajamento_meta_disparos` para os mesmos `queueRunIds`, selecionando `wamid, read_at, delivered_at, responded_at`.
   - Montar um mapa `wamid → read_at` e derivar, para cada linha da fila, um flag `isRead` (quando existe `read_at`).
   - Mesmo `refetchInterval` da fila (3s com run ativo, 10s caso contrário).

2. **Estatísticas:** adicionar `lido` ao `queueStats` (contagem de linhas com `isRead`).

3. **Estado de filtro:** novo estado `queueFilter` (`'all' | 'processing' | 'sent' | 'failed' | 'skipped' | 'read'`), default `'all'`. Derivar `filteredQueue` aplicando o filtro sobre `queueActivity`:
   - `processing/sent/failed` → por `status`
   - `skipped` → status em skipped/suppressed/cancelled
   - `read` → linhas com `isRead`

4. **Pílulas clicáveis:** transformar cada `Badge` num botão (`button`/`onClick`) que seta `queueFilter`; clicar na pílula já ativa volta para `'all'`. A pílula ativa recebe destaque visual (borda/anel mais forte). Adicionar a pílula **Lido** (esquema de cor violeta/roxo, coerente com o design system). Incluir uma pílula/estado "Todos" para limpar, ou usar o clique-para-alternar.

5. **Coluna Status/Resultado:** exibir "Lido" quando `isRead` (badge dedicado no `QUEUE_STATUS` ou tratamento inline), mantendo o restante igual.

6. A tabela passa a renderizar `filteredQueue` em vez de `queueActivity`; ajustar o empty-state para o caso de filtro sem resultados.

## Validação
- `tsgo` para checagem de tipos.
- Conferir no preview que as pílulas filtram a tabela e que a contagem de **Lido** aparece com base em `read_at`.
