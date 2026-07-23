# Correção: erro "Edge Function returned a non-2xx status code" ao registrar "Não atendeu" no Mutirão ao Vivo

## Diagnóstico confirmado

O erro aconteceu por volta das 11:57 BRT (14:57 UTC) quando o corretor Ebert Silva clicou em **Não atendeu** no card do Mutirão. A mensagem exibida foi genérica: **"Edge Function returned a non-2xx status code"**, dentro da área de script do card.

Causa raiz identificada: **estado stale + concorrência**. O lead que Ebert tinha na tela já não existia mais na fila `oferta_ativa_fila` no momento do clique. A fila pode ter sido removida/alterada por um aproveitamento de outro corretor, por um pulo, ou por uma atualização de cooldown. O backend `oferta-ativa-registrar-resultado` retorna **404 "fila not found"**, mas o cliente `useMutiraoSession.ts` não extrai o corpo da resposta de erro, então o Supabase Functions exibe a mensagem genérica.

A tabela `oferta_ativa_ligacoes` mostra que Ebert conseguiu registrar resultados em outros horários (15:01 e 15:03 UTC), portanto o erro é intermitente e condicionado à concorrência/fila removida.

## O que será alterado

### 1. Backend — tratar "lead já sumiu da fila" como caso esperado

Em `supabase/functions/oferta-ativa-registrar-resultado/index.ts`, quando a fila (`fila_id`) não for encontrada, o endpoint retornará **HTTP 200** com:

```json
{
  "ok": false,
  "code": "LEAD_GONE",
  "reason": "Este lead não está mais disponível na fila. Buscando o próximo..."
}
```

Isso diferencia erros de concorrência (esperados) de erros reais de autenticação/lock (404/409/500). Mantém-se 404/409 quando o lock não pertence ao corretor ou quando há parâmetros inválidos.

### 2. Frontend — interpretar `LEAD_GONE` como "avançar para o próximo"

Em `src/hooks/useMutiraoSession.ts`, a mutation `registrarM` passará a tratar o código `LEAD_GONE` como sucesso parcial:

- Não exibir toast de erro.
- Invalidar queries de ranking/participantes/histórico.
- Chamar `applyOptimisticAndFetch()` para buscar o próximo lead automaticamente.

Para outros erros, o código tentará extrair a mensagem real do corpo da resposta (`error.context?.json()`) antes de cair na mensagem genérica do Supabase Functions.

### 3. Frontend — impedir ação sobre lock não confirmado

Em `src/components/oferta-ativa-ao-vivo/LeadCard.tsx`, os botões de ação (incluindo **Não atendeu**) já respeitam `lockConfirmed`, mas será reforçado:

- Se o lock ainda não estiver confirmado (`lockConfirmed === false`), o botão mostrará spinner/desabilitado e exibirá tooltip "Aguardando lock do lead...".
- Quando o backend informar `LEAD_GONE`, o card transitará automaticamente para o próximo lead, sem exigir novo clique do corretor.

### 4. Backend — logs detalhados para auditoria

Adicionar `console.error` estruturado em `oferta-ativa-registrar-resultado` para cada caminho de erro, incluindo `fila_id`, `corretor_id`, `sessao_id`, e resultado. Isso permitirá rastrear futuras ocorrências sem depender de inferência.

## Validação ponta a ponta

1. Criar/ativar uma sessão de teste em ambiente de preview (usando a aba Configurações).
2. Popular a fila com leads de teste.
3. Simular o fluxo:
   - Corretor A abre o Mutirão e recebe lead X.
   - Corretor B (ou admin) remove o lead X da fila (aproveitamento/pulo).
   - Corretor A clica em **Não atendeu**.
   - Esperado: mensagem informativa "Lead não está mais disponível. Buscando o próximo..." e avanço automático, sem toast de erro genérico.
4. Verificar que o ranking, histórico e participantes continuam atualizando normalmente.

## Arquivos que serão editados

- `supabase/functions/oferta-ativa-registrar-resultado/index.ts`
- `src/hooks/useMutiraoSession.ts`
- `src/components/oferta-ativa-ao-vivo/LeadCard.tsx` (reforço de guarda e mensagem)

## Riscos / cuidados

- Não alterar o fluxo normal de registro de resultado (ligação, sem interesse, aproveitado, visita).
- Manter o comportamento de `pulado` e `sem_interesse`.
- Garantir que o refresh automático do Service Worker não interfira na experiência durante a ligação (já há `useMutiraoUpdateGuard`).
- Não exibir o alerta como erro crítico para o corretor; tratar como "lead já foi pego por outro".
