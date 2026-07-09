# Corrigir botões Pausar/Parar do disparo de Reengajamento

## Causa raiz (por que "continua rodando")

O disparo roda em **micro-lotes**: cada execução processa um lote e, ao atingir o limite de tempo, se re-invoca automaticamente (continuação) com `force: true`.

Na edge function `reengajamento-descartados-enqueue` (linhas ~355–363), **toda** chamada com `force: true` executa:

```ts
if (force) {
  update reengajamento_config set paused=false, paused_until_release=false, paused_reason=null ...
}
```

Como as continuações automáticas usam `force: true`, cada novo micro-lote **apaga o "paused" que o usuário acabou de marcar** e retoma o envio. Por isso o botão "Pausar" parece não funcionar: ele pausa por alguns segundos e o próprio disparo se "despausa" no lote seguinte.

Além disso, **não existe botão "Parar"** de fato na tela — só "Pausar agora". O backend já suporta cancelamento via a coluna `cancel_requested` (a função `shouldStopNow` verifica isso), mas nada na UI seta esse campo.

## Correções

### 1. Edge function `reengajamento-descartados-enqueue` (backend — o fix principal)
- Detectar **continuação** vs **início manual**: é continuação quando há `run_id` no body (`bodyRunId`) OU quando `iniciado_por` termina com `_continuacao`.
- Só limpar os campos de pausa (`paused`, `paused_until_release`, `paused_reason`, `guard_reset_at`) quando for `force` **e não** for continuação. Assim, um disparo manual novo ainda começa limpo, mas as continuações **respeitam** a pausa/cancelamento do usuário.
- Reforço: no começo de uma continuação, se `config.paused` ou `run.cancel_requested` estiverem ativos, encerrar o run (status `paused`/`cancelled`) e não processar mais nada — em vez de depender só da checagem no primeiro lead.

Resultado: ao clicar "Pausar", o lote atual termina a mensagem em andamento e o disparo **não recomeça** no próximo micro-lote.

### 2. Frontend `ReengajamentoTab.tsx` — adicionar botão "Parar disparo"
- Nova função `pararDisparo()` (cancelamento definitivo):
  - Seta `cancel_requested = true` no run ativo.
  - Seta `paused = true` no `reengajamento_config` (impede reinício por continuação/janela).
  - Atualiza o run para status `cancelled` de forma otimista + invalida as queries.
  - Toast: "⏹️ Parada solicitada — encerra após a mensagem atual".
- Colocar o botão "Parar" ao lado de "Pausar agora" no painel "Disparo em andamento" (linha ~623) e na barra de ações (linha ~1049). "Pausar" = suave (pode retomar de onde parou); "Parar" = encerra o run.
- Ajustar `dispararAgora`/`dispararWave2` para, ao iniciar um disparo novo, garantir início limpo (o `paused=false` já é feito; sem mudança de comportamento além disso).

## Observação importante (latência esperada)
Tanto "Pausar" quanto "Parar" interrompem **após a mensagem que já está em envio** — há um intervalo anti-spam entre mensagens (dezenas de segundos a alguns minutos), então pode haver um pequeno atraso até a parada efetiva. A mensagem dos toasts deixa isso claro. Não há como abortar uma mensagem que já saiu para a Meta/Evolution.

## Validação
1. Typecheck dos arquivos alterados; deploy da edge function.
2. Iniciar um disparo de teste e clicar "Pausar" → confirmar via `reengajamento_dispatch_runs` que o run vai para `paused` e **não** volta para `running` no lote seguinte; `reengajamento_config.paused` permanece `true`.
3. Iniciar outro disparo e clicar "Parar" → confirmar `cancel_requested=true` e run em `cancelled`, sem continuações.
4. Clicar "Retomar/Disparar agora" → confirmar que um novo disparo inicia normalmente (pausa limpa).

## Arquivos
- `supabase/functions/reengajamento-descartados-enqueue/index.ts`
- `src/components/central-nutricao/ReengajamentoTab.tsx`

Sem migração de banco (coluna `cancel_requested` já existe).
